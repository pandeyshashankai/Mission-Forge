import { useState } from "react";
import {
  arcjetCases,
  runThermalCase,
  thermalCSV,
} from "../../sim/advanced/thermalBench";
import { downloadJSON } from "../../sim/storage";
const materialNames = {
  "pica-virgin": "PICA · virgin",
  "avcoat-virgin": "AVCOAT · virgin",
  "avcoat-char": "AVCOAT · char",
};
export function ThermalBench() {
  const [caseIndex, setCase] = useState(0),
    [wall, setWall] = useState("hot"),
    [thickness, setThickness] = useState(0.03),
    [result, setResult] = useState(null),
    [error, setError] = useState("");
  const c = arcjetCases.cases[caseIndex],
    change = (fn) => {
      fn();
      setResult(null);
      setError("");
    };
  const run = () => {
    try {
      setResult(
        ["pica-virgin", "avcoat-virgin", "avcoat-char"].map((material) =>
          runThermalCase({ caseIndex, wall, thickness, material }),
        ),
      );
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <section data-testid="thermal-bench">
      <h2>Arc-jet material laboratory</h2>
      <p>
        Compare educational shield predictions under published MEDLI2 target
        conditions. These curves are model output; the paper's measured
        thermocouple histories have not been digitized or fitted.
      </p>
      <label className="simulation-option">
        Published exposure
        <select
          value={caseIndex}
          onChange={(e) => change(() => setCase(Number(e.target.value)))}
        >
          {arcjetCases.cases.map((x, i) => (
            <option key={i} value={i}>
              {x.facility}
              {x.testId} · {x.material} · {x.targetColdWallFluxWm2 / 10000}{" "}
              W/cm² cold · {x.exposureSeconds} s
            </option>
          ))}
        </select>
      </label>
      <label className="simulation-option">
        Prescribed flux reference
        <select
          value={wall}
          onChange={(e) => change(() => setWall(e.target.value))}
        >
          <option value="hot">Hot-wall target</option>
          <option value="cold">Cold-wall target</option>
        </select>
      </label>
      <label className="simulation-option">
        Assumed coupon thickness (mm)
        <input
          type="number"
          min="5"
          max="150"
          value={thickness * 1000}
          onChange={(e) =>
            change(() => setThickness(Number(e.target.value) / 1000))
          }
        />
      </label>
      <p>
        Hot-wall {c.targetHotWallFluxWm2 / 10000} W/cm² · cold-wall{" "}
        {c.targetColdWallFluxWm2 / 10000} W/cm² · pressure{" "}
        {c.estimatedStagnationPressurePa / 1000} kPa · exposure{" "}
        {c.exposureSeconds} s. A target wall-reference flux is prescribed
        unchanged here, with no wall-temperature feedback correction. Pressure
        does not enter this thermal-only comparison.
      </p>
      <button
        className="ui-button ui-button-primary"
        data-testid="thermal-run"
        onClick={run}
      >
        Compare three materials
      </button>
      <p role="status">{error}</p>
      {result && (
        <div data-testid="thermal-results">
          <p>
            Nominal incident exposure{" "}
            {(result[0].nominalIncidentJm2 / 1e6).toFixed(2)} MJ/m². Thirty
            seconds of cooling follows the exposure.
          </p>
          {result.map((r) => (
            <article className="science-check" key={r.inputs.material}>
              <h3>{materialNames[r.inputs.material]}</h3>
              <svg
                viewBox="0 0 600 200"
                role="img"
                aria-label={`${r.inputs.material} predicted surface and backing temperature versus time`}
                style={{ width: "100%", background: "var(--ui-panel)" }}
              >
                <line
                  x1="45"
                  x2="580"
                  y1="165"
                  y2="165"
                  stroke="currentColor"
                />
                {[
                  ["temperature", "#ef4444"],
                  ["backTemperature", "#0891b2"],
                ].map(([key, color]) => (
                  <polyline
                    key={key}
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    strokeDasharray={
                      key === "backTemperature" ? "8 5" : undefined
                    }
                    points={r.samples
                      .map(
                        (s) =>
                          `${45 + (s.t / r.samples.at(-1).t) * 535},${165 - ((s[key] - 220) / Math.max(1, ...result.map((curve) => curve.maximumSurface - 220))) * 140}`,
                      )
                      .join(" ")}
                  />
                ))}
                <text x="45" y="191" fill="currentColor" fontSize="22">
                  0 s → {r.samples.at(-1).t.toFixed(0)} s
                </text>
                <text x="45" y="18" fill="currentColor" fontSize="22">
                  220 →{" "}
                  {Math.max(
                    ...result.map((curve) => curve.maximumSurface),
                  ).toFixed(0)}{" "}
                  K
                </text>
              </svg>
              <p>Solid red: surface · dashed cyan: backing</p>
              <p>
                Surface peak {r.maximumSurface.toFixed(1)} K · backing peak{" "}
                {r.maximumBacking.toFixed(1)} K · modeled recession{" "}
                {(r.modeledRecessionM * 1000).toFixed(3)} mm.{" "}
                {r.inputs.material !== "avcoat-virgin"
                  ? "Recession disabled: no supplied ablation-energy parameter."
                  : "Effective ablation energy 23.8 MJ/kg; 900 K onset assumed."}
              </p>
              <button
                className="ui-button"
                onClick={() => {
                  const u = URL.createObjectURL(
                      new Blob([thermalCSV(r)], { type: "text/csv" }),
                    ),
                    a = document.createElement("a");
                  a.href = u;
                  a.download = r.inputs.material + "-prediction.csv";
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(u), 1000);
                }}
              >
                Export curve CSV
              </button>
            </article>
          ))}
          <button
            className="ui-button"
            onClick={() => downloadJSON("thermal-comparison.json", result)}
          >
            Export inputs, sources & predictions
          </button>
        </div>
      )}
      <p>
        All coupons use 0.01 m² area, constant TPSX properties and a backing
        heat capacity scaled by area. Thickness and geometry are assumptions,
        not the paper's measured multilayer stackup. Coating, fibre orientation,
        charring and gas chemistry are omitted. SLA-561V cases provide exposure
        context only; no SLA-561V material is simulated.
      </p>
      <p>
        Generic TPSX PICA is used here, not the paper’s MEDLI2 flight-lot
        material. All three graphs share the same temperature scale.
      </p>
      <a
        href="https://ntrs.nasa.gov/citations/20210024735"
        target="_blank"
        rel="noreferrer"
      >
        NASA report reference
      </a>{" "}
      ·{" "}
      <a href="/science/arcjet-cases.json" download>
        Published conditions and room-temperature reference data
      </a>
    </section>
  );
}
