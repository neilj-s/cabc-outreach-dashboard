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
  logActivity
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
        'SYSTEM',
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

      // High value assets
      const highValueAssets = assetsList.filter((a: Asset) => a && a.isHighValue);
      const missingHighValue = highValueAssets.filter((a: Asset) => a && a.status !== 'Returned');

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
        missingHighValueCount: missingHighValue.length,
        overburdenedVolunteersCount: overallocatedLeadsCount,
        nonCompliantVolunteersCount: 0
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Error calculating dashboard summary:', err);
      res.status(500).json({ error: 'Internal server error calculating summary', details: errMsg });
    }
  });

  // --- API ROUTE: Database Reset ---
  app.post('/api/reset', (req, res) => {
    const freshSeed = JSON.parse(JSON.stringify(SEED_DATA));
    freshSeed.events[0].tasks = generateTasksForEvent(freshSeed.events[0].name, freshSeed.events[0].date);
    freshSeed.events[1].tasks = generateTasksForEvent(freshSeed.events[1].name, freshSeed.events[1].date);
    freshSeed.events[2].tasks = generateTasksForEvent(freshSeed.events[2].name, freshSeed.events[2].date);
    
    saveDb(freshSeed);
    res.json({ success: true, message: 'Database reset to default template state.' });
  });

  // --- API ROUTE: Database Restore ---
  app.post('/api/restore', (req, res) => {
    try {
      const data = req.body;
      if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'Invalid backup format: Must be a JSON object.' });
      }

      // Basic structure validation: make sure at least events and volunteers are arrays
      if (!Array.isArray(data.events) || !Array.isArray(data.volunteers)) {
        return res.status(400).json({ error: 'Invalid database shape: "events" and "volunteers" must be arrays.' });
      }

      // Normalize and save
      const normalized = normalizeDb(data);
      saveDb(normalized);

      res.json({ success: true, message: 'Database restored successfully!' });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Error during database restore:', err);
      res.status(500).json({ error: 'Internal server error restoring database', details: errMsg });
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

  wss.on('connection', (ws) => {
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

  // Background typing simulation
  const simUsers = [
    { id: 'sim_joy', name: 'Joy P. (Strategy)', color: '#3b82f6', active: false },
    { id: 'sim_bea', name: 'Bea P. (Finance)', color: '#f59e0b', active: false },
    { id: 'sim_neil', name: 'Neil S. (Multimedia)', color: '#8b5cf6', active: false },
    { id: 'sim_ops', name: 'Operations Lead', color: '#ec4899', active: false }
  ];

  setInterval(() => {
    const rand = Math.random();
    const db = getDb();
    
    if (rand < 0.25) {
      const user = simUsers[Math.floor(Math.random() * simUsers.length)];
      user.active = !user.active;
      
      broadcast({
        type: 'SIM_PRESENCE',
        payload: {
          user: {
            id: user.id,
            name: user.name,
            color: user.color,
            active: user.active,
            cursor: user.active ? Math.floor(Math.random() * 200) : null,
            cellFocus: user.active ? { row: Math.floor(Math.random() * 5), col: Math.floor(Math.random() * 5) } : null
          }
        }
      });
    } else if (rand < 0.6) {
      const activeUsers = simUsers.filter(u => u.active);
      if (activeUsers.length > 0) {
        const user = activeUsers[Math.floor(Math.random() * activeUsers.length)];
        broadcast({
          type: 'SIM_CURSOR',
          payload: {
            id: user.id,
            cursor: Math.floor(Math.random() * (db.scratchpad?.length || 100)),
            cellFocus: { row: Math.floor(Math.random() * (db.collabTable?.rows?.length || 5)), col: Math.floor(Math.random() * 5) }
          }
        });
      }
    } else if (rand < 0.8) {
      const activeUsers = simUsers.filter(u => u.active);
      if (activeUsers.length > 0) {
        const user = activeUsers[Math.floor(Math.random() * activeUsers.length)];
        const comments = [
          "\n- [ ] " + user.name + ": Remember to double check safety codes.",
          "\n- [ ] " + user.name + ": Verify speaker schedule list.",
          "\n- [ ] " + user.name + ": Budget check looks solid.",
          "\n*Notes update:* BBQ trailer is booked!"
        ];
        const comment = comments[Math.floor(Math.random() * comments.length)];
        db.scratchpad = (db.scratchpad || '') + comment;
        saveDb(db);
        
        broadcast({
          type: 'TEXT_EDIT',
          payload: {
            text: db.scratchpad,
            userId: user.id
          }
        });
      }
    }
  }, 12000);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Ministry Dashboard] Backend running on http://localhost:${PORT}`);
  });
}

startServer();
