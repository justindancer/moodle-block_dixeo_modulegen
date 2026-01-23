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
 * @author     Pierre FACQ <pierre.facq@edunao.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([
    'jquery',
    'core/str',
    'core/templates',
    'core/modal_save_cancel',
    'core/modal_events',
    'core/notification',
    'block_dixeo_modulegen/job_manager'
], function($, Str, Templates, ModalSaveCancel, ModalEvents, Notification, JobManager) {
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

        /** @var {string} activeFilter - Current task filter ('all', 'queued', 'processing', 'completed'). */
        activeFilter: 'all',

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
                footerClick: (event) => {
                    // Don't toggle if clicking on a stat element (stats have their own handler).
                    if (!event.target.closest('.stat')) {
                        this.toggleQueueExpansion();
                    }
                },
                statClick: (event) => this.handleStatClick(event),
                queueCloseClick: () => this.collapseQueue(),
                queueDataUpdate: (event) => this.handleQueueData(event),
                triggerRefresh: () => this.updateQueueStatistics(),
                beforeUnload: () => this.cleanup(),
                filterHandler: null
            };

            if (this.blockFooter) {
                this.blockFooter.addEventListener('click', this.boundHandlers.footerClick);
                // Add click handler for stats.
                this.blockFooter.addEventListener('click', this.boundHandlers.statClick);
                // Initial fetch on page load.
                this.updateQueueStatistics();
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
                    this.blockFooter.removeEventListener('click', this.boundHandlers.statClick);
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
                this.queueContainer.setAttribute('data-filter', this.activeFilter);

                // Insert afbeforeter the footer.
                if (this.blockFooter) {
                    this.blockFooter.parentNode.insertBefore(this.queueContainer, this.blockFooter);
                } else {
                    this.blockFooter.parentNode.appendChild(this.queueContainer);
                }

                // Add close handlers for header and button.
                const queueHeader = this.queueContainer.querySelector('.queue-header');
                if (queueHeader) {
                    queueHeader.addEventListener('click', this.boundHandlers.queueCloseClick);
                    queueHeader.style.cursor = 'pointer';
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
         * Handle click on footer statistics.
         *
         * @param {Event} event - The click event.
         */
        handleStatClick: async function(event) {
            const stat = event.target.closest('.stats-container .stat');
            if (!stat) {
                return;
            }

            event.stopPropagation();

            let filter = stat.getAttribute('data-filter') || '';
            if (this.activeFilter === filter || filter === '') {
                filter = 'all';
            }

            this.activeFilter = filter;

            // If queue is collapsed, expand it.
            if (!this.isExpanded) {
                await this.expandQueue();
            }

            // Update the filter (whether just expanded or already expanded).
            if (this.queueContainer) {
                this.queueContainer.setAttribute('data-filter', filter);
                // Also update inner queue-container for CSS filtering.
                const innerQueueContainer = this.queueContainer.querySelector('.queue-container');
                if (innerQueueContainer) {
                    innerQueueContainer.setAttribute('data-filter', filter);
                }
            }

            // Update active state in footer.
            this.updateStatsActiveState();
        },

        /**
         * Update the active state of statistics in the footer.
         */
        updateStatsActiveState: function() {
            if (!this.blockFooter) {
                return;
            }

            const stats = this.blockFooter.querySelectorAll('.stat');
            stats.forEach(stat => {
                const filter = stat.getAttribute('data-filter') || '';
                if (this.activeFilter === filter && filter !== '') {
                    stat.classList.add('active');
                } else if (this.activeFilter === 'all' || filter === '') {
                    stat.classList.remove('active');
                } else {
                    stat.classList.remove('active');
                }
            });
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
                loadingDiv.style.display = 'flex';
            }
            if (taskList) {
                taskList.style.display = 'none';
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
                loadingDiv.style.display = 'none';
            }
            if (taskList) {
                taskList.style.display = 'block';
            }
            // Ensure loading is definitely hidden.
            if (loadingDiv) {
                loadingDiv.setAttribute('style', 'display: none !important;');
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
                }

                // Note: We don't update stats here - they're already updated in renderQueueStatistics
                // to avoid duplication. The stats in the footer are the single source of truth.

                context.activeFilter = this.activeFilter;

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
                // Set filter on both outer container and inner queue-container.
                this.queueContainer.setAttribute('data-filter', this.activeFilter);
                const innerQueueContainer = this.queueContainer.querySelector('.queue-container');
                if (innerQueueContainer) {
                    innerQueueContainer.setAttribute('data-filter', this.activeFilter);
                }

                // Hide loading after rendering content.
                this.hideQueueLoading();

                // Re-attach close handlers after rendering.
                const queueHeader = this.queueContainer.querySelector('.queue-header');
                if (queueHeader) {
                    queueHeader.addEventListener('click', this.boundHandlers.queueCloseClick);
                    queueHeader.style.cursor = 'pointer';
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

                this.addFilteringListeners();
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
            task.backgroundColor = '';
            task.options = {beta: false};

            if (this.modules[task.modulename]) {
                const mod = this.modules[task.modulename];
                task.displayname = mod.displayname;
                task.iconurl = mod.iconurl;
                task.backgroundColor = mod.backgroundColor;
                task.options.beta = mod.options?.beta || false;
            }

            const status = parseInt(task.status);

            // Status display strings.
            // 0=PENDING, 1=PROCESSING, 2=COMPLETED, 3=FAILED, 4=CANCELLED
            if (status === 0) {
                task.generationstatus = await Str.get_string('generationqueued', 'block_dixeo_modulegen');
            } else if (status === 1) {
                task.generationstatus = await Str.get_string('generationinprogress', 'block_dixeo_modulegen');
            } else if (status === 3) {
                task.generationstatus = await Str.get_string('generationfailed', 'block_dixeo_modulegen');
                const params = task.params ? JSON.parse(task.params) : {};
                task.timestamp = params.error || '';
                task.isfailed = true;
            } else if (status === 4) {
                task.generationstatus = await Str.get_string('generationcancelled', 'block_dixeo_modulegen');
                task.isfailed = true;
            }

            // Only PENDING tasks can be cancelled (not PROCESSING).
            task.isqueued = (status === 0);
            task.iscompleted = (status === 2);
            task.isfailed = task.isfailed || false;
        },

        /**
         * Add filtering listeners to the queue container.
         */
        addFilteringListeners: function() {
            if (!this.queueContainer) {
                return;
            }

            if (this.queueContainer.dataset.listenerAttached === 'true') {
                return;
            }

            this.queueContainer.dataset.listenerAttached = 'true';
            // Filtering is now handled by handleStatClick in the footer.
        },

        /**
         * Add action button listeners to the queue container.
         */
        addActionListeners: function() {
            if (!this.queueContainer) {
                return;
            }

            const cancelButtons = this.queueContainer.querySelectorAll('.task-item .cancel-task-button');
            cancelButtons.forEach((button) => {
                button.addEventListener('click', () => this.handleCancelTask(button));
            });
        },

        /**
         * Handle cancel button click.
         *
         * @param {Element} button - The cancel button.
         */
        handleCancelTask: async function(button) {
            const taskId = button.getAttribute('data-task-id');
            if (!taskId) {
                return;
            }

            button.disabled = true;

            const confirmTitle = await Str.get_string('canceltask', 'block_dixeo_modulegen');
            const confirmBody = await Str.get_string('canceltaskconfirm', 'block_dixeo_modulegen');

            try {
                const modal = await ModalSaveCancel.create({
                    title: confirmTitle,
                    body: confirmBody,
                    show: true,
                    removeOnClose: true,
                });

                modal.getRoot().on(ModalEvents.save, () => {
                    this.cancelTask(parseInt(taskId));
                });

                modal.getRoot().on(ModalEvents.hidden, () => {
                    button.disabled = false;
                    this.updateQueueList();
                });

                modal.getRoot().on(ModalEvents.cancel, () => {
                    button.disabled = false;
                    this.updateQueueList();
                });

            } catch (error) {
                Notification.exception(error);
            }
        },

        /**
         * Cancel a task via the job manager.
         *
         * @param {number} taskId - The task ID.
         */
        cancelTask: async function(taskId) {
            try {
                await JobManager.cancelJob(taskId);

                const successTitle = await Str.get_string('cancelled', 'block_dixeo_modulegen');
                const successMessage = await Str.get_string('taskcancelled', 'block_dixeo_modulegen');
                Notification.alert(successTitle, successMessage);
                this.updateQueueList();

            } catch (error) {
                const errorTitle = await Str.get_string('taskcancelerror', 'block_dixeo_modulegen');
                Notification.alert(errorTitle, error.message || String(error));
            }
        },

        /**
         * Update queue statistics - fetches data and renders.
         * Used for initial load and immediate refreshes triggered by job events.
         * Continuous updates come via job-queue-data events from job_manager.
         */
        updateQueueStatistics: function() {
            if (!this.blockFooter) {
                return;
            }

            // Fetch fresh data via JobManager (single source of truth).
            JobManager.getQueueStatus(true).then((data) => {
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

            // Handle elapsed time updates for processing tasks.
            if (data.stats && data.stats.processing > 0) {
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

            // Render stats.
            const stats = data.stats || {queued: 0, processing: 0, completed: 0};
            stats.hasqueued = stats.queued > 0;
            stats.hasprocessing = stats.processing > 0;
            stats.hascompleted = stats.completed > 0;

            this.stats = stats;

            const html = await Templates.render('block_dixeo_modulegen/queue_stats', {stats: stats});
            this.blockFooter.innerHTML = html;
            this.updateElapsedTime();
            // Update active state after rendering stats.
            this.updateStatsActiveState();
        },

        /**
         * Update elapsed time display for processing tasks.
         */
        updateElapsedTime: function() {
            // Update elapsed time in the queue container if expanded.
            if (this.queueContainer) {
                const processingTasks = this.queueContainer.querySelectorAll('.task-item[data-status="1"]');
                processingTasks.forEach((task) => {
                    const startTime = task.getAttribute('data-timestarted');
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

                    const elapsedElement = task.querySelector('.elapsed-time');
                    if (elapsedElement) {
                        elapsedElement.textContent = elapsedStr;
                    }
                });
            }
        }
    };
});
