const fs = require('fs');

// Fix server.ts missing }
let serverCode = fs.readFileSync('server.ts', 'utf8').trim();
if (serverCode.endsWith('startServer();')) {
  serverCode = serverCode.replace(/startServer\(\);$/, '}\nstartServer();\n');
} else {
  serverCode += '\n}\nstartServer();\n';
}
fs.writeFileSync('server.ts', serverCode);

// Fix PlanningCentre.tsx extra } - I already popped it in fix_planning_2.cjs, let's see if that was enough.
