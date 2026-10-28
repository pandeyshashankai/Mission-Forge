import { useRef, useState } from "react";
import { Rocket, Play, FolderOpen, Upload, Settings, ListChecks, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useGame } from "../game/GameContext";
import { DIFFICULTIES } from "../sim/missions";
import { storage, readJSONFile, isValidDesign } from "../sim/storage";
import { STATUS } from "../sim/status";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";

const MenuButton = ({ icon: Icon, label, sub, onClick, testId, disabled, primary }) => (
  <button
    data-testid={testId}
    disabled={disabled}
    onClick={onClick}
    className={`group flex w-full items-center gap-4 border px-5 py-3.5 text-left transition-[background-color,border-color,transform] duration-200 hover:translate-x-1 disabled:pointer-events-none disabled:opacity-35 ${primary ? "border-cyan-500/50 bg-cyan-500/10 hover:bg-cyan-500/20" : "border-slate-800 bg-slate-950/60 hover:border-slate-600 hover:bg-slate-900/80"}`}
  >
    <Icon size={18} className={primary ? "text-cyan-300" : "text-slate-400 group-hover:text-slate-200"} />
    <div>
      <div className="font-display text-lg font-semibold uppercase tracking-wider">{label}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  </button>
);

const STATUS_TONE = { implemented: "text-cyan-300", tested: "text-emerald-400", partial: "text-amber-400", pending: "text-slate-500" };

