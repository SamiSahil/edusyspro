// frontend/src/utils/helpers.js

import { apiService } from '../apiService.js';
import { store } from '../store.js';
import { currentUser, ui } from '../ui.js';
import { renderNoticesPage } from '../pages/notices.js';
import { renderStudentsPage } from '../pages/students.js';
import { renderTeachersPage } from '../pages/teachers.js';
import { renderStaffPage } from '../pages/staff.js';

export function getSkeletonLoaderHTML(type = 'table') {
    if (type === 'dashboard') {
        return `
            <div class="animate-pulse">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div class="h-28 bg-slate-700/50 rounded-xl"></div>
                    <div class="h-28 bg-slate-700/50 rounded-xl"></div>
                    <div class="h-28 bg-slate-700/50 rounded-xl"></div>
                    <div class="h-28 bg-slate-700/50 rounded-xl"></div>
                </div>
                <div class="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="lg:col-span-2 h-80 bg-slate-700/50 rounded-xl"></div>
                    <div class="h-80 bg-slate-700/50 rounded-xl"></div>
                </div>
            </div>`;
    }
    return `
        <div class="animate-pulse space-y-4 p-6">
            <div class="flex justify-between items-center">
                <div class="h-8 w-48 bg-slate-700/50 rounded-md"></div>
                <div class="h-10 w-32 bg-slate-700/50 rounded-md"></div>
            </div>
            <div class="h-96 bg-slate-700/50 rounded-xl mt-4"></div>
        </div>
    `;
}

