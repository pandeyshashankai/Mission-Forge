import { Wrench, CheckCircle2 } from "lucide-react";
import { StatusBadge } from "./Status";

export const AdvisorPanel = ({ items, onRef, compact = false, testId = "engineering-advisor-panel" }) => (
  <div data-testid={testId} className="space-y-2">
    <div className="flex items-center gap-2">
      <Wrench size={14} className="text-cyan-400" />
      <span className="eyebrow">Engineering Advisor</span>
    </div>
    {items.length === 0 && (
      <div className="inset flex items-center gap-2 rounded-sm p-3 text-xs text-emerald-300" data-testid="advisor-all-clear">
        <CheckCircle2 size={14} /> All evaluated limits are met. No action needed.
      </div>
    )}
    {items.map((it) => (
      <div key={it.id} data-testid={`advisor-item-${it.id}`} className={`inset rounded-sm border-l-2 p-3 text-xs ${it.severity === "fail" ? "border-l-red-500" : it.severity === "warn" ? "border-l-amber-500" : "border-l-cyan-500"}`}>
        <div className="mb-1 flex items-start justify-between gap-2">
          <div className="font-medium text-slate-100">{it.title}</div>
          <StatusBadge status={it.severity} />
        </div>
        {!compact && <div className="eyebrow mt-2 !text-[9px]">Detected problems</div>}
        <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-slate-300">
          {it.problems.map((p, k) => (
            <li key={k}>· {p}</li>
          ))}
        </ul>
        {!compact && (
          <>
            <div className="eyebrow mt-2 !text-[9px]">Suggested improvements</div>
            <ul className="mt-1 space-y-0.5 text-slate-400">
              {it.fixes.map((f, k) => (
                <li key={k}>→ {f}</li>
              ))}
            </ul>
          </>
        )}
        {onRef && it.ref && (
          <button data-testid={`advisor-show-calc-${it.id}`} onClick={() => onRef(it.ref)} className="mt-2 font-mono text-[10px] uppercase tracking-widest text-cyan-400 hover:text-cyan-300">
            Show calculation ↗
          </button>
        )}
      </div>
    ))}
  </div>
);
