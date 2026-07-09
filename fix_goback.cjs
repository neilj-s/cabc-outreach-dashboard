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

code = code.replace(/(const handleNavigateFolder.*?\n)/, '$1' + handleGoBackSnippet);

// We need to insert a button in the breadcrumbs div.
const buttonSnippet = `
                    <button
                      onClick={handleGoBack}
                      disabled={folderHistory.length === 0}
                      className={\`p-1 rounded flex items-center justify-center transition \${folderHistory.length === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 cursor-pointer'}\`}
                      title="Go back to parent folder"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    </button>
                    <div className="w-px h-3 bg-slate-200 mx-1"></div>
`;

code = code.replace(/<div className="flex flex-wrap items-center gap-1.5 text-\[10px\] bg-white border border-\[#e2dcd0\] rounded-xl px-3 py-2 font-medium text-slate-500 font-sans">/, 
  '<div className="flex flex-wrap items-center gap-1.5 text-[10px] bg-white border border-[#e2dcd0] rounded-xl px-3 py-2 font-medium text-slate-500 font-sans">\n' + buttonSnippet
);

fs.writeFileSync('src/components/PlanningCentre.tsx', code);
