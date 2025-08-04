// Estado da aplicação
let selectedUnit = '';
let selectedUnitLabel = '';
let counter = 0;
let records = [];
let currentStep = 'unit';
let currentPassword = '';
let isSubmitting = false;
let editingRecordId = null;

// Elementos DOM
const unitSelection = document.getElementById('unitSelection');
const mainInterface = document.getElementById('mainInterface');
const unitSelect = document.getElementById('unitSelect');
const confirmUnitBtn = document.getElementById('confirmUnitBtn');
const selectedUnitDisplay = document.getElementById('selectedUnitDisplay');
const counterDisplay = document.getElementById('counterDisplay');
const changeUnitBtn = document.getElementById('changeUnitBtn');
const entrySection = document.getElementById('entrySection');
const entryBtn = document.getElementById('entryBtn');
const passwordSection = document.getElementById('passwordSection');
const serviceSection = document.getElementById('serviceSection');
const recordsTableBody = document.getElementById('recordsTableBody');
const noRecords = document.getElementById('noRecords');
const submitSection = document.getElementById('submitSection');
const submitBtn = document.getElementById('submitBtn');
const submitLoading = document.getElementById('submitLoading');
const editModal = document.getElementById('editModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const saveEditBtn = document.getElementById('saveEditBtn');
const toastContainer = document.getElementById('toastContainer');

// Event Listeners
unitSelect.addEventListener('change', function() {
    confirmUnitBtn.disabled = !this.value;
});

confirmUnitBtn.addEventListener('click', function() {
    const selectedValue = unitSelect.value;
    const selectedOption = unitSelect.options[unitSelect.selectedIndex];
    
    if (selectedValue) {
        selectedUnit = selectedValue;
        selectedUnitLabel = selectedOption.text;
        selectedUnitDisplay.textContent = selectedUnitLabel;
        
        loadUnitData();
        showMainInterface();
    }
});

changeUnitBtn.addEventListener('click', function() {
    showUnitSelection();
    resetCurrentEntry();
});

entryBtn.addEventListener('click', function() {
    counter++;
    counterDisplay.textContent = counter;
    currentStep = 'password';
    showPasswordSection();
});

// Password buttons
document.querySelectorAll('.password-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        currentPassword = this.dataset.password;
        currentStep = 'service';
        showServiceSection();
    });
});

// Service buttons
document.querySelectorAll('.service-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const serviceType = this.dataset.service;
        createRecord(serviceType);
        resetCurrentEntry();
        updateTable();
        saveUnitData();
        showToast('Atendimento registrado com sucesso!', 'success');
    });
});

submitBtn.addEventListener('click', handleSubmitPending);

// Modal events
closeModalBtn.addEventListener('click', closeEditModal);
cancelEditBtn.addEventListener('click', closeEditModal);
saveEditBtn.addEventListener('click', saveEditRecord);

// Modal click outside to close
editModal.addEventListener('click', function(e) {
    if (e.target === editModal) {
        closeEditModal();
    }
});

// Funções principais
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
    serviceSection.classList.add('hidden');
}

function showServiceSection() {
    entrySection.classList.add('hidden');
    passwordSection.classList.add('hidden');
    serviceSection.classList.remove('hidden');
}

function resetCurrentEntry() {
    entrySection.classList.remove('hidden');
    passwordSection.classList.add('hidden');
    serviceSection.classList.add('hidden');
    currentPassword = '';
    currentStep = 'entry';
}

function generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
}

function getCurrentDate() {
    const now = new Date();
    return now.toLocaleDateString('pt-BR');
}

function createRecord(tipoAtendimento) {
    const record = {
        id: generateId(),
        numero: counter,
        unidade: selectedUnitLabel,
        tipoAtendimento: tipoAtendimento,
        senha: currentPassword,
        data: getCurrentDate(),
        hora: getCurrentTime(),
        status: 'pending'
    };
    
    records.push(record);
}

