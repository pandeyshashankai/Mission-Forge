import {newBlueprint,studioDrop,magnetMove,copySelection,deleteSelection,transformSelection} from "../game/studioOps";
import {BuildToExplore} from '../components/education/BuildToExplore';
import { Subassemblies } from "../components/game/Subassemblies";
import { DesignEngineering } from "../components/instruments/EngineeringInspector";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Menu,
  ArrowLeft,
  Undo2,
  Redo2,
  Save,
  Download,
  Upload,
  ClipboardCheck,
  Rocket,
  Copy,
  Trash2,
  Box,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { useGame } from "../game/GameContext";
import { MissionSteps } from "../components/app/MissionSteps";
import { DisplayButton } from "../components/app/Appearance";
import { Blueprint } from "../components/game/Blueprint";

import { HangarView } from "../three/HangarView";
import { PartCatalog } from "../components/game/PartCatalog";
import {
  StackList,
  StagingList,
  Inspector,
} from "../components/game/HangarPanels";
import { AdvisorPanel } from "../components/game/AdvisorPanel";
import { GoNoGo, Stat } from "../components/game/Status";
import {
  movePart,
  setSymmetry,
  findNode,
} from "../game/designOps";
import { runReadiness } from "../sim/readiness";
import { adviseDesign } from "../sim/advisor";
import { getMission } from "../sim/missions";
import { PARTS } from "../sim/parts";
import { PRESETS } from "../sim/presets";
import {
  storage,
  downloadJSON,
  readJSONFile,
  isValidDesign,
} from "../sim/storage";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";

const fmt = (x, d = 0) =>
  Number(x).toLocaleString("en-US", {
    maximumFractionDigits: d,
    minimumFractionDigits: d,
  });
const HdrBtn = ({ icon: Icon, label, onClick, testId, disabled }) => (
  <button
    data-testid={testId}
    disabled={disabled}
    onClick={onClick}
    title={label}
    className="flex items-center gap-1.5 border border-slate-800 px-2.5 py-1.5 text-xs text-slate-300 transition-colors hover:border-slate-600 hover:text-white disabled:opacity-30"
  >
    <Icon size={14} /> <span>{label}</span>
  </button>
);

