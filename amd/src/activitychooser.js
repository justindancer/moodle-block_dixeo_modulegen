/**
 * Activity chooser for AI module generation.
 *
 * @module     block_dixeo_modulegen/activitychooser
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @author     Pierre FACQ <pierre.facq@edunao.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define([
    'core/templates',
    'core/ajax',
    'core/str',
    'block_dixeo_modulegen/job_manager',
    'block_dixeo_modulegen/queue_status',
    'block_dixeo_modulegen/ai_action'
], function(Templates, Ajax, Str, JobManager, QueueStatus, AiAction) {
    let initialized = false;
    let course = null;
    let categories = null;

    /**
     * Module metadata for UI display.
     *
     * Maps module type to category, icon URL, and background color. The 4 supported
     * types (page, label, quiz, glossary) are standard Moodle modules always present.
     */
    const MODULE_METADATA = {
        page: {
            category: 'content',
            backgroundColor: '#399be2'
        },
        label: {
            category: 'content',
            backgroundColor: '#399be2'
        },
        glossary: {
            category: 'content',
            backgroundColor: '#399be2'
        },
        quiz: {
            category: 'assessment',
            backgroundColor: '#eb66a2'
        }
    };

    /**
     * Get the icon URL for a module type.
     *
     * @param {string} type - The module type (page, label, etc.).
     * @returns {string} The icon URL.
     */
    const getModuleIconUrl = (type) => {
        return M.cfg.wwwroot + '/mod/' + type + '/pix/monologo.svg';
    };

    /**
     * Transform the local_dixeo API response to the block UI format.
     *
     * Converts the flat list of types into categorized items with display metadata.
     *
     * @param {Object} response - The API response from local_dixeo_get_module_types.
     * @param {Object} categoryStrings - The localized category name strings.
     * @returns {Object} Categories structure for the template.
     */
    const transformModuleTypes = (response, categoryStrings) => {
        if (!response.success || !response.types || !Array.isArray(response.types)) {
            return {categories: []};
        }

        const categoryMap = {
            content: {
                name: categoryStrings.content,
                items: []
            },
            assessment: {
                name: categoryStrings.assessment,
                items: []
            }
        };

        response.types.forEach(moduleType => {
            const type = moduleType.type;
            const meta = MODULE_METADATA[type];

            // Skip unknown module types not in our metadata.
            if (!meta) {
                return;
            }

            const item = {
                shortname: type,
                displayname: moduleType.name || type,
                description: moduleType.description || '',
                iconurl: getModuleIconUrl(type),
                backgroundColor: meta.backgroundColor,
                options: {
                    href: '#',
                    enabled: moduleType.supported !== false,
                    beta: false
                }
            };

            categoryMap[meta.category].items.push(item);
        });

        // Filter out empty categories and convert to array.
        const categoriesArray = Object.values(categoryMap).filter(cat => cat.items.length > 0);

        return {categories: categoriesArray};
    };

    /**
     * Fetch module types from the local_dixeo API and transform for UI.
     *
     * @returns {Promise<Object>} Promise resolving to categories structure.
     */
    const getAvailableModules = async() => {
        // Fetch category strings and API data in parallel.
        const [contentStr, assessmentStr, apiResponse] = await Promise.all([
            Str.get_string('category_content', 'block_dixeo_modulegen'),
            Str.get_string('category_assessment', 'block_dixeo_modulegen'),
            Ajax.call([{
                methodname: 'local_dixeo_get_module_types',
                args: {}
            }])[0]
        ]);

        const categoryStrings = {
            content: contentStr,
            assessment: assessmentStr
        };

        return transformModuleTypes(apiResponse, categoryStrings);
    };

    /**
     * Set up the activity chooser.
     *
     * @method init
     * @param {Number} courseId - Course ID to use later on in fetchModules()
     */
    async function init(courseId) {
        const available = await getAvailableModules();

        course = courseId;
        categories = available.categories;

        // Ensure we only add our listeners once.
        if (initialized) {
            return;
        }

        let block = document.querySelector('.block_dixeo_modulegen');
        if (block) {
            let caller = document.querySelector('.course-section[data-sectionid]:last-of-type');
            let origin = window.location.pathname.includes('/course/section.php') ? 'section' : 'view';
            let context = {
                courseid: course,
                categories: categories,
                sectionid: caller.dataset.sectionid,
                origin: origin
            };

            Templates.render('block_dixeo_modulegen/activitychooser', context)
            .then(function(html, js) {
                let container = block.querySelector('#dixeo-module-generator');
                container.insertAdjacentHTML('beforeend', html);

                if (js) {
                    Templates.runTemplateJS(js);
                }

                addDragAndDrop(block);

                // Initialize job manager FIRST - it handles all job lifecycle.
                // This must complete before other modules try to submit/poll jobs.
                JobManager.init(course)
                    .then(() => {
                        // Initialize UI modules after job manager is ready.
                        QueueStatus.init(course, categories);
                        AiAction.init();

                        // Trigger a custom event to notify that the chooser is ready.
                        document.dispatchEvent(new Event('activityChooserReady'));
                    })
                    .catch((error) => {
                        // Graceful degradation - still initialize UI but log warning.
                        // eslint-disable-next-line no-console
                        console.error('JobManager init failed:', error);
                        QueueStatus.init(course, categories);
                        AiAction.init();
                        document.dispatchEvent(new Event('activityChooserReady'));
                    });
            });
        }
    }

    /**
     * Adds drag and drop functionality to options and activities.
     *
     * On drop, the function constructs a URL using the dragged option's href, the
     * section ID of the drop target, and the ID of the next activity (if any), then
     * navigates to that URL.
     *
     * @param {HTMLElement} block - The activity chooser block element.
     */
    let addDragAndDrop = function(block) {
        // Mobile devices don't support drag and drop well.
        if (window.innerWidth <= 992) {
            return;
        }

        let options = block.querySelectorAll('.optionscontainer .optioninfo a');
        Array.prototype.forEach.call(options, function(option) {
            if (option.classList.contains('disabled')) {
                return;
            }

            option.classList.add('draggable');
            option.setAttribute('draggable', 'true');

            option.addEventListener('drag', function() {
                option.classList.add('dragging');
            });

            option.addEventListener('dragend', function() {
                option.classList.remove('dragging');
            });
        });

        let activities = document.querySelectorAll('.course-content div[data-for="section_title"], .course-content .activity');
        Array.prototype.forEach.call(activities, function(activity) {
            activity.addEventListener('dragover', function(e) {
                let activeOption = block.querySelector('.optioninfo a.dragging');
                if (activeOption) {
                    e.preventDefault();
                    activity.classList.add('dd-drop-down');
                }
            });

            activity.addEventListener('dragleave', function(e) {
                let activeOption = block.querySelector('.optioninfo a.dragging');
                if (activeOption) {
                    e.preventDefault();
                    activity.classList.remove('dd-drop-down');
                }
            });

            activity.addEventListener('drop', function(e) {
                let activeOption = block.querySelector('.optioninfo a.dragging');
                if (activeOption) {
                    e.preventDefault();
                    activity.classList.remove('dd-drop-down');

                    let sectionId = activity.closest('.course-section').dataset.sectionid;
                    let beforeMod = null;
                    let nextActivity = activity.nextElementSibling;
                    if (nextActivity) {
                        beforeMod = nextActivity.dataset.id;
                    }

                    activeOption.dataset.sectionNumber = sectionId;
                    activeOption.dataset.beforeMod = beforeMod;
                    activeOption.click();
                }
            });
        });
    };

    return {
        init: init
    };
});
