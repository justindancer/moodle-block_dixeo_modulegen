<?php
/**
 * Presenter for queue data formatting and display.
 *
 * Handles all data transformation for UI display including status labels,
 * timestamps, module titles, and statistics aggregation.
 * Transforms raw database records into display-ready structures.
 *
 * @package    block_dixeo_modulegen
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @author     Pierre FACQ <pierre.facq@edunao.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace block_dixeo_modulegen;

defined('MOODLE_INTERNAL') || die();

/**
 * Presenter class for queue data formatting.
 *
 * @package    block_dixeo_modulegen
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @author     Pierre FACQ <pierre.facq@edunao.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class queue_presenter {

    /**
     * Format a single task record for display.
     *
     * Adds link, title, statuslabel, timestamp, and job_id fields.
     *
     * @param object $task The raw task record from database.
     * @return object The enriched task record for display.
     */
    public static function format_task(object $task): object {
        $modulename = $task->modulename;

        // Build the view link for completed modules.
        $task->link = null;
        if ((int) $task->status === queue_status::STATUS_COMPLETED && $task->cmid) {
            $task->link = (new \moodle_url('/mod/' . $modulename . '/view.php', [
                'id' => $task->cmid,
            ]))->out(false);
        }

        // Get the actual module title using Moodle's optimized course info API.
        $task->title = self::get_module_title($task);

        // Status label for display.
        $task->statuslabel = get_string('status_' . $task->status, 'block_dixeo_modulegen');

        // Select appropriate timestamp for display.
        $task->timestamp = self::get_timestamp_string($task);

        // Include job_id from params for JS polling.
        $params = $task->params ? json_decode($task->params, true) : [];
        $task->job_id = $task->jobid ?: ($params['job_id'] ?? null);

        return $task;
    }

    /**
     * Format multiple task records for display.
     *
     * @param array $tasks Array of raw task records.
     * @return array Array of formatted task records.
     */
    public static function format_tasks(array $tasks): array {
        $results = [];
        foreach ($tasks as $task) {
            $results[] = self::format_task($task);
        }
        return $results;
    }

    /**
     * Get the module title from course module info.
     *
     * Uses get_fast_modinfo() for efficient access to module data
     * instead of multiple database queries.
     *
     * @param object $task The task record with cmid and courseid.
     * @return string The module title or empty string if not found.
     */
    private static function get_module_title(object $task): string {
        if (!$task->cmid) {
            return '';
        }

        try {
            $modinfo = get_fast_modinfo($task->courseid);
            $cm = $modinfo->get_cm($task->cmid);
            return $cm->name;
        } catch (\Exception $e) {
            // Module may have been deleted or is inaccessible.
            return '';
        }
    }

    /**
     * Get the appropriate timestamp string for display.
     *
     * @param object $task The task record.
     * @return string The formatted timestamp string.
     */
    private static function get_timestamp_string(object $task): string {
        $status = (int) $task->status;

        if ($status === queue_status::STATUS_CANCELLED) {
            return get_string('timecancelled', 'block_dixeo_modulegen', userdate($task->timecompleted));
        }

        if ($task->timecompleted > 0) {
            return get_string('timecompleted', 'block_dixeo_modulegen', userdate($task->timecompleted));
        }

        if ($task->timestarted > 0) {
            return get_string('timestarted', 'block_dixeo_modulegen', userdate($task->timestarted));
        }

        return get_string('timecreated', 'block_dixeo_modulegen', userdate($task->timecreated));
    }

    /**
     * Calculate queue statistics from status counts.
     *
     * @param array $statusCounts Array of records with status and count fields.
     * @return array Statistics with queued, processing, completed counts.
     */
    public static function calculate_statistics(array $statusCounts): array {
        $stats = [
            'queued' => 0,
            'processing' => 0,
            'completed' => 0,
        ];

        foreach ($statusCounts as $record) {
            switch ((int) $record->status) {
                case queue_status::STATUS_PENDING:
                    $stats['queued'] += $record->count;
                    break;
                case queue_status::STATUS_PROCESSING:
                    $stats['processing'] += $record->count;
                    break;
                case queue_status::STATUS_COMPLETED:
                case queue_status::STATUS_FAILED:
                case queue_status::STATUS_CANCELLED:
                    $stats['completed'] += $record->count;
                    break;
            }
        }

        return $stats;
    }
}
