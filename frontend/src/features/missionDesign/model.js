// Educational mission trade studies, separate from the campaign's flight dynamics.
export const SOURCES = [
  { name: 'NASA CubeSat 101', url: 'https://www.nasa.gov/wp-content/uploads/2017/03/nasa_csli_cubesat_101_508.pdf', use: 'Mission lifecycle, payload, power, communications and ground operations.' },
  { name: 'NASA Systems Engineering Handbook', url: 'https://www.nasa.gov/reference/systems-engineering-handbook/', use: 'Requirements, verification and comparing engineering alternatives.' },
  { name: 'JPL Solar System Dynamics: physical parameters', url: 'https://ssd.jpl.nasa.gov/astro_par.html', use: 'Rounded body radii and gravitational parameters for circular orbit periods.' },
  { name: 'NASA Sun facts', url: 'https://science.nasa.gov/sun/facts/', use: 'Sunlight falls with the square of distance; solar power scales as 1 / distance².' },
];
export const TARGETS = {
  earth: { name: 'Earth', radius: 6371, mu: 398600.44, au: 1, delivery: 1, link: 1, objective: 'Return visible images of Earth', instrument: 'camera', required: 80 },
  moon: { name: 'Moon', radius: 1737.4, mu: 4902.8, au: 1, delivery: 0.55, link: 0.55, objective: 'Map lunar geology with spectral observations', instrument: 'spectrometer', required: 65 },
  mars: { name: 'Mars', radius: 3389.5, mu: 42828.4, au: 1.524, delivery: 0.3, link: 0.22, objective: 'Return a detailed Mars surface image survey', instrument: 'hires', required: 45 },
};
// Mass kg, electrical power W, battery Wh, storage MB, rate MB/min, cost in fictional credits.
// Every hardware figure below is a game design assumption, not a NASA product specification.
export const CATALOG = {
  instrument: {
    camera: { name: 'Survey camera', mass: 4, cost: 15, watts: 12, rate: 3, science: 1 },
    hires: { name: 'High-resolution camera', mass: 12, cost: 35, watts: 40, rate: 10, science: 1.8 },
    spectrometer: { name: 'Spectrometer', mass: 8, cost: 25, watts: 25, rate: 5, science: 1.5 },
  },
  panel: { compact: { name: 'Compact array', mass: 5, cost: 12, watts: 55 }, large: { name: 'Large array', mass: 12, cost: 25, watts: 150 } },
  battery: { small: { name: 'Small battery', mass: 4, cost: 8, wh: 50 }, large: { name: 'Large battery', mass: 10, cost: 18, wh: 220 } },
  antenna: { basic: { name: 'Basic radio', mass: 3, cost: 8, watts: 15, rate: 8 }, dish: { name: 'Directional dish', mass: 9, cost: 22, watts: 35, rate: 40 } },
  storage: { small: { name: 'Small recorder', mass: 1, cost: 4, mb: 100 }, large: { name: 'Large recorder', mass: 3, cost: 10, mb: 1000 } },
  launcher: { light: { name: 'Light launcher', mass: 0, cost: 25, capacity: 70, maxAltitude: 600 }, medium: { name: 'Medium launcher', mass: 0, cost: 45, capacity: 150, maxAltitude: 1500 }, heavy: { name: 'Heavy launcher', mass: 0, cost: 70, capacity: 300, maxAltitude: 3000 } },
};
export const ORBITS = {
  low: { name: 'Low circular orbit', altitude: 250, contact: 0.08, coverage: 0.7, detail: 1.2 },
  survey: { name: 'Survey circular orbit', altitude: 550, contact: 0.15, coverage: 1, detail: 1 },
  high: { name: 'High circular orbit', altitude: 1200, contact: 0.25, coverage: 1.15, detail: 0.65 },
};
export const ROLES = ['Science lead', 'Spacecraft engineer', 'Communications lead', 'Budget manager'];
export const DEFAULT_DESIGN = { version: 1, name: 'My Earth survey', target: 'earth', orbit: 'survey', days: 1, budget: 180, instrument: 'camera', panel: 'compact', battery: 'small', antenna: 'basic', storage: 'small', launcher: 'light' };
export function validateDesign(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d) || d.version !== 1 || typeof d.name !== 'string' || !d.name.trim() || d.name.length > 80 || !Object.hasOwn(TARGETS, d.target) || !Object.hasOwn(ORBITS, d.orbit)) throw Error('Unsupported mission design');
  const keys = new Set(Object.keys(DEFAULT_DESIGN));
  if (Object.keys(d).some(k => !keys.has(k))) throw Error('Unknown mission design field');
  for (const [key, options] of Object.entries(CATALOG)) if (!Object.hasOwn(options, d[key])) throw Error('Unknown ' + key);
  if (!Number.isInteger(d.days) || d.days < 1 || d.days > 30 || !Number.isFinite(d.budget) || d.budget < 50 || d.budget > 500) throw Error('Duration must be 1–30 days and budget 50–500 credits');
  return { ...d };
}
export function designStats(input) {
  const d = validateDesign(input), t = TARGETS[d.target], o = ORBITS[d.orbit];
  const parts = Object.fromEntries(Object.entries(CATALOG).map(([k, list]) => [k, list[d[k]]]));
  const mass = 18 + Object.values(parts).reduce((n, p) => n + p.mass, 0);
  const cost = 15 + Object.values(parts).reduce((n, p) => n + p.cost, 0) + d.days * 0.5;
  const period = 2 * Math.PI * Math.sqrt((t.radius + o.altitude) ** 3 / t.mu) / 60;
  const eclipse = Math.asin(t.radius / (t.radius + o.altitude)) / Math.PI;
  const solar = parts.panel.watts / t.au ** 2;
  const capacity = parts.launcher.capacity * t.delivery * Math.max(0.4, 1 - o.altitude / 5000);
  const issues = [];
  if (cost > d.budget) issues.push('Cost exceeds the mission budget. Reduce equipment cost, duration, or increase the budget.');
  if (mass > capacity) issues.push('Spacecraft mass exceeds the launcher’s modeled delivery capacity for this target and altitude.');
  if (o.altitude > parts.launcher.maxAltitude) issues.push('Selected orbit exceeds this launcher’s modeled altitude capability.');
  const warnings = [];
  if (solar * (1 - eclipse) < 10 + parts.instrument.watts) warnings.push('Average solar generation cannot sustain continuous observation; expect power interruptions.');
  if (parts.battery.wh < 10 * period * eclipse / 60) warnings.push('Battery cannot cover even the baseline eclipse load from full charge.');
  if (d.instrument !== t.instrument) warnings.push('This instrument does not match the primary science objective; its observations earn 20% of the objective value.');
  if (parts.antenna.rate * t.link * o.contact < parts.instrument.rate * (1 - eclipse - o.contact)) warnings.push('Data production can exceed average downlink; consider a better radio or more contact time.');
  return { ...parts, mass, cost, period, eclipse, solar, capacity, issues, warnings, target: t, orbit: o };
}
export function startMission(d) {
  const s = designStats(d);
  if (s.issues.length) throw Error(s.issues.join(' '));
  return { minute: 0, battery: s.battery.wh, stored: 0, generated: 0, returned: 0, science: 0, lost: 0, powerMinutes: 0, observedMinutes: 0, contactMinutes: 0, history: [], done: false };
}
export function stepMission(d, previous, minutes = 60) {
  const s = designStats(d), state = { ...previous, history: [...previous.history] };
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 43200) throw Error('Invalid simulation interval');
  const end = Math.min(d.days * 1440, state.minute + minutes);
  for (; state.minute < end; state.minute++) {
    const phase = (state.minute % s.period) / s.period;
    const daylight = phase >= s.eclipse;
    const contact = phase >= 1 - s.orbit.contact;
    // One-minute energy accounting. Observation/downlink share the pointing system.
    // Illustrative 0.2%/day panel degradation makes duration a design consideration.
    const generation = daylight ? s.solar * (1 - 0.002 * state.minute / 1440) : 0;
    const available = state.battery * 60 + generation;
    let load = Math.min(10, available);
    const task = contact ? s.antenna : s.instrument;
    const canWork = available >= 10 + task.watts && (contact || daylight);
    if (canWork) {
      load += task.watts;
      if (contact) {
        const sent = Math.min(state.stored, s.antenna.rate * s.target.link);
        state.stored -= sent; state.returned += sent; state.contactMinutes++;
        const match = d.instrument === s.target.instrument ? 1 : 0.2;
        state.science += sent * s.instrument.science * s.orbit.coverage * s.orbit.detail * match / 10;
      } else {
        state.generated += s.instrument.rate;
        const accepted = Math.min(s.instrument.rate, s.storage.mb - state.stored);
        state.stored += accepted; state.lost += s.instrument.rate - accepted; state.observedMinutes++;
      }
    } else if (available < 10 + task.watts) state.powerMinutes++;
    state.battery = Math.max(0, Math.min(s.battery.wh, state.battery + (generation - load) / 60));
    if ((state.minute + 1) % 60 === 0) state.history.push({ minute: state.minute + 1, battery: state.battery, stored: state.stored, science: state.science });
  }
  state.done = state.minute >= d.days * 1440;
  return state;
}
export function runMission(d) { return stepMission(d, startMission(d), d.days * 1440); }
export function missionReport(d, state) {
  const s = designStats(d), success = state.done && state.science >= s.target.required;
  return {
    version: 1, design: validateDesign(d), complete: state.done, success,
    score: Math.round(Math.min(80, state.science / s.target.required * 80) + (success ? 20 * Math.max(0, 1 - s.cost / d.budget) : 0)),
    science: state.science, returned: state.returned, generated: state.generated, lost: state.lost, cost: s.cost, mass: s.mass,
    explanations: [
      `${s.target.objective}: ${state.science.toFixed(1)} of ${s.target.required} science points ${state.done ? 'returned' : 'so far'}. Only downlinked observations count.`,
      `${s.instrument.name} ${d.instrument === s.target.instrument ? 'matches' : 'does not match'} the objective. Instrument fit, orbit coverage and resolution determine the value of each returned MB.`,
      `${state.powerMinutes} minutes had insufficient power for the scheduled task. ${s.panel.name} supplies ${s.solar.toFixed(1)} W in sunlight here; eclipses cover ${(s.eclipse * 100).toFixed(0)}% of each orbit.`,
      `${state.lost.toFixed(1)} MB overflowed the recorder; ${state.stored.toFixed(1)} MB remained onboard. ${s.antenna.name} returns ${(s.antenna.rate * s.target.link).toFixed(1)} MB/min during modeled contacts.`,
      `${s.orbit.name} trades observation detail against coverage and contact time. The launcher delivered ${s.mass.toFixed(1)} kg within a ${s.capacity.toFixed(1)} kg modeled limit.`,
      `${s.cost.toFixed(1)} of ${d.budget} credits used, including operations for ${d.days} days. Longer missions cost more and their modeled solar output gradually declines.`,
    ],
    assumptions: 'Educational circular-orbit operations model, not mission certification. Fictional equipment, credits, delivery factors, contact schedules, science scores and degradation. Fixed mean solar distances; cylindrical zero-beta eclipses; no transfer flight, weather, detailed link budget, terrain occultation or orbit decay. Launch/arrival is an eligibility check, not the campaign flight simulator.',
  };
}
export function encodeDesign(d) { return encodeURIComponent(JSON.stringify(validateDesign(d))); }
export function decodeDesign(value) {
  if (typeof value !== 'string' || value.length > 6000) throw Error('Mission link is too large');
  return validateDesign(JSON.parse(decodeURIComponent(value)));
}
