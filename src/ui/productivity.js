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
        this.pendingEmptyBlocks = new Map(); // Track blocks waiting for input: blockId -> {date, track}
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
                const newSchedule = await response.json();
                console.log('Schedule loaded from server:', newSchedule);
                // Merge with existing schedule to preserve any local changes
                this.schedule = { ...this.schedule, ...newSchedule };
                console.log('Merged schedule:', this.schedule);
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
                <div class="draggable-item sidebar-item" draggable="true" data-type="obligation" data-id="${ob.id}" data-title="${this.escapeHtml(ob.title)}" data-duration="${duration}">
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
                if (Array.isArray(daySchedule)) {
                    daySchedule.forEach(block => {
                        if (block.content && block.content.toLowerCase().includes(habit.name.toLowerCase())) {
                            const start = this.timeToMinutes(block.start_time);
                            const end = this.timeToMinutes(block.end_time);
                            hoursLogged += (end - start) / 60;
                        }
                    });
                }
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
                // Get data from the closest draggable-item (in case we click on a child)
                const draggable = e.target.closest('.draggable-item');
                if (draggable) {
                    // Add dragging class to reduce opacity
                    draggable.classList.add('dragging');
                    
                    this.draggedItem = {
                        type: draggable.dataset.type,
                        id: draggable.dataset.id,
                        title: draggable.dataset.title || draggable.dataset.name,
                        duration: parseInt(draggable.dataset.duration, 10)
                    };
                    e.dataTransfer.effectAllowed = 'copy';
                    
                    // Hide the default browser drag image
                    const emptyImg = document.createElement('img');
                    emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                    emptyImg.style.width = '1px';
                    emptyImg.style.height = '1px';
                    emptyImg.style.opacity = '0';
                    emptyImg.style.position = 'absolute';
                    emptyImg.style.top = '-9999px';
                    document.body.appendChild(emptyImg);
                    e.dataTransfer.setDragImage(emptyImg, 0, 0);
                    setTimeout(() => emptyImg.remove(), 0);
                    
                    // Create floating preview that follows cursor
                    this.createFloatingPreview(e, this.draggedItem);
                }
            });
            
            item.addEventListener('dragend', (e) => {
                // Remove dragging class
                const draggable = e.target.closest('.draggable-item');
                if (draggable) {
                    draggable.classList.remove('dragging');
                }
                
                // Only clear if drop didn't happen (dragend fires after drop)
                // Use a small delay to allow drop handler to run first
                setTimeout(() => {
                    this.removeFloatingPreview();
                    this.hideDragPreview();
                    // Only clear if drop didn't happen
                    if (this.draggedItem) {
                        this.draggedItem = null;
                    }
                }, 100);
            });
        });
    }

    createFloatingPreview(e, item) {
        // Remove existing preview
        this.removeFloatingPreview();
        
        // Get actual column width from timeline day
        const timelineDay = document.querySelector('.timeline-day');
        const columnWidth = timelineDay ? timelineDay.offsetWidth : 120;
        
        const preview = document.createElement('div');
        preview.className = 'floating-drag-preview';
        preview.id = 'floating-drag-preview';
        
        // Calculate height based on duration (same as time block)
        const duration = item.duration;
        // Track height is 15 hours (900 minutes), calculate pixel height
        const track = document.querySelector('.timeline-track');
        const trackHeight = track ? track.offsetHeight : 900; // fallback to 900px
        const heightPercent = (duration / (15 * 60)) * 100; // 15 hours = 900 minutes
        const heightPx = (heightPercent / 100) * trackHeight;
        
        preview.style.width = `${columnWidth}px`;
        preview.style.height = `${Math.max(30, heightPx)}px`;
        preview.innerHTML = `<div class="block-content">${this.escapeHtml(item.title || item.name)}</div>`;
        document.body.appendChild(preview);
        
        // Position initially centered on cursor
        this.updateFloatingPreviewPosition(e);
        
        // Update position as cursor moves
        this.floatingPreviewHandler = (e) => {
            this.updateFloatingPreviewPosition(e);
        };
        document.addEventListener('dragover', this.floatingPreviewHandler);
    }

    updateFloatingPreviewPosition(e) {
        const preview = document.getElementById('floating-drag-preview');
        if (!preview) return;
        
        // Center preview on cursor
        const previewWidth = preview.offsetWidth || 120;
        const previewHeight = preview.offsetHeight || 30;
        preview.style.left = `${e.clientX - previewWidth / 2}px`;
        preview.style.top = `${e.clientY - previewHeight / 2}px`;
    }

    removeFloatingPreview() {
        const preview = document.getElementById('floating-drag-preview');
        if (preview) {
            preview.remove();
        }
        if (this.floatingPreviewHandler) {
            document.removeEventListener('dragover', this.floatingPreviewHandler);
            this.floatingPreviewHandler = null;
        }
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
            let dayBlocks = this.schedule[dateStr] || [];
            
            // Ensure it's an array (migration from old format)
            if (!Array.isArray(dayBlocks)) {
                dayBlocks = [];
            }
            
            console.log(`Rendering ${dateStr}:`, dayBlocks.length, 'blocks');

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
            if (!block.start_time || !block.end_time) return; // Skip invalid blocks
            
            const startMinutes = this.timeToMinutes(block.start_time);
            const endMinutes = this.timeToMinutes(block.end_time);
            const startPercent = ((startMinutes - 9 * 60) / (15 * 60)) * 100;
            const heightPercent = ((endMinutes - startMinutes) / (15 * 60)) * 100;
            
            // Ensure block is visible and has minimum height
            if (heightPercent < 0.5) return; // Skip blocks that are too small
            
            // Detect block type
            const blockType = this.detectBlockType(block);
            
            html += `
                <div class="time-block time-block-${blockType}" 
                     style="top: ${startPercent}%; height: ${Math.max(2, heightPercent)}%"
                     data-block-id="${block.id}"
                     data-date="${dateStr}"
                     data-block-type="${blockType}">
                    <div class="block-content">${this.escapeHtml(block.content || '')}</div>
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
        let currentTrack = null;
        let isDragging = false;
        let startY = 0;
        let endY = 0;
        let previewBlock = null;
        let trackRect = null; // Cache track rect - set once on mousedown

        document.querySelectorAll('.timeline-track').forEach(track => {
            // Handle mouse leave - delete pending empty blocks if mouse leaves before typing
            track.addEventListener('mouseleave', (e) => {
                // Check if there are any pending empty blocks for this track
                const date = track.dataset.date;
                const pendingForTrack = Array.from(this.pendingEmptyBlocks.entries()).filter(
                    ([blockId, info]) => info.date === date && info.track === track
                );
                
                for (const [blockId, info] of pendingForTrack) {
                    // Check if input has been created and is currently focused
                    const blockElement = document.querySelector(`[data-block-id="${blockId}"]`);
                    const input = blockElement?.querySelector('.block-edit-input');
                    const isInputFocused = input && document.activeElement === input;
                    
                    // Only delete if input hasn't been focused yet (user hasn't started interacting)
                    if (!isInputFocused) {
                        // Small delay to avoid race condition with input creation
                        setTimeout(() => {
                            const stillPending = this.pendingEmptyBlocks.has(blockId);
                            const blockEl = document.querySelector(`[data-block-id="${blockId}"]`);
                            const inputEl = blockEl?.querySelector('.block-edit-input');
                            const isFocused = inputEl && document.activeElement === inputEl;
                            
                            // Delete if still pending and input is not focused
                            if (stillPending && !isFocused) {
                                this.deletePendingBlock(blockId, date);
                            }
                        }, 100);
                    }
                }
            });
            
            track.addEventListener('mousedown', (e) => {
                // Don't start drag if clicking on a block or its children
                if (e.target.closest('.time-block') || e.target.closest('.draggable-item')) {
                    // If clicking on delete button, handle deletion
                    if (e.target.classList.contains('block-delete')) {
                        e.stopPropagation();
                        const block = e.target.closest('.time-block');
                        if (block) {
                            const blockId = block.dataset.blockId;
                            const date = block.dataset.date;
                            this.deleteBlock(date, blockId);
                        }
                        return;
                    }
                    // If clicking on a block (not delete button), edit it
                    const block = e.target.closest('.time-block');
                    if (block) {
                        e.stopPropagation();
                        const blockId = block.dataset.blockId;
                        const date = block.dataset.date;
                        const daySchedule = this.schedule[date] || [];
                        const blockData = daySchedule.find(b => b.id === blockId);
                        if (blockData) {
                            this.showEditBlockTooltip(block, blockData, date);
                        }
                    }
                    return;
                }
                
                isDragging = true;
                currentTrack = track;
                trackRect = track.getBoundingClientRect(); // Cache rect once
                const trackHeight = track.offsetHeight; // Cache height once
                startY = e.clientY - trackRect.top;
                endY = startY; // Start with same position
                
                // Create preview block immediately with minimal setup
                previewBlock = document.createElement('div');
                previewBlock.className = 'time-block preview';
                previewBlock.style.willChange = 'top, height';
                previewBlock.style.transform = 'translateZ(0)'; // GPU acceleration
                previewBlock.style.pointerEvents = 'none'; // Prevent any interaction
                const blocksContainer = track.querySelector('.blocks-container');
                if (blocksContainer) {
                    blocksContainer.appendChild(previewBlock);
                }
                
                // Initial position - force immediate render
                previewBlock.style.top = `${(startY / trackHeight) * 100}%`;
                previewBlock.style.height = '2%'; // Minimum height
                void previewBlock.offsetHeight; // Force layout
                
                e.preventDefault();
                e.stopPropagation();
            });

            // Handle drop from sidebar
            track.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                
                // Show preview when dragging over track
                if (this.draggedItem) {
                    const rect = track.getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    const startTime = this.yToTime(y, track, true); // Snap to 15 minutes
                    const duration = this.draggedItem.duration;
                    const endTime = this.addMinutes(startTime, duration);
                    
                    // Show preview block
                    this.showDragPreview(track, startTime, endTime, this.draggedItem);
                }
            });

            track.addEventListener('dragleave', (e) => {
                // Only hide if we're actually leaving the track (not just moving to a child element)
                if (!e.currentTarget.contains(e.relatedTarget)) {
                    this.hideDragPreview();
                    // Show floating preview again
                    const floatingPreview = document.getElementById('floating-drag-preview');
                    if (floatingPreview) {
                        floatingPreview.style.display = 'block';
                    }
                }
            });

            track.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.hideDragPreview();
                this.removeFloatingPreview();
                
                if (!this.draggedItem) return;

                const rect = track.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const date = track.dataset.date;
                const startTime = this.yToTime(y, track, true); // Snap to 15 minutes
                const duration = this.draggedItem.duration;
                const endTime = this.addMinutes(startTime, duration);

                console.log('Dropping item:', this.draggedItem, 'at date:', date, 'startTime:', startTime, 'endTime:', endTime);
                const block = await this.createBlockFromDrag(date, startTime, endTime, this.draggedItem);
                console.log('After createBlockFromDrag, checking schedule for date:', date);
                console.log('Schedule for this date:', this.schedule[date]);
                this.draggedItem = null;
            });
        });

        // Handle mouse move - ONLY update visual box, nothing else
        document.addEventListener('mousemove', (e) => {
            if (!isDragging || !currentTrack || !previewBlock || !trackRect) {
                return;
            }
            
            // Calculate new endY relative to track
            const newEndY = e.clientY - trackRect.top;
            
            // ONLY update visual - minimal calculations, direct style manipulation
            const trackHeight = currentTrack.offsetHeight;
            const minY = Math.min(startY, newEndY);
            const maxY = Math.max(startY, newEndY);
            const height = maxY - minY;
            
            // Direct style update - use transform for better performance (GPU accelerated)
            const topPercent = (minY / trackHeight) * 100;
            const boxHeightPercent = (height / trackHeight) * 100;
            previewBlock.style.top = `${topPercent}%`;
            previewBlock.style.height = `${boxHeightPercent}%`;
            
            // Force immediate repaint by reading a layout property
            // This ensures the browser applies the changes immediately
            void previewBlock.offsetHeight;
            
            // Store for mouseup
            endY = newEndY;
        }, { passive: true });

        document.addEventListener('mouseup', async (e) => {
            if (!isDragging || !currentTrack) {
                return;
            }
            
            isDragging = false;
            
            // Remove preview block immediately
            if (previewBlock) {
                previewBlock.remove();
                previewBlock = null;
            }
            
            // NOW do ALL calculations - only on mouseup
            const date = currentTrack.dataset.date;
            
            // Update endY one final time
            if (trackRect) {
                endY = e.clientY - trackRect.top;
            }
            
            // Ensure start is before end
            const minY = Math.min(startY, endY);
            const maxY = Math.max(startY, endY);
            
            // All expensive calculations happen here (snapping, time conversion)
            const startTime = this.yToTime(minY, currentTrack, true); // Snap to 15 minutes
            let endTime = this.yToTime(maxY, currentTrack, true); // Snap to 15 minutes
            
            // Ensure minimum block size (at least 15 minutes)
            const startMinutes = this.timeToMinutes(startTime);
            const endMinutes = this.timeToMinutes(endTime);
            if (endMinutes - startMinutes < 15) {
                endTime = this.addMinutes(startTime, 15);
            }

            // If dragged from sidebar, use that data
            if (this.draggedItem) {
                await this.createBlockFromDrag(date, startTime, endTime, this.draggedItem);
                this.draggedItem = null;
            } else {
                // Create empty block and edit immediately
                const newBlock = await this.createBlock(date, startTime, endTime, '', false); // Don't render yet
                if (newBlock) {
                    // Track this as a pending empty block
                    this.pendingEmptyBlocks.set(newBlock.id, { date, track: currentTrack });
                    // Render now that block is in schedule
                    this.render();
                    // Then edit immediately - use requestAnimationFrame to ensure DOM is ready
                    requestAnimationFrame(() => {
                        this.editBlockImmediately(newBlock.id, date);
                    });
                }
            }
            
            // Cleanup
            currentTrack = null;
            trackRect = null;
        });

        // Delete block buttons - use event delegation for dynamically created blocks
        document.addEventListener('click', async (e) => {
            if (e.target.classList.contains('block-delete')) {
                e.stopPropagation();
                e.preventDefault();
                const blockId = e.target.dataset.blockId;
                const date = e.target.dataset.date;
                if (blockId && date) {
                    await this.deleteBlock(date, blockId);
                }
            }
        });
    }

    yToTime(y, track, snap = false) {
        const rect = track.getBoundingClientRect();
        const height = rect.height;
        const percent = Math.max(0, Math.min(1, y / height));
        let totalMinutes = 9 * 60 + (percent * 15 * 60); // 9am to 11pm = 15 hours
        
        // Snap to 15-minute intervals
        if (snap) {
            totalMinutes = Math.round(totalMinutes / 15) * 15;
        }
        
        // Ensure we stay within 9am-11pm bounds
        totalMinutes = Math.max(9 * 60, Math.min(23 * 60, totalMinutes));
        return this.minutesToTime(totalMinutes);
    }

    addMinutes(timeStr, minutes) {
        const totalMinutes = this.timeToMinutes(timeStr) + minutes;
        return this.minutesToTime(Math.min(23 * 60, totalMinutes));
    }

    createPreviewBlock(track, startY, endY) {
        const block = document.createElement('div');
        block.className = 'time-block preview';
        const trackHeight = track.offsetHeight;
        const minY = Math.min(startY, endY);
        const height = Math.max(15, Math.abs(endY - startY)); // Minimum 15px height
        block.style.top = `${(minY / trackHeight) * 100}%`;
        block.style.height = `${(height / trackHeight) * 100}%`;
        block.style.willChange = 'top, height'; // Hint to browser for optimization
        const blocksContainer = track.querySelector('.blocks-container');
        if (blocksContainer) {
            blocksContainer.appendChild(block);
        }
        return block;
    }

    updatePreviewBlock(block, startY, endY) {
        const track = block.closest('.timeline-track');
        if (!track) return;
        this.updatePreviewBlockFast(block, startY, endY, track);
    }
    
    updatePreviewBlockFast(block, startY, endY, track) {
        const trackHeight = track.offsetHeight;
        const minY = Math.min(startY, endY);
        const height = Math.max(15, Math.abs(endY - startY)); // Minimum 15px height
        const topPercent = (minY / trackHeight) * 100;
        const heightPercent = (height / trackHeight) * 100;
        
        // Direct style manipulation for better performance
        block.style.top = `${topPercent}%`;
        block.style.height = `${heightPercent}%`;
    }

    async createBlock(date, startTime, endTime, content, shouldRender = true, blockType = 'regular') {
        try {
            const response = await fetch(`/api/productivity/${date}/blocks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    start_time: startTime,
                    end_time: endTime,
                    content: content,
                    block_type: blockType
                })
            });

            if (response.ok) {
                const newBlock = await response.json();
                console.log('Block created:', newBlock);
                console.log('Block date:', date, 'Block:', newBlock);
                
                // Add block to local schedule immediately
                if (!this.schedule[date]) {
                    this.schedule[date] = [];
                }
                // Remove any existing block with same ID (in case of update)
                this.schedule[date] = this.schedule[date].filter(b => b.id !== newBlock.id);
                // Preserve block_type if it exists
                if (newBlock.block_type) {
                    // Block type is already set from server
                } else if (typeof blockType !== 'undefined') {
                    newBlock.block_type = blockType;
                }
                this.schedule[date].push(newBlock);
                this.schedule[date].sort((a, b) => a.start_time.localeCompare(b.start_time));
                
                // Only render if requested (for drag-and-drop, we render separately)
                if (shouldRender) {
                    this.render();
                    
                    // Reload from server in background to ensure consistency
                    setTimeout(async () => {
                        await this.loadSchedule();
                    }, 100);
                }
                
                return newBlock;
            } else {
                const errorText = await response.text();
                console.error('Failed to create block:', response.status, errorText);
            }
        } catch (error) {
            console.error('Error creating block:', error);
        }
        return null;
    }

    async createBlockFromDrag(date, startTime, endTime, item) {
        const content = item.title || item.name;
        const blockType = item.type || 'regular'; // 'obligation', 'habit', or 'regular'
        const block = await this.createBlock(date, startTime, endTime, content, true, blockType);
        if (block) {
            console.log('Block created successfully:', block);
        } else {
            console.error('Failed to create block');
        }
        return block;
    }
    
    detectBlockType(block) {
        // Check if block has a stored type (highest priority)
        if (block.block_type) {
            return block.block_type;
        }
        
        // Check if block content matches an obligation
        const matchingObligation = this.obligations.find(ob => 
            ob.title === block.content && ob.status !== 'done'
        );
        if (matchingObligation) {
            return 'obligation';
        }
        
        // Check if block content matches a habit
        const matchingHabit = this.habits.find(habit => 
            habit.name === block.content
        );
        if (matchingHabit) {
            return 'habit';
        }
        
        return 'regular';
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

    editBlockImmediately(blockId, date) {
        // Find and edit the block immediately
        const daySchedule = this.schedule[date] || [];
        const block = daySchedule.find(b => b.id === blockId);
        if (block) {
            // Try to find the block element in the DOM
            const blockElement = document.querySelector(`[data-block-id="${blockId}"]`);
            if (blockElement) {
                this.showEditBlockModal(block, date);
            } else {
                // If not found, wait a bit for DOM to update
                setTimeout(() => {
                    const blockEl = document.querySelector(`[data-block-id="${blockId}"]`);
                    if (blockEl) {
                        this.showEditBlockModal(block, date);
                    } else {
                        console.warn('Block element not found for editing:', blockId, 'Retrying...');
                        // One more retry
                        setTimeout(() => {
                            const blockEl2 = document.querySelector(`[data-block-id="${blockId}"]`);
                            if (blockEl2) {
                                this.showEditBlockModal(block, date);
                            } else {
                                console.error('Block element not found after retries:', blockId);
                            }
                        }, 100);
                    }
                }, 50);
            }
        } else {
            console.warn('Block not found in schedule:', blockId);
        }
    }

    showEditBlockTooltip(blockElement, block, date) {
        // Remove any existing tooltip
        const existingTooltip = document.getElementById('block-edit-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }

        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.id = 'block-edit-tooltip';
        tooltip.className = 'block-edit-tooltip';
        
        // Position tooltip near the block
        const rect = blockElement.getBoundingClientRect();
        const scrollY = window.scrollY;
        const scrollX = window.scrollX;
        
        // Calculate time values
        const startTime = block.start_time || '09:00';
        const endTime = block.end_time || '10:00';
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);
        
        tooltip.innerHTML = `
            <div class="tooltip-content">
                <div class="tooltip-header">
                    <h3>Edit Block</h3>
                    <button class="tooltip-close" onclick="this.closest('.block-edit-tooltip').remove()">×</button>
                </div>
                <div class="tooltip-body">
                    <div class="tooltip-field">
                        <label>Content</label>
                        <input type="text" id="tooltip-content-input" value="${this.escapeHtml(block.content || '')}" />
                    </div>
                    <div class="tooltip-row">
                        <div class="tooltip-field">
                            <label>Start Time</label>
                            <input type="time" id="tooltip-start-time" value="${startTime}" />
                        </div>
                        <div class="tooltip-field">
                            <label>End Time</label>
                            <input type="time" id="tooltip-end-time" value="${endTime}" />
                        </div>
                    </div>
                    <div class="tooltip-actions">
                        <button class="tooltip-save-btn">Save</button>
                        <button class="tooltip-delete-btn">Delete</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(tooltip);
        
        // Position tooltip
        const tooltipRect = tooltip.getBoundingClientRect();
        let top = rect.top + scrollY + (rect.height / 2) - (tooltipRect.height / 2);
        let left = rect.right + scrollX + 20;
        
        // Adjust if tooltip goes off screen
        if (left + tooltipRect.width > window.innerWidth + scrollX) {
            left = rect.left + scrollX - tooltipRect.width - 20;
        }
        if (top + tooltipRect.height > window.innerHeight + scrollY) {
            top = window.innerHeight + scrollY - tooltipRect.height - 20;
        }
        if (top < scrollY) {
            top = scrollY + 20;
        }
        
        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
        
        // Event listeners
        const saveBtn = tooltip.querySelector('.tooltip-save-btn');
        const deleteBtn = tooltip.querySelector('.tooltip-delete-btn');
        const closeBtn = tooltip.querySelector('.tooltip-close');
        
        saveBtn.addEventListener('click', async () => {
            const content = tooltip.querySelector('#tooltip-content-input').value.trim();
            const startTime = tooltip.querySelector('#tooltip-start-time').value;
            const endTime = tooltip.querySelector('#tooltip-end-time').value;
            
            if (content && startTime && endTime) {
                await this.updateBlock(date, block.id, {
                    content: content,
                    start_time: startTime,
                    end_time: endTime
                });
            }
            tooltip.remove();
        });
        
        deleteBtn.addEventListener('click', async () => {
            await this.deleteBlock(date, block.id);
            tooltip.remove();
        });
        
        closeBtn.addEventListener('click', () => {
            tooltip.remove();
        });
        
        // Close on click outside
        setTimeout(() => {
            document.addEventListener('click', function closeTooltip(e) {
                if (!tooltip.contains(e.target) && !blockElement.contains(e.target)) {
                    tooltip.remove();
                    document.removeEventListener('click', closeTooltip);
                }
            });
        }, 100);
        
        // Focus first input
        tooltip.querySelector('#tooltip-content-input').focus();
    }

    showEditBlockModal(block, date) {
        // Create simple inline edit
        const blockElement = document.querySelector(`[data-block-id="${block.id}"]`);
        if (!blockElement) {
            console.warn('Block element not found for editing:', block.id);
            return;
        }

        // Don't create multiple edit inputs
        if (blockElement.querySelector('.block-edit-input')) {
            console.log('Input already exists for block:', block.id);
            return;
        }

        const contentDiv = blockElement.querySelector('.block-content');
        if (!contentDiv) {
            console.warn('Content div not found for block:', block.id);
            return;
        }
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = block.content || '';
        input.className = 'block-edit-input';
        
        contentDiv.style.display = 'none';
        blockElement.appendChild(input);
        
        // Use requestAnimationFrame to ensure DOM is ready before focusing
        requestAnimationFrame(() => {
            input.focus();
            input.select();
        });
        
        let hasTyped = false;
        let isSetupComplete = false;
        const isPendingEmpty = this.pendingEmptyBlocks.has(block.id);

        // Mark setup as complete after a short delay
        setTimeout(() => {
            isSetupComplete = true;
        }, 100);

        // Track if user has typed anything
        input.addEventListener('input', () => {
            hasTyped = true;
            // Remove from pending once user starts typing
            if (isPendingEmpty) {
                this.pendingEmptyBlocks.delete(block.id);
            }
        });

        const save = async () => {
            // Don't save if setup isn't complete yet (prevents premature deletion)
            if (!isSetupComplete) {
                console.log('Setup not complete, skipping save');
                return;
            }
            
            const newContent = input.value.trim();
            if (newContent) {
                await this.updateBlock(date, block.id, { content: newContent });
                // Remove from pending if it was there
                this.pendingEmptyBlocks.delete(block.id);
            } else {
                // Only delete if it's a pending empty block (user didn't type anything)
                // OR if user explicitly cleared the content after typing
                if (isPendingEmpty && !hasTyped) {
                    await this.deleteBlock(date, block.id);
                } else if (!hasTyped && block.content === '') {
                    // Empty block that was never edited
                    await this.deleteBlock(date, block.id);
                } else {
                    // User cleared content after typing - just update to empty
                    await this.updateBlock(date, block.id, { content: '' });
                }
            }
            // Remove from pending
            this.pendingEmptyBlocks.delete(block.id);
            // Don't remove input here, let the re-render handle it
        };

        const cancel = () => {
            input.remove();
            contentDiv.style.display = '';
            // If it's a pending empty block and user cancels, delete it
            if (isPendingEmpty && !hasTyped) {
                this.deletePendingBlock(block.id, date);
            }
        };

        // Use a small delay before attaching blur to prevent immediate deletion
        setTimeout(() => {
            input.addEventListener('blur', save);
        }, 50);
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            } else if (e.key === 'Escape') {
                cancel();
            }
        });
    }
    
    async deletePendingBlock(blockId, date) {
        this.pendingEmptyBlocks.delete(blockId);
        await this.deleteBlock(date, blockId);
    }

    showDragPreview(track, startTime, endTime, item) {
        // Remove existing track preview
        this.hideDragPreview();
        
        // Hide floating preview when showing track preview
        const floatingPreview = document.getElementById('floating-drag-preview');
        if (floatingPreview) {
            floatingPreview.style.display = 'none';
        }
        
        const startMinutes = this.timeToMinutes(startTime);
        const endMinutes = this.timeToMinutes(endTime);
        const startPercent = ((startMinutes - 9 * 60) / (15 * 60)) * 100;
        const heightPercent = ((endMinutes - startMinutes) / (15 * 60)) * 100;
        
        const preview = document.createElement('div');
        preview.className = 'time-block drag-preview';
        preview.style.top = `${startPercent}%`;
        preview.style.height = `${Math.max(2, heightPercent)}%`;
        preview.style.left = '0';
        preview.style.right = '0';
        preview.style.width = '100%';
        preview.id = 'drag-preview-block';
        preview.innerHTML = `<div class="block-content">${this.escapeHtml(item.title || item.name)}</div>`;
        
        track.querySelector('.blocks-container').appendChild(preview);
    }

    hideDragPreview() {
        const preview = document.getElementById('drag-preview-block');
        if (preview) {
            preview.remove();
        }
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

