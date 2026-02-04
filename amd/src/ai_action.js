/**
 * AI action handler for module generation.
 *
 * Handles the generation modal form submission and UI state. This module is UI-only:
 * - Modal display and form handling
 * - Form validation and state management
 * - Prevents modal closing during generation
 * - Delegates job submission to job_manager.js
 * - Refreshes course sections when modules are created
 *
 * @module     block_dixeo_modulegen/ai_action
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @author     Pierre FACQ <pierre.facq@edunao.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([
    'jquery',
    'core/notification',
    'core/str',
    'core/local/aria/focuslock',
    'block_dixeo_modulegen/job_manager'
], function($, Notification, Str, FocusLock, JobManager) {
    'use strict';

    let instructionsTextarea = null;
    let isModalClosingDisabled = false;
    let initialized = false;
    /** @type {Object|null} Set before opening modal for retry; consumed in handleModalShow. */
    let retryContext = null;

    /**
     * Refresh the course section to show the newly created module.
     *
     * Uses Moodle's reactive course editor if available (Moodle 4.x+).
     *
     * @param {number} sectionNumber - The section number to refresh.
     */
    const refreshCourseSection = (sectionNumber) => {
        require(['core_courseformat/courseeditor'], function(CourseEditor) {
            try {
                const courseEditor = CourseEditor.getCurrentCourseEditor();
                if (!courseEditor) {
                    return;
                }

                // Find section ID from section number in the state.
                const state = courseEditor.state;
                let sectionId = null;

                state.section.forEach(function(section) {
                    if (section.number === sectionNumber) {
                        sectionId = section.id;
                    }
                });

                if (sectionId) {
                    // Dispatch sectionState to refresh the section content.
                    courseEditor.dispatch('sectionState', [sectionId]);
                }
            } catch (e) {
                // Silently ignore - user can manually refresh.
            }
        });
    };

    return {
        init: function() {
            // Prevent double initialization (loaded by both PHP and modal template).
            if (initialized) {
                return;
            }

            const generationModal = document.getElementById('generationModal');
            if (!generationModal) {
                return;
            }

            initialized = true;
            isModalClosingDisabled = false;

            // Move modal to body for proper z-index stacking.
            document.body.appendChild(generationModal);

            // Prevent closing during generation.
            $(generationModal).on('hide.bs.modal', function(event) {
                if (isModalClosingDisabled) {
                    event.preventDefault();
                }
            });

            $(generationModal).on('show.bs.modal', this.handleModalShow.bind(this));

            document.addEventListener('generationModalRetry', (event) => {
                if (event.detail) {
                    retryContext = event.detail;
                    $(generationModal).modal('show');
                }
            });

            // Listen for job completion to refresh course section.
            document.addEventListener('job-completed', (event) => {
                const detail = event.detail;
                if (detail && typeof detail.sectionNumber !== 'undefined') {
                    refreshCourseSection(detail.sectionNumber);
                }
            });
        },

        /**
         * Handle modal show event - set up form data and handlers.
         *
         * @param {Event} event - The show.bs.modal event.
         */
        handleModalShow: function(event) {
            const generationModal = document.getElementById('generationModal');
            FocusLock.untrapFocus();
            isModalClosingDisabled = false;

            const form = generationModal.querySelector('form');
            const closeButton = generationModal.querySelector('.close');
            const generateButton = generationModal.querySelector('#generate_button');

            const titleElement = generationModal.querySelector('.modal-title');
            const beforeModInput = generationModal.querySelector('input[name="beforemod"]');
            const modulenameInput = generationModal.querySelector('input[name="modulename"]');
            const sectionnumberInput = generationModal.querySelector('input[name="sectionnumber"]');
            const courseidInput = generationModal.querySelector('input[name="courseid"]');
            const retryTaskIdInput = generationModal.querySelector('input[name="retry_task_id"]');
            instructionsTextarea = generationModal.querySelector('#instructions');

            if (retryContext) {
                // Open for retry: prefill from failed task.
                Str.get_string('retrygeneration', 'block_dixeo_modulegen').then((s) => {
                    if (titleElement) {
                        titleElement.textContent = s;
                    }
                });
                if (beforeModInput) {
                    beforeModInput.value = retryContext.beforemod || '0';
                }
                if (modulenameInput) {
                    modulenameInput.value = retryContext.modulename || '';
                }
                if (sectionnumberInput) {
                    sectionnumberInput.value = retryContext.sectionnumber || '0';
                }
                if (courseidInput) {
                    courseidInput.value = retryContext.courseid || '';
                }
                if (retryTaskIdInput) {
                    retryTaskIdInput.value = retryContext.taskId || '';
                }
                if (instructionsTextarea) {
                    instructionsTextarea.value = retryContext.instructions || '';
                    instructionsTextarea.readOnly = false;
                    this.initializeAutoResize(instructionsTextarea);
                    instructionsTextarea.addEventListener('keydown', function(ev) {
                        if (ev.key === 'Enter' && !ev.shiftKey) {
                            ev.preventDefault();
                            generateButton.click();
                        }
                    });
                }
                retryContext = null;
            } else {
                // Normal open from activity chooser button.
                const button = event.relatedTarget;
                if (retryTaskIdInput) {
                    retryTaskIdInput.value = '';
                }
                if (button) {
                    const modalTitle = button.getAttribute('data-modal-title');
                    const moduleName = button.getAttribute('data-module-name');
                    const sectionNumber = button.getAttribute('data-section-number') ?? 0;
                    const beforeMod = button.getAttribute('data-before-mod');

                    if (titleElement) {
                        titleElement.textContent = modalTitle;
                    }
                    if (beforeModInput) {
                        beforeModInput.value = beforeMod;
                    }
                    if (modulenameInput) {
                        modulenameInput.value = moduleName;
                    }
                    if (sectionnumberInput) {
                        sectionnumberInput.value = sectionNumber;
                    }
                }

                if (instructionsTextarea) {
                    instructionsTextarea.value = '';
                    instructionsTextarea.readOnly = false;
                    this.initializeAutoResize(instructionsTextarea);
                    instructionsTextarea.addEventListener('keydown', function(ev) {
                        if (ev.key === 'Enter' && !ev.shiftKey) {
                            ev.preventDefault();
                            generateButton.click();
                        }
                    });
                }
            }

            if (closeButton) {
                closeButton.classList.remove('disabled');
                closeButton.style.pointerEvents = 'auto';
            }

            if (form) {
                $(form).off('submit');
                $(form).on('submit', (submitEvent) => {
                    this.handleGenerationForm(submitEvent, form);
                });
            }

            document.dispatchEvent(new Event('generationModalReady'));
        },

        /**
         * Handle form submission for module generation.
         *
         * @param {Event} event - The submit event.
         * @param {HTMLFormElement} form - The form element.
         */
        handleGenerationForm: function(event, form) {
            event.preventDefault();

            const closeButton = form.querySelector('.close');
            const generateButton = form.querySelector('#generate_button');
            const instructionsTextarea = form.querySelector('#instructions');
            const retryTaskIdInput = form.querySelector('input[name="retry_task_id"]');

            if (!generateButton || !instructionsTextarea) {
                Notification.exception({message: 'Required elements not found.'});
                return;
            }

            // Lock UI during submission.
            generateButton.disabled = true;
            instructionsTextarea.readOnly = true;
            isModalClosingDisabled = true;

            if (closeButton) {
                closeButton.classList.add('disabled');
                closeButton.style.pointerEvents = 'none';
            }

            const args = {
                courseid: parseInt(form.courseid.value, 10),
                modulename: form.modulename.value,
                instructions: form.instructions.value,
                sectionnumber: parseInt(form.sectionnumber.value, 10),
                beforemod: parseInt(form.beforemod.value, 10),
            };

            const doSubmit = () => {
                JobManager.submitJob(args)
                    .then(() => {
                        this.resetFormState(form, closeButton, generateButton, instructionsTextarea, true);
                        if (retryTaskIdInput) {
                            retryTaskIdInput.value = '';
                        }
                        document.dispatchEvent(new Event('newTaskAdded'));
                    })
                    .catch((error) => {
                        this.resetFormState(form, closeButton, generateButton, instructionsTextarea, false);
                        Str.get_string('error_title', 'block_dixeo_modulegen').then((title) => {
                            Notification.alert(title, error.message || String(error));
                        });
                    });
            };

            // Retry: delete the failed task then create a new one with the form data.
            const retryTaskId = retryTaskIdInput ? retryTaskIdInput.value.trim() : '';
            if (retryTaskId) {
                JobManager.removeTask(parseInt(retryTaskId, 10))
                    .then(() => {
                        if (retryTaskIdInput) {
                            retryTaskIdInput.value = '';
                        }
                        doSubmit();
                    })
                    .catch((error) => {
                        this.resetFormState(form, closeButton, generateButton, instructionsTextarea, false);
                        Str.get_string('error_title', 'block_dixeo_modulegen').then((title) => {
                            Notification.alert(title, error.message || String(error));
                        });
                    });
            } else {
                doSubmit();
            }
        },

        /**
         * Reset form to initial state after success or error.
         *
         * On success: re-enables controls, clears instructions, closes modal.
         * On error: re-enables controls only so the user can edit and retry without losing input.
         *
         * @param {HTMLFormElement} form - The form element.
         * @param {Element} closeButton - The close button.
         * @param {Element} generateButton - The generate button.
         * @param {Element} textarea - The instructions textarea.
         * @param {boolean} [closeModal=true] - If true, close the modal (success path); if false, keep modal open (error path).
         */
        resetFormState: function(form, closeButton, generateButton, textarea, closeModal = true) {
            generateButton.disabled = false;
            textarea.readOnly = false;
            if (closeModal) {
                textarea.value = '';
            }
            isModalClosingDisabled = false;

            if (closeButton) {
                closeButton.classList.remove('disabled');
                closeButton.style.pointerEvents = 'auto';
                if (closeModal) {
                    const span = closeButton.querySelector('span');
                    if (span) {
                        span.click();
                    }
                }
            }
        },

        /**
         * Initialize auto-resizing for textarea.
         *
         * @param {HTMLTextAreaElement} textarea - The textarea element.
         */
        initializeAutoResize: function(textarea) {
            const maxLines = 9;
            const minLines = 3;
            const computedStyle = getComputedStyle(textarea);
            const lineHeight = parseInt(computedStyle.lineHeight);

            const minHeight = lineHeight * minLines;
            const maxHeight = lineHeight * maxLines;

            const adjustHeight = function() {
                textarea.style.height = 'auto';
                let newHeight = textarea.scrollHeight;

                if (newHeight < minHeight) {
                    newHeight = minHeight;
                }

                if (newHeight <= maxHeight) {
                    textarea.style.height = newHeight + 'px';
                    textarea.style.overflowY = 'hidden';
                } else {
                    textarea.style.height = maxHeight + 'px';
                    textarea.style.overflowY = 'scroll';
                }
            };

            adjustHeight();
            textarea.removeEventListener('input', adjustHeight);
            textarea.addEventListener('input', adjustHeight);
        }
    };
});
