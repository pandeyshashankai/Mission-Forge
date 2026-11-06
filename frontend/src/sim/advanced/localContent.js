import { localData } from "../../persistence/localData";
const KEY = "mf.local-content";
const finite = (x, lo, hi) => Number.isFinite(x) && x >= lo && x <= hi;
const label = (x, max = 60) =>
  typeof x === "string" && x.length > 0 && x.length <= max;
const localId = (x) =>
  typeof x === "string" && /^local-[a-z0-9-]{1,40}$/.test(x);
export function readLocalContent() {
  try {
    const raw = localData.getItem(KEY);
    if (raw && raw.length > 250000)
      return { version: 1, bodies: [], parts: [] };
    const data = raw ? JSON.parse(raw) : { version: 1, bodies: [], parts: [] };
    return data?.version === 1 &&
      Array.isArray(data.bodies) &&
      Array.isArray(data.parts)
      ? data
      : { version: 1, bodies: [], parts: [] };
  } catch {
    return { version: 1, bodies: [], parts: [] };
  }
}
export function validateLocalBodies(records, baseBodies) {
  if (!Array.isArray(records) || records.length > 12)
    throw Error("Use at most twelve local bodies.");
  const byId = { ...baseBodies },
    seen = new Set();
  const sorted = [
    ...records.filter((b) => b?.parent === "sun"),
    ...records.filter((b) => b?.parent !== "sun"),
  ];
  return sorted.map((b) => {
    if (
      !localId(b?.id) ||
      seen.has(b.id) ||
      baseBodies[b.id] ||
      !label(b.name) ||
      !/^#[0-9a-f]{6}$/i.test(b.color || "") ||
      !finite(b.radius, 100, 1e9) ||
      !finite(b.mu, 1e6, 1e23) ||
      !finite(Math.abs(b.rotation), 60, 1e10) ||
      !finite(b.a, 1e5, 1e14) ||
      !finite(b.e, 0, 0.9) ||
      ![b.inc, b.node, b.peri, b.L].every((x) => finite(x, -360, 360))
    )
      throw Error("Invalid body ID, name, geometry, mass or orbit.");
    const parent = byId[b.parent];
    if (
      !parent ||
      (parent.id !== "sun" && parent.parent !== "sun") ||
      b.mu >= parent.mu * 0.1 ||
      b.a * (1 - b.e) <= parent.radius + b.radius
    )
      throw Error(
        "Body needs a supported parent, smaller mass and a non-intersecting orbit.",
      );
    if (b.parent !== "sun") {
      const parentSoi = parent.a * (parent.mu / byId.sun.mu) ** 0.4;
      if (b.a * (1 + b.e) > parentSoi * 0.8)
        throw Error(
          "Moon orbit must fit within its parent sphere of influence.",
        );
    }
    if (b.a * (b.mu / parent.mu) ** 0.4 < b.radius + 30000)
      throw Error(
        "Body sphere of influence is too small for safe exploration.",
      );
    seen.add(b.id);
    const body = {
      id: b.id,
      name: b.name,
      parent: b.parent,
      radius: b.radius,
      mu: b.mu,
      rotation: b.rotation,
      a: b.a,
      e: b.e,
      inc: b.inc,
      node: b.node,
      peri: b.peri,
      L: b.L,
      color: b.color,
      description:
        "Locally authored world · model inputs, not NASA measurements.",
      custom: true,
    };
    byId[b.id] = body;
    return body;
  });
}
export function validateLocalParts(records) {
  if (!Array.isArray(records) || records.length > 20)
    throw Error("Use at most twenty local parts.");
  const ids = new Set();
  return records.map((p) => {
    if (
      !localId(p?.id) ||
      ids.has(p.id) ||
      !label(p.name) ||
      !["tank", "engine", "payload", "structure"].includes(p.category) ||
      !finite(p.dryMass, 1, 1e6) ||
      !finite(p.cost, 0, 1000) ||
      !finite(p.diameter, 0.2, 20) ||
      !finite(p.height, 0.1, 100)
    )
      throw Error("Invalid local part dimensions or identity.");
    ids.add(p.id);
    const base = {
      id: p.id,
      name: p.name,
      category: p.category,
      dryMass: p.dryMass,
      cost: p.cost,
      diameter: p.diameter,
      height: p.height,
      source: "Locally authored model; not verified hardware",
      custom: true,
    };
    if (p.category === "tank") {
      if (
        !["kerolox", "hydrolox", "methalox", "hypergolic"].includes(
          p.propellant?.type,
        ) ||
        !finite(p.propellant?.mass, 1, 2e6)
      )
        throw Error("Invalid tank propellant.");
      return {
        ...base,
        look: "tank_white",
        propellant: { type: p.propellant.type, mass: p.propellant.mass },
      };
    }
    if (p.category === "engine") {
      const e = p.engine;
      if (
        !e ||
        !["kerolox", "hydrolox", "methalox", "hypergolic"].includes(
          e.propellant,
        ) ||
        !finite(e.thrustVac, 100, 1e8) ||
        !finite(e.ispVac, 50, 1000) ||
        !finite(e.ispSL, 1, e.ispVac) ||
        !finite(e.minThrottle, 0, 1)
      )
        throw Error("Invalid engine model.");
      return {
        ...base,
        look: "engine",
        engine: {
          propellant: e.propellant,
          thrustVac: e.thrustVac,
          ispVac: e.ispVac,
          ispSL: e.ispSL,
          minThrottle: e.minThrottle,
          gimbal: 3,
        },
      };
    }
    return { ...base, look: p.category === "payload" ? "satellite" : "pallet" };
  });
}
export function writeLocalContent(data) {
  localData.setItem(KEY, JSON.stringify(data));
}
export function validateLocalMissions(records = []) {
  if (!Array.isArray(records) || records.length > 8)
    throw Error("Use at most eight local missions.");
  const ids = new Set();
  return records.map((m) => {
    if (
      !localId(m?.id) ||
      ids.has(m.id) ||
      !label(m.name) ||
      !finite(m.altitude, 160000, 1000000) ||
      !finite(m.inclination, 28.6, 151.4) ||
      !finite(m.budget, 20, 1000)
    )
      throw Error(
        "Custom Earth missions need 160–1000 km altitude, Cape-reachable inclination 28.6–151.4°, and a valid budget.",
      );
    ids.add(m.id);
    return {
      id: m.id,
      name: m.name,
      altitude: m.altitude,
      inclination: m.inclination,
      budget: m.budget,
    };
  });
}
