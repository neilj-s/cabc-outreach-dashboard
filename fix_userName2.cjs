const fs = require('fs');
let code = fs.readFileSync('src/components/PlanningCentre.tsx', 'utf8');

code = code.replace(/setGoogleAccessToken\(token\);/, 'setGoogleAccessToken(token);\n          if (result.user.displayName) setUserName(result.user.displayName);');

fs.writeFileSync('src/components/PlanningCentre.tsx', code);
