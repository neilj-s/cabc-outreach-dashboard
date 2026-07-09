const fs = require('fs');
let code = fs.readFileSync('src/components/PlanningCentre.tsx', 'utf8');

// The file is huge, let's use sed-like replacements or just regex to remove chunks.
code = code.replace(/const \[ideas, setIdeas\] = useState<Idea\[\]>\(\[\]\);/g, '');
code = code.replace(/const \[scratchpadText, setScratchpadText\] = useState<string>\(''\);/g, '');
code = code.replace(/const \[savingScratchpad, setSavingScratchpad\] = useState<boolean>\(false\);/g, '');
code = code.replace(/const \[scratchpadSavedTime, setScratchpadSavedTime\] = useState<string \| null>\(null\);/g, '');

// Removing idea conversion states
code = code.replace(/const \[selectedIdeaForConversion, setSelectedIdeaForConversion\] = useState<Idea \| null>\(null\);/g, '');
code = code.replace(/const \[convEventName, setConvEventName\] = useState<string>\(''\);/g, '');
code = code.replace(/const \[convEventDesc, setConvEventDesc\] = useState<string>\(''\);/g, '');
code = code.replace(/const \[convEventDate, setConvEventDate\] = useState<string>\(''\);/g, '');
code = code.replace(/const \[convDocName, setConvDocName\] = useState<string>\(''\);/g, '');
code = code.replace(/const \[convCategory, setConvCategory\] = useState<'Spreadsheets\/Budgets' \| 'Meeting Minutes'>\('Spreadsheets\/Budgets'\);/g, '');
code = code.replace(/const \[convCreateEvent, setConvCreateEvent\] = useState<boolean>\(true\);/g, '');
code = code.replace(/const \[convTargetEventId, setConvTargetEventId\] = useState<string>\(''\);/g, '');
code = code.replace(/const \[newIdeaTitle, setNewIdeaTitle\] = useState<string>\(''\);/g, '');
code = code.replace(/const \[newIdeaContent, setNewIdeaContent\] = useState<string>\(''\);/g, '');
code = code.replace(/const \[newIdeaCategory, setNewIdeaCategory\] = useState<string>\('General'\);/g, '');
code = code.replace(/const \[categoryFilter, setCategoryFilter\] = useState<string>\('All'\);/g, '');
code = code.replace(/const \[statusFilter, setStatusFilter\] = useState<'All' \| 'Open' \| 'Converted'>\('All'\);/g, '');
code = code.replace(/const \[isIdeaFormOpen, setIsIdeaFormOpen\] = useState<boolean>\(false\);/g, '');

fs.writeFileSync('src/components/PlanningCentre.tsx', code);
console.log('patched PlanningCentre.tsx variables');
