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

/**
 * Block class for the Dixeo Module Generator.
 *
 * Displays an AI module generation interface in courses.
 */
class block_dixeo_modulegen extends block_base {

    /**
     * Initialize the block.
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
     * @return stdClass|null The block content.
     */
    public function get_content(): ?stdClass {
        global $OUTPUT, $COURSE, $CFG;

        require_once($CFG->libdir . '/filelib.php');

        if ($this->content !== null) {
            return $this->content;
        }

        $context = context_course::instance($COURSE->id);
        if (!has_capability('moodle/course:manageactivities', $context)) {
            return $this->content;
        }

        // Only display on course view pages.
        $targets = [
            '/course/view.php',
            '/course/section.php',
        ];
        $url = $this->page->url->get_path();
        $ondisplaypage = false;
        foreach ($targets as $target) {
            if (str_contains($url, $target)) {
                $ondisplaypage = true;
                break;
            }
        }

        if (!$ondisplaypage) {
            return $this->content;
        }

        $this->page->requires->css('/blocks/dixeo_modulegen/styles.css');

        $this->content = new stdClass();
        $this->content->footer = '';

        $text = '';

        if ($this->page->requires->should_create_one_time_item_now('block_dixeo_modulegen')) {
            // Only load activitychooser - it initializes queue_status internally.
            // ai_action is initialized by the modal template when rendered.
            $this->page->requires->js_call_amd('block_dixeo_modulegen/activitychooser', 'init', [$COURSE->id]);

            // Render the template.
            $text = $OUTPUT->render_from_template('block_dixeo_modulegen/card', []);
        }

        $this->content->text = $text;

        return $this->content;
    }

    /**
     * Handle block instance creation.
     *
     * Configures the block to show in subcontexts and sets default weight.
     *
     * @return bool True on success.
     */
    public function instance_create(): bool {
        global $DB;

        // Configure the block instance.
        $bi = $DB->get_record('block_instances', ['id' => $this->instance->id]);
        $bi->showinsubcontexts = 1;
        $bi->pagetypepattern = 'course-view-*';
        $bi->defaultweight = -5;
        $DB->update_record('block_instances', $bi);

        return true;
    }
}
