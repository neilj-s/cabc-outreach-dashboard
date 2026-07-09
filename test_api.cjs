const fs = require('fs');
let code = fs.readFileSync('src/lib/api.ts', 'utf8');

if (!code.includes('await auth.authStateReady()')) {
  code = code.replace(/let user = auth\.currentUser;/, "await auth.authStateReady();\n  let user = auth.currentUser;");
  fs.writeFileSync('src/lib/api.ts', code);
  console.log('Added authStateReady to apiFetch');
}
