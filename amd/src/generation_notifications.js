/**
 * In-page notifications for module generation and manual upload completion.
 *
 * @module     block_dixeo_modulegen/generation_notifications
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([
    'core/notification',
    'core/str'
], function(Notification, Str) {
    'use strict';

    /** @type {number|null} */
    let courseId = null;

    /** @type {boolean} */
    let initialized = false;

    /**
     * Whether the current page is course content (view, section, or module).
     *
     * @returns {boolean}
     */
    const isOnCourseContentPage = () => {
        const path = window.location.pathname;
        if (path.includes('/course/view.php') || path.includes('/course/section.php')) {
            return true;
        }
        return document.body && document.body.classList.contains('path-mod');
    };

    /**
     * Whether a toast should be shown for the current page context.
     *
     * @param {Object|null} detail Event detail.
     * @returns {boolean}
     */
    const shouldNotify = (detail) => {
        if (!detail) {
            return false;
        }

        const eventCourseId = parseInt(detail.courseid, 10);
        if (!courseId || Number.isNaN(eventCourseId) || eventCourseId !== courseId) {
            return false;
        }

        const pageCourseId = parseInt(M.cfg.courseId, 10);
        if (Number.isNaN(pageCourseId) || pageCourseId !== courseId) {
            return false;
        }

        return isOnCourseContentPage();
    };

    /**
     * @param {string} type success|error
     * @param {string} message HTML message.
     */
    const showNotification = (type, message) => {
        Notification.addNotification({
            type: type,
            message: message,
        });
    };

    /**
     * @param {string} stringKey Lang string key.
     * @param {Object} params String params.
     * @returns {Promise<void>}
     */
    const showSuccessFromString = (stringKey, params) => {
        return Str.get_string(stringKey, 'block_dixeo_modulegen', params).then((message) => {
            showNotification('success', message);
        }).catch(() => {
            // Lang string missing or fetch failed — skip silently.
        });
    };

    /**
     * @param {CustomEvent} event job-completed event.
     */
    const handleJobCompleted = (event) => {
        const detail = event.detail || {};
        if (detail.source === 'manual') {
            return;
        }
        if (!shouldNotify(detail)) {
            return;
        }
        const mode = detail.queuemode || 'generate';
        if (mode === 'fill' || mode === 'manual') {
            return;
        }

        const name = detail.displaytitle || detail.modulename || '';
        const link = detail.link || '';
        if (!link || !name) {
            return;
        }

        showSuccessFromString('task_completed_success', {
            link: link,
            name: name,
        });
    };

    /**
     * @param {CustomEvent} event job-failed event.
     */
    const handleJobFailed = (event) => {
        const detail = event.detail || {};
        if (!shouldNotify(detail)) {
            return;
        }
        const mode = detail.queuemode || 'generate';
        if (mode === 'fill' || mode === 'manual') {
            return;
        }

        const error = detail.error || '';
        Str.get_string('task_failed', 'block_dixeo_modulegen', {error: error}).then((message) => {
            showNotification('error', message);
        }).catch(() => {
            // Lang string missing or fetch failed — skip silently.
        });
    };

    return {
        /**
         * Listen for generate job completion/failure toasts.
         *
         * @param {number} cid Course ID for the block context.
         */
        init: function(cid) {
            const id = parseInt(cid, 10);
            if (initialized && courseId === id) {
                return;
            }

            courseId = id;
            initialized = true;

            document.addEventListener('job-completed', handleJobCompleted);
            document.addEventListener('job-failed', handleJobFailed);
        },

        /**
         * Success toast after manual upload (includes sync started message).
         *
         * @param {Object} payload
         * @param {string} payload.link Activity view URL.
         * @param {string} payload.name Activity display name.
         * @param {number} payload.courseid Course ID.
         * @returns {Promise<void>}
         */
        showManualUploadSuccess: function(payload) {
            if (!shouldNotify(payload)) {
                return Promise.resolve();
            }
            return showSuccessFromString('manual_upload_success', {
                link: payload.link || '',
                name: payload.name || '',
            });
        },

        /**
         * Error toast for manual upload or validation failures.
         *
         * @param {string} message Error message.
         */
        showError: function(message) {
            if (!message) {
                return;
            }
            showNotification('error', message);
        },
    };
});
