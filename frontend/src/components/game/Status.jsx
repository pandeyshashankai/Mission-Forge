import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";

const MAP = {
  pass: { icon: CheckCircle2, cls: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10", label: "PASS" },
  warn: { icon: AlertTriangle, cls: "text-amber-400 border-amber-500/50 bg-amber-500/10", label: "WARN" },
  fail: { icon: XCircle, cls: "text-red-400 border-red-500/60 bg-red-500/10", label: "FAIL" },
  info: { icon: Info, cls: "text-cyan-400 border-cyan-500/40 bg-cyan-500/10", label: "INFO" },
};

export const StatusBadge = ({ status, testId }) => {
  const m = MAP[status] || MAP.info;
  const Icon = m.icon;
  return (
    <span data-testid={testId} className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] tracking-widest ${m.cls}`}>
      <Icon size={11} /> {m.label}
    </span>
  );
};

export const GoNoGo = ({ overall, testId = "readiness-go-nogo-badge" }) => {
  const go = overall !== "NO-GO";
  return (
    <div data-testid={testId} className={`inline-flex items-center gap-2 rounded-sm border px-4 py-2 font-display text-2xl font-bold tracking-widest ${go ? (overall === "GO" ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400" : "border-amber-500/60 bg-amber-500/10 text-amber-400") : "border-red-500/70 bg-red-500/10 text-red-400"}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${go ? (overall === "GO" ? "bg-emerald-400" : "bg-amber-400") : "bg-red-400 blink"}`} />
      {overall === "GO-WARN" ? "GO · WARNINGS" : overall}
    </div>
  );
};

export const Stat = ({ label, value, unit, testId, tone }) => (
  <div className="inset rounded-sm px-3 py-2">
    <div className="eyebrow !text-[9px]">{label}</div>
    <div data-testid={testId} className={`font-mono text-base font-bold tracking-wide ${tone || "text-sky-300"}`}>
      {value}
      {unit && <span className="ml-1 text-[10px] font-normal text-slate-500">{unit}</span>}
    </div>
  </div>
);
