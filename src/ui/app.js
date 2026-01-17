/**
 * Minimal web UI - just calls API
 */

class ObligationApp {
    constructor() {
        this.obligations = [];
        this.pendingText = null;
        this.pendingResult = null;
        this.isLoading = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupVoiceInput();
        this.setupNavigation();
        this.loadObligations();
        this.render();
        
        // Update every minute
        setInterval(() => {
            this.loadObligations();
        }, 60000);
    }

    setupNavigation() {
        const sidebar = document.querySelector('.sidebar');
        const menuToggle = document.querySelector('.menu-toggle');
        const appLayout = document.querySelector('.app-layout');
        
        // Track sidebar hover state for CSS
        if (sidebar && appLayout) {
            sidebar.addEventListener('mouseenter', () => {
                appLayout.classList.add('sidebar-hovered');
            });
            sidebar.addEventListener('mouseleave', () => {
                appLayout.classList.remove('sidebar-hovered');
            });
        }
        
        // Handle navigation clicks - use event delegation for dynamically created items
        document.addEventListener('click', (e) => {
            const navItem = e.target.closest('.nav-item');
            if (navItem) {
                e.preventDefault();
                e.stopPropagation();
                const view = navItem.dataset.view;
                if (view) {
                    this.switchView(view);
                    this.closeSidebar();
                    
                    // Load data when switching views
                    if (view === 'habits' && typeof habitsApp !== 'undefined') {
                        habitsApp.loadHabits();
                    }
                    if (view === 'productivity' && typeof productivityApp !== 'undefined') {
                        setTimeout(() => {
                            productivityApp.loadSchedule();
                        }, 100);
                    }
                }
            }
        });
    }

    closeSidebar() {
        // Force sidebar to close by removing hover classes and resetting styles
        const sidebar = document.querySelector('.sidebar');
        const menuToggle = document.querySelector('.menu-toggle');
        const appLayout = document.querySelector('.app-layout');
        
        if (sidebar && menuToggle && appLayout) {
            appLayout.classList.remove('sidebar-hovered');
            // Force close by temporarily disabling pointer events
            sidebar.style.pointerEvents = 'none';
            sidebar.style.left = '-200px';
            menuToggle.style.left = '20px';
            // Reset after transition completes
            setTimeout(() => {
                sidebar.style.pointerEvents = '';
                sidebar.style.left = '';
                menuToggle.style.left = '';
            }, 300);
        }
    }

