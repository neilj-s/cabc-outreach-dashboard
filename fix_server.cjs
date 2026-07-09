const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/const \{ name, date, description \} = req\.body;/,
  'const { name, date, description, driveFolderId } = req.body;');

code = code.replace(/if \(description !== undefined\) event\.description = description;/,
  'if (description !== undefined) event.description = description;\n    if (driveFolderId !== undefined) event.driveFolderId = driveFolderId;');

// Fix WebSocket ATTACH_DOC_ADD duplication
// In app.post('/api/planning/attached-docs', (req, res) => { ... })
// We should broadcast ATTACH_DOCS_CHANGE instead of having the frontend do it
const broadcastSnippet = `
    saveDb(db);
    broadcast({
      type: 'ATTACH_DOCS_CHANGE',
      payload: { attachedDocs: db.attachedDocs }
    });
    res.status(201).json(newDoc);
`;
code = code.replace(/saveDb\(db\);\n\s*res\.status\(201\)\.json\(newDoc\);/, broadcastSnippet);

// We need to also check the WebSocket handler case 'ATTACH_DOC_ADD':
// Let's remove the logic in ATTACH_DOC_ADD that pushes to db to avoid double saving.
// Or just ignore ATTACH_DOC_ADD if it's already saved by the API.
// Let's search for ATTACH_DOC_ADD in server.ts
code = code.replace(/case 'ATTACH_DOC_ADD': \{\n\s*db\.attachedDocs = db\.attachedDocs \|\| \[\];\n\s*db\.attachedDocs\.push\(msg\.payload\.doc\);\n\s*saveDb\(db\);\n\s*broadcast\(\{/,
  "case 'ATTACH_DOC_ADD': {\n            // The REST API already saves it, we just broadcast if needed\n            // Actually, we don't need this if the API broadcasts.\n            broadcast({");


fs.writeFileSync('server.ts', code);
