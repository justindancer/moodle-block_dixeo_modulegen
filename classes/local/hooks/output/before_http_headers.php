<?php
/**
 * Hook callbacks for block_dixeo_modulegen page asset registration.
 *
 * @package    block_dixeo_modulegen
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace block_dixeo_modulegen\local\hooks\output;

defined('MOODLE_INTERNAL') || die();

use block_dixeo_modulegen\local\page_assets;

/**
 * Register block CSS/AMD before HTTP headers are sent.
 */
class before_http_headers {

    /**
     * @param \core\hook\output\before_http_headers $hook
     * @return void
     */
    public static function callback(\core\hook\output\before_http_headers $hook): void {
        global $PAGE, $CFG;

        if (during_initial_install() || isset($CFG->upgraderunning)) {
            return;
        }

        page_assets::require_for_page($PAGE);
    }
}
