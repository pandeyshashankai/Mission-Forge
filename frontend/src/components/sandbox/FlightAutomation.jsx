import { localData } from "../../persistence/localData";
import { downloadJSON, readJSONFile } from "../../sim/storage";
import { useRef, useState } from "react";
import {
  armProgram,
  validateProgram,
  PROGRAM_TRIGGERS,
  PROGRAM_ACTIONS,
} from "../../sim/advanced/automation";
import { FLIGHT_MODES } from "../../sim/exploration";
export function FlightAutomation({ sim, onChange }) {
  const upload = useRef(null);
  const [blocks, setBlocks] = useState(() => {
      try {
        return validateProgram(
          JSON.parse(localData.getItem("mf.flight-program")),
        );
      } catch {
        return [
          { trigger: "elapsed", threshold: 0, action: "throttle", value: 0.2 },
          { trigger: "elapsed", threshold: 10, action: "cut", value: 0 },
        ];
      }
    }),
    [error, setError] = useState("");
  const edit = (i, patch) =>
    setBlocks(blocks.map((b, n) => (n === i ? { ...b, ...patch } : b)));
  return (
    <details className="engineering-inspector" data-testid="flight-automation">
      <summary>
        Visual flight program · {sim.program?.running ? "running" : "disarmed"}
      </summary>
      <p>
        Ordered, single-use blocks. Each waits for its trigger before applying
        one action. No scripts, loops or external services. Manual flight input
        cancels the program.
      </p>
      {blocks.map((b, i) => (
        <div className="program-block" key={i}>
          <strong>Block {i + 1}</strong>
          <label>
            When
            <select
              aria-label={`Block ${i + 1} trigger`}
              value={b.trigger}
              onChange={(e) => edit(i, { trigger: e.target.value })}
            >
              {PROGRAM_TRIGGERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Threshold (s / km / kg)
            <input
              type="number"
              min="0"
              value={b.threshold}
              onChange={(e) => edit(i, { threshold: Number(e.target.value) })}
            />
          </label>
          <label>
            Then
            <select
              value={b.action}
              aria-label={`Block ${i + 1} action`}
              onChange={(e) =>
                edit(i, {
                  action: e.target.value,
                  value: e.target.value === "mode" ? "prograde" : 0,
                })
              }
            >
              {PROGRAM_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          {b.action === "throttle" && (
            <label>
              Throttle (0–1)
              <input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={b.value}
                onChange={(e) => edit(i, { value: Number(e.target.value) })}
              />
            </label>
          )}
          {b.action === "mode" && (
            <select
              aria-label="Program attitude hold"
              value={b.value}
              onChange={(e) => edit(i, { value: e.target.value })}
            >
              {FLIGHT_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
          <button
            className="ui-button"
            onClick={() => setBlocks(blocks.filter((_, n) => n !== i))}
          >
            Remove block
          </button>
        </div>
      ))}
      <div className="showcase-actions">
        <button
          className="ui-button"
          disabled={blocks.length >= 32}
          onClick={() =>
            setBlocks([
              ...blocks,
              { trigger: "elapsed", threshold: 20, action: "cut", value: 0 },
            ])
          }
        >
          Add block
        </button>
        <button
          className="ui-button"
          data-testid="program-arm"
          onClick={() => {
            try {
              armProgram(sim, blocks);
              setError("");
              onChange();
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          Arm program
        </button>
        <button
          className="ui-button"
          onClick={() => {
            sim.cancelTransfer("Program stopped");
            sim.throttle = 0;
            onChange();
          }}
        >
          Stop & cut thrust
        </button>
      </div>
      <div className="showcase-actions">
        <button
          className="ui-button"
          data-testid="program-save"
          onClick={() => {
            try {
              localData.setItem(
                "mf.flight-program",
                JSON.stringify(validateProgram(blocks)),
              );
              setError(
                "Program saved on this device; it will remain disarmed on reload.",
              );
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          Save program
        </button>
        <button
          className="ui-button"
          onClick={() => {
            try {
              downloadJSON("mission-forge-program.json", {
                version: 1,
                kind: "flight-program",
                blocks: validateProgram(blocks),
              });
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          Export program
        </button>
        <button className="ui-button" onClick={() => upload.current.click()}>
          Import program
        </button>
      </div>
      <input
        hidden
        type="file"
        accept=".json,application/json"
        ref={upload}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            if (file.size > 50000) throw Error("Program file exceeds 50 KB");
            const data = await readJSONFile(file);
            if (data.version !== 1 || data.kind !== "flight-program")
              throw Error("Invalid program file");
            setBlocks(validateProgram(data.blocks));
            setError("Program imported, not armed.");
          } catch (error) {
            setError(error.message);
          }
        }}
      />
      <p role="status">
        {error || `Executed ${sim.program?.index || 0} blocks`}
      </p>
      <p>
        Programs start when you press Play, and execute at most one block per
        simulation advance. They disarm on reload and vessel switching.
      </p>
    </details>
  );
}
