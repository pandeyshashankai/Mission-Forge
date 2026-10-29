import { fmt } from "./FlightHud";

const Bar = ({ label, days, kg, testId }) => (
  <div className="flex items-center justify-between font-mono text-[10px]">
    <span className="text-slate-500">{label}</span>
    <span data-testid={testId} className={days < 1 ? "text-red-400" : days < 3 ? "text-amber-400" : "text-sky-300"}>{fmt(kg, 1)} kg · {fmt(days, 1)} d</span>
  </div>
);

const BANKS = [["auto", "Auto"], [0, "Lift up"], [90, "90°"], [180, "Lift dn"]];

export const CrewPanel = ({ s, sim }) => {
  const ls = s.ls;
  const e = s.entry;
  const shield = sim.aero.shield;
  return (
    <div className="panel w-60 rounded-sm p-3" data-testid="hud-crew">
      <div className="eyebrow mb-1 text-cyan-400">Crew · life support</div>
      <div className="font-mono text-[10px] text-slate-400" data-testid="crew-count">{ls.crew} crew on board</div>
      <Bar label="Oxygen" days={ls.days.o2} kg={ls.o2} testId="ls-o2" />
      <Bar label="Water" days={ls.days.water} kg={ls.water} testId="ls-water" />
      <Bar label="Food" days={ls.days.food} kg={ls.food} testId="ls-food" />
      <div className="eyebrow mb-1 mt-2 text-cyan-400">Re-entry</div>
      <div className="grid grid-cols-2 gap-x-2 font-mono text-[10px]">
        <span className="text-slate-500">Load now / mission pk</span><span className="text-right text-sky-300" data-testid="entry-g">{fmt(e.g, 1)} / {fmt(e.maxG, 1)} g</span>
        <span className="text-slate-500">Entry peak</span><span className="text-right text-sky-300" data-testid="entry-g-peak">{e.ei ? `${fmt(e.maxGEntry || 0, 1)} g` : "—"}</span>
        <span className="text-slate-500">Heat flux</span><span className="text-right text-sky-300" data-testid="entry-flux">{fmt(e.flux / 1e6, 2)} MW/m²</span>
        <span className="text-slate-500">Ablator used</span><span className="text-right text-sky-300" data-testid="entry-ablator">{shield ? `${fmt((100 * e.heatLoad) / shield.capacity, 1)}%` : "no shield"}</span>
        <span className="text-slate-500">Parachutes</span><span className="text-right uppercase text-sky-300" data-testid="entry-chute">{s.hasChute ? e.chute : "none"}</span>
        <span className="text-slate-500">Entry config</span><span className={`text-right ${s.blunt ? "text-emerald-400" : "text-amber-400"}`} data-testid="entry-config">{s.blunt ? "capsule" : "SM attached"}</span>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1">
        {BANKS.map(([v, l]) => (
          <button key={l} data-testid={`bank-${l.replace(/\s|°/g, "").toLowerCase()}`} onClick={() => (sim.entry.bankMode = v)} className={`py-0.5 font-mono text-[9px] ${e.bankMode === v ? "bg-cyan-500/25 text-cyan-200" : "bg-slate-900 text-slate-400 hover:text-white"}`}>{l}</button>
        ))}
      </div>
    </div>
  );
};
