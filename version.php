<?php
/**
 * Version details for the Dixeo Module Generator block.
 *
 * @package    block_dixeo_modulegen
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @author     Josemaria Bolanos <admin@mako.digital>
 * @author     Pierre FACQ <pierre.facq@edunao.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

$plugin->version   = 2026032800;        // The current plugin version (Date: YYYYMMDDXX).
$plugin->requires  = 2024100700;        // Requires Moodle 4.5+.
$plugin->component = 'block_dixeo_modulegen';
$plugin->maturity  = MATURITY_STABLE;
$plugin->release   = '3.0.1';
$plugin->dependencies = [
    'local_dixeo' => 2026031604,
];
