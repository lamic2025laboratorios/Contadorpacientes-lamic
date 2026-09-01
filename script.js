// ══════════════════════════════════════════════════════════
// Contador de Pacientes — LAMIC
// Estado, fluxo de registro (entrada → senha → atendimento),
// persistência por unidade no localStorage e envio ao Sheets.
// ══════════════════════════════════════════════════════════

// ── Bloqueio de F12/Ctrl+Shift+I/Ctrl+U/clique-direito/F11 ──
// AVISO: isso é só um freio pra quem não sabe mexer, não é segurança de
// verdade. Chrome, Edge e Firefox atuais tratam F12, Ctrl+Shift+I e F11
// como atalhos do PRÓPRIO NAVEGADOR — o preventDefault() abaixo não
// impede nada nesses casos (o navegador nem repassa o evento pra
// página). Quem quiser abrir o DevTools consegue pelo menu
// (⋮ > Mais ferramentas > Ferramentas do desenvolvedor) de qualquer
// jeito. O que este bloco realmente evita é o clique-direito e alguns
// atalhos que o navegador ainda deixa a página interceptar.
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', function (e) {
    const key = e.key;
    const blockedCombo =
        key === 'F12' ||
        key === 'F11' ||
        (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(key)) ||
        (e.ctrlKey && ['U', 'u'].includes(key));
    if (blockedCombo) e.preventDefault();
});

const ENDPOINT = 'https://script.google.com/macros/s/AKfycbzG5Btfs_2faCwxRmFOJabPR6IkJ4XszZX0l1bek9pwENLV01DCdCVNGf2vzrC6pT6B/exec';

// ── Estado da aplicação ──
let selectedUnit = '';
let selectedUnitLabel = '';
let counter = 0;
let records = [];
let currentStep = 'unit';
let currentPassword = '';
let isSubmitting = false;
let isRegistering = false;
let editingRecordId = null;
let pendingDeleteId = null;

// ── Função oculta de zerar atendimentos (5 cliques no ícone do topbar) ──
const SECRET_PASSWORD = 'seila1236';
let secretClickCount = 0;
let secretClickTimer = null;
let secretArmed = false;

// ── Elementos DOM ──
const unitSelection = document.getElementById('unitSelection');
const mainInterface = document.getElementById('mainInterface');
const unitPickerModal = document.getElementById('unitPickerModal');
const openUnitPickerBtn = document.getElementById('openUnitPickerBtn');
const closeUnitPickerBtn = document.getElementById('closeUnitPickerBtn');
const unitSelect = document.getElementById('unitSelect');
const confirmUnitBtn = document.getElementById('confirmUnitBtn');
const unitSelectedInfo = document.getElementById('unitSelectedInfo');
const unitSelectedText = document.getElementById('unitSelectedText');
const selectedUnitDisplay = document.getElementById('selectedUnitDisplay');
const changeUnitBtn = document.getElementById('changeUnitBtn');

const counterDisplay = document.getElementById('counterDisplay');
const statPendentes = document.getElementById('statPendentes');
const statEnviados = document.getElementById('statEnviados');

const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');

const entrySection = document.getElementById('entrySection');
const entryBtn = document.getElementById('entryBtn');
const passwordSection = document.getElementById('passwordSection');
const serviceSection = document.getElementById('serviceSection');
const flowRecap = document.getElementById('flowRecap');
const flowRecapText = document.getElementById('flowRecapText');

const recordsTableBody = document.getElementById('recordsTableBody');
const recordsCount = document.getElementById('recordsCount');
const noRecords = document.getElementById('noRecords');
const tableWrap = document.querySelector('.table-wrap');

const submitSection = document.getElementById('submitSection');
const submitBtn = document.getElementById('submitBtn');
const submitBtnLabel = document.getElementById('submitBtnLabel');
const sendingOverlay = document.getElementById('sendingOverlay');
const sendingTitle = document.getElementById('sendingTitle');
const sendingDesc = document.getElementById('sendingDesc');
const sendingProgressTrack = document.getElementById('sendingProgressTrack');
const sendingProgressFill = document.getElementById('sendingProgressFill');
const sendingProgressLabel = document.getElementById('sendingProgressLabel');

