const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const middleware = `
  const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Exclude specific unauthenticated endpoints
    if (req.path === '/api/drive/webhook' || req.path === '/drive/webhook') {
      return next();
    }
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    try {
      if (!firebaseAdminApp) {
        throw new Error('Firebase Admin not initialized on server');
      }
      const decodedToken = await firebaseAdminApp.auth().verifyIdToken(idToken);
      (req as any).user = decodedToken;
      next();
    } catch (error) {
      console.error('Error verifying Firebase ID token:', error);
      return res.status(401).json({ error: 'Unauthorized: Invalid ID token' });
    }
  };

  app.use('/api', requireAuth);
`;

code = code.replace(/app\.use\(express\.urlencoded\(\{ limit: '15mb', extended: true \}\)\);/,
  "app.use(express.urlencoded({ limit: '15mb', extended: true }));\n" + middleware);

fs.writeFileSync('server.ts', code);
