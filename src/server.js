const express = require('express');
const path = require('path');
const AIParser = require('./business/aiParser');
const ObligationManager = require('./business/obligationManager');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'ui')));

// Initialize managers
const parser = new AIParser();
const obligationManager = new ObligationManager();

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
        const { due_at, estimated_duration } = req.body;
        const updates = {};
        
        if (due_at !== undefined) {
            updates.due_at = due_at;
        }
        if (estimated_duration !== undefined) {
            updates.estimated_duration = estimated_duration;
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

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