export default function Hangar() {
  const g = useGame();
  const { design, setDesign } = g;
  const mission = getMission(g.missionId);
  const [toolsOpen,setToolsOpen]=useState(false);
  const [statsOpen,setStatsOpen]=useState(false);
  const [selected, setSelected] = useState(null);
  const [selection,setSelection]=useState([]);
  const [mirror,setMirror]=useState(false),[snap,setSnap]=useState(true),[areaMode,setAreaMode]=useState(false);
  const [propertiesOpen,setPropertiesOpen]=useState(false);
  const [rightTab, setRightTab] = useState("stack");
  const [heldPart,setHeldPart] = useState(null);
  const [cursor,setCursor] = useState(null);
  const pickup = useRef(null);
  const [viewCommand,setViewCommand] = useState({action:"fit",id:0});
  const [pan3D,setPan3D] = useState(false);
  const [symmetry, setSym] = useState(2);
  const [xray, setXray] = useState(false);
  const [overlays,setOverlays]=useState(false);
  const [smallPane, setSmallPane] = useState("build");
  const [workspace, setWorkspace] = useState("blueprint");
  const fileRef = useRef(null);

  const review = useMemo(
    () => runReadiness(design, mission, g.difficulty),
    [design, mission, g.difficulty],
  );
  const advice = useMemo(() => adviseDesign(design, review), [design, review]);
  const s = review.stats;

  const selectMany=ids=>{setSelection(ids);setSelected(ids[0]||null);};
  const selectPart = (uid,toggle=false) => {
    const next=toggle?(selection.includes(uid)?selection.filter(id=>id!==uid):[...selection,uid]):uid?[uid]:[];
    selectMany(next);if(uid)setRightTab('inspect');
  };
  const duplicateSelection=()=>{const r=copySelection(design,selection.length?selection:selected?[selected]:[]);setDesign(r.design);selectMany(r.ids);};
  const transform=kind=>setDesign(transformSelection(design,selection.length?selection:selected?[selected]:[],kind));
  const resetView=()=>setViewCommand(v=>({action:'fit',id:v.id+1}));
  const startNew=()=>{setDesign(newBlueprint());selectMany([]);setHeldPart(null);setToolsOpen(false);setWorkspace('blueprint');resetView();};

  const onAdd = (partId) => {
    setHeldPart(partId); setWorkspace('blueprint'); setSmallPane('build');
  };
  const onPlace = position => {
    if(!heldPart)return;
    const result=studioDrop(design,heldPart,position,mirror,symmetry,snap);
    if(result.error){toast.error(result.error);setHeldPart(null);setCursor(null);return;}
    setDesign(result.design);selectMany([result.uid||result.design.stack[0]?.uid].filter(Boolean));setHeldPart(null);setCursor(null);
  };
  const onMoveGroup=(ids,dx,dy)=>{setDesign(magnetMove(design,ids,dx,dy,snap));selectMany(ids);};
  useEffect(()=>{
    const move=e=>{if(heldPart&&pickup.current?.pointerId===e.pointerId&&Math.hypot(e.clientX-pickup.current.x,e.clientY-pickup.current.y)>=6)setCursor({x:e.clientX,y:e.clientY});};
    const up=e=>{
      const start=pickup.current;if(start&&start.pointerId!==e.pointerId)return;pickup.current=null;
      const clear=()=>{setHeldPart(null);setCursor(null);};
      if(!heldPart||!start||Math.hypot(e.clientX-start.x,e.clientY-start.y)<5){clear();return;}
      const grid=document.querySelector('[data-testid=assembly-placement-grid]');
      if(!grid||!document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-testid=assembly-placement-grid]')){clear();return;}const r=grid.getBoundingClientRect();
      if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom){clear();return;}
      const p=grid.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const world=p.matrixTransform(grid.getScreenCTM().inverse());onPlace({x:world.x,y:-world.y});
    };
    const cancel=e=>{if(e.key==='Escape'){setHeldPart(null);setCursor(null);pickup.current=null;}};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('keydown',cancel);
    return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('keydown',cancel);};
  });

  const onRemove = useCallback(uid=>{setDesign(d=>deleteSelection(d,selection.includes(uid)?selection:[uid]));setSelected(null);setSelection([]);},[setDesign,selection]);

  useEffect(() => {
    const onKey = (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? g.redo() : g.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        g.redo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "d" &&
        selected
      ) {
        e.preventDefault();
        duplicateSelection();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selected)
        onRemove(selected);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onImport = async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      const d = await readJSONFile(f);
      if (!isValidDesign(d) || d.stack.some((n) => !PARTS[n.partId]))
        throw new Error();
      g.loadDesign(d);selectMany([]);resetView();
      toast.success(`Imported "${d.name}"`);
    } catch {
      toast.error("Not a valid MissionForge design file.");
    }
  };

  const selNode = selected ? findNode(design, selected) : null;

  return (
    <div
      className="builder-screen studio-builder flex h-full w-full flex-col"
      data-builder-tools={toolsOpen?"open":"closed"}
      data-builder-pane={smallPane}
      data-properties={propertiesOpen?"open":"closed"}
    >
          <button
            data-testid="open-readiness-btn"
            onClick={() => g.go("review")}
            className="ui-button studio-launch"
            disabled={!design.stack.length}
          >
            <ClipboardCheck size={15} /> Launch
          </button>
      <div className="workflow-header">
        <button
          className="ui-button ui-button-quiet"
          data-testid="hangar-mission-back"
          onClick={() => g.go("planner")}
        >
          <ArrowLeft size={16} /> Missions
        </button>
        <MissionSteps current={1} />

      </div>
      <header className="builder-toolbar">
        <button className="ui-button builder-tools-toggle" data-testid="builder-tools-toggle" aria-label="Builder tools and saves" aria-expanded={toolsOpen} onClick={()=>setToolsOpen(v=>!v)}><Menu size={20}/><span>Tools</span></button>
        <button
          data-testid="hangar-back-btn"
          onClick={() => g.go("planner")}
          className="mr-2 flex items-center gap-1 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft size={16} />
          <span>Back to missions</span>
        </button>
        <label className="builder-name-label" htmlFor="rocket-name">
          Your rocket
        </label>
        <input
          id="rocket-name"
          aria-label="Rocket name"
          data-testid="design-name-input"
          value={design.name}
          onChange={(e) =>
            setDesign({ ...design, name: e.target.value }, false)
          }
          className="builder-name border border-slate-800 bg-slate-950 px-2 py-1 font-mono text-xs outline-none focus:border-cyan-500/60"
        />
        <p className="studio-help">Drag parts onto the grid. Drag empty space to pan; pinch or Ctrl + scroll to zoom. Use the rectangle tool to select a group, then copy, move, rotate or delete it. Mirror adds balanced side pairs.</p>
        <div className="builder-actions"><DisplayButton compact />
          <button className="ui-button" data-testid="new-blueprint" onClick={startNew}>New blank rocket</button>
          <HdrBtn
            icon={Undo2}
            label="Undo"
            testId="undo-btn"
            disabled={!g.canUndo}
            onClick={g.undo}
          />
          <HdrBtn
            icon={Redo2}
            label="Redo"
            testId="redo-btn"
            disabled={!g.canRedo}
            onClick={g.redo}
          />
          <select
            aria-label="Load a rocket preset"
            data-testid="preset-select"
            value=""
            onChange={(e) => {
              const p = PRESETS.find((x) => x.id === e.target.value);
              if (p) {
                setDesign(p.make());
                selectMany([]);resetView();
              }
            }}
            className="builder-presets border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-slate-300"
          >
            <option value="">Load preset…</option>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <HdrBtn
            icon={Save}
            label="Save"
            testId="save-design-btn"
            onClick={() => {
              storage.saveDesign(design);
              toast.success(`Saved "${design.name}" to this browser`);
            }}
          />
          <HdrBtn
            icon={Download}
            label="Export"
            testId="export-design-btn"
            onClick={() =>
              downloadJSON(
                `${design.name.replace(/\W+/g, "_")}.mfdesign.json`,
                design,
              )
            }
          />
          <HdrBtn
            icon={Upload}
            label="Import"
            testId="import-design-btn"
            onClick={() => fileRef.current.click()}
          />
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={onImport}
            data-testid="hangar-import-input"
          />

        </div>
      </header>

      <nav className="builder-mobile-tabs" aria-label="Builder panels">
        {[
          ["parts", Box, "Parts"],
          ["build", Rocket, "Rocket"],
          ["details", SlidersHorizontal, "Details"],
        ].map(([id, Icon, label]) => (
          <button
            key={id}
            data-testid={`builder-panel-${id}`}
            onClick={() => setSmallPane(p=>p===id&&id!=="build"?"build":id)}
            aria-pressed={smallPane === id}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>
      <div className="assembly-workspace grid min-h-0 flex-1">
        <aside className="assembly-catalog min-h-0 border-r border-slate-800 bg-slate-950/80">
          <PartCatalog onCancelPickup={e=>{if(pickup.current&&pickup.current.pointerId!==e.pointerId)return;pickup.current=null;setHeldPart(null);setCursor(null);}} compact={smallPane!=="parts"} onPickup={(partId,e)=>{if(e.button>0||pickup.current)return;e.currentTarget.setPointerCapture(e.pointerId);pickup.current={x:e.clientX,y:e.clientY,pointerId:e.pointerId};setCursor(null);onAdd(partId);}} />
        </aside>

        <main className="assembly-viewport relative min-h-0">
          {workspace === "blueprint" ? (
            <Blueprint
              design={design}
              selectedUid={selected}
              onSelect={selectPart}
              selectedUids={selection} onSelectMany={selectMany}
              heldPart={heldPart} cursor={cursor} mirror={mirror} snap={snap} areaMode={areaMode} onAreaDone={()=>setAreaMode(false)}
              onPlace={onPlace} onMoveGroup={onMoveGroup} viewCommand={viewCommand}
            />
          ) : (
            <HangarView
              design={design}
              selectedUid={selected}
              onSelect={selectPart}
              xray={xray}
              overlays={overlays}
              quality={g.settings.graphics}
              panMode={pan3D} viewCommand={viewCommand}
            />
          )}
          <details className="studio-view-menu assembly-view-options" data-testid="attach-toolbar" onClick={e=>{if(e.target.closest("button"))e.currentTarget.open=false;}}><summary aria-label="View and building options"><Menu size={22}/></summary><div>
            <button className="ui-button" data-testid="workspace-blueprint" onClick={()=>setWorkspace('blueprint')}>Build grid</button>
            <button className="ui-button" data-testid="workspace-3d" onClick={()=>setWorkspace('3d')}>3D preview</button>
            <button className="ui-button" data-testid="xray-toggle" aria-pressed={xray} onClick={()=>setXray(v=>!v)}>{xray?'Hide':'Show'} fairing interior</button>
            <button className="ui-button mass-overlay-toggle" data-testid="mass-overlay-toggle" aria-pressed={overlays} onClick={()=>{setOverlays(!overlays);setWorkspace("3d");}}>Mass & thrust</button>
            <span>Solid booster copies</span>{[2,3,4].map(n=><button key={n} className="ui-button" data-testid={`symmetry-${n}`} aria-pressed={symmetry===n} onClick={()=>setSym(n)}>×{n}</button>)}
            <button className="ui-button" onClick={()=>setSmallPane('details')}>Staging, parts & science</button>
          </div></details>
          {workspace==='3d'&&<div className="assembly-navigation assembly-navigation-3d"><button className="ui-button" data-testid="hangar-pan" aria-pressed={pan3D} onClick={()=>setPan3D(v=>!v)}>{pan3D?'Pan':'Rotate'}</button></div>}
          {heldPart&&<div className="held-part-banner" data-testid="held-part" style={{visibility:cursor?"visible":"hidden"}} aria-hidden={!cursor}><strong>{PARTS[heldPart].name}</strong><span>Release on the grid to place</span><button className="ui-button" data-testid="cancel-held-part" onClick={()=>{setHeldPart(null);setCursor(null);}}>Cancel</button></div>}

          <div className="pointer-events-none absolute right-3 top-28 text-right font-mono text-[10px] text-slate-500">
            Pick a part, then drag it onto the grid. Drag placed parts to move.
            <br />
            Ctrl+Z / Ctrl+Y · Ctrl+D duplicates · Del removes
          </div>
          {selNode && (
            <div className="selected-part-actions panel">
              <span>{PARTS[selNode.partId].name}</span>
              <button className="ui-button" data-testid="inspect-selection" aria-label="Part properties" onClick={()=>{setPropertiesOpen(v=>!v);setRightTab('inspect');setSmallPane(v=>v==='details'?'build':'details');}}><SlidersHorizontal size={20}/></button>
              <button className="ui-button" data-testid="duplicate-selected-btn" aria-label="Copy selected assembly" onClick={duplicateSelection}><Copy size={20}/></button>
              <button className="ui-button" data-testid="rotate-selected" aria-label="Rotate selection 90 degrees" onClick={()=>transform('rotate')}>↻</button>
              <button className="ui-button" data-testid="mirror-selected" aria-label="Flip selection horizontally" onClick={()=>transform('horizontal')}>◀▶</button>
              <button className="ui-button" data-testid="flip-selected" aria-label="Flip selection vertically" onClick={()=>transform('vertical')}>↕</button>
              <button className="ui-button" data-testid="remove-selected-btn" aria-label="Delete selected assembly" onClick={()=>onRemove(selected)}><Trash2 size={20}/></button>
            </div>
          )}
          <div className="studio-left-tools">
            <button className="ui-button" data-testid="studio-symmetry" aria-label="Mirror new side parts" aria-pressed={mirror} onClick={()=>setMirror(v=>!v)}>{mirror?'1 | 2':'1'}</button>
            <button className="ui-button" data-testid="studio-select-area" aria-label="Select multiple parts with a rectangle" aria-pressed={areaMode} onClick={()=>setAreaMode(v=>!v)}>▢</button>
            <button className="ui-button" data-testid="studio-snap" aria-label="Snap to grid and connections" aria-pressed={snap} onClick={()=>setSnap(v=>!v)}>⌁</button>
          </div>
          <div className="studio-view-controls">
            <button className="ui-button" data-testid="assembly-zoom-out" aria-label="Zoom out" onClick={()=>setViewCommand(v=>({action:'out',id:v.id+1}))}>−</button>
            <button className="ui-button" data-testid="assembly-fit" aria-label="Fit whole rocket" onClick={resetView}>Fit</button>
            <button className="ui-button" data-testid="assembly-zoom-in" aria-label="Zoom in" onClick={()=>setViewCommand(v=>({action:'in',id:v.id+1}))}>+</button>
          </div>
          <button className="ui-button studio-undo" data-testid="studio-undo" aria-label="Undo last edit" disabled={!g.canUndo} onClick={g.undo}>↶</button>
          {overlays&&workspace==='3d'&&<p className="mass-overlay-legend">Cyan: wet mass centre · Violet: dry mass centre · Amber: side-area centre (proxy) · Green: combined engine axis. Uniform part masses; all engine positions, not a flight-stage force solution.</p>}
          <div
            className="assembly-stats panel absolute bottom-3 left-3 right-3 grid grid-cols-3 xl:grid-cols-6 gap-2 rounded-sm p-2"
            data-expanded={statsOpen}
            data-testid="hangar-stats-bar"
          >
            <Stat
              label="Mass"
              value={fmt(s.mass / 1000, 1)}
              unit="t"
              testId="stat-mass"
              tone={s.mass > mission.massLimit ? "text-red-400" : undefined}
            />
            <Stat
              label="Cost"
              value={`$${fmt(s.cost, 1)}M`}
              unit={`/ $${review.budget}M`}
              testId="stat-cost"
              tone={s.cost > review.budget ? "text-red-400" : undefined}
            />
            <Stat
              label="Burn capacity (Δv)"
              value={fmt(s.dv.total)}
              unit="m/s"
              testId="stat-dv"
              tone={
                review.checks[0].status === "fail"
                  ? "text-red-400"
                  : review.checks[0].status === "warn"
                    ? "text-amber-400"
                    : "text-emerald-400"
              }
            />
            <Stat
              label="Mission needs"
              value={fmt(review.req.value * (1 + mission.reserve))}
              unit="m/s"
              testId="stat-dv-required"
            />
            <Stat
              label="Thrust / weight"
              value={fmt(s.liftoffTWR, 2)}
              testId="stat-twr"
              tone={
                s.liftoffTWR < 1
                  ? "text-red-400"
                  : s.liftoffTWR < 1.2
                    ? "text-amber-400"
                    : undefined
              }
            />
            <Stat
              label="Stages · parts"
              value={`${s.stageCount} · ${s.partCount}`}
              testId="stat-stages"
            />
            <Stat label="Thrust" value={fmt(s.liftoffThrustSL/1000)} unit="kN" testId="stat-thrust"/>
          </div>
          <button className="ui-button builder-stats-toggle" data-testid="builder-stats-toggle" aria-expanded={statsOpen} onClick={()=>setStatsOpen(v=>!v)}>{statsOpen?"Less stats":"More stats"}</button>
        </main>

        <aside className="assembly-details flex min-h-0 flex-col border-l border-slate-800 bg-slate-950/80">
          <Tabs
            value={rightTab}
            onValueChange={setRightTab}
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList className="m-2 grid grid-cols-3 rounded-sm bg-slate-900">
              <TabsTrigger
                value="stack"
                data-testid="tab-stack"
                className="text-xs"
              >
                Stack
              </TabsTrigger>
              <TabsTrigger
                value="staging"
                data-testid="tab-staging"
                className="text-xs"
              >
                Staging
              </TabsTrigger>
              <TabsTrigger
                value="inspect"
                data-testid="tab-inspector"
                className="text-xs"
              >
                Inspector
              </TabsTrigger>
            </TabsList>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 scroll-thin">
              <TabsContent value="stack">
                <StackList
                  design={design}
                  stats={s}
                  selectedUid={selected}
                  onSelect={selectPart}
                  onRemove={onRemove}
                  onMove={(uid, d) => setDesign(movePart(design, uid, d))}
                  onSymmetry={(uid, n) =>
                    setDesign(setSymmetry(design, uid, n))
                  }
                />
              </TabsContent>
              <TabsContent value="staging">
                <BuildToExplore/><DesignEngineering stats={s} />
                <StagingList
                  stats={s}
                  design={design}
                  onReorder={(ev) => setDesign({ ...design, events: ev })}
                />
              </TabsContent>
              <TabsContent value="inspect">
                <Inspector node={selNode} />
                {selNode&&PARTS[selNode.partId].landingLeg&&<label className="studio-leg-option">Deploy landing legs<input type="checkbox" data-testid="leg-deployed" checked={!!selNode.deployed} onChange={e=>{const value=e.target.checked,group=selNode.mirrorGroup;setDesign({...design,stack:design.stack.map(n=>selection.includes(n.uid)||(mirror&&group&&n.mirrorGroup===group)?{...n,deployed:value}:n)});}}/></label>}
                <p className="studio-model-note">Rotated engines change thrust direction. Keep ascent engines facing down and use balanced side assemblies.</p>
                <Subassemblies design={design} selectedUid={selected} onInsert={setDesign} />
                {selNode && (
                  <div className="inspector-part-actions">
                    <button
                      className="ui-button"
                      data-testid="duplicate-inspected-btn"
                      onClick={() => {
                        duplicateSelection();
                      }}
                    >
                      <Copy size={14} /> Duplicate
                    </button>
                    <button
                      className="ui-button"

                      data-testid="remove-inspected-btn"
                      onClick={() => onRemove(selected)}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
          <div className="max-h-[42%] shrink-0 overflow-y-auto border-t border-slate-800 p-3 scroll-thin">
            <div className="mb-2 flex items-center justify-between">
              <GoNoGo overall={review.overall} testId="hangar-go-nogo" />
              <button
                data-testid="hangar-launch-btn"
                onClick={() => g.go("review")}
                className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-cyan-400 hover:text-cyan-200"
              >
                <Rocket size={12} /> Review →
              </button>
            </div>
            <details className="builder-advice">
              <summary>Design suggestions ({advice.length})</summary>
              <AdvisorPanel items={advice} compact testId="hangar-advisor" />
            </details>
          </div>
        </aside>
      </div>
    </div>
  );
}
