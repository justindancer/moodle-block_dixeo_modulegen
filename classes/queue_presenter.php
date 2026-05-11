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
 * @author     Josemaria Bolanos <admin@mako.digital>
 * @author     Pierre FACQ <pierre.facq@edunao.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace block_dixeo_modulegen;

defined('MOODLE_INTERNAL') || die();

/**
 * Presenter class for queue data formatting.
 *
 * Transforms raw database records into display-ready structures for the UI.
 * Handles all data formatting including:
 * - Task record enrichment with display data (links, titles, timestamps)
 * - Status label generation
 * - Statistics aggregation from status counts
 *
 * @package    block_dixeo_modulegen
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @author     Josemaria Bolanos <admin@mako.digital>
 * @author     Pierre FACQ <pierre.facq@edunao.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class queue_presenter {

    /** @var array<string, array>|null Per-request memo of type rows indexed by type identifier. */
    private static ?array $typeindex = null;

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
        $row = self::find_type_row($modulename);
        $modplugin = (isset($row['component']) && strpos($row['component'], 'mod_') === 0)
            ? substr($row['component'], 4)
            : $modulename;

        // Build the view link for completed modules.
        $task->link = null;
        if ((int) $task->status === queue_status::STATUS_COMPLETED && $task->cmid) {
            $task->link = (new \moodle_url('/mod/' . $modplugin . '/view.php', [
                'id' => $task->cmid,
            ]))->out(false);
        }

        // Resolve title: prefer DB title when set; for completed tasks with cmid use live module name from Moodle.
        $dbtitle = isset($task->title) ? trim((string) $task->title) : '';
        $moduleTitle = self::get_module_title($task);
        if ($moduleTitle !== '') {
            $task->title = $moduleTitle;
        } elseif ($dbtitle !== '') {
            $task->title = $dbtitle;
        }

        // Display title: use resolved or DB title when available, otherwise "New {MODULETYPE}".
        // For variants that share their Moodle plugin (all H5P types → mod_h5pactivity),
        // prefix the title with the variant label so the queue distinguishes them — the
        // shared icon alone can't.
        $label = isset($row['label']) ? (string) $row['label'] : $modulename;
        if ($task->title !== '' && self::is_shared_component_variant($row)) {
            $task->displaytitle = $label . ' · ' . $task->title;
        } else {
            $task->displaytitle = $task->title !== ''
                ? $task->title
                : get_string('newmoduletype', 'block_dixeo_modulegen', $label);
        }

        // Short completion date for completed tasks (e.g. "Completed on 19 Jan 2026, 14:25").
        $task->completedonshort = '';
        if ((int) $task->status === queue_status::STATUS_COMPLETED && $task->timecompleted > 0) {
            $task->completedonshort = get_string(
                'completedon',
                'block_dixeo_modulegen',
                userdate($task->timecompleted, get_string('strftimedatetimeshort', 'langconfig'))
            );
        }

        // Status label for display (task->status may be string from DB; get_string key is numeric).
        $task->statuslabel = get_string('status_' . $task->status, 'block_dixeo_modulegen');

        // Select appropriate timestamp for display.
        $task->timestamp = self::get_timestamp_string($task);

        // Ensure jobid is populated from params fallback for JS polling when the DB column is empty.
        $params = $task->params ? json_decode($task->params, true) : [];
        $task->jobid = $task->jobid ?: ($params['jobid'] ?? null);
        $task->queuemode = queue_task_mode::from_params($task->params ?? null);

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
     * Whether the row's Moodle plugin is shared by multiple Dixeo types.
     *
     * True for H5P variants (every h5p_* type maps to mod_h5pactivity); false for
     * 1:1 types like page/glossary/quiz where the icon alone identifies the kind.
     */
    private static function is_shared_component_variant(?array $row): bool {
        if ($row === null || empty($row['component'])) {
            return false;
        }
        $component = (string) $row['component'];
        $count = 0;
        foreach (self::get_catalogue() as $other) {
            if (($other['component'] ?? null) === $component) {
                $count++;
                if ($count > 1) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Resolved Dixeo type catalogue indexed by type identifier — per-request memo.
     *
     * Returns null per row when the API is unreachable; callers fall back to the bare type name.
     *
     * @return array|null The row for the given type, or null.
     */
    private static function find_type_row(string $modulename): ?array {
        return self::get_catalogue()[$modulename] ?? null;
    }

    /**
     * Resolved Dixeo type catalogue indexed by type identifier — per-request memo.
     *
     * Empty when the API is unreachable; callers must handle missing rows.
     *
     * @return array<string, array>
     */
    private static function get_catalogue(): array {
        if (self::$typeindex === null) {
            self::$typeindex = [];
            try {
                $types = \local_dixeo\external\service_factory::get_module_types_service()->get_module_types_resolved();
                foreach ($types as $row) {
                    if (is_array($row) && !empty($row['type'])) {
                        self::$typeindex[(string) $row['type']] = $row;
                    }
                }
            } catch (\Throwable $e) {
                self::$typeindex = [];
            }
        }
        return self::$typeindex;
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
     * Returns active (queued + processing) and errors (failed + cancelled).
     *
     * @param array $statusCounts Array of records with status and count fields.
     * @return array Statistics with active and errors counts.
     */
    public static function calculate_statistics(array $statusCounts): array {
        $active = 0;
        $errors = 0;

        foreach ($statusCounts as $record) {
            $status = (int) $record->status;
            $count = (int) $record->count;
            switch ($status) {
                case queue_status::STATUS_PENDING:
                case queue_status::STATUS_PROCESSING:
                    $active += $count;
                    break;
                case queue_status::STATUS_FAILED:
                case queue_status::STATUS_CANCELLED:
                    $errors += $count;
                    break;
                case queue_status::STATUS_COMPLETED:
                    break;
            }
        }

        return [
            'active' => $active,
            'errors' => $errors,
        ];
    }
}
