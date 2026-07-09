const fs = require('fs');
let code = fs.readFileSync('src/lib/api.ts', 'utf8');
code = code.replace(/signInWithPopup/g, 'signInWithRedirect');
fs.writeFileSync('src/lib/api.ts', code);
