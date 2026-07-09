const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/if \(!name \|\| !content \|\| !eventId\) \{\n\s*return res\.status\(400\)\.json\(\{ error: 'Name, content, and eventId are required.' \}\);\n\s*\}/, 
  "if (!name || !eventId) {\n      return res.status(400).json({ error: 'Name and eventId are required.' });\n    }");

code = code.replace(/\/\/ 2\. Upload the raw content as media \(PATCH upload type media\)\n\s*const base64Data = content\.includes\('base64,'\) \? content\.split\('base64,'\)\[1\] : content;\n\s*const buffer = Buffer\.from\(base64Data, 'base64'\);\n\s*console\.log\(`\[File Portal\] Uploading media binary payload \(\$\{buffer\.length\} bytes\) to Google Drive file ID: \$\{googleFileId\}`\);\n\s*const uploadRes = await fetch\(`https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\/\$\{googleFileId\}\?uploadType=media`, \{\n\s*method: 'PATCH',\n\s*headers: \{\n\s*'Authorization': `Bearer \$\{token\}`,\n\s*'Content-Type': fileType\n\s*\},\n\s*body: buffer\n\s*\}\);\n\s*if \(!uploadRes\.ok\) \{\n\s*console\.warn\('\[File Portal\] Content upload failed, metadata preserved:', await uploadRes\.text\(\)\);\n\s*\}/s,
  `// 2. Upload the raw content as media (PATCH upload type media)
            if (content) {
              const base64Data = content.includes('base64,') ? content.split('base64,')[1] : content;
              const buffer = Buffer.from(base64Data, 'base64');
              
              console.log(\`[File Portal] Uploading media binary payload (\${buffer.length} bytes) to Google Drive file ID: \${googleFileId}\`);
              const uploadRes = await fetch(\`https://www.googleapis.com/upload/drive/v3/files/\${googleFileId}?uploadType=media\`, {
                method: 'PATCH',
                headers: {
                  'Authorization': \`Bearer \${token}\`,
                  'Content-Type': fileType
                },
                body: buffer
              });
              if (!uploadRes.ok) {
                console.warn('[File Portal] Content upload failed, metadata preserved:', await uploadRes.text());
              }
            }`);

fs.writeFileSync('server.ts', code);
