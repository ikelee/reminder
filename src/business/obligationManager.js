/**
 * Obligation Manager - Server-side storage and management
 */

const fs = require('fs');
const path = require('path');

class ObligationManager {
    constructor() {
        this.dataFile = path.join(__dirname, '..', '..', 'data', 'obligations.json');
        this.ensureDataDir();
        this.obligations = this.loadObligations();
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
                return JSON.parse(data);
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
        const obligation = {
            id: Date.now().toString(),
            title: obligationData.title || 'Untitled obligation',
            due_at: obligationData.due_at,
            estimated_duration: obligationData.estimated_duration,
            urgency: obligationData.urgency,
            status: 'pending',
            created_at: new Date().toISOString()
        };

        this.obligations.push(obligation);
        this.saveObligations();
        return obligation;
    }

    update(id, updates) {
        const obligation = this.obligations.find(o => o.id === id);
        if (obligation) {
            Object.assign(obligation, updates);
            
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
            this.saveObligations();
            return deleted;
        }
        return null;
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

        // Add IDs and created_at to samples
        const nowMs = Date.now();
        samples.forEach((sample, index) => {
            sample.id = (nowMs + index).toString();
            sample.created_at = new Date(nowMs + index).toISOString();
        });

        this.obligations = samples;
        this.saveObligations();
        return { success: true, count: samples.length };
    }
}

module.exports = ObligationManager;

