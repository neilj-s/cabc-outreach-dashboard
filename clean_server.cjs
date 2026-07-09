const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// We will remove /api/planning/ideas and /api/planning/scratchpad
code = code.replace(/app\.get\('\/api\/planning\/scratchpad',.*?\}\);/gs, '');
code = code.replace(/app\.post\('\/api\/planning\/scratchpad',.*?\}\);/gs, '');
code = code.replace(/app\.get\('\/api\/planning\/ideas',.*?\}\);/gs, '');
code = code.replace(/app\.post\('\/api\/planning\/ideas',.*?\}\);/gs, '');
code = code.replace(/app\.put\('\/api\/planning\/ideas\/:id',.*?\}\);/gs, '');
code = code.replace(/app\.delete\('\/api\/planning\/ideas\/:id',.*?\}\);/gs, '');

fs.writeFileSync('server.ts', code);
console.log('patched server.ts');
