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
 * Builds manual-upload UI context for the activity chooser AMD init.
 *
 * @package    block_dixeo_modulegen
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace block_dixeo_modulegen;

use local_dixeo\service\file_sync_service;
use local_dixeo\service\plugin_installation_service;

defined('MOODLE_INTERNAL') || die();

/**
 * Manual upload chooser and modal context helpers.
 */
class manual_upload_context {

    /**
     * Config passed to activitychooser AMD init.
     *
     * @return array<string, mixed>
     */
    public static function get_js_config(): array {
        global $CFG;

        $installed = plugin_installation_service::get_installed_plugin_map('mod');
        $ragformats = file_sync_service::format_rag_indexed_extensions_label();

        return [
            'sesskey' => sesskey(),
            'uploadUrl' => $CFG->wwwroot . '/blocks/dixeo_modulegen/ajax/create_manual_upload.php',
            'scormInstalled' => isset($installed['scorm']),
            'resourceInstalled' => isset($installed['resource']),
            'ragExtensions' => file_sync_service::get_rag_indexed_extensions(),
            'resourceDescriptionParams' => (object) [
                'ragformats' => $ragformats,
            ],
        ];
    }
}
