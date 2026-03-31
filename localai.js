const config = require("./config");

async function callOllama(prompt, systemInstruction, keys = {}) {
  try {
    const apiUrl = keys.OLLAMA_API_URL || config.OLLAMA_API_URL || "http://localhost:11434/api/chat";
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2", // The local model to target
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt }
        ],
        stream: false,
        format: "json"
      })
    });

    if (!response.ok) {
        throw new Error(`Ollama Error: ${response.statusText}`);
    }

    const data = await response.json();
    return JSON.parse(data.message.content);
  } catch (error) {
    console.error("Local AI Error:", error.message || error);
    throw error;
  }
}

module.exports = { callOllama };
