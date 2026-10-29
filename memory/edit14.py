def edit(p, pairs):
    s=open(p).read()
    for a,b in pairs:
        assert a in s, (p, a[:70])
        s=s.replace(a,b)
    open(p,'w').write(s)
F='/app/frontend/src/'
edit(F+'pages/MissionPlanner.jsx',[
('''import { MISSIONS, getMission, missionBudget, requiredDeltaV, DIFFICULTIES } from "../sim/missions";''','''import { allMissions, getMission, missionBudget, requiredDeltaV, DIFFICULTIES, deleteCustomMission } from "../sim/missions";
import { MarsWindow, MissionCreator } from "../components/game/PlannerExtras";'''),
('''  const [sel, setSel] = useState(g.missionId);
  const m = getMission(sel);''','''  const [sel, setSel] = useState(g.missionId);
  const [creating, setCreating] = useState(false);
  const [, bump] = useState(0);
  const m = getMission(sel) || getMission("first_orbit");'''),
('''          {MISSIONS.map((x, i) => (''','''          {allMissions().map((x, i) => ('''),
('''              <div className="mt-1 text-[11px] italic text-slate-600">{x.inspiredBy}</div>
            </button>
          ))}
          <div className="border border-dashed border-slate-800 p-4 text-xs text-slate-500" data-testid="custom-mission-locked">
            <div className="flex items-center gap-2 font-display text-base uppercase tracking-wider text-slate-400"><Lock size={12} /> Custom Mission Creator</div>
            Pending — Milestone 6.
          </div>''','''              <div className="mt-1 text-[11px] italic text-slate-600">{x.inspiredBy}</div>
              {x.custom && <span role="button" data-testid={`mission-delete-${x.id}`} onClick={(e) => { e.stopPropagation(); deleteCustomMission(x.id); if (sel === x.id) setSel("first_orbit"); bump((n) => n + 1); }} className="absolute bottom-2 right-3 font-mono text-[10px] text-red-400 hover:text-red-300">delete</span>}
            </button>
          ))}
          <button data-testid="open-mission-creator-btn" onClick={() => setCreating(true)} className="w-full border border-dashed border-cyan-500/50 p-4 text-left text-xs text-cyan-300 hover:bg-cyan-500/5">
            <div className="font-display text-base uppercase tracking-wider">+ Custom Mission Creator</div>
            Define your own Earth-orbit target, site, payload and budget.
          </button>
          {creating && <MissionCreator onClose={() => setCreating(false)} onCreated={(x) => { setCreating(false); setSel(x.id); setPreset("orbiter9"); }} />}'''),
])
s=open(F+'pages/MissionPlanner.jsx').read()
a='''          <div className="mt-6 grid grid-cols-1 gap-x-10 xl:grid-cols-2">'''
assert a in s
s=s.replace(a,'''          {m.kind === "mars" && <MarsWindow profile={g.profile} setProfile={g.setProfile} />}
'''+a,1)
open(F+'pages/MissionPlanner.jsx','w').write(s)
edit(F+'pages/MainMenu.jsx',[('''{["low", "medium", "high"].map((q) => (''','''{["auto", "low", "medium", "high"].map((q) => (''')])
print("ok")
