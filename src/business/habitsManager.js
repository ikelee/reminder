/**
 * Habits Manager - Tracks habits with weekly hour goals
 */

const fs = require('fs');
const path = require('path');

class HabitsManager {
    constructor() {
        this.dataFile = path.join(__dirname, '..', '..', 'data', 'habits.json');
        this.ensureDataDir();
        this.habits = this.loadHabits();
    }

    ensureDataDir() {
        const dataDir = path.dirname(this.dataFile);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    loadHabits() {
        try {
            if (fs.existsSync(this.dataFile)) {
                const data = fs.readFileSync(this.dataFile, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading habits:', error);
        }
        return [];
    }

    saveHabits() {
        try {
            fs.writeFileSync(this.dataFile, JSON.stringify(this.habits, null, 2));
        } catch (error) {
            console.error('Error saving habits:', error);
            throw error;
        }
    }

    /**
     * Get all habits
     */
    getAll() {
        return this.habits;
    }

    /**
     * Add a new habit
     */
    add(habitData) {
        const habit = {
            id: Date.now().toString(),
            name: habitData.name || 'Untitled habit',
            category: habitData.category || null,
            hours_per_week: habitData.hours_per_week || 0,
            default_length: habitData.default_length || 60, // Default to 60 minutes
            created_at: new Date().toISOString()
        };

        this.habits.push(habit);
        this.saveHabits();
        return habit;
    }

    /**
     * Update a habit
     */
    update(id, updates) {
        const habit = this.habits.find(h => h.id === id);
        if (habit) {
            Object.assign(habit, updates);
            this.saveHabits();
            return habit;
        }
        return null;
    }

    /**
     * Delete a habit
     */
    delete(id) {
        const index = this.habits.findIndex(h => h.id === id);
        if (index !== -1) {
            const deleted = this.habits.splice(index, 1)[0];
            this.saveHabits();
            return deleted;
        }
        return null;
    }
}

module.exports = HabitsManager;

