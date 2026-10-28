import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { PARTS, PROPELLANTS, engineSL } from "../../sim/parts";
import { describeEvent, validEventOrder } from "../../sim/design";

const fmt = (x, d = 0) => Number(x).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const IconBtn = ({ onClick, children, testId, danger }) => (
  <button data-testid={testId} onClick={(e) => { e.stopPropagation(); onClick(); }} className={`p-1 text-slate-500 transition-colors ${danger ? "hover:text-red-400" : "hover:text-cyan-300"}`}>{children}</button>
);

export const StackList = ({ design, stats, selectedUid, onSelect, onMove, onRemove, onSymmetry }) => {
  const sectionOf = {};
  stats.sections.forEach((s) => s.parts.forEach((p) => (sectionOf[p.uid] = s.index)));
  return (
    <div className="space-y-1" data-testid="stack-list">
      {design.stack.map((n, i) => {
        const p = PARTS[n.partId];
        const sec = sectionOf[n.uid];
        const newSec = i === 0 || sectionOf[design.stack[i - 1].uid] !== sec;
        const radials = (design.radials || []).filter((r) => r.parentUid === n.uid);
        return (
          <div key={n.uid}>
            {newSec && <div className="eyebrow mb-1 mt-2 !text-[9px] text-cyan-500">Stage {sec + 1}</div>}
            <div data-testid={`stack-item-${n.uid}`} onClick={() => onSelect(n.uid)} className={`flex cursor-pointer items-center justify-between border px-2 py-1.5 transition-colors ${selectedUid === n.uid ? "border-cyan-500/70 bg-cyan-500/10" : "border-slate-800 bg-slate-950/60 hover:border-slate-600"}`}>
              <span className="truncate text-xs">{p.name}</span>
              <span className="flex shrink-0">
                <IconBtn testId={`stack-up-${n.uid}`} onClick={() => onMove(n.uid, -1)}><ChevronUp size={13} /></IconBtn>
                <IconBtn testId={`stack-down-${n.uid}`} onClick={() => onMove(n.uid, 1)}><ChevronDown size={13} /></IconBtn>
                <IconBtn danger testId={`stack-remove-${n.uid}`} onClick={() => onRemove(n.uid)}><Trash2 size={12} /></IconBtn>
              </span>
            </div>
            {radials.map((r) => (
              <div key={r.uid} data-testid={`radial-item-${r.uid}`} onClick={() => onSelect(r.uid)} className={`ml-4 mt-1 flex cursor-pointer items-center justify-between border px-2 py-1 ${selectedUid === r.uid ? "border-cyan-500/70 bg-cyan-500/10" : "border-slate-800 bg-slate-950/40"}`}>
                <span className="truncate text-[11px] text-slate-300">↳ {PARTS[r.partId].name}</span>
                <span className="flex items-center gap-1">
                  {[2, 3, 4].map((s) => (
                    <button key={s} data-testid={`radial-sym-${r.uid}-${s}`} onClick={(e) => { e.stopPropagation(); onSymmetry(r.uid, s); }} className={`px-1 font-mono text-[10px] ${r.symmetry === s ? "text-cyan-300" : "text-slate-600 hover:text-slate-300"}`}>×{s}</button>
                  ))}
                  <IconBtn danger testId={`radial-remove-${r.uid}`} onClick={() => onRemove(r.uid)}><Trash2 size={12} /></IconBtn>
                </span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

export const StagingList = ({ stats, design, onReorder }) => {
  const order = stats.events;
  const phaseBy = Object.fromEntries(stats.dv.phases.map((p) => [p.eventId, p]));
  const move = (i, d) => {
    const next = [...order];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    if (!validEventOrder(next)) return false;
    onReorder(next);
  };
  return (
    <div className="space-y-1" data-testid="staging-list">
      <p className="mb-2 text-[11px] text-slate-500">Staging fires top to bottom (Space in flight). Booster and fairing jettisons can be reordered; stage separations keep their physical order.</p>
      {order.map((id, i) => {
        const ev = describeEvent(id, stats.sections);
        const ph = phaseBy[id];
        const movable = ev.kind === "rad" || ev.kind === "fair";
        return (
          <div key={id} data-testid={`staging-event-${i}`} className="border border-slate-800 bg-slate-950/60 px-2 py-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs"><span className="mr-2 font-mono text-slate-600">{i}</span>{ev.label}</span>
              {movable && (
                <span className="flex">
                  <IconBtn testId={`staging-up-${i}`} onClick={() => move(i, -1)}><ChevronUp size={13} /></IconBtn>
                  <IconBtn testId={`staging-down-${i}`} onClick={() => move(i, 1)}><ChevronDown size={13} /></IconBtn>
                </span>
              )}
            </div>
            {ph && (
              <div className="mt-0.5 font-mono text-[10px] text-slate-500">
                Δv {fmt(ph.dv)} m/s · burn {fmt(ph.burnTime)} s · TWR {fmt(ph.atmospheric ? ph.twrSL : ph.twrVac, 2)}{ph.atmospheric ? " SL" : " vac"}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const Inspector = ({ node }) => {
  if (!node) return <div className="text-xs text-slate-500" data-testid="inspector-empty">Select a part in the 3D view or the stack list.</div>;
  const p = PARTS[node.partId];
  const rows = [
    ["Dry mass", `${fmt(p.dryMass)} kg`],
    ["Cost", `$${p.cost}M`],
    ["Diameter × height", `${p.diameter} × ${p.height} m`],
  ];
  if (node.symmetry) rows.push(["Symmetry", `×${node.symmetry}`]);
  if (p.propellant) rows.push(["Propellant", `${fmt(p.propellant.mass)} kg ${PROPELLANTS[p.propellant.type].label}`]);
  if (p.engine) {
    rows.push(["Thrust vac / SL", `${fmt(p.engine.thrustVac / 1000)} / ${fmt(engineSL(p.engine) / 1000)} kN`]);
    rows.push(["Isp vac / SL", `${p.engine.ispVac} / ${p.engine.ispSL} s`]);
    rows.push(["Throttle", p.engine.solid ? "None (solid)" : `${Math.round(p.engine.minThrottle * 100)}–100%`]);
    rows.push(["Mass flow", `${fmt(p.engine.thrustVac / (9.80665 * p.engine.ispVac), 1)} kg/s`]);
  }
  if (p.crew) rows.push(["Crew seats", p.crew]);
  if (p.control) rows.push(["Control", "Flight computer"]);
  return (
    <div data-testid="part-inspector">
      <div className="font-display text-lg font-semibold uppercase tracking-wide">{p.name}</div>
      {p.desc && <p className="mt-1 text-xs text-slate-400">{p.desc}</p>}
      <table className="mt-2 w-full font-mono text-[11px]">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-t border-slate-800/80"><td className="py-1 text-slate-500">{k}</td><td className="py-1 text-right text-sky-300">{v}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] italic text-slate-600">Source: {p.source}. Approximate public values.</p>
    </div>
  );
};
