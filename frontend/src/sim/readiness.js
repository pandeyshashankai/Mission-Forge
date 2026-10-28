import { G0 } from "./constants";
import { designStats, engineIssues, describeEvent } from "./design";
import { engineSL, PARTS } from "./parts";
import { missionBudget, requiredDeltaV } from "./missions";

const fmt = (x, d = 0) => Number(x).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const t = (kg) => `${fmt(kg / 1000, 1)} t`;

function propulsionCheck(stats, mission, req) {
  const target = req.value * (1 + mission.reserve);
  const avail = stats.dv.total;
  const status = avail >= target ? "pass" : avail >= req.value ? "warn" : "fail";
  const steps = stats.dv.phases.map(
    (p, i) =>
      `Phase ${i + 1} (${p.burning} burning): ${fmt(p.isp, 1)} s × ${G0} × ln(${t(p.m0)} / ${t(p.m1)}) = ${fmt(p.dv)} m/s${p.atmospheric ? " (mean SL/vac Isp)" : ""}`
  );
  steps.push(`Total available Δv = ${fmt(avail)} m/s`);
  steps.push(`Required = ${fmt(req.value)} m/s × (1 + ${mission.reserve * 100}% reserve) = ${fmt(target)} m/s`);
  return {
    id: "propulsion",
    subsystem: "Propulsion capability",
    status,
    summary:
      status === "pass"
        ? `Δv ${fmt(avail)} m/s available vs ${fmt(target)} m/s required incl. ${mission.reserve * 100}% reserve`
        : `Δv ${status === "warn" ? "reserve below target" : "insufficient"}: ${fmt(avail)} m/s available vs ${fmt(req.value)} m/s required + ${mission.reserve * 100}% reserve (${fmt(target)} m/s)`,
    values: { available: avail, required: req.value, target, gap: target - avail },
    calc: {
      formula: "Δv = Σ Isp · g₀ · ln(m₀ / m₁)   (Tsiolkovsky, per burn phase)",
      inputs: [
        { name: "g₀ (standard gravity)", value: G0, unit: "m/s²", source: "CGPM / ISO 80000" },
        ...stats.dv.phases.map((p, i) => ({ name: `Phase ${i + 1} (${p.burning}) m₀ → m₁, Isp`, value: `${t(p.m0)} → ${t(p.m1)}, ${fmt(p.isp, 1)} s`, unit: "", source: "Part catalog (approximate public values)" })),
        ...req.calc.inputs,
      ],
      steps: [...req.calc.steps, ...steps],
      assumptions: [
        "Each phase burns until the parts dropped by the next staging event are empty; fairings are assumed jettisoned at their event.",
        "Phases while Stage 1 is attached use the mean of sea-level and vacuum Isp to account for nozzle back-pressure.",
        ...req.calc.assumptions,
      ],
    },
  };
}

function twrCheck(stats) {
  const w = stats.mass * G0;
  const v = stats.liftoffTWR;
  const status = v >= 1.2 ? "pass" : v >= 1.0 ? "warn" : "fail";
  return {
    id: "twr",
    subsystem: "Liftoff thrust-to-weight",
    status,
    summary: `Liftoff thrust-to-weight ${fmt(v, 2)} (minimum 1.2 recommended, 1.0 to leave the pad)`,
    values: { twr: v, thrust: stats.liftoffThrustSL, weight: w, mass: stats.mass },
    calc: {
      formula: "TWR = F_sea-level / (m₀ · g₀)",
      inputs: [
        { name: "F_sea-level (all Stage 1 engines + boosters)", value: fmt(stats.liftoffThrustSL / 1000), unit: "kN", source: "Part catalog: F_vac × Isp_SL / Isp_vac" },
        { name: "m₀ (liftoff mass)", value: fmt(stats.mass), unit: "kg", source: "Sum of part masses + propellant" },
        { name: "g₀", value: G0, unit: "m/s²", source: "Standard gravity" },
      ],
      steps: [`TWR = ${fmt(stats.liftoffThrustSL / 1000)} kN / (${fmt(stats.mass)} kg × ${G0}) = ${fmt(v, 3)}`],
      assumptions: ["Below 1.0 the vehicle stays on the pad. Between 1.0 and 1.2 gravity losses grow sharply."],
    },
  };
}

