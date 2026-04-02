<?php
/**
 * Service for queue business logic and state transitions.
 *
 * Handles submit, complete, fail, cancel operations and task state management.
 * Handles state transitions and orchestrates repository and API interactions.
 *
 * @package    block_dixeo_modulegen
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @author     Josemaria Bolanos <admin@mako.digital>
 * @author     Pierre FACQ <pierre.facq@edunao.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace block_dixeo_modulegen;

use local_dixeo\service\module_generation_service;
use local_dixeo\service\job_service;
use local_dixeo\api\exception\api_exception;

defined('MOODLE_INTERNAL') || die();

/**
 * Service class for queue business logic.
 *
 * Handles all business logic related to the module generation queue including:
 * - Task submission and queuing
 * - Task state transitions (pending, processing, completed, failed, cancelled)
 * - Automatic queue processing (starting next task when current completes)
 * - Integration with external API for job submission
 *
 * @package    block_dixeo_modulegen
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @author     Josemaria Bolanos <admin@mako.digital>
 * @author     Pierre FACQ <pierre.facq@edunao.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class queue_service {

    /**
     * Submit a generation request.
     *
     * If no active job exists for the course, submits to API immediately.
     * Otherwise, queues as PENDING to wait for the active job.
     *
     * @param int $courseid The course ID.
     * @param string $modulename The module type to generate.
     * @param string $instructions Instructions for the AI.
     * @param int|null $sectionnumber Section number to add module to.
     * @param int|null $beforemod Course module ID to insert before.
     * @param string|null $lang Language code for content.
     * @return array Result with queue_id, job_id (if started), and status.
     * @throws api_exception If API call fails when starting immediately.
     */
    public static function submit(
        int $courseid,
        string $modulename,
        string $instructions,
        ?int $sectionnumber = null,
        ?int $beforemod = null,
        ?string $lang = null
    ): array {
        // Use current language if not specified.
        if (empty($lang)) {
            $lang = current_language();
        }

        // Check if course already has an active (PROCESSING) job.
        if (self::has_active_job($courseid)) {
            $queueid = self::add_task(
                $courseid,
                $modulename,
                $instructions,
                queue_status::STATUS_PENDING,
                null,
                $sectionnumber,
                $beforemod,
                $lang
            );

            return [
                'queueid' => $queueid,
                'jobid' => null,
                'status' => 'queued',
            ];
        }

        // No active job - submit to API immediately.
        $result = self::submit_to_api($modulename, $instructions, $courseid, $sectionnumber);

        $queueid = self::add_task(
            $courseid,
            $modulename,
            $instructions,
            queue_status::STATUS_PROCESSING,
            $result->jobid,
            $sectionnumber,
            $beforemod,
            $lang
        );

        return [
            'queueid' => $queueid,
            'jobid' => $result->jobid,
            'status' => 'processing',
        ];
    }

    /**
     * Mark a task as completed and start the next pending task.
     *
     * @param int $queueid The queue record ID.
     * @param int $cmid The created course module ID.
     * @return array|null Info about the next task if one was started, null otherwise.
     */
    public static function complete(int $queueid, int $cmid): ?array {
        $task = queue_repository::get_by_id($queueid);
        if (!$task) {
            return null;
        }

        self::finalize_task($task, queue_status::STATUS_COMPLETED, function ($task) use ($cmid) {
            $task->cmid = $cmid;
        });

        return self::start_next((int) $task->courseid);
    }

    /**
     * Mark a task as failed and start the next pending task.
     *
     * @param int $queueid The queue record ID.
     * @param string $error The error message.
     * @return array|null Info about the next task if one was started, null otherwise.
     */
    public static function fail(int $queueid, string $error): ?array {
        $task = queue_repository::get_by_id($queueid);
        if (!$task) {
            return null;
        }

        self::finalize_task($task, queue_status::STATUS_FAILED, function ($task) use ($error) {
            self::update_task_params($task, ['error' => $error]);
        });

        return self::start_next((int) $task->courseid);
    }

    /**
     * Cancel a pending or processing task.
     *
     * PENDING: mark as CANCELLED only.
     * PROCESSING: tell the Dixeo API to cancel the job, mark task CANCELLED, then start the next pending task.
     *
     * @param int $queueid The queue record ID.
     * @return bool True if cancelled successfully, false otherwise.
     */
    public static function cancel(int $queueid): bool {
        $task = queue_repository::get_by_id($queueid);
        if (!$task) {
            return false;
        }

        $status = (int) $task->status;

        if ($status === queue_status::STATUS_PENDING) {
            $task->status = queue_status::STATUS_CANCELLED;
            $task->timecompleted = time();
            return queue_repository::update($task);
        }

        if ($status === queue_status::STATUS_PROCESSING) {
            if (!empty($task->jobid)) {
                try {
                    (new job_service())->cancel_job($task->jobid);
                } catch (\Exception $e) {
                    // Still mark as cancelled and start next so the queue does not get stuck.
                }
            }
            $task->status = queue_status::STATUS_CANCELLED;
            $task->timecompleted = time();
            queue_repository::update($task);
            self::start_next((int) $task->courseid);
            return true;
        }

        return false;
    }

    /**
     * Delete a task from the queue (remove from queue or remove from display).
     * Allowed for PENDING, COMPLETED, FAILED, CANCELLED. Not allowed for PROCESSING.
     *
     * @param int $queueid The queue record ID.
     * @return bool True if deleted, false if task not found or status not allowed.
     */
    public static function delete(int $queueid): bool {
        $task = queue_repository::get_by_id($queueid);
        if (!$task) {
            return false;
        }

        if ((int) $task->status === queue_status::STATUS_PROCESSING) {
            return false;
        }

        return queue_repository::delete($queueid);
    }

    /**
     * Check if a course has an active (PROCESSING) job.
     *
     * @param int $courseid The course ID.
     * @return bool True if there is an active job.
     */
    public static function has_active_job(int $courseid): bool {
        return queue_repository::exists_with_status($courseid, queue_status::STATUS_PROCESSING);
    }

    /**
     * Start the next pending task for a course.
     *
     * Uses iteration instead of recursion to safely process tasks
     * when API submissions fail.
     *
     * @param int $courseid The course ID.
     * @return array|null Task info with job_id if started, null if no pending tasks.
     */
    public static function start_next(int $courseid): ?array {
        // Iterate through pending tasks until one succeeds or none remain.
        while (true) {
            $task = queue_repository::get_next_pending($courseid, queue_status::STATUS_PENDING);

            if (!$task) {
                return null;
            }

            // Fill-mode rows are terminal logs only; never run through the generate API.
            if (queue_task_mode::is_fill($task->params ?? null)) {
                $task->status = queue_status::STATUS_FAILED;
                $task->timecompleted = time();
                self::update_task_params($task, [
                    'error' => 'Invalid queue state: fill tasks cannot be pending.',
                ]);
                queue_repository::update($task);
                continue;
            }

            try {
                $result = self::submit_to_api(
                    $task->modulename,
                    $task->instructions,
                    $courseid,
                    $task->sectionnumber
                );

                // Update task to PROCESSING.
                $task->status = queue_status::STATUS_PROCESSING;
                $task->jobid = $result->jobid;
                $task->timestarted = time();
                self::update_task_params($task, ['jobid' => $result->jobid]);
                queue_repository::update($task);

                return [
                    'queueid' => (int) $task->id,
                    'jobid' => $result->jobid,
                    'modulename' => $task->modulename,
                    'courseid' => $courseid,
                    'sectionnumber' => $task->sectionnumber,
                    'beforemod' => $task->beforemod,
                ];

            } catch (\Exception $e) {
                // API submission failed - mark this task as failed and continue loop.
                $task->status = queue_status::STATUS_FAILED;
                $task->timecompleted = time();
                self::update_task_params($task, ['error' => $e->getMessage()]);
                queue_repository::update($task);
                // Loop continues to try the next pending task.
            }
        }
    }

    /**
     * Add a task to the queue with the specified status.
     *
     * Consolidates add_pending() and add_processing() into a single method
     * to eliminate code duplication.
     *
     * @param int $courseid The course ID.
     * @param string $modulename The module type.
     * @param string $instructions The AI instructions.
     * @param int $status The initial task status.
     * @param string|null $jobid The Dixeo job UUID (for processing tasks).
     * @param int|null $sectionnumber Section number.
     * @param int|null $beforemod Course module to insert before.
     * @param string|null $lang Language code.
     * @return int The queue record ID.
     */
    protected static function add_task(
        int $courseid,
        string $modulename,
        string $instructions,
        int $status,
        ?string $jobid = null,
        ?int $sectionnumber = null,
        ?int $beforemod = null,
        ?string $lang = null
    ): int {
        $record = queue_repository::create_base_record(
            $courseid,
            $modulename,
            $instructions,
            $sectionnumber,
            $beforemod,
            $lang
        );

        $record->status = $status;

        // Set processing-specific fields when job is already submitted.
        if ($jobid !== null) {
            $record->jobid = $jobid;
            $record->params = json_encode(['jobid' => $jobid]);
            $record->timestarted = time();
        }

        return queue_repository::insert($record);
    }

    /**
     * Finalize a task with a terminal status.
     *
     * Consolidates common logic between complete() and fail() methods.
     *
     * @param object $task The task record to finalize.
     * @param int $status The terminal status (COMPLETED or FAILED).
     * @param callable $customizer Optional callback to apply additional changes.
     */
    private static function finalize_task(object $task, int $status, callable $customizer = null): void {
        $task->status = $status;
        $task->timecompleted = time();

        if ($customizer !== null) {
            $customizer($task);
        }

        queue_repository::update($task);
    }

    /**
     * Submit a job to the Dixeo API.
     *
     * Extracted helper to avoid duplicating API service instantiation.
     *
     * @param string $modulename The module type.
     * @param string $instructions The AI instructions.
     * @param int $courseid The course ID.
     * @param int|null $sectionnumber Section number.
     * @return object The API result with jobid.
     * @throws api_exception If API call fails.
     */
    private static function submit_to_api(
        string $modulename,
        string $instructions,
        int $courseid,
        ?int $sectionnumber
    ): object {
        return (new module_generation_service())->submit_generate_job_for_course(
            $modulename,
            $instructions,
            $courseid,
            $sectionnumber
        );
    }

    /**
     * Update task params JSON field with new values.
     *
     * @param object $task The task record.
     * @param array $updates Key-value pairs to merge into params.
     */
    private static function update_task_params(object $task, array $updates): void {
        $params = $task->params ? json_decode($task->params, true) : [];
        $params = array_merge($params, $updates);
        $task->params = json_encode($params);
    }

    /**
     * Insert a completed fill log row (terminal; does not start queue processing).
     *
     * @param int|null $beforemod Insert-before cm id or null.
     */
    public static function log_fill_completed(
        int $courseid,
        string $modulename,
        string $instructions,
        int $sectionnumber,
        ?int $beforemod,
        int $cmid,
        string $displaytitle,
        string $summaryraw,
        string $filljobid
    ): int {
        $lang = current_language();
        $record = queue_repository::create_base_record(
            $courseid,
            $modulename,
            $instructions,
            $sectionnumber,
            $beforemod,
            $lang
        );
        $record->title = clean_param($displaytitle, PARAM_TEXT);
        $record->status = queue_status::STATUS_COMPLETED;
        $record->cmid = $cmid;
        $jobid = $filljobid !== '' ? $filljobid : \core\uuid::generate();
        $record->jobid = $jobid;
        $record->timecompleted = time();
        $record->params = json_encode(self::fill_params_payload(
            $displaytitle,
            $summaryraw,
            $jobid,
            null
        ));
        return queue_repository::insert($record);
    }

    /**
     * Insert a failed fill log row (retryable from modulegen UI).
     */
    public static function log_fill_failed(
        int $courseid,
        string $modulename,
        string $instructions,
        int $sectionnumber,
        ?int $beforemod,
        string $displaytitle,
        string $summaryraw,
        string $filljobid,
        string $errormessage
    ): int {
        $lang = current_language();
        $record = queue_repository::create_base_record(
            $courseid,
            $modulename,
            $instructions,
            $sectionnumber,
            $beforemod,
            $lang
        );
        $record->title = clean_param($displaytitle, PARAM_TEXT);
        $record->status = queue_status::STATUS_FAILED;
        $record->cmid = 0;
        $jobid = $filljobid !== '' ? $filljobid : \core\uuid::generate();
        $record->jobid = $jobid;
        $record->timecompleted = time();
        $record->params = json_encode(self::fill_params_payload(
            $displaytitle,
            $summaryraw,
            $filljobid !== '' ? $filljobid : $jobid,
            $errormessage
        ));
        return queue_repository::insert($record);
    }

    /**
     * Mark a failed fill row completed after successful retry.
     */
    public static function complete_failed_fill_retry(int $queueid, int $cmid, string $filljobid = ''): bool {
        $task = queue_repository::get_by_id($queueid);
        if (!$task || (int) $task->status !== queue_status::STATUS_FAILED) {
            return false;
        }
        if (!queue_task_mode::is_fill($task->params)) {
            return false;
        }
        $params = $task->params ? json_decode($task->params, true) : [];
        if (!is_array($params)) {
            $params = [];
        }
        unset($params['error']);
        if ($filljobid !== '') {
            $params['dixeo_jobid'] = $filljobid;
            $task->jobid = $filljobid;
        }
        $task->params = json_encode($params);
        $task->status = queue_status::STATUS_COMPLETED;
        $task->cmid = $cmid;
        $task->timecompleted = time();
        return queue_repository::update($task);
    }

    /**
     * Refresh error text on a failed fill row after a failed retry.
     */
    public static function fail_fill_retry(int $queueid, string $error): bool {
        $task = queue_repository::get_by_id($queueid);
        if (!$task || (int) $task->status !== queue_status::STATUS_FAILED) {
            return false;
        }
        if (!queue_task_mode::is_fill($task->params)) {
            return false;
        }
        self::update_task_params($task, ['error' => $error]);
        $task->timecompleted = time();
        return queue_repository::update($task);
    }

    /**
     * @return array<string, mixed>
     */
    private static function fill_params_payload(
        string $title,
        string $summary,
        string $dixeojobid,
        ?string $error
    ): array {
        $p = [
            'mode' => queue_task_mode::MODE_FILL,
            'title' => $title,
            'summary' => $summary,
            'dixeo_jobid' => $dixeojobid,
        ];
        if ($error !== null && $error !== '') {
            $p['error'] = $error;
        }
        return $p;
    }
}
