const fs = require('fs');
let code = fs.readFileSync('src/components/PlanningCentre.tsx', 'utf8');

code = code.replace(/triggerFreshSync,\n  onUpdateEvent: \(\) => Promise<void>;\n  onUpdateEvent\?: \(eventId: string, data: Partial<MinistryEvent>\) => Promise<void>;/,
  'triggerFreshSync: () => Promise<void>;\n  onUpdateEvent?: (eventId: string, data: Partial<MinistryEvent>) => Promise<void>;');

fs.writeFileSync('src/components/PlanningCentre.tsx', code);
