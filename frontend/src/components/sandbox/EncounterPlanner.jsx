import { EXPLORERS } from "../../sim/exploration";
import { useEffect, useRef, useState } from "react";
import { BODIES } from "../../sim/solarSystem";
export function EncounterPlanner({ sim, selectedId }) {
  const [hours, setHours] = useState(48),
    [result, setResult] = useState(null),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    worker = useRef(null),
    timer = useRef(null);
  useEffect(
    () => () => {
      worker.current?.terminate();
      clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    worker.current?.terminate();
    clearTimeout(timer.current);
    setBusy(false);
    setResult(null);
    setStatus("");
  }, [sim]);
  const run = () => {
    setBusy(true);
    setStatus("Propagating a coast-only copy locally…");
    worker.current?.terminate();
    const w = new Worker(
      new URL("../../sim/advanced/planning.worker.js", import.meta.url),
    );
    worker.current = w;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      w.terminate();
      setBusy(false);
      setStatus("Planner stopped at the 20 second work budget.");
    }, 20000);
    w.onmessage = (e) => {
      clearTimeout(timer.current);
      setBusy(false);
      if (e.data.error) setStatus(e.data.error);
      else {
        setResult(e.data.result);
        setStatus("Coast forecast ready.");
      }
      w.terminate();
    };
    w.onerror = () => {
      clearTimeout(timer.current);
      setBusy(false);
      setStatus("Planner worker failed.");
      w.terminate();
    };
    w.postMessage({
      initial: sim.serialize(),
      cargoMass: Math.max(
        0,
        sim.craft.dryMass -
          EXPLORERS.find((c) => c.id === sim.craft.id).dryMass,
      ),
      targetId: selectedId,
      hours: Number(hours),
      customBodies: BODIES.filter((b) => b.custom),
    });
  };
  return (
    <details className="engineering-inspector" data-testid="encounter-planner">
      <summary>Closest approach · selected destination</summary>
      <p>
        Target: {BODIES.find((b) => b.id === selectedId)?.name}. Select another
        world in Destinations to compare future separation. The planner
        propagates a copy with no thrust.
      </p>
      <label>
        Coast horizon (hours)
        <input
          className="subassembly-name"
          data-testid="encounter-hours"
          type="number"
          min="0.1"
          max="720"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
        />
      </label>
      <button
        className="ui-button"
        data-testid="encounter-predict"
        disabled={busy}
        onClick={run}
      >
        Predict coast & encounters
      </button>
      <p role="status">{status}</p>
      {result && (
        <>
          <p data-testid="encounter-result">
            Closest sampled approach:{" "}
            {(result.closest.altitude / 1000).toFixed(1)} km above{" "}
            {BODIES.find((b) => b.id === result.targetId)?.name} at +
            {(result.closest.seconds / 3600).toFixed(2)} h · relative speed{" "}
            {result.closest.relativeSpeed.toFixed(1)} m/s.
          </p>
          <ul>
            {result.transitions.map((t, i) => (
              <li key={i}>
                +{(t.seconds / 3600).toFixed(2)} h · {t.from} → {t.to} sphere of
                influence
              </li>
            ))}
          </ul>
          <p>
            {result.notice}
            {result.limited
              ? " Work limit reached; actual horizon was " +
                (result.elapsed / 3600).toFixed(2) +
                " h."
              : ""}
          </p>
        </>
      )}
    </details>
  );
}