function updateTable() {
    if (records.length === 0) {
        recordsTableBody.innerHTML = '';
        noRecords.classList.remove('hidden');
        submitSection.classList.add('hidden');
        return;
    }
    
    noRecords.classList.add('hidden');
    
    recordsTableBody.innerHTML = records.map(record => `
        <tr>
            <td>${record.numero}</td>
            <td>${record.unidade}</td>
            <td>${record.tipoAtendimento}</td>
            <td>${record.senha}</td>
            <td>${record.hora}</td>
            <td>
                <span class="badge badge-${getStatusBadgeClass(record.status)}">
                    ${getStatusText(record.status)}
                </span>
            </td>
            <td>
                <button class="btn btn-outline btn-sm" onclick="editRecord('${record.id}')" style="margin-right: 0.5rem;">
                    Editar
                </button>
                <button class="btn btn-destructive btn-sm" onclick="deleteRecord('${record.id}')">
                    Excluir
                </button>
            </td>
        </tr>
    `).join('');
    
    const hasPendingRecords = records.some(record => record.status === 'pending');
    if (hasPendingRecords) {
        submitSection.classList.remove('hidden');
    } else {
        submitSection.classList.add('hidden');
    }
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

function editRecord(id) {
    const record = records.find(r => r.id === id);
    if (!record) return;
    
    editingRecordId = id;
    
    // Preencher o modal
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
    
    const recordIndex = records.findIndex(r => r.id === editingRecordId);
    if (recordIndex === -1) return;
    
    const updatedData = {
        tipoAtendimento: document.getElementById('editTipoAtendimento').value,
        senha: document.getElementById('editSenha').value
    };
    
    records[recordIndex] = { ...records[recordIndex], ...updatedData };
    
    updateTable();
    saveUnitData();
    closeEditModal();
    showToast('Atendimento atualizado com sucesso!', 'success');
}

function deleteRecord(id) {
    if (!confirm('Tem certeza que deseja excluir este atendimento?')) return;
    
    records = records.filter(record => record.id !== id);
    updateTable();
    saveUnitData();
    showToast('Atendimento excluído com sucesso!', 'success');
}

function saveUnitData() {
    const unitData = {
        counter: counter,
        records: records
    };
    localStorage.setItem(`patientData_${selectedUnit}`, JSON.stringify(unitData));
}

function loadUnitData() {
    const savedData = localStorage.getItem(`patientData_${selectedUnit}`);
    if (savedData) {
        const unitData = JSON.parse(savedData);
        counter = unitData.counter || 0;
        records = unitData.records || [];
        counterDisplay.textContent = counter;
        updateTable();
    } else {
        counter = 0;
        records = [];
        counterDisplay.textContent = counter;
        updateTable();
    }
}

async function handleSubmitPending() {
    const pendingRecords = records.filter(record => record.status === 'pending');
    
    if (pendingRecords.length === 0) {
        showToast('Não há dados pendentes para enviar', 'error');
        return;
    }
    
    if (isSubmitting) return;
    
    isSubmitting = true;
    submitBtn.disabled = true;
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
            
            const response = await fetch('https://script.google.com/macros/s/AKfycbxictFVeXWDsU1V018G4U0tzNRH64962bM5le_qbDwXT1eGv_KIb94GDmHra06ktbJU/exec', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                // Marcar como enviado
                const recordIndex = records.findIndex(r => r.id === record.id);
                if (recordIndex !== -1) {
                    records[recordIndex].status = 'sent';
                }
            }
            
            // Aguardar meio segundo entre envios
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Limpar dados após envio bem-sucedido
        records = [];
        counter = 0;
        counterDisplay.textContent = counter;
        updateTable();
        
        // Limpar localStorage também
        localStorage.removeItem(`patientData_${selectedUnit}`);
        
        showToast('Todos os dados foram enviados com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao enviar dados:', error);
        showToast('Erro ao enviar dados. Tente novamente.', 'error');
    } finally {
        isSubmitting = false;
        submitBtn.disabled = false;
        submitLoading.classList.add('hidden');
    }
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    toast.innerHTML = `
        <div class="toast-title">${type === 'success' ? 'Sucesso' : 'Erro'}</div>
        <div class="toast-description">${message}</div>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    showUnitSelection();
});