const editModal = document.getElementById('editModal');
const editHeaderSub = document.getElementById('editHeaderSub');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const saveEditBtn = document.getElementById('saveEditBtn');

const confirmModal = document.getElementById('confirmModal');
const confirmDesc = document.getElementById('confirmDesc');
const confirmCloseBtn = document.getElementById('confirmCloseBtn');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');
const confirmOkBtn = document.getElementById('confirmOkBtn');

const toastContainer = document.getElementById('toastContainer');

const topbarMark = document.getElementById('topbarMark');
const secretResetModal = document.getElementById('secretResetModal');
const secretPassword = document.getElementById('secretPassword');
const secretError = document.getElementById('secretError');
const secretWarning = document.getElementById('secretWarning');
const secretCloseBtn = document.getElementById('secretCloseBtn');
const secretCancelBtn = document.getElementById('secretCancelBtn');
const secretConfirmBtn = document.getElementById('secretConfirmBtn');
const secretConfirmLabel = document.getElementById('secretConfirmLabel');

// ── Ícones em SVG (sem emoji, seguindo o padrão do sistema) ──
const ICON = {
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>'
};

// ══════════════════════════════════════════════════════════
// EVENTOS
// ══════════════════════════════════════════════════════════
unitSelect.addEventListener('change', function () {
    confirmUnitBtn.disabled = !this.value;
    if (this.value) {
        unitSelectedText.textContent = this.options[this.selectedIndex].text;
        unitSelectedInfo.classList.remove('hidden');
    } else {
        unitSelectedInfo.classList.add('hidden');
    }
});

// Popup de seleção de unidade — fundo embaçado, sem cabeçalho escuro
openUnitPickerBtn.addEventListener('click', function () {
    unitPickerModal.classList.remove('hidden');
});

closeUnitPickerBtn.addEventListener('click', closeUnitPicker);
unitPickerModal.addEventListener('click', function (e) {
    if (e.target === unitPickerModal) closeUnitPicker();
});

function closeUnitPicker() {
    unitPickerModal.classList.add('hidden');
}

confirmUnitBtn.addEventListener('click', function () {
    const selectedValue = unitSelect.value;
    if (!selectedValue) return;

    selectedUnit = selectedValue;
    selectedUnitLabel = unitSelect.options[unitSelect.selectedIndex].text;
    selectedUnitDisplay.textContent = selectedUnitLabel;

    closeUnitPicker();
    loadUnitData();
    showMainInterface();
});

changeUnitBtn.addEventListener('click', function () {
    showUnitSelection();
    resetCurrentEntry();
});

entryBtn.addEventListener('click', function () {
    counter++;
    counterDisplay.textContent = counter;
    currentStep = 'password';
    showPasswordSection();
});

// Cancelar a entrada em andamento devolve o número usado
document.querySelectorAll('.cancel-entry-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        if (counter > 0) {
            counter--;
            counterDisplay.textContent = counter;
        }
        resetCurrentEntry();
    });
});

// Passo 2 — tipo de senha
document.querySelectorAll('.password-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        currentPassword = this.dataset.password;
        currentStep = 'service';
        showServiceSection();
    });
});

// Passo 3 — tipo de atendimento
// Regra: cada atendimento registrado leva 3s (tela de carregamento) antes
// de entrar na tabela — evita registrar em sequência rápida demais.
document.querySelectorAll('.service-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        if (isRegistering) return;
        isRegistering = true;

        const serviceType = this.dataset.service;
        showProcessingOverlay('Registrando atendimento...', 'Aguarde, isso leva alguns segundos.');

        setTimeout(() => {
            createRecord(serviceType);
            resetCurrentEntry();
            updateTable();
            saveUnitData();
            hideProcessingOverlay();
            isRegistering = false;
            showToast('Atendimento registrado com sucesso!', 'success');
        }, 3000);
    });
});

submitBtn.addEventListener('click', handleSubmitPending);

// Modal de edição
closeModalBtn.addEventListener('click', closeEditModal);
cancelEditBtn.addEventListener('click', closeEditModal);
saveEditBtn.addEventListener('click', saveEditRecord);
editModal.addEventListener('click', e => { if (e.target === editModal) closeEditModal(); });

