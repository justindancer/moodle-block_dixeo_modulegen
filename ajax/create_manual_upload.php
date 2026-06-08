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
 * Manual upload AJAX endpoint for block_dixeo_modulegen.
 *
 * @package    block_dixeo_modulegen
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define('AJAX_SCRIPT', true);

require_once(__DIR__ . '/../../../config.php');

require_login();
require_sesskey();

header('Content-Type: application/json');

try {
    $modtype = required_param('modtype', PARAM_ALPHA);
    $courseid = required_param('courseid', PARAM_INT);
    $sectionnumber = optional_param('sectionnumber', 0, PARAM_INT);
    $beforemod = optional_param('beforemod', 0, PARAM_INT);

    if (!in_array($modtype, ['scorm', 'resource'], true)) {
        throw new moodle_exception('error_unsupported_module', 'block_dixeo_modulegen', '', $modtype);
    }

    $uploadedfile = $_FILES['file'] ?? null;
    if ($uploadedfile === null) {
        throw new moodle_exception('manual_upload_error_missing', 'block_dixeo_modulegen');
    }

    $service = \local_dixeo\external\service_factory::get_manual_upload_service();
    $result = $service->create_from_upload(
        $modtype,
        $courseid,
        $sectionnumber,
        $beforemod ?: null,
        $uploadedfile
    );

    $cmid = (int) $result['cmid'];
    $activityname = (string) ($result['name'] ?? '');
    $filename = clean_param($uploadedfile['name'] ?? '', PARAM_FILE);
    $link = (new moodle_url('/mod/' . $modtype . '/view.php', ['id' => $cmid]))->out(false);

    $queueid = \block_dixeo_modulegen\queue_service::log_manual_upload_completed(
        $courseid,
        $modtype,
        $sectionnumber,
        $beforemod ?: null,
        $cmid,
        $activityname,
        $filename
    );

    echo json_encode([
        'success' => true,
        'cmid' => $cmid,
        'id' => $result['id'],
        'queueid' => $queueid,
        'activityname' => $activityname,
        'modtype' => $modtype,
        'link' => $link,
        'courseid' => $courseid,
    ]);
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ]);
}
