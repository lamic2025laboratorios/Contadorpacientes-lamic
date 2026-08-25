// ══════════════════════════════════════════════════════════
// Contador de Pacientes — LAMIC
// Estado, fluxo de registro (entrada → senha → atendimento),
// persistência por unidade no localStorage e envio ao Sheets.
// ══════════════════════════════════════════════════════════

const ENDPOINT = 'https://script.google.com/macros/s/AKfycbzG5Btfs_2faCwxRmFOJabPR6IkJ4XszZX0l1bek9pwENLV01DCdCVNGf2vzrC6pT6B/exec';

// ── Estado da aplicação ──
let selectedUnit = '';
let selectedUnitLabel = '';
let counter = 0;
let records = [];
let currentStep = 'unit';
let currentPassword = '';
let isSubmitting = false;
let editingRecordId = null;
let pendingDeleteId = null;

// ── Elementos DOM ──
const unitSelection = document.getElementById('unitSelection');
const mainInterface = document.getElementById('mainInterface');
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
const recapNumeroPw = document.getElementById('recapNumeroPw');
const recapNumeroSvc = document.getElementById('recapNumeroSvc');
const recapSenha = document.getElementById('recapSenha');

const recordsTableBody = document.getElementById('recordsTableBody');
const recordsCount = document.getElementById('recordsCount');
const noRecords = document.getElementById('noRecords');
const tableWrap = document.querySelector('.table-wrap');

const submitSection = document.getElementById('submitSection');
const submitBtn = document.getElementById('submitBtn');
const submitDesc = document.getElementById('submitDesc');
const submitLoading = document.getElementById('submitLoading');

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

confirmUnitBtn.addEventListener('click', function () {
    const selectedValue = unitSelect.value;
    if (!selectedValue) return;

    selectedUnit = selectedValue;
    selectedUnitLabel = unitSelect.options[unitSelect.selectedIndex].text;
    selectedUnitDisplay.textContent = selectedUnitLabel;

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
    recapNumeroPw.textContent = '#' + counter;
    recapNumeroSvc.textContent = '#' + counter;
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
        recapSenha.textContent = currentPassword;
        currentStep = 'service';
        showServiceSection();
    });
});

// Passo 3 — tipo de atendimento
document.querySelectorAll('.service-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        createRecord(this.dataset.service);
        resetCurrentEntry();
        updateTable();
        saveUnitData();
        showToast('Atendimento registrado com sucesso!', 'success');
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

// Esc fecha qualquer popup aberto
document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!confirmModal.classList.contains('hidden')) closeConfirmModal();
    else if (!editModal.classList.contains('hidden')) closeEditModal();
});

// ══════════════════════════════════════════════════════════
// NAVEGAÇÃO ENTRE TELAS E PASSOS
// ══════════════════════════════════════════════════════════
function showUnitSelection() {
    unitSelection.classList.remove('hidden');
    mainInterface.classList.add('hidden');
    currentStep = 'unit';
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
}

function showServiceSection() {
    entrySection.classList.add('hidden');
    passwordSection.classList.add('hidden');
    serviceSection.classList.remove('hidden');
    serviceSection.classList.add('fade-in');
    updateSteps(3);
}

function resetCurrentEntry() {
    entrySection.classList.remove('hidden');
    passwordSection.classList.add('hidden');
    serviceSection.classList.add('hidden');
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
    submitDesc.textContent = pendentes === 1
        ? '1 atendimento aguardando envio para a planilha.'
        : `${pendentes} atendimentos aguardando envio para a planilha.`;

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
    submitBtn.classList.add('hidden');
    submitLoading.classList.remove('hidden');

    try {
        for (const record of pendingRecords) {
            const formData = new FormData();
            formData.append('numero', record.numero);
            formData.append('unidade', selectedUnit);
            formData.append('tipoAtendimento', record.tipoAtendimento);
            formData.append('senha', record.senha);
            formData.append('data', record.data);
            formData.append('hora', record.hora);

            const response = await fetch(ENDPOINT, { method: 'POST', body: formData });

            if (response.ok) {
                const index = records.findIndex(r => r.id === record.id);
                if (index !== -1) records[index].status = 'sent';
            }

            // Meio segundo entre envios para não sobrecarregar o Apps Script
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Envio concluído: zera o dia da unidade
        records = [];
        counter = 0;
        counterDisplay.textContent = counter;
        updateTable();
        localStorage.removeItem(`patientData_${selectedUnit}`);

        showToast('Todos os dados foram enviados com sucesso!', 'success');

    } catch (error) {
        console.error('Erro ao enviar dados:', error);
        showToast('Erro ao enviar dados. Tente novamente.', 'error');
    } finally {
        isSubmitting = false;
        submitBtn.disabled = false;
        submitBtn.classList.remove('hidden');
        submitLoading.classList.add('hidden');
    }
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