// Modal de exclusão
confirmCloseBtn.addEventListener('click', closeConfirmModal);
confirmCancelBtn.addEventListener('click', closeConfirmModal);
confirmOkBtn.addEventListener('click', confirmDeleteRecord);
confirmModal.addEventListener('click', e => { if (e.target === confirmModal) closeConfirmModal(); });

// Função oculta — 5 cliques no ícone do topbar abrem o popup de zerar atendimentos
topbarMark.addEventListener('click', function () {
    secretClickCount++;
    clearTimeout(secretClickTimer);
    secretClickTimer = setTimeout(() => { secretClickCount = 0; }, 1200);

    if (secretClickCount >= 5) {
        secretClickCount = 0;
        openSecretResetModal();
    }
});

secretCloseBtn.addEventListener('click', closeSecretResetModal);
secretCancelBtn.addEventListener('click', closeSecretResetModal);
secretConfirmBtn.addEventListener('click', handleSecretConfirm);
secretResetModal.addEventListener('click', e => { if (e.target === secretResetModal) closeSecretResetModal(); });
secretPassword.addEventListener('keydown', e => { if (e.key === 'Enter') handleSecretConfirm(); });

// Esc fecha qualquer popup aberto
document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!confirmModal.classList.contains('hidden')) closeConfirmModal();
    else if (!editModal.classList.contains('hidden')) closeEditModal();
    else if (!secretResetModal.classList.contains('hidden')) closeSecretResetModal();
    else if (!unitPickerModal.classList.contains('hidden')) closeUnitPicker();
});

// ══════════════════════════════════════════════════════════
// NAVEGAÇÃO ENTRE TELAS E PASSOS
// ══════════════════════════════════════════════════════════
function showUnitSelection() {
    unitSelection.classList.remove('hidden');
    mainInterface.classList.add('hidden');
    currentStep = 'unit';

    // Deixa o popup pronto pra uma nova escolha
    closeUnitPicker();
    unitSelect.value = '';
    confirmUnitBtn.disabled = true;
    unitSelectedInfo.classList.add('hidden');
}

function showMainInterface() {
    unitSelection.classList.add('hidden');
    mainInterface.classList.remove('hidden');
    currentStep = 'entry';
    resetCurrentEntry();
}

function showPasswordSection() {
    entrySection.classList.add('hidden');
    passwordSection.classList.remove('hidden');
    passwordSection.classList.add('fade-in');
    serviceSection.classList.add('hidden');
    updateSteps(2);

    flowRecapText.innerHTML = `Atendimento <strong>#${counter}</strong> — o paciente retirou senha?`;
    flowRecap.classList.remove('hidden');
}

function showServiceSection() {
    entrySection.classList.add('hidden');
    passwordSection.classList.add('hidden');
    serviceSection.classList.remove('hidden');
    serviceSection.classList.add('fade-in');
    updateSteps(3);

    flowRecapText.innerHTML = `Atendimento <strong>#${counter}</strong> · <strong>${escapeHtml(currentPassword)}</strong> — qual foi o motivo?`;
}

function resetCurrentEntry() {
    entrySection.classList.remove('hidden');
    passwordSection.classList.add('hidden');
    serviceSection.classList.add('hidden');
    flowRecap.classList.add('hidden');
    currentPassword = '';
    currentStep = 'entry';
    updateSteps(1);
}

// Marca o passo atual como ativo e os anteriores como concluídos
function updateSteps(active) {
    [step1, step2, step3].forEach((el, i) => {
        const num = i + 1;
        el.classList.toggle('active', num === active);
        el.classList.toggle('done', num < active);
    });
}

// ══════════════════════════════════════════════════════════
// REGISTROS
// ══════════════════════════════════════════════════════════
function generateId() {
    return Date.now().toString() + Math.random().toString(36).slice(2, 11);
}

