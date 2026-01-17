/**
 * Productivity Manager - Tracks hourly productivity blocks
 */

const fs = require('fs');
const path = require('path');

class ProductivityManager {
    constructor() {
        this.dataFile = path.join(__dirname, '..', '..', 'data', 'productivity.json');
        this.ensureDataDir();
        this.schedule = this.loadSchedule();
    }

    ensureDataDir() {
        const dataDir = path.dirname(this.dataFile);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    loadSchedule() {
        try {
            if (fs.existsSync(this.dataFile)) {
                const data = fs.readFileSync(this.dataFile, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading productivity schedule:', error);
        }
        return {};
    }

    saveSchedule() {
        try {
            fs.writeFileSync(this.dataFile, JSON.stringify(this.schedule, null, 2));
        } catch (error) {
            console.error('Error saving productivity schedule:', error);
            throw error;
        }
    }

    /**
     * Get schedule for a specific date (YYYY-MM-DD format)
     * Returns array of time blocks
     */
    getSchedule(date) {
        if (!this.schedule[date]) {
            this.schedule[date] = [];
        }
        // Migrate old format if needed
        if (typeof this.schedule[date] === 'object' && !Array.isArray(this.schedule[date])) {
            const oldBlocks = this.schedule[date];
            this.schedule[date] = [];
            for (let hour = 9; hour <= 23; hour++) {
                if (oldBlocks[hour] && oldBlocks[hour].content) {
                    this.schedule[date].push({
                        id: Date.now().toString() + hour,
                        start_time: `${String(hour).padStart(2, '0')}:00`,
                        end_time: `${String(hour + 1).padStart(2, '0')}:00`,
                        content: oldBlocks[hour].content,
                        created_at: oldBlocks[hour].updated_at || new Date().toISOString(),
                        updated_at: oldBlocks[hour].updated_at || new Date().toISOString()
                    });
                }
            }
            this.saveSchedule();
        }
        return this.schedule[date];
    }

    /**
     * Add or update a time block
     */
    addBlock(date, blockData) {
        if (!this.schedule[date]) {
            this.schedule[date] = [];
        }

        const block = {
            id: blockData.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
            start_time: blockData.start_time,
            end_time: blockData.end_time,
            content: blockData.content || '',
            block_type: blockData.block_type || 'regular',
            created_at: blockData.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // If updating, remove old block first
        if (blockData.id) {
            this.schedule[date] = this.schedule[date].filter(b => b.id !== blockData.id);
        }

        this.schedule[date].push(block);
        // Sort by start_time
        this.schedule[date].sort((a, b) => a.start_time.localeCompare(b.start_time));
        this.saveSchedule();
        return block;
    }

    /**
     * Delete a block
     */
    deleteBlock(date, blockId) {
        if (!this.schedule[date]) {
            return null;
        }
        const index = this.schedule[date].findIndex(b => b.id === blockId);
        if (index !== -1) {
            const deleted = this.schedule[date].splice(index, 1)[0];
            this.saveSchedule();
            return deleted;
        }
        return null;
    }

    /**
     * Legacy method for backward compatibility - converts to new format
     */
    updateBlock(date, hour, content) {
        const startTime = `${String(hour).padStart(2, '0')}:00`;
        const endTime = `${String(hour + 1).padStart(2, '0')}:00`;
        return this.addBlock(date, {
            start_time: startTime,
            end_time: endTime,
            content: content
        });
    }

    /**
     * Get schedule for a week starting from a given date
     * Returns an object with dates as keys
     */
    getWeekSchedule(startDate) {
        const weekSchedule = {};
        const start = new Date(startDate);
        
        // Get the week (7 days starting from startDate)
        for (let i = 0; i < 7; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            const dateStr = this.formatDate(date);
            weekSchedule[dateStr] = this.getSchedule(dateStr);
        }
        
        return weekSchedule;
    }

    /**
     * Format a Date object to YYYY-MM-DD string
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Get all schedules (for debugging/admin)
     */
    getAll() {
        return this.schedule;
    }
}

module.exports = ProductivityManager;

