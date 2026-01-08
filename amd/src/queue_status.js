/**
 * Queue status display and management.
 *
 * Displays queue statistics in the block footer and provides a modal
 * to view all tasks with their current status. This module is UI-only:
 * - Queue display rendering
 * - Statistics updates
 * - Task filtering
 * - Cancel action (via job_manager)
 *
 * All polling and module creation is handled by job_manager.js.
 * This module listens to job-queue-data events for UI updates.
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
    'core/modal_cancel',
    'core/modal_save_cancel',
    'core/modal_events',
    'core/notification',
    'block_dixeo_modulegen/job_manager'
], function($, Str, Templates, Modal, ModalSaveCancel, ModalEvents, Notification, JobManager) {
    'use strict';

    return {
        courseId: null,
        modules: {},
        blockFooter: null,
        queueModal: null,
        elapsedInterval: null,
        stats: null,
        activeFilter: 'all',
        /** @var {Object} boundHandlers - Stored event handlers for cleanup. */
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

            // Create bound handlers so we can remove them later.
            this.boundHandlers = {
                footerClick: () => this.openQueueModal(),
                queueDataUpdate: (event) => this.handleQueueData(event),
                triggerRefresh: () => this.updateQueueStatistics(),
                beforeUnload: () => this.cleanup()
            };

            if (this.blockFooter) {
                this.blockFooter.addEventListener('click', this.boundHandlers.footerClick);
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

            if (this.boundHandlers) {
                if (this.blockFooter) {
                    this.blockFooter.removeEventListener('click', this.boundHandlers.footerClick);
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

            // Update modal if open.
            if (this.queueModal) {
                this.updateQueueList(data);
            }
        },

        /**
         * Open the queue modal and load the task list.
         */
        openQueueModal: async function() {
            const modalTitle = await Str.get_string('queuemodaltitle', 'block_dixeo_modulegen');

            this.queueModal = await Modal.create({
                title: modalTitle,
                body: '',
                large: true,
                show: true,
                isVerticallyCentered: true,
                removeOnClose: true,
                buttons: {
                    cancel: await Str.get_string('closebuttontitle', 'moodle')
                }
            });

            this.updateQueueList();
        },

        /**
         * Update the queue list in the modal.
         *
         * @param {Object} data - Optional pre-fetched queue data to avoid duplicate API calls.
         */
        updateQueueList: function(data = null) {
            if (!this.queueModal) {
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

                // Update stats from response.
                if (data.stats) {
                    this.stats = data.stats;
                    this.stats.hasqueued = data.stats.queued > 0;
                    this.stats.hasprocessing = data.stats.processing > 0;
                    this.stats.hascompleted = data.stats.completed > 0;
                }

                context.stats = this.stats;
                context.activeFilter = this.activeFilter;

                // Track scroll position.
                let scrollPosition = 0;
                let taskList = $('.queue-container .task-list');
                if (taskList.length) {
                    scrollPosition = taskList.scrollTop();
                }

                const html = await Templates.render('block_dixeo_modulegen/queue', context);
                this.queueModal.setBody(html);

                // Restore scroll position.
                taskList = $('.queue-container .task-list');
                if (taskList.length) {
                    setTimeout(() => {
                        requestAnimationFrame(() => {
                            taskList.scrollTop(scrollPosition);
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
         * Add filtering listeners to the queue modal.
         */
        addFilteringListeners: function() {
            if (!this.queueModal) {
                return;
            }

            const queueContainer = document.querySelector('.modal .queue-container');
            if (!queueContainer || queueContainer.dataset.listenerAttached === 'true') {
                return;
            }

            queueContainer.dataset.listenerAttached = 'true';

            queueContainer.addEventListener('click', (event) => {
                const stat = event.target.closest('.stats-container .stat');
                if (!stat) {
                    return;
                }

                let filter = stat.getAttribute('data-filter') || '';
                if (this.activeFilter === filter || filter === '') {
                    filter = 'all';
                }

                this.activeFilter = filter;
                queueContainer.setAttribute('data-filter', filter);
            });
        },

        /**
         * Add action button listeners to the queue modal.
         */
        addActionListeners: function() {
            if (!this.queueModal) {
                return;
            }

            const queueContainer = document.querySelector('.modal .queue-container');
            if (!queueContainer) {
                return;
            }

            const cancelButtons = queueContainer.querySelectorAll('.task-item .cancel-task-button');
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
        },

        /**
         * Update elapsed time display for processing tasks.
         */
        updateElapsedTime: function() {
            const processingTasks = $('.queue-container .task-item[data-status="1"]');
            processingTasks.each((index, task) => {
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
    };
});
