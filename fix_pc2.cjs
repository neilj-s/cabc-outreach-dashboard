const fs = require('fs');
let code = fs.readFileSync('src/components/PlanningCentre.tsx', 'utf8');

code = code.replace(/if \(wsRef\.current && wsRef\.current\.readyState === WebSocket\.OPEN\) \{\n\s*wsRef\.current\.send\(JSON\.stringify\(\{\n\s*type: 'ATTACH_DOC_ADD',\n\s*payload: \{ doc: newDoc \}\n\s*\}\)\);\n\s*\} else \{\n\s*setAttachedDocs\(prev => \[\.\.\.prev, newDoc\]\);\n\s*\}/g,
  "// Event broadcast is handled by server API POST now.\n              setAttachedDocs(prev => prev.some(d => d.id === newDoc.id) ? prev : [...prev, newDoc]);");

fs.writeFileSync('src/components/PlanningCentre.tsx', code);
