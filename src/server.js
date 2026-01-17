const express = require('express');
const path = require('path');
const AIParser = require('./business/aiParser');
const ObligationManager = require('./business/obligationManager');
const ProductivityManager = require('./business/productivityManager');
const HabitsManager = require('./business/habitsManager');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'ui')));

// Initialize managers
const parser = new AIParser();
const obligationManager = new ObligationManager();
const productivityManager = new ProductivityManager();
const habitsManager = new HabitsManager();

// API Routes

// Get all obligations
app.get('/api/obligations', (req, res) => {
    try {
        const obligations = obligationManager.getAll();
        res.json(obligations);
    } catch (error) {
        console.error('Get obligations error:', error);
        res.status(500).json({ error: 'Failed to get obligations' });
    }
});

// Add obligation
app.post('/api/obligations', async (req, res) => {
    try {
        const { text, followup } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        const inputText = followup ? `${text} ${followup}` : text;
        const result = await parser.parse(inputText);

        if (result.needs_clarification && !result.due_at && !followup) {
            return res.json({
                needs_clarification: true,
                result: result
            });
        }

        const obligation = obligationManager.add(result);
        res.json(obligation);
    } catch (error) {
        console.error('Add obligation error:', error);
        res.status(500).json({ error: 'Failed to add obligation' });
    }
});

// Toggle obligation done status
app.patch('/api/obligations/:id/toggle', (req, res) => {
    try {
        const { id } = req.params;
        const obligation = obligationManager.toggleDone(id);
        if (!obligation) {
            return res.status(404).json({ error: 'Obligation not found' });
        }
        res.json(obligation);
    } catch (error) {
        console.error('Toggle obligation error:', error);
        res.status(500).json({ error: 'Failed to toggle obligation' });
    }
});

// Update obligation
app.patch('/api/obligations/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { due_at, estimated_duration, task_type } = req.body;
        const updates = {};
        
        if (due_at !== undefined) {
            updates.due_at = due_at;
        }
        if (estimated_duration !== undefined) {
            updates.estimated_duration = estimated_duration;
        }
        if (task_type !== undefined) {
            updates.task_type = task_type;
        }
        
        const obligation = obligationManager.update(id, updates);
        if (!obligation) {
            return res.status(404).json({ error: 'Obligation not found' });
        }
        res.json(obligation);
    } catch (error) {
        console.error('Update obligation error:', error);
        res.status(500).json({ error: 'Failed to update obligation' });
    }
});

// Clear all obligations (must come before /:id route)
app.delete('/api/obligations/all', (req, res) => {
    try {
        const result = obligationManager.clearAll();
        res.json(result);
    } catch (error) {
        console.error('Clear all error:', error);
        res.status(500).json({ error: 'Failed to clear obligations' });
    }
});

// Load sample obligations
app.post('/api/obligations/samples', (req, res) => {
    try {
        const result = obligationManager.loadSamples();
        res.json(result);
    } catch (error) {
        console.error('Load samples error:', error);
        res.status(500).json({ error: 'Failed to load samples' });
    }
});

// Delete obligation
app.delete('/api/obligations/:id', (req, res) => {
    try {
        const { id } = req.params;
        const obligation = obligationManager.delete(id);
        if (!obligation) {
            return res.status(404).json({ error: 'Obligation not found' });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Delete obligation error:', error);
        res.status(500).json({ error: 'Failed to delete obligation' });
    }
});

// Productivity API Routes

// Get schedule for a specific date or week
app.get('/api/productivity/:date', (req, res) => {
    try {
        const { date } = req.params;
        const { week } = req.query;
        
        if (week === 'true') {
            // Return week schedule
            const weekSchedule = productivityManager.getWeekSchedule(date);
            res.json(weekSchedule);
        } else {
            // Return single day schedule
            const schedule = productivityManager.getSchedule(date);
            res.json(schedule);
        }
    } catch (error) {
        console.error('Get productivity schedule error:', error);
        res.status(500).json({ error: 'Failed to get schedule' });
    }
});

// Add or update a time block
app.post('/api/productivity/:date/blocks', (req, res) => {
    try {
        const { date } = req.params;
        const blockData = req.body;
        const block = productivityManager.addBlock(date, blockData);
        res.json(block);
    } catch (error) {
        console.error('Add productivity block error:', error);
        res.status(500).json({ error: error.message || 'Failed to add block' });
    }
});

// Update a block
app.patch('/api/productivity/:date/blocks/:id', (req, res) => {
    try {
        const { date, id } = req.params;
        const updates = req.body;
        const existing = productivityManager.getSchedule(date).find(b => b.id === id);
        if (!existing) {
            return res.status(404).json({ error: 'Block not found' });
        }
        const block = productivityManager.addBlock(date, { ...existing, ...updates, id });
        res.json(block);
    } catch (error) {
        console.error('Update productivity block error:', error);
        res.status(500).json({ error: error.message || 'Failed to update block' });
    }
});

// Delete a block
app.delete('/api/productivity/:date/blocks/:id', (req, res) => {
    try {
        const { date, id } = req.params;
        const deleted = productivityManager.deleteBlock(date, id);
        if (!deleted) {
            return res.status(404).json({ error: 'Block not found' });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Delete productivity block error:', error);
        res.status(500).json({ error: error.message || 'Failed to delete block' });
    }
});

// Legacy endpoint for backward compatibility
app.patch('/api/productivity/:date/:hour', (req, res) => {
    try {
        const { date, hour } = req.params;
        const { content } = req.body;
        const hourNum = parseInt(hour, 10);
        
        if (isNaN(hourNum)) {
            return res.status(400).json({ error: 'Invalid hour' });
        }
        
        const block = productivityManager.updateBlock(date, hourNum, content);
        res.json(block);
    } catch (error) {
        console.error('Update productivity block error:', error);
        res.status(500).json({ error: error.message || 'Failed to update block' });
    }
});

// Habits API Routes

// Get all habits
app.get('/api/habits', (req, res) => {
    try {
        const habits = habitsManager.getAll();
        res.json(habits);
    } catch (error) {
        console.error('Get habits error:', error);
        res.status(500).json({ error: 'Failed to get habits' });
    }
});

// Add a habit
app.post('/api/habits', (req, res) => {
    try {
        const { name, category, hours_per_week } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const habit = habitsManager.add({ name, category, hours_per_week });
        res.json(habit);
    } catch (error) {
        console.error('Add habit error:', error);
        res.status(500).json({ error: 'Failed to add habit' });
    }
});

// Update a habit
app.patch('/api/habits/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { name, category, hours_per_week } = req.body;
        const updates = {};
        
        if (name !== undefined) updates.name = name;
        if (category !== undefined) updates.category = category;
        if (hours_per_week !== undefined) updates.hours_per_week = hours_per_week;
        if (req.body.default_length !== undefined) updates.default_length = req.body.default_length;
        
        const habit = habitsManager.update(id, updates);
        if (!habit) {
            return res.status(404).json({ error: 'Habit not found' });
        }
        res.json(habit);
    } catch (error) {
        console.error('Update habit error:', error);
        res.status(500).json({ error: 'Failed to update habit' });
    }
});

// Delete a habit
app.delete('/api/habits/:id', (req, res) => {
    try {
        const { id } = req.params;
        const habit = habitsManager.delete(id);
        if (!habit) {
            return res.status(404).json({ error: 'Habit not found' });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Delete habit error:', error);
        res.status(500).json({ error: 'Failed to delete habit' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
