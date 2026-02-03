/*
 * split_telegram_chats.js
 *
 * This script processes a large Telegram export JSON file (result.json)
 * and splits it into smaller JSON files, one for each chat group.
 * It uses streaming to handle large files efficiently without crashing.
 *
 * Prerequisites:
 * 1. Node.js installed.
 * 2. The 'JSONStream' package. Install it by running in your terminal:
 *    npm install JSONStream
 *
 * Usage:
 * node split_telegram_chats.js
 *
 * The script will read 'result.json' from the current directory
 * and create output files like 'chat_Chat_Name_1.json', 'chat_Another_Chat.json', etc.,
 * also in the current directory.
 */

import fs from 'fs';
import path from 'path';
// Ensure you have run: npm install JSONStream
import JSONStream from 'JSONStream';

const inputFile = 'result.json';
const outputSubDirName = 'telegram_chat_exports';
// Output files will be created in the specified subdirectory
const outputDir = path.join('.', outputSubDirName);

// Function to sanitize chat names for use in filenames
function sanitizeFilename(name) {
  if (typeof name !== 'string') {
    name = 'unknown_chat';
  }
  // Replace spaces with underscores, remove characters not suitable for filenames
  return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');
}

// Create a readable stream for the input JSON file
const readStream = fs.createReadStream(inputFile, { encoding: 'utf8' });

/*
 * Create a JSONStream parser to extract each chat object from the 'chats.list' array
 * The path 'chats.list.*' tells JSONStream to emit each element of the 'chats.list' array
 */
const parser = JSONStream.parse('chats.list.*');

// To generate unique names for chats without a name
let chatCounter = 0;
let totalChatsProcessed = 0;

console.log(`Starting to process ${inputFile}...`);

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
  try {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created output directory: ${outputDir}`);
  } catch (err) {
    console.error(`Error creating output directory ${outputDir}:`, err.message);
    // Exit if we can't create the output directory
    process.exit(1);
  }
}

console.log(`Output directory: ${path.resolve(outputDir)}`);
console.log("Make sure you have run 'npm install JSONStream' if you haven't already.");

readStream
  .pipe(parser)
  .on('data', (chatObject) => {
    totalChatsProcessed++;
    
    // Filter: Only process group chats (private_group or private_supergroup)
    const chatType = chatObject.type || '';
    if (!chatType.includes('group')) {
      console.log(`[${totalChatsProcessed}] Skipping non-group chat: "${chatObject.name || 'unnamed'}" (type: ${chatType})`);
      return;
    }
    
    // Check for members array in the create_group service message
    let memberCount = 0;
    if (chatObject.messages && Array.isArray(chatObject.messages)) {
      const createGroupMessage = chatObject.messages.find(
        msg => msg.type === 'service' && msg.action === 'create_group'
      );
      if (createGroupMessage && createGroupMessage.members) {
        memberCount = createGroupMessage.members.length;
      }
    }
    
    // Filter: Only include chats with at least 2 members
    if (memberCount < 2) {
      console.log(`[${totalChatsProcessed}] Skipping chat with <2 members: "${chatObject.name || 'unnamed'}" (${memberCount} members)`);
      return;
    }
    
    // Blacklist filter
    const chatNameLower = (chatObject.name || '').toLowerCase();
    const exactBlacklist = [
      'orderly one wg',
      'orderly sdk',
      'orderly devrel',
      'orderly docs working group'
    ];
    const partialBlacklist = ['internal', 'deprecated'];
    
    // Check exact matches
    if (exactBlacklist.includes(chatNameLower)) {
      console.log(`[${totalChatsProcessed}] Skipping blacklisted chat (exact match): "${chatObject.name}"`);
      return;
    }
    
    // Check partial matches
    if (partialBlacklist.some(term => chatNameLower.includes(term))) {
      console.log(`[${totalChatsProcessed}] Skipping blacklisted chat (contains "${partialBlacklist.find(term => chatNameLower.includes(term))}"): "${chatObject.name}"`);
      return;
    }
    
    let chatName = chatObject.name;
    if (!chatName || typeof chatName !== 'string' || chatName.trim() === '') {
      chatCounter++;
      chatName = `unknown_chat_${chatCounter}`;
      console.warn(
        `Chat found with no name or invalid name (ID: ${chatObject.id || 'N/A'}). Using generated name: ${chatName}`,
      );
    }

    const sanitizedName = sanitizeFilename(chatName);
    // Ensure sanitizedName is not empty, can happen if original name was only special chars
    const finalOutputFilename = sanitizedName || `chat_${chatCounter || totalChatsProcessed}`;
    const outputFilename = `chat_${finalOutputFilename}.json`;
    const outputPath = path.join(outputDir, outputFilename);

    console.log(
      `[${totalChatsProcessed}] Processing group chat: "${chatName}" (ID: ${chatObject.id || 'N/A'}, ${memberCount} members). Saving to ${outputFilename}...`,
    );

    try {
      /*
       * Write the entire chat object to its own file
       * Pretty print JSON with 2-space indent
       */
      fs.writeFileSync(outputPath, JSON.stringify(chatObject, null, 2));
      console.log(`  Successfully saved ${outputFilename}`);
    } catch (err) {
      console.error(`  Error writing file ${outputFilename}:`, err.message);
    }
  })
  .on('error', (err) => {
    // This catches errors from the parser stream
    console.error('Error processing JSON stream (JSONStream parser):', err.message);
    console.error("Please ensure 'result.json' is a valid JSON file and contains the 'chats.list' structure.");
  })
  .on('end', () => {
    console.log('--------------------------------------------------');
    if (totalChatsProcessed > 0) {
      console.log(`Finished processing all chats.`);
      console.log(`Total chats processed: ${totalChatsProcessed}`);
      console.log(`Output files are located in: ${path.resolve(outputDir)}`);
    } else {
      console.warn("Warning: No chats were processed from 'chats.list'.");
      console.warn('Please check the following:');
      console.warn("  1. 'result.json' exists in the same directory as the script.");
      console.warn("  2. 'result.json' is not empty and is a valid JSON file.");
      console.warn(
        '  3. The JSON file has a structure like: { ..., "chats": { "list": [ ...chat objects... ] }, ... }',
      );
    }
    console.log('--------------------------------------------------');
  });

readStream.on('error', (err) => {
  // This catches errors from the read stream itself (e.g., file not found)
  if (err.code === 'ENOENT') {
    console.error(`Critical Error: Input file '${inputFile}' not found in the current directory (${process.cwd()}).`);
    console.error('Please make sure the file exists and the script is run from the correct directory.');
  } else {
    console.error('Critical Error reading input file stream:', err.message);
  }
  // It's good practice to ensure the process exits if the input file can't be read.
  process.exit(1);
});

/*
 * Optional: You can listen to 'header' and 'footer' on the parser if needed
 * parser.on('header', (data) => {
 *   console.log("JSONStream parser header:", data); // The object that 'chats.list' belongs to
 * });
 * parser.on('footer', () => {
 *   console.log("JSONStream parser footer reached (end of 'chats.list' processing).");
 * });
 */

console.log('Script initialized. Waiting for file stream and parser to process data...');
