const fs = require('fs');

const files = [
  'src/App.tsx',
  'src/components/BudgetExpenseTracker.tsx',
  'src/components/LogisticsManager.tsx',
  'src/components/PlanningCentre.tsx'
];

for (const file of files) {
  let code = fs.readFileSync(file, 'utf8');
  code = code.replace(/fetch\('\/api/g, "apiFetch('/api");
  code = code.replace(/fetch\(\`\/api/g, "apiFetch(\`/api");
  fs.writeFileSync(file, code);
}
