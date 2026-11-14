import { useEffect, useRef, useState } from 'react';
import { useGame } from '../game/GameContext';
import { downloadJSON } from '../sim/storage';
import { CATALOG, DEFAULT_DESIGN, ORBITS, TARGETS, ROLES, SOURCES, validateDesign, designStats, startMission, stepMission, runMission, missionReport, encodeDesign, decodeDesign } from '../features/missionDesign/model';
import { readLibrary, writeLibrary } from '../features/missionDesign/library';
import '../mission-design.css';
const number = n => n.toLocaleString(undefined, { maximumFractionDigits: 1 });
export default function MissionDesign() {
  const g = useGame(), [initial] = useState(readLibrary);
  const [design, setDesign] = useState(initial.draft), [saved, setSaved] = useState(initial.designs);
  const [state, setState] = useState(null), [playing, setPlaying] = useState(false), [error, setError] = useState('');
  const [message, setMessage] = useState(''), [players, setPlayers] = useState(1), [approved, setApproved] = useState([]);
  const [comparison, setComparison] = useState(null), [share, setShare] = useState(''), [pending, setPending] = useState(null);
  const file = useRef(null), stats = designStats({ ...design, name: design.name.trim() || 'Untitled mission' }), locked = !!state && !state.done;
  const report = state ? missionReport(design, state) : null;
  useEffect(() => {
    const readSharedMission = () => {
      if (!window.location.hash.startsWith('#mission=')) return;
      try { setPending(decodeDesign(window.location.hash.slice(9))); }
      catch (e) { setError('Cannot open shared mission: ' + e.message); }
    };
    readSharedMission();
    window.addEventListener('hashchange', readSharedMission);
    return () => window.removeEventListener('hashchange', readSharedMission);
  }, []);
  useEffect(() => {
    if (!playing || !state || state.done) return;
    const timer = setTimeout(() => setState(s => stepMission(design, s, 60)), 150);
    return () => clearTimeout(timer);
  }, [playing, state, design]);
  const change = patch => {
    setDesign(d => ({ ...d, ...patch })); setState(null); setPlaying(false); setApproved([]); setShare(''); setComparison(null); setMessage(''); setError('');
  };
  const apply = d => { change(validateDesign(d)); setPending(null); };
  const save = () => {
    try {
      const d = validateDesign(design), list = [d, ...saved.filter(s => s.name !== d.name)].slice(0, 20);
      writeLibrary({ version: 1, draft: d, designs: list }); setSaved(list); setMessage('Saved in this browser. Export a file for a portable backup.'); setError('');
    } catch (e) { setError(e.message); }
  };
  const importFile = async e => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try {
      if (f.size > 6000) throw Error('Design file exceeds 6 KB');
      setPending(validateDesign(JSON.parse(await f.text()))); setError('');
    } catch (e) { setError('Import rejected: ' + e.message); }
  };
  const launch = () => {
    try {
      if (players > 1 && approved.length !== players) throw Error('Each teammate must approve this design before launch.');
      setState(startMission(design)); setPlaying(true); setError('');
    } catch (e) { setError(e.message); }
  };
  const compare = d => {
    try { setComparison(missionReport(d, runMission(d))); setError(''); }
    catch (e) { setError('Comparison design cannot launch: ' + e.message); }
  };
  return <main className="mission-studio" data-testid="mission-design-studio">
    <header className="mission-studio-header"><button className="ui-button" onClick={() => g.go('menu')}>← Home</button><div><span className="section-kicker">DESIGN · OPERATE · EXPLAIN</span><h1>Mission Design Studio</h1></div></header>
    <p>Lead a complete science mission. Choose an objective, balance your spacecraft, verify delivery, then operate it and return useful science. Play alone or pass the device between up to four teammates.</p>
    <p className="mission-note">This studio models a mission from concept to science return. For piloted launch and trajectory flight, use <button className="ui-button" onClick={() => g.go('planner')}>Fly a mission</button>. Hardware and costs below are educational game assumptions.</p>
    {error && <p role="alert" className="mission-error">{error}</p>}{message && <p role="status">{message}</p>}
    {pending && <section aria-label="Review imported design"><h2>Review shared mission</h2><p>{pending.name} · {TARGETS[pending.target].name} · {ORBITS[pending.orbit].name} · {pending.days} days</p><p>Applying replaces the current unsaved design and simulation. Saved designs stay in your library.</p><button className="ui-button" data-testid="mission-apply-import" onClick={() => apply(pending)}>Apply design</button> <button className="ui-button" onClick={() => setPending(null)}>Cancel</button></section>}
    <div className="mission-studio-grid">
      <section><h2>1. Objective and spacecraft</h2>
        <fieldset disabled={locked}><legend>Mission configuration</legend>
          <label>Mission name<input maxLength={80} value={design.name} onChange={e => change({ name: e.target.value })} onBlur={() => { if (!design.name.trim()) change({ name: 'Untitled mission' }); }} data-testid="mission-name" /></label>
          <label>Science scenario<select data-testid="mission-target" value={design.target} onChange={e => change({ target: e.target.value })}>{Object.entries(TARGETS).map(([id, t]) => <option key={id} value={id}>{t.name}: {t.objective}</option>)}</select></label>
          <p><strong>Success requirement:</strong> return {stats.target.required} science points. Recommended payload: {CATALOG.instrument[stats.target.instrument].name}. Data left onboard earns no points.</p>
          <label>Orbit<select data-testid="mission-orbit" value={design.orbit} onChange={e => change({ orbit: e.target.value })}>{Object.entries(ORBITS).map(([id, o]) => <option key={id} value={id}>{o.name} · {o.altitude} km</option>)}</select></label>
          <p>Lower orbits favor detail; higher orbits offer broader coverage and longer modeled ground contacts.</p>
          <label>Operations duration: {design.days} days<input aria-label="Operations duration" type="range" min="1" max="30" value={design.days} onChange={e => change({ days: Number(e.target.value) })} /></label>
          <label>Budget: {design.budget} credits<input aria-label="Mission budget" type="range" min="50" max="500" step="5" value={design.budget} onChange={e => change({ budget: Number(e.target.value) })} /></label>
          {Object.entries(CATALOG).map(([key, options]) => <label key={key}>{({ instrument: 'Science instrument', panel: 'Solar power', battery: 'Eclipse battery', antenna: 'Communications', storage: 'Data recorder', launcher: 'Launch vehicle' })[key]}<select data-testid={'mission-' + key} value={design[key]} onChange={e => change({ [key]: e.target.value })}>{Object.entries(options).map(([id, p]) => <option key={id} value={id}>{p.name} · {p.cost} credits</option>)}</select><small>{Object.entries(options[design[key]]).filter(([k]) => !['name', 'cost', 'science'].includes(k)).map(([k, v]) => `${({ mass: 'mass (kg)', watts: 'power (W)', rate: 'data rate (MB/min)', wh: 'capacity (Wh)', mb: 'storage (MB)', capacity: 'reference delivery (kg)', maxAltitude: 'altitude limit (km)' })[k]}: ${v}`).join(' · ')}</small></label>)}
        </fieldset>
      </section>
      <section><h2>2. Resources and readiness</h2>
        <div className="mission-metrics" data-testid="mission-budgets">
          <Metric label="Cost / budget" value={`${number(stats.cost)} / ${design.budget} credits`} ratio={stats.cost / design.budget} />
          <Metric label="Mass / delivery limit" value={`${number(stats.mass)} / ${number(stats.capacity)} kg`} ratio={stats.mass / stats.capacity} />
          <Metric label="Sunlight power / observation load" value={`${number(stats.solar)} / ${10 + stats.instrument.watts} W`} />
          <Metric label="Battery / recorder" value={`${stats.battery.wh} Wh / ${stats.storage.mb} MB`} />
          <Metric label="Orbit period / eclipse" value={`${number(stats.period)} min / ${number(stats.eclipse * 100)}%`} />
          <Metric label="Downlink / contact fraction" value={`${number(stats.antenna.rate * stats.target.link)} MB/min / ${number(stats.orbit.contact * 100)}%`} />
        </div>
        <p>18 kg and 15 credits cover the bus; baseline systems consume 10 W. Operations cost 0.5 credits/day. Delivery limits depend on target and altitude.</p>
        {stats.issues.length > 0 ? <div role="status" className="mission-error"><h3>Resolve before launch</h3><ul>{stats.issues.map(i => <li key={i}>{i}</li>)}</ul></div> : <p data-testid="mission-ready">Delivery and budget checks pass.</p>}
        <ul>{stats.warnings.map(w => <li key={w}>{w}</li>)}</ul>
        <h3>Team review</h3><label>Players on this device<select disabled={locked} value={players} data-testid="mission-players" onChange={e => { setPlayers(Number(e.target.value)); setApproved([]); }}>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n === 1 ? 'Solo' : `${n} teammates`}</option>)}</select></label>
        {players > 1 && <><p>Pass the device. Discuss the trade-offs and approve together. Editing any choice resets every approval.</p>{Array.from({ length: players }, (_, i) => <label className="mission-approval" key={i}><input type="checkbox" disabled={locked} data-testid={'mission-approve-' + i} checked={approved.includes(i)} onChange={e => setApproved(a => e.target.checked ? [...a, i] : a.filter(n => n !== i))} />Player {i + 1}: {ROLES.filter((_, j) => j % players === i).join(' + ')}</label>)}</>}
        <div className="mission-actions"><button className="ui-button" data-testid="mission-launch" disabled={locked || stats.issues.length > 0 || (players > 1 && approved.length !== players)} onClick={launch}>Launch and operate</button><button className="ui-button" disabled={!state} onClick={() => { setPlaying(false); setState(null); }}>Return to design</button></div>
        {locked && <p>Configuration is locked during operations. Return to design to abandon this run and make changes.</p>}
      </section>
    </div>
    {state && <section data-testid="mission-operations"><h2>3. Mission operations</h2><p>Launch and arrival checks passed. Observe in sunlight, downlink during scheduled contacts, and protect the battery in eclipse. One spacecraft pointing system means observing and downlinking occur separately.</p>
      <progress aria-label="Mission elapsed time" value={state.minute} max={design.days * 1440} /><p>{number(state.minute / 60)} / {design.days * 24} hours · {state.done ? 'Mission complete' : playing ? 'Operating · 60 simulated minutes per tick' : 'Paused'}</p>
      <div className="mission-metrics"><Metric label="Battery" value={`${number(state.battery)} / ${stats.battery.wh} Wh`} ratio={state.battery / stats.battery.wh} /><Metric label="Data onboard" value={`${number(state.stored)} / ${stats.storage.mb} MB`} ratio={state.stored / stats.storage.mb} /><Metric label="Data returned" value={`${number(state.returned)} MB`} /><Metric label="Science returned" value={`${number(state.science)} / ${stats.target.required} points`} /></div>
      <div className="mission-actions"><button className="ui-button" disabled={state.done} onClick={() => setPlaying(p => !p)}>{playing && !state.done ? 'Pause' : 'Resume'}</button><button className="ui-button" disabled={state.done} onClick={() => { setPlaying(false); setState(s => stepMission(design, s, 60)); }}>Advance 1 hour</button><button className="ui-button" data-testid="mission-finish" disabled={state.done} onClick={() => { setPlaying(false); setState(s => stepMission(design, s, design.days * 1440)); }}>Simulate to end</button></div>
      <details><summary>Hourly telemetry ({state.history.length} samples)</summary><div className="mission-table-scroll"><table><thead><tr><th>Hour</th><th>Battery (Wh)</th><th>Stored (MB)</th><th>Science</th></tr></thead><tbody>{state.history.map(h => <tr key={h.minute}><td>{h.minute / 60}</td><td>{number(h.battery)}</td><td>{number(h.stored)}</td><td>{number(h.science)}</td></tr>)}</tbody></table></div></details>
      <h2>4. Results and decisions</h2><h3 data-testid="mission-result">{!report.complete ? 'Provisional results' : report.success ? 'Science objective achieved' : 'Science objective not achieved'} · {report.score} / 100</h3>
      <ul>{report.explanations.map(t => <li key={t}>{t}</li>)}</ul><p>{report.assumptions}</p><button className="ui-button" data-testid="mission-export-report" onClick={() => downloadJSON('mission-report.json', { ...report, telemetry: state.history, sources: SOURCES })}>Download mission report</button>
    </section>}
    <section><h2>Save, share and compare</h2><p>Save up to 20 named designs in this browser. Matching names replace earlier saves. Files and links share configuration only; recipients run their own simulation. No account or connection is required after the app is available offline.</p>
      <div className="mission-actions"><button className="ui-button" data-testid="mission-save" onClick={save}>Save design locally</button><button className="ui-button" data-testid="mission-export" onClick={() => { try { downloadJSON('mission-design.json', validateDesign(design)); } catch (e) { setError(e.message); } }}>Export design file</button><button className="ui-button" data-testid="mission-import" onClick={() => file.current.click()}>Import design file</button><button className="ui-button" data-testid="mission-share" onClick={() => { try { setShare(window.location.origin + window.location.pathname + '#mission=' + encodeDesign(design)); } catch (e) { setError(e.message); } }}>Create share link</button><button className="ui-button" disabled={locked} onClick={() => apply(DEFAULT_DESIGN)}>New Earth survey</button></div>
      <input ref={file} hidden type="file" accept="application/json,.json" onChange={importFile} />
      {share && <label>Copy this mission link<input aria-label="Mission share link" readOnly value={share} onFocus={e => e.target.select()} /></label>}
      <ul className="mission-library">{saved.map(d => <li key={d.name}><strong>{d.name}</strong> · {TARGETS[d.target].name}<div className="mission-actions"><button className="ui-button" disabled={locked} onClick={() => setPending(d)}>Review and load</button><button className="ui-button" data-testid="mission-compare-saved" onClick={() => compare(d)}>Compare results</button><button className="ui-button" onClick={() => { try { const list = saved.filter(s => s.name !== d.name); writeLibrary({ version: 1, draft: validateDesign(design), designs: list }); setSaved(list); } catch (e) { setError(e.message); } }}>Delete</button></div></li>)}</ul>
      {comparison && <Comparison current={design} other={comparison} />}
    </section>
    <section><h2>Where the numbers come from</h2><p>NASA resources guide the mission lifecycle and physical relationships. The selectable hardware, costs, launcher delivery factors, observation scores, fixed contacts, and degradation rate are deliberately simplified game assumptions, not specifications of real spacecraft or rockets.</p><p>Circular period = 2π√((radius + altitude)³ / μ). Zero-beta eclipse fraction = asin(radius / (radius + altitude)) / π. Solar generation scales as 1 / distance². Battery change = (generation − load) × elapsed hours. Fixed mean distances omit seasonal changes. No live scientific API is needed.</p><ul>{SOURCES.map(s => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a>: {s.use}</li>)}</ul></section>
  </main>;
}
function Metric({ label, value, ratio }) { return <div className="mission-metric"><span>{label}</span><strong>{value}</strong>{ratio !== undefined && <meter aria-label={label} min="0" max="1" value={Math.min(1, ratio)} />}</div>; }
function Comparison({ current, other }) {
  const s = designStats(current);
  if (s.issues.length) return <p>Resolve the current design’s launch issues to compare outcomes.</p>;
  const a = missionReport(current, runMission(current));
  return <div data-testid="mission-comparison"><h3>Two designs, same simulation rules</h3><p>Compare designs for the same objective and duration for a fair trade study. Different scenarios have different science requirements.</p><div className="mission-table-scroll"><table><thead><tr><th>Measure</th><th>{a.design.name} (current)</th><th>{other.design.name} (saved)</th></tr></thead><tbody>{[['Objective', TARGETS[a.design.target].objective, TARGETS[other.design.target].objective], ['Duration (days)', a.design.days, other.design.days], ['Science returned', number(a.science), number(other.science)], ['Result', a.success ? 'Achieved' : 'Not achieved', other.success ? 'Achieved' : 'Not achieved'], ['Cost (credits)', number(a.cost), number(other.cost)], ['Mass (kg)', number(a.mass), number(other.mass)], ['Downlinked (MB)', number(a.returned), number(other.returned)], ['Overflow (MB)', number(a.lost), number(other.lost)]].map(([label, x, y]) => <tr key={label}><th>{label}</th><td>{x}</td><td>{y}</td></tr>)}</tbody></table></div></div>;
}
