/*
 * analyze_chat_openai.js
 *
 * This script analyzes Telegram chat exports using NEAR AI Cloud API
 * to extract DevRel-related questions and answers about Orderly Network.
 *
 * Prerequisites:
 * 1. Node.js installed.
 * 2. NEAR AI API key set in a .env file (NEAR_AI_API_KEY=your_key_here).
 * 3. npm install openai dotenv
 *
 * Usage:
 * node analyze_chat_openai.js
 *
 * The script will create tg_analysis.json in the project root.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// NEAR AI Cloud configuration
const openai = new OpenAI({
  baseURL: 'https://cloud-api.near.ai/v1',
  apiKey: process.env.NEAR_AI_API_KEY || process.env.OPENAI_API_KEY,
});

const NEAR_AI_MODEL = 'zai-org/GLM-4.7';
const CHAT_EXPORTS_DIR = 'telegram_chat_exports';
const FINAL_ANALYSIS_FILENAME = 'tg_analysis.json';
const FINAL_ANALYSIS_PATH = path.join(__dirname, '..', 'tg_analysis.json');
// Set to null or Infinity to process all, or a number for testing
const MAX_FILES_TO_PROCESS = null;

function formatChatMessages(messages) {
  if (!Array.isArray(messages)) {
    return '';
  }
  return messages
    .map((message) => {
      const from = message.from || message.from_id || 'Unknown User';
      const date = message.date || '';
      let textContent = '';

      if (typeof message.text === 'string') {
        textContent = message.text;
      } else if (typeof message.text === 'object' && message.text !== null) {
        if (message.text.text) {
          textContent = message.text.text;
        } else {
          textContent = JSON.stringify(message.text);
        }
      } else {
        textContent = '[Non-text content]';
      }

      if (!textContent || textContent.trim() === '' || textContent === '[Non-text content]') {
        return '';
      }

      return `---\nFrom: ${from}\nDate: ${date}\n\n${textContent}\n---`;
    })
    .filter((text) => text !== '')
    .join('\n\n');
}

async function analyzeChatWithAI(chatContent, fileInfo, existingQAPairs) {
  console.log(`  Analyzing ${fileInfo.name} with NEAR AI...`);

  let systemPrompt =
    'You are an expert technical support analyst and developer relations specialist for Orderly Network. ';
  systemPrompt +=
    'Your task is to read the provided chat transcript and identify specific, well-formed questions that developers are asking about Orderly Network, along with their corresponding answers.\n';
  systemPrompt +=
    'Focus ONLY on technical questions related to: integration, SDK usage, API endpoints, trading mechanics, troubleshooting errors, configuration, deposits/withdrawals, and similar developer-centric topics.\n';
  systemPrompt += 'CRITICAL INSTRUCTIONS FOR ANSWER QUALITY:\n';
  systemPrompt +=
    "1. ACCURACY: The answer MUST directly and precisely address the specific question asked. Pay extremely close attention to keywords in the question (e.g., differentiate between 'withdrawal' and 'deposit', specific feature names, etc.) and ensure your answer corresponds exactly to what was asked. Do not provide information about related but distinct topics.\n";
  systemPrompt +=
    '2. NO PERSONAL INFORMATION: Do NOT include any specific person names, @mentions, or references to individuals (e.g., "Jacob will set this up", "reach out to Eric", "@Orderly_Team"). Always use generic references like "Orderly team", "support", or remove the personal attribution entirely.\n';
  systemPrompt +=
    '3. NO DATE-SPECIFIC CONTENT: Do NOT include specific dates, timelines, or time-sensitive information (e.g., "available starting May 27", "will be enabled on Monday", "last week", "next month"). Focus on the technical functionality that is generally available or the current state of features.\n';
  systemPrompt +=
    '4. NO META-REFERENCES: Do NOT use phrases that reference the source material like "The chat indicates", "The chat confirms", "In this thread", "According to the conversation", "As discussed in the chat", "The transcript shows". Instead, provide direct, standalone answers as if you are the authoritative source.\n';
  systemPrompt +=
    '5. ACTIONABILITY: The "answer" field MUST be actionable for a developer. It should provide clear guidance, next steps, or specific pointers to where information can be found.\n';
  systemPrompt +=
    '6. DETAIL FROM CHAT: If an API endpoint, SDK function, or specific technical process is mentioned, the answer MUST attempt to include available details from the chat, such as:\n';
  systemPrompt +=
    '    *   LOCATION OF INFORMATION: If the chat mentions where a developer can find more details (e.g., "in the API docs under \'User Management\'", "in the SDK\'s `examples/` directory", or a specific section of a guide), include this.\n';
  systemPrompt +=
    '    *   KEY PARAMETERS/USAGE: If crucial parameters, brief usage patterns, or relevant small code snippets are in the chat, include them.\n';
  systemPrompt +=
    '7. HANDLING LINKS: When the original chat message contains a hyperlink (e.g., to documentation like `[link text](URL)` or a raw URL):\n';
  systemPrompt +=
    '    *   If the link is to specific, highly relevant technical documentation (e.g., a deep link to an API endpoint page or SDK function details) that directly clarifies how to use a mentioned feature, you MAY include this single URL in your answer if it is the most effective way to make the answer actionable and no textual summary is available in the chat.\n';
  systemPrompt +=
    "    *   Otherwise, do NOT include the URL or markdown link. Instead, describe where the developer can find the information textually (e.g., 'Refer to the official Orderly Network API documentation, under the Trading Endpoints section') or summarize the key information if the chat text itself provides that summary.\n";
  systemPrompt +=
    '8. INCOMPLETE INFORMATION: If the chat confirms a feature/topic but provides NO actionable details (like documentation location, API/SDK specifics), the answer should state this explicitly (e.g., "The chat confirms X feature exists, but specific implementation details or documentation pointers were not provided in this segment.").\n\n';
  systemPrompt +=
    'PREVIOUSLY EXTRACTED Q&A PAIRS (for context, avoid duplicates, refine if possible):\n';
  systemPrompt += JSON.stringify(existingQAPairs, null, 2) + '\n\n';
  systemPrompt +=
    'Based on the CURRENT CHAT TRANSCRIPT below, extract NEW questions and answers, or provide REFINED answers for the existing ones if the new context is significantly better or more accurate.\n';
  systemPrompt +=
    'When doing so, pay attention to the `last_referenced_date` of existing Q&A pairs. If the CURRENT CHAT TRANSCRIPT contains newer information (i.e., messages with a later date) that contradicts or significantly updates an existing answer, you MUST prioritize the newer information and update the `last_referenced_date` accordingly.\n\n';
  systemPrompt +=
    'Format your output ONLY as a valid JSON object with a single key "qa_pairs". The value of this "qa_pairs" key must be a JSON array of objects.\n';
  systemPrompt +=
    'Each object in the array must have three string fields: "question", "answer", and "last_referenced_date".\n';
  systemPrompt +=
    'The "last_referenced_date" should be the date of the most recent message in the CURRENT CHAT TRANSCRIPT that was used to derive or confirm the Q/A pair (format: YYYY-MM-DD). If the Q/A pair is an update to an existing one from the PREVIOUSLY EXTRACTED Q&A PAIRS list, use the date from the new transcript context if it is more recent.\n';
  systemPrompt +=
    'Do not output markdown code blocks (like ```json), just the raw JSON string. Ensure all JSON syntax is valid (e.g., proper escaping of quotes within strings).\n';
  systemPrompt +=
    'If no new or significantly refined Q/A pairs are found, return an empty array for "qa_pairs".\n';

  const userPrompt = `Chat Transcript for ${fileInfo.name}:\n---\n${chatContent}\n---\n\nExtract Q/A pairs.`;

  try {
    const completion = await openai.chat.completions.create({
      model: NEAR_AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      console.warn(`    OpenAI response for ${fileInfo.name} was empty.`);
      return [];
    }

    const parsedResponse = JSON.parse(responseContent);
    if (parsedResponse.qa_pairs && Array.isArray(parsedResponse.qa_pairs)) {
      return parsedResponse.qa_pairs;
    } else {
      console.warn(
        `    No 'qa_pairs' array found or not an array in response for ${fileInfo.name}.`
      );
      return [];
    }
  } catch (error) {
    console.error(
      `    Error calling NEAR AI API or parsing response for ${fileInfo.name}:`,
      error.message
    );
    if (error.message.includes('rate limit')) {
      console.log('    Rate limited, waiting 20s before retry...');
      await new Promise((resolve) => setTimeout(resolve, 20000));
      return analyzeChatWithAI(chatContent, fileInfo, existingQAPairs);
    }
    return [];
  }
}

async function main() {
  console.log('Starting analysis of Telegram chat exports...');

  const chatExportsDir = path.join(__dirname, '..', CHAT_EXPORTS_DIR);

  if (!fs.existsSync(chatExportsDir)) {
    console.error(`Error: Directory not found: ${chatExportsDir}`);
    console.error('Please run: node scripts/split_telegram_chats.js');
    process.exit(1);
  }

  const chatFiles = fs
    .readdirSync(chatExportsDir)
    .filter((file) => file.startsWith('chat_') && file.endsWith('.json'))
    .map((file) => ({
      name: file,
      path: path.join(chatExportsDir, file),
    }));

  if (chatFiles.length === 0) {
    console.error(`Error: No chat_*.json files found in ${chatExportsDir}`);
    process.exit(1);
  }

  console.log(`Found ${chatFiles.length} chat files to process.`);
  if (MAX_FILES_TO_PROCESS && MAX_FILES_TO_PROCESS !== Infinity) {
    console.log(`Limiting to first ${MAX_FILES_TO_PROCESS} files for testing.`);
  }

  let cumulativeQAPairs = [];
  const filesToProcess = MAX_FILES_TO_PROCESS
    ? chatFiles.slice(0, MAX_FILES_TO_PROCESS)
    : chatFiles;

  for (let i = 0; i < filesToProcess.length; i++) {
    const fileInfo = filesToProcess[i];
    console.log(`\n[${i + 1}/${filesToProcess.length}] Processing ${fileInfo.name}...`);

    try {
      const fileContent = fs.readFileSync(fileInfo.path, 'utf-8');
      const chatData = JSON.parse(fileContent);

      if (!chatData.messages || !Array.isArray(chatData.messages)) {
        console.warn(`  Skipping ${fileInfo.name}: No 'messages' array found.`);
        continue;
      }

      console.log(`  Read ${chatData.messages.length} messages.`);
      const formattedChat = formatChatMessages(chatData.messages);

      if (!formattedChat.trim()) {
        console.warn(`  Skipping ${fileInfo.name}: No text content found after formatting.`);
        continue;
      }

      const newQAPairs = await analyzeChatWithAI(formattedChat, fileInfo, cumulativeQAPairs);

      if (newQAPairs.length > 0) {
        console.log(`  Extracted ${newQAPairs.length} Q/A pairs.`);
        cumulativeQAPairs = [...cumulativeQAPairs, ...newQAPairs];
      } else {
        console.log(`  No new Q/A pairs found or an error occurred.`);
      }
    } catch (fileError) {
      console.error(`  Error reading or processing file ${fileInfo.name}:`, fileError.message);
    }
  }

  try {
    fs.writeFileSync(FINAL_ANALYSIS_PATH, JSON.stringify(cumulativeQAPairs, null, 2));
    console.log(`\n--- Final analysis complete ---`);
    console.log(
      `Successfully saved ${cumulativeQAPairs.length} Q/A pairs to ${FINAL_ANALYSIS_PATH}`
    );
  } catch (e) {
    console.error(`Error writing final analysis file ${FINAL_ANALYSIS_PATH}:`, e.message);
  }
}

main().catch((err) => {
  console.error('Unhandled error in main function:', err);
  process.exit(1);
});