function upperTwrCheck(stats) {
  const ups = stats.dv.phases.filter((p) => !p.atmospheric);
  if (!ups.length) return null;
  const worst = ups.reduce((a, b) => (b.twrVac < a.twrVac ? b : a));
  const status = worst.twrVac >= 0.5 ? "pass" : worst.twrVac >= 0.25 ? "warn" : "fail";
  return {
    id: "upper_twr",
    subsystem: "Upper-stage thrust-to-weight",
    status,
    summary: `Lowest upper-stage vacuum TWR ${fmt(worst.twrVac, 2)} (${worst.burning}) (≥ 0.5 recommended)`,
    values: { twr: worst.twrVac },
    calc: {
      formula: "TWR_vac = F_vac / (m_stage-start · g₀)",
      inputs: ups.map((p) => ({ name: `${p.burning} start`, value: `${t(p.m0)}, TWR ${fmt(p.twrVac, 2)}`, unit: "", source: "Phase analysis" })),
      steps: ups.map((p) => `${p.burning}: TWR_vac = ${fmt(p.twrVac, 3)}`),
      assumptions: ["Low upper-stage thrust lengthens the burn and the vehicle falls back while still accelerating horizontally."],
    },
  };
}

const simple = (id, subsystem, ok, summary, formula, inputs, steps, warn = false) => ({
  id,
  subsystem,
  status: ok ? "pass" : warn ? "warn" : "fail",
  summary,
  calc: { formula, inputs, steps, assumptions: [] },
});

const PENDING = [
  ["power", "Electrical power", 4],
  ["comms", "Communication link", 4],
  ["attitude", "Attitude control", 2],
  ["thermal", "Thermal", 4],
  ["structure", "Structure & loads", 4],
  ["crew", "Crew safety", 3],
];

export function runReadiness(design, mission, difficulty) {
  const stats = designStats(design);
  const req = requiredDeltaV(mission);
  const budget = missionBudget(mission, difficulty);
  const checks = [propulsionCheck(stats, mission, req), twrCheck(stats)];
  const up = upperTwrCheck(stats);
  if (up) checks.push(up);
  const feed = engineIssues(design);
  checks.push(
    simple(
      "feed",
      "Engine propellant feed",
      feed.length === 0 && stats.dv.phases.length > 0,
      feed.length ? `${feed[0].engine} in Stage ${feed[0].section + 1} has no ${feed[0].propellant} tank in its stage` : stats.dv.phases.length ? "Every engine has matching propellant in its stage" : "No engine can produce thrust",
      "Engine propellant type ∈ tanks in the same stage",
      feed.map((f) => ({ name: f.engine, value: `Stage ${f.section + 1}`, unit: "", source: `needs ${f.propellant}` })),
      feed.map((f) => `${f.engine}: no ${f.propellant} tank in Stage ${f.section + 1}`)
    )
  );
  checks.push(
    simple("mass", "Liftoff mass", stats.mass <= mission.massLimit, `Liftoff mass ${t(stats.mass)} vs pad limit ${t(mission.massLimit)}`, "m₀ ≤ m_limit",
      [{ name: "m₀", value: fmt(stats.mass), unit: "kg", source: "Sum of parts" }, { name: "m_limit", value: fmt(mission.massLimit), unit: "kg", source: "Mission constraint" }],
      [`${fmt(stats.mass)} kg ${stats.mass <= mission.massLimit ? "≤" : ">"} ${fmt(mission.massLimit)} kg`])
  );
  checks.push(
    simple("cost", "Mission cost", stats.cost <= budget, `Cost $${fmt(stats.cost, 1)}M vs budget $${fmt(budget, 1)}M`, "C = Σ part cost + launch operations ≤ budget",
      [{ name: "Σ part cost", value: fmt(stats.partsCost, 2), unit: "$M", source: "Part catalog (approximate)" }, { name: "Launch operations", value: fmt(stats.launchOpsCost, 1), unit: "$M", source: "Assumed flat range fee" }, { name: "Budget", value: fmt(budget, 1), unit: "$M", source: `Mission base × difficulty multiplier` }],
      [`$${fmt(stats.partsCost, 2)}M + $${fmt(stats.launchOpsCost, 1)}M = $${fmt(stats.cost, 2)}M`])
  );
  checks.push(
    simple("control", "Command & control", stats.hasControl, stats.hasControl ? "Vehicle has a flight computer / command part" : "No probe core, capsule or controllable payload on board", "∃ part with control capability",
      design.stack.filter((n) => PARTS[n.partId].control).map((n) => ({ name: PARTS[n.partId].name, value: "control", unit: "", source: "Part catalog" })), [])
  );
  for (const [id, subsystem, ms] of PENDING)
    checks.push({ id, subsystem, status: "pending", summary: `Not evaluated yet — scheduled for Milestone ${ms}. Not counted toward Go/No-Go.`, calc: null });
  const active = checks.filter((c) => c.status !== "pending");
  const overall = active.some((c) => c.status === "fail") ? "NO-GO" : active.some((c) => c.status === "warn") ? "GO-WARN" : "GO";
  return { stats, req, budget, checks, overall };
}

export { engineSL };
