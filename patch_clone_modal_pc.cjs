const fs = require('fs');
let code = fs.readFileSync('src/components/PlanningCentre.tsx', 'utf8');

const modalCode = `
      {/* Clone Event Modal */}
      <AnimatePresence>
        {cloneEventTargetId && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden"
            >
              <div className="bg-[#faf8f4] border-b border-[#efe0c2] px-5 py-4 flex justify-between items-center">
                <div>
                  <h3 className="font-serif font-bold text-slate-800 text-lg">Clone Event to New Year</h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5 font-bold">Rollover Setup</p>
                </div>
                <button 
                  onClick={() => { setCloneEventTargetId(null); setCloneEventNewDate(''); }}
                  className="text-slate-400 hover:text-slate-600 p-1 transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">New Event Date *</label>
                  <input
                    type="date"
                    required
                    value={cloneEventNewDate}
                    onChange={(e) => setCloneEventNewDate(e.target.value)}
                    className="w-full p-2 border border-[#e2dcd0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#856637] bg-white text-sm"
                  />
                  <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                    This will create a fresh copy of the event on this new date. Tasks and asset reservations will be copied but reset to pending/incomplete states.
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => { setCloneEventTargetId(null); setCloneEventNewDate(''); }}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!cloneEventNewDate || !onCloneEvent) return;
                      setIsCloning(true);
                      await onCloneEvent(cloneEventTargetId, cloneEventNewDate);
                      setIsCloning(false);
                      setCloneEventTargetId(null);
                      setCloneEventNewDate('');
                    }}
                    disabled={!cloneEventNewDate || isCloning}
                    className="px-4 py-2 bg-[#856637] hover:bg-[#6c532b] disabled:opacity-50 text-white font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1.5"
                  >
                    {isCloning ? <Loader2 className="animate-spin" size={14} /> : <Copy size={14} />}
                    {isCloning ? 'Cloning...' : 'Confirm Clone'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
`;

code = code.replace("      </AnimatePresence>\n    </div>\n  );\n}", "      </AnimatePresence>\n" + modalCode + "    </div>\n  );\n}");
fs.writeFileSync('src/components/PlanningCentre.tsx', code);
console.log('patched PlanningCentre modal');
