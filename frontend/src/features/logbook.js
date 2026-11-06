import { BODIES } from "../sim/solarSystem";
export function readFlightLog(entries) {
  const flights = [];
  for (const [key, value] of entries) {
    const match = /^mf\.attempts\.(.+)\.(amateur|intermediate|expert)$/.exec(key);
    if (!match) continue;
    try {
      const rows = JSON.parse(value);
      if (!Array.isArray(rows)) continue;
      rows.slice(0, 20).forEach((r, index) => {
        if (r && typeof r.at === 'string' && typeof r.designName === 'string') flights.push({
          ...r,
          id: key + ':' + index,
          missionId: match[1],
          difficulty: match[2]
        });
      });
    } catch {/* Keep other mission histories available. */}
  }
  return flights.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 200);
}
export function achievements(flights, visited = []) {
  return [{
    id: 'first-launch',
    name: 'Flight logged',
    earned: flights.length > 0,
    detail: 'Finish and record a campaign flight.'
  }, {
    id: 'orbit',
    name: 'Around the world',
    earned: flights.some(f => Number.isFinite(f.peri) && f.peri >= 140000),
    detail: 'Record a periapsis above 140 km.'
  }, {
    id: 'success',
    name: 'Mission accomplished',
    earned: flights.some(f => f.outcome === 'success'),
    detail: 'Complete all objectives in a campaign mission.'
  }, {
    id: 'moon',
    name: 'Lunar navigator',
    earned: flights.some(f => f.missionId.includes('lunar') && f.outcome === 'success'),
    detail: 'Complete a lunar mission.'
  }, {
    id: 'explorer',
    name: 'Beyond Earth',
    earned: visited.some(id => id !== 'earth' && BODIES.some(body => body.id === id)),
    detail: 'Reach or start an expedition at another world; new-orbit placement is allowed.'
  }];
}
export function compareFlights(a, b) {
  return ['total', 'flightTime', 'cost', 'remDv', 'maxQ', 'maxG'].map(key => ({
    key,
    a: Number.isFinite(a?.[key]) ? a[key] : null,
    b: Number.isFinite(b?.[key]) ? b[key] : null,
    delta: Number.isFinite(a?.[key]) && Number.isFinite(b?.[key]) ? b[key] - a[key] : null
  }));
}
