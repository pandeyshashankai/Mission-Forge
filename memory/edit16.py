def edit(p, pairs):
    s=open(p).read()
    for a,b in pairs:
        assert a in s, (p, a[:70])
        s=s.replace(a,b)
    open(p,'w').write(s)
F='/app/frontend/src/'
edit(F+'App.js',[('''import Results from "./pages/Results";''','''import Results from "./pages/Results";
import { TutorialOverlay } from "./components/game/Tutorial";'''),('''      <Toaster theme="dark" position="bottom-right" />''','''      <TutorialOverlay />
      <Toaster theme="dark" position="bottom-right" />''')])
edit(F+'pages/MainMenu.jsx',[
('''import { DIFFICULTIES } from "../sim/missions";''','''import { DIFFICULTIES, setCustomDifficulty } from "../sim/missions";
import { startTutorial, TUTORIALS } from "../components/game/Tutorial";'''),
('''            <div className="grid grid-cols-3 gap-2">
              {Object.values(DIFFICULTIES)''','''            <div className="grid grid-cols-4 gap-2">
              {Object.values(DIFFICULTIES)'''),
('''            <p className="mt-1 text-[11px] text-slate-600">Custom Difficulty arrives in Milestone 6.</p>''','''            {g.difficulty === "custom" && (
              <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-[11px] text-slate-400" data-testid="custom-difficulty">
                <label>Budget ×{DIFFICULTIES.custom.budgetMult}<input data-testid="custom-budget-slider" type="range" min={0.5} max={2.5} step={0.1} value={DIFFICULTIES.custom.budgetMult} onChange={(e) => { setCustomDifficulty({ budgetMult: +e.target.value }); g.setDifficulty("custom"); setTick((n) => n + 1); }} className="w-full accent-cyan-500" /></label>
                <label>Faults {DIFFICULTIES.custom.faultRate}/day<input data-testid="custom-fault-slider" type="range" min={0} max={1} step={0.05} value={DIFFICULTIES.custom.faultRate} onChange={(e) => { setCustomDifficulty({ faultRate: +e.target.value }); setTick((n) => n + 1); }} className="w-full accent-cyan-500" /></label>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2" data-testid="tutorial-list">
              {Object.entries(TUTORIALS).map(([id, t]) => (
                <button key={id} data-testid={`tutorial-start-${id}`} onClick={() => startTutorial(id)} className="border border-amber-500/40 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-amber-200 hover:bg-amber-500/10">Tutorial: {t.title}</button>
              ))}
            </div>'''),
])
s=open(F+'pages/MainMenu.jsx').read()
i=s.index('export default function MainMenu() {')
j=s.index('\n',i)
s=s[:j+1]+'  const [, setTick] = useState(0);\n'+s[j+1:]
open(F+'pages/MainMenu.jsx','w').write(s)
print("ok")
