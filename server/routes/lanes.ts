import express from 'express';
import { getDb, saveDb } from '../storage';
import { MinistryEvent, Task, Asset, LaneDetail } from '../../src/types';

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  res.json(db.lanes || []);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, leadName } = req.body;
  if (!name || !leadName) {
    return res.status(400).json({ error: 'Lane Name and Lead Name are required.' });
  }

  const newLane = {
    id: `lane_${Date.now()}`,
    name: name.trim(),
    leadName: leadName.trim()
  };

  if (!db.lanes) db.lanes = [];
  db.lanes.push(newLane);
  saveDb(db);
  res.status(201).json(newLane);
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { name, leadName } = req.body;

  if (!db.lanes) db.lanes = [];
  const laneIndex = db.lanes.findIndex((l: LaneDetail) => l.id === id);
  if (laneIndex === -1) {
    return res.status(404).json({ error: 'Lane not found.' });
  }

  const oldName = db.lanes[laneIndex].name;
  const newName = name ? name.trim() : oldName;
  const newLeadName = leadName ? leadName.trim() : db.lanes[laneIndex].leadName;

  db.lanes[laneIndex].name = newName;
  db.lanes[laneIndex].leadName = newLeadName;

  // If lane name changed, update tasks and assets that reference the old lane name
  if (oldName !== newName) {
    db.events.forEach((evt: MinistryEvent) => {
      if (evt && Array.isArray(evt.tasks)) {
        evt.tasks.forEach((task: Task) => {
          if (task && task.lane === oldName) {
            task.lane = newName;
          }
        });
      }
    });

    db.assets.forEach((asset: Asset) => {
      if (asset && asset.category === oldName) {
        asset.category = newName;
      }
    });
  }

  saveDb(db);
  res.json(db.lanes[laneIndex]);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;

  if (!db.lanes) db.lanes = [];
  const lane = db.lanes.find((l: LaneDetail) => l.id === id);
  if (!lane) {
    return res.status(404).json({ error: 'Lane not found.' });
  }

  if (db.lanes.length <= 1) {
    return res.status(400).json({ error: 'Cannot delete the last remaining lane.' });
  }

  const remainingLanes = db.lanes.filter((l: LaneDetail) => l.id !== id);
  const fallbackLaneName = remainingLanes[0].name;

  db.events.forEach((evt: MinistryEvent) => {
    if (evt && Array.isArray(evt.tasks)) {
      evt.tasks.forEach((task: Task) => {
        if (task && task.lane === lane.name) {
          task.lane = fallbackLaneName;
        }
      });
    }
  });

  db.assets.forEach((asset: Asset) => {
    if (asset && asset.category === lane.name) {
      asset.category = fallbackLaneName;
    }
  });

  db.lanes = remainingLanes;
  saveDb(db);
  res.json({ success: true, message: `Lane deleted. Associated tasks/assets reassigned to "${fallbackLaneName}".` });
});

export default router;
