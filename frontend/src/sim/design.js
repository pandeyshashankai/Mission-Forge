import {assemblyConnections,contactReachable} from './assemblyConnections';
import {layoutDesign} from "./assemblyLayout";
import { PARTS, engineSL } from "./parts";
import { G0, LAUNCH_OPS_COST } from "./constants";

export const newUid = () => Math.random().toString(36).slice(2, 10);

export function buildSections(design) {
  const connections=assemblyConnections(design);
  const top = [];
  let cur = [];
  for (const n of design.stack.filter(n => !n.mount)) {
    if (PARTS[n.partId].decoupler && cur.length) {
      top.push(cur);
      cur = [];
    }
    cur.push(n);
  }
  if (cur.length) top.push(cur);
  const ordered = top.reverse();
  let pending = design.stack.filter(n => n.mount);
  while (pending.length) {
    let progress = false;
    pending = pending.filter(n => {
      const section = ordered.find(parts => parts.some(p => p.uid === n.mount.parentUid));
      if (!section) return true;
      section.push(n); progress = true; return false;
    });
    if (!progress) throw Error('Unconnected or cyclic side assembly');
  }
  return ordered.map((parts, index) => {
    const uids = new Set(parts.map((p) => p.uid));
    const tanks = {};
    const engines = [];
    let dryMass = 0;
    let cost = 0;
    let maxD = 0;
    const fairings = [];
    for (const n of parts) {
      const p = PARTS[n.partId];
      cost += p.cost;
      maxD = Math.max(maxD, p.diameter);
      if (p.fairing) fairings.push({ uid: n.uid, mass: p.dryMass, diameter: p.diameter });
      else dryMass += p.dryMass;
      if (p.propellant) {
        if(connections.connected.has(n.uid))tanks[p.propellant.type] = (tanks[p.propellant.type] || 0) + p.propellant.mass;
        else dryMass+=p.propellant.mass;
      }
      if (p.engine) {
        const feed=contactReachable(connections.neighbors,n.uid,uids);
        const connected=connections.connected.has(n.uid)&&parts.some(t=>feed.has(t.uid)&&connections.connected.has(t.uid)&&PARTS[t.partId].propellant?.type===p.engine.propellant);
        engines.push({ uid: n.uid, partId: n.partId, rotation:n.rotation || 0, connected });
      }
    }
    const radials = (design.radials || []).filter((r) => uids.has(r.parentUid));
    return { index, parts, uids, tanks, engines, dryMass, cost, maxD, fairings, radials };
  });
}

export function defaultEvents(sections) {
  if(!sections.length)return [];
  const fairings = sections.flatMap((s) => s.fairings.map((f) => `fair-${f.uid}`));
  const ev = ["ignite-0"];
  sections.forEach((s, i) => {
    if (i > 0) ev.push(`sep-${i}`);
    if (i === 1) ev.push(...fairings);
    s.radials.forEach((r) => ev.push(`rad-${r.uid}`));
  });
  if (sections.length === 1) ev.push(...fairings);
  return ev;
}

export function validEventOrder(order) {
  if (order[0] !== "ignite-0") return false;
  const seps = order.filter((e) => e.startsWith("sep-")).map((e) => +e.slice(4));
  return seps.every((v, i) => i === 0 || v > seps[i - 1]);
}

export function getEvents(design, sections = buildSections(design)) {
  const def = defaultEvents(sections);
  const saved = design.events;
  if (saved && saved.length === def.length && def.every((d) => saved.includes(d)) && validEventOrder(saved)) return saved;
  return def;
}

export function describeEvent(id, sections) {
  if (id === "ignite-0") return { label: "Ignite Stage 1 & liftoff", kind: "ignite" };
  if (id.startsWith("sep-")) {
    const k = +id.slice(4);
    return { label: `Separate Stage ${k} · ignite Stage ${k + 1}`, kind: "sep" };
  }
  if (id.startsWith("rad-")) {
    const uid = id.slice(4);
    const r = sections.flatMap((s) => s.radials).find((x) => x.uid === uid);
    return { label: `Jettison ${r ? `${r.symmetry}× ${PARTS[r.partId].name}` : "radial group"}`, kind: "rad" };
  }
  return { label: "Jettison payload fairing", kind: "fair" };
}

