/**
 * Refresh course section activity lists after a module is created.
 *
 * Shared by AI job completion and manual upload flows.
 *
 * @module     block_dixeo_modulegen/course_section_refresh
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define(['core_courseformat/courseeditor'], function(CourseEditor) {
    'use strict';

    /** Activities indexed by the course editor but missing native draggable after a partial refresh. */
    const SELECTOR_CM_NEEDS_DRAG_SYNC = 'li.activity[data-for="cmitem"][data-indexed]:not([draggable="true"])';

    /**
     * @returns {Promise<void>} Resolves after the next paint.
     */
    const nextAnimationFrame = () => new Promise((resolve) => {
        requestAnimationFrame(resolve);
    });

    /**
     * Resolve reactive section id from display section number.
     *
     * @param {Object} courseEditor
     * @param {number|string} sectionNumber
     * @returns {number|null}
     */
    const getSectionIdByNumber = (courseEditor, sectionNumber) => {
        const num = typeof sectionNumber === 'number' ? sectionNumber : parseInt(sectionNumber, 10);
        if (Number.isNaN(num)) {
            return null;
        }
        let sectionId = null;
        courseEditor.state.section.forEach(function(section) {
            if (section.number === sectionNumber || section.number === num) {
                sectionId = section.id;
            }
        });
        return sectionId;
    };

    /**
     * If any CM is still missing draggable after a partial update, resync the whole course editor state.
     *
     * @param {Object} courseEditor
     * @returns {Promise<void>}
     */
    const resyncCourseEditorIfCmDragIncomplete = (courseEditor) => {
        if (!document.body.classList.contains('editing')) {
            return Promise.resolve();
        }
        return nextAnimationFrame().then(function() {
            return document.querySelector(SELECTOR_CM_NEEDS_DRAG_SYNC)
                ? courseEditor.dispatch('courseState')
                : undefined;
        });
    };

    /**
     * Refresh the course section to show the newly created module.
     *
     * @param {number|string} sectionNumber
     */
    const refreshCourseSection = (sectionNumber) => {
        try {
            const courseEditor = CourseEditor.getCurrentCourseEditor();
            if (!courseEditor) {
                return;
            }

            const sectionId = getSectionIdByNumber(courseEditor, sectionNumber);
            if (!sectionId) {
                courseEditor.dispatch('courseState').catch(function() {
                    // User can refresh the page manually.
                });
                return;
            }

            courseEditor.dispatch('sectionState', [sectionId])
                .then(function() {
                    return resyncCourseEditorIfCmDragIncomplete(courseEditor);
                })
                .catch(function() {
                    // Dispatch/network errors: user can refresh the page.
                });
        } catch (e) {
            // Resolving the course editor or its state failed.
        }
    };

    /**
     * Notify listeners that a module was created (AI queue, Dixeo shell refresh, drag-drop zones).
     *
     * @param {Object} detail Event detail (cmid, sectionNumber, optional queueId).
     */
    const dispatchJobCompleted = (detail) => {
        document.dispatchEvent(new CustomEvent('job-completed', {detail: detail}));
    };

    return {
        refreshCourseSection: refreshCourseSection,
        dispatchJobCompleted: dispatchJobCompleted,
    };
});
