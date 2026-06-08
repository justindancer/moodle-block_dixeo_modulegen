<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Callbacks for block_dixeo_modulegen.
 *
 * @package    block_dixeo_modulegen
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

use block_dixeo_modulegen\manual_upload_context;

/**
 * Whether the Dixeo module generator block is added to the given course (any instance in course context).
 *
 * @param int $courseid Course id.
 * @return bool
 */
function block_dixeo_modulegen_course_has_block(int $courseid): bool {
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
 * Whether the page is course content where completion notifications apply.
 *
 * @param \moodle_page $page
 * @return bool
 */
function block_dixeo_modulegen_is_course_content_page(\moodle_page $page): bool {
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
function block_dixeo_modulegen_require_page_amd(\moodle_page $page): void {
    if (empty($page->course->id) || !block_dixeo_modulegen_is_course_content_page($page)) {
        return;
    }

    $context = \context_course::instance($page->course->id);
    if (!has_capability('local/dixeo:generate', $context)
            || !has_capability('moodle/course:manageactivities', $context)) {
        return;
    }

    if (!block_dixeo_modulegen_course_has_block((int) $page->course->id)) {
        return;
    }

    if (!$page->requires->should_create_one_time_item_now('block_dixeo_modulegen')) {
        return;
    }

    $page->requires->css('/blocks/dixeo_modulegen/styles.css');

    $path = $page->url->get_path();
    if (str_contains($path, '/course/view.php') || str_contains($path, '/course/section.php')) {
        $page->requires->js_call_amd(
            'block_dixeo_modulegen/activitychooser',
            'init',
            [(int) $page->course->id, manual_upload_context::get_js_config()]
        );
        return;
    }

    // Activity module view: resume queue polling and show completion toasts only.
    $courseid = (int) $page->course->id;
    $page->requires->js_call_amd('block_dixeo_modulegen/job_manager', 'init', [$courseid]);
    $page->requires->js_call_amd('block_dixeo_modulegen/generation_notifications', 'init', [$courseid]);
}

/**
 * Dixeo teacher toolbar: open the module generator sidebar (same capability as the block).
 *
 * @param \moodle_page $page
 * @return array<int, array<string, mixed>>
 */
function block_dixeo_modulegen_add_button_to_teacher_toolbar(\moodle_page $page): array {
    if (empty($page->course->id)) {
        return [];
    }

    block_dixeo_modulegen_require_page_amd($page);

    $path = $page->url->get_path();
    $showbutton = str_contains($path, '/course/view.php') || str_contains($path, '/course/section.php');
    if (!$showbutton) {
        return [];
    }

    $context = \context_course::instance($page->course->id);
    if (!has_capability('local/dixeo:generate', $context)
            || !has_capability('moodle/course:manageactivities', $context)) {
        return [];
    }

    if (!block_dixeo_modulegen_course_has_block((int) $page->course->id)) {
        return [];
    }

    $label = get_string('aiactivities', 'block_dixeo_modulegen');

    return [[
        'key' => 'generator',
        'icon' => 'generator',
        'label' => $label,
        'title' => $label,
        'dataaction' => 'open-dixeo-generator',
        'controls' => 'dixeo-module-generator',
        'ismobileprimary' => true,
        'isaccent' => true,
        'islink' => false,
    ]];
}
