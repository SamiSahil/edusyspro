// frontend/src/pages/students.js

import { apiService } from "../apiService.js";
import { store } from "../store.js";
import { currentUser, ui } from "../ui.js";
import {
    closeAnimatedModal,
    debounce,
    openBulkInsertModal,
    openFormModal,
    showConfirmationModal,
    showToast,
} from "../utils/helpers.js";

export async function renderStudentsPage() {
    // --- State Management ---
    const state = {
        view: "departments", // 'departments', 'sections', or 'students'
        selectedDeptId: null,
        selectedDeptName: "",
        selectedSectionId: null,
        selectedSectionName: "",
        selectedSubjectName: "",
        searchQuery: "",
        sortConfig: { key: "name", direction: "asc" },
        isSelectionMode: false,
        selectedIds: new Set(),
    };

    // --- Data Fetching ---
    ui.contentArea.innerHTML = `<div class="p-8 text-center"><i class="fas fa-spinner fa-spin fa-3x text-blue-400"></i></div>`;
    await Promise.all([
        store.refresh("students"), store.refresh("sections"), store.refresh("subjects"), store.refresh("departments"), store.refresh("timetable"),
    ]);

    const allDepartments = store.get("departments");
    const allSections = store.get("sections");
    const allStudents = store.get("students");
    const timetable = store.get("timetable");

    let accessibleSections = allSections;
    let accessibleDepartments = allDepartments;
    if (currentUser.role === "Teacher") {
        const teacherSectionIds = new Set(timetable.filter(e => e.teacherId?.id === currentUser.teacherId).map(e => e.sectionId?.id));
        accessibleSections = allSections.filter(section => teacherSectionIds.has(section.id));
        const accessibleDeptIds = new Set(accessibleSections.map(s => s.subjectId?.departmentId?.id));
        accessibleDepartments = allDepartments.filter(dept => accessibleDeptIds.has(dept.id));
    }

    const mainRender = () => {
        switch (state.view) {
            case "departments": renderDepartmentView(); break;
            case "sections": renderSectionView(); break;
            case "students": renderStudentTableView(); break;
            default: renderDepartmentView();
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
                ${createHeader("Departments", "Select a department to view sections")}
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="dept-grid"></div>
            </div>`;
        const grid = document.getElementById("dept-grid");
        grid.innerHTML = accessibleDepartments.map(dept => {
            const studentCount = allStudents.filter(s => s.sectionId?.subjectId?.departmentId?.id === dept.id).length;
            return createCard(dept.name, `${studentCount} Students`, { view: 'sections', deptid: dept.id, deptname: dept.name });
        }).join('');
        grid.querySelectorAll('.p-5').forEach(card => card.onclick = () => {
            Object.assign(state, { view: 'sections', selectedDeptId: card.dataset.deptid, selectedDeptName: card.dataset.deptname });
            mainRender();
        });
    };

    const renderSectionView = () => {
        ui.contentArea.innerHTML = `
            <div class="animate-fade-in">
                ${createHeader(`Department of ${state.selectedDeptName}`, "Select a section to view students", "departments")}
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="section-grid"></div>
            </div>`;
        const grid = document.getElementById("section-grid");
        const sectionsInDept = accessibleSections.filter(s => s.subjectId?.departmentId?.id === state.selectedDeptId);
        grid.innerHTML = sectionsInDept.map(sec => {
            const studentCount = allStudents.filter(s => s.sectionId?.id === sec.id).length;
            return createCard(`${sec.subjectId.name} - Sec ${sec.name}`, `${studentCount} Students`, { view: 'students', secid: sec.id, secname: sec.name, subname: sec.subjectId.name });
        }).join('');
        grid.querySelectorAll('.p-5').forEach(card => card.onclick = () => {
            Object.assign(state, { view: 'students', selectedSectionId: card.dataset.secid, selectedSectionName: card.dataset.secname, selectedSubjectName: card.dataset.subname });
            mainRender();
        });
        ui.contentArea.querySelector('.back-btn')?.addEventListener('click', () => { state.view = 'departments'; mainRender(); });
    };

    const renderStudentTableView = () => {
        ui.contentArea.innerHTML = `
            <div class="animate-fade-in">
                ${createHeader(`${state.selectedSubjectName} - Section ${state.selectedSectionName}`, `Manage student records`, "sections")}
                <div class="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <div class="flex justify-between items-center mb-4"><div id="action-bar"></div></div>
                    <div class="overflow-x-auto"><table class="min-w-full"><thead class="bg-slate-700"><tr></tr></thead><tbody id="student-table-body"></tbody></table></div>
                </div>
            </div>`;
        
        const updateTable = () => {
            document.getElementById('action-bar').innerHTML = `
                <input type="text" id="search-input" placeholder="Search..." class="p-2 rounded-lg bg-slate-700 border border-slate-600">
                ${currentUser.role === 'Admin' ? `<button id="add-student-btn" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg">Add Student</button>` : ''}`;

            const studentsInSection = allStudents.filter(s => s.sectionId?.id === state.selectedSectionId);
            const tableHead = ui.contentArea.querySelector('thead tr');
            tableHead.innerHTML = `
                <th class="px-4 py-3 text-left">Name</th>
                <th class="px-4 py-3 text-left">Roll No</th>
                <th class="px-4 py-3 text-left">Guardian</th>
                <th class="px-4 py-3 text-left">Contact</th>
                ${currentUser.role === 'Admin' ? `<th class="px-4 py-3 text-right">Actions</th>` : ''}`;

            const tableBody = document.getElementById('student-table-body');
            tableBody.innerHTML = studentsInSection.map(s => `
                <tr class="hover:bg-slate-700/30">
                    <td class="px-4 py-4">${s.name}</td><td>${s.rollNo}</td><td>${s.guardianName}</td><td>${s.contact}</td>
                    ${currentUser.role === 'Admin' ? `<td class="px-4 py-4 text-right"><button class="text-blue-400 edit-btn" data-id="${s.id}">Edit</button></td>` : ''}
                </tr>`).join('');

            document.getElementById('search-input')?.addEventListener('input', debounce(updateTable, 300));
            document.getElementById('add-student-btn')?.addEventListener('click', () => openStudentForm(null));
            tableBody.querySelectorAll('.edit-btn').forEach(btn => {
                btn.onclick = () => {
                    const student = allStudents.find(s => s.id === btn.dataset.id);
                    openStudentForm(student);
                };
            });
        };

        const openStudentForm = (studentData = null) => {
            const isEditing = !!studentData;
            const formFields = [
                { name: "name", label: "Full Name", type: "text", required: true },
                { name: "email", label: "Email", type: "email", required: true },
                { name: "rollNo", label: "Roll Number", type: "text", required: true },
                { name: "guardianName", label: "Guardian", type: "text", required: true },
                { name: "contact", label: "Contact", type: "tel", required: true },
                { name: "dateOfBirth", label: "DoB", type: "date", required: true },
                { name: "gender", label: "Gender", type: "select", options: `<option>Male</option><option>Female</option>` },
                { name: "address", label: "Address", type: "textarea", required: true },
            ];
            if (!isEditing) {
                formFields.push({ name: "password", label: "Initial Password", type: "password", required: true });
            }

            const onSubmitHandler = async (formData) => {
                try {
                    formData.sectionId = state.selectedSectionId;
                    if (isEditing) {
                        await apiService.update("students", studentData.id, formData);
                        showToast("Student updated!", "success");
                    } else {
                        const newStudent = await apiService.create("students", formData);
                        if (!newStudent || !newStudent.id) {
                            showToast("Failed to create student. Check all required fields.", "error");
                            return;
                        }
                        await apiService.create("users", {
                            name: newStudent.name, email: newStudent.email, password: formData.password, role: "Student", studentId: newStudent.id
                        });
                        showToast("Student added!", "success");
                    }
                    await store.refresh("students");
                    closeAnimatedModal(ui.modal);
                    mainRender();
                } catch (error) {
                    showToast("Operation failed.", "error");
                }
            };
            const onDeleteHandler = isEditing ? () => showConfirmationModal(`Delete ${studentData.name}?`, async () => {
                await apiService.remove("students", studentData.id);
                showToast("Student deleted", "success");
                closeAnimatedModal(ui.modal);
                await store.refresh("students");
                mainRender();
            }) : null;
            openFormModal(isEditing ? "Edit Student" : "Add Student", formFields, onSubmitHandler, studentData, onDeleteHandler);
        };
        
        updateTable();
        ui.contentArea.querySelector('.back-btn')?.addEventListener('click', () => { state.view = 'sections'; mainRender(); });
    };

    mainRender();
}