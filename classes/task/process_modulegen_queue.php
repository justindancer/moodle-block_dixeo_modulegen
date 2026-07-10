<?php
/**
 * Adhoc task: ensure file sync then submit the next pending modulegen job.
 *
 * @package    block_dixeo_modulegen
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace block_dixeo_modulegen\task;

use block_dixeo_modulegen\queue_service;

defined('MOODLE_INTERNAL') || die();

/**
 * Processes one pending generate task for a course (sync then API submit).
 */
class process_modulegen_queue extends \core\task\adhoc_task {

    /**
     * @return string
     */
    public function get_name(): string {
        return get_string('task_process_modulegen_queue', 'block_dixeo_modulegen');
    }

    /**
     * @return void
     */
    public function execute(): void {
        $data = $this->get_custom_data();

        if (empty($data->courseid)) {
            mtrace('process_modulegen_queue: No course ID provided');
            return;
        }

        $courseid = (int) $data->courseid;
        $userid = isset($data->userid) ? (int) $data->userid : 0;

        mtrace("process_modulegen_queue: Processing queue for course {$courseid}");

        $result = queue_service::process_next_pending($courseid, $userid);

        if ($result === null) {
            mtrace("process_modulegen_queue: No pending task started for course {$courseid}");
            return;
        }

        mtrace("process_modulegen_queue: Started queue {$result['queueid']} job {$result['jobid']}");
    }
}
