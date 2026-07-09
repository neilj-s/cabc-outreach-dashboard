const fs = require('fs');
let code = fs.readFileSync('src/components/PlanningCentre.tsx', 'utf8');

const handleGoBackSnippet = `
  const handleGoBack = () => {
    if (folderHistory.length > 0) {
      const newHistory = [...folderHistory];
      newHistory.pop();
      setFolderHistory(newHistory);
      const parentFolderId = newHistory.length > 0 ? newHistory[newHistory.length - 1].id : null;
      setActiveFolderId(parentFolderId);
      fetchDriveFilesFromBackend(parentFolderId || undefined);
    }
  };
`;

const lines = code.split('\n');
const insertIndex = lines.findIndex(l => l.startsWith('  return ('));

lines.splice(insertIndex, 0, handleGoBackSnippet);

fs.writeFileSync('src/components/PlanningCentre.tsx', lines.join('\n'));
