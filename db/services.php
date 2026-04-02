<?php
/**
 * Web service definitions for the Dixeo Module Generator block.
 *
 * @package    block_dixeo_modulegen
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @author     Josemaria Bolanos <admin@mako.digital>
 * @author     Pierre FACQ <pierre.facq@edunao.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

$functions = [
    // Submit a new generation request (queued or immediate).
    'block_dixeo_modulegen_submit_generation' => [
        'classname' => 'block_dixeo_modulegen\external\api',
        'methodname' => 'submit_generation',
        'description' => 'Submit a module generation request (queues if another job is active)',
        'type' => 'write',
        'ajax' => true,
        'capabilities' => 'moodle/course:manageactivities',
    ],

    // Get queue status (tasks and stats) for a course.
    'block_dixeo_modulegen_get_queue_status' => [
        'classname' => 'block_dixeo_modulegen\external\api',
        'methodname' => 'get_queue_status',
        'description' => 'Get queue tasks and statistics for a course',
        'type' => 'read',
        'ajax' => true,
        'capabilities' => 'moodle/course:manageactivities',
    ],

    // Update a task (complete, fail, or cancel).
    'block_dixeo_modulegen_update_task' => [
        'classname' => 'block_dixeo_modulegen\external\api',
        'methodname' => 'update_task',
        'description' => 'Update task status (complete, fail, or cancel)',
        'type' => 'write',
        'ajax' => true,
        'capabilities' => 'moodle/course:manageactivities',
    ],

    // Delete a task (remove from queue or from display).
    'block_dixeo_modulegen_delete_task' => [
        'classname' => 'block_dixeo_modulegen\external\api',
        'methodname' => 'delete_task',
        'description' => 'Delete a task (allowed for queued, completed, failed, cancelled)',
        'type' => 'write',
        'ajax' => true,
        'capabilities' => 'moodle/course:manageactivities',
    ],

    'block_dixeo_modulegen_retry_fill_task' => [
        'classname' => 'block_dixeo_modulegen\external\api',
        'methodname' => 'retry_fill_task',
        'description' => 'Retry a failed fill-mode queue row (fill_module pipeline)',
        'type' => 'write',
        'ajax' => true,
        'capabilities' => 'moodle/course:manageactivities',
    ],
];
