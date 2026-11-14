import { validateArchive } from "../persistence/domain";
import {newBlueprint} from "../game/studioOps";
import { presetFalconLike } from "../sim/presets";
import { DEFAULT_PROFILE } from "../sim/guidance";
import { localData } from "../persistence/localData";
import { OfflinePlay } from "../components/app/OfflinePlay";
import { useRef, useState } from "react";
import { Rocket, FlaskConical, Compass, Play, FolderOpen, Upload, Trash2, History, ArrowRight, CheckCircle2 } from "lucide-react";
import { CheckpointList } from "../components/game/FlightPanels";
import { toast } from "sonner";
import { useGame } from "../game/GameContext";
import { DIFFICULTIES } from "../sim/missions";
import { startTutorial, TUTORIALS } from "../components/game/Tutorial";
import { storage, readJSONFile, isValidDesign } from "../sim/storage";
import { DisplayButton } from "../components/app/Appearance";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
export default function MainMenu() {
  const g = useGame();
  let recovery = null;
  try {
    const candidate = JSON.parse(localData.getItem('mf.recovery-flight'));
    if (candidate?.state) {
      validateArchive([['mf.recovery-flight', JSON.stringify(candidate)]]);
      recovery = candidate;
    }
  } catch {}
  const fileRef = useRef(null);
  const [dlg, setDlg] = useState(null);
  const [designs, setDesigns] = useState(storage.designs());
  const [cks, setCks] = useState(storage.checkpoints());
  const resume = ck => {
    g.loadDesign(ck.design);
    g.setMissionId(ck.missionId);
    g.setDifficulty(ck.difficulty);
    g.setProfile(ck.profile);
    g.setPendingCheckpoint(ck);
    g.go("flight");
  };
  const onImport = async e => {
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
  return <div className="home-screen" data-testid="home-screen">
      <header className="home-header">
        <div className="home-brand"><span className="brand-symbol"><Rocket size={20}/></span>MissionForge</div>
        <div className="home-header-actions"><button className="ui-button" data-testid="palette-open" onClick={()=>g.setOverlayOpen(true)}>Search</button><DisplayButton/></div>
      </header>
      <main className="home-content">
        <section className="home-launchpad">
          <div className="home-welcome">
            <span className="section-kicker">BUILD · FLY · DISCOVER</span>
            <h1 data-testid="main-title">Your next<br/><span>great launch.</span></h1>
            <p>A rocket, a destination, and a whole solar system to explore.</p>
            <div className="home-play-buttons">
              <button className="home-play-primary" data-testid="menu-new-mission-btn" onClick={()=>g.go('planner')}><Rocket size={21}/>Fly a mission<ArrowRight size={18}/></button>
              <button data-testid="menu-create-rocket" onClick={()=>{g.setLearningPrediction(null);localData.removeItem('mf.academy-flight');g.setPendingCheckpoint(null);g.loadDesign(newBlueprint());g.setMissionId('first_orbit');g.setProfile({...DEFAULT_PROFILE,targetAltitude:200000,targetInclination:28.6});g.go('hangar');}}><Rocket size={21}/>Build a new rocket<small>Blank blueprint</small></button>
              <button data-testid="menu-explore-btn" onClick={()=>g.go('explore')}><Compass size={21}/>Explore solar system<ArrowRight size={18}/></button>


            </div>
            {recovery&&<button className="ui-button" data-testid="resume-recovery" onClick={()=>resume(recovery)}>Recover paused flight</button>}
          </div>
          <div className="home-orbital-art" aria-hidden="true"><div className="home-orbit-line"/><div className="home-earth" style={{backgroundImage:"url(/textures/earth_atmos_2048.jpg)"}}/><span className="home-orbit-dot"/></div>
        </section>
        <div className="home-resume-row">          <button data-testid="menu-continue-btn" disabled={!g.hasAutosave} onClick={() => g.go("hangar")}>
            <Play size={19} />
            <span>
              <strong>Continue building</strong>
              <small>
                {g.hasAutosave ? g.design.name : "Your next rocket will appear here"}
              </small>
            </span>
            <ArrowRight size={15} />
          </button>              <button data-testid="menu-resume-flight-btn" disabled={!cks.length} onClick={()=>{setCks(storage.checkpoints());setDlg('resume');}}><History size={19}/>Resume flight<small>{cks.length?`${cks.length} checkpoints`:'No saved flight'}</small></button></div>
        <section className="home-discover" aria-label="Learn and experiment" data-testid="first-time-experience">
          <div className="home-learning-start"><h2>Make every flight a discovery.</h2>              <button data-testid="quick-first-orbit" onClick={() => {
          g.setLearningPrediction(null);
          localData.removeItem('mf.academy-flight');
          g.loadDesign(presetFalconLike());
          g.setMissionId('first_orbit');
          g.setDifficulty('amateur');
          g.setProfile({
            ...DEFAULT_PROFILE,
            targetAltitude: 200000,
            targetInclination: 28.6
          });
          g.setPendingCheckpoint(null);
          g.go('flight');
        }}><Play size={19}/>Quick First Orbit<small>Ready to fly</small></button></div>
          <div className="home-feature-grid">
            <button data-testid="menu-mission-design" onClick={()=>g.go('missionDesign')}><Compass size={23}/><strong>Mission Design Studio</strong><small>Design, operate and return science · solo or local team</small></button>
            <button data-testid="menu-academy" onClick={()=>g.go('academy')}><Rocket size={23}/><strong>Flight Academy</strong><small>Your first orbit, step by step</small></button>
            <button data-testid="menu-data-explorer" onClick={()=>g.go('data')}><Compass size={23}/><strong>NASA Data Explorer</strong><small>The science behind your flight</small></button>
            <button data-testid="menu-sandbox-btn" onClick={()=>g.go('sandbox')}><FlaskConical size={23}/><strong>Sandbox Lab</strong><small>Experiment on your own terms</small></button>
            <button data-testid="menu-science-btn" onClick={()=>g.go('science')}><FlaskConical size={23}/><strong>Mission Lab</strong><small>Predict, fly, explain</small></button>
          </div>
        </section>
        <nav className="home-more-tools" aria-label="More ways to play">
          <button data-testid="menu-challenges-btn" onClick={()=>g.go('challenges')}>Challenges</button>
          <button data-testid="menu-logbook-btn" onClick={()=>g.go('logbook')}>Logbook</button>
          <button data-testid="menu-showcase-btn" onClick={()=>g.go('showcase')}>Guided showcase</button>
          <button data-testid="menu-model-comparison" onClick={()=>g.go('comparison')}>Compare physics</button>
          <button data-testid="menu-storage-btn" onClick={()=>g.go('storage')}>Data & recovery</button>
        </nav>
        <div className="home-utilities" aria-label="Your saved work">

          <button data-testid="menu-load-btn" onClick={() => {
          setDesigns(storage.designs());
          setDlg("load");
        }}>
            <FolderOpen size={19} />
            <span>
              <strong>Saved rockets</strong>
              <small>{designs.length} designs in this browser</small>
            </span>
            <ArrowRight size={15} />
          </button>
          <button data-testid="menu-import-btn" onClick={() => fileRef.current.click()}>
            <Upload size={19} />
            <span>
              <strong>Import a rocket</strong>
              <small>Open a design file</small>
            </span>
            <ArrowRight size={15} />
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onImport} data-testid="menu-import-input" />
        </div>
        <section className="home-bottom">
          <div className="home-difficulty">
            <div>
              <h2>Choose your pace</h2>
              <p>Same flight physics. Different budgets and assistance.</p>
            </div>
            <div className="difficulty-pills">
              {Object.values(DIFFICULTIES).map(d => <button key={d.id} aria-pressed={g.difficulty === d.id} data-testid={`difficulty-${d.id}-btn`} onClick={() => g.setDifficulty(d.id)}>
                  {g.difficulty === d.id && <CheckCircle2 size={14} />}
                  {d.label}
                </button>)}
            </div>
            <p className="difficulty-explanation" data-testid="difficulty-description">
              {DIFFICULTIES[g.difficulty].desc}
            </p>
          </div>
          <details className="home-tutorials">
            <summary>Need a hand? Try a short tutorial.</summary>
            <div data-testid="tutorial-list">
              {Object.entries(TUTORIALS).map(([id, t]) => <button key={id} data-testid={`tutorial-start-${id}`} onClick={() => startTutorial(id)}>
                  {t.title}
                  <ArrowRight size={13} />
                </button>)}
            </div>
          </details>
        </section>
      </main>
      <footer className="home-footer">
        <OfflinePlay />
        <span>Build. Fly. Understand.</span>
        <span>
          Your saves stay in this browser. Export them to keep a copy.
        </span>
        <button data-testid="menu-settings-btn" onClick={() => g.setSettingsOpen(true)}>
          Settings & controls
        </button>
      </footer>

      <Dialog open={dlg === "load"} onOpenChange={o => !o && setDlg(null)}>
        <DialogContent className="dark border-slate-800 bg-slate-950 text-slate-100" data-testid="load-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">Saved rockets</DialogTitle>
            <DialogDescription>
              Open a rocket to keep building, or remove an old design.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-1 overflow-y-auto scroll-thin">
            {designs.length === 0 && <div className="text-sm text-slate-500">
                No saved designs yet. Save one from the Hangar.
              </div>}
            {designs.map(d => <div key={d.name} className="flex items-center justify-between border border-slate-800 px-3 py-2">
                <button className="text-left" data-testid={`load-design-${d.name}`} onClick={() => {
              g.loadDesign(d);
              setDlg(null);
              g.go("hangar");
            }}>
                  <div className="text-sm">{d.name}</div>
                  <div className="font-mono text-[10px] text-slate-500">
                    {d.stack.length + (d.radials || []).reduce((a, r) => a + r.symmetry, 0)}{" "}
                    parts · {new Date(d.savedAt).toLocaleString()}
                  </div>
                </button>
                <button aria-label={`Delete ${d.name}`} data-testid={`delete-design-${d.name}`} onClick={() => {
              storage.deleteDesign(d.name);
              setDesigns(storage.designs());
            }} className="p-1 text-slate-500 hover:text-red-400">
                  <Trash2 size={14} />
                </button>
              </div>)}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dlg === "resume"} onOpenChange={o => !o && setDlg(null)}>
        <DialogContent className="dark max-w-xl border-slate-800 bg-slate-950 text-slate-100" data-testid="resume-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">Resume a flight</DialogTitle>
            <DialogDescription>
              Choose a checkpoint to pick up where you left off.
            </DialogDescription>
          </DialogHeader>
          <CheckpointList list={cks} onRestore={resume} onDelete={id => {
          storage.deleteCheckpoint(id);
          setCks(storage.checkpoints());
        }} />
        </DialogContent>
      </Dialog>
    </div>;
}
