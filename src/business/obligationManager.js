/**
 * Obligation Manager - Server-side storage and management
 */

const fs = require('fs');
const path = require('path');
const { emit_metric } = require('../helpers/metrics');

class ObligationManager {
    constructor() {
        this.dataFile = path.join(__dirname, '..', '..', 'data', 'obligations.json');
        this.ensureDataDir();
        this.obligations = this.loadObligations();
        this.autoAcceptDelay = 30 * 1000; // 30 seconds in milliseconds
        this.immediateDeleteThreshold = 10 * 1000; // 10 seconds for "immediate" deletion
        this.autoAcceptTimers = new Map(); // Track timers for auto-acceptance
    }

    ensureDataDir() {
        const dataDir = path.dirname(this.dataFile);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    loadObligations() {
        try {
            if (fs.existsSync(this.dataFile)) {
                const data = fs.readFileSync(this.dataFile, 'utf8');
                const obligations = JSON.parse(data);
                
                // Migrate old obligations to include metrics if missing
                let needsSave = false;
                obligations.forEach(obligation => {
                    if (!obligation.metrics) {
                        obligation.metrics = {
                            auto_accepted: false,
                            date_changed: false,
                            time_changed: false,
                            duration_changed: false,
                            task_type_changed: false,
                            deleted_immediately: false
                        };
                        needsSave = true;
                    }
                    if (!obligation._original) {
                        obligation._original = {
                            due_at: obligation.due_at,
                            estimated_duration: obligation.estimated_duration,
                            task_type: obligation.task_type || null
                        };
                        needsSave = true;
                    }
                });
                
                if (needsSave) {
                    this.obligations = obligations;
                    this.saveObligations();
                }
                
                return obligations;
            }
        } catch (error) {
            console.error('Error loading obligations:', error);
        }
        return [];
    }

    saveObligations() {
        try {
            fs.writeFileSync(this.dataFile, JSON.stringify(this.obligations, null, 2));
        } catch (error) {
            console.error('Error saving obligations:', error);
            throw error;
        }
    }

    getAll() {
        this.updateMissedStatus();
        return this.obligations;
    }

    add(obligationData) {
        const now = Date.now();
        const obligation = {
            id: now.toString(),
            title: obligationData.title || 'Untitled obligation',
            due_at: obligationData.due_at,
            estimated_duration: obligationData.estimated_duration,
            task_type: obligationData.task_type || null,
            urgency: obligationData.urgency,
            status: 'pending',
            created_at: new Date().toISOString(),
            // Metrics fields
            metrics: {
                auto_accepted: false,
                date_changed: false,
                time_changed: false,
                duration_changed: false,
                task_type_changed: false,
                deleted_immediately: false
            },
            // Store original values for change tracking
            _original: {
                due_at: obligationData.due_at,
                estimated_duration: obligationData.estimated_duration,
                task_type: obligationData.task_type || null
            }
        };

        this.obligations.push(obligation);
        this.saveObligations();
        
        // Set timer for auto-acceptance
        const timer = setTimeout(() => {
            this.checkAutoAccept(obligation.id);
        }, this.autoAcceptDelay);
        this.autoAcceptTimers.set(obligation.id, timer);
        
        return obligation;
    }

    update(id, updates) {
        const obligation = this.obligations.find(o => o.id === id);
        if (obligation) {
            // Clear auto-accept timer if it exists (obligation is being edited)
            const timer = this.autoAcceptTimers.get(id);
            if (timer) {
                clearTimeout(timer);
                this.autoAcceptTimers.delete(id);
            }
            
            // Track changes before updating
            const oldDueAt = obligation.due_at;
            const oldDuration = obligation.estimated_duration;
            const oldTaskType = obligation.task_type;
            
            // Extract date and time from due_at for comparison
            const extractDate = (isoString) => {
                if (!isoString) return null;
                return isoString.split('T')[0];
            };
            
            const extractTime = (isoString) => {
                if (!isoString) return null;
                const timePart = isoString.split('T')[1];
                if (!timePart) return null;
                return timePart.substring(0, 5); // HH:mm
            };
            
            const oldDate = extractDate(oldDueAt);
            const oldTime = extractTime(oldDueAt);
            
            // Apply updates
            Object.assign(obligation, updates);
            
            // Track metric changes
            if (updates.due_at !== undefined) {
                const newDate = extractDate(updates.due_at);
                const newTime = extractTime(updates.due_at);
                
                if (oldDate !== newDate) {
                    obligation.metrics.date_changed = true;
                    emit_metric('date_changed', {
                        obligation_id: id,
                        old_date: oldDate,
                        new_date: newDate,
                        title: obligation.title
                    });
                }
                
                if (oldTime !== newTime && oldDate === newDate) {
                    // Time changed but date stayed the same
                    obligation.metrics.time_changed = true;
                    emit_metric('time_changed', {
                        obligation_id: id,
                        old_time: oldTime,
                        new_time: newTime,
                        title: obligation.title
                    });
                } else if (oldDate !== newDate) {
                    // Date changed, so time also effectively changed
                    obligation.metrics.time_changed = true;
                }
            }
            
            if (updates.estimated_duration !== undefined && oldDuration !== updates.estimated_duration) {
                obligation.metrics.duration_changed = true;
                emit_metric('duration_changed', {
                    obligation_id: id,
                    old_duration: oldDuration,
                    new_duration: updates.estimated_duration,
                    title: obligation.title
                });
            }
            
            if (updates.task_type !== undefined && oldTaskType !== updates.task_type) {
                obligation.metrics.task_type_changed = true;
                emit_metric('task_type_changed', {
                    obligation_id: id,
                    old_task_type: oldTaskType,
                    new_task_type: updates.task_type,
                    title: obligation.title
                });
            }
            
            // Recalculate status if due_at was updated
            if (updates.due_at !== undefined && obligation.status !== 'done') {
                const now = new Date();
                const dueAt = new Date(obligation.due_at);
                
                if (dueAt < now) {
                    obligation.status = 'missed';
                } else {
                    obligation.status = 'pending';
                }
            }
            
            this.saveObligations();
            return obligation;
        }
        return null;
    }

    toggleDone(id) {
        const obligation = this.obligations.find(o => o.id === id);
        if (obligation) {
            obligation.status = obligation.status === 'done' ? 'pending' : 'done';
            this.saveObligations();
            return obligation;
        }
        return null;
    }

    delete(id) {
        const index = this.obligations.findIndex(o => o.id === id);
        if (index !== -1) {
            const deleted = this.obligations.splice(index, 1)[0];
            
            // Clear auto-accept timer if it exists
            const timer = this.autoAcceptTimers.get(id);
            if (timer) {
                clearTimeout(timer);
                this.autoAcceptTimers.delete(id);
            }
            
            // Check if deleted immediately (within threshold of creation)
            const createdTime = new Date(deleted.created_at).getTime();
            const now = Date.now();
            const timeSinceCreation = now - createdTime;
            
            if (timeSinceCreation < this.immediateDeleteThreshold) {
                deleted.metrics.deleted_immediately = true;
                emit_metric('deleted_immediately', {
                    obligation_id: id,
                    time_since_creation_ms: timeSinceCreation,
                    title: deleted.title
                });
            }
            
            this.saveObligations();
            return deleted;
        }
        return null;
    }
    
    checkAutoAccept(id) {
        const obligation = this.obligations.find(o => o.id === id);
        if (!obligation) return;
        
        // Only mark as auto-accepted if no edits have been made
        const hasEdits = obligation.metrics.date_changed || 
                         obligation.metrics.time_changed || 
                         obligation.metrics.duration_changed || 
                         obligation.metrics.task_type_changed;
        
        if (!hasEdits && !obligation.metrics.auto_accepted) {
            obligation.metrics.auto_accepted = true;
            emit_metric('auto_accepted', {
                obligation_id: id,
                title: obligation.title,
                time_since_creation_ms: this.autoAcceptDelay
            });
            this.saveObligations();
        }
        
        // Clean up timer
        this.autoAcceptTimers.delete(id);
    }

    updateMissedStatus() {
        const now = new Date();
        let changed = false;
        
        this.obligations.forEach(obligation => {
            if (obligation.status !== 'done' && obligation.due_at) {
                const dueAt = new Date(obligation.due_at);
                if (dueAt < now && obligation.status !== 'missed') {
                    obligation.status = 'missed';
                    changed = true;
                }
            }
        });

        if (changed) {
            this.saveObligations();
        }
    }

    clearAll() {
        this.obligations = [];
        this.saveObligations();
        return { success: true, count: 0 };
    }

    loadSamples() {
        // Helper to create ISO string with timezone
        const createISO = (year, month, day, hour, minute) => {
            // Create date in local timezone
            const date = new Date(year, month - 1, day, hour, minute, 0);
            const timezoneOffset = -date.getTimezoneOffset();
            const offsetHours = Math.floor(Math.abs(timezoneOffset) / 60);
            const offsetMinutes = Math.abs(timezoneOffset) % 60;
            const offsetSign = timezoneOffset >= 0 ? '+' : '-';
            const offsetStr = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
            
            const y = String(year).padStart(4, '0');
            const m = String(month).padStart(2, '0');
            const d = String(day).padStart(2, '0');
            const h = String(hour).padStart(2, '0');
            const min = String(minute).padStart(2, '0');
            return `${y}-${m}-${d}T${h}:${min}:00${offsetStr}`;
        };

        const samples = [
            // Overdue (past dates)
            { title: 'Submit expense report', due_at: createISO(2025, 12, 20, 17, 0), task_type: 'business', estimated_duration: 30, urgency: 'normal', status: 'missed' },
            { title: 'Call mom', due_at: createISO(2025, 12, 21, 19, 0), task_type: 'personal', estimated_duration: 20, urgency: 'normal', status: 'missed' },
            { title: 'Review contract', due_at: createISO(2025, 12, 22, 14, 0), task_type: 'business', estimated_duration: 60, urgency: 'normal', status: 'missed' },
            
            // Very soon (today/tomorrow)
            { title: 'Pick up dry cleaning', due_at: createISO(2025, 12, 23, 18, 0), task_type: 'personal', estimated_duration: 15, urgency: 'normal', status: 'pending' },
            { title: 'Team standup meeting', due_at: createISO(2025, 12, 24, 9, 0), task_type: 'business', estimated_duration: 30, urgency: 'normal', status: 'pending' },
            { title: 'Dinner with friends', due_at: createISO(2025, 12, 24, 19, 0), task_type: 'social', estimated_duration: 120, urgency: 'normal', status: 'pending' },
            { title: 'Buy groceries', due_at: createISO(2025, 12, 24, 10, 0), task_type: 'personal', estimated_duration: 45, urgency: 'normal', status: 'pending' },
            
            // This week
            { title: 'Doctor appointment', due_at: createISO(2025, 12, 26, 14, 0), task_type: 'business', estimated_duration: 60, urgency: 'normal', status: 'pending' },
            { title: 'Gym session', due_at: createISO(2025, 12, 27, 19, 0), task_type: 'personal', estimated_duration: 90, urgency: 'normal', status: 'pending' },
            { title: 'Weekend brunch', due_at: createISO(2025, 12, 28, 11, 0), task_type: 'social', estimated_duration: 90, urgency: 'normal', status: 'pending' },
            { title: 'Review quarterly report', due_at: createISO(2025, 12, 30, 16, 0), task_type: 'business', estimated_duration: 120, urgency: 'normal', status: 'pending' },
            
            // Next week
            { title: 'Client presentation', due_at: createISO(2026, 1, 2, 10, 0), task_type: 'business', estimated_duration: 60, urgency: 'normal', status: 'pending' },
            { title: 'Practice guitar', due_at: createISO(2026, 1, 3, 20, 0), task_type: 'personal', estimated_duration: 60, urgency: 'normal', status: 'pending' },
            { title: 'Lunch with colleague', due_at: createISO(2026, 1, 4, 12, 30), task_type: 'social', estimated_duration: 60, urgency: 'normal', status: 'pending' },
            
            // Further out
            { title: 'Submit tax forms', due_at: createISO(2026, 1, 15, 17, 0), task_type: 'business', estimated_duration: 180, urgency: 'normal', status: 'pending' },
            { title: 'Dentist cleaning', due_at: createISO(2026, 1, 20, 9, 0), task_type: 'business', estimated_duration: 60, urgency: 'normal', status: 'pending' },
            { title: 'Birthday party', due_at: createISO(2026, 2, 5, 18, 0), task_type: 'social', estimated_duration: 180, urgency: 'normal', status: 'pending' },
            { title: 'Project deadline', due_at: createISO(2026, 2, 15, 17, 0), task_type: 'business', estimated_duration: null, urgency: 'normal', status: 'pending' },
            { title: 'Vacation planning', due_at: createISO(2026, 3, 1, 10, 0), task_type: 'personal', estimated_duration: 120, urgency: 'normal', status: 'pending' },
            { title: 'Annual review meeting', due_at: createISO(2026, 3, 15, 14, 0), task_type: 'business', estimated_duration: 90, urgency: 'normal', status: 'pending' },
        ];

        // Add IDs, created_at, and metrics to samples
        const nowMs = Date.now();
        samples.forEach((sample, index) => {
            sample.id = (nowMs + index).toString();
            sample.created_at = new Date(nowMs + index).toISOString();
            sample.metrics = {
                auto_accepted: false,
                date_changed: false,
                time_changed: false,
                duration_changed: false,
                task_type_changed: false,
                deleted_immediately: false
            };
            sample._original = {
                due_at: sample.due_at,
                estimated_duration: sample.estimated_duration,
                task_type: sample.task_type || null
            };
        });

        this.obligations = samples;
        this.saveObligations();
        return { success: true, count: samples.length };
    }
}

module.exports = ObligationManager;