export async function openAdvancedMessageModal(replyToUserId = null, replyToUserName = null) {
    const teacherMap = store.getMap('teachers');
    const users = store.get('users');

    const allStaff = users
        .filter(user => user.role && user.role !== 'Student')
        .map(user => {
            let staffName = user.name || 'Unnamed Staff';
            if (user.role === 'Teacher' && user.teacherId) {
                const teacherDetails = teacherMap.get(user.teacherId);
                if (teacherDetails) staffName = teacherDetails.name || staffName;
            }
            return { id: String(user.id), name: staffName, role: user.role };
        });

    let modalTitle = 'Send New Notice / Message';
    if (replyToUserId && replyToUserName) {
        modalTitle = `Reply to ${replyToUserName}`;
    }

    const sections = store.get('sections');
    const mySections = sections.filter(sec => sec.classTeacherId?.id === currentUser.teacherId);

    const groupedOptions = {
        'Broadcasts': [],
        'My Sections': mySections.map(sec => ({ value: `section_${sec.id}`, label: `${sec.subjectId?.name} - Sec ${sec.name}` })),
        'Direct Messages': allStaff.map(s => ({ value: s.id, label: `${s.name} (${s.role})` }))
    };

    if (currentUser.role === 'Admin') {
        groupedOptions['Broadcasts'] = [
            { value: 'All', label: 'Everyone (All Staff & Students)' },
            { value: 'Staff', label: 'All Staff Members' },
            { value: 'Teacher', label: 'All Teachers' },
            { value: 'Student', label: 'All Students' }
        ];
    }
     if (replyToUserId) {
        groupedOptions['Direct Messages'].unshift({ value: replyToUserId, label: `${replyToUserName}` });
    }

    const optionsHtml = Object.entries(groupedOptions)
        .filter(([, options]) => options.length > 0)
        .map(([group, options]) => `<optgroup label="${group}">${options.map(opt => `<option value="${opt.value}" ${replyToUserId === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')}</optgroup>`)
        .join('');

    const formFields = [
        { name: 'target', label: 'Recipient', type: 'select', required: true, options: optionsHtml },
        { name: 'title', label: 'Title / Subject', type: 'text', required: true, value: replyToUserId ? `Re: Your message` : '' },
        { name: 'content', label: 'Message Content', type: 'textarea', required: true },
    ];

    openFormModal(modalTitle, formFields, async (formData) => {
        const isPrivate = !['All', 'Staff', 'Teacher', 'Student'].includes(formData.target) && !formData.target.startsWith('section_');
        const noticeData = { ...formData, authorId: currentUser.id, type: isPrivate ? 'private_message' : 'notice' };

        const result = await apiService.create('notices', noticeData);
        if (result) {
            showToast('Message sent successfully!', 'success');
            if (document.getElementById('notice-list-container')) {
                renderNoticesPage();
            }
        }
    });

    if (replyToUserId) {
         setTimeout(() => { const targetSelect = document.getElementById('target'); if (targetSelect) targetSelect.disabled = true; }, 100);
    }
}

export function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

export function openBulkInsertModal(collectionName, title, requiredFields, exampleObject) {
    const modalTitle = `Bulk Insert ${title}`;
    const exampleJson = JSON.stringify([exampleObject], null, 2);

    const formHtml = `
        <div class="space-y-4">
            <p class="text-slate-400">Upload a <code class="text-sm bg-slate-900 p-1 rounded">.json</code> file. It must be an array of objects.</p>
            <div>
                <label for="bulk-file-input" class="block text-sm font-medium text-slate-300">Select File</label>
                <input type="file" id="bulk-file-input" accept=".json" class="mt-1 block w-full text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"/>
            </div>
            <div id="bulk-feedback" class="text-sm p-3 bg-slate-900/50 rounded-lg hidden"></div>
            <div><h4 class="font-semibold text-slate-200 mt-6 mb-2">Required Fields:</h4><div class="flex flex-wrap gap-2">${requiredFields.map(field => `<code class="text-xs bg-slate-700 text-slate-300 p-1 rounded">${field}</code>`).join('')}</div></div>
            <div><h4 class="font-semibold text-slate-200 mt-4 mb-2">Example JSON Structure:</h4><pre class="bg-slate-900 p-3 rounded-lg text-xs custom-scrollbar overflow-x-auto"><code>${exampleJson}</code></pre></div>
        </div>
        <div class="pt-4 mt-4 flex justify-end border-t border-slate-600"><button id="process-bulk-file-btn" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg" disabled>Process File</button></div>`;

    ui.modalTitle.textContent = modalTitle;
    ui.modalBody.innerHTML = formHtml;
    openAnimatedModal(ui.modal);

    const fileInput = document.getElementById('bulk-file-input');
    const processBtn = document.getElementById('process-bulk-file-btn');
    const feedbackDiv = document.getElementById('bulk-feedback');
    let parsedData = [];

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) { processBtn.disabled = true; return; }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                parsedData = JSON.parse(event.target.result);
                if (!Array.isArray(parsedData)) throw new Error('File content must be an array of objects.');
                feedbackDiv.innerHTML = `<span class="text-green-400">${parsedData.length} records found. Ready to process.</span>`;
                feedbackDiv.classList.remove('hidden');
                processBtn.disabled = false;
            } catch (err) {
                feedbackDiv.innerHTML = `<span class="text-red-400">Error parsing file: ${err.message}</span>`;
                feedbackDiv.classList.remove('hidden');
                processBtn.disabled = true;
            }
        };
        reader.readAsText(file);
    };

    processBtn.onclick = async () => {
        processBtn.disabled = true;
        processBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        
        const validRecords = parsedData.filter(record => requiredFields.every(field => record[field] !== undefined && record[field] !== ''));
        if (validRecords.length < parsedData.length) {
            showToast(`${parsedData.length - validRecords.length} records were skipped due to missing required fields.`, 'error');
        }
        if (validRecords.length === 0) {
            processBtn.innerHTML = 'Process File';
            feedbackDiv.innerHTML = `<span class="text-red-400">No valid records to import.</span>`;
            return;
        }

        const result = await apiService.bulkCreate(collectionName, validRecords);

        if (result && result.success) {
            feedbackDiv.innerHTML = `<p class="text-green-400 font-bold">Import Complete!</p><p>Successfully inserted: ${result.insertedCount}</p><p class="text-yellow-400">Failed (duplicates, etc.): ${result.failedCount}</p>`;
            showToast('Bulk import completed!', 'success');
            if (collectionName === 'students') renderStudentsPage();
            if (collectionName === 'teachers') renderTeachersPage();
            if (collectionName === 'users') renderStaffPage();
        } else {
            feedbackDiv.innerHTML = `<span class="text-red-400">An error occurred on the server.</span>`;
            processBtn.innerHTML = 'Process File';
        }
        processBtn.disabled = false;
    };
}

