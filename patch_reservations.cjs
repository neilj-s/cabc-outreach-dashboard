const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf8');
const search = `    db.reservations.splice(index, 1);
    saveDb(db);
    res.json({ success: true, message: 'Reservation removed' });
  });`;

const replacement = `    db.reservations.splice(index, 1);
    saveDb(db);
    res.json({ success: true, message: 'Reservation removed' });
  });

  app.patch('/api/reservations/:id', (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const { status } = req.body;

    if (!db.reservations) db.reservations = [];
    const index = db.reservations.findIndex((r: any) => r.id === id);
    if (index === -1) return res.status(404).json({ error: 'Reservation not found' });

    db.reservations[index].status = status;
    saveDb(db);
    res.json({ success: true, reservation: db.reservations[index] });
  });`;

fs.writeFileSync('server.ts', content.replace(search, replacement));
console.log('patched');
