/**
 * Activity chooser for AI module generation.
 *
 * Main entry point for the block's JavaScript functionality. Handles:
 * - Fetching available module types from the API
 * - Transforming module data into categorized display format
 * - Rendering the activity chooser interface
 * - Initializing queue_status and ai_action modules
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
    'use strict';

    let initialized = false;
    let course = null;
    let categories = null;

    /**
     * Get the icon URL for a module type.
     *
     * @param {string} type - The module type (page, label, etc.).
     * @param {string} component - The Moodle component (mod_page, mod_quiz, etc.).
     * @returns {string} The icon URL.
     */
    const getModuleIconUrl = (type, component) => {
        // Standard Moodle modules use /mod/{type}/pix/monologo.svg
        if (component && component.startsWith('mod_')) {
            return M.cfg.wwwroot + '/mod/' + type + '/pix/monologo.svg';
        }
        // Fallback for non-standard modules
        return M.cfg.wwwroot + '/mod/' + type + '/pix/monologo.svg';
    };

    /**
     * Transform the local_dixeo API response to the block UI format.
     *
     * Converts the flat list of types into categorized items with display metadata.
     * All module types from the API are displayed, using Moodle's native styling.
     *
     * @param {Object} response - The API response from local_dixeo_get_module_types.
     * @param {Object} categoryStrings - The localized category name strings.
     * @returns {Object} Categories structure for the template.
     */
    const transformModuleTypes = (response, categoryStrings) => {
        if (!response.success || !response.types || !Array.isArray(response.types)) {
            return {categories: []};
        }

        // Build categories dynamically from API response.
        const categoryMap = {};

        response.types.forEach(moduleType => {
            const category = moduleType.category || 'content';

            // Create category if it doesn't exist.
            if (!categoryMap[category]) {
                categoryMap[category] = {
                    name: categoryStrings[category] || category,
                    items: []
                };
            }

            const installed = moduleType.installed !== false;
            const item = {
                shortname: moduleType.type,
                displayname: moduleType.label || moduleType.type,
                description: moduleType.description || '',
                iconurl: getModuleIconUrl(moduleType.type, moduleType.component),
                category: category,
                installed: installed,
                component: moduleType.component || ('mod_' + moduleType.type),
                options: {
                    href: '#',
                    enabled: installed && moduleType.supported !== false,
                    beta: false
                }
            };

            categoryMap[category].items.push(item);
        });

        // Convert to array, keeping a consistent order (content first, then others, assessment last).
        const order = ['content', 'resource', 'collaboration', 'communication', 'assessment'];
        const categoriesArray = order
            .filter(cat => categoryMap[cat])
            .map(cat => categoryMap[cat]);

        // Add any categories not in the predefined order.
        Object.keys(categoryMap).forEach(cat => {
            if (!order.includes(cat)) {
                categoriesArray.push(categoryMap[cat]);
            }
        });

        return {categories: categoriesArray};
    };

    /**
     * Fetch module types from the local_dixeo API and transform for UI.
     *
     * @returns {Promise<Object>} Promise resolving to categories structure.
     */
    const getAvailableModules = async() => {
        // Fetch category strings and API data in parallel.
        const [contentStr, resourceStr, assessmentStr, apiResponse] = await Promise.all([
            Str.get_string('category_content', 'block_dixeo_modulegen'),
            Str.get_string('category_resource', 'block_dixeo_modulegen'),
            Str.get_string('category_assessment', 'block_dixeo_modulegen'),
            Ajax.call([{
                methodname: 'local_dixeo_get_module_types',
                args: {}
            }])[0]
        ]);

        const categoryStrings = {
            content: contentStr,
            resource: resourceStr,
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

        const block = document.querySelector('.block_dixeo_modulegen');
        if (block) {
            const caller = document.querySelector('.course-section[data-sectionid]:last-of-type');
            let origin = window.location.pathname.includes('/course/section.php') ? 'section' : 'view';
            const context = {
                courseid: course,
                categories: categories,
                sectionid: caller ? caller.dataset.sectionid : '',
                origin: origin,
                config: {wwwroot: M.cfg.wwwroot},
                generationtitle: ''
            };

            Templates.render('block_dixeo_modulegen/activitychooser', context)
            .then(function(html, js) {
                const container = block.querySelector('#dixeo-module-generator');
                container.insertAdjacentHTML('beforeend', html);

                if (js) {
                    Templates.runTemplateJS(js);
                }

                registerCategoryToggles(block);
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
     * Register category expand/collapse toggles (no inline handlers).
     *
     * @param {HTMLElement} block - The block element.
     */
    function registerCategoryToggles(block) {
        const optionsContainer = block.querySelector('.optionscontainer');
        if (!optionsContainer) {
            return;
        }
        optionsContainer.addEventListener('click', function(e) {
            const btn = e.target.closest('[data-action="toggle-category"]');
            if (!btn) {
                return;
            }
            e.preventDefault();
            const category = btn.closest('.category');
            if (!category) {
                return;
            }
            const expanded = category.classList.toggle('dixeo-collapsed');
            btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        });
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

        const options = block.querySelectorAll('.optionscontainer .optioninfo a[data-target="#generationModal"]');
        options.forEach(function(option) {
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

        const activities = document.querySelectorAll('.course-content div[data-for="section_title"], .course-content .activity');
        activities.forEach(function(activity) {
            activity.addEventListener('dragover', function(e) {
                    const activeOption = block.querySelector('.optioninfo a.dragging');
                if (activeOption) {
                    e.preventDefault();
                    activity.classList.add('dd-drop-down');
                }
            });

            activity.addEventListener('dragleave', function(e) {
                    const activeOption = block.querySelector('.optioninfo a.dragging');
                if (activeOption) {
                    e.preventDefault();
                    activity.classList.remove('dd-drop-down');
                }
            });

            activity.addEventListener('drop', function(e) {
                    const activeOption = block.querySelector('.optioninfo a.dragging');
                if (activeOption) {
                    e.preventDefault();
                    activity.classList.remove('dd-drop-down');

                    const sectionId = activity.closest('.course-section').dataset.sectionid;
                    let beforeMod = null;
                    const nextActivity = activity.nextElementSibling;
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
