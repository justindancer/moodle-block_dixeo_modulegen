<?php
/**
 * Tests for fill-mode queue logging and retry helpers.
 *
 * @package    block_dixeo_modulegen
 * @category   test
 * @copyright  2026 Edunao SAS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace block_dixeo_modulegen;

defined('MOODLE_INTERNAL') || die();

use advanced_testcase;

/**
 * @covers \block_dixeo_modulegen\queue_service
 * @covers \block_dixeo_modulegen\queue_task_mode
 */
final class queue_fill_integration_test extends advanced_testcase {

    public function test_queue_task_mode_defaults(): void {
        $this->assertSame(queue_task_mode::MODE_GENERATE, queue_task_mode::from_params(null));
        $this->assertFalse(queue_task_mode::is_fill(null));
    }

    public function test_log_fill_completed_inserts_row(): void {
        global $DB;

        $this->resetAfterTest(true);
        $this->setAdminUser();
        $course = $this->getDataGenerator()->create_course();
        $jid = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee';

        $id = queue_service::log_fill_completed(
            (int) $course->id,
            'page',
            'Instructions',
            1,
            null,
            55,
            'My page',
            'Summary',
            $jid
        );

        $row = $DB->get_record(queue_repository::TABLE, ['id' => $id], '*', MUST_EXIST);
        $this->assertSame(queue_status::STATUS_COMPLETED, (int) $row->status);
        $this->assertSame(55, (int) $row->cmid);
        $this->assertTrue(queue_task_mode::is_fill($row->params));
    }

    public function test_start_next_invalidates_pending_fill(): void {
        global $DB;

        $this->resetAfterTest(true);
        $this->setAdminUser();
        $course = $this->getDataGenerator()->create_course();

        $record = queue_repository::create_base_record(
            (int) $course->id,
            'page',
            'X',
            1,
            null,
            'en'
        );
        $record->status = queue_status::STATUS_PENDING;
        $record->jobid = \core\uuid::generate();
        $record->params = json_encode(['mode' => queue_task_mode::MODE_FILL]);
        $tid = queue_repository::insert($record);

        $this->assertNull(queue_service::start_next((int) $course->id));

        $row = $DB->get_record(queue_repository::TABLE, ['id' => $tid], '*', MUST_EXIST);
        $this->assertSame(queue_status::STATUS_FAILED, (int) $row->status);
    }

    public function test_complete_failed_fill_retry(): void {
        global $DB;

        $this->resetAfterTest(true);
        $this->setAdminUser();
        $course = $this->getDataGenerator()->create_course();

        $record = queue_repository::create_base_record(
            (int) $course->id,
            'page',
            'X',
            1,
            null,
            'en'
        );
        $record->title = 'T';
        $record->status = queue_status::STATUS_FAILED;
        $record->jobid = 'old';
        $record->timecompleted = time();
        $record->params = json_encode([
            'mode' => queue_task_mode::MODE_FILL,
            'title' => 'T',
            'summary' => '',
            'dixeo_jobid' => 'old',
            'error' => 'e',
        ]);
        $tid = queue_repository::insert($record);

        $this->assertTrue(queue_service::complete_failed_fill_retry($tid, 77, 'newjob'));

        $row = $DB->get_record(queue_repository::TABLE, ['id' => $tid], '*', MUST_EXIST);
        $this->assertSame(queue_status::STATUS_COMPLETED, (int) $row->status);
        $this->assertSame(77, (int) $row->cmid);
        $params = json_decode($row->params, true);
        $this->assertArrayNotHasKey('error', $params);
    }
}
