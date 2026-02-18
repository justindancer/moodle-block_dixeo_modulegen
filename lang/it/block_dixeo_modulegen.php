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

$string['pluginname'] = 'Generatore di Contenuti Dixeo';
$string['blocktitle'] = 'Aggiungi contenuto generato da AI';
$string['dixeo_modulegen:addinstance'] = 'Aggiungi un blocco Generatore di Contenuti Dixeo';
$string['dixeo_modulegen:myaddinstance'] = 'Aggiungi un blocco Generatore di Contenuti Dixeo alla Dashboard';

$string['aiactivities'] = 'Generatore di Contenuti Dixeo';
$string['notavailable'] = 'Questo modulo non è disponibile o non è configurato correttamente. Riprova più tardi o contatta il tuo amministratore.';
$string['pluginrequired'] = 'Installa il plugin {$a} per generare questo tipo di attività.';

$string['generate'] = 'Genera';
$string['prompt_placeholder'] = 'Istruzioni di modifica per l\'AI';
$string['loading'] = 'Generazione in corso...';

$string['error_title'] = 'Ops!';
$string['error_unsupported_module'] = 'Tipo di modulo non supportato: {$a}';
$string['error_queue_failed'] = 'Impossibile aggiungere l\'attività alla coda di generazione.';
$string['success_title'] = 'Successo!';
$string['success_message'] = 'Una nuova attività di generazione contenuti è stata aggiunta alla coda.';
$string['generation_complete'] = 'Il tuo contenuto è stato generato con successo! Aggiorna la pagina per visualizzarlo.';

// Queue management.
$string['opengeneratorqueue'] = 'Apri coda generatore';
$string['queue_processor'] = 'Processore Coda Generazione Contenuti Dixeo';
$string['queuemodaltitle'] = 'Coda di Generazione';
$string['notasksinthequeue'] = 'La coda delle attività è attualmente vuota.';
$string['queued'] = 'In coda';
$string['processing'] = 'In elaborazione';
$string['completed'] = 'Completato';
$string['activequeued'] = 'Attivi/In coda';
$string['idle'] = 'Inattivo';
$string['needsattention'] = 'Richiedono attenzione';
$string['cancelled'] = 'Annullato';
$string['canceltask'] = 'Annulla';
$string['canceltaskconfirm'] = 'Sei sicuro di voler annullare questa attività? Questa azione non può essere annullata.';
$string['taskcancelled'] = 'L\'attività è stata annullata con successo.';
$string['taskcancelerror'] = 'Si è verificato un errore durante l\'annullamento dell\'attività. Riprova più tardi.';

$string['generationqueued'] = 'In attesa nella coda';
$string['generationinprogress'] = 'Generazione in corso (<span class="elapsed-time">0:00</span>)';
$string['generationfailed'] = 'Generazione fallita';
$string['generationcancelled'] = 'Generazione annullata';
$string['generationerror'] = 'Errore di generazione';
$string['next'] = 'Prossimo';
$string['newmoduletype'] = 'Nuovo {$a}';
$string['removefromqueue'] = 'Rimuovi dalla coda';
$string['removefromdisplay'] = 'Rimuovi dalla vista';
$string['cancelgeneration'] = 'Annulla generazione';
$string['completedon'] = 'Completato il {$a}';
$string['viewinstructions'] = 'Visualizza istruzioni';
$string['noinstructions'] = 'Nessuna istruzione per questa attività.';
$string['retry'] = 'Riprova';
$string['retrygeneration'] = 'Riprova generazione';

// Status strings (matching queue_service constants).
$string['status_0'] = 'In attesa';
$string['status_1'] = 'In elaborazione';
$string['status_2'] = 'Completato';
$string['status_3'] = 'Fallito';
$string['status_4'] = 'Annullato';

// Time strings.
$string['timecreated'] = 'Creato il: {$a}';
$string['timestarted'] = 'Iniziato il: {$a}';
$string['timecompleted'] = 'Completato il: {$a}';
$string['timecancelled'] = 'Annullato il: {$a}';

// Categories.
$string['category_content'] = 'Contenuto';
$string['category_resource'] = 'Risorse';
$string['category_assessment'] = 'Valutazione';
