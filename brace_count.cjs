const fs = require('fs');
const lines = fs.readFileSync('src/components/PlanningCentre.tsx', 'utf8').split('\n');
let count = 0;
for(let i=0; i<1307; i++) {
  const line = lines[i] || '';
  const opens = (line.match(/\{/g) || []).length;
  const closes = (line.match(/\}/g) || []).length;
  count += opens;
  count -= closes;
  if(count === 0 && i > 100) { // Should not hit 0 inside the component
    console.log('Hits 0 at line:', i+1);
    break;
  }
}
console.log('Final count at 1307:', count);
