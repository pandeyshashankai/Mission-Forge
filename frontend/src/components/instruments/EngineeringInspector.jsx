import { G0 } from "../../sim/constants";
import { densityAt } from "../../sim/advanced/forces";
import { len } from "../../sim/vec";
const f = (n, d = 1) =>
  Number.isFinite(n)
    ? n.toLocaleString("en-US", { maximumFractionDigits: d })
    : "—";
const Row = ({ label, value }) => (
  <div>
    <dt>{label}</dt>
    <dd>{value}</dd>
  </div>
);
export function DesignEngineering({ stats }) {
  return (
    <section className="engineering-inspector" data-testid="design-engineering">
      <h3>Engineering inspector</h3>
      <dl>
        <Row
          label="Wet / dry mass"
          value={`${f(stats.mass)} / ${f(stats.dryMass)} kg`}
        />
        <Row label="Propellant" value={`${f(stats.mass - stats.dryMass)} kg`} />
        <Row
          label="Sea-level thrust / TWR"
          value={`${f(stats.liftoffThrustSL / 1000)} kN / ${f(stats.liftoffTWR, 2)}`}
        />
        <Row
          label="Vacuum / ascent Δv"
          value={`${f(stats.dv.totalVac)} / ${f(stats.dv.total)} m/s`}
        />
      </dl>
      <p>
        Ascent Δv averages sea-level and vacuum Isp in atmospheric phases. Real
        gravity and drag losses depend on flight.
      </p>
      <ol className="stage-timeline">
        {stats.dv.phases.map((p, i) => (
          <li key={i}>
            <strong>
              {i + 1} · {p.burning}
            </strong>
            <dl>
              <Row
                label="Wet → burnout mass"
                value={`${f(p.m0)} → ${f(p.m1)} kg`}
              />
              <Row label="Δv / Isp" value={`${f(p.dv)} m/s / ${f(p.isp)} s`} />
              <Row
                label="Burn / TWR (SL)"
                value={`${f(p.burnTime)} s / ${f(p.twrSL, 2)}`}
              />
            </dl>
          </li>
        ))}
      </ol>
    </section>
  );
}
export function ExplorationEngineering({ sim, nav }) {
  const b = nav.body,
    mass = sim.dryMass + sim.fuel,
    g = b.mu / len(nav.r) ** 2;
  const rho = densityAt(b, nav.altitude, {
    r: nav.r,
    t: sim.t,
    options: sim.physics,
  });
  const q = 0.5 * rho * nav.surfaceSpeed ** 2;
  return (
    <details
      className="engineering-inspector"
      data-testid="explore-engineering"
    >
      <summary>Engineering · mass, thrust & atmosphere</summary>
      <dl>
        <Row
          label="Wet / dry mass"
          value={`${f(mass)} / ${f(sim.dryMass)} kg`}
        />
        <Row
          label="Fuel / Isp"
          value={`${f(sim.fuel)} kg / ${f(sim.craft.isp)} s`}
        />
        <Row
          label="Available / commanded thrust"
          value={`${f(sim.craft.thrust / 1000)} / ${f((sim.throttle * sim.craft.thrust) / 1000)} kN`}
        />
        <Row
          label="Local full-thrust TWR"
          value={f(sim.craft.thrust / (mass * g), 2)}
        />
        <Row
          label="Full-throttle fuel time"
          value={`${f((sim.fuel * G0 * sim.craft.isp) / sim.craft.thrust)} s`}
        />
        <Row label="Density" value={`${rho.toExponential(3)} kg/m³`} />
        <Row label="Dynamic pressure q" value={`${f(q)} Pa`} />
        <Row label="Model Cd / drag area" value="0.5 / 8 m²" />
        <Row
          label="Drag force"
          value={`${f(sim.dragEnabled ? q * 0.5 * 8 : 0)} N`}
        />
      </dl>
      <p>
        TWR uses local gravity. Dynamic pressure uses atmosphere-relative speed.
        Geometry is illustrative; Cd and area are fixed model inputs.
      </p>
    </details>
  );
}
