const fs = require('fs');
let code = fs.readFileSync('src/components/PlanningCentre.tsx', 'utf8');

const replacementSnippet = `
      if (googleAccessToken) {
        const mimeType = fileType === 'doc' ? 'application/vnd.google-apps.document' : 'application/vnd.google-apps.spreadsheet';
        
        // Proxy the creation through the server to bypass readonly OAuth constraints and use server credentials
        const res = await fetch('/api/planning/attached-docs/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: fileName,
            type: mimeType,
            eventId: selectedEventId,
            attachedBy: userName,
            category: category,
            content: '' // No content, just create the metadata and attach
          })
        });
        
        if (res.ok) {
          const newDoc = await res.json();
          setAttachedDocs(prev => prev.some(d => d.id === newDoc.id) ? prev : [...prev, newDoc]);
          showNotification(\`Created and linked new Google \${fileType === 'doc' ? 'Document' : 'Spreadsheet'}!\`, 'success');
          fetchDriveFilesFromBackend(activeFolderId || undefined);
        } else {
          const errorMsg = await res.text();
          throw new Error(errorMsg);
        }
      }
`;

code = code.replace(/if \(googleAccessToken\) \{\n\s*const mimeType = fileType === 'doc' \? 'application\/vnd\.google-apps\.document' : 'application\/vnd\.google-apps\.spreadsheet';[\s\S]*?\} else \{/,
  replacementSnippet.trim() + ' else {');

fs.writeFileSync('src/components/PlanningCentre.tsx', code);
