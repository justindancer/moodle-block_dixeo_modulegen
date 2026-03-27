<?php
/**
 * Unified external API for the Dixeo Module Generator block.
 *
 * Consolidates all web service functions:
 * - submit_generation: Queue a new module generation
 * - get_queue_status: Get tasks and stats for a course
 * - update_task: Complete, fail, or cancel a task
 * - retry_fill_task: Retry a failed fill-mode queue row
 *
 * @package    block_dixeo_modulegen
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @author     Pierre FACQ <pierre.facq@edunao.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace block_dixeo_modulegen\external;

use core_external\external_api;
use core_external\external_function_parameters;
use core_external\external_multiple_structure;
use core_external\external_single_structure;
use core_external\external_value;
use block_dixeo_modulegen\queue_service;
use block_dixeo_modulegen\queue_repository;
use block_dixeo_modulegen\queue_presenter;
use block_dixeo_modulegen\queue_status;
use block_dixeo_modulegen\queue_task_mode;
use local_dixeo\api\exception\api_exception;
use local_dixeo\external\create_module_from_job;
use local_dixeo\external\service_factory;

defined('MOODLE_INTERNAL') || die();

/**
 * Unified external API class for module generation.
 *
 * Provides all web service functions for the block:
 * - submit_generation: Queue a new module generation request
 * - get_queue_status: Get tasks and statistics for a course
 * - update_task: Complete, fail, or cancel a task
 *
 * All methods include proper parameter validation, capability checks,
 * and standardized error handling.
 *
 * @package    block_dixeo_modulegen
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @author     Pierre FACQ <pierre.facq@edunao.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class api extends external_api {

    /**
     * Validate course access and capabilities.
     *
     * Ensures the user is logged into the course and has manageactivities capability.
     * Sets PAGE context for security and correct output during the request.
     *
     * @param int $courseid The course ID.
     * @return \context_course The course context.
     * @throws \required_capability_exception If user lacks capability.
     */
    private static function validate_course_access(int $courseid): \context_course {
        global $PAGE;
        require_course_login($courseid);
        $context = \context_course::instance($courseid);
        $PAGE->set_context($context);
        require_capability('moodle/course:manageactivities', $context);
        return $context;
    }

    /**
     * Create a standardized error response for submit_generation.
     *
     * Matches the structure defined in submit_generation_returns().
     *
     * @param string $code Error code for programmatic handling.
     * @param string $message Human-readable error message.
     * @return array Standardized error response structure.
     */
    private static function create_error_response(string $code, string $message): array {
        return [
            'success' => false,
            'queueid' => 0,
            'jobid' => '',
            'status' => 'error',
            'error' => [
                'code' => $code,
                'message' => $message,
            ],
        ];
    }

    /**
     * Create a standardized error response for update_task.
     *
     * Matches the structure defined in update_task_returns().
     *
     * @param string $message Human-readable error message.
     * @return array Standardized error response structure.
     */
    private static function create_update_error_response(string $message): array {
        return [
            'success' => false,
            'message' => $message,
        ];
    }

    // =========================================================================
    // submit_generation - Queue a new module generation request
    // =========================================================================

    /**
     * Parameters for submit_generation.
     *
     * @return external_function_parameters
     */
    public static function submit_generation_parameters(): external_function_parameters {
        return new external_function_parameters([
            'courseid' => new external_value(PARAM_INT, 'Course ID'),
            'modulename' => new external_value(PARAM_TEXT, 'Module type to generate'),
            'instructions' => new external_value(PARAM_RAW, 'Instructions for the AI'),
            'sectionnumber' => new external_value(PARAM_INT, 'Section number', VALUE_DEFAULT, 0),
            'beforemod' => new external_value(PARAM_INT, 'Insert before this module ID', VALUE_DEFAULT, 0),
            'lang' => new external_value(PARAM_TEXT, 'Language code', VALUE_OPTIONAL),
        ]);
    }

    /**
     * Submit a module generation request.
     *
     * If no active job exists for the course, submits to API immediately.
     * Otherwise, queues as pending to wait for the active job.
     *
     * @param int $courseid The course ID.
     * @param string $modulename The module type to generate.
     * @param string $instructions Instructions for the AI.
     * @param int $sectionnumber Section number to add module to.
     * @param int $beforemod Course module ID to insert before.
     * @param string|null $lang Language code for content.
     * @return array Result with queue_id, job_id, and status.
     */
    public static function submit_generation(
        int $courseid,
        string $modulename,
        string $instructions,
        ?int $sectionnumber = 0,
        ?int $beforemod = 0,
        ?string $lang = null
    ): array {
        // Validate parameters.
        $params = self::validate_parameters(self::submit_generation_parameters(), [
            'courseid' => $courseid,
            'modulename' => $modulename,
            'instructions' => $instructions,
            'sectionnumber' => $sectionnumber,
            'beforemod' => $beforemod,
            'lang' => $lang,
        ]);

        self::validate_course_access($params['courseid']);

        try {
            $result = queue_service::submit(
                $params['courseid'],
                $params['modulename'],
                $params['instructions'],
                $params['sectionnumber'] ?: null,
                $params['beforemod'] ?: null,
                $params['lang']
            );

            return [
                'success' => true,
                'queueid' => $result['queueid'],
                'jobid' => $result['jobid'] ?? '',
                'status' => $result['status'],
            ];

        } catch (api_exception $e) {
            return self::create_error_response($e->get_error_code(), $e->getMessage());

        } catch (\Exception $e) {
            return self::create_error_response('submission_failed', $e->getMessage());
        }
    }

    /**
     * Return values for submit_generation.
     *
     * @return external_single_structure
     */
    public static function submit_generation_returns(): external_single_structure {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Whether submission succeeded'),
            'queueid' => new external_value(PARAM_INT, 'Queue record ID'),
            'jobid' => new external_value(PARAM_RAW, 'Dixeo job UUID (empty if queued)', VALUE_DEFAULT, ''),
            'status' => new external_value(PARAM_TEXT, 'Status: processing, queued, or error'),
            'error' => new external_single_structure([
                'code' => new external_value(PARAM_TEXT, 'Error code'),
                'message' => new external_value(PARAM_TEXT, 'Error message'),
            ], 'Error details', VALUE_OPTIONAL),
        ]);
    }

    // =========================================================================
    // get_queue_status - Get queue tasks and statistics for a course
    // =========================================================================

    /**
     * Parameters for get_queue_status.
     *
     * @return external_function_parameters
     */
    public static function get_queue_status_parameters(): external_function_parameters {
        return new external_function_parameters([
            'courseid' => new external_value(PARAM_INT, 'Course ID'),
        ]);
    }

    /**
     * Get queue status including tasks and statistics.
     *
     * @param int $courseid The course ID.
     * @return array Tasks list and statistics.
     */
    public static function get_queue_status(int $courseid): array {
        $params = self::validate_parameters(self::get_queue_status_parameters(), [
            'courseid' => $courseid,
        ]);

        self::validate_course_access($params['courseid']);

        // Fetch raw tasks and format them for display.
        $rawtasks = queue_repository::get_all_by_course($params['courseid']);
        $tasks = queue_presenter::format_tasks($rawtasks);

        // Aggregate status counts into statistics.
        $statuscounts = queue_repository::get_status_counts($params['courseid']);
        $stats = queue_presenter::calculate_statistics($statuscounts);

        return [
            'tasks' => $tasks,
            'stats' => $stats,
        ];
    }

    /**
     * Return values for get_queue_status.
     *
     * @return external_single_structure
     */
    public static function get_queue_status_returns(): external_single_structure {
        $task = new external_single_structure([
            'id' => new external_value(PARAM_INT, 'Task ID'),
            'courseid' => new external_value(PARAM_INT, 'Course ID', VALUE_OPTIONAL),
            'modulename' => new external_value(PARAM_TEXT, 'Module type'),
            'title' => new external_value(PARAM_TEXT, 'Module title', VALUE_OPTIONAL),
            'instructions' => new external_value(PARAM_RAW, 'AI instructions', VALUE_OPTIONAL),
            'status' => new external_value(PARAM_INT, 'Status code'),
            'statuslabel' => new external_value(PARAM_TEXT, 'Status label', VALUE_OPTIONAL),
            'jobid' => new external_value(PARAM_RAW, 'Dixeo job UUID', VALUE_OPTIONAL),
            'cmid' => new external_value(PARAM_INT, 'Created module ID', VALUE_OPTIONAL),
            'sectionnumber' => new external_value(PARAM_INT, 'Section number', VALUE_OPTIONAL),
            'beforemod' => new external_value(PARAM_INT, 'Insert before module', VALUE_OPTIONAL),
            'link' => new external_value(PARAM_URL, 'Link to created module', VALUE_OPTIONAL),
            'displaytitle' => new external_value(PARAM_TEXT, 'Display title (New MODULETYPE or activity title)', VALUE_OPTIONAL),
            'completedonshort' => new external_value(PARAM_TEXT, 'Short completion date for completed tasks', VALUE_OPTIONAL),
            'timestamp' => new external_value(PARAM_TEXT, 'Display timestamp', VALUE_OPTIONAL),
            'timecreated' => new external_value(PARAM_INT, 'Creation time', VALUE_OPTIONAL),
            'timestarted' => new external_value(PARAM_INT, 'Start time', VALUE_OPTIONAL),
            'timecompleted' => new external_value(PARAM_INT, 'Completion time', VALUE_OPTIONAL),
            'params' => new external_value(PARAM_RAW, 'JSON params', VALUE_OPTIONAL),
            'sortorder' => new external_value(PARAM_INT, 'Sort order (deprecated)', VALUE_OPTIONAL),
            'description' => new external_value(PARAM_RAW, 'Description', VALUE_OPTIONAL),
            'hints' => new external_value(PARAM_RAW, 'Hints', VALUE_OPTIONAL),
            'lang' => new external_value(PARAM_TEXT, 'Language', VALUE_OPTIONAL),
            'queuemode' => new external_value(PARAM_ALPHA, 'Task mode: generate or fill', VALUE_OPTIONAL),
        ], 'Task record');

        $stats = new external_single_structure([
            'active' => new external_value(PARAM_INT, 'Active/queued tasks count (pending + processing)'),
            'errors' => new external_value(PARAM_INT, 'Tasks needing attention (failed + cancelled)'),
        ]);

        return new external_single_structure([
            'tasks' => new external_multiple_structure($task),
            'stats' => $stats,
        ]);
    }

    // =========================================================================
    // update_task - Complete, fail, or cancel a task
    // =========================================================================

    /**
     * Parameters for update_task.
     *
     * @return external_function_parameters
     */
    public static function update_task_parameters(): external_function_parameters {
        return new external_function_parameters([
            'queueid' => new external_value(PARAM_INT, 'Queue record ID'),
            'action' => new external_value(PARAM_ALPHA, 'Action: complete, fail, or cancel'),
            'cmid' => new external_value(PARAM_INT, 'Created module ID (for complete)', VALUE_DEFAULT, 0),
            'error' => new external_value(PARAM_RAW, 'Error message (for fail)', VALUE_DEFAULT, ''),
        ]);
    }

    /**
     * Update a task status (complete, fail, or cancel).
     *
     * For complete/fail actions, also starts the next pending task if one exists.
     *
     * @param int $queueid The queue record ID.
     * @param string $action The action: complete, fail, or cancel.
     * @param int $cmid The created module ID (for complete action).
     * @param string $error The error message (for fail action).
     * @return array Result with success status and next_task info if applicable.
     */
    public static function update_task(
        int $queueid,
        string $action,
        int $cmid = 0,
        string $error = ''
    ): array {
        $params = self::validate_parameters(self::update_task_parameters(), [
            'queueid' => $queueid,
            'action' => $action,
            'cmid' => $cmid,
            'error' => $error,
        ]);

        // Get task to verify course access.
        $task = queue_repository::get_by_id($params['queueid']);
        if (!$task) {
            return self::create_update_error_response('Task not found');
        }

        self::validate_course_access($task->courseid);

        $nexttask = null;

        switch ($params['action']) {
            case 'complete':
                if ($params['cmid'] <= 0) {
                    return self::create_update_error_response('cmid required for complete action');
                }
                $nexttask = queue_service::complete($params['queueid'], $params['cmid']);
                break;

            case 'fail':
                $nexttask = queue_service::fail($params['queueid'], $params['error']);
                break;

            case 'cancel':
                $success = queue_service::cancel($params['queueid']);
                return [
                    'success' => $success,
                    'message' => $success ? 'Task cancelled' : 'Cannot cancel this task',
                ];

            default:
                return self::create_update_error_response('Invalid action: ' . $params['action']);
        }

        $result = [
            'success' => true,
            'message' => 'Task updated',
        ];

        // Include next task info if one was started.
        if ($nexttask) {
            $result['next_task'] = $nexttask;
        }

        return $result;
    }

    /**
     * Return values for update_task.
     *
     * @return external_single_structure
     */
    public static function update_task_returns(): external_single_structure {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Whether update succeeded'),
            'message' => new external_value(PARAM_TEXT, 'Result message', VALUE_OPTIONAL),
            'next_task' => new external_single_structure([
                'queueid' => new external_value(PARAM_INT, 'Next task queue ID'),
                'jobid' => new external_value(PARAM_RAW, 'Next task job UUID'),
                'modulename' => new external_value(PARAM_TEXT, 'Module type'),
                'courseid' => new external_value(PARAM_INT, 'Course ID'),
                'sectionnumber' => new external_value(PARAM_INT, 'Section number', VALUE_OPTIONAL),
                'beforemod' => new external_value(PARAM_INT, 'Insert before module', VALUE_OPTIONAL),
            ], 'Next task that was started', VALUE_OPTIONAL),
        ]);
    }

    // =========================================================================
    // retry_fill_task - Retry failed fill-mode row (Dixeo fill_module + create)
    // =========================================================================

    /**
     * Parameters for retry_fill_task.
     *
     * @return external_function_parameters
     */
    public static function retry_fill_task_parameters(): external_function_parameters {
        return new external_function_parameters([
            'queueid' => new external_value(PARAM_INT, 'Queue record ID'),
            'courseid' => new external_value(PARAM_INT, 'Course ID (must match task)'),
        ]);
    }

    /**
     * Retry a failed fill task (params.mode = fill).
     *
     * @param int $queueid Queue row id.
     * @param int $courseid Course id.
     * @return array success, message, cmid
     */
    public static function retry_fill_task(int $queueid, int $courseid): array {
        $params = self::validate_parameters(self::retry_fill_task_parameters(), [
            'queueid' => $queueid,
            'courseid' => $courseid,
        ]);

        $task = queue_repository::get_by_id($params['queueid']);
        if (!$task || (int) $task->courseid !== $params['courseid']) {
            return [
                'success' => false,
                'message' => get_string('retry_fill_notfound', 'block_dixeo_modulegen'),
                'cmid' => 0,
            ];
        }

        self::validate_course_access($params['courseid']);

        if ((int) $task->status !== queue_status::STATUS_FAILED) {
            return [
                'success' => false,
                'message' => get_string('retry_fill_notfailed', 'block_dixeo_modulegen'),
                'cmid' => 0,
            ];
        }
        if (!queue_task_mode::is_fill($task->params ?? null)) {
            return [
                'success' => false,
                'message' => get_string('retry_fill_notfill', 'block_dixeo_modulegen'),
                'cmid' => 0,
            ];
        }

        $p = $task->params ? json_decode($task->params, true) : [];
        $p = is_array($p) ? $p : [];
        $rawtitle = isset($p['title']) ? trim((string) $p['title']) : trim((string) ($task->title ?? ''));
        $summary = isset($p['summary']) ? trim((string) $p['summary']) : '';
        $filldisplay = $rawtitle !== '' ? $rawtitle : get_string('filltask_defaulttitle', 'block_dixeo_modulegen');
        $nameoverride = $rawtitle !== '' ? $rawtitle : null;
        $beforemod = !empty($task->beforemod) ? (int) $task->beforemod : null;

        $out = self::run_fill_retry_pipeline(
            (string) $task->modulename,
            (string) $task->instructions,
            (int) $task->courseid,
            (int) ($task->sectionnumber ?? 0),
            $beforemod,
            $filldisplay,
            $nameoverride,
            $summary
        );

        if (!empty($out['success']) && !empty($out['cmid'])) {
            queue_service::complete_failed_fill_retry(
                $params['queueid'],
                (int) $out['cmid'],
                (string) ($out['fill_jobid'] ?? '')
            );
            return [
                'success' => true,
                'message' => '',
                'cmid' => (int) $out['cmid'],
            ];
        }

        if (!empty($out['error'])) {
            queue_service::fail_fill_retry($params['queueid'], (string) $out['error']);
        }

        return [
            'success' => false,
            'message' => !empty($out['error'])
                ? (string) $out['error']
                : get_string('retry_fill_failed', 'block_dixeo_modulegen'),
            'cmid' => 0,
        ];
    }

    /**
     * Return values for retry_fill_task.
     *
     * @return external_single_structure
     */
    public static function retry_fill_task_returns(): external_single_structure {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Whether fill succeeded'),
            'message' => new external_value(PARAM_RAW, 'Error or empty', VALUE_DEFAULT, ''),
            'cmid' => new external_value(PARAM_INT, 'Created course module id on success'),
        ]);
    }

    /**
     * Run fill_module job, wait, create activity (used for fill retry only).
     *
     * @return array{success: bool, cmid: int, error: string, fill_jobid: string}
     */
    private static function run_fill_retry_pipeline(
        string $modulename,
        string $instructions,
        int $courseid,
        int $sectionnumber,
        ?int $beforemod,
        string $filldisplaytitle,
        ?string $nameoverride,
        string $summaryraw
    ): array {
        $moduleservice = service_factory::get_module_generation_service();
        $jobservice = service_factory::get_job_service();
        $filljobid = '';
        try {
            $operation = $moduleservice->submit_fill_job_for_course(
                $modulename,
                $instructions,
                $courseid,
                $sectionnumber,
                $filldisplaytitle,
                $summaryraw
            );
            $filljobid = (string) ($operation->jobid ?? '');

            $waitResult = $jobservice->wait_for_job($operation->jobid, 'fill_module');
            if (!$waitResult->is_completed()) {
                return [
                    'success' => false,
                    'cmid' => 0,
                    'error' => get_string('retry_fill_timeout', 'block_dixeo_modulegen'),
                    'fill_jobid' => $filljobid,
                ];
            }

            $introoverride = $summaryraw !== '' ? format_text($summaryraw, FORMAT_PLAIN) : null;

            $result = create_module_from_job::execute(
                $operation->jobid,
                $courseid,
                $sectionnumber,
                $beforemod,
                $nameoverride,
                $introoverride
            );

            if (empty($result['success'])) {
                $errmsg = !empty($result['errormessage'])
                    ? (string) $result['errormessage']
                    : get_string('retry_fill_createfailed', 'block_dixeo_modulegen');
                return [
                    'success' => false,
                    'cmid' => 0,
                    'error' => $errmsg,
                    'fill_jobid' => $filljobid,
                ];
            }

            return [
                'success' => true,
                'cmid' => (int) ($result['cmid'] ?? 0),
                'error' => '',
                'fill_jobid' => $filljobid,
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'cmid' => 0,
                'error' => $e->getMessage(),
                'fill_jobid' => $filljobid,
            ];
        }
    }

    // =========================================================================
    // delete_task - Remove a task from the queue (database)
    // =========================================================================

    /**
     * Parameters for delete_task.
     *
     * @return external_function_parameters
     */
    public static function delete_task_parameters(): external_function_parameters {
        return new external_function_parameters([
            'queueid' => new external_value(PARAM_INT, 'Queue record ID'),
        ]);
    }

    /**
     * Delete a task. Allowed for queued, completed, failed, cancelled. Not for processing.
     *
     * @param int $queueid The queue record ID.
     * @return array Result with success and message.
     */
    public static function delete_task(int $queueid): array {
        $params = self::validate_parameters(self::delete_task_parameters(), [
            'queueid' => $queueid,
        ]);

        $task = queue_repository::get_by_id($params['queueid']);
        if (!$task) {
            return ['success' => false, 'message' => 'Task not found'];
        }

        self::validate_course_access($task->courseid);

        $success = queue_service::delete($params['queueid']);

        return [
            'success' => $success,
            'message' => $success ? 'Task removed' : 'Cannot remove this task',
        ];
    }

    /**
     * Return values for delete_task.
     *
     * @return external_single_structure
     */
    public static function delete_task_returns(): external_single_structure {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Whether delete succeeded'),
            'message' => new external_value(PARAM_TEXT, 'Result message'),
        ]);
    }
}
