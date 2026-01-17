/**
 * Habits Management UI
 */

class HabitsApp {
    constructor() {
        this.habits = [];
        this.editingHabitId = null;
        this.pendingDeleteId = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupModals();
        this.loadHabits();
    }

    setupEventListeners() {
        const addBtn = document.getElementById('add-habit-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.showAddHabitForm();
            });
        }
    }

    setupModals() {
        // Habit form modal
        const habitModal = document.getElementById('habit-modal');
        const habitModalClose = document.getElementById('habit-modal-close');
        const habitModalCancel = document.getElementById('habit-modal-cancel');
        const habitModalSubmit = document.getElementById('habit-modal-submit');
        const habitNameInput = document.getElementById('habit-name-input');
        const habitHoursInput = document.getElementById('habit-hours-input');

        const closeHabitModal = () => {
            habitModal.classList.add('hidden');
            habitNameInput.value = '';
            habitHoursInput.value = '';
            document.getElementById('habit-default-length-input').value = '60';
            this.editingHabitId = null;
        };

        habitModalClose?.addEventListener('click', closeHabitModal);
        habitModalCancel?.addEventListener('click', closeHabitModal);
        habitModal?.querySelector('.modal-overlay')?.addEventListener('click', closeHabitModal);

        habitModalSubmit?.addEventListener('click', async () => {
            const name = habitNameInput.value.trim();
            const hoursPerWeek = parseFloat(habitHoursInput.value) || 0;
            const defaultLength = parseInt(document.getElementById('habit-default-length-input').value, 10) || 60;

            if (!name) {
                habitNameInput.focus();
                return;
            }

            if (this.editingHabitId) {
                await this.updateHabit(this.editingHabitId, {
                    name,
                    hours_per_week: hoursPerWeek,
                    default_length: defaultLength
                });
            } else {
                await this.addHabit(name, null, hoursPerWeek, defaultLength);
            }
            closeHabitModal();
        });

        // Allow Enter key to submit
        habitNameInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                habitModalSubmit?.click();
            }
        });
        habitHoursInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                habitModalSubmit?.click();
            }
        });

        // Confirmation modal
        const confirmModal = document.getElementById('confirm-modal');
        const confirmModalClose = document.getElementById('confirm-modal-close');
        const confirmModalCancel = document.getElementById('confirm-modal-cancel');
        const confirmModalSubmit = document.getElementById('confirm-modal-submit');

        const closeConfirmModal = () => {
            confirmModal.classList.add('hidden');
            this.pendingDeleteId = null;
        };

        confirmModalClose?.addEventListener('click', closeConfirmModal);
        confirmModalCancel?.addEventListener('click', closeConfirmModal);
        confirmModal?.querySelector('.modal-overlay')?.addEventListener('click', closeConfirmModal);

        confirmModalSubmit?.addEventListener('click', () => {
            if (this.pendingDeleteId) {
                this.deleteHabit(this.pendingDeleteId);
            }
            closeConfirmModal();
        });
    }

    async loadHabits() {
        try {
            const response = await fetch('/api/habits');
            if (response.ok) {
                const data = await response.json();
                this.habits = Array.isArray(data) ? data : [];
                this.render();
            } else {
                const errorText = await response.text();
                console.error('Failed to load habits:', response.status, errorText);
            }
        } catch (error) {
            console.error('Error loading habits:', error);
        }
    }

    async addHabit(name, category, hoursPerWeek, defaultLength) {
        try {
            const response = await fetch('/api/habits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    category: category || null,
                    hours_per_week: parseFloat(hoursPerWeek) || 0,
                    default_length: defaultLength || 60
                })
            });

            if (response.ok) {
                const newHabit = await response.json();
                console.log('Habit added successfully:', newHabit);
                await this.loadHabits();
            } else {
                const errorText = await response.text();
                console.error('Failed to add habit:', response.status, errorText);
            }
        } catch (error) {
            console.error('Error adding habit:', error);
        }
    }

    async updateHabit(id, updates) {
        try {
            const response = await fetch(`/api/habits/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });

            if (response.ok) {
                await this.loadHabits();
            } else {
                console.error('Failed to update habit');
            }
        } catch (error) {
            console.error('Error updating habit:', error);
        }
    }

    async deleteHabit(id) {
        try {
            const response = await fetch(`/api/habits/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await this.loadHabits();
            } else {
                console.error('Failed to delete habit');
            }
        } catch (error) {
            console.error('Error deleting habit:', error);
        }
    }

    showAddHabitForm() {
        this.editingHabitId = null;
        const modal = document.getElementById('habit-modal');
        const title = document.getElementById('habit-modal-title');
        const nameInput = document.getElementById('habit-name-input');
        const hoursInput = document.getElementById('habit-hours-input');
        const defaultLengthInput = document.getElementById('habit-default-length-input');

        title.textContent = 'Add Habit';
        nameInput.value = '';
        hoursInput.value = '0';
        defaultLengthInput.value = '60';
        modal.classList.remove('hidden');
        setTimeout(() => nameInput.focus(), 100);
    }

    showEditHabitForm(habit) {
        this.editingHabitId = habit.id;
        const modal = document.getElementById('habit-modal');
        const title = document.getElementById('habit-modal-title');
        const nameInput = document.getElementById('habit-name-input');
        const hoursInput = document.getElementById('habit-hours-input');
        const defaultLengthInput = document.getElementById('habit-default-length-input');

        title.textContent = 'Edit Habit';
        nameInput.value = habit.name;
        hoursInput.value = habit.hours_per_week || '0';
        defaultLengthInput.value = habit.default_length || '60';
        modal.classList.remove('hidden');
        setTimeout(() => nameInput.focus(), 100);
    }

    showConfirmDelete(habitId, habitName) {
        this.pendingDeleteId = habitId;
        const modal = document.getElementById('confirm-modal');
        const message = document.getElementById('confirm-message');
        message.textContent = `Are you sure you want to delete "${habitName}"?`;
        modal.classList.remove('hidden');
    }

    render() {
        const container = document.getElementById('habits-list');
        if (!container) return;

        if (this.habits.length === 0) {
            container.innerHTML = '<div class="empty-state">No habits yet. Click "Add Habit" to create one.</div>';
            return;
        }

        let html = '';
        this.habits.forEach(habit => {
            const habitId = habit.id;
            const habitName = this.escapeHtml(habit.name);
            const habitCategory = habit.category ? this.escapeHtml(habit.category) : '';
            const habitHours = habit.hours_per_week || 0;
            
            html += `
                <div class="habit-item" data-habit-id="${habitId}">
                    <div class="habit-info">
                        <div class="habit-name">${habitName}</div>
                        <div class="habit-details">
                            ${habit.category ? `<span class="habit-category">${habitCategory}</span>` : ''}
                            <span class="habit-hours">${habitHours} hrs/week</span>
                            <span class="habit-default-length">${habit.default_length || 60} min default</span>
                        </div>
                    </div>
                    <div class="habit-actions">
                        <button class="edit-btn" data-habit-id="${habitId}">Edit</button>
                        <button class="delete-btn" data-habit-id="${habitId}">Delete</button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        // Add event listeners
        container.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const habitId = e.target.dataset.habitId;
                const habit = this.habits.find(h => h.id === habitId);
                if (habit) {
                    this.showEditHabitForm(habit);
                }
            });
        });

        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const habitId = e.target.dataset.habitId;
                const habit = this.habits.find(h => h.id === habitId);
                if (habit) {
                    this.showConfirmDelete(habitId, habit.name);
                }
            });
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize habits app
let habitsApp;
document.addEventListener('DOMContentLoaded', () => {
    habitsApp = new HabitsApp();
    
    // Also load habits when switching to habits view
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            if (view === 'habits' && habitsApp) {
                // Small delay to ensure view is visible
                setTimeout(() => {
                    habitsApp.loadHabits();
                }, 100);
            }
        });
    });
});