function getCurrentTime() {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getCurrentDate() {
    return new Date().toLocaleDateString('pt-BR');
}

function createRecord(tipoAtendimento) {
    records.push({
        id: generateId(),
        numero: counter,
        unidade: selectedUnitLabel,
        tipoAtendimento: tipoAtendimento,
        senha: currentPassword,
        data: getCurrentDate(),
        hora: getCurrentTime(),
        status: 'pending'
    });
}

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function updateTable() {
    if (records.length === 0) {
        recordsTableBody.innerHTML = '';
        tableWrap.classList.add('hidden');
        noRecords.classList.remove('hidden');
        submitSection.classList.add('hidden');
        updateStats();
        return;
    }

    noRecords.classList.add('hidden');
    tableWrap.classList.remove('hidden');

    recordsTableBody.innerHTML = records.map(record => `
        <tr>
            <td><span class="td-num">${escapeHtml(record.numero)}</span></td>
            <td class="td-unidade">${escapeHtml(record.unidade)}</td>
            <td>${escapeHtml(record.tipoAtendimento)}</td>
            <td><span class="badge ${record.senha === 'Sem Senha' ? 'badge-sem' : 'badge-com'}">${escapeHtml(record.senha)}</span></td>
            <td class="td-hora">${escapeHtml(record.hora)}</td>
            <td><span class="badge badge-${getStatusBadgeClass(record.status)}">${getStatusText(record.status)}</span></td>
            <td>
                <div class="td-acoes">
                    <button class="btn-icon-sm edit" title="Editar" onclick="editRecord('${record.id}')">${ICON.edit}</button>
                    <button class="btn-icon-sm del" title="Excluir" onclick="deleteRecord('${record.id}')">${ICON.trash}</button>
                </div>
            </td>
        </tr>
    `).join('');

    const pendentes = records.filter(r => r.status === 'pending').length;
    submitSection.classList.toggle('hidden', pendentes === 0);
    submitBtnLabel.textContent = pendentes === 1
        ? 'Enviar 1 pendente'
        : `Enviar ${pendentes} pendentes`;

    updateStats();
}

// Números dos cartões do topo e contador da tabela
function updateStats() {
    const pendentes = records.filter(r => r.status === 'pending').length;
    const enviados = records.filter(r => r.status === 'sent').length;
    statPendentes.textContent = pendentes;
    statEnviados.textContent = enviados;
    recordsCount.textContent = records.length === 1 ? '1 registro' : `${records.length} registros`;
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 'pending': return 'pending';
        case 'sent': return 'sent';
        default: return 'success';
    }
}

function getStatusText(status) {
    switch (status) {
        case 'pending': return 'Pendente';
        case 'sent': return 'Enviado';
        default: return 'Processado';
    }
}

// ══════════════════════════════════════════════════════════
// EDIÇÃO
// ══════════════════════════════════════════════════════════
function editRecord(id) {
    const record = records.find(r => r.id === id);
    if (!record) return;

    editingRecordId = id;
    editHeaderSub.textContent = `Atendimento nº ${record.numero}`;
    document.getElementById('editTipoAtendimento').value = record.tipoAtendimento;
    document.getElementById('editSenha').value = record.senha;
    document.getElementById('editHoraDisplay').textContent = record.hora;
    document.getElementById('editUnidade').textContent = record.unidade;
    document.getElementById('editData').textContent = record.data;

    editModal.classList.remove('hidden');
}

function closeEditModal() {
    editModal.classList.add('hidden');
    editingRecordId = null;
}

function saveEditRecord() {
    if (!editingRecordId) return;

    const index = records.findIndex(r => r.id === editingRecordId);
    if (index === -1) return;

    records[index] = {
        ...records[index],
        tipoAtendimento: document.getElementById('editTipoAtendimento').value,
        senha: document.getElementById('editSenha').value
    };

    updateTable();
    saveUnitData();
    closeEditModal();
    showToast('Atendimento atualizado com sucesso!', 'success');
}

// ══════════════════════════════════════════════════════════
// EXCLUSÃO (popup próprio, no padrão do sistema)
// ══════════════════════════════════════════════════════════
function deleteRecord(id) {
    const record = records.find(r => r.id === id);
    if (!record) return;

    pendingDeleteId = id;
    confirmDesc.textContent = `Atendimento nº ${record.numero} — ${record.tipoAtendimento}, às ${record.hora}. Esta ação não pode ser desfeita.`;
    confirmModal.classList.remove('hidden');
}

