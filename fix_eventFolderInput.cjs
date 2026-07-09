const fs = require('fs');
let code = fs.readFileSync('src/components/PlanningCentre.tsx', 'utf8');

code = code.replace(/(const \[selectedEventId, setSelectedEventId\] = useState<string>\(''\);)/, 
  '$1\n  const [eventFolderInput, setEventFolderInput] = useState<string>(\'\');');

code = code.replace(/setSelectedEventId\(events\[0\].id\);/, 
  'setSelectedEventId(events[0].id);\n      setEventFolderInput(events[0].driveFolderId || \'\');');

code = code.replace(/<select\n(.*?)onChange=\{\(e\) => setSelectedEventId\(e\.target\.value\)\}/s,
  '<select\n$1onChange={(e) => { setSelectedEventId(e.target.value); const evt = events.find(ev => ev.id === e.target.value); setEventFolderInput(evt?.driveFolderId || \'\'); }}');


fs.writeFileSync('src/components/PlanningCentre.tsx', code);
