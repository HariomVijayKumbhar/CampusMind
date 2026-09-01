// Patch 2: fix the assemblePrompt length-mode/language injection (small anchors)
const fs = require('fs');
const path = 'd:/CampusMind/server/src/services/ragService.js';
let c = fs.readFileSync(path, 'utf8');

function rep(from, to) {
  if (!c.includes(from)) {
    console.error('NOT FOUND:', JSON.stringify(from.slice(0, 70)));
    process.exitCode = 1;
    return;
  }
  c = c.replace(from, to);
}

rep(
  'function assemblePrompt(question, chunks, conversationHistory = [], options = {}) {\n  const contextText',
  "function assemblePrompt(question, chunks, conversationHistory = [], options = {}) {\n  const { lengthMode = ragConfig.defaultLengthMode, language = 'en' } = options;\n  const lengthModeConfig =\n    ragConfig.lengthModes[lengthMode] || ragConfig.lengthModes[ragConfig.defaultLengthMode];\n\n  const contextText"
);

rep(
  '- Do not invent facts, dates, or details.`;',
  "- Do not invent facts, dates, or details.\n\nAnswer style (${lengthModeConfig.label}): ${lengthModeConfig.instruction}\nLanguage: ${ragConfig.languageInstruction(language)}`;"
);

fs.writeFileSync(path, c);
console.log('patch2 OK');
