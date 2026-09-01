const fs = require('fs');
const path = 'd:/CampusMind/server/src/config/rag.js';
let c = fs.readFileSync(path, 'utf8');

// The appended block landed after the closing `};` of module.exports.
// Remove that closing brace before the appended block, and close the object at EOF instead.
const marker = '};\n\n// Answer length modes (Section 16): prompt-only instruction changes.';
if (!c.includes(marker)) { console.error('marker not found'); process.exit(1); }
c = c.replace(marker, '\n  // Answer length modes (Section 16): prompt-only instruction changes.');

// Indent the appended block by two spaces and re-close module.exports at EOF.
const idx = c.indexOf('  // Answer length modes');
let tail = c.slice(idx);
// add 2-space indent to each non-empty line of the tail (except the trailing languageInstruction block)
tail = tail
  .split('\n')
  .map((line) => (line.trim() ? '  ' + line : line))
  .join('\n');
c = c.slice(0, idx) + tail.replace(/\s*$/, '\n};\n');

fs.writeFileSync(path, c);
console.log('rag.js fixed');
