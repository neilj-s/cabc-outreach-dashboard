const fs = require('fs');
let code = fs.readFileSync('src/components/PlanningCentre.tsx', 'utf8');

const missingVars = `
  const [ideas, setIdeas] = useState<any[]>([]);
  const [scratchpadText, setScratchpadText] = useState<string>('');
  const [savingScratchpad, setSavingScratchpad] = useState<boolean>(false);
  const [scratchpadSavedTime, setScratchpadSavedTime] = useState<string | null>(null);

  const [selectedIdeaForConversion, setSelectedIdeaForConversion] = useState<any | null>(null);
  const [convEventName, setConvEventName] = useState<string>('');
  const [convEventDesc, setConvEventDesc] = useState<string>('');
  const [convEventDate, setConvEventDate] = useState<string>('');
  const [convDocName, setConvDocName] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  
  const handleSaveScratchpad = () => {};
`;

// Insert them right after `export default function PlanningCentre`
code = code.replace(/export default function PlanningCentre[^\{]*\{\n/, match => match + missingVars);

fs.writeFileSync('src/components/PlanningCentre.tsx', code);
