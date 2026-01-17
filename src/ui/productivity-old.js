/**
 * Productivity Tracking - Hourly blocks from 9am to 11pm
 */

class ProductivityApp {
    constructor() {
        this.weekStartDate = this.getWeekStartDate(new Date());
        this.schedule = {}; // Will contain schedule for all 7 days
        this.selectedBlocks = new Set(); // Set of "date:hour" strings
        this.isSelecting = false;
        this.selectionStart = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadSchedule();
    }

    getTodayDateString() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Get the start date of the week (Monday) for a given date
     */
    getWeekStartDate(date) {
        const d = new Date(date);
        // Ensure we're working with local date
        const year = d.getFullYear();
        const month = d.getMonth();
        const day = d.getDate();
        const localDate = new Date(year, month, day);
        
        const dayOfWeek = localDate.getDay();
        // Monday is day 1, Sunday is day 0
        // If Sunday (0), go back 6 days. Otherwise go back (dayOfWeek - 1) days
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        localDate.setDate(localDate.getDate() + diff);
        return localDate;
    }

    /**
     * Format date to YYYY-MM-DD
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Get all 7 dates in the current week
     */
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
        // Date picker - shows week start (Monday)
        const datePicker = document.getElementById('productivity-date');
        if (datePicker) {
            datePicker.value = this.formatDate(this.weekStartDate);
            datePicker.addEventListener('change', (e) => {
                const selectedDate = new Date(e.target.value);
                this.weekStartDate = this.getWeekStartDate(selectedDate);
                this.loadSchedule();
            });
        }

        // Week navigation buttons
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

    async loadWeekSidebar() {
        await Promise.all([
            this.loadWeekObligations(),
            this.loadWeekHabits()
        ]);
    }

    async loadWeekObligations() {
        try {
            const response = await fetch('/api/obligations');
            if (response.ok) {
                const obligations = await response.json();
                const weekDates = this.getWeekDates();
                const weekStart = weekDates[0];
                const weekEnd = new Date(weekDates[6]);
                weekEnd.setHours(23, 59, 59, 999);

                const weekObligations = obligations.filter(ob => {
                    if (!ob.due_at || ob.status === 'done') return false;
                    const dueDate = new Date(ob.due_at);
                    return dueDate >= weekStart && dueDate <= weekEnd;
                });

                this.renderWeekObligations(weekObligations);
            }
        } catch (error) {
            console.error('Error loading obligations:', error);
        }
    }

