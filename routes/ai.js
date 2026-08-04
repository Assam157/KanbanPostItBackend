const express = require('express');
const auth = require('../middleware/auth');
const Task = require('../models/Task');

const router = express.Router();

// Ordered list of models to try
const MODELS = [
  'meta-llama/Llama-3.1-8B-Instruct',
  'meta-llama/Llama-3.2-3B-Instruct',
  'meta-llama/Llama-3.2-1B-Instruct',
  'google/gemma-2-9b-it',
  'google/gemma-2-2b-it',
  'mistralai/Mistral-7B-Instruct-v0.3',
  'Qwen/Qwen2.5-7B-Instruct',
  'Qwen/Qwen2.5-3B-Instruct',
  'microsoft/Phi-3.5-mini-instruct',
  'microsoft/Phi-3-mini-4k-instruct',
  'ibm-granite/granite-3.2-8b-instruct',
  'HuggingFaceTB/SmolLM3-3B',
];

// ------------------------------------------------------------
// Mock responses (fallback when all models fail)
function mockChatReply(prompt) {
  const p = prompt.toLowerCase();
  if (p.includes('hello') || p.includes('hi'))
    return 'Hello! How can I help you with your Kanban board?';
  if (p.includes('suggest') || p.includes('idea'))
    return 'How about "Organise weekly priorities" or "Review pending tasks"?';
  if (p.includes('deadline'))
    return 'You can set deadlines for each task. Overdue tasks will be highlighted in red!';
  if (p.includes('move') || p.includes('column'))
    return 'Use the arrow buttons on each note to move it between To Do, In Progress, and Done.';
  return 'I’m your Kanban assistant. Ask me about tasks, deadlines, or type "suggest" for a new idea.';
}

function mockSuggest() {
  const generic = [
    'Plan next week',
    'Review completed tasks',
    'Write project summary',
    'Check deadlines',
    'Organise board',
  ];
  return `How about "${generic[Math.floor(Math.random() * generic.length)]}"?`;
}

// ------------------------------------------------------------
// Try a single model
async function tryModel(model, prompt) {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) throw new Error('Missing API key');

  const response = await fetch(
    'https://router.huggingface.co/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful AI assistant for a Kanban task management application.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    }
  );

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(`HTTP ${response.status} - ${JSON.stringify(errData)}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ------------------------------------------------------------
// Main LLM call with model fallback
async function callLLM(prompt) {
  if (!process.env.HUGGINGFACE_API_KEY) {
    console.log('No Hugging Face API key – using mock response');
    return mockChatReply(prompt);
  }

  let lastError = null;

  for (const model of MODELS) {
    try {
      console.log(`Trying model: ${model}`);
      const result = await tryModel(model, prompt);
      return result;
    } catch (err) {
      console.warn(`Model ${model} failed:`, err.message);
      lastError = err;
      continue; // try next model
    }
  }

  console.warn('All models failed, falling back to mock. Last error:', lastError?.message);
  return mockChatReply(prompt);
}

// ------------------------------------------------------------
// POST /api/ai/chat
router.post('/chat', auth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    const reply = await callLLM(`User: ${message}\nAssistant:`);
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

    let suggestion;
    if (!process.env.HUGGINGFACE_API_KEY) {
      suggestion = mockSuggest();
    } else {
      let lastError;
      for (const model of MODELS) {
        try {
          suggestion = await tryModel(model, prompt);
          break;
        } catch (err) {
          lastError = err;
          continue;
        }
      }
      if (!suggestion) {
        console.warn('All models failed for suggestion, using mock. Last error:', lastError?.message);
        suggestion = mockSuggest();
      }
    }
    res.json({ suggestion });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Suggestion failed' });
  }
});

module.exports = router;