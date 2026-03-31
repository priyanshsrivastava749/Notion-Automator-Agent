const { callGemini } = require("./gemini");
const { callOllama } = require("./localai");
const { readNotionBlocks, writeNotionBlocks, createNotionPage } = require("./notion");
const config = require("./config");

const SYSTEM_PROMPT = `You are an autonomous AI agent connected to external tools, primarily a Notion workspace.
You must always respond in valid JSON format. Do not wrap the JSON in markdown blocks like \`\`\`json, just return the raw JSON object.

TOOLS:
- READ_NOTION: Use this to read the user's notes and workspace data from Notion.
- WRITE_NOTION: Use this to save, append, or write notes into the user's Notion workspace.
- CREATE_PAGE: Use this EXCLUSIVELY if the user specifically asks to "create a new page" or "make a new subpage".
- DIRECT_REPLY: Use this if the user is just chatting or if you have already completed their task and are responding.

RULES:
- When you read notes, you might see 📁 [Child Page Directory] with an ID. If the user asks you to read, write, or create a page *inside* one of those child pages, pass its ID in the "target_id" field!
- If the user asks to save, note down, write -> return {"action": "WRITE_NOTION", "content": "Text"}.
- If the user sets out to create a page -> return {"action": "CREATE_PAGE", "title": "Page Title", "content": "Initial content"}.
- If no tool is needed -> return {"action": "DIRECT_REPLY", "content": "Your chat response goes here"}.

JSON RESPONSE SCHEMA:
{
  "action": "READ_NOTION" | "WRITE_NOTION" | "CREATE_PAGE" | "DIRECT_REPLY",
  "content": "The text to save or reply. Leave empty if READ_NOTION.",
  "title": "Title for the new page (only if CREATE_PAGE)",
  "target_id": "Optional. The ID of the specific sub-page you want to interact with, if any."
}`;

async function runAgent(userMessage, overrideModel = "auto", keys = {}) {
  console.log(`[Agent] Received message: "${userMessage}"`);
  console.log(`[Agent] Model override: ${overrideModel}`);

  let agentResponse;
  let providerToUse = overrideModel;
  
  // Choose AI Model
  try {
    if (providerToUse === "local" || providerToUse === "ollama") {
      console.log("[Agent] Using Local AI (Ollama)");
      agentResponse = await callOllama(userMessage, SYSTEM_PROMPT, keys);
      providerToUse = "local";
    } else {
      console.log("[Agent] Trying Gemini API...");
      agentResponse = await callGemini(userMessage, SYSTEM_PROMPT, keys);
      providerToUse = "gemini";
    }
  } catch (error) {
    if (overrideModel !== "local" && overrideModel !== "ollama") {
      console.log("[Agent] Gemini Failed or Missing API key! Falling back to Local AI.");
      try {
        agentResponse = await callOllama(userMessage, SYSTEM_PROMPT, keys);
        providerToUse = "local";
      } catch (ollamaErr) {
        throw new Error(`Both Gemini and Local AI failed. Gemini: ${error.message}. Ollama: ${ollamaErr.message}`);
      }
    } else {
       throw error;
    }
  }

  console.log("[Agent] AI Decision:", JSON.stringify(agentResponse, null, 2));

  // Tool Execution
  switch (agentResponse.action) {
    case "READ_NOTION": {
        try {
           console.log("[Agent] Executing tools: READ_NOTION");
           const targetPage = agentResponse.target_id || keys.NOTION_TARGET_PAGE_ID || config.NOTION_TARGET_PAGE_ID;
           if(!targetPage) throw new Error("NOTION_TARGET_PAGE_ID is not configured in Settings or .env");
           
           const pageData = await readNotionBlocks(targetPage, keys);
           
           // After reading, summarize or pass it back to the user
           const followUpPrompt = `The workspace notes are:\n\n${pageData}\n\nUser asked: "${userMessage}"\nNow generate a summary or directly answer their question. Use DIRECT_REPLY.`;
           
           let finalResponse;
           if (providerToUse === "local") finalResponse = await callOllama(followUpPrompt, SYSTEM_PROMPT, keys);
           else finalResponse = await callGemini(followUpPrompt, SYSTEM_PROMPT, keys);
           
           return { reply: finalResponse.content || "I have read your notes.", toolsUsed: ["READ_NOTION"], provider: providerToUse };
           
        } catch(e) {
           return { reply: `I tried to read Notion but encountered an error: ${e.message}`, error: true, provider: providerToUse };
        }
    }
    
    case "WRITE_NOTION": {
        try {
           console.log("[Agent] Executing tools: WRITE_NOTION");
           const targetPage = agentResponse.target_id || keys.NOTION_TARGET_PAGE_ID || config.NOTION_TARGET_PAGE_ID;
           if(!targetPage) throw new Error("NOTION_TARGET_PAGE_ID is not configured in Settings or .env");
           
           if (!agentResponse.content) {
              return { reply: "I decided to save something, but wasn't sure what content to save.", error: true, provider: providerToUse };
           }
           
           await writeNotionBlocks(targetPage, agentResponse.content, keys);
           return { reply: `Successfully saved to Notion:\n"${agentResponse.content}"`, toolsUsed: ["WRITE_NOTION"], provider: providerToUse };
           
        } catch(e) {
           return { reply: `I tried to save to Notion but encountered an error: ${e.message}`, error: true, provider: providerToUse };
        }
    }
    
    case "CREATE_PAGE": {
        try {
           console.log("[Agent] Executing tools: CREATE_PAGE");
           const targetPage = agentResponse.target_id || keys.NOTION_TARGET_PAGE_ID || config.NOTION_TARGET_PAGE_ID;
           if(!targetPage) throw new Error("NOTION_TARGET_PAGE_ID is not configured in Settings or .env");
           
           if (!agentResponse.title) {
              return { reply: "I decided to create a page, but wasn't sure what to name it.", error: true, provider: providerToUse };
           }
           
           await createNotionPage(targetPage, agentResponse.title, agentResponse.content || "Created by Agent", keys);
           return { reply: `Successfully created a new page named "${agentResponse.title}" in Notion!`, toolsUsed: ["CREATE_PAGE"], provider: providerToUse };
           
        } catch(e) {
           return { reply: `I tried to create a page but encountered an error: ${e.message}`, error: true, provider: providerToUse };
        }
    }
    
    case "DIRECT_REPLY":
    default:
        return { reply: agentResponse.content || "Sorry, I am not sure how to respond to that.", toolsUsed: [], provider: providerToUse };
  }
}

module.exports = { runAgent };
