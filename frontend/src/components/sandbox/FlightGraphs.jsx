import { useState } from "react";
import { telemetryCSV } from "../../sim/advanced/telemetry";
export function FlightGraphs({ sim }) {
  const [metric, setMetric] = useState("altitude"),
    samples = sim.telemetry || [],
    units = { altitude: "m", speed: "m/s", q: "Pa", mass: "kg", fuel: "kg" };
  const min = samples.length ? Math.min(...samples.map((s) => s[metric])) : 0,
    max = samples.length ? Math.max(...samples.map((s) => s[metric])) : 1,
    range = Math.max(1e-12, max - min),
    t0 = samples[0]?.t || 0,
    span = Math.max(1, (samples.at(-1)?.t || 0) - t0);
  const points = samples
    .map(
      (s) =>
        `${20 + ((s.t - t0) / span) * 360},${145 - ((s[metric] - min) / range) * 120}`,
    )
    .join(" ");
  const download = () => {
    const url = URL.createObjectURL(
        new Blob([telemetryCSV(samples)], { type: "text/csv" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = "mission-forge-flight.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <details className="engineering-inspector" data-testid="flight-graphs">
      <summary>Live flight graphs · {samples.length} samples</summary>
      <label className="simulation-option">
        Metric
        <select
          aria-label="Flight graph metric"
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
        >
          {Object.keys(units).map((m) => (
            <option key={m} value={m}>
              {m} ({units[m]})
            </option>
          ))}
        </select>
      </label>
      <svg
        viewBox="0 0 400 180"
        role="img"
        aria-label={`${metric} versus simulation time`}
      >
        <path d="M20 20V145H380" fill="none" stroke="#6e91ad" />
        <polyline
          points={points}
          fill="none"
          stroke="#67e8f9"
          strokeWidth="2"
        />
        <text x="25" y="16" fill="#a5bdd5" fontSize="10">
          {Math.abs(max) < 0.01 ? max.toExponential(2) : max.toFixed(1)}{" "}
          {units[metric]}
        </text>
        <text x="20" y="168" fill="#a5bdd5" fontSize="10">
          T+{t0.toFixed(0)} → {(t0 + span).toFixed(0)} s · min{" "}
          {Math.abs(min) < 0.01 ? min.toExponential(2) : min.toFixed(1)}
        </text>
      </svg>
      <p>
        Peak sampled q: {(sim.peakQ || 0).toFixed(1)} Pa. Latest 600 points, at
        least one simulation second apart. High warp samples can skip short
        events.
      </p>
      <button
        className="ui-button"
        onClick={download}
        disabled={!samples.length}
      >
        Export telemetry CSV
      </button>
    </details>
  );
}
