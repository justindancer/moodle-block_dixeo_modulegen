<?php
/**
 * Status constants interface for the module generation queue.
 *
 * Centralizes status values to eliminate duplication across service and presenter classes.
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
 * Interface defining queue task status constants.
 *
 * @package    block_dixeo_modulegen
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @author     Josemaria Bolanos <admin@mako.digital>
 * @author     Pierre FACQ <pierre.facq@edunao.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
interface queue_status {

    /** @var int Waiting for previous job to complete. */
    public const STATUS_PENDING = 0;

    /** @var int Job submitted to API, JS is polling. */
    public const STATUS_PROCESSING = 1;

    /** @var int Job completed successfully. */
    public const STATUS_COMPLETED = 2;

    /** @var int Job failed during processing. */
    public const STATUS_FAILED = 3;

    /** @var int Job was cancelled by user. */
    public const STATUS_CANCELLED = 4;
}
