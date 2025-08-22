// frontend/src/pages/teachers.js

import { apiService } from '../apiService.js';
import { store } from '../store.js';
import { ui } from '../ui.js';
import { closeAnimatedModal, openBulkInsertModal, openFormModal, showConfirmationModal, showToast, debounce } from '../utils/helpers.js';

export async function renderTeachersPage() {
    const state = {
        view: 'departments',
        selectedDeptId: null,
        selectedDeptName: '',
    };

    ui.contentArea.innerHTML = `<div class="p-8 text-center"><i class="fas fa-spinner fa-spin fa-3x text-blue-400"></i></div>`;
    await Promise.all([store.refresh('teachers'), store.refresh('departments')]);

    const allDepartments = store.get('departments');
    const allTeachers = store.get('teachers');

    const mainRender = () => {
        if (state.view === 'departments') {
            renderDepartmentView();
        } else {
            renderTeacherTableView();
        }
    };

    const createHeader = (title, subtitle, backTarget = null) => `
        <div class="mb-6 p-6 bg-slate-800/50 rounded-xl border border-slate-700">
            ${backTarget ? `<button data-target="${backTarget}" class="back-btn text-sm text-blue-400 hover:underline mb-2">&larr; Back to ${backTarget}</button>` : ''}
            <h2 class="text-2xl font-bold text-white">${title}</h2>
            <p class="text-slate-400 mt-1">${subtitle}</p>
        </div>`;

    const createCard = (title, subtitle, data) => `
        <div class="p-5 bg-slate-800 border border-slate-700 rounded-lg cursor-pointer hover:border-blue-500 transition-colors" ${Object.entries(data).map(([k, v]) => `data-${k}="${v}"`).join(' ')}>
            <h3 class="font-bold text-white">${title}</h3><p class="text-sm text-slate-400">${subtitle}</p>
        </div>`;
    
    const renderDepartmentView = () => {
        ui.contentArea.innerHTML = `
            <div class="animate-fade-in">
                ${createHeader('Teacher Directory', 'Browse faculty by department')}
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="dept-grid"></div>
            </div>`;
        const grid = document.getElementById("dept-grid");
        grid.innerHTML = allDepartments.map(dept => {
            const teacherCount = allTeachers.filter(t => t.departmentId?.id === dept.id).length;
            return createCard(dept.name, `${teacherCount} Teachers`, { view: 'teachers', deptid: dept.id, deptname: dept.name });
        }).join('');
        grid.querySelectorAll('.p-5').forEach(card => card.onclick = () => {
            Object.assign(state, { view: 'teachers', selectedDeptId: card.dataset.deptid, selectedDeptName: card.dataset.deptname });
            mainRender();
        });
    };

    const renderTeacherTableView = () => {
        ui.contentArea.innerHTML = `
            <div class="animate-fade-in">
                ${createHeader(`Department of ${state.selectedDeptName}`, `Manage teacher records`, "departments")}
                <div class="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <div class="flex justify-end mb-4"><button id="add-teacher-btn" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg">Add Teacher</button></div>
                    <div class="overflow-x-auto"><table class="min-w-full"><thead class="bg-slate-700"><tr>
                        <th class="px-4 py-3 text-left">Name</th><th class="px-4 py-3 text-left">Contact</th><th class="px-4 py-3 text-left">Qualifications</th><th class="px-4 py-3 text-right">Actions</th>
                    </tr></thead><tbody id="teacher-table-body"></tbody></table></div>
                </div>
            </div>`;
        
        const teachersInDept = allTeachers.filter(t => t.departmentId?.id === state.selectedDeptId);
        const tableBody = document.getElementById('teacher-table-body');
        tableBody.innerHTML = teachersInDept.map(t => `
            <tr class="hover:bg-slate-700/30">
                <td class="px-4 py-4">${t.name}</td><td>${t.contact}</td><td>${t.qualifications || 'N/A'}</td>
                <td class="px-4 py-4 text-right"><button class="text-blue-400 edit-btn" data-id="${t.id}">Edit</button></td>
            </tr>`).join('');
        
        document.getElementById('add-teacher-btn').addEventListener('click', () => openTeacherForm(null));
        tableBody.querySelectorAll('.edit-btn').forEach(btn => {
            btn.onclick = () => {
                const teacher = allTeachers.find(t => t.id === btn.dataset.id);
                openTeacherForm(teacher);
            };
        });
        ui.contentArea.querySelector('.back-btn').addEventListener('click', () => { state.view = 'departments'; mainRender(); });
    };

    const openTeacherForm = (teacherData = null) => {
        const isEditing = !!teacherData;
        const formFields = [
            { name: 'name', label: 'Full Name', type: 'text', required: true },
            { name: 'email', label: 'Email (will be username)', type: 'email', required: true },
            { name: 'contact', label: 'Contact', type: 'tel', required: true },
            { name: 'qualifications', label: 'Qualifications', type: 'text' },
            { name: 'baseSalary', label: 'Base Salary', type: 'number' },
        ];
        if (!isEditing) {
            formFields.push({ name: 'password', label: 'Initial Password', type: 'password', required: true });
        }

        const onSubmit = async (formData) => {
            formData.departmentId = state.selectedDeptId;
            try {
                if (isEditing) {
                    await apiService.update('teachers', teacherData.id, formData);
                    showToast('Teacher updated!', 'success');
                } else {
                    const newTeacher = await apiService.create('teachers', formData);
                    if (!newTeacher || !newTeacher.id) {
                        showToast("Failed to create teacher. Check required fields.", "error");
                        return;
                    }
                    await apiService.create('users', {
                        name: newTeacher.name, email: newTeacher.email, password: formData.password, role: 'Teacher', teacherId: newTeacher.id
                    });
                    showToast('Teacher added!', 'success');
                }
                await store.refresh('teachers');
                closeAnimatedModal(ui.modal);
                mainRender();
            } catch (error) {
                showToast("Operation failed.", "error");
            }
        };

        const onDelete = isEditing ? () => showConfirmationModal(`Delete ${teacherData.name}?`, async () => {
            await apiService.remove('teachers', teacherData.id);
            showToast('Teacher deleted.', 'success');
            closeAnimatedModal(ui.modal);
            await store.refresh('teachers');
            mainRender();
        }) : null;
        
        openFormModal(isEditing ? 'Edit Teacher' : 'Add Teacher', formFields, onSubmit, teacherData, onDelete);
    };

    mainRender();
}