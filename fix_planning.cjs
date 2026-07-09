const fs = require('fs');
let code = fs.readFileSync('src/components/PlanningCentre.tsx', 'utf8');

// The file still has idea handlers that reference the variables I removed.
// I'll just use regex to remove those handlers entirely.
code = code.replace(/const handleUpvoteIdea = async[\s\S]*?showNotification\("Failed to upvote idea\.", 'error'\);\n\s*\}\n\s*\};\n/g, '');
code = code.replace(/const handleCreateIdea = async[\s\S]*?showNotification\("Failed to log idea\.", 'error'\);\n\s*\}\n\s*\};\n/g, '');
code = code.replace(/const handleDeleteIdea = async[\s\S]*?showNotification\("Failed to delete idea\.", 'error'\);\n\s*\}\n\s*\};\n/g, '');
code = code.replace(/const handleConvertIdea = async[\s\S]*?showNotification\("Failed to convert idea\.", 'error'\);\n\s*\};\n\s*\};\n/g, '');
code = code.replace(/const openConversionWizard = \(idea: Idea\) => \{[\s\S]*?\}\n/g, '');
code = code.replace(/const filteredIdeas = [\s\S]*?return categoryMatch && statusMatch;\n\s*\};\n\s*\};\n/g, '');
code = code.replace(/const handleSaveScratchpad = async[\s\S]*?\}\n\s*\};\n/g, '');
code = code.replace(/const insertMarkdown = \(prefix: string\) => \{[\s\S]*?\}\n\s*\};\n/g, '');
code = code.replace(/const \[ideasRes, scratchpadRes, docsRes\] = await Promise\.all\(\[[\s\S]*?\]\);/g, 'const [docsRes] = await Promise.all([fetch(\'/api/planning/docs\').then(r => r.json())]);');

fs.writeFileSync('src/components/PlanningCentre.tsx', code);
