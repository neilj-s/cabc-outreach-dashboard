const fs = require('fs');
let code = fs.readFileSync('src/components/PlanningCentre.tsx', 'utf8');

code = code.replace(/triggerFreshSync: \(\) => Promise<void>;/, 'triggerFreshSync: () => Promise<void>;\n  onUpdateEvent?: (eventId: string, data: Partial<MinistryEvent>) => Promise<void>;');

code = code.replace(/onUpdateEventDocs,\n  triggerFreshSync\n}: \{/, 'onUpdateEventDocs,\n  triggerFreshSync,\n  onUpdateEvent\n}: {');

// The destructuring block could be slightly different, let's use a regex that matches `triggerFreshSync }: {` or similar
code = code.replace(/triggerFreshSync(.*?)\}:/, 'triggerFreshSync, onUpdateEvent$1}:');

fs.writeFileSync('src/components/PlanningCentre.tsx', code);
