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
 * Upgrade steps for block_dixeo_modulegen.
 *
 * @package    block_dixeo_modulegen
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @author     Josemaria Bolanos <admin@mako.digital>
 * @author     Pierre FACQ <pierre.facq@edunao.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Module Generator block upgrade.
 *
 * @param int $oldversion The version we are upgrading from.
 * @param stdClass $block Block record from the blocks table (unused).
 * @return bool
 */
function xmldb_block_dixeo_modulegen_upgrade($oldversion, $block) {
    global $DB;

    if ($oldversion < 2026040202) {
        // Sync db/access.php. Core also calls update_capabilities via upgrade_component_updated()
        // after this script returns; this step documents the capability sync in the plugin.
        update_capabilities('block_dixeo_modulegen');

        upgrade_block_savepoint(true, 2026040202, 'dixeo_modulegen');
    }

    if ($oldversion < 2026040204) {
        $dbman = $DB->get_manager();
        $table = new xmldb_table('block_dixeo_modulegen_queue');
        $field = new xmldb_field('hints');
        if ($dbman->field_exists($table, $field)) {
            $dbman->drop_field($table, $field);
        }

        upgrade_block_savepoint(true, 2026040204, 'dixeo_modulegen');
    }

    return true;
}
