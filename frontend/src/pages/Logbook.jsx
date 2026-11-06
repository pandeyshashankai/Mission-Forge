import { useState } from 'react';
import { useGame } from '../game/GameContext';
import { localData } from '../persistence/localData';
import { readFlightLog, achievements, compareFlights } from '../features/logbook';
const labels = {
  total: 'Score (%)',
  flightTime: 'Flight time (s)',
  cost: 'Cost (M)',
  remDv: 'Remaining Δv (m/s)',
  maxQ: 'Peak dynamic pressure (Pa)',
  maxG: 'Peak acceleration (g)'
};
const number = n => n === null ? '—' : n.toLocaleString(undefined, {
  maximumFractionDigits: 2
});
export default function Logbook() {
  const g = useGame(),
    [flights] = useState(() => readFlightLog(localData.entries())),
    [first, setFirst] = useState(flights[0]?.id || ''),
    [second, setSecond] = useState(flights[1]?.id || flights[0]?.id || '');
  let visited = [];
  try {
    visited = JSON.parse(localData.getItem('mf.exploration'))?.visited || [];
  } catch {}
  const a = flights.find(f => f.id === first),
    b = flights.find(f => f.id === second);
  return <main className="local-tools h-full overflow-y-auto p-4 md:p-8" data-testid="logbook-page"><div className="max-w-5xl mx-auto space-y-4"><button className="ui-button" onClick={() => g.go('menu')}>← Home</button><h1 className="text-3xl font-bold">Flight logbook</h1><p>Local history and achievements belong to this device. Scores are the recorded campaign results, not online rankings.</p><section className="ui-panel p-4"><h2 className="text-xl">Milestones</h2><div className="logbook-awards">{achievements(flights, Array.isArray(visited) ? visited : []).map(award => <article key={award.id} data-earned={award.earned}><strong>{award.earned ? '✓' : '○'} {award.name}</strong><p>{award.detail}</p></article>)}</div></section>{flights.length ? <><section className="ui-panel p-4 space-y-3"><h2 className="text-xl">Compare recorded flights</h2>{[[first, setFirst, 'A'], [second, setSecond, 'B']].map(([value, setValue, name]) => <label className="block" key={name}>Flight {name}<select className="ui-input w-full" data-testid={'compare-' + name.toLowerCase()} value={value} onChange={e => setValue(e.target.value)}>{flights.map(f => <option key={f.id} value={f.id}>{f.missionId} · {f.designName} · {f.difficulty} · {f.at}</option>)}</select></label>)}<div className="overflow-x-auto"><table className="w-full" data-testid="flight-comparison"><thead><tr><th>Metric</th><th>A</th><th>B</th><th>B − A</th></tr></thead><tbody>{compareFlights(a, b).map(row => <tr key={row.key}><td>{labels[row.key]}</td><td>{number(row.a)}</td><td>{number(row.b)}</td><td>{number(row.delta)}</td></tr>)}</tbody></table></div></section><section className="ui-panel p-4"><h2 className="text-xl">Selected flight timeline</h2>{Array.isArray(a?.events) && a.events.length ? <ol>{a.events.map((event, i) => <li key={i}>T+{Number.isFinite(event.t) ? event.t.toFixed(1) : '—'} s · {String(event.text || event.message || event.label || 'Flight event')}</li>)}</ol> : <p>This older save has no retained event timeline. New campaign results keep their latest 80 events.</p>}</section></> : <section className="ui-panel p-4"><p>No campaign flights recorded yet.</p><button className="ui-button" onClick={() => g.go('planner')}>Choose a mission</button></section>}</div></main>;
}
