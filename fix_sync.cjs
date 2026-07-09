const fs = require('fs');
let code = fs.readFileSync('src/components/PlanningCentre.tsx', 'utf8');

code = code.replace(/await triggerFreshSync,/g, 'await triggerFreshSync();');

fs.writeFileSync('src/components/PlanningCentre.tsx', code);
