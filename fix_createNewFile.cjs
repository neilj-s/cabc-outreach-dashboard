const fs = require('fs');
let code = fs.readFileSync('src/components/PlanningCentre.tsx', 'utf8');

code = code.replace(/const folderId = activeFolderId \|\| savedFolderDetails\?\.id;/,
  'const folderId = eventObj?.driveFolderId || activeFolderId || savedFolderDetails?.id;');

fs.writeFileSync('src/components/PlanningCentre.tsx', code);