export function createRuntime(design) {
  const sections = buildSections(design);
  const connections=assemblyConnections(design);
  const placed = design.stack.some(n=>n.mount) ? layoutDesign(design).items : [];
  return {
    events: getEvents(design, sections),
    eventIndex: 0,
    sections: sections.map((s) => ({
      index: s.index,
      legs:s.parts.filter(n=>PARTS[n.partId].landingLeg && n.deployed).length,
      ...(placed.length ? {placedDisks:placed.filter(n=>s.uids.has(n.uid)&&design.stack.find(p=>p.uid===n.uid)?.mount).map(n=>({x:n.x||0,z:n.z||0,d:PARTS[n.partId].diameter}))} : {}),
      dryMass: s.dryMass,
      maxD: s.maxD,
      tanks: { ...s.tanks },
      tanksFull: { ...s.tanks },
      engines: s.engines.map((e) => ({ ...e, def: {...PARTS[e.partId].engine,rotation:e.rotation || 0} })),
      fairings: s.fairings.map((f) => ({ ...f, attached: true })),
      attached: true,
      ignited: false,
    })),
    radials: sections.flatMap((s) =>
      s.radials.map((r) => {
        const p = PARTS[r.partId];
        const fuel = (p.propellant ? p.propellant.mass : 0) * r.symmetry;
        return { connected:connections.connected.has(r.parentUid), uid: r.uid, section: s.index, partId: r.partId, n: r.symmetry, dryEach: p.dryMass, diameter: p.diameter, fuel, fuelFull: fuel, def: p.engine, attached: true, ignited: false };
      })
    ),
  };
}

export const cloneRuntime = (rt) => JSON.parse(JSON.stringify(rt));

export function runtimeMass(rt) {
  let m = 0;
  for (const s of rt.sections) {
    if (!s.attached) continue;
    m += s.dryMass;
    for (const k in s.tanks) m += s.tanks[k];
    for (const f of s.fairings) if (f.attached) m += f.mass;
  }
  for (const r of rt.radials) if (r.attached) m += r.dryEach * r.n + r.fuel;
  return m;
}

export function frontalArea(rt) {
  let d = 0;
  let extra = 0;
  for (const s of rt.sections) if (s.attached) d = Math.max(d, s.maxD);
  for (const r of rt.radials) if (r.attached) extra += r.n * Math.PI * (r.diameter / 2) ** 2;
  const disks = new Map();
  for(const s of rt.sections)if(s.attached)for(const disk of s.placedDisks || []) {
    if(Math.hypot(disk.x,disk.z)+disk.d/2<=d/2)continue;
    const key=disk.x+','+disk.z;
    disks.set(key,Math.max(disks.get(key)||0,disk.d));
  }
  for(const diameter of disks.values())extra+=Math.PI*(diameter/2)**2;
  return Math.PI * (d / 2) ** 2 + extra;
}

const ispAt = (def, pRatio) => Math.max(1, def.ispVac - (def.ispVac - def.ispSL) * pRatio);

// Engines that are ignited, attached and have propellant. Each entry = one fuel source.
export function activeSources(rt) {
  const out = [];
  for (const s of rt.sections) {
    if (!s.attached || !s.ignited) continue;
    const byProp = {};
    for (const e of s.engines.filter(e=>e.connected!==false)) (byProp[e.def.propellant] = byProp[e.def.propellant] || []).push(e.def);
    for (const prop in byProp) {
      if ((s.tanks[prop] || 0) <= 0) continue;
      out.push({ kind: "section", s: s.index, prop, defs: byProp[prop], solid: false });
    }
  }
  for (const r of rt.radials) {
    if (r.connected!==false && r.attached && r.ignited && r.fuel > 0) out.push({ kind: "radial", uid: r.uid, defs: Array(r.n).fill(r.def), solid: true });
  }
  return out;
}

