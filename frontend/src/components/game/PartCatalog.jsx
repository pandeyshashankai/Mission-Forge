import { useState } from "react";
import { Search } from "lucide-react";
import { CATEGORIES, PART_LIST, PROPELLANTS } from "../../sim/parts";

const fmt = (x, d = 0) => Number(x).toLocaleString("en-US", { maximumFractionDigits: d });

export const PartCatalog = ({ onAdd, onHover }) => {
  const [q, setQ] = useState("");
  const parts = PART_LIST.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex h-full flex-col" data-testid="part-catalog">
      <div className="relative border-b border-slate-800 p-3">
        <Search size={13} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input data-testid="part-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search parts" className="w-full border border-slate-800 bg-slate-950 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-cyan-500/60" />
      </div>
      <div className="flex-1 overflow-y-auto scroll-thin p-3">
        {CATEGORIES.map((c) => {
          const list = parts.filter((p) => p.category === c.id);
          if (!list.length) return null;
          return (
            <div key={c.id} className="mb-4">
              <div className="eyebrow mb-1.5 !text-[9px]">{c.label}</div>
              <div className="space-y-1">
                {list.map((p) => (
                  <button key={p.id} data-testid={`part-catalog-item-${p.id}`} onClick={() => onAdd(p.id)} onMouseEnter={() => onHover?.(p.id)}
                    className="group w-full border border-slate-800/80 bg-slate-950/70 px-2.5 py-2 text-left transition-[border-color,background-color,transform] hover:translate-x-0.5 hover:border-cyan-500/50 hover:bg-slate-900">
                    <div className="text-xs font-medium text-slate-200 group-hover:text-white">{p.name}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-slate-500">
                      {fmt(p.dryMass)} kg · ${p.cost}M · Ø{p.diameter} m
                      {p.propellant && ` · ${fmt(p.propellant.mass / 1000)} t ${PROPELLANTS[p.propellant.type].short}`}
                      {p.engine && ` · ${fmt(p.engine.thrustVac / 1000)} kN · ${p.engine.ispVac} s`}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
