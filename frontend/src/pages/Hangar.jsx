import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Undo2, Redo2, Save, Download, Upload, ClipboardCheck, Eye, EyeOff, Rocket } from "lucide-react";
import { toast } from "sonner";
import { useGame } from "../game/GameContext";
import { HangarView } from "../three/HangarView";
import { PartCatalog } from "../components/game/PartCatalog";
import { StackList, StagingList, Inspector } from "../components/game/HangarPanels";
import { AdvisorPanel } from "../components/game/AdvisorPanel";
import { GoNoGo, Stat } from "../components/game/Status";
import { addPart, removePart, movePart, setSymmetry, findNode } from "../game/designOps";
import { runReadiness } from "../sim/readiness";
import { adviseDesign } from "../sim/advisor";
import { getMission } from "../sim/missions";
import { PARTS } from "../sim/parts";
import { PRESETS } from "../sim/presets";
import { storage, downloadJSON, readJSONFile, isValidDesign } from "../sim/storage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

const fmt = (x, d = 0) => Number(x).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const HdrBtn = ({ icon: Icon, label, onClick, testId, disabled }) => (
  <button data-testid={testId} disabled={disabled} onClick={onClick} title={label} className="flex items-center gap-1.5 border border-slate-800 px-2.5 py-1.5 text-xs text-slate-300 transition-colors hover:border-slate-600 hover:text-white disabled:opacity-30">
    <Icon size={14} /> <span className="hidden xl:inline">{label}</span>
  </button>
);

