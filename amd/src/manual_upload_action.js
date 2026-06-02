/**
 * Manual upload modal handler for SCORM and File activities.
 *
 * @module     block_dixeo_modulegen/manual_upload_action
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define([
    'jquery',
    'core/notification',
    'core/str',
    'block_dixeo_modulegen/course_section_refresh'
], function($, Notification, Str, CourseSectionRefresh) {
    'use strict';

    /** @type {Object|null} Config from PHP init (upload URL, sesskey, description params). */
    let uploadConfig = null;

    /** @type {boolean} */
    let initialized = false;

    /** @type {boolean} */
    let isModalClosingDisabled = false;

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
            fileHelpString: 'scorm_package_help',
            fileHelpComponent: 'block_dixeo_modulegen',
        },
        resource: {
            modtype: 'resource',
            accept: '',
            titleComponent: 'mod_resource',
            descriptionString: 'manual_upload_resource_description',
            descriptionComponent: 'block_dixeo_modulegen',
            fileHelpString: null,
            fileHelpComponent: null,
        },
    };

    /**
     * Reset the form to a clean state.
     *
     * @param {HTMLFormElement} form
     */
    const resetForm = (form) => {
        form.reset();
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
                setSelectedFile(form, files[0]);
            });

            if (browseButton) {
                browseButton.addEventListener('click', () => {
                    fileInput.click();
                });
            }

            fileInput.addEventListener('change', () => {
                const file = fileInput.files && fileInput.files.length ? fileInput.files[0] : null;
                setSelectedFile(form, file);
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
            const fileHelp = form.querySelector('#manual-upload-file-help');
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
                fileInput.accept = typeConfig.accept || '';
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

            const fileHelpPromise = typeConfig.fileHelpString
                ? Str.get_string(typeConfig.fileHelpString, typeConfig.fileHelpComponent)
                : Promise.resolve('');

            const [title, description, helpText] = await Promise.all([
                titlePromise,
                descriptionPromise,
                fileHelpPromise,
            ]);

            if (titleEl) {
                titleEl.textContent = title;
            }
            if (descriptionEl) {
                descriptionEl.textContent = description;
            }
            if (fileHelp) {
                fileHelp.textContent = helpText;
                fileHelp.classList.toggle('d-none', !helpText);
            }
        },

        /**
         * Submit manual upload form via multipart fetch.
         *
         * @param {Event} event
         * @param {HTMLFormElement} form
         */
        handleFormSubmit: function(event, form) {
            event.preventDefault();

            const submitButton = form.querySelector('#manual_upload_submit');
            const closeButton = form.querySelector('.close');
            const nameInput = form.querySelector('#manual-upload-name');
            const fileInput = form.querySelector('#manual-upload-file');

            if (!uploadConfig || !uploadConfig.uploadUrl || !uploadConfig.sesskey) {
                Notification.exception({message: 'Manual upload is not configured.'});
                return;
            }

            if (!nameInput || !nameInput.value.trim() || !fileInput || !fileInput.files || !fileInput.files.length) {
                Str.get_string('manual_upload_error_missing', 'block_dixeo_modulegen').then((message) => {
                    Notification.alert('', message);
                });
                return;
            }

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
            formData.append('name', nameInput.value.trim());
            formData.append('file', fileInput.files[0]);

            const restoreUi = () => {
                isModalClosingDisabled = false;
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
                    CourseSectionRefresh.dispatchJobCompleted({
                        cmid: cmid,
                        sectionNumber: sectionNumber,
                    });
                })
                .catch((error) => {
                    restoreUi();
                    Str.get_string('error_title', 'block_dixeo_modulegen').then((title) => {
                        Notification.alert(title, error.message || String(error));
                    });
                });
        },
    };
});
