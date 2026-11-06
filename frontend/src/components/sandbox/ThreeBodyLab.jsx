import { downloadJSON } from "../../sim/storage";
import { useState } from "react";
import { BODY_BY_ID } from "../../sim/solarSystem";
import { lagrangePoints, propagateCR3BP } from "../../sim/advanced/cr3bp";
export function ThreeBodyLab() {
  const mu = BODY_BY_ID.moon.mu / (BODY_BY_ID.earth.mu + BODY_BY_ID.moon.mu),
    lp = lagrangePoints(mu);
  const [x, setX] = useState(0.8),
    [y, setY] = useState(0),
    [vx, setVx] = useState(0),
    [vy, setVy] = useState(0.2),
    [duration, setDuration] = useState(4),
    [result, setResult] = useState(null),
    [error, setError] = useState("");
  const project = (r) => [300 + r[0] * 180, 210 - r[1] * 180];
  const run = () => {
    try {
      setResult(propagateCR3BP({ r: [x, y, 0], v: [vx, vy, 0] }, mu, duration));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <section data-testid="three-body-lab">
      <h2>Restricted three-body playground</h2>
      <p>
        Earth–Moon circular restricted three-body dynamics in a rotating frame.
        Distance is normalized to the primary separation; time is 1/mean-motion.
        This separate experiment does not change campaign physics.
      </p>
      <div className="sandbox-form">
        {[
          ["x", x, setX],
          ["y", y, setY],
          ["vx", vx, setVx],
          ["vy", vy, setVy],
          ["Duration (≤12)", duration, setDuration],
        ].map(([label, value, set]) => (
          <label key={label}>
            {label}
            <input
              type="number"
              step="0.05"
              value={value}
              onChange={(e) => set(Number(e.target.value))}
            />
          </label>
        ))}
      </div>
      <div className="showcase-actions">
        <button
          className="ui-button ui-button-primary"
          data-testid="three-body-run"
          onClick={run}
        >
          Propagate trajectory
        </button>
        <button
          className="ui-button"
          onClick={() => {
            setX(lp.L4[0]);
            setY(lp.L4[1]);
            setVx(0);
            setVy(0);
          }}
        >
          Load L4 equilibrium
        </button>
      </div>
      <svg
        className="three-body-map"
        viewBox="0 0 600 420"
        role="img"
        aria-label="Rotating frame Earth Moon trajectory"
      >
        <path d="M0 210H600M300 0V420" stroke="#30435c" />
        {[
          [[-mu, 0, 0], "Earth", "#60a5fa"],
          [[1 - mu, 0, 0], "Moon", "#cbd5e1"],
        ].map(([r, label, color]) => {
          const [cx, cy] = project(r);
          return (
            <g key={label}>
              <circle
                cx={cx}
                cy={cy}
                r={label === "Earth" ? 8 : 4}
                fill={color}
              />
              <text x={cx + 10} y={cy + 34} fill={color} fontSize="22">
                {label}
              </text>
            </g>
          );
        })}
        {Object.entries(lp).map(([label, r]) => {
          const [cx, cy] = project(r);
          return (
            <text key={label} x={cx} y={cy} fill="#fbbf24" fontSize="22">
              {label}
            </text>
          );
        })}
        {result && (
          <polyline
            points={result.points.map((p) => project(p.r).join(",")).join(" ")}
            fill="none"
            stroke="#67e8f9"
            strokeWidth="1.5"
          />
        )}
      </svg>
      <p role="status">{error}</p>
      {result && (
        <p data-testid="three-body-result">
          Jacobi constant {result.jacobi.toFixed(8)} · maximum absolute drift{" "}
          {result.maxDrift.toExponential(2)} ·{" "}
          {result.impact ? "stopped near a primary surface" : "completed"}.
        </p>
      )}
      {result && (
        <button
          className="ui-button"
          onClick={() =>
            downloadJSON("mission-forge-three-body.json", {
              model: "circular restricted three-body",
              mu,
              frame: "rotating barycentric",
              units:
                "distance in primary separations; time in inverse mean motion",
              ...result,
            })
          }
        >
          Export trajectory & invariant
        </button>
      )}
      <p>
        The mass ratio uses the imported gravitational parameters. Circular
        primary paths, test-particle mass, fixed normalized surface guards and a
        rotating frame are model assumptions. Escape beyond this plot can be
        real within the model.
      </p>
    </section>
  );
}
