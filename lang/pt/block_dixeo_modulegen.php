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

$string['pluginname'] = 'Gerador de Conteúdo Dixeo';
$string['blocktitle'] = 'Adicionar conteúdo gerado por IA';
$string['dixeo_modulegen:addinstance'] = 'Adicionar um bloco Gerador de Conteúdo Dixeo';
$string['dixeo_modulegen:myaddinstance'] = 'Adicionar um bloco Gerador de Conteúdo Dixeo ao Painel';

$string['aiactivities'] = 'Gerador de Conteúdo Dixeo';
$string['notavailable'] = 'Este módulo não está disponível ou não está configurado corretamente. Tente novamente mais tarde ou contacte o seu administrador.';
$string['pluginrequired'] = 'Instale o plugin {$a} para gerar este tipo de atividade.';

$string['generate'] = 'Gerar';
$string['add'] = 'Adicionar';
$string['prompt_placeholder'] = 'Instruções de geração para Dixeo';
$string['loading'] = 'A gerar...';

$string['error_title'] = 'Ops!';
$string['error_unsupported_module'] = 'Tipo de módulo não suportado: {$a}';
$string['error_queue_failed'] = 'Falha ao adicionar a tarefa à fila de geração.';
$string['success_title'] = 'Sucesso!';
$string['success_message'] = 'Uma nova tarefa de geração de conteúdo foi adicionada à fila.';
$string['generation_complete'] = 'O seu conteúdo foi gerado com sucesso! Atualize a página para o ver.';

// Queue management.
$string['opengeneratorqueue'] = 'Abrir fila do gerador';
$string['queue_processor'] = 'Processador da Fila de Geração de Conteúdo Dixeo';
$string['queuemodaltitle'] = 'Fila de Geração';
$string['notasksinthequeue'] = 'A fila de tarefas está atualmente vazia.';
$string['queued'] = 'Na fila';
$string['processing'] = 'A processar';
$string['completed'] = 'Concluído';
$string['activequeued'] = 'Ativos/Na fila';
$string['idle'] = 'Inativo';
$string['needsattention'] = 'Requer atenção';
$string['cancelled'] = 'Cancelado';
$string['canceltask'] = 'Cancelar';
$string['canceltaskconfirm'] = 'Tem a certeza de que deseja cancelar esta tarefa? Esta ação não pode ser desfeita.';
$string['taskcancelled'] = 'A tarefa foi cancelada com sucesso.';
$string['taskcancelerror'] = 'Ocorreu um erro ao tentar cancelar a tarefa. Tente novamente mais tarde.';

$string['generationqueued'] = 'À espera na fila';
$string['generationinprogress'] = 'Geração em curso (<span class="elapsed-time">0:00</span>)';
$string['generationfailed'] = 'Geração falhou';
$string['generationcancelled'] = 'Geração cancelada';
$string['generationerror'] = 'Erro de geração';
$string['next'] = 'Seguinte';
$string['newmoduletype'] = 'Novo {$a}';
$string['removefromqueue'] = 'Remover da fila';
$string['removefromdisplay'] = 'Remover da visualização';
$string['cancelgeneration'] = 'Cancelar geração';
$string['completedon'] = 'Concluído em {$a}';
$string['viewinstructions'] = 'Ver instruções';
$string['copyinstructions'] = 'Copiar instruções';
$string['instructionscopied'] = 'Instruções copiadas';
$string['noinstructions'] = 'Sem instruções para esta tarefa.';
$string['retry'] = 'Repetir';
$string['retrygeneration'] = 'Repetir geração';
$string['filltask_defaulttitle'] = 'Nova atividade';
$string['retry_fill_notfound'] = 'Tarefa na fila não encontrada para este curso.';
$string['retry_fill_notfailed'] = 'Apenas tarefas falhadas podem ser repetidas desta forma.';
$string['retry_fill_notfill'] = 'Esta repetição aplica-se apenas a tarefas de preenchimento (fill).';
$string['retry_fill_failed'] = 'O preenchimento do módulo não foi concluído.';
$string['retry_fill_timeout'] = 'O trabalho de preenchimento IA não foi concluído a tempo.';
$string['retry_fill_createfailed'] = 'Não foi possível criar a atividade a partir do resultado do preenchimento.';

// Status strings (matching queue_service constants).
$string['status_0'] = 'Pendente';
$string['status_1'] = 'A processar';
$string['status_2'] = 'Concluído';
$string['status_3'] = 'Falhou';
$string['status_4'] = 'Cancelado';

// Time strings.
$string['timecreated'] = 'Criado em: {$a}';
$string['timestarted'] = 'Iniciado em: {$a}';
$string['timecompleted'] = 'Concluído em: {$a}';
$string['timecancelled'] = 'Cancelado em: {$a}';

// Categories.
$string['category_content'] = 'Conteúdo';
$string['category_resource'] = 'Recursos';
$string['category_interactive'] = 'Interativo';
$string['category_assessment'] = 'Avaliação';

// Upload modal.
$string['manual_upload_drag'] = 'Arraste um ficheiro para aqui ou clique para procurar';
$string['manual_upload_browse'] = 'Escolher um ficheiro';
$string['manual_upload_uploading'] = 'A carregar...';
$string['manual_upload_error_missing'] = 'O ficheiro é obrigatório.';
$string['manual_upload_error_failed'] = 'Não foi possível criar a atividade.';
$string['manual_upload_error_invalid_scorm'] = 'Só são aceites pacotes SCORM Articulate Storyline (.zip).';
$string['manual_upload_error_invalid_resource'] = 'Só são aceites estes formatos de ficheiro: {$a->ragformats}.';
$string['manual_upload_error_file_too_large'] = 'O ficheiro é demasiado grande. Carregue um ficheiro com menos de {$a->maxsize}.';
$string['manual_upload_scorm_description'] = 'Apenas pacotes SCORM Articulate Storyline (.zip).';
$string['manual_upload_resource_description'] = 'Formatos aceites: {$a->ragformats}. (Máx. {$a->maxsize})';

// Queue notifications.
$string['task_completed_success'] = 'Atividade « <a href="{$a->link}">{$a->name}</a> » criada.';
$string['manual_upload_success'] = 'Atividade « <a href="{$a->link}">{$a->name}</a> » adicionada. A sincronização de ficheiros foi iniciada.';
$string['task_failed'] = 'Falha na geração do módulo: {$a->error}';
$string['queue_manual_upload_label'] = 'Carregamento manual';

// SCORM upload.
$string['scorm_package_help'] = 'Carregar um pacote SCORM (.zip)';
$string['scorm_package_invalid'] = 'O ficheiro carregado não é um pacote SCORM válido.';
