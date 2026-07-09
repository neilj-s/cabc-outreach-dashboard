const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// replace events={events} with events={filteredEvents}
content = content.replace(/events=\{events\}/g, 'events={filteredEvents}');
fs.writeFileSync('src/App.tsx', content);
console.log('patched events');
