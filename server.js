const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { runAgent } = require('./agent');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Chat API Route
app.post('/api/chat', async (req, res) => {
  const { message, model, keys } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const result = await runAgent(message, model, keys || {});
    res.json(result);
  } catch (error) {
    console.error("Chat API Error:", error);
    res.status(500).json({ error: error.message || "An unexpected error occurred." });
  }
});

// Start Server
app.listen(config.PORT, () => {
  console.log(`🚀 Notion-Automator Agent is running at http://localhost:${config.PORT}`);
  console.log(`⚙️  Default Target Model: Gemini (with Ollama fallback)`);
});
