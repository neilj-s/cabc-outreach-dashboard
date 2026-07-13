import express from 'express';
import path from 'path';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

import { 
  getDb, 
  saveDb, 
  requireAuth, 
  setBroadcastHandler, 
  SEED_DATA, 
  generateTasksForEvent,
  normalizeDb,
  logActivity,
  verifyTokenAndEmail
} from './server/storage';

import eventsRouter from './server/routes/events';
import volunteersRouter from './server/routes/volunteers';
import expensesRouter from './server/routes/expenses';
import assetsRouter from './server/routes/assets';
import debriefsRouter from './server/routes/debriefs';
import driveRouter from './server/routes/drive';
import planningRouter from './server/routes/planning';
import inventoryRouter from './server/routes/inventory';
import reservationsRouter from './server/routes/reservations';
import lanesRouter from './server/routes/lanes';
import versesRouter from './server/routes/verses';

import { MinistryEvent, Asset, Volunteer, Task, LaneDetail } from './src/types';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // --- PUBLIC ENDPOINTS (No firebaseAuth needed) ---
  app.use('/api/drive', driveRouter);

  // --- SECURED ENDPOINTS (Firebase requireAuth) ---
  app.use('/api', requireAuth);

  // Mount resource routers
  app.use('/api/events', eventsRouter);
  app.use('/api/volunteers', volunteersRouter);
  app.use('/api/expenses', expensesRouter);
  app.use('/api/assets', assetsRouter);
  app.use('/api/debriefs', debriefsRouter);
  app.use('/api/planning', planningRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/reservations', reservationsRouter);
  app.use('/api/lanes', lanesRouter);
  app.use('/api/verses', versesRouter);

  // --- API ROUTE: Restore Database ---
  app.post('/api/restore', (req, res) => {
    try {
      const payload = req.body;
      if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ error: 'Invalid payload: must be a JSON object' });
      }

      // Basic validation of shape
      const hasEvents = 'events' in payload;
      const hasVolunteers = 'volunteers' in payload;
      const hasAssets = 'assets' in payload;

      if (!hasEvents && !hasVolunteers && !hasAssets) {
        return res.status(400).json({ error: 'Invalid database backup shape. Must contain events, volunteers, or assets.' });
      }

      // Normalize using the helper
      const restoredData = normalizeDb(payload);
      
      // Overwrite the database
      saveDb(restoredData);

      // Log activity
      logActivity(
        restoredData,
        'event_updated',
        'Database Restored',
        'The database was successfully restored from a JSON backup file.'
      );

      res.json({ success: true, message: 'Database successfully restored' });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Error restoring database:', err);
      res.status(500).json({ error: 'Failed to restore database', details: errMsg });
    }
  });

  // --- API ROUTE: Activities ---
  app.get('/api/activities', (req, res) => {
    try {
      const db = getDb();
      res.json(db.activities || []);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Error fetching activities:', err);
      res.status(500).json({ error: 'Internal server error fetching activities', details: errMsg });
    }
  });

  // --- API ROUTE: Dashboard Summary ---
  app.get('/api/dashboard/summary', (req, res) => {
    try {
      const db = getDb();
      const eventsList = Array.isArray(db.events) ? db.events : [];
      const assetsList = Array.isArray(db.assets) ? db.assets : [];
      const volunteersList = Array.isArray(db.volunteers) ? db.volunteers : [];

      const totalEvents = eventsList.length;
      const totalAssets = assetsList.length;
      
      // Deduplicate volunteers by email or name
      const seenVolunteers = new Set<string>();
      const uniqueVolunteers = volunteersList.filter((v: Volunteer) => {
        if (!v) return false;
        const emailLower = (v.email || '').toLowerCase().trim();
        const nameLower = (v.name || '').toLowerCase().trim();
        const key = emailLower || nameLower;
        if (!key) return true;
        if (seenVolunteers.has(key)) {
          return false;
        }
        seenVolunteers.add(key);
        return true;
      });
      const totalVolunteers = uniqueVolunteers.length;
      
      // Count tasks
      let completedTasks = 0;
      let totalTasks = 0;
      eventsList.forEach((evt: MinistryEvent) => {
        if (evt && Array.isArray(evt.tasks)) {
          evt.tasks.forEach((t) => {
            if (t) {
              totalTasks++;
              if (t.completed) completedTasks++;
            }
          });
        }
      });

      // High value assets from reservations
      const reservationsList = Array.isArray(db.reservations) ? db.reservations : [];
      const inventoryList = Array.isArray(db.inventory) ? db.inventory : [];
      const todayStr = new Date().toISOString().split('T')[0];

      const missingHighValueCount = reservationsList.filter((res: any) => {
        if (!res) return false;
        const item = inventoryList.find((inv: any) => inv && inv.id === res.assetId);
        const isHighValue = item ? !!item.isHighValue : false;
        const isPastEvent = res.eventDate && res.eventDate < todayStr;
        const isNotReturned = res.status !== 'Returned';
        return isHighValue && isPastEvent && isNotReturned;
      }).length;

      // Burnout stats
      const activeTasksByLane: Record<string, Task[]> = {};
      eventsList.forEach((evt: MinistryEvent) => {
        if (evt && Array.isArray(evt.tasks)) {
          evt.tasks.forEach((t: Task) => {
            if (t && !t.completed) {
              const lName = t.lane || 'Strategy';
              if (!activeTasksByLane[lName]) {
                activeTasksByLane[lName] = [];
              }
              activeTasksByLane[lName].push(t);
            }
          });
        }
      });

      const leadStats: Record<string, { activeTasksCount: number; weeklyHours: number }> = {};
      const lanesList = Array.isArray(db.lanes) ? db.lanes : [];
      lanesList.forEach((lane: LaneDetail) => {
        if (!lane) return;
        const leadName = lane.leadName;
        if (!leadName) return;
        if (!leadStats[leadName]) {
          leadStats[leadName] = { activeTasksCount: 0, weeklyHours: 0 };
        }
        const tasksInLane = activeTasksByLane[lane.name] || [];
        leadStats[leadName].activeTasksCount += tasksInLane.length;
        const hoursInLane = tasksInLane.reduce((sum: number, t: Task) => sum + (t.estimatedHours || 2), 0);
        leadStats[leadName].weeklyHours += hoursInLane;
      });

      let overallocatedLeadsCount = 0;
      Object.values(leadStats).forEach((stats) => {
        if (stats.activeTasksCount > 15 || stats.weeklyHours > 20) {
          overallocatedLeadsCount++;
        }
      });

      res.json({
        totalEvents,
        totalAssets,
        totalVolunteers,
        totalTasks,
        completedTasks,
        missingHighValueCount: missingHighValueCount,
        overburdenedVolunteersCount: overallocatedLeadsCount,
        nonCompliantVolunteersCount: 0
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Error calculating dashboard summary:', err);
      res.status(500).json({ error: 'Internal server error calculating summary', details: errMsg });
    }
  });



  // --- Serve Frontend ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  interface ClientState {
    ws: WebSocket;
    id: string;
    name: string;
    color: string;
    cursor: number | null;
    selection: { start: number; end: number } | null;
    cellFocus: { row: number; col: number } | null;
  }
  const clients = new Map<string, ClientState>();

  const broadcast = (message: unknown, skipClientId?: string) => {
    const raw = JSON.stringify(message);
    clients.forEach((client, id) => {
      if (id !== skipClientId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(raw);
      }
    });
  };

  // Register broadcast handler with storage.ts
  setBroadcastHandler(broadcast);

  wss.on('connection', async (ws, req) => {
    const reqUrl = req.url || '';
    const tokenMatch = reqUrl.match(/[?&]token=([^&]+)/);
    const idToken = tokenMatch ? decodeURIComponent(tokenMatch[1]) : undefined;

    if (!idToken) {
      console.warn('WebSocket connection rejected: Missing Firebase token.');
      ws.close(4001, 'Unauthorized: Missing token');
      return;
    }

    try {
      await verifyTokenAndEmail(idToken);
    } catch (err: any) {
      console.warn('WebSocket connection rejected: Token verification failed:', err.message);
      ws.close(4003, 'Unauthorized: Access restricted');
      return;
    }

    let clientId = `user_${Date.now()}`;
    
    ws.on('message', (messageStr) => {
      try {
        const msg = JSON.parse(messageStr.toString());
        const db = getDb();

        switch (msg.type) {
          case 'JOIN': {
            clientId = msg.payload.userId || clientId;
            clients.set(clientId, {
              ws,
              id: clientId,
              name: msg.payload.name || 'Anonymous',
              color: msg.payload.color || '#856637',
              cursor: null,
              selection: null,
              cellFocus: null
            });
            ws.send(JSON.stringify({
              type: 'INIT_STATE',
              payload: {
                scratchpad: db.scratchpad || '',
                collabTable: db.collabTable || { headers: [], rows: [] },
                attachedDocs: db.attachedDocs || [],
                users: Array.from(clients.values()).map(c => ({
                  id: c.id,
                  name: c.name,
                  color: c.color,
                  cursor: c.cursor,
                  selection: c.selection,
                  cellFocus: c.cellFocus
                }))
              }
            }));
            broadcast({
              type: 'PRESENCE_CHANGE',
              payload: {
                users: Array.from(clients.values()).map(c => ({
                  id: c.id,
                  name: c.name,
                  color: c.color,
                  cursor: c.cursor,
                  selection: c.selection,
                  cellFocus: c.cellFocus
                }))
              }
            });
            break;
          }

          case 'CURSOR_MOVE': {
            const client = clients.get(clientId);
            if (client) {
              client.cursor = msg.payload.cursor !== undefined ? msg.payload.cursor : client.cursor;
              client.selection = msg.payload.selection !== undefined ? msg.payload.selection : client.selection;
              client.cellFocus = msg.payload.cellFocus !== undefined ? msg.payload.cellFocus : client.cellFocus;
              
              broadcast({
                type: 'CURSOR_MOVE',
                payload: {
                  userId: clientId,
                  cursor: client.cursor,
                  selection: client.selection,
                  cellFocus: client.cellFocus
                }
              }, clientId);
            }
            break;
          }

          case 'TEXT_EDIT': {
            db.scratchpad = msg.payload.text || '';
            saveDb(db);
            broadcast({
              type: 'TEXT_EDIT',
              payload: {
                text: db.scratchpad,
                userId: clientId
              }
            }, clientId);
            break;
          }

          case 'TABLE_EDIT': {
            db.collabTable = msg.payload.collabTable;
            saveDb(db);
            broadcast({
              type: 'TABLE_EDIT',
              payload: {
                collabTable: db.collabTable
              }
            }, clientId);
            break;
          }

          case 'ATTACH_DOC_ADD': {
            broadcast({
              type: 'ATTACH_DOCS_CHANGE',
              payload: {
                attachedDocs: db.attachedDocs
              }
            });
            break;
          }

          case 'PING': {
            ws.send(JSON.stringify({ type: 'PONG' }));
            break;
          }
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      clients.delete(clientId);
      broadcast({
        type: 'PRESENCE_CHANGE',
        payload: {
          users: Array.from(clients.values()).map(c => ({
            id: c.id,
            name: c.name,
            color: c.color,
            cursor: c.cursor,
            selection: c.selection,
            cellFocus: c.cellFocus
          }))
        }
      });
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Ministry Dashboard] Backend running on http://localhost:${PORT}`);
  });
}

startServer();