    async loadWeekHabits() {
        try {
            const response = await fetch('/api/habits');
            if (response.ok) {
                const habits = await response.json();
                this.renderWeekHabits(habits);
            }
        } catch (error) {
            console.error('Error loading habits:', error);
        }
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
            html += `
                <div class="sidebar-item">
                    <div class="sidebar-item-title">${this.escapeHtml(ob.title)}</div>
                    <div class="sidebar-item-meta">${dateStr}</div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    renderWeekHabits(habits) {
        const container = document.getElementById('week-habits');
        if (!container) return;

        if (habits.length === 0) {
            container.innerHTML = '<div class="sidebar-empty">No habits</div>';
            return;
        }

        let html = '<div class="sidebar-section-title">Habits</div>';
        
        // Calculate hours logged this week for each habit
        const weekDates = this.getWeekDates();
        
        habits.forEach(habit => {
            // Count hours where habit name appears in schedule
            let hoursLogged = 0;
            weekDates.forEach(date => {
                const dateStr = this.formatDate(date);
                const daySchedule = this.schedule[dateStr] || {};
                for (let hour = 9; hour <= 23; hour++) {
                    const block = daySchedule[hour];
                    if (block && block.content && 
                        block.content.toLowerCase().includes(habit.name.toLowerCase())) {
                        hoursLogged += 1; // Each block is 1 hour
                    }
                }
            });

            const hoursRemaining = Math.max(0, (habit.hours_per_week || 0) - hoursLogged);
            const progress = habit.hours_per_week > 0 
                ? Math.min(100, (hoursLogged / habit.hours_per_week) * 100) 
                : 0;

            html += `
                <div class="sidebar-habit-item">
                    <div class="sidebar-habit-name">${this.escapeHtml(habit.name)}</div>
                    <div class="sidebar-habit-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress}%"></div>
                        </div>
                        <div class="progress-text">${hoursLogged}/${habit.hours_per_week || 0} hrs (${hoursRemaining} left)</div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    async updateBlock(date, hour, content) {
        try {
            const response = await fetch(`/api/productivity/${date}/${hour}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });

            if (response.ok) {
                const block = await response.json();
                if (!this.schedule[date]) {
                    this.schedule[date] = {};
                }
                this.schedule[date][hour] = block;
                // Update the UI for that specific block
                this.updateBlockUI(date, hour, block);
                // Refresh sidebar to update habit progress
                this.loadWeekHabits();
            } else {
                console.error('Failed to update block');
            }
        } catch (error) {
            console.error('Error updating block:', error);
        }
    }

    updateBlockUI(date, hour, block) {
        const blockElement = document.querySelector(`[data-date="${date}"][data-hour="${hour}"]`);
        if (blockElement) {
            const input = blockElement.querySelector('.block-input');
            if (input) {
                input.value = block.content;
            }
        }
    }

    formatHour(hour) {
        // Compact format: 9a, 10a, 11a, 12p, 1p, etc.
        if (hour === 0) return '12a';
        if (hour < 12) return `${hour}a`;
        if (hour === 12) return '12p';
        return `${hour - 12}p`;
    }

    render() {
        const container = document.getElementById('productivity-blocks');
        if (!container) return;

        const weekDates = this.getWeekDates();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Create table header with day names
        let html = '<div class="productivity-week-table">';
        html += '<div class="week-header">';
        html += '<div class="hour-header"></div>'; // Empty cell for hour column
        weekDates.forEach(date => {
            const dateStr = this.formatDate(date);
            const isToday = date.toDateString() === today.toDateString();
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNum = date.getDate();
            const month = date.toLocaleDateString('en-US', { month: 'short' });
            
            html += `
                <div class="day-header ${isToday ? 'today' : ''}">
                    <div class="day-name">${dayName}</div>
                    <div class="day-date">${month} ${dayNum}</div>
                </div>
            `;
        });
        html += '</div>';

        // Create rows for each hour
        for (let hour = 9; hour <= 23; hour++) {
            html += '<div class="hour-row">';
            html += `<div class="hour-label">${this.formatHour(hour)}</div>`;
            
            weekDates.forEach(date => {
                const dateStr = this.formatDate(date);
                const daySchedule = this.schedule[dateStr] || {};
                const block = daySchedule[hour] || { hour, content: '', updated_at: null };
                const isPast = this.isHourPast(date, hour);
                
                html += `
                    <div class="productivity-block ${isPast ? 'past' : ''}" data-date="${dateStr}" data-hour="${hour}">
                        <input 
                            type="text" 
                            class="block-input" 
                            placeholder="..."
                            value="${this.escapeHtml(block.content)}"
                            data-date="${dateStr}"
                            data-hour="${hour}"
                        />
                    </div>
                `;
            });
            
            html += '</div>';
        }

        html += '</div>';
        container.innerHTML = html;

        // Setup drag selection
        this.setupDragSelection();

        // Add event listeners for inputs
        container.querySelectorAll('.block-input').forEach(input => {
            // Save on blur
            input.addEventListener('blur', (e) => {
                const date = e.target.dataset.date;
                const hour = parseInt(e.target.dataset.hour, 10);
                const content = e.target.value.trim();
                
                // If multiple blocks selected, save all of them
                if (this.selectedBlocks.size > 1) {
                    const key = `${date}:${hour}`;
                    if (this.selectedBlocks.has(key)) {
                        // Save all selected blocks
                        this.selectedBlocks.forEach(blockKey => {
                            const [blockDate, blockHour] = blockKey.split(':');
                            this.updateBlock(blockDate, parseInt(blockHour, 10), content);
                        });
                    } else {
                        // Just save this one
                        this.updateBlock(date, hour, content);
                    }
                } else {
                    // Just save this one
                    this.updateBlock(date, hour, content);
                }
            });

            // Save on Enter
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.target.blur();
                }
            });

            // Handle typing in selected blocks
            input.addEventListener('input', (e) => {
                if (this.selectedBlocks.size > 1) {
                    const key = `${e.target.dataset.date}:${e.target.dataset.hour}`;
                    if (this.selectedBlocks.has(key)) {
                        // Fill all selected blocks with the same content
                        this.fillSelectedBlocks(e.target.value);
                    }
                }
            });

            // Focus handling - select block when focused
            input.addEventListener('focus', (e) => {
                const date = e.target.dataset.date;
                const hour = e.target.dataset.hour;
                const key = `${date}:${hour}`;
                // If no selection or this block not in selection, select just this one
                if (this.selectedBlocks.size === 0 || !this.selectedBlocks.has(key)) {
                    this.clearSelection();
                    this.selectBlock(date, hour);
                }
            });
        });

        // ESC key to clear selection
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.clearSelection();
            }
        });

        // Click outside to clear selection
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.productivity-block') && !e.target.closest('.block-input')) {
                this.clearSelection();
            }
        });
    }

    setupDragSelection() {
        const container = document.getElementById('productivity-blocks');
        if (!container) return;

        let isDragging = false;
        let startBlock = null;
        let isClickingInput = false;

        container.addEventListener('mousedown', (e) => {
            const block = e.target.closest('.productivity-block');
            if (!block) return;

            // If clicking directly on input, allow normal input behavior
            if (e.target.classList.contains('block-input')) {
                isClickingInput = true;
                return;
            }

            // Otherwise, start drag selection
            e.preventDefault();
            e.stopPropagation();
            isDragging = true;
            isClickingInput = false;
            const date = block.dataset.date;
            const hour = block.dataset.hour;
            startBlock = { date, hour };
            
            this.clearSelection();
            this.selectBlock(date, hour);
            this.isSelecting = true;
        });

        container.addEventListener('mousemove', (e) => {
            if (!isDragging || !startBlock || isClickingInput) return;

            const block = e.target.closest('.productivity-block');
            if (!block) return;

            const date = block.dataset.date;
            const hour = block.dataset.hour;
            const endBlock = { date, hour };

            // Select range from start to end
            this.selectRange(startBlock, endBlock);
        });

        container.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                this.isSelecting = false;
                startBlock = null;
            }
            isClickingInput = false;
        });

        // Prevent text selection while dragging
        container.addEventListener('selectstart', (e) => {
            if (this.isSelecting) {
                e.preventDefault();
            }
        });
    }

    selectBlock(date, hour) {
        const key = `${date}:${hour}`;
        this.selectedBlocks.add(key);
        const block = document.querySelector(`[data-date="${date}"][data-hour="${hour}"]`);
        if (block) {
            block.classList.add('selected');
        }
    }

    selectRange(start, end) {
        this.clearSelection();
        
        // Get all blocks in the range
        const weekDates = this.getWeekDates();
        const startDateIndex = weekDates.findIndex(d => this.formatDate(d) === start.date);
        const endDateIndex = weekDates.findIndex(d => this.formatDate(d) === end.date);
        
        const startHour = parseInt(start.hour, 10);
        const endHour = parseInt(end.hour, 10);
        
        const minDateIndex = Math.min(startDateIndex, endDateIndex);
        const maxDateIndex = Math.max(startDateIndex, endDateIndex);
        const minHour = Math.min(startHour, endHour);
        const maxHour = Math.max(startHour, endHour);
        
        // Select all blocks in the rectangular range
        for (let i = minDateIndex; i <= maxDateIndex; i++) {
            const date = weekDates[i];
            const dateStr = this.formatDate(date);
            for (let hour = minHour; hour <= maxHour; hour++) {
                this.selectBlock(dateStr, hour);
            }
        }
    }

    clearSelection() {
        this.selectedBlocks.forEach(key => {
            const [date, hour] = key.split(':');
            const block = document.querySelector(`[data-date="${date}"][data-hour="${hour}"]`);
            if (block) {
                block.classList.remove('selected');
            }
        });
        this.selectedBlocks.clear();
    }

    fillSelectedBlocks(content) {
        this.selectedBlocks.forEach(key => {
            const [date, hour] = key.split(':');
            const block = document.querySelector(`[data-date="${date}"][data-hour="${hour}"]`);
            if (block) {
                const input = block.querySelector('.block-input');
                if (input && input !== document.activeElement) {
                    input.value = content;
                }
            }
        });
    }

    isHourPast(date, hour) {
        const now = new Date();
        const currentHour = now.getHours();
        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);
        
        const blockDate = new Date(date);
        blockDate.setHours(0, 0, 0, 0);
        
        // Check if date is in the past
        if (blockDate < currentDate) {
            return true;
        }
        
        // Check if it's today and hour is in the past
        if (blockDate.getTime() === currentDate.getTime()) {
            return hour < currentHour;
        }
        
        return false;
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
    
    // Reload schedule when switching to productivity view
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            if (view === 'productivity' && productivityApp) {
                // Small delay to ensure view is visible
                setTimeout(() => {
                    productivityApp.loadSchedule();
                }, 100);
            }
        });
    });
});

