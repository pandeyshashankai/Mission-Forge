import { useEffect, useRef, useState } from "react";
import { EducationShell } from "../components/education/EducationShell";
import { compareModels } from "../features/education/modelComparison";
import { downloadJSON } from "../sim/storage";
export default function ModelComparison() {
  const [model, setModel] = useState("j2"),
    [horizon, setHorizon] = useState(3600),
    [integrator, setIntegrator] = useState("accurate"),
    [result, setResult] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const task = useRef(null),
    generation = useRef(0);
  const cancel = () => {
    generation.current++;
    task.current?.terminate();
    task.current = null;
    setBusy(false);
  };
  useEffect(
    () => () => {
      generation.current++;
      task.current?.terminate();
    },
    [],
  );
  const clear = () => {
    cancel();
    setResult(null);
    setError("");
  };
  const run = async () => {
    clear();
    const id = ++generation.current;
    setBusy(true);
    const params = { model, horizon: Number(horizon), integrator };
    const receive = (data) => {
      if (generation.current !== id) return;
      task.current?.terminate();
      task.current = null;
      setBusy(false);
      if (data.error) setError(data.error);
      else setResult(data.result);
    };
    if (typeof Worker !== "undefined") {
      try {
        const w = new Worker(
          new URL(
            "../features/education/comparison.worker.js",
            import.meta.url,
          ),
        );
        task.current = w;
        w.onmessage = (e) => receive(e.data);
        w.onerror = () =>
          receive({
            error: "Comparison worker failed. Retry with a shorter horizon.",
          });
        w.postMessage(params);
      } catch (e) {
        receive({ error: e.message });
      }
    } else
      try {
        receive({
          result: await compareModels(params, () => {
            if (generation.current !== id) throw Error("Cancelled");
            return new Promise((r) => setTimeout(r, 0));
          }),
        });
      } catch (e) {
        receive({ error: e.message });
      }
  };
  return (
    <EducationShell
      title="Scientific Model Comparison"
      testId="model-comparison"
    >
      <span className="science-kicker">One initial state · two models</span>
      <h1>What changes when the physics model changes?</h1>
      <p>
        Both unpowered Earth trajectories start at 600 km and 55° inclination,
        with the same velocity, epoch and integrator. Drag, power and
        communications are off. Only the listed advanced forces differ.
      </p>
      <div className="education-inputs">
        <label>
          Advanced forces
          <select
            data-testid="comparison-model"
            value={model}
            onChange={(e) => {
              clear();
              setModel(e.target.value);
            }}
          >
            <option value="central">
              Central only (zero-difference control)
            </option>
            <option value="j2">Earth J2</option>
            <option value="thirdBody">Sun/Moon differential gravity</option>
            <option value="relativity">Central 1PN correction</option>
            <option value="combined">
              Degree-8 gravity, third bodies, SRP, solid/ocean tides
            </option>
          </select>
        </label>
        <label>
          Horizon (seconds)
          <input
            data-testid="comparison-horizon"
            type="number"
            min="60"
            max="21600"
            value={horizon}
            onChange={(e) => {
              clear();
              setHorizon(e.target.value);
            }}
          />
        </label>
        <label>
          Same integrator for both
          <select
            data-testid="comparison-integrator"
            value={integrator}
            onChange={(e) => {
              clear();
              setIntegrator(e.target.value);
            }}
          >
            <option value="accurate">Dormand–Prince 5(4)</option>
            <option value="rk4">RK4</option>
          </select>
        </label>
      </div>
      <div className="showcase-actions">
        <button
          className="ui-button ui-button-primary"
          data-testid="comparison-run"
          disabled={busy}
          onClick={run}
        >
          Run paired trajectories
        </button>
        {busy && (
          <button
            className="ui-button"
            data-testid="comparison-cancel"
            onClick={cancel}
          >
            Cancel
          </button>
        )}
      </div>
      <p role="status">{busy ? "Computing bounded local trajectories…" : ""}</p>
      <p role="alert">{error}</p>
      {result && (
        <section className="science-card" data-testid="comparison-result">
          <h2>
            Maximum sampled difference: {result.maxDifferenceMetres.toFixed(3)}{" "}
            m
          </h2>
          <p>
            Epoch: 0 seconds from the game's J2000 origin. Horizon:{" "}
            {result.horizon} s. Integrator: {result.integrator}. Advanced
            forces: {JSON.stringify(result.advancedForces)}.
          </p>
          <svg
            className="education-plot"
            viewBox="0 0 640 240"
            role="img"
            aria-label="Position difference in metres over elapsed seconds"
          >
            <line x1="40" y1="210" x2="625" y2="210" stroke="currentColor" />
            <text x="40" y="20" fill="currentColor">
              Position difference (m)
            </text>
            <polyline
              fill="none"
              stroke="var(--ui-accent, #22d3ee)"
              strokeWidth="2"
              points={result.rows
                .map(
                  (r) =>
                    `${40 + (580 * r.t) / result.horizon},${210 - (170 * r.differenceMetres) / Math.max(result.maxDifferenceMetres, 1e-12)}`,
                )
                .join(" ")}
            />
            <text x="40" y="235" fill="currentColor">
              0 s
            </text>
            <text x="510" y="235" fill="currentColor">
              {result.horizon} s
            </text>
            <text x="45" y="45" fill="currentColor">
              {result.maxDifferenceMetres.toFixed(3)} m max
            </text>
          </svg>
          <div className="education-table">
            <table>
              <thead>
                <tr>
                  <th>Elapsed seconds</th>
                  <th>Position difference (m)</th>
                </tr>
              </thead>
              <tbody>
                {result.rows
                  .filter((r, i) => i % 20 === 0)
                  .map((r) => (
                    <tr key={r.t}>
                      <td>{r.t.toFixed(1)}</td>
                      <td>{r.differenceMetres.toFixed(6)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p>{result.limits}</p>
          <button
            className="ui-button"
            data-testid="comparison-export"
            onClick={() =>
              downloadJSON("missionforge-model-comparison.json", result)
            }
          >
            Export trajectories & model inputs
          </button>
        </section>
      )}
    </EducationShell>
  );
}
