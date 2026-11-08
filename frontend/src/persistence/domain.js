import {validMounts} from "../sim/assemblyLayout";
import {hangarCraft} from '../sim/hangarCraft';
import { PART_LIST } from '../sim/parts';
import { BODIES } from '../sim/solarSystem';
import { MISSIONS } from '../sim/missions';
import { validateLocalBodies, validateLocalParts, validateLocalMissions, readLocalContent } from '../sim/advanced/localContent';
import { validateEntries } from './backup';
// Keep imported state from replacing methods on FlightSim / guidance objects.
const FLIGHT_FIELDS = new Set('t r v dir omega wheelH rt status clamped att cmd throttle attMode holdDir rcsEnabled autoStage log telemetry flameouts prematureStaging stagedAt maxQ maxApo maxAlt lastSample orbitAt lastAutoCkpt lastBurnEnergy stageDelay acc node wheelsSaturated rcsEmptyLogged sys region eph sunAU ls entry moonClosest lunarOrbitAt crewLost lossReason endReason input inputActive guidance maneuver'.split(' '));
const onlyKeys = (value, allowed) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(k => allowed.has(k));
export function validateArchive(entries) {
  validateEntries(entries);
  const map = new Map(entries),
    pack = map.has('mf.local-content') ? JSON.parse(map.get('mf.local-content')) : readLocalContent();
  if (pack?.version !== 1) throw Error('Unsupported local content schema');
  const bodies = validateLocalBodies(pack.bodies || [], Object.fromEntries(BODIES.filter(b => !b.custom).map(b => [b.id, b]))),
    parts = validateLocalParts(pack.parts || []),
    missions = validateLocalMissions(pack.missions || []);
  const partMap = new Map([...PART_LIST.filter(p => !p.custom), ...parts].map(p => [p.id, p])),
    missionIds = new Set([...MISSIONS.filter(m => !m.custom), ...missions].map(m => m.id)),
    bodyIds = new Set([...BODIES.filter(b => !b.custom), ...bodies].map(b => b.id));
  const craft = d => {
    if (!d || typeof d.name !== 'string' || d.name.length > 160 || !Array.isArray(d.stack) || (d.stack.length < 1 && d.editorDraft !== true) || d.stack.length > 512 || !Array.isArray(d.radials || []) || (d.radials || []).length > 128) throw Error('Invalid or oversized craft in backup');
    const ids = new Set();
    for (const n of [...d.stack, ...(d.radials || [])]) {
      if (!n || typeof n.uid !== 'string' || !n.uid || n.uid.length > 128 || ids.has(n.uid) || !partMap.has(n.partId)) throw Error('Invalid craft identifiers in backup');
      ids.add(n.uid);
    }
    if (!validMounts(d, id => partMap.get(id))) throw Error('Invalid placed assembly in backup');
    if (d.stack.some(n => partMap.get(n.partId).radialOnly)) throw Error('Radial-only part in axial stack');
    for (const n of d.radials || []) if (![2, 3, 4].includes(n.symmetry) || !partMap.get(n.partId).radialOnly || !d.stack.some(p => p.uid === n.parentUid)) throw Error('Invalid booster group in backup');
  };
  const vector = v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
  const checkpoint = c => {
    craft(c?.design);
    if (!missionIds.has(c.missionId) || !['amateur', 'intermediate', 'expert'].includes(c.difficulty) || !c.state?.rt || !vector(c.state.r) || !vector(c.state.v) || !Number.isFinite(c.state.t) || c.state.t < 0 || !Array.isArray(c.state.rt.sections) || c.state.rt.sections.length > 512) throw Error('Invalid campaign checkpoint');
    if (c.schemaVersion !== undefined && c.schemaVersion !== 1) throw Error('Unsupported checkpoint schema');
    if (!onlyKeys(c.state, FLIGHT_FIELDS) || !vector(c.state.dir) || !vector(c.state.omega) || !Array.isArray(c.state.log) || !Array.isArray(c.state.telemetry) || !Array.isArray(c.state.rt.radials) || !Array.isArray(c.state.rt.events) || !Number.isInteger(c.state.rt.eventIndex) || c.state.rt.eventIndex < 0 || c.state.rt.eventIndex > c.state.rt.events.length) throw Error('Invalid checkpoint runtime');
    if (c.state.guidance && !onlyKeys(c.state.guidance, new Set('p phase phaseT done frozenDir disengaged'.split(' ')))) throw Error('Unsupported guidance state');
    if (c.state.maneuver && !onlyKeys(c.state.maneuver, new Set('node dvVec dvTot burnTime tStart delivered phase done pulse failed'.split(' ')))) throw Error('Unsupported maneuver state');
    for (const section of c.state.rt.sections) {
      if (!Number.isInteger(section.index) || !Number.isFinite(section.dryMass) || section.dryMass < 0 || !Array.isArray(section.engines) || !Array.isArray(section.fairings) || !section.tanks || !section.tanksFull || Object.values(section.tanks).some(v => !Number.isFinite(v) || v < 0) || Object.values(section.tanksFull).some(v => !Number.isFinite(v) || v < 0) || section.engines.some(e => !partMap.get(e?.partId)?.engine || !e.def)) throw Error('Invalid stage runtime');
    }
  };
  const expedition = s => {
    if(s?.craftId === 'hangar'){craft(s.hangarDesign);const profile=hangarCraft(s.hangarDesign);if(s.fuel>profile.fuel||s.batteryWh>profile.power.batteryWh)throw Error('Hangar craft capacity exceeded');}
    if (s?.version !== 1 || !['pathfinder', 'voyager', 'lander', 'hangar'].includes(s.craftId) || !bodyIds.has(s.primary) || !vector(s.r) || !vector(s.v) || !Number.isFinite(s.t) || s.t < 0 || !Number.isFinite(s.fuel) || s.fuel < 0) throw Error('Invalid exploration state');
  };
  for (const [key, value] of entries) {
    const d = JSON.parse(value);
    if (key === 'mf.autosave') {
      craft(d?.design);
      if (!missionIds.has(d.missionId)) throw Error('Unknown autosaved mission');
    }
    if (key === 'mf.designs') {
      if (!Array.isArray(d) || d.length > 30) throw Error('Invalid craft library');
      d.forEach(craft);
    }
    if (key === 'mf.checkpoints') {
      if (!Array.isArray(d) || d.length > 16) throw Error('Invalid checkpoint library');
      d.forEach(checkpoint);
    }
    if (key === 'mf.recovery-flight') checkpoint(d);
    if (key === 'mf.exploration') expedition(d);
    if (key === 'mf.fleet-world') {
      if (d?.version !== 1 || !Array.isArray(d.entries) || d.entries.length < 1 || d.entries.length > 6 || !d.entries.some(e => e.id === d.activeId)) throw Error('Invalid fleet archive');
      const ids = new Set();
      for (const e of d.entries) {
        if (typeof e.id !== 'string' || !e.id || e.id.length > 100 || ids.has(e.id) || typeof e.name !== 'string' || e.name.length > 80) throw Error('Invalid fleet vessel');
        ids.add(e.id);
        expedition(e.state);
      }
      const used = new Set();
      if (!Array.isArray(d.links)) throw Error('Invalid fleet links');
      for (const l of d.links) {
        if (!Array.isArray(l) || l.length !== 2 || l[0] === l[1] || l[1] === d.activeId || l.some(id => !ids.has(id) || used.has(id))) throw Error('Invalid docking links');
        l.forEach(id => used.add(id));
      }
    }
  }
  return entries;
}
