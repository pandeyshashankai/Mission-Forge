import { EXPLORERS } from "../../sim/exploration";
import { BODIES } from "../../sim/solarSystem";
import { useEffect, useRef, useState } from "react";
import { entryMetrics } from "../../sim/advanced/aerobraking";
export function AerobrakingPanel({ sim }) {
  const worker = useRef(null),
    timer = useRef(null);
  useEffect(
    () => () => {
      worker.current?.terminate();
      clearTimeout(timer.current);
    },
    [],
  );
  const [peri, setPeri] = useState(80),
    [result, setResult] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    metrics = entryMetrics(sim),
    body = sim.navigation().body;
  useEffect(() => {
    worker.current?.terminate();
    clearTimeout(timer.current);
    setBusy(false);
    setResult(null);
    setError("");
  }, [sim]);
  const run = () => {
    setBusy(true);
    setError("");
    worker.current?.terminate();
    clearTimeout(timer.current);
    const w = new Worker(
      new URL("../../sim/advanced/planning.worker.js", import.meta.url),
    );
    worker.current = w;
    timer.current = setTimeout(() => {
      w.terminate();
      setBusy(false);
      setError("Preview stopped at the 20 second work budget.");
    }, 20000);
    w.onmessage = (event) => {
      clearTimeout(timer.current);
      setBusy(false);
      if (event.data.error) setError(event.data.error);
      else setResult(event.data.result);
      w.terminate();
    };
    w.onerror = () => {
      clearTimeout(timer.current);
      setBusy(false);
      setError("Preview worker failed.");
      w.terminate();
    };
    w.postMessage({
      kind: "aerobrake",
      cargoMass: Math.max(
        0,
        sim.craft.dryMass -
          EXPLORERS.find((c) => c.id === sim.craft.id).dryMass,
      ),
      initial: sim.serialize(),
      periAltitude: Number(peri) * 1000,
      customBodies: BODIES.filter((b) => b.custom),
    });
  };
  return (
    <details className="engineering-inspector" data-testid="aerobraking-panel">
      <summary>Atmospheric pass & entry preview</summary>
      <dl>
        <div>
          <dt>Current flight-path angle</dt>
          <dd>{metrics.flightPathAngle.toFixed(2)}°</dd>
        </div>
        <div>
          <dt>Dynamic pressure</dt>
          <dd>
            {metrics.q.toFixed(1)} Pa {metrics.q > 40000 ? "· high load" : ""}
          </dd>
        </div>
        <div>
          <dt>Earth-air heating proxy</dt>
          <dd>
            {metrics.heatProxy === null
              ? "Not applied for this atmosphere"
              : (metrics.heatProxy / 1e6).toFixed(3) + " MW/m²"}
          </dd>
        </div>
      </dl>
      <p>
        Heating uses 1.83×10⁻⁴ √(ρ/1 m) v³, an illustrative Earth-air blunt-body
        proxy. No thermal shield rating or safe corridor is implied. q = ½ρv².
        Actual entry also depends on lift, vehicle shape and atmosphere
        uncertainty.
      </p>
      <label>
        Hypothetical entry periapsis (km)
        <input
          className="subassembly-name"
          data-testid="aerobrake-peri"
          type="number"
          min="1"
          value={peri}
          onChange={(e) => setPeri(e.target.value)}
        />
      </label>
      <button
        className="ui-button"
        data-testid="aerobrake-predict"
        disabled={busy || !body.atmosphere}
        onClick={run}
      >
        {busy ? "Propagating…" : "Predict one atmospheric pass"}
      </button>
      <p role="status">{error}</p>
      {result && (
        <div data-testid="aerobrake-result">
          <p>
            Preview from T+{result.startTime.toFixed(0)} s. Ideal setup burn:{" "}
            {result.setupDeltaV.toFixed(1)} m/s · {result.setupFuel.toFixed(1)}{" "}
            kg. Minimum altitude {(result.minimumAltitude / 1000).toFixed(1)} km
            · peak sampled q {result.maxQ.toFixed(0)} Pa · net specific energy
            change {result.energyChange.toFixed(0)} J/kg.
          </p>
          <p>
            {result.status === "crashed"
              ? "Surface impact predicted"
              : result.status === "landed"
                ? "Surface contact predicted"
                : `Post-pass orbit ${Number.isFinite(result.periapsis) ? (result.periapsis / 1000).toFixed(1) : "escape"} × ${Number.isFinite(result.apoapsis) ? (result.apoapsis / 1000).toFixed(1) : "escape"} km`}
            {result.limited ? " · preview time/work limit reached" : ""}.
          </p>
        </div>
      )}
      <p>
        Preview only: clones your state, applies a hypothetical impulsive entry
        setup, then integrates central gravity and the selected drag model for
        at most six hours, with one-second pressure samples inside the
        atmosphere and a 100,000-step work cap. Relativity, J2, third bodies,
        SRP and resources are disabled in this preview. It does not move your
        spacecraft or execute the burn.
      </p>
    </details>
  );
}
