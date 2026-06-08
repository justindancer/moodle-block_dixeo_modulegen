<?php
/**
 * Register block CSS/AMD on course content pages (early, before HTTP headers).
 *
 * @package    block_dixeo_modulegen
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace block_dixeo_modulegen\local;

defined('MOODLE_INTERNAL') || die();

use block_dixeo_modulegen\manual_upload_context;

/**
 * Page asset registration for the module generator block.
 */
class page_assets {

    /**
     * Whether the Dixeo module generator block is added to the given course.
     *
     * @param int $courseid Course id.
     * @return bool
     */
    public static function course_has_block(int $courseid): bool {
        global $DB;

        if ($courseid <= 0) {
            return false;
        }

        $context = \context_course::instance($courseid, IGNORE_MISSING);
        if (!$context) {
            return false;
        }

        return $DB->record_exists('block_instances', [
            'blockname' => 'dixeo_modulegen',
            'parentcontextid' => $context->id,
        ]);
    }

    /**
     * Whether the page is course content where block assets apply.
     *
     * @param \moodle_page $page
     * @return bool
     */
    public static function is_course_content_page(\moodle_page $page): bool {
        $path = $page->url->get_path();
        if (str_contains($path, '/course/view.php') || str_contains($path, '/course/section.php')) {
            return true;
        }
        return str_contains($path, '/mod/') && str_contains($path, '/view.php');
    }

    /**
     * Load AMD for queue polling and/or the activity chooser on course content pages.
     *
     * @param \moodle_page $page
     * @return void
     */
    public static function require_for_page(\moodle_page $page): void {
        if (empty($page->course->id) || !self::is_course_content_page($page)) {
            return;
        }

        $context = \context_course::instance($page->course->id);
        if (!has_capability('local/dixeo:generate', $context)
                || !has_capability('moodle/course:manageactivities', $context)) {
            return;
        }

        if (!self::course_has_block((int) $page->course->id)) {
            return;
        }

        if (!$page->requires->should_create_one_time_item_now('block_dixeo_modulegen')) {
            return;
        }

        $path = $page->url->get_path();
        if (str_contains($path, '/course/view.php') || str_contains($path, '/course/section.php')) {
            $page->requires->css('/blocks/dixeo_modulegen/styles.css');
            $page->requires->js_call_amd(
                'block_dixeo_modulegen/activitychooser',
                'init',
                [(int) $page->course->id, manual_upload_context::get_js_config()]
            );
            return;
        }

        // Activity module view: resume queue polling and show completion toasts only (no block UI CSS).
        $courseid = (int) $page->course->id;
        $page->requires->js_call_amd('block_dixeo_modulegen/job_manager', 'init', [$courseid]);
        $page->requires->js_call_amd('block_dixeo_modulegen/generation_notifications', 'init', [$courseid]);
    }
}
