/**
 * Centralized job lifecycle manager for module generation.
 *
 * This module is the SINGLE OWNER of:
 * - Job submission
 * - Queue polling
 * - Job status polling
 * - Module creation from completed jobs
 * - Task status updates
 *
 * Other modules (ai_action.js, queue_status.js) should use this manager
 * and listen to events rather than polling directly.
 *
 * Events dispatched:
 * - job-queued: {queueId, status} - Job submitted and queued
 * - job-processing: {queueId, jobId} - Job started processing
 * - job-completed: {queueId, cmid, sectionNumber} - Module created successfully
 * - job-failed: {queueId, error} - Job failed
 *
 * @module     block_dixeo_modulegen/job_manager
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @author     Pierre FACQ <pierre.facq@edunao.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([
    'core/ajax'
], function(Ajax) {
    'use strict';

    /** @var {number} Initial delay before first job poll (AI generation takes time). */
    const INITIAL_JOB_POLL_DELAY_MS = 30000;

    /** @var {number} Polling interval for job status after initial delay. */
    const JOB_POLL_INTERVAL_MS = 5000;

    /** @var {number} Polling interval for queue status. */
    const QUEUE_POLL_INTERVAL_MS = 5000;

    /** @var {number} Maximum polling attempts before timeout (~10 min at 5s intervals). */
    const MAX_POLL_ATTEMPTS = 120;

    /**
     * Job state object structure.
     * @typedef {Object} JobState
     * @property {string|null} jobId - The Dixeo job UUID (null if queued).
     * @property {string} status - Current status: queued, processing, completed, failed.
     * @property {number} attempts - Number of polling attempts.
     * @property {Object} args - Original submission arguments.
     * @property {number|null} timeoutId - Active setTimeout ID for polling.
     */

    /** @var {Map<number, JobState>} activeJobs - Map of queueId to job state. */
    const activeJobs = new Map();

    /** @var {number|null} courseId - The current course ID. */
    let courseId = null;

    /** @var {boolean} initialized - Whether the manager has been initialized. */
    let initialized = false;

    /** @var {number|null} queuePollTimeoutId - Active queue polling timeout. */
    let queuePollTimeoutId = null;

    /** @var {Object|null} lastQueueData - Cached queue status data. */
    let lastQueueData = null;

    /** @var {number} lastQueueFetchTime - Timestamp of last queue fetch. */
    let lastQueueFetchTime = 0;

    /** @var {Promise|null} pendingQueueFetch - In-flight queue fetch promise. */
    let pendingQueueFetch = null;

    /** @var {number} QUEUE_CACHE_TTL_MS - Cache validity duration (2 seconds). */
    const QUEUE_CACHE_TTL_MS = 2000;

    /** @var {boolean} visibilityListenerAttached - Whether the visibility change listener is attached. */
    let visibilityListenerAttached = false;

    /**
     * Handle visibility change events.
     *
     * When the browser tab becomes visible again after being hidden (e.g., user switched tabs),
     * immediately resume polling for any active jobs. This handles browser tab suspension
     * where timers are throttled or paused while the tab is inactive.
     */
    const handleVisibilityChange = () => {
        if (document.visibilityState !== 'visible') {
            return;
        }

        // Invalidate cache so next fetch gets fresh data.
        lastQueueFetchTime = 0;

        // Resume polling for any processing jobs immediately.
        activeJobs.forEach((job, queueId) => {
            if (job.status === 'processing' && job.jobId) {
                // Clear any pending timeout and poll immediately.
                if (job.timeoutId) {
                    clearTimeout(job.timeoutId);
                    job.timeoutId = null;
                }
                pollJobStatus(queueId);
            }
        });

        // Resume queue polling if we have queued jobs.
        let hasQueuedJobs = false;
        activeJobs.forEach((job) => {
            if (job.status === 'queued') {
                hasQueuedJobs = true;
            }
        });

        if (hasQueuedJobs) {
            if (queuePollTimeoutId) {
                clearTimeout(queuePollTimeoutId);
                queuePollTimeoutId = null;
            }
            pollQueueStatus();
        }
    };

    /**
     * Dispatch a custom event with job data.
     *
     * @param {string} eventName - The event name (without 'job-' prefix).
     * @param {Object} detail - Event detail data.
     */
    const dispatchJobEvent = (eventName, detail) => {
        document.dispatchEvent(new CustomEvent('job-' + eventName, {detail: detail}));
    };

    /**
     * Update a task status via the API.
     *
     * @param {number} queueId - The queue record ID.
     * @param {string} action - The action: complete, fail, or cancel.
     * @param {number} cmid - The created module ID (for complete).
     * @param {string} errorMsg - The error message (for fail).
     * @returns {Promise} Resolves when update completes.
     */
    const updateTask = (queueId, action, cmid, errorMsg) => {
        if (!queueId) {
            return Promise.resolve();
        }

        return Ajax.call([{
            methodname: 'block_dixeo_modulegen_update_task',
            args: {
                queue_id: queueId,
                action: action,
                cmid: cmid || 0,
                error: errorMsg || ''
            }
        }])[0].catch(() => {
            // Silently ignore - primary operation already handled.
        });
    };

    /**
     * Delete a task (remove from queue or from display).
     *
     * @param {number} queueId - The queue record ID.
     * @returns {Promise<Object>} Resolves with {success, message}.
     */
    const deleteTask = (queueId) => {
        if (!queueId) {
            return Promise.reject(new Error('Queue ID required'));
        }
        activeJobs.delete(queueId);
        return Ajax.call([{
            methodname: 'block_dixeo_modulegen_delete_task',
            args: {queue_id: queueId}
        }])[0].then((result) => {
            if (!result.success) {
                throw new Error(result.message || 'Failed to remove task');
            }
            return result;
        });
    };

    /**
     * Create the module from a completed job.
     *
     * @param {string} jobId - The completed job UUID.
     * @param {number} queueId - The queue record ID.
     * @param {Object} args - The original submission arguments.
     * @returns {Promise<{cmid: number}>} Resolves with the created module ID.
     */
    const createModuleFromJob = (jobId, queueId, args) => {
        return Ajax.call([{
            methodname: 'local_dixeo_create_module_from_job',
            args: {
                job_id: jobId,
                courseid: args.courseid,
                sectionnumber: args.sectionnumber,
                beforemod: args.beforemod || 0
            }
        }])[0].then((result) => {
            if (!result.success) {
                const errorMsg = result.error_message || 'Failed to create module';
                updateTask(queueId, 'fail', 0, errorMsg);
                throw new Error(errorMsg);
            }

            // Mark complete and potentially start next job.
            updateTask(queueId, 'complete', result.cmid, '');
            return {cmid: result.cmid};
        });
    };

    /**
     * Poll job status until completion.
     *
     * @param {number} queueId - The queue record ID.
     */
    const pollJobStatus = (queueId) => {
        const job = activeJobs.get(queueId);
        if (!job || !job.jobId) {
            return;
        }

        job.attempts++;

        if (job.attempts > MAX_POLL_ATTEMPTS) {
            job.status = 'failed';
            updateTask(queueId, 'fail', 0, 'Generation timed out');
            dispatchJobEvent('failed', {queueId: queueId, error: 'Generation timed out'});
            activeJobs.delete(queueId);
            return;
        }

        Ajax.call([{
            methodname: 'local_dixeo_get_job_status',
            args: {job_id: job.jobId}
        }])[0].then((status) => {
            // Job may have been cancelled while polling.
            if (!activeJobs.has(queueId)) {
                return;
            }

            if (status.status === 'completed') {
                createModuleFromJob(job.jobId, queueId, job.args)
                    .then((result) => {
                        job.status = 'completed';
                        dispatchJobEvent('completed', {
                            queueId: queueId,
                            cmid: result.cmid,
                            sectionNumber: job.args.sectionnumber
                        });
                        activeJobs.delete(queueId);
                    })
                    .catch((error) => {
                        job.status = 'failed';
                        dispatchJobEvent('failed', {queueId: queueId, error: error.message});
                        activeJobs.delete(queueId);
                    });
                return;
            }

            if (status.status === 'failed') {
                const errorMsg = status.error?.detail || 'Generation failed';
                job.status = 'failed';
                updateTask(queueId, 'fail', 0, errorMsg);
                dispatchJobEvent('failed', {queueId: queueId, error: errorMsg});
                activeJobs.delete(queueId);
                return;
            }

            // Still processing - schedule next poll.
            job.timeoutId = setTimeout(() => pollJobStatus(queueId), JOB_POLL_INTERVAL_MS);

        }).catch((error) => {
            job.status = 'failed';
            updateTask(queueId, 'fail', 0, error.message || 'Polling error');
            dispatchJobEvent('failed', {queueId: queueId, error: error.message});
            activeJobs.delete(queueId);
        });
    };

    /**
     * Start job polling with initial delay.
     *
     * @param {number} queueId - The queue record ID.
     * @param {boolean} immediate - If true, start polling immediately (for resumed jobs).
     */
    const startJobPolling = (queueId, immediate = false) => {
        const job = activeJobs.get(queueId);
        if (!job) {
            return;
        }

        const delay = immediate ? 0 : INITIAL_JOB_POLL_DELAY_MS;
        job.timeoutId = setTimeout(() => pollJobStatus(queueId), delay);
    };

    /**
     * Fetch queue status with caching and deduplication.
     * This is the single point for all queue status API calls.
     *
     * @param {boolean} forceRefresh - If true, bypass cache.
     * @returns {Promise<Object>} The queue status data.
     */
    const fetchQueueStatus = (forceRefresh = false) => {
        if (!courseId) {
            return Promise.resolve({tasks: [], stats: {queued: 0, processing: 0, completed: 0}});
        }

        const now = Date.now();

        // Return cached data if still valid.
        if (!forceRefresh && lastQueueData && (now - lastQueueFetchTime) < QUEUE_CACHE_TTL_MS) {
            return Promise.resolve(lastQueueData);
        }

        // Return pending request if one is in flight.
        if (pendingQueueFetch) {
            return pendingQueueFetch;
        }

        // Make new request.
        pendingQueueFetch = Ajax.call([{
            methodname: 'block_dixeo_modulegen_get_queue_status',
            args: {courseid: courseId}
        }])[0].then((data) => {
            lastQueueData = data;
            lastQueueFetchTime = Date.now();
            pendingQueueFetch = null;

            // Dispatch event so UI modules can update.
            dispatchJobEvent('queue-data', {data: data});

            return data;
        }).catch((error) => {
            pendingQueueFetch = null;
            throw error;
        });

        return pendingQueueFetch;
    };

    /**
     * Poll queue status to track job progression.
     * This handles jobs transitioning from queued to processing.
     */
    const pollQueueStatus = () => {
        if (!courseId) {
            return;
        }

        // Check if we have any jobs in 'queued' state that need monitoring.
        let hasQueuedJobs = false;
        activeJobs.forEach((job) => {
            if (job.status === 'queued') {
                hasQueuedJobs = true;
            }
        });

        if (!hasQueuedJobs) {
            queuePollTimeoutId = null;
            return;
        }

        fetchQueueStatus(true).then((data) => {
            if (!data.tasks || !Array.isArray(data.tasks)) {
                return;
            }

            // Check each of our tracked queued jobs.
            activeJobs.forEach((job, queueId) => {
                if (job.status !== 'queued') {
                    return;
                }

                const task = data.tasks.find(t => t.id === queueId);
                if (!task) {
                    // Task not found - may have been deleted.
                    activeJobs.delete(queueId);
                    return;
                }

                const status = parseInt(task.status);

                // STATUS_PROCESSING = 1
                if (status === 1 && task.job_id) {
                    job.status = 'processing';
                    job.jobId = task.job_id;
                    job.attempts = 0;
                    dispatchJobEvent('processing', {queueId: queueId, jobId: task.job_id});
                    startJobPolling(queueId, false);
                    return;
                }

                // STATUS_COMPLETED = 2 (completed by another client/cron).
                if (status === 2) {
                    job.status = 'completed';
                    dispatchJobEvent('completed', {
                        queueId: queueId,
                        cmid: task.cmid || 0,
                        sectionNumber: job.args.sectionnumber
                    });
                    activeJobs.delete(queueId);
                    return;
                }

                // STATUS_FAILED = 3, STATUS_CANCELLED = 4
                if (status === 3 || status === 4) {
                    job.status = 'failed';
                    const errorMsg = status === 4 ? 'Task was cancelled' : 'Task failed';
                    dispatchJobEvent('failed', {queueId: queueId, error: errorMsg});
                    activeJobs.delete(queueId);
                }
            });

            // Continue polling if we still have queued jobs.
            let stillHasQueued = false;
            activeJobs.forEach((job) => {
                if (job.status === 'queued') {
                    stillHasQueued = true;
                }
            });

            if (stillHasQueued) {
                queuePollTimeoutId = setTimeout(pollQueueStatus, QUEUE_POLL_INTERVAL_MS);
            } else {
                queuePollTimeoutId = null;
            }

        }).catch(() => {
            // Retry on error.
            queuePollTimeoutId = setTimeout(pollQueueStatus, QUEUE_POLL_INTERVAL_MS);
        });
    };

    /**
     * Start queue polling if not already running.
     */
    const ensureQueuePolling = () => {
        if (queuePollTimeoutId === null) {
            pollQueueStatus();
        }
    };

    /**
     * Resume polling for PROCESSING jobs found on page load.
     * This handles browser refresh during an active generation.
     * Uses task record fields (instructions, sectionnumber, beforemod) for job args.
     *
     * @param {Array} tasks - Array of task objects from get_queue_status API.
     */
    const resumeProcessingJobs = (tasks) => {
        if (!tasks || !Array.isArray(tasks)) {
            return;
        }

        tasks.forEach((task) => {
            const status = parseInt(task.status);
            const queueId = task.id;

            // Only resume jobs we're not already tracking.
            if (activeJobs.has(queueId)) {
                return;
            }

            // STATUS_PROCESSING = 1
            if (status === 1 && task.job_id) {
                activeJobs.set(queueId, {
                    jobId: task.job_id,
                    status: 'processing',
                    attempts: 0,
                    args: {
                        courseid: courseId,
                        modulename: task.modulename,
                        instructions: task.instructions || '',
                        sectionnumber: task.sectionnumber || 0,
                        beforemod: task.beforemod || 0
                    },
                    timeoutId: null
                });

                dispatchJobEvent('processing', {queueId: queueId, jobId: task.job_id});
                // Resume immediately - job is already in progress.
                startJobPolling(queueId, true);
            }

            // STATUS_PENDING = 0
            if (status === 0) {
                activeJobs.set(queueId, {
                    jobId: null,
                    status: 'queued',
                    attempts: 0,
                    args: {
                        courseid: courseId,
                        modulename: task.modulename,
                        instructions: task.instructions || '',
                        sectionnumber: task.sectionnumber || 0,
                        beforemod: task.beforemod || 0
                    },
                    timeoutId: null
                });

                ensureQueuePolling();
            }
        });
    };

    return {
        /**
         * Initialize the job manager.
         *
         * Must be called before using any other methods.
         * Fetches current queue state and resumes polling for active jobs.
         * Retries up to 3 times on failure.
         *
         * @param {number} cid - The course ID.
         * @returns {Promise} Resolves when initialization is complete.
         */
        init: function(cid) {
            if (initialized && courseId === cid) {
                return Promise.resolve();
            }

            courseId = cid;

            const maxRetries = 3;
            const retryDelay = 2000;

            // Attach visibility change listener to handle browser tab suspension.
            if (!visibilityListenerAttached) {
                document.addEventListener('visibilitychange', handleVisibilityChange);
                visibilityListenerAttached = true;
            }

            const attemptInit = (attempt) => {
                return fetchQueueStatus(true).then((data) => {
                    initialized = true;
                    if (data.tasks) {
                        resumeProcessingJobs(data.tasks);
                    }
                }).catch((error) => {
                    if (attempt < maxRetries) {
                        // Retry after delay.
                        return new Promise((resolve) => {
                            setTimeout(() => {
                                resolve(attemptInit(attempt + 1));
                            }, retryDelay);
                        });
                    }
                    // Max retries reached - mark as initialized anyway so new jobs work.
                    initialized = true;
                    // eslint-disable-next-line no-console
                    console.warn('JobManager init failed after retries:', error);
                });
            };

            return attemptInit(1);
        },

        /**
         * Get queue status data.
         *
         * Uses cached data if available and fresh, otherwise fetches from API.
         * This is the single point for queue status access - UI modules should
         * use this instead of direct Ajax calls.
         *
         * @param {boolean} forceRefresh - If true, bypass cache and fetch fresh data.
         * @returns {Promise<Object>} The queue status data with tasks and stats.
         */
        getQueueStatus: function(forceRefresh = false) {
            return fetchQueueStatus(forceRefresh);
        },

        /**
         * Submit a new job for module generation.
         *
         * @param {Object} args - Submission arguments.
         * @param {number} args.courseid - The course ID.
         * @param {string} args.modulename - The module type (page, quiz, etc.).
         * @param {string} args.instructions - User instructions for generation.
         * @param {number} args.sectionnumber - Target section number.
         * @param {number} args.beforemod - Module ID to insert before (0 for end).
         * @returns {Promise<{queueId: number, status: string}>} Resolves with queue info.
         */
        submitJob: function(args) {
            return Ajax.call([{
                methodname: 'block_dixeo_modulegen_submit_generation',
                args: args
            }])[0].then((data) => {
                if (!data.success) {
                    throw new Error(data.error?.message || 'Failed to submit generation');
                }

                const queueId = data.queue_id;
                const jobId = data.job_id || null;
                const status = data.status;

                // Track this job.
                activeJobs.set(queueId, {
                    jobId: jobId,
                    status: status,
                    attempts: 0,
                    args: args,
                    timeoutId: null
                });

                // Dispatch appropriate event.
                if (status === 'processing' && jobId) {
                    dispatchJobEvent('processing', {queueId: queueId, jobId: jobId});
                    startJobPolling(queueId, false);
                } else {
                    dispatchJobEvent('queued', {queueId: queueId, status: status});
                    ensureQueuePolling();
                }

                return {queueId: queueId, status: status};
            });
        },

        /**
         * Cancel an active job.
         *
         * @param {number} queueId - The queue record ID.
         * @returns {Promise} Resolves when cancellation is complete.
         */
        cancelJob: function(queueId) {
            const job = activeJobs.get(queueId);

            if (job && job.timeoutId) {
                clearTimeout(job.timeoutId);
            }

            activeJobs.delete(queueId);

            return updateTask(queueId, 'cancel', 0, '');
        },

        /**
         * Remove a task from the queue (delete from database).
         * Allowed for queued, completed, failed, cancelled. Not for processing.
         *
         * @param {number} queueId - The queue record ID.
         * @returns {Promise<Object>} Resolves with {success, message}.
         */
        removeTask: function(queueId) {
            return deleteTask(queueId);
        },

        /**
         * Get all currently tracked jobs.
         *
         * @returns {Map<number, JobState>} Map of queueId to job state.
         */
        getActiveJobs: function() {
            return new Map(activeJobs);
        },

        /**
         * Check if a job is being tracked.
         *
         * @param {number} queueId - The queue record ID.
         * @returns {boolean} True if the job is being tracked.
         */
        isTracking: function(queueId) {
            return activeJobs.has(queueId);
        },

        /**
         * Get the course ID.
         *
         * @returns {number|null} The course ID or null if not initialized.
         */
        getCourseId: function() {
            return courseId;
        }
    };
});
