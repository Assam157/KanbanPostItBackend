const express = require('express');
const auth = require('../middleware/auth');
const Task = require('../models/Task');

const router = express.Router();

// ------------------------------------------------------------
// Helper: call Hugging Face API (or fallback to mock)
async function callLLM(prompt) {
  // If Hugging Face token is provided, use real API
  if (process.env.HUGGINGFACE_API_KEY) {
    try {
      const response = await fetch(
        'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ inputs: prompt }),
        }
      );

      const data = await response.json();
      // DialoGPT returns an array with one object containing 'generated_text'
      const result = data[0]?.generated_text?.trim();
      if (result) return result;
    } catch (err) {
      console.error('Hugging Face API error:', err.message);
    }
  }

  // Mock responses (safe fallback)
  if (prompt.includes('suggest')) {
    return 'How about "Organise your week" or "Review pending tasks"?';
  }
  return 'I’m your Kanban assistant! Ask me about the board, deadlines, or type "suggest" for a task idea.';
}

// ------------------------------------------------------------
// POST /api/ai/chat
router.post('/chat', auth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    const prompt = `User: ${message}\nAssistant:`;
    const reply = await callLLM(prompt);
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI service failed' });
  }
});

// ------------------------------------------------------------
// POST /api/ai/tasks/suggest
router.post('/tasks/suggest', auth, async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user.id }).select('title');
    const titles = tasks.map(t => t.title).join(', ') || 'none';

    const prompt = `The user's current tasks are: ${titles}. Suggest one new, realistic task they might add to their Kanban board. Keep it short (under 10 words).`;
    const suggestion = await callLLM(prompt);
    res.json({ suggestion });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Suggestion failed' });
  }
});

module.exports = router;