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
 * Dixeo teacher toolbar: open the module generator sidebar (same capability as the block).
 *
 * @param \moodle_page $page
 * @return array<int, array<string, mixed>>
 */
function block_dixeo_modulegen_add_button_to_teacher_toolbar(\moodle_page $page): array {
    $path = $page->url->get_path();
    $allowed = false;
    foreach (['/course/view.php', '/course/section.php'] as $fragment) {
        if (str_contains($path, $fragment)) {
            $allowed = true;
            break;
        }
    }
    if (!$allowed || empty($page->course->id)) {
        return [];
    }

    $context = \context_course::instance($page->course->id);
    if (!has_capability('moodle/course:manageactivities', $context)) {
        return [];
    }

    if (!block_dixeo_modulegen_course_has_block((int) $page->course->id)) {
        return [];
    }

    if ($page->requires->should_create_one_time_item_now('block_dixeo_modulegen')) {
        $page->requires->css('/blocks/dixeo_modulegen/styles.css');
        $page->requires->js_call_amd('block_dixeo_modulegen/activitychooser', 'init', [$page->course->id]);
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
