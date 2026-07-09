const fs = require('fs');
let code = fs.readFileSync('src/components/PlanningCentre.tsx', 'utf8');

code = code.replace(/const \[selectedEventId, setSelectedEventId\] = useState<string>\(\(\) => events\[0\]\?\.id \|\| ''\);\n  const \[eventFolderInput, setEventFolderInput\] = useState<string>\(''\);/,
  'const [selectedEventId, setSelectedEventId] = useState<string>(() => events[0]?.id || \'\');\n  const [eventFolderInput, setEventFolderInput] = useState<string>(() => events[0]?.driveFolderId || \'\');');

fs.writeFileSync('src/components/PlanningCentre.tsx', code);