export default function MainMenu() {
  const g = useGame();
  const fileRef = useRef(null);
  const [dlg, setDlg] = useState(null);
  const [designs, setDesigns] = useState(storage.designs());

  const onImport = async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      const d = await readJSONFile(f);
      if (!isValidDesign(d)) throw new Error("bad");
      g.loadDesign(d);
      storage.saveDesign(d);
      toast.success(`Imported design "${d.name}"`);
      g.go("hangar");
    } catch {
      toast.error("That file is not a valid MissionForge design.");
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden grid-bg grain">
      <div style={{ backgroundImage: "url(/textures/earth_atmos_2048.jpg)" }} className="earth-orb pointer-events-none absolute -right-[18vw] top-1/2 h-[78vw] max-h-[1100px] w-[78vw] max-w-[1100px] -translate-y-1/2 opacity-90" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#07090e] via-[#07090e]/85 to-transparent" />
      <div className="relative z-10 flex h-full flex-col justify-between px-10 py-10 lg:px-20">
        <div className="rise">
          <div className="eyebrow text-cyan-400">Space Mission Design &amp; Flight Simulator</div>
          <h1 className="mt-3 font-display text-5xl font-bold uppercase leading-none tracking-tight sm:text-6xl lg:text-7xl" data-testid="main-title">
            MissionForge<span className="text-cyan-400">·</span>2026
          </h1>
          <p className="mt-4 max-w-md text-sm text-slate-400">Plan a mission, assemble a rocket, prove it against real engineering limits, then fly it. Every outcome comes from the physics.</p>
        </div>

        <div className="grid max-w-5xl grid-cols-1 gap-10 lg:grid-cols-[360px_1fr]">
          <div className="space-y-2 rise" style={{ animationDelay: "120ms" }}>
            <MenuButton primary icon={Rocket} label="New Mission" sub="Choose a mission template" testId="menu-new-mission-btn" onClick={() => g.go("planner")} />
            <MenuButton icon={Play} label="Continue" sub={g.hasAutosave ? `Autosave · ${g.design.name}` : "No autosave yet"} testId="menu-continue-btn" disabled={!g.hasAutosave} onClick={() => g.go("hangar")} />
            <MenuButton icon={FolderOpen} label="Load Design" sub={`${designs.length} saved in this browser`} testId="menu-load-btn" onClick={() => { setDesigns(storage.designs()); setDlg("load"); }} />
            <MenuButton icon={Upload} label="Import Design" sub="From a .json file" testId="menu-import-btn" onClick={() => fileRef.current.click()} />
            <MenuButton icon={Settings} label="Settings" testId="menu-settings-btn" onClick={() => setDlg("settings")} />
            <MenuButton icon={ListChecks} label="Build Status" sub="Requirements: implemented / tested / pending" testId="menu-status-btn" onClick={() => setDlg("status")} />
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onImport} data-testid="menu-import-input" />
          </div>

          <div className="panel self-end rounded-sm p-5 rise" style={{ animationDelay: "220ms" }}>
            <div className="eyebrow mb-3">Difficulty — physics is identical in every mode</div>
            <div className="grid grid-cols-3 gap-2">
              {Object.values(DIFFICULTIES).map((d) => (
                <button key={d.id} data-testid={`difficulty-${d.id}-btn`} onClick={() => g.setDifficulty(d.id)} className={`border px-3 py-2 text-left transition-colors ${g.difficulty === d.id ? "border-cyan-400 bg-cyan-500/10" : "border-slate-800 hover:border-slate-600"}`}>
                  <div className="font-display text-base font-semibold uppercase tracking-wider">{d.label}</div>
                  <div className="font-mono text-[10px] text-slate-500">budget ×{d.budgetMult}</div>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-400" data-testid="difficulty-description">{DIFFICULTIES[g.difficulty].desc}</p>
            <p className="mt-1 text-[11px] text-slate-600">Custom Difficulty arrives in Milestone 6.</p>
          </div>
        </div>

        <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-slate-600">
          <span>Phase 1 · Milestone 1 — First Orbit vertical slice</span>
          <span>Saves stay in this browser · export to keep them</span>
        </div>
      </div>

      <Dialog open={dlg === "load"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="dark border-slate-800 bg-slate-950 text-slate-100" data-testid="load-dialog">
          <DialogHeader><DialogTitle className="font-display uppercase tracking-wider">Saved designs</DialogTitle></DialogHeader>
          <div className="max-h-80 space-y-1 overflow-y-auto scroll-thin">
            {designs.length === 0 && <div className="text-sm text-slate-500">No saved designs yet. Save one from the Hangar.</div>}
            {designs.map((d) => (
              <div key={d.name} className="flex items-center justify-between border border-slate-800 px-3 py-2">
                <button className="text-left" data-testid={`load-design-${d.name}`} onClick={() => { g.loadDesign(d); setDlg(null); g.go("hangar"); }}>
                  <div className="text-sm">{d.name}</div>
                  <div className="font-mono text-[10px] text-slate-500">{d.stack.length + (d.radials || []).reduce((a, r) => a + r.symmetry, 0)} parts · {new Date(d.savedAt).toLocaleString()}</div>
                </button>
                <button data-testid={`delete-design-${d.name}`} onClick={() => { storage.deleteDesign(d.name); setDesigns(storage.designs()); }} className="p-1 text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dlg === "settings"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="dark border-slate-800 bg-slate-950 text-slate-100" data-testid="settings-dialog">
          <DialogHeader><DialogTitle className="font-display uppercase tracking-wider">Settings</DialogTitle></DialogHeader>
          <div className="eyebrow">Graphics preset</div>
          <div className="grid grid-cols-3 gap-2">
            {["low", "medium", "high"].map((q) => (
              <button key={q} data-testid={`graphics-${q}-btn`} onClick={() => g.setSettings({ ...g.settings, graphics: q })} className={`border px-3 py-2 font-mono text-xs uppercase ${g.settings.graphics === q ? "border-cyan-400 text-cyan-300" : "border-slate-800 text-slate-400"}`}>{q}</button>
            ))}
          </div>
          <p className="text-xs text-slate-500">Changes resolution, shadows and planet detail. Ultra preset and automatic quality scaling arrive in Milestone 6.</p>
        </DialogContent>
      </Dialog>

      <Dialog open={dlg === "status"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="dark max-w-3xl border-slate-800 bg-slate-950 text-slate-100" data-testid="status-dialog">
          <DialogHeader><DialogTitle className="font-display uppercase tracking-wider">Requirements status</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto scroll-thin">
            <table className="w-full text-xs">
              <tbody>
                {STATUS.map(([m, f, s], i) => (
                  <tr key={i} className="border-t border-slate-800">
                    <td className="py-1.5 pr-3 font-mono text-slate-500">{m}</td>
                    <td className="py-1.5 pr-3 text-slate-300">{f}</td>
                    <td className={`py-1.5 font-mono uppercase ${STATUS_TONE[s]}`}>{s}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
