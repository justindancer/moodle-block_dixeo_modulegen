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

$string['pluginname'] = 'Dixeo-Inhaltsgenerator';
$string['blocktitle'] = 'KI-generierte Inhalte hinzufügen';
$string['dixeo_modulegen:addinstance'] = 'Einen Dixeo-Inhaltsgenerator-Block hinzufügen';
$string['dixeo_modulegen:myaddinstance'] = 'Einen Dixeo-Inhaltsgenerator-Block zur Übersicht hinzufügen';

$string['aiactivities'] = 'Dixeo-Inhaltsgenerator';
$string['notavailable'] = 'Dieses Modul ist nicht verfügbar oder nicht richtig konfiguriert. Bitte versuchen Sie es später erneut oder wenden Sie sich an Ihren Administrator.';
$string['pluginrequired'] = 'Installieren Sie das Plugin {$a}, um diesen Aktivitätstyp zu generieren.';

$string['generate'] = 'Generieren';
$string['prompt_placeholder'] = 'Bearbeitungsanweisungen für die KI';
$string['loading'] = 'Wird generiert...';

$string['error_title'] = 'Hoppla!';
$string['error_unsupported_module'] = 'Nicht unterstützter Modultyp: {$a}';
$string['error_queue_failed'] = 'Die Aufgabe konnte nicht zur Generierungswarteschlange hinzugefügt werden.';
$string['success_title'] = 'Erfolg!';
$string['success_message'] = 'Eine neue Inhaltsgenerierungsaufgabe wurde zur Warteschlange hinzugefügt.';
$string['generation_complete'] = 'Ihr Inhalt wurde erfolgreich generiert! Aktualisieren Sie die Seite, um ihn zu sehen.';

// Queue management.
$string['opengeneratorqueue'] = 'Generierungswarteschlange öffnen';
$string['queue_processor'] = 'Dixeo-Inhaltsgenerierungswarteschlangen-Prozessor';
$string['queuemodaltitle'] = 'Generierungswarteschlange';
$string['notasksinthequeue'] = 'Die Aufgabewarteschlange ist derzeit leer.';
$string['queued'] = 'In Warteschlange';
$string['processing'] = 'In Bearbeitung';
$string['completed'] = 'Abgeschlossen';
$string['activequeued'] = 'Aktiv/In Warteschlange';
$string['idle'] = 'Inaktiv';
$string['needsattention'] = 'Benötigt Aufmerksamkeit';
$string['cancelled'] = 'Abgebrochen';
$string['canceltask'] = 'Abbrechen';
$string['canceltaskconfirm'] = 'Sind Sie sicher, dass Sie diese Aufgabe abbrechen möchten? Diese Aktion kann nicht rückgängig gemacht werden.';
$string['taskcancelled'] = 'Die Aufgabe wurde erfolgreich abgebrochen.';
$string['taskcancelerror'] = 'Beim Abbrechen der Aufgabe ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.';

$string['generationqueued'] = 'Wartet in der Warteschlange';
$string['generationinprogress'] = 'Generierung läuft (<span class="elapsed-time">0:00</span>)';
$string['generationfailed'] = 'Generierung fehlgeschlagen';
$string['generationcancelled'] = 'Generierung abgebrochen';
$string['generationerror'] = 'Generierungsfehler';
$string['next'] = 'Weiter';
$string['newmoduletype'] = 'Neue(s) {$a}';
$string['removefromqueue'] = 'Aus Warteschlange entfernen';
$string['removefromdisplay'] = 'Aus Anzeige entfernen';
$string['cancelgeneration'] = 'Generierung abbrechen';
$string['completedon'] = 'Abgeschlossen am {$a}';
$string['viewinstructions'] = 'Anweisungen anzeigen';
$string['noinstructions'] = 'Keine Anweisungen für diese Aufgabe.';
$string['retry'] = 'Wiederholen';
$string['retrygeneration'] = 'Generierung wiederholen';

// Status strings (matching queue_service constants).
$string['status_0'] = 'Ausstehend';
$string['status_1'] = 'In Bearbeitung';
$string['status_2'] = 'Abgeschlossen';
$string['status_3'] = 'Fehlgeschlagen';
$string['status_4'] = 'Abgebrochen';

// Time strings.
$string['timecreated'] = 'Erstellt am: {$a}';
$string['timestarted'] = 'Gestartet am: {$a}';
$string['timecompleted'] = 'Abgeschlossen am: {$a}';
$string['timecancelled'] = 'Abgebrochen am: {$a}';

// Categories.
$string['category_content'] = 'Inhalt';
$string['category_resource'] = 'Ressourcen';
$string['category_assessment'] = 'Bewertung';
