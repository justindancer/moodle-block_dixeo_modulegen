<?php
/**
 * Schedules background processing of the module generation queue.
 *
 * @package    block_dixeo_modulegen
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace block_dixeo_modulegen;

defined('MOODLE_INTERNAL') || die();

/**
 * Queues adhoc tasks to process pending modulegen jobs per course.
 */
class queue_processor {

    /**
     * Schedule background processing for a course queue.
     *
     * Dedupes: only one adhoc task per course is queued at a time.
     *
     * @param int $courseid The course ID.
     * @param int $userid User initiating or continuing the queue (for file sync).
     * @return void
     */
    public static function schedule(int $courseid, int $userid): void {
        if ($courseid <= SITEID || $userid <= 0) {
            return;
        }

        $existingtasks = \core\task\manager::get_adhoc_tasks(task\process_modulegen_queue::class);
        foreach ($existingtasks as $task) {
            $data = $task->get_custom_data();
            if (isset($data->courseid) && (int) $data->courseid === $courseid) {
                return;
            }
        }

        $task = new task\process_modulegen_queue();
        $task->set_custom_data((object) [
            'courseid' => $courseid,
            'userid' => $userid,
        ]);

        \core\task\manager::queue_adhoc_task($task, true);
    }
}
