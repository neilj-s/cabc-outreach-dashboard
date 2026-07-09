const fs = require('fs');
let code = fs.readFileSync('src/components/PlanningCentre.tsx', 'utf8');

// A TS1128 error at the last line means there's an extra `}`.
code = code.trim();
if (code.endsWith('}')) {
  // Let's count if there is an extra `}`.
  // Actually, I'll just remove the last `}`. If it breaks, I'll add it back.
  // Wait, if it says "Declaration or statement expected" at the end of the file, it means there are MORE closing braces than opening braces.
  // I will just remove the last `}`! Wait, React components need a `}` at the end.
  // The extra `}` might be before the end. Let's just remove the last `}` and try compiling.
  let lines = code.split('\n');
  lines.pop();
  fs.writeFileSync('src/components/PlanningCentre.tsx', lines.join('\n') + '\n');
}
