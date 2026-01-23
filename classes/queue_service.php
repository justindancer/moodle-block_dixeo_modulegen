<?php
/**
 * Service for queue business logic and state transitions.
 *
 * Handles submit, complete, fail, cancel operations and task state management.
 * Handles state transitions and orchestrates repository and API interactions.
 *
 * @package    block_dixeo_modulegen
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @author     Pierre FACQ <pierre.facq@edunao.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace block_dixeo_modulegen;

use local_dixeo\service\module_generation_service;
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
                'queue_id' => $queueid,
                'job_id' => null,
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
            'queue_id' => $queueid,
            'job_id' => $result->jobid,
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
     * Cancel a pending task.
     *
     * Only PENDING tasks can be cancelled. PROCESSING tasks are already
     * running and cannot be cancelled through this method.
     *
     * @param int $queueid The queue record ID.
     * @return bool True if cancelled successfully, false otherwise.
     */
    public static function cancel(int $queueid): bool {
        $task = queue_repository::get_by_id($queueid);
        if (!$task) {
            return false;
        }

        // Only allow cancelling PENDING tasks.
        if ((int) $task->status !== queue_status::STATUS_PENDING) {
            return false;
        }

        $task->status = queue_status::STATUS_CANCELLED;
        $task->timecompleted = time();

        return queue_repository::update($task);
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
                self::update_task_params($task, ['job_id' => $result->jobid]);
                queue_repository::update($task);

                return [
                    'queue_id' => (int) $task->id,
                    'job_id' => $result->jobid,
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
            $record->params = json_encode(['job_id' => $jobid]);
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
}
