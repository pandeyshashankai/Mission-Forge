import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Rocket } from "lucide-react";
import { useGame } from "../game/GameContext";
import { runReadiness } from "../sim/readiness";
import { adviseDesign } from "../sim/advisor";
import { getMission } from "../sim/missions";
import { AdvisorPanel } from "../components/game/AdvisorPanel";
import { CalcDetail } from "../components/game/CalcDetail";
import { GoNoGo, StatusBadge } from "../components/game/Status";

export default function Readiness() {
  const g = useGame();
  const mission = getMission(g.missionId);
  const review = useMemo(() => runReadiness(g.design, mission, g.difficulty), [g.design, mission, g.difficulty]);
  const advice = useMemo(() => adviseDesign(g.design, review), [g.design, review]);
  const [open, setOpen] = useState(() => new Set(review.checks.filter((c) => c.status === "fail").map((c) => c.id)));
  const [confirm, setConfirm] = useState(false);
  const toggle = (id) => setOpen((s) => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const reveal = (id) => {
    setOpen((s) => new Set([...s, id]));
    document.getElementById(`check-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const nogo = review.overall === "NO-GO";

  return (
    <div className="flex h-full w-full flex-col grid-bg">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950/90 px-5 backdrop-blur-md">
        <button data-testid="review-back-btn" onClick={() => g.go("hangar")} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} /> Hangar</button>
        <div className="eyebrow">Mission Readiness Review · {mission.name} · {g.design.name}</div>
        <div className="w-20" />
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 p-5 lg:grid-cols-[1fr_400px]">
        <div className="flex min-h-0 flex-col">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <div className="eyebrow">Overall status</div>
              <div className="mt-2"><GoNoGo overall={review.overall} /></div>
            </div>
            <div className="flex items-center gap-2">
              {nogo && !confirm && (
                <button data-testid="launch-anyway-btn" onClick={() => setConfirm(true)} className="hazard border border-amber-500/60 px-4 py-2.5 font-mono text-xs uppercase tracking-widest text-amber-300">Test-fly anyway…</button>
              )}
              {nogo && confirm && (
                <button data-testid="launch-anyway-confirm-btn" onClick={() => g.go("flight")} className="hazard border border-red-500/70 bg-red-500/10 px-4 py-2.5 font-mono text-xs uppercase tracking-widest text-red-300">Confirm: launch with failures</button>
              )}
              <button data-testid="proceed-to-launch-btn" disabled={nogo} onClick={() => g.go("flight")} className="hazard flex items-center gap-2 border border-emerald-500/60 bg-emerald-500/10 px-5 py-2.5 font-display text-lg font-semibold uppercase tracking-widest text-emerald-300 disabled:cursor-not-allowed disabled:opacity-30">
                <Rocket size={16} /> Proceed to launch pad
              </button>
            </div>
          </div>
          <div className="panel min-h-0 flex-1 overflow-y-auto rounded-sm scroll-thin" data-testid="readiness-checks">
            {review.checks.map((c) => (
              <div key={c.id} id={`check-${c.id}`} className="border-b border-slate-800/80">
                <button data-testid={`check-row-${c.id}`} disabled={!c.calc} onClick={() => toggle(c.id)} className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-slate-900/60 disabled:cursor-default">
                  <ChevronRight size={14} className={`shrink-0 text-slate-500 transition-transform ${open.has(c.id) ? "rotate-90" : ""} ${!c.calc ? "opacity-0" : ""}`} />
                  <div className="w-56 shrink-0 font-display text-base font-semibold uppercase tracking-wide">{c.subsystem}</div>
                  <div className={`flex-1 font-mono text-xs ${c.status === "pending" ? "text-slate-600" : "text-slate-300"}`} data-testid={`check-summary-${c.id}`}>{c.summary}</div>
                  <StatusBadge status={c.status} testId={`check-status-${c.id}`} />
                </button>
                {open.has(c.id) && c.calc && (
                  <div className="bg-slate-950/70 px-12 pb-5 pt-2"><CalcDetail calc={c.calc} testId={`check-calc-${c.id}`} /></div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="panel min-h-0 overflow-y-auto rounded-sm p-4 scroll-thin">
          <AdvisorPanel items={advice} onRef={reveal} />
          <p className="mt-4 text-[11px] text-slate-600">The advisor is rules-based and offline. Every statement is computed from the checks on the left; nothing is estimated by AI.</p>
        </div>
      </div>
    </div>
  );
}
