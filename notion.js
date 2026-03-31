const { Client } = require("@notionhq/client");
const config = require("./config");

function getNotionClient(keys) {
    const apiKey = keys.NOTION_API_KEY || config.NOTION_API_KEY;
    if (!apiKey) throw new Error("Notion API Key is missing. Please set it in Settings or .env");
    return new Client({ auth: apiKey });
}

async function readNotionBlocks(pageId, keys = {}) {
  try {
    const notion = getNotionClient(keys);
    const response = await notion.blocks.children.list({
      block_id: pageId,
    });
    
    // Extract plain text from paragraphs, headings, etc.
    const textBlocks = response.results.map(block => {
      let content = "";
      if (block.type === 'paragraph' && block.paragraph.rich_text) {
        content = block.paragraph.rich_text.map(rt => rt.plain_text).join("");
      } else if (block.type.startsWith('heading') && block[block.type].rich_text) {
        content = block[block.type].rich_text.map(rt => rt.plain_text).join("");
      } else if (block.type === 'bulleted_list_item' && block.bulleted_list_item.rich_text) {
        content = "- " + block.bulleted_list_item.rich_text.map(rt => rt.plain_text).join("");
      } else if (block.type === 'child_page') {
        content = `📁 [Child Page Directory]: "${block.child_page.title}" (ID: ${block.id})`;
      } else if (block.type === 'child_database') {
        content = `🗄️ [Child Database]: "${block.child_database.title}" (ID: ${block.id})`;
      }
      return content;
    }).filter(text => text !== "").join("\n");
    
    return textBlocks || "No text content found on the page.";
  } catch (error) {
    console.error("Notion API Read Error:", error.message);
    throw new Error(`Failed to read Notion page: ${error.message}`);
  }
}

async function writeNotionBlocks(pageId, content, keys = {}) {
  try {
    const notion = getNotionClient(keys);
    // Split content by newlines to create separate blocks if needed
    const lines = content.split("\n").filter(line => line.trim() !== "");
    const children = lines.map(line => ({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          {
             type: "text",
             text: { content: line }
          }
        ]
      }
    }));

    const response = await notion.blocks.children.append({
      block_id: pageId,
      children: children
    });
    
    return response;
  } catch (error) {
    console.error("Notion API Write Error:", error.message);
    throw new Error(`Failed to write to Notion page: ${error.message}`);
  }
}

async function createNotionPage(parentId, title, content, keys = {}) {
    try {
        const notion = getNotionClient(keys);
        const response = await notion.pages.create({
            parent: { page_id: parentId },
            properties: {
                title: [
                    {
                        text: { content: title }
                    }
                ]
            },
            children: [
                {
                    object: "block",
                    type: "paragraph",
                    paragraph: {
                        rich_text: [
                            {
                                type: "text",
                                text: { content: content }
                            }
                        ]
                    }
                }
            ]
        });
        return response;
    } catch(error) {
        console.error("Notion API Create Page Error:", error.message);
        throw new Error(`Failed to create Notion page: ${error.message}`);
    }
}

module.exports = { readNotionBlocks, writeNotionBlocks, createNotionPage };
