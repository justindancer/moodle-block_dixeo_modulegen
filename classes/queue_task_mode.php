<?php
/**
 * Queue task mode (generate vs fill) stored in task params JSON.
 *
 * @package    block_dixeo_modulegen
 * @copyright  2026 Edunao SAS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace block_dixeo_modulegen;

defined('MOODLE_INTERNAL') || die();

/**
 * Mode constants for {@see queue_repository} params JSON key `mode`.
 */
final class queue_task_mode {

    public const MODE_GENERATE = 'generate';

    public const MODE_FILL = 'fill';

    public static function from_params(?string $paramsjson): string {
        if ($paramsjson === null || $paramsjson === '') {
            return self::MODE_GENERATE;
        }
        $p = json_decode($paramsjson, true);
        if (!is_array($p) || empty($p['mode'])) {
            return self::MODE_GENERATE;
        }
        return $p['mode'] === self::MODE_FILL ? self::MODE_FILL : self::MODE_GENERATE;
    }

    public static function is_fill(?string $paramsjson): bool {
        return self::from_params($paramsjson) === self::MODE_FILL;
    }
}
