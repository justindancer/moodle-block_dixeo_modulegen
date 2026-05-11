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

$string['pluginname'] = 'Générateur de contenu Dixeo';
$string['blocktitle'] = 'Ajouter du contenu généré par IA';
$string['dixeo_modulegen:addinstance'] = 'Ajouter un bloc Générateur de contenu Dixeo';
$string['dixeo_modulegen:myaddinstance'] = 'Ajouter un bloc Générateur de contenu Dixeo au tableau de bord';

$string['aiactivities'] = 'Générateur de contenu Dixeo';
$string['notavailable'] = 'Ce module n\'est pas disponible ou n\'est pas correctement configuré. Veuillez réessayer plus tard ou contacter votre administrateur.';
$string['pluginrequired'] = 'Installez le plugin {$a} pour générer ce type d\'activité.';

$string['generate'] = 'Générer';
$string['prompt_placeholder'] = 'Instructions d\'édition pour l\'IA';
$string['loading'] = 'Génération en cours...';

$string['error_title'] = 'Oups !';
$string['error_unsupported_module'] = 'Type de module non pris en charge : {$a}';
$string['error_queue_failed'] = 'Échec de l\'ajout de la tâche à la file d\'attente de génération.';
$string['success_title'] = 'Succès !';
$string['success_message'] = 'Une nouvelle tâche de génération de contenu a été ajoutée à la file d\'attente.';
$string['generation_complete'] = 'Votre contenu a été généré avec succès ! Actualisez la page pour le voir.';

// Queue management.
$string['opengeneratorqueue'] = 'Ouvrir la file du générateur';
$string['queue_processor'] = 'Processeur de file d\'attente de génération de contenu Dixeo';
$string['queuemodaltitle'] = 'File d\'attente de génération';
$string['notasksinthequeue'] = 'La file d\'attente des tâches est actuellement vide.';
$string['queued'] = 'En attente';
$string['processing'] = 'En cours de traitement';
$string['completed'] = 'Terminé';
$string['activequeued'] = 'Actifs/En attente';
$string['idle'] = 'Inactif';
$string['needsattention'] = 'À traiter';
$string['cancelled'] = 'Annulé';
$string['canceltask'] = 'Annuler';
$string['canceltaskconfirm'] = 'Êtes-vous sûr de vouloir annuler cette tâche ? Cette action ne peut pas être annulée.';
$string['taskcancelled'] = 'La tâche a été annulée avec succès.';
$string['taskcancelerror'] = 'Une erreur s\'est produite lors de l\'annulation de la tâche. Veuillez réessayer plus tard.';

$string['generationqueued'] = 'En attente dans la file';
$string['generationinprogress'] = 'Génération en cours (<span class="elapsed-time">0:00</span>)';
$string['generationfailed'] = 'La génération a échoué';
$string['generationcancelled'] = 'Génération annulée';
$string['generationerror'] = 'Erreur de génération';
$string['next'] = 'Suivant';
$string['newmoduletype'] = 'Nouveau {$a}';
$string['removefromqueue'] = 'Retirer de la file';
$string['removefromdisplay'] = 'Retirer de l\'affichage';
$string['cancelgeneration'] = 'Annuler la génération';
$string['completedon'] = 'Terminé le {$a}';
$string['viewinstructions'] = 'Voir les instructions';
$string['noinstructions'] = 'Aucune instruction pour cette tâche.';
$string['retry'] = 'Réessayer';
$string['retrygeneration'] = 'Réessayer la génération';

// Status strings (matching queue_service constants).
$string['status_0'] = 'En attente';
$string['status_1'] = 'Traitement en cours';
$string['status_2'] = 'Terminé';
$string['status_3'] = 'Échoué';
$string['status_4'] = 'Annulé';

// Time strings.
$string['timecreated'] = 'Créé le : {$a}';
$string['timestarted'] = 'Démarré le : {$a}';
$string['timecompleted'] = 'Terminé le : {$a}';
$string['timecancelled'] = 'Annulé le : {$a}';

// Categories.
$string['category_content'] = 'Contenu';
$string['category_resource'] = 'Ressources';
$string['category_interactive'] = 'Interactif';
$string['category_assessment'] = 'Évaluation';
