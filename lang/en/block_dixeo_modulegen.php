<?php
/**
 * Language strings for the Dixeo Module Generator block.
 *
 * @package    block_dixeo_modulegen
 * @copyright  2026 Edunao SAS (contact@edunao.com)
 * @author     Josemaria Bolanos <admin@mako.digital>
 * @author     Pierre FACQ <pierre.facq@edunao.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

$string['pluginname'] = 'Dixeo Content Generator';
$string['blocktitle'] = 'Add AI generated content';
$string['dixeo_modulegen:addinstance'] = 'Add a Dixeo Content Generator block';
$string['dixeo_modulegen:myaddinstance'] = 'Add a Dixeo Content Generator block to Dashboard';

$string['aiactivities'] = 'Dixeo Content Generator';
$string['notavailable'] = 'This module is not available or not properly configured. Please try again later or contact your administrator.';
$string['pluginrequired'] = 'Install the {$a} plugin to generate this activity type.';

$string['generate'] = 'Generate';
$string['add'] = 'Add';
$string['prompt_placeholder'] = 'Generation instructions for Dixeo';
$string['loading'] = 'Generating...';

$string['error_title'] = 'Oops!';
$string['error_unsupported_module'] = 'Unsupported module type: {$a}';
$string['error_queue_failed'] = 'Failed to add task to the generation queue.';
$string['success_title'] = 'Success!';
$string['success_message'] = 'A new content generation task has been added to the queue.';
$string['generation_complete'] = 'Your content has been generated successfully! Refresh the page to see it.';

// Queue management.
$string['opengeneratorqueue'] = 'Open generator queue';
$string['queue_processor'] = 'Dixeo Content Generation Queue Processor';
$string['queuemodaltitle'] = 'Generation Queue';
$string['notasksinthequeue'] = 'The task queue is currently empty.';
$string['queued'] = 'Queued';
$string['processing'] = 'Processing';
$string['completed'] = 'Completed';
$string['activequeued'] = 'Active/Queued';
$string['idle'] = 'Idle';
$string['needsattention'] = 'Needs attention';
$string['cancelled'] = 'Cancelled';
$string['canceltask'] = 'Cancel';
$string['canceltaskconfirm'] = 'Are you sure you want to cancel this task? This action cannot be undone.';
$string['taskcancelled'] = 'The task has been cancelled successfully.';
$string['taskcancelerror'] = 'An error occurred while trying to cancel the task. Please try again later.';

$string['generationqueued'] = 'Waiting in queue';
$string['generationinprogress'] = 'Generation in progress (<span class="elapsed-time">0:00</span>)';
$string['generationfailed'] = 'Generation failed';
$string['generationcancelled'] = 'Generation cancelled';
$string['generationerror'] = 'Generation error';
$string['next'] = 'Next';
$string['newmoduletype'] = 'New {$a}';
$string['removefromqueue'] = 'Remove from queue';
$string['removefromdisplay'] = 'Remove from display';
$string['cancelgeneration'] = 'Cancel generation';
$string['completedon'] = 'Completed on {$a}';
$string['viewinstructions'] = 'View instructions';
$string['noinstructions'] = 'No instructions for this task.';
$string['retry'] = 'Retry';
$string['retrygeneration'] = 'Retry generation';
$string['filltask_defaulttitle'] = 'New activity';
$string['retry_fill_notfound'] = 'Queue task not found for this course.';
$string['retry_fill_notfailed'] = 'Only failed tasks can be retried this way.';
$string['retry_fill_notfill'] = 'This retry applies to fill tasks only.';
$string['retry_fill_failed'] = 'Module fill did not complete.';
$string['retry_fill_timeout'] = 'The AI fill job did not complete in time.';
$string['retry_fill_createfailed'] = 'Could not create the activity from the fill result.';

// Status strings (matching queue_service constants).
$string['status_0'] = 'Pending';
$string['status_1'] = 'Processing';
$string['status_2'] = 'Completed';
$string['status_3'] = 'Failed';
$string['status_4'] = 'Cancelled';

// Time strings.
$string['timecreated'] = 'Created at: {$a}';
$string['timestarted'] = 'Started at: {$a}';
$string['timecompleted'] = 'Completed at: {$a}';
$string['timecancelled'] = 'Cancelled at: {$a}';

// Categories.
$string['category_content'] = 'Content';
$string['category_resource'] = 'Resources';
$string['category_interactive'] = 'Interactive';
$string['category_assessment'] = 'Assessment';

// Upload modal.
$string['manual_upload_name_label'] = 'Activity name';
$string['manual_upload_file_label'] = 'File';
$string['manual_upload_drag'] = 'Drag and drop a file here, or click to browse';
$string['manual_upload_browse'] = 'Choose a file';
$string['manual_upload_error_missing'] = 'Activity name and file are required.';
$string['manual_upload_error_failed'] = 'Could not create the activity.';
$string['manual_upload_error_invalid_scorm'] = 'Only Articulate Storyline SCORM packages (.zip) are accepted.';
$string['manual_upload_error_invalid_resource'] = 'Only these file formats are accepted: {$a->ragformats}.';
$string['manual_upload_scorm_description'] = 'Articulate Storyline SCORM packages (.zip) only.';
$string['manual_upload_resource_description'] = 'Accepted formats: {$a->ragformats}.';

// SCORM upload.
$string['scorm_package_help'] = 'Upload a SCORM package (.zip)';
$string['scorm_package_invalid'] = 'The uploaded file is not a valid SCORM package.';
