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

$string['pluginname'] = 'Generador de Contenido Dixeo';
$string['blocktitle'] = 'Añadir contenido generado por IA';
$string['dixeo_modulegen:addinstance'] = 'Añadir un bloque Generador de Contenido Dixeo';
$string['dixeo_modulegen:myaddinstance'] = 'Añadir un bloque Generador de Contenido Dixeo al panel de control';

$string['aiactivities'] = 'Generador de Contenido Dixeo';
$string['notavailable'] = 'Este módulo no está disponible o no está configurado correctamente. Por favor, inténtelo de nuevo más tarde o contacte con su administrador.';
$string['pluginrequired'] = 'Instale el plugin {$a} para generar este tipo de actividad.';

$string['generate'] = 'Generar';
$string['prompt_placeholder'] = 'Instrucciones de edición para la IA';
$string['loading'] = 'Generando...';

$string['error_title'] = '¡Vaya!';
$string['error_unsupported_module'] = 'Tipo de módulo no compatible: {$a}';
$string['error_queue_failed'] = 'Error al añadir la tarea a la cola de generación.';
$string['success_title'] = '¡Éxito!';
$string['success_message'] = 'Se ha añadido una nueva tarea de generación de contenido a la cola.';
$string['generation_complete'] = '¡Su contenido ha sido generado con éxito! Actualice la página para verlo.';

// Queue management.
$string['opengeneratorqueue'] = 'Abrir cola del generador';
$string['queue_processor'] = 'Procesador de Cola de Generación de Contenido Dixeo';
$string['queuemodaltitle'] = 'Cola de Generación';
$string['notasksinthequeue'] = 'La cola de tareas está actualmente vacía.';
$string['queued'] = 'En cola';
$string['processing'] = 'Procesando';
$string['completed'] = 'Completado';
$string['activequeued'] = 'Activos/En cola';
$string['idle'] = 'Inactivo';
$string['needsattention'] = 'Necesitan atención';
$string['cancelled'] = 'Cancelado';
$string['canceltask'] = 'Cancelar';
$string['canceltaskconfirm'] = '¿Está seguro de que desea cancelar esta tarea? Esta acción no se puede deshacer.';
$string['taskcancelled'] = 'La tarea se ha cancelado correctamente.';
$string['taskcancelerror'] = 'Se produjo un error al intentar cancelar la tarea. Por favor, inténtelo de nuevo más tarde.';

$string['generationqueued'] = 'Esperando en cola';
$string['generationinprogress'] = 'Generación en progreso (<span class="elapsed-time">0:00</span>)';
$string['generationfailed'] = 'Generación fallida';
$string['generationcancelled'] = 'Generación cancelada';
$string['generationerror'] = 'Error de generación';
$string['next'] = 'Siguiente';
$string['newmoduletype'] = 'Nuevo {$a}';
$string['removefromqueue'] = 'Quitar de la cola';
$string['removefromdisplay'] = 'Quitar de la vista';
$string['cancelgeneration'] = 'Cancelar generación';
$string['completedon'] = 'Completado el {$a}';
$string['viewinstructions'] = 'Ver instrucciones';
$string['noinstructions'] = 'Sin instrucciones para esta tarea.';
$string['retry'] = 'Reintentar';
$string['retrygeneration'] = 'Reintentar generación';

// Status strings (matching queue_service constants).
$string['status_0'] = 'Pendiente';
$string['status_1'] = 'Procesando';
$string['status_2'] = 'Completado';
$string['status_3'] = 'Fallido';
$string['status_4'] = 'Cancelado';

// Time strings.
$string['timecreated'] = 'Creado el: {$a}';
$string['timestarted'] = 'Iniciado el: {$a}';
$string['timecompleted'] = 'Completado el: {$a}';
$string['timecancelled'] = 'Cancelado el: {$a}';

// Categories.
$string['category_content'] = 'Contenido';
$string['category_resource'] = 'Recursos';
$string['category_interactive'] = 'Interactivo';
$string['category_assessment'] = 'Evaluación';
