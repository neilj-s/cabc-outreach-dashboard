const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const adminImport = `
import admin from 'firebase-admin';

// Initialize Firebase Admin
let firebaseAdminApp: admin.app.App | null = null;

const saKeyStr = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
let saEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
let saPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

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
        privateKey: saPrivateKey.replace(/\\n/g, '\\n'),
      })
    });
    console.log('Firebase Admin initialized with EMAIL & PRIVATE_KEY');
  } catch (e) {
    console.error('Failed to initialize Firebase Admin with EMAIL & PRIVATE_KEY:', e);
  }
} else {
  console.warn('Firebase Admin not initialized. API routes may fail if they require authentication.');
}
`;

code = code.replace(/import \{ createServer as createViteServer \} from 'vite';/, "import { createServer as createViteServer } from 'vite';\n" + adminImport);

fs.writeFileSync('server.ts', code);
