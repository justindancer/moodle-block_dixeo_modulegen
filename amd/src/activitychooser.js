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
 * @author     Josemaria Bolanos <admin@mako.digital>
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

    /** Ensures we only register document-level drop delegation once (covers CMS/sections added after page load). */
    let courseDropDelegationAttached = false;

    /**
     * True when the page has core course-format activity lists (not formats that replace them entirely).
     *
     * @returns {boolean}
     */
    function hasStandardCourseModuleList() {
        return !!document.querySelector('[data-for="section"] ul[data-for="cmlist"]');
    }

    /** @type {HTMLElement|null} Drop target currently showing drop highlight classes (avoids scanning each dragover). */
    let highlightedGenerationDropTarget = null;

    const GENERATION_DRAG_OPTION = '.optionscontainer .optioninfo a[data-target="#generationModal"]';
    /** Legacy Moodle-style name + block-specific hook for theme/format overrides without .course-content. */
    const DROP_HIGHLIGHT_CLASSES = ['dd-drop-down', 'dixeo-modulegen-drop-target'];
    /** Injected before the first cm in each section list; insert-before = first cm id. */
    const SECTION_LEAD_DROP = 'section-lead-drop';
    const SELECTOR_SECTION_LEAD_DROP = '[data-dixeo-modulegen="' + SECTION_LEAD_DROP + '"]';
    const SCOPED_SECTION_LEAD_DROP = ':scope > ' + SELECTOR_SECTION_LEAD_DROP;
    /** Use capture so we run before core course DragDrop, which often stops propagation on activities. */
    const USE_CAPTURE = true;

    const fallbackIconUrl = M.cfg.wwwroot + '/blocks/dixeo_modulegen/pix/monologo.svg';

    /**
     * Get the icon URL for a module type.
     * If the module is not installed, always use the block fallback to avoid 404s.
     *
     * @param {string} type - The module type (page, label, etc.).
     * @param {string} component - The Moodle component (mod_page, mod_quiz, etc.).
     * @param {boolean} installed - Whether the module plugin is installed.
     * @returns {string} The icon URL.
     */
    const getModuleIconUrl = (type, component, installed) => {
        if (!installed) {
            return fallbackIconUrl;
        }
        if (component && component.startsWith('mod_')) {
            return M.cfg.wwwroot + '/mod/' + component.substring('mod_'.length) + '/pix/monologo.svg';
        }
        return fallbackIconUrl;
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
                iconurl: getModuleIconUrl(moduleType.type, moduleType.component, installed),
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

        // Convert to array, keeping a consistent order (content first, then assessment, interactive last).
        const order = ['content', 'resource', 'collaboration', 'communication', 'assessment', 'interactive'];
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
     * @param {number} courseId - Course id (required for correct language when course forces a locale).
     * @returns {Promise<Object>} Promise resolving to categories structure.
     */
    const getAvailableModules = async(courseId) => {
        // Fetch category strings and API data in parallel.
        const [contentStr, resourceStr, interactiveStr, assessmentStr, apiResponse] = await Promise.all([
            Str.get_string('category_content', 'block_dixeo_modulegen'),
            Str.get_string('category_resource', 'block_dixeo_modulegen'),
            Str.get_string('category_interactive', 'block_dixeo_modulegen'),
            Str.get_string('category_assessment', 'block_dixeo_modulegen'),
            Ajax.call([{
                methodname: 'local_dixeo_get_module_types',
                args: {courseid: courseId}
            }])[0]
        ]);

        const categoryStrings = {
            content: contentStr,
            resource: resourceStr,
            interactive: interactiveStr,
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
        const available = await getAvailableModules(courseId);

        course = courseId;
        categories = available.categories;

        // Ensure we only add our listeners once.
        if (initialized) {
            return;
        }

        const block = document.querySelector('.block_dixeo_modulegen');
        if (block) {
            let origin = window.location.pathname.includes('/course/section.php') ? 'section' : 'view';
            const context = {
                courseid: course,
                categories: categories,
                sectionid: findLastSectionId(),
                origin: origin,
                config: {wwwroot: M.cfg.wwwroot},
                generationtitle: ''
            };

            Templates.render('block_dixeo_modulegen/activitychooser', context)
            .then(function(html, js) {
                const container = block.querySelector('#dixeo-module-generator');
                if (!container) {
                    return;
                }

                initialized = true;
                container.insertAdjacentHTML('beforeend', html);

                if (js) {
                    Templates.runTemplateJS(js);
                }

                registerCategoryToggles(block);
                if (hasStandardCourseModuleList()) {
                    addDragAndDrop(block);
                }

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
     * Find the last section number on the page.
     *
     * @returns {string} The last section number as string, or '0' if none found.
     */
    const findLastSectionId = () => {
        const sections = document.querySelectorAll('[data-for="section"][data-sectionid]');
        for (let i = sections.length - 1; i >= 0; i--) {
            const num = parseInt(sections[i].dataset.sectionid, 10);
            if (Number.isFinite(num) && num > 0) {
                return String(num);
            }
        }
        return '0';
    };

    /**
     * Resolve the course-module list item or section header under the cursor.
     * Uses [data-for="section"] so it works across formats (topics, edai, etc.), not only .course-content.
     *
     * @param {EventTarget|null} eventTarget - Event target from drag events.
     * @returns {HTMLElement|null}
     */
    const findGenerationDropTarget = (eventTarget) => {
        if (!eventTarget || !eventTarget.closest) {
            return null;
        }
        const el = /** @type {HTMLElement} */ (eventTarget);
        const leadDrop = el.closest(SELECTOR_SECTION_LEAD_DROP);
        if (leadDrop && leadDrop.closest('[data-for="section"]')) {
            return leadDrop;
        }
        const activity = el.closest('li.activity[data-for="cmitem"]');
        if (activity && activity.closest('[data-for="section"]')) {
            return activity;
        }
        const sectionTitle = el.closest('[data-for="section_title"]');
        if (sectionTitle && sectionTitle.closest('[data-for="section"]')) {
            return sectionTitle;
        }
        return null;
    };

    /**
     * Wire generation links as drag sources and course sections/activities as drop targets.
     * On drop, sets data-section-number / data-before-mod on the link and triggers click to open the modal.
     *
     * @param {HTMLElement} block - The activity chooser block element.
     */
    const addDragAndDrop = function(block) {
        // Mobile devices don't support drag and drop well.
        if (window.innerWidth <= 992) {
            return;
        }

        const options = block.querySelectorAll(GENERATION_DRAG_OPTION);
        options.forEach(function(option) {
            if (option.classList.contains('disabled')) {
                return;
            }

            option.classList.add('draggable');
            option.setAttribute('draggable', 'true');

            // Dragstart runs before any dragover; the drag event can fire too late for document delegation.
            option.addEventListener('dragstart', function(ev) {
                option.classList.add('dragging');
                const dt = ev.dataTransfer;
                if (!dt) {
                    return;
                }
                try {
                    dt.setData('text/plain', option.getAttribute('data-module-name') || '');
                    dt.effectAllowed = 'copyMove';
                } catch (e) {
                    // DataTransfer#setData may throw in restricted drag contexts.
                }
            });

            option.addEventListener('dragend', function() {
                option.classList.remove('dragging');
            });
        });

        if (courseDropDelegationAttached) {
            return;
        }
        courseDropDelegationAttached = true;

        /**
         * Remove lead-drop zones when they no longer sit before a cm item (partial DOM refresh).
         */
        const removeOrphanSectionLeadDrops = () => {
            document.querySelectorAll(SELECTOR_SECTION_LEAD_DROP).forEach((zone) => {
                const next = zone.nextElementSibling;
                if (!next || !next.matches || !next.matches('li.activity[data-for="cmitem"]')) {
                    zone.remove();
                }
            });
        };

        /**
         * Place one droppable strip before the first activity in each cmlist (view and editing).
         */
        const syncSectionLeadDropzones = () => {
            removeOrphanSectionLeadDrops();
            document.querySelectorAll('[data-for="section"] ul[data-for="cmlist"]').forEach((ul) => {
                const firstCm = ul.querySelector(':scope > li.activity[data-for="cmitem"]');
                if (!firstCm) {
                    return;
                }
                let zone = ul.querySelector(SCOPED_SECTION_LEAD_DROP);
                if (!zone) {
                    zone = /** @type {HTMLLIElement} */ (document.createElement('li'));
                    zone.setAttribute('data-dixeo-modulegen', SECTION_LEAD_DROP);
                    zone.className = 'dixeo-modulegen-section-lead-drop';
                    zone.setAttribute('aria-hidden', 'true');
                    firstCm.before(zone);
                } else if (zone.nextElementSibling !== firstCm) {
                    firstCm.before(zone);
                }
            });
            document.querySelectorAll('[data-for="section"] ul[data-for="cmlist"]').forEach((ul) => {
                const zones = ul.querySelectorAll(SCOPED_SECTION_LEAD_DROP);
                for (let i = 1; i < zones.length; i++) {
                    zones[i].remove();
                }
            });
        };

        let leadDropSyncTimer = null;
        const scheduleSyncSectionLeadDropzones = () => {
            if (leadDropSyncTimer !== null) {
                return;
            }
            leadDropSyncTimer = window.setTimeout(() => {
                leadDropSyncTimer = null;
                syncSectionLeadDropzones();
            }, 120);
        };

        syncSectionLeadDropzones();
        const leadDropObserverRoot = document.querySelector('#region-main') || document.body;
        const leadDropObserver = new MutationObserver(() => scheduleSyncSectionLeadDropzones());
        leadDropObserver.observe(leadDropObserverRoot, {childList: true, subtree: true});
        const bodyClassObserver = new MutationObserver(() => syncSectionLeadDropzones());
        bodyClassObserver.observe(document.body, {attributes: true, attributeFilter: ['class']});
        document.addEventListener('job-completed', scheduleSyncSectionLeadDropzones);

        const getActiveDragOption = () => block.querySelector('.optioninfo a.dragging');

        const clearDropHighlights = () => {
            if (highlightedGenerationDropTarget) {
                DROP_HIGHLIGHT_CLASSES.forEach((c) => highlightedGenerationDropTarget.classList.remove(c));
                highlightedGenerationDropTarget = null;
            }
        };

        document.addEventListener('dragover', (e) => {
            if (!getActiveDragOption()) {
                return;
            }
            const dropEl = findGenerationDropTarget(e.target);
            if (!dropEl) {
                clearDropHighlights();
                return;
            }
            e.preventDefault();
            const dt = e.dataTransfer;
            if (dt) {
                dt.dropEffect = 'copy';
            }
            if (highlightedGenerationDropTarget !== dropEl) {
                clearDropHighlights();
                highlightedGenerationDropTarget = dropEl;
                DROP_HIGHLIGHT_CLASSES.forEach((c) => dropEl.classList.add(c));
            }
        }, USE_CAPTURE);

        document.addEventListener('drop', (e) => {
            const activeOption = getActiveDragOption();
            if (!activeOption) {
                return;
            }
            const activity = findGenerationDropTarget(e.target);
            if (!activity) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            clearDropHighlights();

            const section = activity.closest('[data-for="section"]');
            if (!section || section.dataset.sectionid === undefined) {
                return;
            }

            const sectionId = section.dataset.sectionid;
            let beforeMod = null;
            if (activity.getAttribute('data-dixeo-modulegen') === SECTION_LEAD_DROP) {
                const firstCm = activity.nextElementSibling;
                if (!firstCm || !firstCm.dataset || !firstCm.dataset.id) {
                    return;
                }
                beforeMod = firstCm.dataset.id;
            } else {
                const nextActivity = activity.nextElementSibling;
                if (nextActivity && nextActivity.dataset && nextActivity.dataset.id) {
                    beforeMod = nextActivity.dataset.id;
                }
            }

            activeOption.dataset.sectionNumber = sectionId;
            activeOption.dataset.beforeMod = beforeMod || '';
            activeOption.click();
        }, USE_CAPTURE);

        document.addEventListener('dragend', clearDropHighlights);
    };

    return {
        init: init
    };
});
