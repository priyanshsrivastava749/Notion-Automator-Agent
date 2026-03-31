const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require("./config");

const delay = ms => new Promise(res => setTimeout(res, ms));

async function callGemini(prompt, systemInstruction, keys = {}) {
  const apiKey = keys.GEMINI_API_KEY || config.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API Key is missing. Please set it in Settings or .env");

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = "gemini-2.5-flash"; 
  
  let lastError = null;
  const maxRetries = 3;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemInstruction,
        generationConfig: {
          responseMimeType: "application/json",
        }
      });

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return JSON.parse(text);
      
    } catch (error) {
      console.log(`[Gemini] Attempt ${i + 1} failed for ${modelName}: ${error.message}`);
      lastError = error;
      
      // If the error is a bad api key or 404, abort completely without retrying
      if (error.message.includes("API key not valid") || error.message.includes("404") || error.status === 400 || error.status === 404) {
         throw error;
      }
      
      // If 503 or 429 Server Overload, wait and retry!
      const waitTime = 2000 * (i + 1);
      console.log(`[Gemini] Server Overload. Waiting ${waitTime}ms before retry...`);
      await delay(waitTime);
    }
  }

  console.error("Gemini API exhausted retries. Last Error:", lastError.message);
  throw new Error(`Gemini Servers are temporarily full (Overload). Please wait a few seconds and try again, or turn on your Local AI (Ollama) in the background.`);
}

module.exports = { callGemini };
