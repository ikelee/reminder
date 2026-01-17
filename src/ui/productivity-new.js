/**
 * Productivity Tracking - Free-form timeline with drag-to-create
 */

class ProductivityApp {
    constructor() {
        this.weekStartDate = this.getWeekStartDate(new Date());
        this.schedule = {}; // Will contain schedule for all 7 days
        this.obligations = [];
        this.habits = [];
        this.dragging = false;
        this.dragStart = null;
        this.dragEnd = null;
        this.draggedItem = null; // For drag-and-drop from sidebar
        this.editingBlock = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadSchedule();
        this.loadObligations();
        this.loadHabits();
    }

    getTodayDateString() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    getWeekStartDate(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = d.getMonth();
        const day = d.getDate();
        const localDate = new Date(year, month, day);
        
        const dayOfWeek = localDate.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        localDate.setDate(localDate.getDate() + diff);
        return localDate;
    }

    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    getWeekDates() {
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(this.weekStartDate);
            date.setDate(this.weekStartDate.getDate() + i);
            dates.push(date);
        }
        return dates;
    }

    setupEventListeners() {
        const datePicker = document.getElementById('productivity-date');
        if (datePicker) {
            datePicker.value = this.formatDate(this.weekStartDate);
            datePicker.addEventListener('change', (e) => {
                const selectedDate = new Date(e.target.value);
                this.weekStartDate = this.getWeekStartDate(selectedDate);
                this.loadSchedule();
            });
        }

        const prevWeekBtn = document.getElementById('prev-week');
        const nextWeekBtn = document.getElementById('next-week');
        
        if (prevWeekBtn) {
            prevWeekBtn.addEventListener('click', () => {
                const newDate = new Date(this.weekStartDate);
                newDate.setDate(newDate.getDate() - 7);
                this.weekStartDate = newDate;
                this.updateDatePicker();
                this.loadSchedule();
            });
        }

        if (nextWeekBtn) {
            nextWeekBtn.addEventListener('click', () => {
                const newDate = new Date(this.weekStartDate);
                newDate.setDate(newDate.getDate() + 7);
                this.weekStartDate = newDate;
                this.updateDatePicker();
                this.loadSchedule();
            });
        }
    }

    updateDatePicker() {
        const datePicker = document.getElementById('productivity-date');
        if (datePicker) {
            datePicker.value = this.formatDate(this.weekStartDate);
        }
    }

    async loadSchedule() {
        try {
            const weekStartStr = this.formatDate(this.weekStartDate);
            const response = await fetch(`/api/productivity/${weekStartStr}?week=true`);
            if (response.ok) {
                this.schedule = await response.json();
                this.render();
                this.loadWeekSidebar();
            } else {
                console.error('Failed to load schedule');
            }
        } catch (error) {
            console.error('Error loading schedule:', error);
        }
    }

    async loadObligations() {
        try {
            const response = await fetch('/api/obligations');
            if (response.ok) {
                this.obligations = await response.json();
                this.renderSidebar();
            }
        } catch (error) {
            console.error('Error loading obligations:', error);
        }
    }

    async loadHabits() {
        try {
            const response = await fetch('/api/habits');
            if (response.ok) {
                this.habits = await response.json();
                this.renderSidebar();
            }
        } catch (error) {
            console.error('Error loading habits:', error);
        }
    }

    async loadWeekSidebar() {
        await Promise.all([
            this.loadWeekObligations(),
            this.loadWeekHabits()
        ]);
    }

    async loadWeekObligations() {
        try {
            const weekDates = this.getWeekDates();
            const weekStart = weekDates[0];
            const weekEnd = new Date(weekDates[6]);
            weekEnd.setHours(23, 59, 59, 999);

            const weekObligations = this.obligations.filter(ob => {
                if (!ob.due_at || ob.status === 'done') return false;
                const dueDate = new Date(ob.due_at);
                return dueDate >= weekStart && dueDate <= weekEnd;
            });

            this.renderWeekObligations(weekObligations);
        } catch (error) {
            console.error('Error loading obligations:', error);
        }
    }

    async loadWeekHabits() {
        this.renderWeekHabits(this.habits);
    }

    renderWeekObligations(obligations) {
        const container = document.getElementById('week-reminders');
        if (!container) return;

        if (obligations.length === 0) {
            container.innerHTML = '<div class="sidebar-empty">No obligations this week</div>';
            return;
        }

        let html = '<div class="sidebar-section-title">Obligations</div>';
        obligations.forEach(ob => {
            const dueDate = new Date(ob.due_at);
            const dateStr = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const duration = ob.estimated_duration || 15; // Default 15 minutes
            html += `
                <div class="draggable-item" draggable="true" data-type="obligation" data-id="${ob.id}" data-title="${this.escapeHtml(ob.title)}" data-duration="${duration}">
                    <div class="sidebar-item-title">${this.escapeHtml(ob.title)}</div>
                    <div class="sidebar-item-meta">${dateStr} • ${duration} min</div>
                </div>
            `;
        });

        container.innerHTML = html;
        this.setupDragListeners();
    }

    renderWeekHabits(habits) {
        const container = document.getElementById('week-habits');
        if (!container) return;

        if (habits.length === 0) {
            container.innerHTML = '<div class="sidebar-empty">No habits</div>';
            return;
        }

        let html = '<div class="sidebar-section-title">Habits</div>';
        
        const weekDates = this.getWeekDates();
        
        habits.forEach(habit => {
            let hoursLogged = 0;
            weekDates.forEach(date => {
                const dateStr = this.formatDate(date);
                const daySchedule = this.schedule[dateStr] || [];
                daySchedule.forEach(block => {
                    if (block.content && block.content.toLowerCase().includes(habit.name.toLowerCase())) {
                        const start = this.timeToMinutes(block.start_time);
                        const end = this.timeToMinutes(block.end_time);
                        hoursLogged += (end - start) / 60;
                    }
                });
            });

            const hoursRemaining = Math.max(0, (habit.hours_per_week || 0) - hoursLogged);
            const progress = habit.hours_per_week > 0 
                ? Math.min(100, (hoursLogged / habit.hours_per_week) * 100) 
                : 0;
            const defaultLength = habit.default_length || 60;

            html += `
                <div class="draggable-item" draggable="true" data-type="habit" data-id="${habit.id}" data-name="${this.escapeHtml(habit.name)}" data-duration="${defaultLength}">
                    <div class="sidebar-habit-item">
                        <div class="sidebar-habit-name">${this.escapeHtml(habit.name)}</div>
                        <div class="sidebar-habit-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${progress}%"></div>
                            </div>
                            <div class="progress-text">${hoursLogged.toFixed(1)}/${habit.hours_per_week || 0} hrs (${hoursRemaining.toFixed(1)} left)</div>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
        this.setupDragListeners();
    }

    setupDragListeners() {
        document.querySelectorAll('.draggable-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                this.draggedItem = {
                    type: e.target.dataset.type,
                    id: e.target.dataset.id,
                    title: e.target.dataset.title || e.target.dataset.name,
                    duration: parseInt(e.target.dataset.duration, 10)
                };
                e.dataTransfer.effectAllowed = 'copy';
            });
        });
    }

    timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    minutesToTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }

    render() {
        const container = document.getElementById('productivity-blocks');
        if (!container) return;

        const weekDates = this.getWeekDates();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let html = '<div class="productivity-timeline">';
        
        weekDates.forEach(date => {
            const dateStr = this.formatDate(date);
            const isToday = date.toDateString() === today.toDateString();
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNum = date.getDate();
            const month = date.toLocaleDateString('en-US', { month: 'short' });
            const dayBlocks = this.schedule[dateStr] || [];

            html += `
                <div class="timeline-day ${isToday ? 'today' : ''}" data-date="${dateStr}">
                    <div class="day-header">
                        <div class="day-name">${dayName}</div>
                        <div class="day-date">${month} ${dayNum}</div>
                    </div>
                    <div class="timeline-track" data-date="${dateStr}">
                        ${this.renderTimeGrid()}
                        ${this.renderBlocks(dayBlocks, dateStr)}
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

        this.setupTimelineInteractions();
    }

    renderTimeGrid() {
        let html = '<div class="time-grid">';
        for (let hour = 9; hour <= 23; hour++) {
            html += `<div class="time-marker" style="top: ${((hour - 9) / 15) * 100}%">${this.formatHour(hour)}</div>`;
        }
        html += '</div>';
        return html;
    }

    renderBlocks(blocks, dateStr) {
        let html = '<div class="blocks-container">';
        blocks.forEach(block => {
            const startMinutes = this.timeToMinutes(block.start_time);
            const endMinutes = this.timeToMinutes(block.end_time);
            const startPercent = ((startMinutes - 9 * 60) / (15 * 60)) * 100;
            const heightPercent = ((endMinutes - startMinutes) / (15 * 60)) * 100;
            
            html += `
                <div class="time-block" 
                     style="top: ${startPercent}%; height: ${heightPercent}%"
                     data-block-id="${block.id}"
                     data-date="${dateStr}">
                    <div class="block-content">${this.escapeHtml(block.content)}</div>
                    <button class="block-delete" data-block-id="${block.id}" data-date="${dateStr}">×</button>
                </div>
            `;
        });
        html += '</div>';
        return html;
    }

    formatHour(hour) {
        if (hour === 0) return '12a';
        if (hour < 12) return `${hour}a`;
        if (hour === 12) return '12p';
        return `${hour - 12}p`;
    }

    setupTimelineInteractions() {
        document.querySelectorAll('.timeline-track').forEach(track => {
            // Click-drag to create block
            let isDragging = false;
            let startY = 0;
            let endY = 0;
            let previewBlock = null;

            track.addEventListener('mousedown', (e) => {
                if (e.target.closest('.time-block') || e.target.closest('.draggable-item')) return;
                
                isDragging = true;
                startY = e.offsetY;
                endY = e.offsetY;
                const rect = track.getBoundingClientRect();
                const date = track.dataset.date;
                
                previewBlock = this.createPreviewBlock(track, startY, endY, date);
                e.preventDefault();
            });

            track.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                endY = e.offsetY;
                if (previewBlock) {
                    this.updatePreviewBlock(previewBlock, startY, endY);
                }
            });

            track.addEventListener('mouseup', async (e) => {
                if (!isDragging) return;
                isDragging = false;
                
                const date = track.dataset.date;
                const startTime = this.yToTime(startY, track);
                const endTime = this.yToTime(endY, track);
                
                if (previewBlock) {
                    previewBlock.remove();
                    previewBlock = null;
                }

                // If dragged from sidebar, use that data
                if (this.draggedItem) {
                    await this.createBlockFromDrag(date, startTime, endTime, this.draggedItem);
                    this.draggedItem = null;
                } else {
                    // Create empty block and edit immediately
                    await this.createBlock(date, startTime, endTime, '');
                    this.editBlockImmediately(date, startTime, endTime);
                }
            });

            // Handle drop from sidebar
            track.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            });

            track.addEventListener('drop', async (e) => {
                e.preventDefault();
                if (!this.draggedItem) return;

                const rect = track.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const date = track.dataset.date;
                const startTime = this.yToTime(y, track);
                const duration = this.draggedItem.duration;
                const endTime = this.addMinutes(startTime, duration);

                await this.createBlockFromDrag(date, startTime, endTime, this.draggedItem);
                this.draggedItem = null;
            });
        });

        // Delete block buttons
        document.querySelectorAll('.block-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const blockId = e.target.dataset.blockId;
                const date = e.target.dataset.date;
                await this.deleteBlock(date, blockId);
            });
        });
    }

    yToTime(y, track) {
        const rect = track.getBoundingClientRect();
        const height = rect.height;
        const percent = y / height;
        const totalMinutes = 9 * 60 + (percent * 15 * 60); // 9am to 11pm = 15 hours
        return this.minutesToTime(Math.max(9 * 60, Math.min(23 * 60, totalMinutes)));
    }

    addMinutes(timeStr, minutes) {
        const totalMinutes = this.timeToMinutes(timeStr) + minutes;
        return this.minutesToTime(Math.min(23 * 60, totalMinutes));
    }

    createPreviewBlock(track, startY, endY, date) {
        const block = document.createElement('div');
        block.className = 'time-block preview';
        block.style.top = `${(Math.min(startY, endY) / track.offsetHeight) * 100}%`;
        block.style.height = `${(Math.abs(endY - startY) / track.offsetHeight) * 100}%`;
        track.querySelector('.blocks-container').appendChild(block);
        return block;
    }

    updatePreviewBlock(block, startY, endY) {
        const track = block.closest('.timeline-track');
        block.style.top = `${(Math.min(startY, endY) / track.offsetHeight) * 100}%`;
        block.style.height = `${(Math.abs(endY - startY) / track.offsetHeight) * 100}%`;
    }

    async createBlock(date, startTime, endTime, content) {
        try {
            const response = await fetch(`/api/productivity/${date}/blocks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    start_time: startTime,
                    end_time: endTime,
                    content: content
                })
            });

            if (response.ok) {
                await this.loadSchedule();
            }
        } catch (error) {
            console.error('Error creating block:', error);
        }
    }

    async createBlockFromDrag(date, startTime, endTime, item) {
        const content = item.title || item.name;
        await this.createBlock(date, startTime, endTime, content);
    }

    async deleteBlock(date, blockId) {
        try {
            const response = await fetch(`/api/productivity/${date}/blocks/${blockId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await this.loadSchedule();
            }
        } catch (error) {
            console.error('Error deleting block:', error);
        }
    }

    editBlockImmediately(date, startTime, endTime) {
        // Find the newly created block and open edit modal
        const daySchedule = this.schedule[date] || [];
        const block = daySchedule.find(b => b.start_time === startTime && b.end_time === endTime);
        if (block) {
            this.showEditBlockModal(block, date);
        }
    }

    showEditBlockModal(block, date) {
        // Create simple inline edit
        const blockElement = document.querySelector(`[data-block-id="${block.id}"]`);
        if (!blockElement) return;

        const contentDiv = blockElement.querySelector('.block-content');
        const input = document.createElement('input');
        input.type = 'text';
        input.value = block.content;
        input.className = 'block-edit-input';
        
        contentDiv.style.display = 'none';
        blockElement.appendChild(input);
        input.focus();
        input.select();

        const save = async () => {
            const newContent = input.value.trim();
            await this.updateBlock(date, block.id, { content: newContent });
            input.remove();
            contentDiv.style.display = '';
        };

        input.addEventListener('blur', save);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            }
        });
    }

    async updateBlock(date, blockId, updates) {
        try {
            const response = await fetch(`/api/productivity/${date}/blocks/${blockId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });

            if (response.ok) {
                await this.loadSchedule();
            }
        } catch (error) {
            console.error('Error updating block:', error);
        }
    }

    renderSidebar() {
        this.loadWeekObligations();
        this.loadWeekHabits();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize productivity app
let productivityApp;
document.addEventListener('DOMContentLoaded', () => {
    productivityApp = new ProductivityApp();
    
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            if (view === 'productivity' && productivityApp) {
                setTimeout(() => {
                    productivityApp.loadSchedule();
                }, 100);
            }
        });
    });
});

