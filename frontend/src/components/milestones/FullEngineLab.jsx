import { useEffect, useRef, useState } from "react";
import { useGame } from "../../game/GameContext";
import { presetFalconLike } from "../../sim/presets";
import { DEFAULT_PROFILE } from "../../sim/guidance";
import { downloadJSON, readJSONFile } from "../../sim/storage";
import { localData } from "../../persistence/localData";
export function FullEngineLab() {
  const g = useGame(),
    worker = useRef(null),
    pending = useRef(null),
    [mode, setMode] = useState("fleet"),
    [fullForces, setFullForces] = useState(false),
    [step, setStep] = useState(10),
    [state, setState] = useState(null),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [metadata, setMetadata] = useState(null),
    [verification, setVerification] = useState(null);
  const initial = useRef(null);
  const stop = () => {
    worker.current?.terminate();
    worker.current = null;
    pending.current?.reject(Error("Full-engine session stopped."));
    pending.current = null;
    setReady(false);
    setBusy(false);
  };
  useEffect(
    () => () => {
      worker.current?.terminate();
      pending.current?.reject(Error("Session closed."));
    },
    [],
  );
  const send = (command) =>
    new Promise((resolve, reject) => {
      if (!worker.current || pending.current) {
        reject(Error("Wait for the current command."));
        return;
      }
      pending.current = { resolve, reject };
      worker.current.postMessage(command);
    });
  const run = async (command) => {
    setBusy(true);
    setError("");
    try {
      const reply = await send(command);
      if (
        reply.result &&
        command.type !== "snapshot" &&
        command.type !== "record" &&
        command.type !== "report"
      )
        setState(reply.result);
      if (reply.verification) setVerification(reply.verification);
      return reply;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const initialize = async () => {
    stop();
    setState(null);
    setVerification(null);
    setError("");
    setBusy(true);
    try {
      if (typeof Worker === "undefined")
        throw Error(
          "This isolated full-engine runner needs Web Workers and WebAssembly. Standard gameplay remains available.",
        );
      const w = new Worker(
        new URL("../../engine/fullEngine.worker.js", import.meta.url),
      );
      worker.current = w;
      w.onmessage = (e) => {
        const p = pending.current;
        pending.current = null;
        if (e.data.fatal) setReady(false);
        if (e.data.error) p?.reject(Error(e.data.error));
        else p?.resolve(e.data);
      };
      w.onerror = () => {
        const p = pending.current;
        pending.current = null;
        p?.reject(
          Error("Wasm engine worker failed. Stop and initialize again."),
        );
      };
      const reply = await send({ type: "initialize" });
      setMetadata(reply.metadata);
      const physics = fullForces
        ? {
            integrator: "accurate",
            harmonicDegree: 8,
            thirdBody: true,
            srp: true,
            tides: true,
            oceanTides: true,
            relativity: true,
            damage: true,
            power: true,
            atmosphere: "msis",
          }
        : {};
      initial.current =
        mode === "campaign"
          ? {
              type: "initCampaign",
              design: presetFalconLike(),
              missionId: "first_orbit",
              difficulty: "amateur",
              profile: { ...DEFAULT_PROFILE },
            }
          : {
              type: "initFleet",
              body: "earth",
              craftId: "pathfinder",
              altitude: 600000,
              physics,
            };
      const result = await send(initial.current);
      setState(result.result);
      setReady(true);
    } catch (e) {
      setError(e.message);
      stop();
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    const reply = await run({ type: "snapshot" });
    if (reply) downloadJSON("missionforge-full-engine.json", reply.result);
  };
  const handoff = async () => {
    const reply = await run({ type: "snapshot" });
    if (!reply) return;
    try {
      const saved = reply.result;
      if (saved.mode === "campaign") {
        g.loadDesign(saved.configuration.design);
        g.setMissionId(saved.configuration.missionId);
        g.setDifficulty(saved.configuration.difficulty);
        g.setProfile(saved.configuration.profile);
        g.setLearningPrediction(null);
        g.setPendingCheckpoint({ ...saved.configuration, state: saved.state });
        g.go("flight");
      } else {
        const active = saved.state.entries.find(
          (e) => e.id === saved.state.activeId,
        );
        await localData.importEntries([
          ["mf.fleet-world", JSON.stringify(saved.state)],
          ["mf.exploration", JSON.stringify(active.state)],
        ]);
        g.go("explore");
      }
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <section data-testid="full-engine-lab">
      <h2>Full-engine WebAssembly sessions</h2>
      <p>
        The complete campaign/fleet source runs inside a local QuickJS Wasm VM:
        integration, staging, crew, resources, tides, thermal response, contacts
        and damage. NRLMSISE uses its bundled Wasm model through a typed bridge.
        This is an interpreter backend, not a native C/Rust port. It is opt-in;
        standard gameplay keeps its current renderer/backend.
      </p>
      <div className="education-inputs">
        <label>
          Session
          <select
            data-testid="engine-mode"
            value={mode}
            disabled={busy}
            onChange={(e) => {
              stop();
              setState(null);
              setMode(e.target.value);
            }}
          >
            <option value="fleet">Earth exploration & fleet</option>
            <option value="campaign">First Orbit campaign</option>
          </select>
        </label>
        <label>
          Advance per command (s)
          <input
            data-testid="engine-seconds"
            type="number"
            min="0.001"
            max="1000"
            value={step}
            onChange={(e) => setStep(e.target.value)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            data-testid="engine-full-forces"
            checked={fullForces}
            disabled={busy || ready}
            onChange={(e) => setFullForces(e.target.checked)}
          />
          Advanced forces + NRLMSISE (fleet)
        </label>
      </div>
      <div className="showcase-actions">
        <button
          className="ui-button ui-button-primary"
          data-testid="engine-initialize"
          disabled={busy}
          onClick={initialize}
        >
          Initialize Wasm engine
        </button>
        <button className="ui-button" data-testid="engine-stop" onClick={stop}>
          Stop / cancel worker
        </button>
      </div>
      {busy && (
        <p role="status">Running the complete engine in an isolated worker…</p>
      )}
      <p role="alert">{error}</p>
      {ready && (
        <>
          <div className="showcase-actions">
            {mode === "campaign" && (
              <>
                <button
                  className="ui-button"
                  disabled={busy}
                  data-testid="engine-launch"
                  onClick={() => run({ type: "launch" })}
                >
                  Launch
                </button>
                <button
                  className="ui-button"
                  disabled={busy}
                  data-testid="engine-stage"
                  onClick={() => run({ type: "stage" })}
                >
                  Next stage
                </button>
              </>
            )}
            <button
              className="ui-button"
              disabled={busy}
              data-testid="engine-full"
              onClick={() => run({ type: "control", throttle: 1 })}
            >
              Full thrust
            </button>
            <button
              className="ui-button"
              disabled={busy}
              data-testid="engine-cut"
              onClick={() => run({ type: "control", throttle: 0 })}
            >
              Cut thrust
            </button>
            <button
              className="ui-button"
              disabled={busy}
              data-testid="engine-advance"
              onClick={() => run({ type: "advance", seconds: Number(step) })}
            >
              Advance simulation
            </button>
            {mode === "fleet" && (
              <>
                <button
                  className="ui-button"
                  disabled={busy}
                  data-testid="engine-companion"
                  onClick={() => run({ type: "create", id: "lander" })}
                >
                  Add companion
                </button>
                <button
                  className="ui-button"
                  disabled={busy}
                  data-testid="engine-fracture"
                  onClick={() => run({ type: "fracture", enabled: true })}
                >
                  Enable convex mesh fracture
                </button>
              </>
            )}
          </div>
          <button
            className="ui-button"
            disabled={busy}
            data-testid="engine-verify"
            onClick={() => run({ type: "verify", initial: initial.current })}
          >
            Run paired JS/Wasm verification
          </button>
          <button
            className="ui-button"
            disabled={busy}
            data-testid="engine-save"
            onClick={save}
          >
            Export full engine state
          </button>
          <label className="ui-button">
            Restore engine file
            <input
              data-testid="engine-import"
              type="file"
              accept=".json"
              disabled={busy}
              onChange={async (e) => {
                const f = e.target.files[0];
                e.target.value = "";
                if (!f) return;
                try {
                  const saved = await readJSONFile(f),
                    reply = await run({ type: "restore", saved });
                  if (reply?.result) {
                    setMode(saved.mode === "campaign" ? "campaign" : "fleet");
                    initial.current = { type: "restore", saved };
                  }
                } catch (e) {
                  setError(e.message);
                }
              }}
            />
          </label>
          <details>
            <summary>Continue in the standard renderer</summary>
            <p>
              This leaves the Wasm session and uses the established JavaScript
              gameplay backend. Fleet handoff replaces your saved expedition;
              export it first if needed.
            </p>
            <button
              className="ui-button"
              data-testid="engine-handoff"
              disabled={busy || state?.status === "prelaunch"}
              onClick={handoff}
            >
              Use this state in standard gameplay
            </button>
          </details>
        </>
      )}
      {state && (
        <div className="science-card" data-testid="engine-state">
          <p>
            {state.mode} · {state.status} · actual simulation time{" "}
            {state.t.toFixed(3)} s
          </p>
          <p>
            Altitude {(state.altitude / 1000).toFixed(3)} km · mass{" "}
            {state.mass.toFixed(3)} kg · fuel {state.fuel.toFixed(6)} kg ·
            remaining Δv {state.remainingDeltaV.toFixed(2)} m/s.
          </p>
          {state.vessels && <p>{state.vessels.length} vessel(s)</p>}
        </div>
      )}
      {verification && (
        <div className="science-card" data-testid="engine-verification">
          <h3>Parity checks passed</h3>
          <p>
            Maximum position error{" "}
            {verification.maxPositionError.toExponential(3)} m · velocity error{" "}
            {verification.maxVelocityError.toExponential(3)} m/s · fuel error{" "}
            {verification.maxFuelError.toExponential(3)} kg.
          </p>
          <p>
            JS command time {verification.nativeMs.toFixed(1)} ms · Wasm command
            time {verification.wasmMs.toFixed(1)} ms. Slower results do not
            change the default game backend.
          </p>
          <p>{verification.notice}</p>
          <button
            className="ui-button"
            onClick={() =>
              downloadJSON("missionforge-engine-parity.json", verification)
            }
          >
            Export parity evidence
          </button>
        </div>
      )}
      {metadata && (
        <p>
          Engine bundle SHA-256: {metadata.sha256}. Runtime: {metadata.runtime}.
        </p>
      )}
    </section>
  );
}
