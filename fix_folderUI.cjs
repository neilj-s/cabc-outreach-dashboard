const fs = require('fs');
let code = fs.readFileSync('src/components/PlanningCentre.tsx', 'utf8');

const folderUISnippet = `
            {selectedEventId && (
              <div className="bg-[#fcfaf7] border border-[#e2dcd0] rounded-xl p-3 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-2">
                <div className="space-y-0.5 flex-1">
                  <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><FolderOpen size={12} className="text-[#856637]" /> Target Drive Folder</h4>
                  <p className="text-[10px] text-slate-500">Google Drive Folder ID where new docs for this event will be saved.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    value={eventFolderInput}
                    onChange={(e) => setEventFolderInput(e.target.value)}
                    placeholder="Folder ID or URL..."
                    className="flex-1 px-3 py-1.5 border border-[#e2dcd0] rounded-xl bg-white focus:outline-none focus:border-[#c2aa80] text-xs"
                  />
                  <button
                    onClick={async () => {
                      if (!onUpdateEvent) return;
                      
                      let cleanId = eventFolderInput;
                      if (cleanId.includes('/folders/')) {
                        cleanId = cleanId.split('/folders/')[1].split('?')[0].split('/')[0];
                      }
                      
                      setEventFolderInput(cleanId);
                      await onUpdateEvent(selectedEventId, { driveFolderId: cleanId });
                      showNotification('Event Drive folder updated successfully!', 'success');
                    }}
                    className="px-3 py-1.5 bg-[#856637] hover:bg-[#72572e] text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
`;

code = code.replace(/(\s*<\/div>\n\s*\{!selectedEventId && \(\n\s*<div className="text-center)/, folderUISnippet + '$1');

fs.writeFileSync('src/components/PlanningCentre.tsx', code);
