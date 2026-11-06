import { densityAt } from "./forces";
export function telemetrySample(sim) {
  const n = sim.navigation(),
    q =
      0.5 *
      densityAt(n.body, n.altitude, {
        r: n.r,
        t: sim.t,
        options: sim.physics,
      }) *
      n.surfaceSpeed ** 2;
  return {
    t: sim.t,
    altitude: n.altitude,
    speed: n.speed,
    q,
    mass: sim.dryMass + sim.fuel,
    fuel: sim.fuel,
    thrust: sim.fuel > 0 ? sim.throttle * sim.craft.thrust : 0,
  };
}
export function appendTelemetry(sim) {
  if (!sim.telemetry) sim.telemetry = [];
  const previous = sim.telemetry.at(-1);
  if (!previous || sim.t - previous.t >= 1) {
    const sample = telemetrySample(sim);
    sim.telemetry.push(sample);
    if (sim.telemetry.length > 600) sim.telemetry.shift();
    sim.peakQ = Math.max(sim.peakQ || 0, sample.q);
  }
}
export function telemetryCSV(samples) {
  return [
    "time_s,altitude_m,speed_m_s,dynamic_pressure_Pa,mass_kg,fuel_kg,thrust_N",
    ...samples.map((s) =>
      [s.t, s.altitude, s.speed, s.q, s.mass, s.fuel, s.thrust].join(","),
    ),
  ].join("\n");
}
