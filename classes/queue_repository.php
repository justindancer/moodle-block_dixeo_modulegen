<?php
/**
 * Repository for queue database operations.
 *
 * Handles all CRUD operations for the module generation queue table.
 * Provides a clean data access layer for the generation queue.
 *
 * @package    block_dixeo_modulegen
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @author     Josemaria Bolanos <admin@mako.digital>
 * @author     Pierre FACQ <pierre.facq@edunao.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace block_dixeo_modulegen;

defined('MOODLE_INTERNAL') || die();

/**
 * Repository class for queue database operations.
 *
 * Provides a clean data access layer for all queue-related database operations.
 * All database queries for the queue table should go through this repository.
 *
 * @package    block_dixeo_modulegen
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @author     Josemaria Bolanos <admin@mako.digital>
 * @author     Pierre FACQ <pierre.facq@edunao.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class queue_repository {

    /** @var string Database table name for the queue. */
    public const TABLE = 'block_dixeo_modulegen_queue';

    /**
     * Get a task by its ID.
     *
     * @param int $id The task ID.
     * @return object|null The task record or null if not found.
     */
    public static function get_by_id(int $id): ?object {
        global $DB;

        $task = $DB->get_record(self::TABLE, ['id' => $id]);
        return $task ?: null;
    }

    /**
     * Get all tasks for a course in reverse queue order (newest first, oldest last).
     * Includes all statuses: queued, processing, completed, failed, cancelled.
     *
     * @param int $courseid The course ID.
     * @return array Array of task records.
     */
    public static function get_all_by_course(int $courseid): array {
        global $DB;

        $records = $DB->get_records(self::TABLE, ['courseid' => $courseid], 'timecreated DESC');
        return $records ?: [];
    }

    /**
     * Check if a course has a task with the given status.
     *
     * @param int $courseid The course ID.
     * @param int $status The status to check for.
     * @return bool True if a matching task exists.
     */
    public static function exists_with_status(int $courseid, int $status): bool {
        global $DB;

        return $DB->record_exists(self::TABLE, [
            'courseid' => $courseid,
            'status' => $status,
        ]);
    }

    /**
     * Get the next pending task for a course (oldest first - FIFO).
     *
     * @param int $courseid The course ID.
     * @param int $pendingstatus The pending status constant.
     * @return object|null The next pending task or null.
     */
    public static function get_next_pending(int $courseid, int $pendingstatus): ?object {
        global $DB;

        $sql = <<<SQL
            SELECT *
              FROM {block_dixeo_modulegen_queue}
             WHERE courseid = :courseid
               AND status = :status
          ORDER BY timecreated ASC
             LIMIT 1
        SQL;

        $task = $DB->get_record_sql($sql, [
            'courseid' => $courseid,
            'status' => $pendingstatus,
        ]);

        return $task ?: null;
    }

    /**
     * Get status counts grouped by status for a course.
     *
     * @param int $courseid The course ID.
     * @return array Array of records with status and count fields.
     */
    public static function get_status_counts(int $courseid): array {
        global $DB;

        $sql = <<<SQL
            SELECT status, COUNT(*) as count
              FROM {block_dixeo_modulegen_queue}
             WHERE courseid = :courseid
          GROUP BY status
        SQL;

        return $DB->get_records_sql($sql, ['courseid' => $courseid]);
    }

    /**
     * Insert a new task record.
     *
     * @param object $record The task record to insert.
     * @return int The new record ID.
     */
    public static function insert(object $record): int {
        global $DB;

        return $DB->insert_record(self::TABLE, $record);
    }

    /**
     * Update an existing task record.
     *
     * @param object $record The task record to update (must have id field).
     * @return bool True on success.
     */
    public static function update(object $record): bool {
        global $DB;

        return $DB->update_record(self::TABLE, $record);
    }

    /**
     * Delete a task record.
     *
     * @param int $id The task ID.
     * @return bool True on success.
     */
    public static function delete(int $id): bool {
        global $DB;

        return $DB->delete_records(self::TABLE, ['id' => $id]);
    }

    /**
     * Create base record structure for queue entries.
     *
     * Caller must set status and optionally jobid/timestarted before insert.
     *
     * @param int $courseid The course ID.
     * @param string $modulename The module type.
     * @param string $instructions The AI instructions.
     * @param int|null $sectionnumber Section number.
     * @param int|null $beforemod Course module to insert before.
     * @param string|null $lang Language code.
     * @return \stdClass The base record object.
     */
    public static function create_base_record(
        int $courseid,
        string $modulename,
        string $instructions,
        ?int $sectionnumber,
        ?int $beforemod,
        ?string $lang
    ): \stdClass {
        $record = new \stdClass();
        $record->courseid = $courseid;
        $record->modulename = $modulename;
        $record->title = '';
        $record->description = '';
        $record->instructions = clean_param($instructions, PARAM_RAW_TRIMMED);
        $record->sectionnumber = $sectionnumber;
        $record->beforemod = $beforemod;
        $record->cmid = 0;
        $record->lang = $lang;
        $record->params = null;
        $record->jobid = '';
        $record->sortorder = 0;
        $record->timecreated = time();
        $record->timestarted = 0;
        $record->timecompleted = 0;

        return $record;
    }
}
