require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  NOTION_API_KEY: process.env.NOTION_API_KEY,
  NOTION_TARGET_PAGE_ID: process.env.NOTION_TARGET_PAGE_ID,
  OLLAMA_API_URL: process.env.OLLAMA_API_URL || "http://localhost:11434/api/chat"
};