const sourceFuel = (rt, src) =>
  src.kind === "section" ? rt.sections[src.s].tanks[src.prop] : rt.radials.find((r) => r.uid === src.uid).fuel;

function burnSource(rt, src, dm) {
  if (src.kind === "section") {
    const t = rt.sections[src.s].tanks;
    t[src.prop] = Math.max(0, t[src.prop] - dm);
  } else {
    const r = rt.radials.find((x) => x.uid === src.uid);
    r.fuel = Math.max(0, r.fuel - dm);
  }
}

export const effThrottle = (def, cmd) => (def.solid ? 1 : cmd <= 0 ? 0 : Math.max(cmd, def.minThrottle));

// Thrust (N) and per-source mass flow at a throttle command and ambient pressure ratio p/p0.
export function thrustState(rt, throttle, pRatio) {
  let F = 0;
  let Fmax = 0;
  let fx=0,fy=0,mx=0,my=0,directional=false;
  const flows = [];
  for (const src of activeSources(rt)) {
    let mdot = 0;
    for (const d of src.defs) {
      const md = d.thrustVac / (G0 * d.ispVac);
      const th = effThrottle(d, throttle);
      mdot += md * th;
      const f=md*th*G0*ispAt(d,pRatio),fm=md*G0*ispAt(d,pRatio),a=(d.rotation||0)*Math.PI/180;
      F+=f;Fmax+=fm;fx-=Math.sin(a)*f;fy+=Math.cos(a)*f;mx-=Math.sin(a)*fm;my+=Math.cos(a)*fm;
      directional ||= !!d.rotation;
    }
    flows.push({ src, mdot });
  }
  return { F:directional?Math.hypot(fx,fy):F, Fmax:directional?Math.hypot(mx,my):Fmax, flows, axial:directional?fy:F, forceBody:[fx,fy,0], directional };
}

export function consume(rt, flows, dt) {
  for (const f of flows) burnSource(rt, f.src, f.mdot * dt);
}

export function applyEvent(rt, id) {
  if (id === "ignite-0") {
    if(rt.sections[0])rt.sections[0].ignited = true;
    rt.radials.filter((r) => r.section === 0).forEach((r) => (r.ignited = true));
  } else if (id.startsWith("sep-")) {
    const k = +id.slice(4);
    rt.sections.forEach((s) => {
      if (s.index < k) s.attached = false;
    });
    rt.radials.forEach((r) => {
      if (r.section < k) r.attached = false;
    });
    if (rt.sections[k]) rt.sections[k].ignited = true;
    rt.radials.filter((r) => r.section === k).forEach((r) => (r.ignited = true));
  } else if (id.startsWith("rad-")) {
    const r = rt.radials.find((x) => x.uid === id.slice(4));
    if (r) r.attached = false;
  } else if (id.startsWith("fair-")) {
    rt.sections.forEach((s) => s.fairings.forEach((f) => f.uid === id.slice(5) && (f.attached = false)));
  }
}

// Sources an event would drop (used for "burn until depletion" staging logic).
export function dropsOf(rt, id) {
  if (id.startsWith("sep-")) {
    const k = +id.slice(4);
    return activeSources(rt).filter((s) => (s.kind === "section" ? s.s < k : rt.radials.find((r) => r.uid === s.uid).section < k));
  }
  if (id.startsWith("rad-")) return activeSources(rt).filter((s) => s.kind === "radial" && s.uid === id.slice(4));
  return [];
}

export function nextEventReady(rt) {
  const id = rt.events[rt.eventIndex];
  if (!id) return false;
  return dropsOf(rt, id).length === 0;
}

