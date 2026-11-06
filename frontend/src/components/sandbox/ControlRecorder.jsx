import { useEffect, useRef, useState } from "react";
import { beginRecording } from "../../sim/advanced/controlRecording";
import { downloadJSON, readJSONFile } from "../../sim/storage";
export function ControlRecorder({ sim, world, onChange }) {
  const timeout = useRef(null);
  const worker = useRef(null),
    upload = useRef(null),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(
    () => () => {
      worker.current?.terminate();
      clearTimeout(timeout.current);
    },
    [],
  );
  useEffect(() => {
    worker.current?.terminate();
    clearTimeout(timeout.current);
    setBusy(false);
    setStatus("");
  }, [sim]);
  const verify = (record) => {
    worker.current?.terminate();
    setBusy(true);
    setStatus("Verifying control trace in a local worker…");
    const w = new Worker(
      new URL("../../sim/advanced/replay.worker.js", import.meta.url),
    );
    worker.current = w;
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => {
      w.terminate();
      setBusy(false);
      setStatus("Replay stopped at the 20 second work budget.");
    }, 20000);
    w.onmessage = (e) => {
      clearTimeout(timeout.current);
      setBusy(false);
      setStatus(
        e.data.error ||
          `${e.data.result.pass ? "Verified" : "Mismatch"} · ${e.data.result.commands} commands · hash ${e.data.result.hash}`,
      );
      w.terminate();
    };
    w.onerror = () => {
      clearTimeout(timeout.current);
      setBusy(false);
      setStatus("Replay worker failed.");
      w.terminate();
    };
    w.postMessage(record);
  };
  const record = sim.recording;
  return (
    <details className="engineering-inspector" data-testid="control-recorder">
      <summary>Record & replay flight controls</summary>
      <p>
        Captures the current initial state and applied controls/step durations.
        Verification reruns physics in a local worker and compares the final
        state. Single-vessel manual/program flight; transfer and rendezvous
        assistants must be stopped.
      </p>
      <div className="showcase-actions">
        <button
          className="ui-button"
          data-testid="record-start"
          disabled={!!record?.active || world.entries.length > 1}
          onClick={() => {
            try {
              beginRecording(sim);
              setStatus("Recording armed; press Play.");
              onChange();
            } catch (e) {
              setStatus(e.message);
            }
          }}
        >
          Start recording
        </button>
        <button
          className="ui-button"
          data-testid="record-stop"
          disabled={!record?.active}
          onClick={() => {
            record.active = false;
            onChange();
          }}
        >
          Stop recording
        </button>
        <button
          className="ui-button"
          data-testid="record-verify"
          disabled={!record?.commands.length || busy || record.active}
          onClick={() => verify(record)}
        >
          Verify trace
        </button>
        <button
          className="ui-button"
          disabled={!record?.commands.length || record.active}
          onClick={() =>
            downloadJSON("mission-forge-control-trace.json", record)
          }
        >
          Export trace
        </button>
        <button
          className="ui-button"
          disabled={busy}
          onClick={() => upload.current.click()}
        >
          Verify imported trace
        </button>
      </div>
      <input
        ref={upload}
        type="file"
        hidden
        accept=".json,application/json"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            if (f.size > 8000000) throw Error("Recording exceeds 8 MB limit");
            verify(await readJSONFile(f));
          } catch (error) {
            setStatus(error.message);
          }
        }}
      />
      <p role="status" data-testid="record-status">
        {status}
      </p>
      <p>
        {record?.commands.length || 0} commands ·{" "}
        {record?.notice ||
          "Limit: 12,000 commands / 200,000 integration steps."}
      </p>
    </details>
  );
}
