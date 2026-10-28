import { G0 } from "./constants";
import { createRuntime, deltaVFromRuntime } from "./design";
import { PARTS, PART_LIST, engineSL } from "./parts";

const fmt = (x, d = 0) => Number(x).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });

// Mass that must be removed from the top stage to reach a Δv target (bisection on the real phase model).
function massToRemove(design, target) {
  const base = createRuntime(design);
  const top = base.sections.length - 1;
  const dvWith = (x) => {
    const rt = JSON.parse(JSON.stringify(base));
    rt.sections[top].dryMass -= x;
    return deltaVFromRuntime(rt, { applyFirst: true, padAvg: true }).total;
  };
  const maxRemovable = Math.max(0, base.sections[top].dryMass - 100);
  if (dvWith(maxRemovable) < target) return null;
  let lo = 0, hi = maxRemovable;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (dvWith(mid) >= target) hi = mid;
    else lo = mid;
  }
  return hi;
}

export function adviseDesign(design, review) {
  const items = [];
  const byId = Object.fromEntries(review.checks.map((c) => [c.id, c]));
  const { stats } = review;
  const prop = byId.propulsion;
  if (prop && prop.status !== "pass") {
    const v = prop.values;
    const remove = massToRemove(design, v.target);
    const topEngines = stats.sections[stats.sections.length - 1]?.engines.map((e) => PARTS[e.partId]) || [];
    const bestIsp = PART_LIST.filter((p) => p.engine && !p.engine.solid).sort((a, b) => b.engine.ispVac - a.engine.ispVac)[0];
    const fixes = [];
    if (v.available <= 0) fixes.push("There is no usable engine + propellant combination: add tanks and a matching engine below them.");
    else if (remove != null) fixes.push(`Reduce mass carried by the top stage by about ${fmt(remove / 1000, 2)} t (payload or unneeded parts) — recalculated with the phase model.`);
    else fixes.push("Mass reduction on the top stage alone cannot close the gap; add propellant or stages.");
    if (topEngines.length && bestIsp && topEngines.every((e) => e.engine.ispVac < bestIsp.engine.ispVac))
      fixes.push(`Use a more efficient upper-stage engine: ${bestIsp.name} (${bestIsp.engine.ispVac} s vacuum) vs your ${topEngines[0].name} (${topEngines[0].engine.ispVac} s); it needs hydrolox tanks.`);
    fixes.push("Add fuel capacity (a larger tank in the upper stage gives the most Δv per tonne), then recalculate.");
    items.push({
      id: "adv-dv",
      severity: prop.status,
      ref: "propulsion",
      title: "Your spacecraft does not have enough propulsion capability to complete the selected mission.",
      problems: [`Available Δv ${fmt(v.available)} m/s vs ${fmt(v.target)} m/s needed (${fmt(v.required)} + reserve) — short by ${fmt(v.gap)} m/s.`],
      fixes,
    });
  }
  const twr = byId.twr;
  if (twr && twr.values.thrust <= 0) {
    items.push({ id: "adv-twr", severity: "fail", ref: "twr", title: "No engine can produce thrust at liftoff.", problems: ["Liftoff thrust is 0 kN — Stage 1 has no working engine."], fixes: ["Add fuel tanks and an engine at the bottom of the stack (e.g. Kerolox Tank Long + K-9 Cluster), or radial solid boosters."] });
  } else if (twr && twr.status !== "pass") {
    const need = 1.2 * twr.values.weight - twr.values.thrust;
    const srb = PARTS.srb_63;
    const srbPair = 2 * engineSL(srb.engine);
    items.push({
      id: "adv-twr",
      severity: twr.status,
      ref: "twr",
      title: twr.status === "fail" ? "The vehicle is too heavy to leave the launch pad." : "Liftoff thrust is marginal — gravity losses will be high.",
      problems: [`Liftoff thrust-to-weight ${fmt(twr.values.twr, 2)} (minimum 1.2): need ${fmt(need / 1000)} kN more sea-level thrust.`],
      fixes: [
        `Add radial boosters: 2× ${srb.name} add ${fmt(srbPair / 1000)} kN at sea level (+${fmt((2 * (srb.dryMass + srb.propellant.mass)) / 1000, 1)} t).`,
        `Or reduce liftoff mass by ${fmt((twr.values.mass - twr.values.thrust / (1.2 * G0)) / 1000, 1)} t.`,
        "Or use a higher-thrust first-stage engine (e.g. K-9 Cluster).",
      ],
    });
  }
  const up = byId.upper_twr;
  if (up && up.status !== "pass")
    items.push({ id: "adv-up", severity: up.status, ref: "upper_twr", title: "An upper stage has very low thrust for its mass.", problems: [up.summary], fixes: ["Add a second upper-stage engine or choose a higher-thrust vacuum engine (e.g. K-1V, 981 kN).", "Or reduce upper-stage propellant/payload mass."] });
  const feed = byId.feed;
  if (feed && feed.status !== "pass")
    items.push({ id: "adv-feed", severity: "fail", ref: "feed", title: "An engine cannot be fed.", problems: [feed.summary], fixes: ["Add a tank of the matching propellant to the same stage (between the engine and the decoupler above it)."] });
  const mass = byId.mass;
  if (mass && mass.status !== "pass")
    items.push({ id: "adv-mass", severity: "fail", ref: "mass", title: "Liftoff mass exceeds the pad limit.", problems: [mass.summary], fixes: ["Remove propellant or replace heavy parts; check the Δv margin afterwards."] });
  const cost = byId.cost;
  if (cost && cost.status !== "pass") {
    const top = [...design.stack.map((n) => PARTS[n.partId]), ...(design.radials || []).flatMap((r) => Array(r.symmetry).fill(PARTS[r.partId]))]
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 3);
    items.push({ id: "adv-cost", severity: "fail", ref: "cost", title: "The design is over budget.", problems: [`Over budget by $${fmt(stats.cost - review.budget, 1)}M.`], fixes: [`Most expensive parts: ${top.map((p) => `${p.name} ($${p.cost}M)`).join(", ")}.`, "Kerolox tanks and engines are cheaper than hydrolox per tonne of propellant."] });
  }
  const ctl = byId.control;
  if (ctl && ctl.status !== "pass")
    items.push({ id: "adv-ctl", severity: "fail", ref: "control", title: "Nothing on board can fly the vehicle.", problems: [ctl.summary], fixes: ["Add a PC-1 Probe Core, a capsule or a payload with its own avionics."] });
  if (prop && prop.status === "pass" && prop.values.available > prop.values.target * 1.3)
    items.push({ id: "adv-excess", severity: "info", ref: "propulsion", title: "Large Δv surplus.", problems: [`${fmt(prop.values.available - prop.values.target)} m/s above the requirement + reserve.`], fixes: ["A smaller tank could cut cost and mass — the score rewards cost efficiency."] });
  return items;
}