// Burn-to-depletion delta-v from a runtime state onward (vacuum unless padAvg for atmospheric phases).
export function deltaVFromRuntime(rtIn, { applyFirst = false, padAvg = false } = {}) {
  const rt = cloneRuntime(rtIn);
  const phases = [];
  let total = 0;
  let totalVac = 0;
  const startIndex = rt.eventIndex;
  const burn = (label, eventId) => {
    const atmospheric = padAvg && rt.sections[0].attached;
    const burning = activeSources(rt).map((src) => (src.kind === "section" ? `Stage ${src.s + 1}` : `${src.defs.length}× booster`)).join(" + ");
    const m0 = runtimeMass(rt);
    const ts0 = thrustState(rt, 1, 0);
    const tsSL = thrustState(rt, 1, 1);
    let dv = 0;
    let dvVac = 0;
    let time = 0;
    let isp0 = 0;
    for (let guard = 0; guard < 50; guard++) {
      const nextId = rt.events[rt.eventIndex];
      if (nextId && dropsOf(rt, nextId).length === 0) break;
      const ts = thrustState(rt, 1, 0);
      if (!ts.flows.length) break;
      let dtMin = Infinity;
      for (const f of ts.flows) dtMin = Math.min(dtMin, sourceFuel(rt, f.src) / f.mdot);
      const mdot = ts.flows.reduce((a, f) => a + f.mdot, 0);
      const ma = runtimeMass(rt);
      consume(rt, ts.flows, dtMin);
      const mb = runtimeMass(rt);
      const ispVac = ts.F / (mdot * G0);
      const ispSL = thrustState(rt, 1, 1).F / (mdot * G0) || ispVac;
      const isp = atmospheric ? (ispVac + ispSL) / 2 : ispVac;
      if (!isp0) isp0 = isp;
      dvVac += ispVac * G0 * Math.log(ma / mb);
      dv += isp * G0 * Math.log(ma / mb);
      time += dtMin;
    }
    if (time > 0) {
      phases.push({ eventId, label, burning, dv, dvVac, burnTime: time, m0, m1: runtimeMass(rt), isp: isp0, twrVac: ts0.F / (m0 * G0), twrSL: tsSL.F / (m0 * G0), atmospheric });
      total += dv;
      totalVac += dvVac;
    }
  };
  if (!applyFirst) burn("Current stage", rt.events[startIndex - 1] || "current");
  while (rt.eventIndex < rt.events.length) {
    const id = rt.events[rt.eventIndex];
    applyEvent(rt, id);
    rt.eventIndex++;
    burn(id, id);
  }
  return { total, totalVac, phases };
}

export function designStats(design) {
  const sections = buildSections(design);
  const rt = createRuntime(design);
  const mass = runtimeMass(rt);
  let cost = sections.reduce((a, s) => a + s.cost, 0);
  for (const s of sections) for (const r of s.radials) cost += PARTS[r.partId].cost * r.symmetry;
  const dv = deltaVFromRuntime(rt, { applyFirst: true, padAvg: true });
  const rt0 = cloneRuntime(rt);
  applyEvent(rt0, "ignite-0");
  const liftoff = thrustState(rt0, 1, 1);
  const dryAll = mass - sections.reduce((a, s) => a + Object.values(s.tanks).reduce((x, y) => x + y, 0), 0) - rt.radials.reduce((a, r) => a + r.fuel, 0);
  const hasControl = design.stack.some((n) => PARTS[n.partId].control);
  const crew = design.stack.reduce((a, n) => a + (PARTS[n.partId].crew || 0), 0);
  return {
    sections,
    events: rt.events,
    mass,
    dryMass: dryAll,
    partsCost: cost,
    launchOpsCost: LAUNCH_OPS_COST,
    cost: cost + LAUNCH_OPS_COST,
    dv,
    liftoffThrustSL: liftoff.axial,
    liftoffTWR: liftoff.axial / Math.max(1,mass * G0),
    stageCount: sections.length,
    hasControl,
    crew,
    partCount: design.stack.length + (design.radials || []).reduce((a, r) => a + r.symmetry, 0),
  };
}

export function engineIssues(design) {
  const issues = [];
  for (const s of buildSections(design)) {
    for (const e of s.engines) {
      const p = PARTS[e.partId];
      if (!p.engine.solid && (e.connected===false || !(s.tanks[p.engine.propellant] > 0)))
        issues.push({ section: s.index, engine: p.name, propellant: p.engine.propellant });
    }
  }
  return issues;
}

export { engineSL };
