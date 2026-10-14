const fs = require('fs');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, 'functions/_lib/passes.js'), 'utf8');
const matches = [...source.matchAll(/\{ name: '([^']+)', id: (\d+), price: (\d+) \}/g)];
const ids = matches.map(m => m[2]);
if (matches.length !== 23 || new Set(ids).size !== 23) {
  throw new Error(`Expected 23 unique passes, got ${matches.length}`);
}
console.log(`Verified ${matches.length} gamepasses, all unique IDs.`);
