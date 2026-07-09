const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// The error is TS1128 at the end. That means too many closing braces!
// Let's count them. But an easier way is just to remove one from the end.
let newCode = code.replace(/}\s*startServer\(\);\s*$/, 'startServer();\n');
fs.writeFileSync('server.ts', newCode);