function closeConfirmModal() {
    confirmModal.classList.add('hidden');
    pendingDeleteId = null;
}

function confirmDeleteRecord() {
    if (!pendingDeleteId) return;

    records = records.filter(record => record.id !== pendingDeleteId);
    closeConfirmModal();
    updateTable();
    saveUnitData();
    showToast('Atendimento excluído com sucesso!', 'success');
}

// ══════════════════════════════════════════════════════════
// PERSISTÊNCIA POR UNIDADE
// ══════════════════════════════════════════════════════════
function saveUnitData() {
    localStorage.setItem(`patientData_${selectedUnit}`, JSON.stringify({ counter, records }));
}

function loadUnitData() {
    const savedData = localStorage.getItem(`patientData_${selectedUnit}`);
    if (savedData) {
        const unitData = JSON.parse(savedData);
        counter = unitData.counter || 0;
        records = unitData.records || [];
    } else {
        counter = 0;
        records = [];
    }
    counterDisplay.textContent = counter;
    updateTable();
}

// ══════════════════════════════════════════════════════════
// OVERLAY DE CARREGAMENTO (compartilhado: registro local e envio ao Sheets)
// ══════════════════════════════════════════════════════════
function showProcessingOverlay(title, desc) {
    sendingTitle.textContent = title;
    sendingDesc.textContent = desc;
    // A barrinha só aparece quando o envio em lote chama atualizarProgressoEnvio
    // (o "Registrando atendimento..." de um clique só não tem lote pra medir).
    sendingProgressTrack.classList.add('hidden');
    sendingProgressLabel.classList.add('hidden');
    sendingProgressFill.style.width = '0%';
    sendingOverlay.classList.remove('hidden');
}

function hideProcessingOverlay() {
    sendingOverlay.classList.add('hidden');
}

// Mostra/atualiza a barrinha de progresso do envio em lote.
function atualizarProgressoEnvio(atual, total) {
    sendingProgressTrack.classList.remove('hidden');
    sendingProgressLabel.classList.remove('hidden');
    const pct = total ? Math.round((atual / total) * 100) : 0;
    sendingProgressFill.style.width = pct + '%';
    sendingProgressLabel.textContent = `${atual} de ${total} enviados`;
}

// Manda um registro pro Apps Script — UMA tentativa só, sempre em modo
// 'no-cors'. Nada de "tenta normal, e se falhar tenta nocors": um bloqueio
// de CORS acontece DEPOIS que o Google já recebeu e já processou o pedido —
// o navegador só impede o JavaScript de LER a resposta, não impede o envio.
// Então reenviar depois de um erro de CORS manda o mesmo registro DE NOVO,
// duplicando a linha na planilha (foi exatamente o que aconteceu). Por isso
// nunca há um segundo fetch aqui: um envio, sempre no-cors, sem tentar de
// novo por conta própria. Em troca de nunca duplicar, a gente aceita não
// conseguir ler a resposta real do Apps Script (status sempre 0, ok sempre
// false em modo no-cors) — se o fetch não jogar exceção, o pedido saiu.
async function enviarRegistroAoSheets(formData) {
    await fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', body: formData });
}

