const fs = require('fs');
let code = fs.readFileSync('src/lib/api.ts', 'utf8');

code = code.replace(/} catch \(err\) \{\n\s*console\.error\('Login required for API call', err\);\n\s*throw new Error\('Authentication required'\);/, 
  `} catch (err: any) {
      if (err.code !== 'auth/popup-blocked') {
        console.error('Login required for API call', err);
      }
      throw new Error('Authentication required');`);

fs.writeFileSync('src/lib/api.ts', code);
