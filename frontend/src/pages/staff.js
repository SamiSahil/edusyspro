// in frontend/src/pages/staff.js

import { apiService } from '../apiService.js';
import { store } from '../store.js';
import { currentUser, ui } from '../ui.js';
import { renderGenericListPage } from '../utils/genericListPage.js';
import { closeAnimatedModal, generateInitialsAvatar, openBulkInsertModal, openFormModal, showConfirmationModal, showToast } from '../utils/helpers.js';

export async function renderStaffPage() {
    await store.refresh('users'); // Ensure we have the latest user data

    const allUsers = store.get('users');
    const allStaff = allUsers.filter(user => user.role !== 'Student' && user.role !== 'Teacher');
    const allRoles = [...new Set(allStaff.map(s => s.role))];
    const roleFilterOptions = [
        { value: '', label: 'All Roles' },
        ...allRoles.map(role => ({ value: role, label: role }))
    ];

    const config = {
        title: 'Staff & Colleagues',
        collectionName: 'users',
        data: allStaff,
        columns: [
             { label: 'Name', render: item => `<div class="flex items-center gap-3"><img src="${item.profileImage || generateInitialsAvatar(item.name)}" alt="${item.name}" class="w-10 h-10 rounded-full object-cover"><div><p class="font-semibold text-white">${item.name || 'N/A'}</p><a href="mailto:${item.email}" class="text-xs text-slate-400 hover:text-blue-400 transition-colors">${item.email || 'N/A'}</a></div></div>`, sortable: true, sortKey: 'name' },
            { label: 'Role / Profession', key: 'role', sortable: true },
            { label: 'Contact', key: 'contact' },
        ],
        searchKeys: ['name', 'role', 'email'],
        hideAddButton: true, // We use a custom button
        // --- THIS IS THE KEY CHANGE: Add a custom action column for the edit button ---
        hideActions: true, // Hide the default action column
        formFields: [
            { name: 'name', label: 'Full Name', type: 'text', required: true },
            { name: 'email', label: 'Email', type: 'email', required: true },
            { name: 'role', label: 'Role / Profession', type: 'text', required: true },
            { name: 'contact', label: 'Contact Number', type: 'tel' },
        ],
        customHeader: `
            <input type="text" id="search-input" placeholder="Search by name, role, etc..." class="p-2 rounded-lg bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-blue-500">
            <select id="role-filter" class="p-2 rounded-lg bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-blue-500">${roleFilterOptions.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}</select>
            ${currentUser.role === 'Admin' ? `
                <button id="bulk-insert-btn" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><i class="fas fa-file-import"></i> Insert Document</button>
                <button id="add-staff-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"><i class="fas fa-plus"></i> Add Staff</button>
            ` : ''}
        `,
        // --- THIS IS THE SECOND KEY CHANGE: Add the listener for the edit button ---
        customListeners: (items) => {
            if (currentUser.role === 'Admin') {
                document.getElementById('add-staff-btn')?.addEventListener('click', () => {
                    const formFields = [
                        { name: 'name', label: 'Full Name', type: 'text', required: true }, { name: 'email', label: 'Email (will be username)', type: 'email', required: true }, { name: 'role', label: 'Role / Profession', type: 'text', required: true, placeholder: 'e.g., Clerk, Nanny, etc.' }, { name: 'contact', label: 'Contact Number', type: 'tel' }, { name: 'password', label: 'Initial Password', type: 'text', required: true },
                    ];
                    openFormModal('Add New Staff Member', formFields, async (formData) => {
                        if (await apiService.create('users', formData)) {
                            showToast('New staff member added successfully!', 'success');
                            renderStaffPage();
                        }
                    });
                });
                document.getElementById('bulk-insert-btn')?.addEventListener('click', () => {
                    openBulkInsertModal('users', 'Staff', ['name', 'email', 'password', 'role'], { name: 'Support Staff', email: 'support@example.com', password: 'password123', role: 'Nanny' });
                });
            }

            // Custom listener for the edit button
            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.onclick = () => {
                    const userId = btn.dataset.id;
                    const userData = items.find(i => i.id === userId);
                    if (userData) {
                        const onSubmit = async (formData) => {
                            if (await apiService.update('users', userId, formData)) {
                                showToast('Staff details updated successfully!', 'success');
                                renderStaffPage();
                            }
                        };
                        // Define the delete function to pass to the modal
                        const onDeleteItem = async (id) => {
                            showConfirmationModal(`Are you sure you want to delete ${userData.name}?`, async () => {
                                if (await apiService.remove('users', id)) {
                                    showToast('Staff member deleted.', 'success');
                                    closeAnimatedModal(ui.modal);
                                    renderStaffPage();
                                }
                            });
                        };
                        // Open the modal, passing the delete function as the last argument
                        openFormModal(`Edit Staff & Colleagues`, config.formFields, onSubmit, userData, onDeleteItem);
                    }
                };
            });
        }
    };
    
    // Manually add the "Actions" column if the user is an Admin
    if (currentUser.role === 'Admin') {
        config.columns.push({
            label: 'Actions',
            render: (item) => `<button class="text-blue-400 hover:text-blue-300 edit-btn" data-id="${item.id}">Edit</button>`
        });
    }

    // Since we are adding our own listeners, we prevent the generic one from running
    renderGenericListPage({ ...config, preventDefaultEdit: true });
}