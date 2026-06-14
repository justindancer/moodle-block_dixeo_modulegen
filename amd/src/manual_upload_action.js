/**
 * Manual upload modal handler for SCORM and File activities.
 *
 * @module     block_dixeo_modulegen/manual_upload_action
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([
    'jquery',
    'core/str',
    'block_dixeo_modulegen/course_section_refresh',
    'block_dixeo_modulegen/job_manager',
    'block_dixeo_modulegen/generation_notifications'
], function($, Str, CourseSectionRefresh, JobManager, GenerationNotifications) {
    'use strict';

    /** @type {Object|null} Config from PHP init (upload URL, sesskey, description params). */
    let uploadConfig = null;

    /** @type {boolean} */
    let initialized = false;

    /** @type {boolean} */
    let isModalClosingDisabled = false;

    /**
     * @param {string} filename
     * @returns {string} Lowercase extension without dot, or empty string.
     */
    const getFileExtension = (filename) => {
        const base = (filename || '').split(/[/\\]/).pop() || '';
        const dot = base.lastIndexOf('.');
        if (dot <= 0) {
            return '';
        }
        return base.substring(dot + 1).toLowerCase();
    };

    /**
     * @param {File} file
     * @param {string} modtype
     * @returns {{key: string, component: string, param?: Object}|null}
     */
    const validateUploadFile = (file, modtype) => {
        if (!file) {
            return null;
        }

        if (modtype === 'scorm') {
            if (getFileExtension(file.name) !== 'zip') {
                return {key: 'manual_upload_error_invalid_scorm', component: 'block_dixeo_modulegen'};
            }
            return null;
        }

        if (modtype === 'resource') {
            const maxSize = uploadConfig && uploadConfig.maxResourceFileSize;
            if (maxSize && file.size > maxSize) {
                return {
                    key: 'manual_upload_error_file_too_large',
                    component: 'block_dixeo_modulegen',
                    param: (uploadConfig && uploadConfig.resourceDescriptionParams) || {},
                };
            }
            const extensions = (uploadConfig && uploadConfig.ragExtensions) || [];
            const ext = getFileExtension(file.name);
            if (!extensions.includes(ext)) {
                return {
                    key: 'manual_upload_error_invalid_resource',
                    component: 'block_dixeo_modulegen',
                    param: (uploadConfig && uploadConfig.resourceDescriptionParams) || {ragformats: ext},
                };
            }
            return null;
        }

        return null;
    };

    /**
     * Hide the inline error region inside the modal body.
     *
     * @param {HTMLFormElement} form
     */
    const clearModalError = (form) => {
        const errorEl = form ? form.querySelector('#manual-upload-error') : null;
        if (!errorEl) {
            return;
        }
        errorEl.textContent = '';
        errorEl.classList.add('d-none');
    };

    /**
     * Show an error inside the modal body (not as a page-level notification).
     *
     * @param {HTMLFormElement} form
     * @param {string} message
     */
    const showModalError = (form, message) => {
        if (!form || !message) {
            return;
        }
        const errorEl = form.querySelector('#manual-upload-error');
        if (!errorEl) {
            return;
        }
        errorEl.textContent = message;
        errorEl.classList.remove('d-none');
    };

    /**
     * @param {HTMLFormElement} form
     * @param {{key: string, component: string, param?: Object}} error
     * @returns {Promise<void>}
     */
    const showValidationError = async(form, error) => {
        const message = await Str.get_string(error.key, error.component, error.param || {});
        showModalError(form, message);
    };

    /**
     * Clear the file input and filename display.
     *
     * @param {HTMLFormElement} form
     */
    const clearFileSelection = (form) => {
        const fileInput = form.querySelector('#manual-upload-file');
        if (fileInput) {
            fileInput.value = '';
        }
        setSelectedFile(form, null);
    };

    /**
     * Validate then show or reject a selected file.
     *
     * @param {HTMLFormElement} form
     * @param {File|null} file
     * @returns {Promise<void>}
     */
    const validateAndSelectFile = async(form, file) => {
        if (!file) {
            clearFileSelection(form);
            clearModalError(form);
            return;
        }

        const modtypeInput = form.querySelector('#manual-upload-modtype');
        const modtype = modtypeInput ? modtypeInput.value : '';
        const error = validateUploadFile(file, modtype);
        if (error) {
            clearFileSelection(form);
            await showValidationError(form, error);
            return;
        }

        clearModalError(form);
        setSelectedFile(form, file);
    };

    /**
     * Build a file input accept attribute from extension list.
     *
     * @param {string[]} extensions
     * @returns {string}
     */
    const buildAcceptAttribute = (extensions) => {
        if (!extensions || !extensions.length) {
            return '';
        }
        return extensions.map((ext) => '.' + ext).join(',');
    };

    /**
     * Per-type modal configuration.
     *
     * @type {Object<string, Object>}
     */
    const UPLOAD_TYPES = {
        scorm: {
            modtype: 'scorm',
            accept: '.zip',
            titleComponent: 'mod_scorm',
            descriptionString: 'manual_upload_scorm_description',
            descriptionComponent: 'block_dixeo_modulegen',
        },
        resource: {
            modtype: 'resource',
            accept: '',
            titleComponent: 'mod_resource',
            descriptionString: 'manual_upload_resource_description',
            descriptionComponent: 'block_dixeo_modulegen',
        },
    };

    /**
     * Show upload-in-progress state in the modal body.
     *
     * @param {HTMLFormElement} form
     */
    const showUploadLoading = (form) => {
        const content = form.querySelector('#manual-upload-content');
        const loading = form.querySelector('#manual-upload-loading');
        const errorEl = form.querySelector('#manual-upload-error');
        const footerContent = form.querySelector('#manual-upload-footer-content');

        if (errorEl) {
            errorEl.classList.add('d-none');
        }
        if (content) {
            content.classList.add('d-none');
        }
        if (loading) {
            loading.classList.remove('d-none');
            loading.setAttribute('aria-busy', 'true');
        }
        if (footerContent) {
            footerContent.classList.add('d-none');
        }
    };

    /**
     * Restore the normal modal body after upload completes or fails.
     *
     * @param {HTMLFormElement} form
     */
    const hideUploadLoading = (form) => {
        const content = form.querySelector('#manual-upload-content');
        const loading = form.querySelector('#manual-upload-loading');
        const footerContent = form.querySelector('#manual-upload-footer-content');

        if (content) {
            content.classList.remove('d-none');
        }
        if (loading) {
            loading.classList.add('d-none');
            loading.setAttribute('aria-busy', 'false');
        }
        if (footerContent) {
            footerContent.classList.remove('d-none');
        }
    };

    /**
     * Reset the form to a clean state.
     *
     * @param {HTMLFormElement} form
     */
    const resetForm = (form) => {
        form.reset();
        clearModalError(form);
        hideUploadLoading(form);
        const filenameEl = form.querySelector('#manual-upload-filename');
        if (filenameEl) {
            filenameEl.textContent = '';
            filenameEl.classList.add('d-none');
        }
        const fileInput = form.querySelector('#manual-upload-file');
        if (fileInput) {
            fileInput.value = '';
        }
    };

    /**
     * Update selected filename display.
     *
     * @param {HTMLFormElement} form
     * @param {File|null} file
     */
    const setSelectedFile = (form, file) => {
        const filenameEl = form.querySelector('#manual-upload-filename');
        const fileInput = form.querySelector('#manual-upload-file');
        if (!filenameEl || !fileInput) {
            return;
        }
        if (!file) {
            filenameEl.textContent = '';
            filenameEl.classList.add('d-none');
            fileInput.value = '';
            return;
        }
        filenameEl.textContent = file.name;
        filenameEl.classList.remove('d-none');
    };

    /**
     * Assign a file to the hidden input via DataTransfer (supported browsers).
     *
     * @param {HTMLInputElement} fileInput
     * @param {File} file
     */
    const assignFileToInput = (fileInput, file) => {
        try {
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInput.files = dt.files;
        } catch (e) {
            // Fallback: user must pick via native dialog; drag-drop may not set files in older browsers.
        }
    };

    return {
        /**
         * Initialize manual upload modal handlers.
         *
         * @param {Object} config PHP-provided upload config.
         */
        init: function(config) {
            if (initialized) {
                return;
            }

            const modal = document.getElementById('manualUploadModal');
            if (!modal) {
                return;
            }

            uploadConfig = config || {};
            initialized = true;
            isModalClosingDisabled = false;

            document.body.appendChild(modal);

            $(modal).on('hide.bs.modal', function(event) {
                if (isModalClosingDisabled) {
                    event.preventDefault();
                }
            });

            $(modal).on('show.bs.modal', this.handleModalShow.bind(this));

            const form = modal.querySelector('form');
            if (form) {
                form.addEventListener('submit', (event) => {
                    this.handleFormSubmit(event, form);
                });
                this.bindDropzone(form);
            }
        },

        /**
         * Wire drag-and-drop and browse button on the upload zone.
         *
         * @param {HTMLFormElement} form
         */
        bindDropzone: function(form) {
            const dropzone = form.querySelector('#manual-upload-dropzone');
            const fileInput = form.querySelector('#manual-upload-file');
            const browseButton = form.querySelector('#manual-upload-browse');
            if (!dropzone || !fileInput) {
                return;
            }

            let dragEnterCounter = 0;

            dropzone.addEventListener('dragenter', (event) => {
                event.preventDefault();
                event.stopPropagation();
                dragEnterCounter++;
                dropzone.classList.add('drag-over');
            });

            dropzone.addEventListener('dragleave', (event) => {
                event.preventDefault();
                event.stopPropagation();
                dragEnterCounter--;
                if (dragEnterCounter <= 0) {
                    dragEnterCounter = 0;
                    dropzone.classList.remove('drag-over');
                }
            });

            dropzone.addEventListener('dragover', (event) => {
                event.preventDefault();
                event.stopPropagation();
            });

            dropzone.addEventListener('drop', (event) => {
                event.preventDefault();
                event.stopPropagation();
                dragEnterCounter = 0;
                dropzone.classList.remove('drag-over');
                const files = event.dataTransfer ? event.dataTransfer.files : null;
                if (!files || !files.length) {
                    return;
                }
                assignFileToInput(fileInput, files[0]);
                validateAndSelectFile(form, files[0]);
            });

            if (browseButton) {
                browseButton.addEventListener('click', () => {
                    fileInput.click();
                });
            }

            fileInput.addEventListener('change', () => {
                const file = fileInput.files && fileInput.files.length ? fileInput.files[0] : null;
                validateAndSelectFile(form, file);
            });
        },

        /**
         * Populate modal fields when opened from a chooser item.
         *
         * @param {Event} event Bootstrap show event.
         */
        handleModalShow: async function(event) {
            const modal = document.getElementById('manualUploadModal');
            const form = modal ? modal.querySelector('form') : null;
            if (!form) {
                return;
            }

            isModalClosingDisabled = false;
            resetForm(form);

            const button = event.relatedTarget;
            const uploadType = button ? button.getAttribute('data-manual-upload-type') : '';
            const typeConfig = UPLOAD_TYPES[uploadType];
            if (!typeConfig) {
                return;
            }

            const sectionNumber = button.getAttribute('data-section-number') ?? '0';
            const beforeMod = button.getAttribute('data-before-mod') ?? '0';

            const modtypeInput = form.querySelector('#manual-upload-modtype');
            const sectionInput = form.querySelector('#manual-upload-sectionnumber');
            const beforeModInput = form.querySelector('#manual-upload-beforemod');
            const fileInput = form.querySelector('#manual-upload-file');
            const descriptionEl = form.querySelector('#manual-upload-description');
            const titleEl = modal.querySelector('.modal-title');

            if (modtypeInput) {
                modtypeInput.value = typeConfig.modtype;
            }
            if (sectionInput) {
                sectionInput.value = sectionNumber;
            }
            if (beforeModInput) {
                beforeModInput.value = beforeMod;
            }
            if (fileInput) {
                if (typeConfig.modtype === 'resource') {
                    fileInput.accept = buildAcceptAttribute(uploadConfig.ragExtensions || []);
                } else {
                    fileInput.accept = typeConfig.accept || '';
                }
            }

            const titlePromise = Str.get_string('modulename', typeConfig.titleComponent)
                .then((modname) => Str.get_string('addnew', 'moodle', modname));

            const descriptionPromise = typeConfig.modtype === 'resource'
                ? Str.get_string(
                    typeConfig.descriptionString,
                    typeConfig.descriptionComponent,
                    uploadConfig.resourceDescriptionParams || {}
                )
                : Str.get_string(typeConfig.descriptionString, typeConfig.descriptionComponent);

            const [title, description] = await Promise.all([
                titlePromise,
                descriptionPromise,
            ]);

            if (titleEl) {
                titleEl.textContent = title;
            }
            if (descriptionEl) {
                descriptionEl.textContent = description;
                descriptionEl.classList.toggle('d-none', !description);
            }
        },

        /**
         * Submit manual upload form via multipart fetch.
         *
         * @param {Event} event
         * @param {HTMLFormElement} form
         */
        handleFormSubmit: async function(event, form) {
            event.preventDefault();

            const submitButton = form.querySelector('#manual_upload_submit');
            const closeButton = form.querySelector('.close');
            const fileInput = form.querySelector('#manual-upload-file');
            const modtypeInput = form.querySelector('#manual-upload-modtype');

            if (!uploadConfig || !uploadConfig.uploadUrl || !uploadConfig.sesskey) {
                showModalError(form, 'Manual upload is not configured.');
                return;
            }

            if (!fileInput || !fileInput.files || !fileInput.files.length) {
                const message = await Str.get_string('manual_upload_error_missing', 'block_dixeo_modulegen');
                showModalError(form, message);
                return;
            }

            const file = fileInput.files[0];
            const modtype = modtypeInput ? modtypeInput.value : '';
            const validationError = validateUploadFile(file, modtype);
            if (validationError) {
                await showValidationError(form, validationError);
                return;
            }

            clearModalError(form);
            showUploadLoading(form);

            isModalClosingDisabled = true;
            if (submitButton) {
                submitButton.disabled = true;
            }
            if (closeButton) {
                closeButton.classList.add('disabled');
                closeButton.style.pointerEvents = 'none';
            }

            const formData = new FormData();
            formData.append('sesskey', uploadConfig.sesskey);
            formData.append('modtype', form.querySelector('#manual-upload-modtype').value);
            formData.append('courseid', form.querySelector('#manual-upload-courseid').value);
            formData.append('sectionnumber', form.querySelector('#manual-upload-sectionnumber').value);
            formData.append('beforemod', form.querySelector('#manual-upload-beforemod').value);
            formData.append('file', fileInput.files[0]);

            const restoreUi = () => {
                isModalClosingDisabled = false;
                hideUploadLoading(form);
                if (submitButton) {
                    submitButton.disabled = false;
                }
                if (closeButton) {
                    closeButton.classList.remove('disabled');
                    closeButton.style.pointerEvents = 'auto';
                }
            };

            fetch(uploadConfig.uploadUrl, {
                method: 'POST',
                body: formData,
                credentials: 'same-origin',
            })
                .then((response) => response.json().then((body) => ({response, body})))
                .then(({response, body}) => {
                    if (!response.ok || !body.success) {
                        throw new Error(body.message || 'Upload failed');
                    }

                    restoreUi();
                    resetForm(form);
                    $(form.closest('.modal')).modal('hide');

                    const sectionNumber = parseInt(form.querySelector('#manual-upload-sectionnumber').value, 10);
                    const cmid = body.cmid ? parseInt(body.cmid, 10) : 0;
                    const courseid = body.courseid ? parseInt(body.courseid, 10) : 0;

                    GenerationNotifications.showManualUploadSuccess({
                        link: body.link || '',
                        name: body.activityname || '',
                        courseid: courseid,
                    });

                    JobManager.getQueueStatus(true);
                    document.dispatchEvent(new Event('newTaskAdded'));

                    CourseSectionRefresh.dispatchJobCompleted({
                        cmid: cmid,
                        sectionNumber: sectionNumber,
                        source: 'manual',
                    });
                })
                .catch((error) => {
                    restoreUi();
                    showModalError(form, error.message || String(error));
                });
        },
    };
});
