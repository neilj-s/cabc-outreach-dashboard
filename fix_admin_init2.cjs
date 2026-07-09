const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const replacement = `
if (saKeyStr) {
  try {
    const saKey = JSON.parse(saKeyStr);
    firebaseAdminApp = admin.initializeApp({
      credential: admin.credential.cert(saKey)
    });
    console.log('Firebase Admin initialized with GOOGLE_SERVICE_ACCOUNT_KEY');
  } catch (e) {
    console.error('Failed to initialize Firebase Admin with GOOGLE_SERVICE_ACCOUNT_KEY:', e);
  }
} else if (saEmail && saPrivateKey) {
  try {
    firebaseAdminApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: saEmail.split('@')[1].split('.')[0] || 'mock-project',
        clientEmail: saEmail,
        privateKey: saPrivateKey.replace(/\\\\n/g, '\\n'),
      })
    });
    console.log('Firebase Admin initialized with EMAIL & PRIVATE_KEY');
  } catch (e) {
    console.error('Failed to initialize Firebase Admin with EMAIL & PRIVATE_KEY:', e);
  }
} else {
  try {
    const firebaseConfig = require('./firebase-applet-config.json');
    firebaseAdminApp = admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
    console.log('Firebase Admin initialized with projectId from firebase-applet-config.json');
  } catch (e) {
    console.warn('Firebase Admin not initialized. API routes may fail if they require authentication.', e);
  }
}
`;

code = code.replace(/if \(saKeyStr\) \{[\s\S]*?\} else \{\n\s*console\.warn\('Firebase Admin not initialized\. API routes may fail if they require authentication\.'\);\n\}/, replacement.trim());

fs.writeFileSync('server.ts', code);
