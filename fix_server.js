const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// The error is because my regex /.*?\}\);/gs matched WAY more than I wanted!
// Since I don't have the original code, I should look at the errors and fix them manually.
