const fs = require('fs');
let code = fs.readFileSync('src/components/PlanningCentre.tsx', 'utf8');

// Replace fetchPlanningData body
code = code.replace(/setIdeas\(ideasRes\);\n\s*setScratchpadText\(scratchpadRes\.scratchpad\);\n/g, '');

fs.writeFileSync('src/components/PlanningCentre.tsx', code);
