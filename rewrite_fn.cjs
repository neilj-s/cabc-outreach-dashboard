const fs = require('fs');
let code = fs.readFileSync('src/components/PlanningCentre.tsx', 'utf8');

const newFn = `
  const handleCreateNewFile = async (fileType: 'doc' | 'sheet') => {
    if (!selectedEventId) {
      showNotification('Please select an active event first.', 'error');
      return;
    }

    const eventObj = events.find(e => e.id === selectedEventId);
    const eventName = eventObj ? eventObj.name : 'Event';
    const fileName = \`\${eventName} - \${fileType === 'doc' ? 'Planning Guide' : 'Budget & Prep Tracker'}\`;
    const category = fileType === 'doc' ? 'Meeting Minutes' : 'Spreadsheets/Budgets';

    setCreatingFile(true);

    try {
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
      } else {
        const mimeType = fileType === 'doc' ? 'application/vnd.google-apps.document' : 'application/vnd.google-apps.spreadsheet';
        const docId = \`sim_\${Date.now()}\`;
        const simulatedUrl = fileType === 'doc' 
          ? \`https://docs.google.com/document/d/\${docId}/edit\` 
          : \`https://docs.google.com/spreadsheets/d/\${docId}/edit\`;

        const dbRes = await fetch('/api/planning/attached-docs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: fileName,
            type: mimeType,
            source: 'google',
            url: simulatedUrl,
            embedUrl: simulatedUrl,
            attachedBy: userName,
            eventId: selectedEventId,
            category: category
          })
        });

        if (dbRes.ok) {
          const newDoc = await dbRes.json();
          setAttachedDocs(prev => prev.some(d => d.id === newDoc.id) ? prev : [...prev, newDoc]);
          showNotification(\`[Simulation Mode] Created new localized Google \${fileType === 'doc' ? 'Doc' : 'Sheet'} metadata. Connect a Google account to create live Drive assets.\`, 'success');
        }
      }
    } catch (err: any) {
      console.error(err);
      showNotification(\`Failed to create file: \${err.message}\`, 'error');
    } finally {
      setCreatingFile(false);
    }
  };
`;

code = code.replace(/const handleCreateNewFile = async \(fileType: 'doc' \| 'sheet'\) => \{[\s\S]*?\}\n  \};\n/, newFn.trim() + '\n\n');

fs.writeFileSync('src/components/PlanningCentre.tsx', code);
