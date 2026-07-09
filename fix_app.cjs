const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/onUpdateEventDocs=\{handleUpdateEventDocs\}\n\s*onUpdateEvent=\{handleUpdateEvent\}\n\s*onUpdateEvent=\{handleUpdateEvent\}/g, 
  'onUpdateEventDocs={handleUpdateEventDocs}\n            onUpdateEvent={handleUpdateEvent}');

fs.writeFileSync('src/App.tsx', code);
