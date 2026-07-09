const fs = require('fs');
let code = fs.readFileSync('src/components/PlanningCentre.tsx', 'utf8');

code = code.replace(/setFirebaseUser\(usr\);/, 'setFirebaseUser(usr);\n        if (usr.displayName) setUserName(usr.displayName);');

fs.writeFileSync('src/components/PlanningCentre.tsx', code);