    switchView(viewName) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            const isActive = item.dataset.view === viewName;
            if (isActive) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Update views - hide all first, then show the active one
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.add('active');
        }
    }

    setupEventListeners() {
        // Ask view input
        const askInput = document.getElementById('ask-input');
        const askFollowupInput = document.getElementById('ask-followup-input');
        const askFollowupSubmit = document.getElementById('ask-followup-submit');
        const askFollowupCancel = document.getElementById('ask-followup-cancel');

        if (askInput) {
            askInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    await this.handleInput(askInput.value);
                    askInput.value = '';
                }
            });
        }

        if (askFollowupSubmit) {
            askFollowupSubmit.addEventListener('click', async () => {
                const followupText = askFollowupInput.value.trim();
                if (followupText) {
                    await this.handleFollowup(followupText);
                }
            });
        }

        if (askFollowupCancel) {
            askFollowupCancel.addEventListener('click', () => {
                this.hideFollowup('ask');
            });
        }

        if (askFollowupInput) {
            askFollowupInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    askFollowupSubmit.click();
                }
            });
        }

        // Ask voice help button
        const askVoiceHelpBtn = document.getElementById('ask-voice-help-btn');
        const askVoiceHelpDetails = document.getElementById('ask-voice-help-details');
        const askVoiceHelpClose = document.getElementById('ask-voice-help-close');
        
        if (askVoiceHelpBtn && askVoiceHelpDetails) {
            askVoiceHelpBtn.addEventListener('click', () => {
                askVoiceHelpDetails.classList.toggle('hidden');
            });
        }
        
        if (askVoiceHelpClose && askVoiceHelpDetails) {
            askVoiceHelpClose.addEventListener('click', () => {
                askVoiceHelpDetails.classList.add('hidden');
            });
        }

        // Obligations view granular form
        const obligationSubmitBtn = document.getElementById('obligation-submit-btn');
        const obligationTitleInput = document.getElementById('obligation-title-input');
        const obligationDateInput = document.getElementById('obligation-date-input');
        const obligationDurationInput = document.getElementById('obligation-duration-input');

        if (obligationSubmitBtn) {
            obligationSubmitBtn.addEventListener('click', async () => {
                await this.handleGranularObligation();
            });
        }

        if (obligationTitleInput) {
            obligationTitleInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    await this.handleGranularObligation();
                }
            });
        }

        // Edit overlay handlers
        document.addEventListener('click', (e) => {
            if (e.target.dataset.action === 'edit-date' || e.target.dataset.action === 'edit-duration') {
                e.stopPropagation();
                const id = e.target.dataset.id;
                
                // Find the obligation to get both date and duration
                const obligation = this.obligations.find(o => o.id === id);
                if (obligation) {
                    const date = obligation.due_at || '';
                    const duration = obligation.estimated_duration || '';
                    this.showEditOverlay(e.target, id, date, duration);
                }
            }
        });

        // Close overlay when clicking outside
        document.addEventListener('click', (e) => {
            const overlay = document.getElementById('edit-overlay');
            if (overlay && !overlay.contains(e.target) && !e.target.dataset.action) {
                this.hideEditOverlay();
            }
        });

    }

    setupVoiceInput() {
        if (typeof VoiceInput !== 'undefined') {
            this.voiceInput = new VoiceInput(async (transcript) => {
                // Voice input just populates the field in real-time
                // Auto-submission happens on recording end
            });
            
            // Listen for voice submit event
            document.addEventListener('voiceSubmit', async (e) => {
                const text = e.detail.text;
                if (text && !this.isLoading) {
                    await this.handleInput(text);
                    // Clear the appropriate input field after voice submission
                    const askInput = document.getElementById('ask-input');
                    const obligationInput = document.getElementById('obligation-input');
                    const askView = document.getElementById('ask-view');
                    const input = (askView && askView.classList.contains('active')) ? askInput : obligationInput;
                    if (input) {
                        input.value = '';
                    }
                }
            });
            
            // Also allow clicking the microphone indicators to toggle
            const indicator = document.getElementById('voice-indicator');
            const askIndicator = document.getElementById('ask-voice-indicator');
            
            if (indicator && this.voiceInput) {
                indicator.addEventListener('click', () => {
                    this.voiceInput.toggleRecording();
                });
            }
            
            if (askIndicator && this.voiceInput) {
                askIndicator.addEventListener('click', () => {
                    this.voiceInput.toggleRecording();
                });
            }
        }
    }

    async handleInput(text) {
        if (!text.trim() || this.isLoading) return;

        this.setLoading(true);
        try {
            const response = await fetch('/api/obligations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            const data = await response.json();

            if (data.needs_clarification) {
                // Determine which view we're in
                const askView = document.getElementById('ask-view');
                const view = askView && askView.classList.contains('active') ? 'ask' : 'obligations';
                this.showFollowup(text, data.result, view);
            } else {
                await this.loadObligations();
            }
        } catch (error) {
            console.error('Error adding obligation:', error);
        } finally {
            this.setLoading(false);
        }
    }

    async handleGranularObligation() {
        const titleInput = document.getElementById('obligation-title-input');
        const dateInput = document.getElementById('obligation-date-input');
        const durationInput = document.getElementById('obligation-duration-input');

        const title = titleInput?.value.trim();
        const date = dateInput?.value;
        const duration = durationInput?.value.trim();

        if (!title || this.isLoading) return;

        this.setLoading(true);
        try {
            // Build the text string for the API
            let text = title;
            if (date) {
                const dateObj = new Date(date);
                const dateStr = dateObj.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                text += ` on ${dateStr}`;
            }
            if (duration) {
                text += ` (${duration} minutes)`;
            }

            const response = await fetch('/api/obligations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            const data = await response.json();

            if (!data.needs_clarification) {
                // Clear form
                if (titleInput) titleInput.value = '';
                if (dateInput) dateInput.value = '';
                if (durationInput) durationInput.value = '';
                await this.loadObligations();
            }
        } catch (error) {
            console.error('Error adding obligation:', error);
        } finally {
            this.setLoading(false);
        }
    }

    async handleFollowup(followupText) {
        if (this.isLoading) return;
        
        const originalText = this.pendingText;
        this.setLoading(true);
        
        try {
            const response = await fetch('/api/obligations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: originalText, followup: followupText })
            });

            const data = await response.json();
            
            if (data.error) {
                console.error('Could not parse date:', data.error);
            } else {
                await this.loadObligations();
            }
            // Determine which view we're in
            const askView = document.getElementById('ask-view');
            const view = askView && askView.classList.contains('active') ? 'ask' : 'obligations';
            this.hideFollowup(view);
        } catch (error) {
            console.error('Error adding obligation:', error);
            const askView = document.getElementById('ask-view');
            const view = askView && askView.classList.contains('active') ? 'ask' : 'obligations';
            this.hideFollowup(view);
        } finally {
            this.setLoading(false);
        }
    }

    showFollowup(text, result, view = 'obligations') {
        this.pendingText = text;
        this.pendingResult = result;
        const prefix = view === 'ask' ? 'ask-' : '';
        const followupSection = document.getElementById(`${prefix}followup-section`);
        const followupInput = document.getElementById(`${prefix}followup-input`);
        if (followupSection && followupInput) {
            followupSection.classList.remove('hidden');
            followupInput.focus();
        }
    }

    hideFollowup(view = 'obligations') {
        const prefix = view === 'ask' ? 'ask-' : '';
        const followupSection = document.getElementById(`${prefix}followup-section`);
        const followupInput = document.getElementById(`${prefix}followup-input`);
        if (followupSection && followupInput) {
            followupSection.classList.add('hidden');
            followupInput.value = '';
        }
        this.pendingText = null;
        this.pendingResult = null;
        
        // Focus the appropriate input
        const input = view === 'ask' 
            ? document.getElementById('ask-input')
            : document.getElementById('obligation-input');
        if (input) {
            input.focus();
        }
    }

    async loadObligations() {
        try {
            const response = await fetch('/api/obligations');
            this.obligations = await response.json();
            this.render();
        } catch (error) {
            console.error('Error loading obligations:', error);
        }
    }

    async toggleDone(id) {
        const itemElement = document.querySelector(`[data-id="${id}"]`);
        const checkbox = itemElement?.querySelector('.obligation-checkbox');
        
        if (!itemElement || !checkbox) return;
        
        const isBecomingDone = checkbox.checked;
        
        // If marking as done, play celebration animation then collapse
        if (isBecomingDone) {
            // Add done class for celebration animation
            itemElement.classList.add('done');
            // Wait for celebration animation (600ms)
            await new Promise(resolve => setTimeout(resolve, 600));
            
            // Add collapsing class to slide items up
            itemElement.classList.add('collapsing');
            // Wait for collapse animation (350ms)
            await new Promise(resolve => setTimeout(resolve, 350));
            
            // Remove from DOM after animation completes
            itemElement.remove();
        }
        
        try {
            // Update backend
            const response = await fetch(`/api/obligations/${id}/toggle`, {
                method: 'PATCH'
            });
            
            if (response.ok) {
                // Update local data without re-rendering
                const obligation = this.obligations.find(o => o.id === id);
                if (obligation) {
                    obligation.status = obligation.status === 'done' ? 'pending' : 'done';
                }
                
                // Only re-render if unchecking (to show the item again)
                if (!isBecomingDone) {
                    await this.loadObligations();
                }
            } else {
                // If API call failed, reload to restore correct state
                await this.loadObligations();
            }
        } catch (error) {
            console.error('Error toggling obligation:', error);
            // Reload to restore correct state
            await this.loadObligations();
        }
    }

    showEditOverlay(targetElement, id, currentDate, currentDuration) {
        // Remove existing overlay if any
        const existing = document.getElementById('edit-overlay');
        if (existing) {
            existing.remove();
        }

        // Get position of target element
        const rect = targetElement.getBoundingClientRect();
        const scrollY = window.scrollY;
        const scrollX = window.scrollX;

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'edit-overlay';
        overlay.className = 'edit-overlay';
        overlay.style.top = `${rect.top + scrollY - 120}px`;
        overlay.style.left = `${rect.left + scrollX}px`;

        const dateValue = currentDate ? this.formatForDateTimeInput(currentDate) : '';
        const durationValue = currentDuration || '';

        overlay.innerHTML = `
            <div class="edit-overlay-content">
                <div class="edit-field">
                    <label>Due Date & Time</label>
                    <input type="datetime-local" id="edit-date-input" value="${dateValue}" />
                </div>
                <div class="edit-field">
                    <label>Duration (minutes)</label>
                    <input type="number" id="edit-duration-input" value="${durationValue}" placeholder="e.g. 15" min="1" />
                </div>
                <div class="edit-actions">
                    <button class="edit-save" onclick="app.saveEdit('${id}')">Save</button>
                    <button class="edit-cancel" onclick="app.hideEditOverlay()">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        
        // Focus first input
        setTimeout(() => {
            const dateInput = document.getElementById('edit-date-input');
            if (dateInput) dateInput.focus();
        }, 10);
    }

    hideEditOverlay() {
        const overlay = document.getElementById('edit-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    async saveEdit(id) {
        const dateInput = document.getElementById('edit-date-input');
        const durationInput = document.getElementById('edit-duration-input');
        
        const dateValue = dateInput.value;
        const durationValue = durationInput.value.trim();

        const updates = {};
        
        if (dateValue) {
            const isoString = this.dateTimeInputToISO(dateValue);
            if (isoString) {
                updates.due_at = isoString;
            }
        } else {
            updates.due_at = null;
        }

        if (durationValue === '') {
            updates.estimated_duration = null;
        } else {
            const duration = parseInt(durationValue);
            if (!isNaN(duration) && duration > 0) {
                updates.estimated_duration = duration;
            }
        }

        this.hideEditOverlay();
        await this.updateObligation(id, updates);
    }

    async updateObligation(id, updates) {
        try {
            const response = await fetch(`/api/obligations/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            if (response.ok) {
                await this.loadObligations();
            } else {
                console.error('Failed to update obligation');
            }
        } catch (error) {
            console.error('Error updating obligation:', error);
        }
    }

    groupByTimeHorizon(obligations) {
        const now = new Date();
        // Create date boundaries in local timezone (midnight local time)
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const weekFromNow = new Date(today);
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        const monthFromNow = new Date(today);
        monthFromNow.setDate(monthFromNow.getDate() + 30);

        const groups = {
            now: [],
            today: [],
            soon: [],
            later: [],
            missed: []
        };

        obligations.forEach(obligation => {
            if (obligation.status === 'missed') {
                groups.missed.push(obligation);
            } else if (obligation.status === 'done') {
                return;
            } else if (obligation.due_at) {
                const dueAt = new Date(obligation.due_at);
                const hoursUntil = (dueAt - now) / (1000 * 60 * 60);

                if (hoursUntil < 0) {
                    groups.missed.push(obligation);
                } else if (hoursUntil < 2) {
                    groups.now.push(obligation);
                } else if (dueAt < tomorrow) {
                    groups.today.push(obligation);
                } else if (dueAt < weekFromNow) {
                    // Due this week
                    groups.soon.push(obligation);
                } else if (dueAt < monthFromNow && obligation.estimated_duration) {
                    // Due within a month AND has estimated duration
                    groups.soon.push(obligation);
                } else {
                    groups.later.push(obligation);
                }
            } else {
                groups.later.push(obligation);
            }
        });

        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => {
                const aDate = a.due_at ? new Date(a.due_at) : new Date(9999999999999);
                const bDate = b.due_at ? new Date(b.due_at) : new Date(9999999999999);
                return aDate - bDate;
            });
        });

        return groups;
    }

    render() {
        const list = document.getElementById('obligation-list');
        
        if (this.obligations.length === 0) {
            list.innerHTML = '<div class="empty-state">No obligations yet. Enter one above.</div>';
            return;
        }

        const groups = this.groupByTimeHorizon(this.obligations);
        
        // Combine urgent items (missed, now, today, immediate urgency)
        const urgentItems = [
            ...groups.missed,
            ...groups.now,
            ...groups.today,
            ...this.obligations.filter(o => o.urgency === 'immediate' && o.status !== 'done' && o.status !== 'missed')
        ];
        
        // Remove duplicates from urgentItems
        const uniqueUrgent = Array.from(new Map(urgentItems.map(item => [item.id, item])).values());
        
        // 3-column layout
        let html = '<div class="columns-container">';
        
        // Left column - Urgent
        html += '<div class="column urgent-column">';
        html += '<div class="column-header">Urgent</div>';
        if (uniqueUrgent.length > 0) {
            html += '<div class="column-content">';
            uniqueUrgent.forEach(obligation => {
                html += this.renderItem(obligation, true); // Pass true for isUrgent
            });
            html += '</div>';
        } else {
            html += '<div class="column-empty">All clear!</div>';
        }
        html += '</div>';
        
        // Middle column - Soon
        html += '<div class="column soon-column">';
        html += '<div class="column-header">Soon</div>';
        if (groups.soon.length > 0) {
            html += '<div class="column-content">';
            groups.soon.forEach(obligation => {
                html += this.renderItem(obligation, false);
            });
            html += '</div>';
        } else {
            html += '<div class="column-empty">Nothing scheduled</div>';
        }
        html += '</div>';
        
        // Right column - Later
        html += '<div class="column later-column">';
        html += '<div class="column-header">Later</div>';
        if (groups.later.length > 0) {
            html += '<div class="column-content">';
            groups.later.forEach(obligation => {
                html += this.renderItem(obligation, false);
            });
            html += '</div>';
        } else {
            html += '<div class="column-empty">Nothing planned</div>';
        }
        html += '</div>';
        
        html += '</div>';
        
        list.innerHTML = html;
    }

    renderItem(obligation, isUrgent = false) {
        const timeDisplay = this.formatTimeWindow(obligation);
        const isDone = obligation.status === 'done';
        const duration = obligation.estimated_duration ? `${obligation.estimated_duration} min` : null;
        const dueDate = obligation.due_at ? this.formatForDateTimeInput(obligation.due_at) : '';
        
        return `
            <div class="obligation-item ${isUrgent ? 'urgent' : ''} ${isDone ? 'done' : ''}" data-id="${obligation.id}">
                <input 
                    type="checkbox" 
                    class="obligation-checkbox" 
                    ${isDone ? 'checked' : ''}
                    onchange="app.toggleDone('${obligation.id}')"
                />
                <div class="obligation-content">
                    <div class="obligation-title">${this.escapeHtml(obligation.title)}</div>
                    <div class="obligation-meta">
                        <span class="obligation-time" data-action="edit-date" data-id="${obligation.id}" data-date="${dueDate}" title="Click to edit due date">${timeDisplay}</span>
                        ${duration ? `<span class="obligation-duration" data-action="edit-duration" data-id="${obligation.id}" data-duration="${obligation.estimated_duration}" title="Click to edit duration">${duration}</span>` : '<span class="obligation-duration" data-action="edit-duration" data-id="' + obligation.id + '" data-duration="" title="Click to add duration">+ duration</span>'}
                    </div>
                </div>
            </div>
        `;
    }

    // Parse ISO string with timezone to local date/time components
    parseLocalDateTime(isoString) {
        // Parse the ISO string - it may have timezone offset
        const date = new Date(isoString);
        // Get local time components (not UTC)
        return {
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate(),
            hour: date.getHours(),
            minute: date.getMinutes()
        };
    }

    // Format ISO string for datetime-local input (YYYY-MM-DDTHH:mm)
    formatForDateTimeInput(isoString) {
        if (!isoString) return '';
        const dt = this.parseLocalDateTime(isoString);
        const month = String(dt.month).padStart(2, '0');
        const day = String(dt.day).padStart(2, '0');
        const hour = String(dt.hour).padStart(2, '0');
        const minute = String(dt.minute).padStart(2, '0');
        return `${dt.year}-${month}-${day}T${hour}:${minute}`;
    }

    // Convert datetime-local value back to ISO string with timezone
    dateTimeInputToISO(dateTimeValue) {
        if (!dateTimeValue) return null;
        // datetime-local gives us local time, create Date object
        const date = new Date(dateTimeValue);
        // Format as ISO with timezone offset
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        const second = String(date.getSeconds()).padStart(2, '0');
        const offset = -date.getTimezoneOffset();
        const offsetHours = Math.floor(Math.abs(offset) / 60);
        const offsetMinutes = Math.abs(offset) % 60;
        const offsetSign = offset >= 0 ? '+' : '-';
        const offsetStr = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
        return `${year}-${month}-${day}T${hour}:${minute}:${second}${offsetStr}`;
    }

    formatTimeWindow(obligation) {
        if (!obligation.due_at) {
            return 'No date set';
        }

        const now = new Date();
        const dueAt = new Date(obligation.due_at);
        
        // Get local date components for comparison (ignore time)
        const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dueAtDate = new Date(dueAt.getFullYear(), dueAt.getMonth(), dueAt.getDate());
        
        // Calculate difference in days (local dates)
        const diffMs = dueAtDate - nowDate;
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        
        const diff = dueAt - now;
        const diffHours = diff / (1000 * 60 * 60);
        const isOverdue = diff < 0;

        // Format date and time in local timezone
        const dateStr = dueAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const timeStr = dueAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        
        if (isOverdue) {
            return `Overdue: ${dateStr} ${timeStr}`;
        } else if (diffDays === 0) {
            // Same day
            if (diffHours < 1) {
                const minutes = Math.floor(diffHours * 60);
                return minutes <= 0 ? `now (${timeStr})` : `in ${minutes}m (${timeStr})`;
            }
            return `Today ${timeStr}`;
        } else if (diffDays === 1) {
            return `Tomorrow ${timeStr}`;
        } else {
            return `${dateStr} ${timeStr}`;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }


    setLoading(loading) {
        this.isLoading = loading;
        const input = document.getElementById('obligation-input');
        const askInput = document.getElementById('ask-input');
        const obligationTitleInput = document.getElementById('obligation-title-input');
        const obligationDateInput = document.getElementById('obligation-date-input');
        const obligationDurationInput = document.getElementById('obligation-duration-input');
        const obligationSubmitBtn = document.getElementById('obligation-submit-btn');
        const followupInput = document.getElementById('followup-input');
        const askFollowupInput = document.getElementById('ask-followup-input');
        const followupSubmit = document.getElementById('followup-submit');
        const askFollowupSubmit = document.getElementById('ask-followup-submit');
        const spinner = document.getElementById('loading-spinner');
        const askSpinner = document.getElementById('ask-loading-spinner');
        const obligationSpinner = document.getElementById('obligation-loading-spinner');
        
        if (input) {
            input.disabled = loading;
        }
        if (askInput) {
            askInput.disabled = loading;
        }
        if (obligationTitleInput) {
            obligationTitleInput.disabled = loading;
        }
        if (obligationDateInput) {
            obligationDateInput.disabled = loading;
        }
        if (obligationDurationInput) {
            obligationDurationInput.disabled = loading;
        }
        if (obligationSubmitBtn) {
            obligationSubmitBtn.disabled = loading;
        }
        if (followupInput) {
            followupInput.disabled = loading;
        }
        if (askFollowupInput) {
            askFollowupInput.disabled = loading;
        }
        if (followupSubmit) {
            followupSubmit.disabled = loading;
        }
        if (askFollowupSubmit) {
            askFollowupSubmit.disabled = loading;
        }
        if (spinner) {
            spinner.style.display = loading ? 'block' : 'none';
        }
        if (askSpinner) {
            askSpinner.style.display = loading ? 'block' : 'none';
        }
        if (obligationSpinner) {
            obligationSpinner.style.display = loading ? 'block' : 'none';
        }
    }
}

// Initialize app
const app = new ObligationApp();
