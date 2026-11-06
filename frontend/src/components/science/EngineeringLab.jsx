import { useMemo, useState } from "react";
import { NASA_DATA, sourceFor } from "../../science/catalog";
import { dragEnvironment } from "../../science/atmospheres";
import {
  rocketDeltaV,
  hohmannTransfer,
  propellantForDeltaV,
} from "../../sim/orbitPlanning";
import { BODY_BY_ID } from "../../sim/solarSystem";
import { G0 } from "../../sim/constants";

const fmt = (n, d = 1) =>
  n.toLocaleString("en-US", { maximumFractionDigits: d });
export function EngineeringLab() {
  const [world, setWorld] = useState("earth"),
    [altitude, setAltitude] = useState(100),
    [speed, setSpeed] = useState(7500),
    [dry, setDry] = useState(1800),
    [fuel, setFuel] = useState(3200),
    [isp, setIsp] = useState(345),
    [from, setFrom] = useState(200),
    [to, setTo] = useState(400);
  const body = BODY_BY_ID[world],
    air = dragEnvironment(world, altitude * 1000, speed),
    dv = rocketDeltaV(isp, dry, fuel),
    transfer = hohmannTransfer(
      body.mu,
      body.radius + from * 1000,
      body.radius + to * 1000,
    );
  const propellant = propellantForDeltaV(dry + fuel, isp, transfer.totalDeltaV),
    source = sourceFor(NASA_DATA.atmospheres[world].source);
  const curve = useMemo(
    () =>
      Array.from({ length: 51 }, (_, i) => {
        const h = i * 10;
        const rho = dragEnvironment(world, h * 1000, 1).density;
        return {
          h,
          rho,
          y:
            20 +
            ((Math.log10(1.225) - Math.log10(Math.max(1e-16, rho))) / 16) * 160,
        };
      }),
    [world],
  );
  return (
    <section className="science-card" data-testid="engineering-lab">
      <span className="science-kicker">
        Flight engineering · sourced inputs, explicit assumptions
      </span>
      <h2>See the forces behind your flight.</h2>
      <p>
        Use the same archived density tables and orbital formulas as the game.
        These are model experiments, not live weather or certified spacecraft
        specifications.
      </p>
      <label>
        World
        <select
          data-testid="engineering-world"
          value={world}
          onChange={(e) => setWorld(e.target.value)}
        >
          <option value="earth">Earth</option>
          <option value="mars">Mars</option>
        </select>
      </label>
      <h3>Atmosphere & drag</h3>
      <div className="science-inputs">
        <label>
          Altitude: {altitude} km
          <input
            type="range"
            min="0"
            max="500"
            step="5"
            value={altitude}
            data-testid="engineering-altitude"
            onChange={(e) => setAltitude(Number(e.target.value))}
          />
        </label>
        <label>
          Air-relative speed: {fmt(speed, 0)} m/s
          <input
            type="range"
            min="0"
            max="12000"
            step="100"
            value={speed}
            data-testid="engineering-speed"
            onChange={(e) => setSpeed(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="science-comparison">
        <div>
          <span>NASA model density</span>
          <strong data-testid="engineering-density">
            {air.density.toExponential(3)} kg/m³
          </strong>
          <small>ρ = ρ₀ exp[−(h − h₀)/H]</small>
        </div>
        <div>
          <span>Dynamic pressure</span>
          <strong data-testid="engineering-q">
            {fmt(air.dynamicPressure, 3)} Pa
          </strong>
          <small>q = ½ρv² · drag = {fmt(air.force, 2)} N</small>
        </div>
      </div>
      <svg
        className="density-chart"
        viewBox="0 0 600 235"
        role="img"
        aria-label={`${body.name} model density decreases with altitude; logarithmic vertical scale`}
      >
        <path d="M45 15V190H570" fill="none" stroke="currentColor" />
        <polyline
          points={curve.map((p) => `${45 + p.h},${p.y}`).join(" ")}
          fill="none"
          stroke="var(--ui-accent)"
          strokeWidth="3"
        />
        <text x="45" y="217">
          0 km
        </text>
        <text x="500" y="217">
          500 km
        </text>
        <text x="60" y="18">
          Density · logarithmic scale
        </text>
      </svg>
      <p className="science-help">
        Drag assumes area 8 m² and coefficient 0.5 for this comparison, matching
        exploration. The scored launcher retains its own changing area and
        Mach-dependent coefficient. Earth launch uses its existing
        lower-atmosphere thermodynamics, blending to NASA density from 86–90 km.
        Exploration uses the NASA Earth/Mars tables directly. Spherical altitude
        replaces GMAT’s geodetic altitude; solar activity and weather are not
        modelled.
      </p>
      <div className="science-source-links">
        <a href={source.repositoryUrl} target="_blank" rel="noreferrer">
          {source.name} · {NASA_DATA.atmospheres[world].bands.length} density
          bands ↗
        </a>
        <a
          href={sourceFor("nasa-density-method").repositoryUrl}
          target="_blank"
          rel="noreferrer"
        >
          NASA method and units ↗
        </a>
        <a href="/science/atmospheres.csv" download>
          Download atmospheric density CSV
        </a>
        <a href="/science/planetary-data.json" download>
          Download tables, units & provenance
        </a>
      </div>
      <h3>Rocket equation: fuel is part of the vehicle’s mass.</h3>
      <p>
        Change mass and Isp to see the available ideal velocity change. These
        inputs are hypothetical engineering values; they are not imported NASA
        engine measurements.
      </p>
      <div className="engineering-ranges">
        <label>
          Dry mass: {fmt(dry, 0)} kg
          <input
            type="range"
            min="500"
            max="15000"
            step="100"
            data-testid="engineering-dry"
            value={dry}
            onChange={(e) => setDry(Number(e.target.value))}
          />
        </label>
        <label>
          Propellant: {fmt(fuel, 0)} kg
          <input
            type="range"
            min="0"
            max="30000"
            step="100"
            data-testid="engineering-fuel"
            value={fuel}
            onChange={(e) => setFuel(Number(e.target.value))}
          />
        </label>
        <label>
          Specific impulse: {isp} s
          <input
            type="range"
            min="150"
            max="500"
            step="5"
            value={isp}
            onChange={(e) => setIsp(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="science-comparison">
        <div>
          <span>Ideal vacuum Δv</span>
          <strong data-testid="engineering-delta-v">{fmt(dv, 0)} m/s</strong>
          <small>Δv = Isp × g₀ × ln(m₀/mf)</small>
        </div>
        <div>
          <span>Propellant mass fraction</span>
          <strong>{fmt((100 * fuel) / (dry + fuel))}%</strong>
          <small>
            g₀ = {G0} m/s² is a reference conversion constant, not local surface
            gravity.
          </small>
        </div>
      </div>
      <h3>Two burns, one coast</h3>
      <div className="science-inputs">
        <label>
          Starting orbit: {from} km
          <input
            type="range"
            min="200"
            max="1500"
            step="25"
            value={from}
            onChange={(e) => setFrom(Number(e.target.value))}
          />
        </label>
        <label>
          Target orbit: {to} km
          <input
            type="range"
            min="200"
            max="2000"
            step="25"
            value={to}
            onChange={(e) => setTo(Number(e.target.value))}
          />
        </label>
      </div>
      <dl className="science-facts">
        <div>
          <dt>First burn</dt>
          <dd>
            {fmt(transfer.burn1)} m/s ·{" "}
            {transfer.burn1 >= 0 ? "prograde" : "retrograde"}
          </dd>
        </div>
        <div>
          <dt>Circularization burn</dt>
          <dd>
            {fmt(transfer.burn2)} m/s ·{" "}
            {transfer.burn2 >= 0 ? "prograde" : "retrograde"}
          </dd>
        </div>
        <div>
          <dt>Half-ellipse coast</dt>
          <dd>{fmt(transfer.coastTime / 60)} min</dd>
        </div>
        <div>
          <dt>Ideal required propellant</dt>
          <dd>
            {fmt(propellant)} kg ·{" "}
            {propellant <= fuel
              ? "within this example’s budget"
              : "exceeds this example’s fuel"}
          </dd>
        </div>
      </dl>
      <p className="science-equation">
        aₜ = (r₁ + r₂)/2 · vₜ = √[μ(2/r − 1/aₜ)] · coast = π√(aₜ³/μ)
      </p>
      <p>
        The estimate assumes circular coplanar orbits and instantaneous
        impulses. The exploration assistant uses finite burns and shows the
        achieved orbit, so the result can differ from this ideal estimate.
        Starting and target altitudes being equal means zero Δv and no transfer
        is needed.
      </p>
      <div className="science-source-links">
        <a
          href={sourceFor("nasa-transfer-guide").repositoryUrl}
          target="_blank"
          rel="noreferrer"
        >
          NASA GMAT two-burn transfer tutorial ↗
        </a>
        <a
          href={sourceFor("nasa-burn-guide").repositoryUrl}
          target="_blank"
          rel="noreferrer"
        >
          NASA burn directions and fuel-accounting reference ↗
        </a>
      </div>
    </section>
  );
}
