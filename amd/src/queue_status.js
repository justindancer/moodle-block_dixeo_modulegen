/**
 * Queue status display and management module.
 *
 * Displays queue statistics in the block footer. Clicking the footer expands it
 * to float over the content and reveals the queue below. This module is UI-only
 * and handles:
 * - Queue display rendering
 * - Statistics updates (single source of truth in footer)
 * - Task filtering by status
 * - Task cancellation (delegated to job_manager)
 *
 * Architecture:
 * - All polling and module creation is handled by job_manager.js
 * - This module listens to job-queue-data events for UI updates
 * - Statistics are rendered once in the footer (no duplication)
 * - Queue list is displayed in an expandable container below the footer
 *
 * @module     block_dixeo_modulegen/queue_status
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @author     Josemaria Bolanos <admin@mako.digital>
 * @author     Pierre FACQ <pierre.facq@edunao.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([
    'jquery',
    'core/str',
    'core/templates',
    'core/notification',
    'core/ajax',
    'block_dixeo_modulegen/job_manager'
], function($, Str, Templates, Notification, Ajax, JobManager) {
    'use strict';

    return {
        /** @var {number|null} courseId - The current course ID. */
        courseId: null,

        /** @var {Object} modules - Map of module shortname to module metadata. */
        modules: {},

        /** @var {HTMLElement|null} blockFooter - The block footer element. */
        blockFooter: null,

        /** @var {HTMLElement|null} queueContainer - The expanded queue container element. */
        queueContainer: null,

        /** @var {boolean} isExpanded - Whether the queue is currently expanded. */
        isExpanded: false,

        /** @var {number|null} elapsedInterval - Interval ID for elapsed time updates. */
        elapsedInterval: null,

        /** @var {Object|null} stats - Current queue statistics. */
        stats: null,

        /** @var {Object|null} boundHandlers - Stored event handlers for cleanup. */
        boundHandlers: null,

        /**
         * Initialize the queue status module.
         *
         * @param {number} courseId - The course ID.
         * @param {Array} categories - Available module categories.
         */
        init: function(courseId, categories) {
            // Skip if called without courseId (happens when loaded directly by PHP).
            if (!courseId) {
                return;
            }

            // Prevent duplicate initialization.
            if (this.courseId !== null) {
                return;
            }

            this.courseId = courseId;

            // Map modules by shortname for display data.
            if (categories) {
                this.modules = {};
                categories.forEach(category => {
                    category.items.forEach(item => {
                        if (item && item.shortname) {
                            this.modules[item.shortname] = item;
                        }
                    });
                });
            }

            this.blockFooter = document.querySelector('#dixeo-module-generator .card-footer');
            this.queueContainer = null;

            // Create bound handlers so we can remove them later.
            this.boundHandlers = {
                footerClick: () => this.toggleQueueExpansion(),
                queueCloseClick: () => this.collapseQueue(),
                queueDataUpdate: (event) => this.handleQueueData(event),
                triggerRefresh: () => this.updateQueueStatistics(),
                beforeUnload: () => this.cleanup(),
                filterHandler: null
            };

            if (this.blockFooter) {
                this.blockFooter.addEventListener('click', this.boundHandlers.footerClick);
                // Tooltip for the status bar.
                Str.get_string('opengeneratorqueue', 'block_dixeo_modulegen').then((s) => {
                    if (this.blockFooter) {
                        this.blockFooter.setAttribute('title', s);
                    }
                });
                // Use cache from JobManager.init — avoids duplicate get_queue_status XHR.
                this.updateQueueStatistics(false);
            }

            // Listen for queue data events from job_manager (single source of truth for polling).
            document.addEventListener('job-queue-data', this.boundHandlers.queueDataUpdate);

            // Listen for job lifecycle events to trigger immediate refresh.
            document.addEventListener('newTaskAdded', this.boundHandlers.triggerRefresh);
            document.addEventListener('job-queued', this.boundHandlers.triggerRefresh);
            document.addEventListener('job-processing', this.boundHandlers.triggerRefresh);
            document.addEventListener('job-completed', this.boundHandlers.triggerRefresh);
            document.addEventListener('job-failed', this.boundHandlers.triggerRefresh);

            // Cleanup on page unload.
            window.addEventListener('beforeunload', this.boundHandlers.beforeUnload);
        },

        /**
         * Clean up event listeners and timers.
         */
        cleanup: function() {
            if (this.elapsedInterval) {
                clearInterval(this.elapsedInterval);
                this.elapsedInterval = null;
            }

            // Remove queue container if expanded.
            if (this.queueContainer) {
                this.collapseQueue();
            }

            if (this.boundHandlers) {
                if (this.blockFooter) {
                    this.blockFooter.removeEventListener('click', this.boundHandlers.footerClick);
                }
                if (this.queueContainer) {
                    const queueHeader = this.queueContainer.querySelector('.queue-header');
                    if (queueHeader) {
                        queueHeader.removeEventListener('click', this.boundHandlers.queueCloseClick);
                    }
                }
                document.removeEventListener('job-queue-data', this.boundHandlers.queueDataUpdate);
                document.removeEventListener('newTaskAdded', this.boundHandlers.triggerRefresh);
                document.removeEventListener('job-queued', this.boundHandlers.triggerRefresh);
                document.removeEventListener('job-processing', this.boundHandlers.triggerRefresh);
                document.removeEventListener('job-completed', this.boundHandlers.triggerRefresh);
                document.removeEventListener('job-failed', this.boundHandlers.triggerRefresh);
                window.removeEventListener('beforeunload', this.boundHandlers.beforeUnload);
            }
        },

        /**
         * Handle queue data event from job_manager.
         * This is the primary data source - job_manager handles all polling.
         *
         * @param {CustomEvent} event - The job-queue-data event with data in event.detail.
         */
        handleQueueData: function(event) {
            const data = event.detail?.data;
            if (!data) {
                return;
            }

            this.renderQueueStatistics(data);

            // Update queue list if expanded.
            if (this.isExpanded && this.queueContainer) {
                this.updateQueueList(data);
            }
        },

        /**
         * Toggle the queue expansion - enlarge footer and reveal queue below.
         */
        toggleQueueExpansion: async function() {
            if (this.isExpanded) {
                this.collapseQueue();
            } else {
                await this.expandQueue();
            }
        },

        /**
         * Expand the footer to show the queue.
         */
        expandQueue: async function() {
            if (!this.blockFooter) {
                return;
            }

            this.isExpanded = true;
            this.blockFooter.classList.add('queue-expanded');

            // Create queue container if it doesn't exist.
            if (!this.queueContainer) {
                // Insert the queue container right before the footer as a sibling.
                this.queueContainer = document.createElement('div');
                this.queueContainer.className = 'queue-container-expanded';

                this.blockFooter.parentNode.insertBefore(this.queueContainer, this.blockFooter);

                const queueHeader = this.queueContainer.querySelector('.queue-header');
                if (queueHeader) {
                    queueHeader.addEventListener('click', this.boundHandlers.queueCloseClick);
                    queueHeader.classList.add('cursor-pointer');
                }
                const closeButton = this.queueContainer.querySelector('.queue-close-button');
                if (closeButton) {
                    closeButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.boundHandlers.queueCloseClick();
                    });
                }
            }

            // Calculate footer height and position queue container below it first.
            // Use requestAnimationFrame to ensure DOM is updated.
            requestAnimationFrame(() => {
                if (this.queueContainer && this.blockFooter) {
                    const footerHeight = this.blockFooter.offsetHeight;
                    // Position queue container from top to footer bottom.
                    this.queueContainer.style.top = '0';
                    this.queueContainer.style.bottom = `${footerHeight}px`;
                    // Ensure proper z-index.
                    this.queueContainer.style.zIndex = '998';
                    // Start below (translateY(100%)) and hidden.
                    this.queueContainer.style.transform = 'translateY(100%)';
                    this.queueContainer.style.opacity = '0';
                    this.queueContainer.style.visibility = 'hidden';
                    this.queueContainer.style.pointerEvents = 'none';
                }
            });

            // Show loading state only if container is empty or doesn't have content yet.
            const hasContent = this.queueContainer &&
                              this.queueContainer.querySelector('.task-list') &&
                              this.queueContainer.querySelector('.task-list').children.length > 0;
            if (!hasContent) {
                this.showQueueLoading();
            }

            // Load and display the queue, then animate in.
            await this.updateQueueList();

            // Hide loading after content is loaded (updateQueueList also hides it, but ensure it's hidden).
            this.hideQueueLoading();

            // Trigger animation after ensuring content is rendered and visible.
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (this.queueContainer) {
                        // Make visible first, then animate.
                        this.queueContainer.style.visibility = 'visible';
                        this.queueContainer.style.pointerEvents = 'auto';
                        // Force reflow to ensure visibility is applied.
                        void this.queueContainer.offsetHeight;
                        // Now animate.
                        this.queueContainer.style.transform = 'translateY(0)';
                        this.queueContainer.style.opacity = '1';
                    }
                });
            });
        },

        /**
         * Collapse the footer to hide the queue.
         */
        collapseQueue: function() {
            if (!this.blockFooter) {
                return;
            }

            this.isExpanded = false;
            this.blockFooter.classList.remove('queue-expanded');

            // Animate queue container downward before removing.
            if (this.queueContainer) {
                // Lower z-index immediately BEFORE any animation so it goes behind footer.
                this.queueContainer.style.zIndex = '997';
                this.queueContainer.style.transition = 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out, visibility 0.3s';
                // Force reflow to ensure z-index change is applied before animation starts.
                void this.queueContainer.offsetHeight;
                // Trigger animation downward (translateY(0) to translateY(100%)).
                this.queueContainer.style.transform = 'translateY(100%)';
                this.queueContainer.style.opacity = '0';
                this.queueContainer.style.pointerEvents = 'none';

                // Remove after animation completes.
                setTimeout(() => {
                    if (this.queueContainer) {
                        this.queueContainer.style.visibility = 'hidden';
                        this.queueContainer.remove();
                        this.queueContainer = null;
                    }
                }, 300); // Match transition duration.
            }
        },

        /**
         * Show loading state in queue container.
         */
        showQueueLoading: function() {
            if (!this.queueContainer) {
                return;
            }
            const loadingDiv = this.queueContainer.querySelector('.queue-loading');
            const taskList = this.queueContainer.querySelector('.task-list');
            if (loadingDiv) {
                loadingDiv.classList.remove('d-none');
                loadingDiv.classList.add('d-flex');
            }
            if (taskList) {
                taskList.classList.add('d-none');
            }
        },

        /**
         * Hide loading state in queue container.
         */
        hideQueueLoading: function() {
            if (!this.queueContainer) {
                return;
            }
            const loadingDiv = this.queueContainer.querySelector('.queue-loading');
            const taskList = this.queueContainer.querySelector('.task-list');
            if (loadingDiv) {
                loadingDiv.classList.add('d-none');
                loadingDiv.classList.remove('d-flex');
            }
            if (taskList) {
                taskList.classList.remove('d-none');
            }
        },

        /**
         * Update the queue list in the expanded container.
         *
         * @param {Object} data - Optional pre-fetched queue data to avoid duplicate API calls.
         */
        updateQueueList: function(data = null) {
            if (!this.queueContainer) {
                return;
            }

            // Use provided data or fetch via JobManager (centralized, cached).
            const dataPromise = data
                ? Promise.resolve(data)
                : JobManager.getQueueStatus(true);

            dataPromise.then(async (data) => {
                const context = {tasks: []};

                // Process tasks for template rendering.
                if (Array.isArray(data.tasks)) {
                    for (const task of data.tasks) {
                        await this.enrichTaskForDisplay(task);
                        context.tasks.push(task);
                    }
                    // Mark the "Next" task (show "Next" instead of "Queued"): either the queued task
                    // immediately after the one in progress, or (if none processing) the oldest queued (last in list).
                    const nextStr = await Str.get_string('next', 'block_dixeo_modulegen');
                    let nextMarked = false;
                    for (let i = 0; i < context.tasks.length - 1; i++) {
                        if (parseInt(context.tasks[i].status, 10) === 1 && parseInt(context.tasks[i + 1].status, 10) === 0) {
                            context.tasks[i + 1].isnext = true;
                            context.tasks[i + 1].statusdisplay = nextStr;
                            nextMarked = true;
                            break;
                        }
                    }
                    if (!nextMarked) {
                        // No task is processing; the next in line is the oldest queued (last in list, list is newest first).
                        for (let j = context.tasks.length - 1; j >= 0; j--) {
                            if (parseInt(context.tasks[j].status, 10) === 0) {
                                context.tasks[j].isnext = true;
                                context.tasks[j].statusdisplay = nextStr;
                                break;
                            }
                        }
                    }
                }

                // Note: We don't update stats here - they're already updated in renderQueueStatistics
                // to avoid duplication. The stats in the footer are the single source of truth.

                // Track scroll position if container already has content.
                let scrollPosition = 0;
                if (this.queueContainer) {
                    const existingTaskList = this.queueContainer.querySelector('.task-list');
                    if (existingTaskList) {
                        scrollPosition = existingTaskList.scrollTop;
                    }
                }

                // Render queue without statistics (they're already in the footer).
                if (!this.queueContainer) {
                    return;
                }

                const html = await Templates.render('block_dixeo_modulegen/queue', context);
                this.queueContainer.innerHTML = html;

                // Hide loading after rendering content.
                this.hideQueueLoading();

                // Re-attach close handlers after rendering.
                const queueHeader = this.queueContainer.querySelector('.queue-header');
                if (queueHeader) {
                    queueHeader.addEventListener('click', this.boundHandlers.queueCloseClick);
                    queueHeader.classList.add('cursor-pointer');
                }
                const closeButton = this.queueContainer.querySelector('.queue-close-button');
                if (closeButton) {
                    closeButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.boundHandlers.queueCloseClick();
                    });
                }

                // Update position after content is rendered (footer height might have changed).
                if (this.isExpanded && this.blockFooter) {
                    requestAnimationFrame(() => {
                        if (this.queueContainer && this.blockFooter) {
                            const footerHeight = this.blockFooter.offsetHeight;
                            // Position queue container so its top aligns with footer's bottom.
                            this.queueContainer.style.bottom = `${footerHeight}px`;
                            this.queueContainer.style.top = 'auto';
                            // Animate up from below (translateY(100%) to translateY(0)).
                            this.queueContainer.style.transform = 'translateY(0)';
                        }
                    });
                }

                // Restore scroll position.
                const taskList = this.queueContainer.querySelector('.task-list');
                if (taskList) {
                    setTimeout(() => {
                        requestAnimationFrame(() => {
                            taskList.scrollTop = scrollPosition;
                        });
                    }, 1);
                }

                this.addActionListeners();

            }).catch(async (error) => {
                const errorTitle = await Str.get_string('error_title', 'block_dixeo_modulegen');
                Notification.alert(errorTitle, error.message || String(error));
            });
        },

        /**
         * Enrich a task with display data.
         *
         * @param {Object} task - The task record.
         */
        enrichTaskForDisplay: async function(task) {
            // Add module display info.
            task.displayname = '';
            task.iconurl = '';
            task.options = {beta: false};

            if (this.modules[task.modulename]) {
                const mod = this.modules[task.modulename];
                task.displayname = mod.displayname;
                task.iconurl = mod.iconurl;
                task.options.beta = mod.options?.beta || false;
            }

            const status = parseInt(task.status, 10);

            task.isqueued = (status === 0);
            task.isprocessing = (status === 1);
            task.iscompleted = (status === 2);
            task.isfailed = (status === 3);
            task.iscancelled = (status === 4);
            task.isnext = false;

            // Status display text for template.
            if (status === 0) {
                task.statusdisplay = await Str.get_string('queued', 'block_dixeo_modulegen');
            } else if (status === 3) {
                task.statusdisplay = await Str.get_string('generationerror', 'block_dixeo_modulegen');
            } else if (status === 4) {
                task.statusdisplay = await Str.get_string('cancelled', 'block_dixeo_modulegen');
            }

            // Remove button: allowed for queued, processing, completed, failed, cancelled; tooltip varies.
            task.canremove = (status === 0 || status === 1 || status === 2 || status === 3 || status === 4);
            if (task.canremove) {
                if (status === 1) {
                    task.removetooltip = await Str.get_string('cancelgeneration', 'block_dixeo_modulegen');
                } else if (status === 0) {
                    task.removetooltip = await Str.get_string('removefromqueue', 'block_dixeo_modulegen');
                } else {
                    task.removetooltip = await Str.get_string('removefromdisplay', 'block_dixeo_modulegen');
                }
            }
        },

        /**
         * Add action button listeners to the queue container (remove, instructions tooltip).
         */
        addActionListeners: function() {
            if (!this.queueContainer) {
                return;
            }

            const removeButtons = this.queueContainer.querySelectorAll('.task-item .task-remove-button');
            removeButtons.forEach((button) => {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleRemoveTask(button);
                });
            });

            const retryLinks = this.queueContainer.querySelectorAll('.task-item .task-retry-link');
            retryLinks.forEach((link) => {
                link.addEventListener('click', (e) => this.handleRetryClick(e, link));
            });

            this.bindInstructionsTooltips();
        },

        /**
         * Open generation modal for retry with task instructions prefilled.
         *
         * @param {Event} e - The click event.
         * @param {Element} link - The retry link element.
         */
        handleRetryClick: function(e, link) {
            e.preventDefault();
            const mode = link.getAttribute('data-queue-mode') || 'generate';
            if (mode === 'fill') {
                this.handleFillRetryTask(link);
                return;
            }
            const taskItem = link.closest('.task-item');
            if (!taskItem) {
                return;
            }
            const contentEl = taskItem.querySelector('.task-instructions-content');
            const instructions = contentEl ? contentEl.textContent.trim() : '';
            document.dispatchEvent(new CustomEvent('generationModalRetry', {
                detail: {
                    taskId: link.getAttribute('data-task-id'),
                    instructions: instructions,
                    modulename: link.getAttribute('data-module-name') || '',
                    sectionnumber: link.getAttribute('data-sectionnumber') || '0',
                    beforemod: link.getAttribute('data-beforemod') || '0',
                    courseid: link.getAttribute('data-courseid') || ''
                }
            }));
        },

        /**
         * Retry a fill-mode queue row via modulegen web service (no generation modal).
         *
         * @param {Element} link - Retry control.
         */
        handleFillRetryTask: function(link) {
            const queueId = parseInt(link.getAttribute('data-task-id'), 10);
            const courseId = parseInt(link.getAttribute('data-courseid'), 10) || parseInt(this.courseId, 10);
            if (!queueId || !courseId) {
                return;
            }
            const originalText = link.textContent;
            link.style.pointerEvents = 'none';
            Str.get_string('processing', 'block_dixeo_modulegen').then((processingLabel) => {
                link.textContent = processingLabel + '…';
                return Ajax.call([{
                    methodname: 'block_dixeo_modulegen_retry_fill_task',
                    args: {
                        queueid: queueId,
                        courseid: courseId
                    }
                }])[0];
            }).then((data) => {
                link.style.pointerEvents = '';
                link.textContent = originalText;
                if (!data || !data.success) {
                    const msg = (data && data.message) ? data.message : '';
                    return Str.get_string('error_title', 'block_dixeo_modulegen').then((title) => {
                        Notification.alert(title, msg || String(title));
                    });
                }
                this.updateQueueStatistics();
                this.updateQueueList();
                return null;
            }).catch((error) => {
                link.style.pointerEvents = '';
                link.textContent = originalText;
                Notification.exception(error);
            });
        },

        /**
         * Bind hover tooltips for task instructions (trigger = status area wrapper, no icon).
         */
        bindInstructionsTooltips: function() {
            if (!this.queueContainer) {
                return;
            }

            const triggers = this.queueContainer.querySelectorAll('.task-instructions-trigger-wrapper');
            let hideTimeout = null;

            const hideTooltip = () => {
                hideTimeout = setTimeout(() => {
                    const el = document.body.querySelector('.task-instructions-tooltip');
                    if (el) {
                        el.style.display = 'none';
                    }
                    hideTimeout = null;
                }, 100);
            };

            let tooltipEl = document.body.querySelector('.task-instructions-tooltip');
            if (!tooltipEl) {
                tooltipEl = document.createElement('div');
                tooltipEl.className = 'task-instructions-tooltip';
                tooltipEl.setAttribute('role', 'tooltip');
                document.body.appendChild(tooltipEl);
                tooltipEl.addEventListener('mouseenter', () => {
                    if (hideTimeout) {
                        clearTimeout(hideTimeout);
                        hideTimeout = null;
                    }
                });
                tooltipEl.addEventListener('mouseleave', () => hideTooltip());
            }
            tooltipEl.style.display = 'none';

            const showTooltip = (wrapper, content) => {
                if (hideTimeout) {
                    clearTimeout(hideTimeout);
                    hideTimeout = null;
                }
                const text = (content && content.trim()) ? content.trim() : null;
                if (text) {
                    tooltipEl.textContent = text;
                } else {
                    Str.get_string('noinstructions', 'block_dixeo_modulegen').then((s) => {
                        tooltipEl.textContent = s;
                    });
                }
                const rect = wrapper.getBoundingClientRect();
                let top = rect.bottom + 6;
                let left = rect.left;
                tooltipEl.style.top = top + 'px';
                tooltipEl.style.left = left + 'px';
                tooltipEl.style.display = 'block';
                requestAnimationFrame(() => {
                    const tr = tooltipEl.getBoundingClientRect();
                    if (tr.bottom > window.innerHeight - 8) {
                        tooltipEl.style.top = (rect.top - tr.height - 6) + 'px';
                    }
                    if (tr.right > window.innerWidth - 8) {
                        tooltipEl.style.left = (window.innerWidth - tr.width - 8) + 'px';
                    }
                    if (parseInt(tooltipEl.style.left, 10) < 8) {
                        tooltipEl.style.left = '8px';
                    }
                });
            };

            triggers.forEach((wrapper) => {
                const contentEl = wrapper.querySelector('.task-instructions-content');
                const content = contentEl ? contentEl.textContent : '';

                wrapper.addEventListener('mouseenter', () => showTooltip(wrapper, content));
                wrapper.addEventListener('mouseleave', () => hideTooltip());
            });
        },

        /**
         * Handle remove (X) button click - delete task and refresh.
         * Shows loading spinner and disables the row until the response is ready.
         *
         * @param {Element} button - The remove button.
         */
        handleRemoveTask: async function(button) {
            const taskId = button.getAttribute('data-task-id');
            if (!taskId) {
                return;
            }

            const taskItem = button.closest('.task-item');
            const status = taskItem ? parseInt(taskItem.getAttribute('data-status'), 10) : null;
            const isProcessing = (status === 1);

            const originalIcon = button.innerHTML;
            button.innerHTML = '<i class="fa fa-spinner fa-spin" aria-hidden="true"></i>';
            button.disabled = true;
            if (taskItem) {
                taskItem.classList.add('task-item-removing');
            }

            try {
                if (isProcessing) {
                    const result = await JobManager.cancelJob(parseInt(taskId, 10));
                    if (result && result.success === false) {
                        throw new Error(result.message || 'Cancel failed');
                    }
                } else {
                    await JobManager.removeTask(parseInt(taskId, 10));
                }
                this.updateQueueStatistics();
                this.updateQueueList();
            } catch (error) {
                Notification.exception(error);
                button.innerHTML = originalIcon;
                button.disabled = false;
                if (taskItem) {
                    taskItem.classList.remove('task-item-removing');
                }
            }
        },

        /**
         * Update queue statistics - fetches data and renders.
         * Used for initial load and immediate refreshes triggered by job events.
         * Continuous updates come via job-queue-data events from job_manager.
         *
         * @param {boolean} [forceRefresh=true] Pass false on first paint after JobManager.init to reuse its fetch.
         */
        updateQueueStatistics: function(forceRefresh = true) {
            if (!this.blockFooter) {
                return;
            }

            // Fetch via JobManager (single source of truth). Initial load uses false to avoid duplicate XHR.
            JobManager.getQueueStatus(forceRefresh).then((data) => {
                this.renderQueueStatistics(data);
            }).catch(async (error) => {
                const errorTitle = await Str.get_string('error_title', 'block_dixeo_modulegen');
                Notification.alert(errorTitle, error.message || String(error));
            });
        },

        /**
         * Render queue statistics in the block footer.
         * Separated from data fetching to allow event-driven updates.
         *
         * @param {Object} data - Queue status data with tasks and stats.
         */
        renderQueueStatistics: async function(data) {
            if (!this.blockFooter) {
                return;
            }

            // Handle elapsed time updates when there are active (queued or processing) tasks.
            if (data.stats && data.stats.active > 0) {
                if (!this.elapsedInterval) {
                    this.elapsedInterval = setInterval(() => {
                        this.updateElapsedTime();
                    }, 1000);
                }
            } else {
                if (this.elapsedInterval) {
                    clearInterval(this.elapsedInterval);
                    this.elapsedInterval = null;
                }
            }

            // Render stats (active = queued + processing, errors = failed + cancelled).
            const stats = data.stats || {active: 0, errors: 0};

            this.stats = stats;

            const idleStr = await Str.get_string('idle', 'block_dixeo_modulegen');
            const html = await Templates.render('block_dixeo_modulegen/queue_stats', {stats: stats, idle: idleStr});
            this.blockFooter.innerHTML = html;
            this.updateElapsedTime();
        },

        /**
         * Update elapsed time display for processing tasks.
         */
        updateElapsedTime: function() {
            // Update elapsed time in the queue container if expanded.
            if (this.queueContainer) {
                const processingTasks = this.queueContainer.querySelectorAll('.task-item[data-status="1"]');
                processingTasks.forEach((taskEl) => {
                    const startTime = taskEl.getAttribute('data-timestarted');
                    if (!startTime) {
                        return;
                    }

                    const startTimestamp = parseInt(startTime, 10) * 1000;
                    const now = Date.now();
                    const elapsedMs = now - startTimestamp;

                    const hours = Math.floor((elapsedMs / (1000 * 60 * 60)) % 24);
                    const minutes = Math.floor((elapsedMs / (1000 * 60)) % 60);
                    const seconds = Math.floor((elapsedMs / 1000) % 60);

                    let elapsedStr = '';
                    if (hours > 0) {
                        elapsedStr = String(hours).padStart(2, '0') + ':';
                    }
                    elapsedStr += String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');

                    const elapsedElement = taskEl.querySelector('.task-status-processing .elapsed-time');
                    if (elapsedElement) {
                        elapsedElement.textContent = elapsedStr;
                    }
                });
            }
        }
    };
});
