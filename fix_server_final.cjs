const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const startIdx = code.indexOf('// --- API ROUTES: Planning Centre (Ideas & Scratchpad) ---');
const endIdx = code.indexOf('// --- API ROUTES: Collaborative Table ---');

if (startIdx !== -1 && endIdx !== -1) {
  code = code.substring(0, startIdx) + '\n  ' + code.substring(endIdx);
  fs.writeFileSync('server.ts', code);
  console.log('Fixed server.ts successfully');
} else {
  console.log('Could not find markers');
}