// ══════════════════════════════════════════════════════════
// ENVIO PARA A PLANILHA
// ══════════════════════════════════════════════════════════
async function handleSubmitPending() {
    const pendingRecords = records.filter(record => record.status === 'pending');

    if (pendingRecords.length === 0) {
        showToast('Não há dados pendentes para enviar', 'error');
        return;
    }
    if (isSubmitting) return;

    isSubmitting = true;
    submitBtn.disabled = true;
    showProcessingOverlay('Enviando dados...', 'Aguarde, isso pode levar alguns segundos.');

    // Cada registro é tentado isoladamente: se um falhar (rede/CORS/erro do
    // Apps Script), os outros continuam sendo enviados normalmente — antes,
    // uma falha no meio interrompia o laço inteiro e nenhum dos seguintes
    // era sequer tentado.
    let enviados = 0;
    atualizarProgressoEnvio(0, pendingRecords.length);

    for (const record of pendingRecords) {
        try {
            const formData = new FormData();
            formData.append('numero', record.numero);
            formData.append('unidade', selectedUnit);
            formData.append('tipoAtendimento', record.tipoAtendimento);
            formData.append('senha', record.senha);
            formData.append('data', record.data);
            formData.append('hora', record.hora);

            await enviarRegistroAoSheets(formData);

            const index = records.findIndex(r => r.id === record.id);
            if (index !== -1) records[index].status = 'sent';
        } catch (erroEnvio) {
            console.error('Erro ao enviar registro', record.id, erroEnvio);
        }

        enviados++;
        atualizarProgressoEnvio(enviados, pendingRecords.length);

        // Intervalo entre envios pra não sobrecarregar o Apps Script. Era
        // 500ms — reduzido pra 150ms: o próprio fetch já espera a resposta
        // completa do Google antes do laço seguir (então já não dá pra dois
        // pedidos se sobreporem), esse intervalo é só uma folga extra entre
        // um e outro. 150ms ainda deixa essa folga, só que ~3x mais rápido.
        await new Promise(resolve => setTimeout(resolve, 150));
    }

    // Salva o estado real ANTES de decidir se zera algo — se sobrou
    // pendente, ele fica salvo, nunca é jogado fora silenciosamente.
    saveUnitData();
    updateTable();

    const restam = records.filter(r => r.status === 'pending').length;
    if (restam === 0) {
        records = [];
        counter = 0;
        counterDisplay.textContent = counter;
        updateTable();
        localStorage.removeItem(`patientData_${selectedUnit}`);
        showToast('Todos os dados foram enviados com sucesso!', 'success');
    } else if (restam < pendingRecords.length) {
        showToast(`${pendingRecords.length - restam} enviado(s), mas ${restam} falharam. Tente enviar de novo.`, 'error');
    } else {
        showToast('Erro ao enviar dados. Tente novamente.', 'error');
    }

    isSubmitting = false;
    submitBtn.disabled = false;
    hideProcessingOverlay();
}

// ══════════════════════════════════════════════════════════
// FUNÇÃO OCULTA — ZERAR ATENDIMENTOS
// 5 cliques no ícone do topbar + senha. Existe pra apagar o histórico
// de verdade (recepção não consegue "burlar" o contador excluindo
// entradas uma a uma, já que excluir um registro não decrementa o
// "Atendimentos hoje" nem o número usado nos próximos). Aviso: a
// senha fica em texto no JS do navegador — qualquer um com DevTools
// consegue ler o código-fonte e descobrir. Isso trava recepcionista
// curioso, não é segurança de verdade contra alguém técnico.
// ══════════════════════════════════════════════════════════
function openSecretResetModal() {
    secretArmed = false;
    secretPassword.value = '';
    secretError.classList.add('hidden');
    secretWarning.classList.add('hidden');
    secretConfirmLabel.textContent = 'Zerar Atendimentos';
    secretResetModal.classList.remove('hidden');
    setTimeout(() => secretPassword.focus(), 50);
}

function closeSecretResetModal() {
    secretResetModal.classList.add('hidden');
    secretArmed = false;
}

function handleSecretConfirm() {
    if (!secretArmed) {
        if (secretPassword.value !== SECRET_PASSWORD) {
            secretError.classList.remove('hidden');
            secretPassword.focus();
            return;
        }
        secretError.classList.add('hidden');
        secretWarning.classList.remove('hidden');
        secretArmed = true;
        secretConfirmLabel.textContent = 'Confirmar — apaga tudo';
        return;
    }

    // Segundo clique com a senha já validada: zera de vez
    records = [];
    counter = 0;
    counterDisplay.textContent = counter;
    updateTable();
    localStorage.removeItem(`patientData_${selectedUnit}`);

    closeSecretResetModal();
    showToast('Histórico de atendimentos zerado.', 'success');
}

// ══════════════════════════════════════════════════════════
// TOASTS
// ══════════════════════════════════════════════════════════
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${type === 'success' ? ICON.check : ICON.alert}</span>
        <div>
            <div class="toast-title">${type === 'success' ? 'Sucesso' : 'Erro'}</div>
            <div class="toast-description">${escapeHtml(message)}</div>
        </div>
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ══════════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function () {
    showUnitSelection();
    updateSteps(1);
});