export default function Hangar() {
  const g = useGame();
  const { design, setDesign } = g;
  const mission = getMission(g.missionId);
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState("below");
  const [symmetry, setSym] = useState(2);
  const [xray, setXray] = useState(false);
  const fileRef = useRef(null);

  const review = useMemo(() => runReadiness(design, mission, g.difficulty), [design, mission, g.difficulty]);
  const advice = useMemo(() => adviseDesign(design, review), [design, review]);
  const s = review.stats;

  const onAdd = (partId) => {
    const target = selected && design.stack.some((n) => n.uid === selected) ? selected : null;
    const res = addPart(design, partId, target, mode, symmetry);
    if (res.error) return toast.error(res.error);
    setDesign(res.design);
    if (!res.radial) setSelected(res.uid);
    toast.success(`${PARTS[partId].name} attached${res.radial ? ` ×${symmetry} radially` : ` ${mode} ${target ? "selection" : "stack"}`}`);
  };

  const onRemove = useCallback((uid) => {
    setDesign((d) => removePart(d, uid));
    setSelected(null);
  }, [setDesign]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? g.redo() : g.undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); g.redo(); }
      else if ((e.key === "Delete" || e.key === "Backspace") && selected) onRemove(selected);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [g, selected, onRemove]);

  const onImport = async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      const d = await readJSONFile(f);
      if (!isValidDesign(d) || d.stack.some((n) => !PARTS[n.partId])) throw new Error();
      g.loadDesign(d);
      toast.success(`Imported "${d.name}"`);
    } catch {
      toast.error("Not a valid MissionForge design file.");
    }
  };

  const selNode = selected ? findNode(design, selected) : null;

  return (
    <div className="flex h-full w-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-800 bg-slate-950/90 px-4 backdrop-blur-md">
        <button data-testid="hangar-back-btn" onClick={() => g.go("planner")} className="mr-2 flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} /></button>
        <div className="eyebrow hidden md:block">Hangar · {mission.name}</div>
        <input data-testid="design-name-input" value={design.name} onChange={(e) => setDesign({ ...design, name: e.target.value }, false)} className="ml-3 w-56 border border-slate-800 bg-slate-950 px-2 py-1 font-mono text-xs outline-none focus:border-cyan-500/60" />
        <div className="ml-auto flex items-center gap-1.5">
          <HdrBtn icon={Undo2} label="Undo" testId="undo-btn" disabled={!g.canUndo} onClick={g.undo} />
          <HdrBtn icon={Redo2} label="Redo" testId="redo-btn" disabled={!g.canRedo} onClick={g.redo} />
          <select data-testid="preset-select" value="" onChange={(e) => { const p = PRESETS.find((x) => x.id === e.target.value); if (p) { setDesign(p.make()); setSelected(null); } }} className="border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-slate-300">
            <option value="">Load preset…</option>
            {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <HdrBtn icon={Save} label="Save" testId="save-design-btn" onClick={() => { storage.saveDesign(design); toast.success(`Saved "${design.name}" to this browser`); }} />
          <HdrBtn icon={Download} label="Export" testId="export-design-btn" onClick={() => downloadJSON(`${design.name.replace(/\W+/g, "_")}.mfdesign.json`, design)} />
          <HdrBtn icon={Upload} label="Import" testId="import-design-btn" onClick={() => fileRef.current.click()} />
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={onImport} data-testid="hangar-import-input" />
          <button data-testid="open-readiness-btn" onClick={() => g.go("review")} className="ml-2 flex items-center gap-2 border border-cyan-400 bg-cyan-500/15 px-3 py-1.5 font-display text-sm font-semibold uppercase tracking-widest text-cyan-200 hover:bg-cyan-500/25">
            <ClipboardCheck size={15} /> Readiness Review
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr_340px]">
        <aside className="min-h-0 border-r border-slate-800 bg-slate-950/80">
          <PartCatalog onAdd={onAdd} />
        </aside>

        <main className="relative min-h-0">
          <HangarView design={design} selectedUid={selected} onSelect={setSelected} xray={xray} quality={g.settings.graphics} />
          <div className="panel absolute left-3 top-3 flex items-center gap-1 rounded-sm p-1" data-testid="attach-toolbar">
            <span className="eyebrow px-2 !text-[9px]">Attach</span>
            {["above", "below"].map((m) => (
              <button key={m} data-testid={`attach-mode-${m}`} onClick={() => setMode(m)} className={`px-2 py-1 font-mono text-[11px] uppercase ${mode === m ? "bg-cyan-500/20 text-cyan-200" : "text-slate-400 hover:text-white"}`}>{m}</button>
            ))}
            <span className="mx-1 h-4 w-px bg-slate-700" />
            <span className="eyebrow px-1 !text-[9px]">Radial sym</span>
            {[2, 3, 4].map((n) => (
              <button key={n} data-testid={`symmetry-${n}`} onClick={() => setSym(n)} className={`px-2 py-1 font-mono text-[11px] ${symmetry === n ? "bg-cyan-500/20 text-cyan-200" : "text-slate-400 hover:text-white"}`}>×{n}</button>
            ))}
            <span className="mx-1 h-4 w-px bg-slate-700" />
            <button data-testid="xray-toggle" onClick={() => setXray(!xray)} className="flex items-center gap-1 px-2 py-1 font-mono text-[11px] text-slate-400 hover:text-white">{xray ? <EyeOff size={12} /> : <Eye size={12} />} fairing</button>
          </div>
          <div className="pointer-events-none absolute right-3 top-3 text-right font-mono text-[10px] text-slate-500">
            Click part to select · drag to orbit · scroll to zoom<br />Ctrl+Z / Ctrl+Y · Del removes
          </div>
          <div className="panel absolute bottom-3 left-3 right-3 grid grid-cols-6 gap-2 rounded-sm p-2" data-testid="hangar-stats-bar">
            <Stat label="Liftoff mass" value={fmt(s.mass / 1000, 1)} unit="t" testId="stat-mass" tone={s.mass > mission.massLimit ? "text-red-400" : undefined} />
            <Stat label="Cost" value={`$${fmt(s.cost, 1)}M`} unit={`/ $${review.budget}M`} testId="stat-cost" tone={s.cost > review.budget ? "text-red-400" : undefined} />
            <Stat label="Δv available" value={fmt(s.dv.total)} unit="m/s" testId="stat-dv" tone={review.checks[0].status === "fail" ? "text-red-400" : review.checks[0].status === "warn" ? "text-amber-400" : "text-emerald-400"} />
            <Stat label="Δv required" value={fmt(review.req.value * (1 + mission.reserve))} unit="m/s" testId="stat-dv-required" />
            <Stat label="Liftoff TWR" value={fmt(s.liftoffTWR, 2)} testId="stat-twr" tone={s.liftoffTWR < 1 ? "text-red-400" : s.liftoffTWR < 1.2 ? "text-amber-400" : undefined} />
            <Stat label="Stages · parts" value={`${s.stageCount} · ${s.partCount}`} testId="stat-stages" />
          </div>
        </main>

        <aside className="flex min-h-0 flex-col border-l border-slate-800 bg-slate-950/80">
          <Tabs defaultValue="stack" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="m-2 grid grid-cols-3 rounded-sm bg-slate-900">
              <TabsTrigger value="stack" data-testid="tab-stack" className="text-xs">Stack</TabsTrigger>
              <TabsTrigger value="staging" data-testid="tab-staging" className="text-xs">Staging</TabsTrigger>
              <TabsTrigger value="inspect" data-testid="tab-inspector" className="text-xs">Inspector</TabsTrigger>
            </TabsList>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 scroll-thin">
              <TabsContent value="stack">
                <StackList design={design} stats={s} selectedUid={selected} onSelect={setSelected} onRemove={onRemove}
                  onMove={(uid, d) => setDesign(movePart(design, uid, d))} onSymmetry={(uid, n) => setDesign(setSymmetry(design, uid, n))} />
              </TabsContent>
              <TabsContent value="staging">
                <StagingList stats={s} design={design} onReorder={(ev) => setDesign({ ...design, events: ev })} />
              </TabsContent>
              <TabsContent value="inspect"><Inspector node={selNode} /></TabsContent>
            </div>
          </Tabs>
          <div className="max-h-[42%] shrink-0 overflow-y-auto border-t border-slate-800 p-3 scroll-thin">
            <div className="mb-2 flex items-center justify-between">
              <GoNoGo overall={review.overall} testId="hangar-go-nogo" />
              <button data-testid="hangar-launch-btn" onClick={() => g.go("review")} className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-cyan-400 hover:text-cyan-200"><Rocket size={12} /> Review →</button>
            </div>
            <AdvisorPanel items={advice} compact testId="hangar-advisor" />
          </div>
        </aside>
      </div>
    </div>
  );
}
