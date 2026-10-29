import { G0 } from "./constants";
import { designStats, engineIssues, describeEvent, buildSections } from "./design";
import { engineSL, PARTS } from "./parts";
import { missionBudget, requiredDeltaV } from "./missions";
import { attitudeRequirement, rcsTorque } from "./attitude";
import { crewChecks } from "./crewReadiness";
import { systemsChecks } from "./systems";

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
  const status = worst.twrVac >= 0.35 ? "pass" : worst.twrVac >= 0.2 ? "warn" : "fail";
  return {
    id: "upper_twr",
    subsystem: "Upper-stage thrust-to-weight",
    status,
    summary: `Lowest upper-stage vacuum TWR ${fmt(worst.twrVac, 2)} (${worst.burning}) (≥ 0.35 recommended)`,
    values: { twr: worst.twrVac },
    calc: {
      formula: "TWR_vac = F_vac / (m_stage-start · g₀)",
      inputs: ups.map((p) => ({ name: `${p.burning} start`, value: `${t(p.m0)}, TWR ${fmt(p.twrVac, 2)}`, unit: "", source: "Phase analysis" })),
      steps: ups.map((p) => `${p.burning}: TWR_vac = ${fmt(p.twrVac, 3)}`),
      assumptions: ["Low upper-stage thrust lengthens the burn and the vehicle falls back while still accelerating horizontally."],
    },
  };
}

export function upperAttitude(stats) {
  const top = stats.sections[stats.sections.length - 1];
  let L = 0, maxD = 0, wheelTorque = 0, wheelMomentum = 0, rcsThrust = 0, mass = 0;
  for (const n of top.parts) {
    const p = PARTS[n.partId];
    L += p.height;
    maxD = Math.max(maxD, p.diameter);
    mass += p.dryMass + (p.propellant ? p.propellant.mass : 0);
    if (p.attitude) {
      wheelTorque += p.attitude.wheelTorque || 0;
      wheelMomentum += p.attitude.wheelMomentum || 0;
      rcsThrust += p.attitude.rcsThrust || 0;
    }
  }
  const cfg = { L: Math.max(1, L), R: maxD / 2, wheelTorque, wheelMomentum, rcsThrust };
  const hasMono = (top.tanks.monoprop || 0) > 0;
  const rcs = hasMono ? rcsTorque(cfg) : 0;
  return { cfg, mass, rcs, hasMono, avail: wheelTorque + rcs, req: attitudeRequirement(mass, cfg, 90, 60) };
}

function attitudeCheck(stats) {
  const a = upperAttitude(stats);
  const { req, cfg } = a;
  const momentumOk = cfg.wheelMomentum >= req.momentum || a.rcs > 0;
  const status = a.avail >= req.torque && momentumOk ? "pass" : a.avail >= req.torque / 4 && a.avail > 0 ? "warn" : "fail";
  const t90 = a.avail > 0 ? Math.sqrt((4 * req.theta * req.I) / a.avail) : Infinity;
  return {
    id: "attitude",
    subsystem: "Attitude control",
    status,
    summary: `Top stage control torque ${fmt(a.avail)} N·m vs ${fmt(req.torque)} N·m needed for a 90° turn in 60 s (best 90° turn ≈ ${Number.isFinite(t90) ? fmt(t90) + " s" : "never"})`,
    values: { avail: a.avail, req: req.torque, wheels: cfg.wheelTorque, rcs: a.rcs, momentumOk, hasMono: a.hasMono, I: req.I },
    calc: {
      formula: "τ_req = I · 4θ / T²,  I = m (L²/12 + R²/4),  τ_RCS = F_couple · 0.9 L",
      inputs: [
        { name: "m (top stage, fuelled)", value: fmt(a.mass), unit: "kg", source: "Part catalog" },
        { name: "L (top stage length)", value: fmt(cfg.L, 1), unit: "m", source: "Sum of part heights" },
        { name: "R (max radius)", value: fmt(cfg.R, 2), unit: "m", source: "Part catalog" },
        { name: "θ, T (reference slew)", value: "90°, 60 s", unit: "", source: "Assumed pointing requirement (bang-bang slew)" },
        { name: "Reaction wheel torque / momentum", value: `${fmt(cfg.wheelTorque)} / ${fmt(cfg.wheelMomentum)}`, unit: "N·m / N·m·s", source: "Part catalog" },
        { name: "RCS couple thrust", value: a.hasMono ? fmt(cfg.rcsThrust) : `${fmt(cfg.rcsThrust)} (no monopropellant)`, unit: "N", source: "Part catalog" },
      ],
      steps: [
        `I = ${fmt(a.mass)} × (${fmt(cfg.L, 1)}²/12 + ${fmt(cfg.R, 2)}²/4) = ${fmt(req.I)} kg·m²`,
        `τ_req = ${fmt(req.I)} × 4 × ${req.theta.toFixed(3)} / 60² = ${fmt(req.torque)} N·m`,
        `τ_avail = wheels ${fmt(cfg.wheelTorque)} + RCS ${fmt(a.rcs)} = ${fmt(a.avail)} N·m`,
        `Peak momentum for the slew = I · 2θ/T = ${fmt(req.momentum)} N·m·s vs wheel capacity ${fmt(cfg.wheelMomentum)} N·m·s${a.rcs > 0 ? " (RCS can unload)" : ""}`,
      ],
      assumptions: ["Uniform-cylinder inertia; roll is not modelled.", "Engine gimbal adds torque only while the engine fires and is not counted here.", "Gravity-gradient and aerodynamic disturbance torques act in flight and slowly fill the wheels."],
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
  ["structure", "Structure & loads", 4],
];

export function runReadiness(design, mission, difficulty) {
  const stats = designStats(design);
  const req = requiredDeltaV(mission);
  const budget = missionBudget(mission, difficulty);
  const checks = [propulsionCheck(stats, mission, req), twrCheck(stats)];
  checks.push(attitudeCheck(stats));
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
  checks.push(...crewChecks(design, mission, stats));
  checks.push(...systemsChecks(buildSections(design), mission));
  for (const [id, subsystem, ms] of PENDING)
    checks.push({ id, subsystem, status: "pending", summary: `Not evaluated yet — scheduled for Milestone ${ms}. Not counted toward Go/No-Go.`, calc: null });
  const active = checks.filter((c) => c.status !== "pending");
  const overall = active.some((c) => c.status === "fail") ? "NO-GO" : active.some((c) => c.status === "warn") ? "GO-WARN" : "GO";
  return { stats, req, budget, checks, overall };
}

export { engineSL };
