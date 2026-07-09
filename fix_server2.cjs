const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/const \{ name, date, description \} = req\.body;/,
  'const { name, date, description, driveFolderId } = req.body;');

fs.writeFileSync('server.ts', code);
