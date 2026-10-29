def edit(p, pairs):
    s=open(p).read()
    for a,b in pairs:
        assert a in s, (p, a[:70])
        s=s.replace(a,b)
    open(p,'w').write(s)
F='/app/frontend/src/'
edit(F+'components/game/CrewPanel.jsx', [('''<span className="text-slate-500">Load now / peak</span><span className="text-right text-sky-300" data-testid="entry-g">{fmt(e.g, 1)} / {fmt(e.maxG, 1)} g</span>''','''<span className="text-slate-500">Load now / mission pk</span><span className="text-right text-sky-300" data-testid="entry-g">{fmt(e.g, 1)} / {fmt(e.maxG, 1)} g</span>
        <span className="text-slate-500">Entry peak</span><span className="text-right text-sky-300" data-testid="entry-g-peak">{e.ei ? `${fmt(e.maxGEntry || 0, 1)} g` : "—"}</span>''')])
edit(F+'sim/entry.js', [('''  e.maxG = Math.max(e.maxG, sensedG);''','''  e.maxG = Math.max(e.maxG, sensedG);
  if (e.ei) e.maxGEntry = Math.max(e.maxGEntry || 0, sensedG);''')])
edit(F+'components/game/FlightHud.jsx', [('''    <Row label="Time to apo" value={mmss(s.tApo)} testId="telemetry-time-to-apo-value" />
    <Row label="Period" value={mmss(s.period)} testId="telemetry-period-value" />''','''    <Row label="Time to apo" value={s.status === "splashdown" || s.status === "crashed" ? "—" : mmss(s.tApo)} testId="telemetry-time-to-apo-value" />
    <Row label="Period" value={s.status === "splashdown" || s.status === "crashed" ? "—" : mmss(s.period)} testId="telemetry-period-value" />''')])
print("ok")
