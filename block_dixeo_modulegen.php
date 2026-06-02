<?php
/**
 * Module Generator block definition.
 *
 * @package    block_dixeo_modulegen
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @author     Josemaria Bolanos <admin@mako.digital>
 * @author     Pierre FACQ <pierre.facq@edunao.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

use block_dixeo_modulegen\manual_upload_context;

/**
 * Block class for the Dixeo Module Generator.
 *
 * Displays an AI module generation interface in courses.
 * Provides functionality for generating course modules using AI.
 *
 * @package    block_dixeo_modulegen
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @author     Josemaria Bolanos <admin@mako.digital>
 * @author     Pierre FACQ <pierre.facq@edunao.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class block_dixeo_modulegen extends block_base {

    /** @var string[] Allowed page paths where the block can be displayed. */
    private const ALLOWED_PAGE_PATHS = [
        '/course/view.php',
        '/course/section.php',
    ];

    /** @var string Required capability to view the block. */
    private const REQUIRED_CAPABILITY = 'moodle/course:manageactivities';

    /** @var string Default pagetype pattern for block instances. */
    private const DEFAULT_PAGETYPE_PATTERN = 'course-view-*';

    /** @var int Default weight for block instances. */
    private const DEFAULT_WEIGHT = -5;

    /**
     * Initialize the block.
     *
     * Sets the block title from language strings.
     */
    public function init(): void {
        $this->title = get_string('blocktitle', 'block_dixeo_modulegen');
    }

    /**
     * Define where the block can be displayed.
     *
     * @return array Applicable formats.
     */
    public function applicable_formats(): array {
        return [
            'course-view' => true,
            'site' => false,
            'mod' => false,
            'my' => false,
        ];
    }

    /**
     * Block has global configuration.
     *
     * @return bool True as block has settings.
     */
    public function has_config(): bool {
        return true;
    }

    /**
     * Specialization callback.
     */
    public function specialization(): void {
        $this->title = '';
    }

    /**
     * Only one instance per course.
     *
     * @return bool False to prevent multiple instances.
     */
    public function instance_allow_multiple(): bool {
        return false;
    }

    /**
     * Get block content.
     *
     * Renders the block content if the user has the required capability
     * and is on an allowed page. Initializes JavaScript modules and renders
     * the card template.
     *
     * @return stdClass|null The block content object, or null if not accessible.
     */
    public function get_content(): ?stdClass {
        global $OUTPUT, $COURSE, $CFG;

        require_once($CFG->libdir . '/filelib.php');

        // Return cached content to avoid re-rendering on every call (Moodle may call get_content multiple times).
        if ($this->content !== null) {
            return $this->content;
        }

        // Check user capability.
        if (!$this->can_user_view_block($COURSE->id)) {
            return $this->content;
        }

        // Check if on allowed page.
        if (!$this->is_allowed_page()) {
            return $this->content;
        }

        // Initialize content structure.
        $this->content = new stdClass();
        $this->content->footer = '';
        $this->content->text = '';

        // Load CSS.
        $this->page->requires->css('/blocks/dixeo_modulegen/styles.css');

        // Initialize JavaScript and render template.
        if ($this->page->requires->should_create_one_time_item_now('block_dixeo_modulegen')) {
            $this->initialize_javascript($COURSE->id);
            $this->content->text = $OUTPUT->render_from_template('block_dixeo_modulegen/card', []);
        }

        return $this->content;
    }

    /**
     * Check if the current user can view the block.
     *
     * @param int $courseid The course ID.
     * @return bool True if user has required capability.
     */
    private function can_user_view_block(int $courseid): bool {
        $context = context_course::instance($courseid);
        return has_capability(self::REQUIRED_CAPABILITY, $context);
    }

    /**
     * Check if the current page is an allowed page for the block.
     *
     * @return bool True if the current page path matches allowed paths.
     */
    private function is_allowed_page(): bool {
        $url = $this->page->url->get_path();
        foreach (self::ALLOWED_PAGE_PATHS as $path) {
            if (str_contains($url, $path)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Initialize JavaScript modules for the block.
     *
     * Loads the activitychooser module which initializes queue_status internally.
     * The ai_action module is initialized by the modal template when rendered.
     *
     * @param int $courseid The course ID.
     */
    private function initialize_javascript(int $courseid): void {
        $this->page->requires->js_call_amd(
            'block_dixeo_modulegen/activitychooser',
            'init',
            [$courseid, manual_upload_context::get_js_config()]
        );
    }

    /**
     * Handle block instance creation.
     *
     * Configures the block instance to show in subcontexts and sets
     * default pagetype pattern and weight for optimal display.
     *
     * @return bool True on success, false on failure.
     */
    public function instance_create(): bool {
        global $DB;

        $bi = $DB->get_record('block_instances', ['id' => $this->instance->id]);
        if (!$bi) {
            return false;
        }

        $bi->showinsubcontexts = 1;
        $bi->pagetypepattern = self::DEFAULT_PAGETYPE_PATTERN;
        $bi->defaultweight = self::DEFAULT_WEIGHT;

        return $DB->update_record('block_instances', $bi);
    }
}
