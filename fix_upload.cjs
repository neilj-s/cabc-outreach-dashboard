const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const folderIdSnippet = `
          let folderId = db.driveFolderId || 'root';
          if (eventId) {
            const targetEvent = db.events.find((e: any) => e.id === eventId);
            if (targetEvent && targetEvent.driveFolderId) {
              folderId = targetEvent.driveFolderId;
            }
          }
`;

code = code.replace(/const folderId = db.driveFolderId \|\| 'root';/, folderIdSnippet);

fs.writeFileSync('server.ts', code);
