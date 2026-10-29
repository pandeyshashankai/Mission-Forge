import { PARTS } from "./parts";

// Consumption per crew member per day (NASA Baseline Values & Assumptions Document, no recycling).
export const RATES = { o2: 0.84, water: 2.5, food: 1.8 };
export const RATE_SOURCE = "NASA BVAD (NASA/TP-2015-218570): O2 0.84, water 2.5 (drink + food prep), food 1.8 kg per crew-day";
const NAMES = { o2: "Oxygen", water: "Water", food: "Food" };
const SURVIVE = { water: 3 * 86400, food: 20 * 86400 };

export function attachedNodes(sim) {
  const out = [];
  sim.rt.sections.forEach((s, i) => s.attached && out.push(...sim.sections[i].parts));
  return out;
}

export function initLifeSupport(design) {
  const stores = {};
  for (const n of design.stack) {
    const ls = PARTS[n.partId].lifeSupport;
    if (ls) stores[n.uid] = { ...ls };
  }
  return { stores, outAt: {} };
}

export const crewOf = (nodes) => nodes.reduce((a, n) => a + (PARTS[n.partId].crew || 0), 0);

export function consumablesOf(nodes, stores) {
  const tot = { o2: 0, water: 0, food: 0 };
  for (const n of nodes) if (stores[n.uid]) for (const k in tot) tot[k] += stores[n.uid][k];
  return tot;
}

export function lifeSupportStatus(sim) {
  const nodes = attachedNodes(sim);
  const crew = crewOf(nodes);
  const tot = consumablesOf(nodes, sim.ls.stores);
  const days = {};
  for (const k in tot) days[k] = crew ? tot[k] / (RATES[k] * crew) : Infinity;
  return { crew, ...tot, days, daysLeft: Math.min(days.o2, days.water, days.food) };
}

export function lifeSupportStep(sim, dt) {
  const nodes = attachedNodes(sim);
  const crew = crewOf(nodes);
  if (!crew || sim.crewLost) return;
  const order = [...nodes.filter((n) => !PARTS[n.partId].crew), ...nodes.filter((n) => PARTS[n.partId].crew)];
  for (const k in RATES) {
    let need = (RATES[k] * crew * dt) / 86400;
    for (const n of order) {
      const st = sim.ls.stores[n.uid];
      if (!st || need <= 0) continue;
      const take = Math.min(need, st[k]);
      st[k] -= take;
      need -= take;
    }
    if (need > 1e-12 && sim.ls.outAt[k] == null) {
      sim.ls.outAt[k] = sim.t;
      sim.addLog("fail", `${NAMES[k]} supply exhausted`);
    }
  }
  const out = sim.ls.outAt;
  if (out.o2 != null) return sim.loseCrew("Crew lost — oxygen supply exhausted");
  for (const k of ["water", "food"]) if (out[k] != null && sim.t - out[k] > SURVIVE[k]) return sim.loseCrew(`Crew lost — no ${k} for ${SURVIVE[k] / 86400} days`);
}
