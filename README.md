# Dixeo Module Generator

The **Dixeo Module Generator** is an AI-powered Moodle block that enables teachers to generate new learning activities directly inside an existing Moodle course.
Using natural language instructions, the Module Generator creates fully configured Moodle resources and activities that are automatically grounded in the existing course content and documents.
Generation requests are processed asynchronously in the background, allowing teachers to continue editing their course while new activities are being produced.

# Features

- Generate of 10 commonly-used Moodle resources and activities: Page, Text & Media, Glossary, Slideshow, Quiz, QCM, H5P Question Set, H5P Flashcards, H5P Crossword, H5P FindTheWords.
- Simplified insertion (with AI summary) of File, URL and SCORM resources for user in Tutor conversations and new module generation.
- Works in any existing Moodle course
- Uses natural language instructions
- Grounds generated content using existing course resources
- Supports Retrieval-Augmented Generation (RAG)
- Easy-to-use drag-and-drop activity generation in normal mode (no need for editing mode)
- Background generation queue
- Responsive user interface

# Supported Activity Types

The Module Generator can generate the following Moodle activities:

| Activity | Description |
|----------|-------------|
| Text & Media Area | Generate instructional text displayed directly on the course page. |
| Page | Create rich HTML learning pages with text, media and embedded resources. |
| Glossary | Generate course glossaries and terminology. |
| Slideshow | Create interactive HTML slide presentations. |
| URL | Add an external resource with an AI-generated summary. |
| File | Add an external resource with an AI-generated summary. |
| SCORM | Add an external resource with an AI-generated summary. |
| Quiz | Generate Moodle quizzes with multiple question types. |
| Simple Quiz (MCQ)* | Generate lightweight revision quizzes using multiple-choice questions. |
| H5P Question Set* | Interactive revision quizzes. |
| H5P Flashcards* | AI-generated flashcard activities. |
| H5P Crossword* | Crossword revision activities. |
| H5P Find the Words* | Word-search activities. |
| Ubicast Interactive Video* | H5P Interactive video based on a Ubicast video. |

\* Availability depends on installed plugins and Dixeo platform support.

# Requirements

- **Moodle:** 4.5 or later
- **Dependency:** `local_dixeo` 4.1.0 or later and a valid Dixeo API key
- **Course format:** Standard Moodle formats and most formats derived from Boost

# Installation

1. Copy `block_dixeo_modulegen` to `/blocks/dixeo_modulegen/`
2. Visit Site Administration > Notifications
3. Complete the Moodle upgrade.
4. Make sure that Dixeo AI has been configured with a valid Dixeo API key.

# Configuration

The Module Generator has **no plugin-specific configuration settings**.

All AI configuration (API endpoint, credentials, image generation, credits, etc.) is defined in the  **[Dixeo AI](../../../moodle-local_dixeo)** plugin.

Once installed, teachers simply add the **Dixeo Module Generator** block to a course.

# Adding the Module Generator to a Course

To enable AI activity generation:

1. Open the course.
2. Turn **Editing mode** on.
3. Open the block drawer.
4. Select **Add a block**.
5. Choose **Dixeo Module Generator**.
6. Turn editing off.

The Module Generator block will appear in the course drawer and display the activities available for generation.
Upon deployment, Dixeo course synchronisatoin is automatically started.

# Generating Activities

Creating new content is designed to be intuitive.

1. Drag an activity from the Module Generator block into the desired course section.
2. Enter a natural language instruction describing what should be created.

Examples include:

- "Generate a glossary of marketing terminology."
- "Create a 10-question multiple-choice revision quiz."
- "Add an introductory page explaining cloud computing."
- "Generate an assignment with a grading rubric."

The generator analyses:
- the teacher's instruction;
- the existing course structure;
- existing course activities;
- synchronized course documents.
It then creates a fully configured Moodle activity and inserts it into the course.

# Grounded AI Generation

The Module Generator automatically uses the course context maintained by the Dixeo AI platform.

Grounding includes:
- course structure and section content;
- existing Moodle resources activities;
- uploaded course files.
Using Retrieval-Augmented Generation (RAG) ro ground generation significantly improves response quality while reducing hallucinations.

# Background Processing

Activity generation is asynchronous.

Requests are placed into a background queue allowing teachers to continue working while generation proceeds.

The queue interface is avaliable from the status ar of the content generation block, and allows teachers to:
- monitor progress and queued jobs;
- cancel running jobs;
- retry failed jobs;
- remove completed jobs;
- open generated activities;
- review and copy generation prompts.

# Capabilities

| Capability | Description | Default Roles |
|------------|-------------|---------------|
| `block/dixeo_modulegen:addinstance` | Add the Module Generator block | Editing Teacher, Manager |
| `local/dixeo:generate` | Generate activities using AI | Editing Teacher, Manager |

Users must also possess Moodle's standard course editing permissions.

# Accessibility

The Module Generator follows Moodle accessibility guidelines and includes:

- keyboard navigation;
- responsive layouts;
- accessible controls;
- ARIA-compatible components;
- screen-reader friendly interface.

# Privacy

The plugin communicates with the Dixeo AI platform to generate course content.

Generation requests may include course context and synchronized documents to improve response quality.

Institutions should review their AI governance and privacy policies before enabling AI-assisted generation.

# Recommendations

For the best results:

- Upload high-quality course documents before generating content.
- Verify that course files have been synchronized.
- Provide clear generation instructions.
- Review all AI-generated content before publishing it to learners.

# Related Plugins

The Dixeo AI suite includes:

- **Dixeo AI** – Core AI services and platform integration.
- **Dixeo Course Designer** – Generate complete Moodle courses.
- **Dixeo Module Generator** – Generate new activities inside existing courses.
- **Dixeo AI Editor** – AI-assisted editing of Moodle content.
- **Dixeo Student Tutor** – AI teaching assistant for students.

# Support

For documentation, licensing or technical support:

**Dixeo**

https://www.dixeo.com

support@dixeo.com

# License

Copyright © Edunao SAS

Licensed under the GNU General Public License v3.0 or later.
