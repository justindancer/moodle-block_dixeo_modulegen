<?php
/**
 * Tests for modulegen queue submit and background processor scheduling.
 *
 * @package    block_dixeo_modulegen
 * @category   test
 * @copyright  2026 Edunao SAS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace block_dixeo_modulegen;

defined('MOODLE_INTERNAL') || die();

use advanced_testcase;
use local_dixeo\dto\operation_result;
use local_dixeo\external\service_factory;
use local_dixeo\service\file_sync_service;
use local_dixeo\service\module_generation_service;
use block_dixeo_modulegen\task\process_modulegen_queue;

/**
 * @covers \block_dixeo_modulegen\queue_service
 * @covers \block_dixeo_modulegen\queue_processor
 */
final class queue_processor_test extends advanced_testcase {

    protected function tearDown(): void {
        service_factory::set_test_file_sync_service(null);
        service_factory::set_test_module_generation_service(null);
        parent::tearDown();
    }

    public function test_submit_always_creates_pending_and_schedules_adhoc(): void {
        global $DB;

        $this->resetAfterTest(true);
        $this->setAdminUser();
        $course = $this->getDataGenerator()->create_course();

        $result = queue_service::submit(
            (int) $course->id,
            'page',
            'Write a short intro',
            1,
            null,
            'en'
        );

        $this->assertSame('queued', $result['status']);
        $this->assertNull($result['jobid']);

        $row = $DB->get_record(queue_repository::TABLE, ['id' => $result['queueid']], '*', MUST_EXIST);
        $this->assertSame(queue_status::STATUS_PENDING, (int) $row->status);
        $params = json_decode($row->params, true);
        $this->assertIsArray($params);
        $this->assertArrayHasKey('submittedby', $params);

        $tasks = \core\task\manager::get_adhoc_tasks(process_modulegen_queue::class);
        $found = false;
        foreach ($tasks as $task) {
            $data = $task->get_custom_data();
            if ((int) ($data->courseid ?? 0) === (int) $course->id) {
                $found = true;
                break;
            }
        }
        $this->assertTrue($found);
    }

    public function test_queue_processor_schedule_dedupes_by_course(): void {
        $this->resetAfterTest(true);
        $this->setAdminUser();
        $course = $this->getDataGenerator()->create_course();
        $userid = (int) get_admin()->id;

        queue_processor::schedule((int) $course->id, $userid);
        queue_processor::schedule((int) $course->id, $userid);

        $count = 0;
        foreach (\core\task\manager::get_adhoc_tasks(process_modulegen_queue::class) as $task) {
            $data = $task->get_custom_data();
            if ((int) ($data->courseid ?? 0) === (int) $course->id) {
                $count++;
            }
        }
        $this->assertSame(1, $count);
    }

    public function test_process_next_pending_marks_failed_when_sync_fails(): void {
        global $DB;

        $this->resetAfterTest(true);
        $this->setAdminUser();
        $course = $this->getDataGenerator()->create_course();
        $userid = (int) get_admin()->id;

        $syncmock = $this->createMock(file_sync_service::class);
        $syncmock->expects($this->once())
            ->method('ensure_enabled_and_synchronized')
            ->willThrowException(new \moodle_exception('filesync_timeout', 'local_dixeo'));
        service_factory::set_test_file_sync_service($syncmock);

        $modulemock = $this->createMock(module_generation_service::class);
        $modulemock->expects($this->never())->method('submit_generate_job_for_course');
        service_factory::set_test_module_generation_service($modulemock);

        $record = queue_repository::create_base_record(
            (int) $course->id,
            'page',
            'Instructions',
            1,
            null,
            'en'
        );
        $record->status = queue_status::STATUS_PENDING;
        $record->params = json_encode(['submittedby' => $userid]);
        $queueid = queue_repository::insert($record);

        $this->assertNull(queue_service::process_next_pending((int) $course->id, $userid));

        $row = $DB->get_record(queue_repository::TABLE, ['id' => $queueid], '*', MUST_EXIST);
        $this->assertSame(queue_status::STATUS_FAILED, (int) $row->status);
        $params = json_decode($row->params, true);
        $this->assertNotEmpty($params['error'] ?? '');
    }

    public function test_process_next_pending_promotes_to_processing_after_sync(): void {
        global $DB;

        $this->resetAfterTest(true);
        $this->setAdminUser();
        $course = $this->getDataGenerator()->create_course();
        $userid = (int) get_admin()->id;

        $syncmock = $this->createMock(file_sync_service::class);
        $syncmock->expects($this->once())->method('ensure_enabled_and_synchronized');
        service_factory::set_test_file_sync_service($syncmock);

        $jobid = '11111111-2222-4333-8444-555555555555';
        $modulemock = $this->createMock(module_generation_service::class);
        $modulemock->expects($this->once())
            ->method('submit_generate_job_for_course')
            ->willReturn(operation_result::pending($jobid));
        service_factory::set_test_module_generation_service($modulemock);

        $record = queue_repository::create_base_record(
            (int) $course->id,
            'page',
            'Instructions',
            1,
            null,
            'en'
        );
        $record->status = queue_status::STATUS_PENDING;
        $record->params = json_encode(['submittedby' => $userid]);
        $queueid = queue_repository::insert($record);

        $started = queue_service::process_next_pending((int) $course->id, $userid);

        $this->assertIsArray($started);
        $this->assertSame($queueid, $started['queueid']);
        $this->assertSame($jobid, $started['jobid']);

        $row = $DB->get_record(queue_repository::TABLE, ['id' => $queueid], '*', MUST_EXIST);
        $this->assertSame(queue_status::STATUS_PROCESSING, (int) $row->status);
        $this->assertSame($jobid, $row->jobid);
    }

    public function test_process_next_pending_skips_when_already_processing(): void {
        global $DB;

        $this->resetAfterTest(true);
        $this->setAdminUser();
        $course = $this->getDataGenerator()->create_course();

        $processing = queue_repository::create_base_record(
            (int) $course->id,
            'page',
            'Running',
            1,
            null,
            'en'
        );
        $processing->status = queue_status::STATUS_PROCESSING;
        $processing->jobid = \core\uuid::generate();
        queue_repository::insert($processing);

        $pending = queue_repository::create_base_record(
            (int) $course->id,
            'page',
            'Waiting',
            1,
            null,
            'en'
        );
        $pending->status = queue_status::STATUS_PENDING;
        $pending->params = json_encode(['submittedby' => (int) get_admin()->id]);
        queue_repository::insert($pending);

        $syncmock = $this->createMock(file_sync_service::class);
        $syncmock->expects($this->never())->method('ensure_enabled_and_synchronized');
        service_factory::set_test_file_sync_service($syncmock);

        $this->assertNull(queue_service::process_next_pending((int) $course->id, (int) get_admin()->id));
    }
}
