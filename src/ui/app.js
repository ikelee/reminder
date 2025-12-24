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
        this.loadObligations();
        this.render();
        
        // Update every minute
        setInterval(() => {
            this.loadObligations();
        }, 60000);
    }

    setupEventListeners() {
        const input = document.getElementById('obligation-input');
        const followupInput = document.getElementById('followup-input');
        const followupSubmit = document.getElementById('followup-submit');
        const followupCancel = document.getElementById('followup-cancel');

        input.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                await this.handleInput(input.value);
                input.value = '';
            }
        });

        followupSubmit.addEventListener('click', async () => {
            const followupText = followupInput.value.trim();
            if (followupText) {
                await this.handleFollowup(followupText);
            }
        });

        followupCancel.addEventListener('click', () => {
            this.hideFollowup();
        });

        followupInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                followupSubmit.click();
            }
        });

        // Voice help button
        const voiceHelpBtn = document.getElementById('voice-help-btn');
        const voiceHelpDetails = document.getElementById('voice-help-details');
        const voiceHelpClose = document.getElementById('voice-help-close');
        
        if (voiceHelpBtn && voiceHelpDetails) {
            voiceHelpBtn.addEventListener('click', () => {
                voiceHelpDetails.classList.toggle('hidden');
            });
        }
        
        if (voiceHelpClose && voiceHelpDetails) {
            voiceHelpClose.addEventListener('click', () => {
                voiceHelpDetails.classList.add('hidden');
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
                    // Clear the input field after voice submission
                    const input = document.getElementById('obligation-input');
                    if (input) {
                        input.value = '';
                    }
                }
            });
            
            // Also allow clicking the microphone indicator to toggle
            const indicator = document.getElementById('voice-indicator');
            if (indicator && this.voiceInput) {
                indicator.addEventListener('click', () => {
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
                this.showFollowup(text, data.result);
            } else {
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
            this.hideFollowup();
        } catch (error) {
            console.error('Error adding obligation:', error);
            this.hideFollowup();
        } finally {
            this.setLoading(false);
        }
    }

    showFollowup(text, result) {
        this.pendingText = text;
        this.pendingResult = result;
        const followupSection = document.getElementById('followup-section');
        const followupInput = document.getElementById('followup-input');
        followupSection.classList.remove('hidden');
        followupInput.focus();
    }

    hideFollowup() {
        const followupSection = document.getElementById('followup-section');
        const followupInput = document.getElementById('followup-input');
        followupSection.classList.add('hidden');
        followupInput.value = '';
        this.pendingText = null;
        this.pendingResult = null;
        document.getElementById('obligation-input').focus();
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
        try {
            const response = await fetch(`/api/obligations/${id}/toggle`, {
                method: 'PATCH'
            });
            if (response.ok) {
                await this.loadObligations();
            }
        } catch (error) {
            console.error('Error toggling obligation:', error);
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

        const groups = {
            now: [],
            today: [],
            thisWeek: [],
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
                    groups.thisWeek.push(obligation);
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
        let html = '';

        if (groups.missed.length > 0) {
            html += this.renderGroup('Missed', groups.missed, 'missed');
        }
        if (groups.now.length > 0) {
            html += this.renderGroup('Now', groups.now, 'now');
        }
        if (groups.today.length > 0) {
            html += this.renderGroup('Today', groups.today, 'today');
        }
        if (groups.thisWeek.length > 0) {
            html += this.renderGroup('This week', groups.thisWeek, 'this-week');
        }
        if (groups.later.length > 0) {
            html += this.renderGroup('Later', groups.later, 'later');
        }

        list.innerHTML = html || '<div class="empty-state">All obligations completed!</div>';
    }

    renderGroup(title, obligations, className) {
        const items = obligations.map(obligation => {
            const timeDisplay = this.formatTimeWindow(obligation);
            const isMissed = obligation.status === 'missed';
            const isDone = obligation.status === 'done';
            const duration = obligation.estimated_duration ? `${obligation.estimated_duration} min` : null;
            const dueDate = obligation.due_at ? this.formatForDateTimeInput(obligation.due_at) : '';
            
            return `
                <div class="obligation-item ${isMissed ? 'missed' : ''} ${isDone ? 'done' : ''} ${className}" data-id="${obligation.id}">
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
        }).join('');

        return `
            <div class="obligation-group">
                <div class="group-header">${title}</div>
                ${items}
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
        const followupInput = document.getElementById('followup-input');
        const followupSubmit = document.getElementById('followup-submit');
        const spinner = document.getElementById('loading-spinner');
        
        if (input) {
            input.disabled = loading;
        }
        if (followupInput) {
            followupInput.disabled = loading;
        }
        if (followupSubmit) {
            followupSubmit.disabled = loading;
        }
        if (spinner) {
            spinner.style.display = loading ? 'block' : 'none';
        }
    }
}

// Initialize app
const app = new ObligationApp();