export function generateInitialsAvatar(name) {
    if (!name) name = 'U';
    const nameParts = name.trim().split(' ');
    let initials = nameParts[0].charAt(0);
    if (nameParts.length > 1) {
        initials += nameParts[nameParts.length - 1].charAt(0);
    }
    initials = initials.toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#e0ebf3ff"/><text x="50%" y="50%" text-anchor="middle" dy="0.35em" font-size="45" font-family="Inter, sans-serif" font-weight="bold" fill="#000000ff">${initials}</text></svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function openAnimatedModal(modalElement) {
    modalElement.style.display = 'flex';
    setTimeout(() => modalElement.classList.add('show'), 10);
}

export function closeAnimatedModal(modalElement) {
    modalElement.classList.remove('show');
    modalElement.addEventListener('transitionend', () => {
        modalElement.style.display = 'none';
    }, { once: true });
}

export function showConfirmationModal(text, onConfirm) {
    ui.confirmText.textContent = text;

    const oldBtn = ui.confirmYesBtn;
    const newBtn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);
    ui.confirmYesBtn = newBtn;

    ui.confirmYesBtn.onclick = () => {
        if (onConfirm) onConfirm();
        closeAnimatedModal(ui.confirmModal);
    };
    openAnimatedModal(ui.confirmModal);
}

export function showToast(message, type = 'success') {
    const iconMap = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${iconMap[type]} text-xl"></i><span>${message}</span>`;
    ui.toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 3000);
}

export function openFormModal(title, formFields, onSubmit, initialData = {}, onDeleteItem = null) {
    const isEditing = Object.keys(initialData).length > 0;
    
    const createFieldHtml = (field, data) => {
        let value = data[field.name] || field.value || '';
        if (field.type === 'date' && typeof value === 'string' && value.includes('T')) {
            value = value.slice(0, 10);
        }
        const labelHtml = `<label for="${field.name}" class="block text-sm font-medium text-slate-300">${field.label}</label>`;
        const inputClasses = "mt-1 block w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500";
        if (field.type === 'textarea') return `<div>${labelHtml}<textarea name="${field.name}" rows="3" ${field.required ? 'required' : ''} class="${inputClasses}">${value}</textarea></div>`;
        if (field.type === 'select') return `<div>${labelHtml}<select name="${field.name}" ${field.required ? 'required' : ''} class="${inputClasses}">${field.options}</select></div>`;
        return `<div>${labelHtml}<input type="${field.type}" name="${field.name}" value="${value}" ${field.required ? 'required' : ''} placeholder="${field.placeholder || ''}" class="${inputClasses}"></div>`;
    };

    const formHtml = `
        <form id="modal-form" class="space-y-4">
            <div class="max-h-[60vh] overflow-y-auto custom-scrollbar pr-2 space-y-4">${formFields.map(field => createFieldHtml(field, initialData)).join('')}</div>
            <div class="flex justify-between items-center pt-4 border-t border-slate-600">
                <div>${isEditing && onDeleteItem ? `<button type="button" id="modal-delete-btn" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">Delete</button>` : ''}</div>
                <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Save Changes</button>
            </div>
        </form>`;
    
    ui.modalTitle.textContent = title;
    ui.modalBody.innerHTML = formHtml;

    formFields.forEach(field => {
        const el = ui.modalBody.querySelector(`[name="${field.name}"]`);
        if (el && field.type === 'select' && initialData[field.name]) {
            el.value = initialData[field.name];
        }
    });
    
    const deleteBtn = document.getElementById('modal-delete-btn');
    if (deleteBtn && onDeleteItem) {
        deleteBtn.onclick = () => onDeleteItem(initialData.id);
    }

    document.getElementById('modal-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = Object.fromEntries(new FormData(e.target));
        await onSubmit(formData);
    });

    openAnimatedModal(ui.modal);
}