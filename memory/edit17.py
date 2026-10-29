def edit(p, pairs):
    s=open(p).read()
    for a,b in pairs:
        assert a in s, (p, a[:70])
        s=s.replace(a,b)
    open(p,'w').write(s)
F='/app/frontend/src/'
edit(F+'pages/Results.jsx',[
('''import { mmss } from "../components/game/FlightHud";''','''import { mmss } from "../components/game/FlightHud";
import { DesignCompare, ReentryReplay } from "../components/game/ResultsExtras";'''),
('''            <p className="mt-2 text-[10px] text-slate-600">Full side-by-side design comparison arrives in Milestone 6.</p>''','''            <div className="eyebrow mb-2 mt-4">Side-by-side design comparison</div>
            <DesignCompare current={r} attempts={attempts} />'''),
('''        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Chart data={data} k="alt"''','''        <ReentryReplay r={r} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Chart data={data} k="alt"'''),
])
edit(F+'sim/scoring.js',[('''    summary: { mass: stats.mass,''','''    entry: sim.entry.ei ? { ...sim.entry.ei, maxG: sim.entry.maxGEntry || sim.entry.maxG, maxFlux: sim.entry.maxFlux, heatLoad: sim.entry.heatLoad } : null,
    summary: { mass: stats.mass,''')])
edit(F+'sim/flight.js',[
('''    const interval = this.t < 1500 ? 1 : this.t < 86400 ? 30 : 600;''','''    const interval = this.t < 1500 || (this.entry.ei && nav.alt < 160000) ? 1 : this.t < 86400 ? 30 : 600;'''),
('''        mass: nav.mass / 1000,
      });''','''        mass: nav.mass / 1000,
        g: +this.entry.g.toFixed(2),
        flux: +(this.entry.flux / 1e6).toFixed(3),
      });'''),
])
edit(F+'pages/Flight.jsx',[
('''new FlightSim({ design: g.design, mission, profile: g.profile, guidanceOn: true });''','''new FlightSim({ design: g.design, mission, profile: g.profile, guidanceOn: true, difficulty: g.difficulty });'''),
('''new FlightSim({ design: g.design, mission, profile: g.profile, guidanceOn: on });''','''new FlightSim({ design: g.design, mission, profile: g.profile, guidanceOn: on, difficulty: g.difficulty });'''),
('''new FlightSim({ design: ck.design, mission, profile: ck.profile, guidanceOn: true });''','''new FlightSim({ design: ck.design, mission, profile: ck.profile, guidanceOn: true, difficulty: ck.difficulty });'''),
])
edit(F+'sim/missions.js',[
('''desc: "Larger budgets, good starting presets, full guidance and detailed explanations." },''','''desc: "Larger budgets, good starting presets, full guidance and detailed explanations. No random faults." },'''),
('''desc: "Standard budgets, fewer hints, guidance computer available." },''','''desc: "Standard budgets, fewer hints, guidance computer available. Occasional faults (0.15 per day after orbit)." },'''),
('''desc: "Tight budgets and minimal hints. Full engineering data." },''','''desc: "Tight budgets and minimal hints. Full engineering data. Frequent faults (0.4 per day after orbit)." },'''),
])
print("ok")
