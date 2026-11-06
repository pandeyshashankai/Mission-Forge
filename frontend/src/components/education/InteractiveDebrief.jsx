import {
  PREDICTIONS,
  saveLearningReview,
  validPrediction,
} from "../../science/learning";
import { useMemo, useState } from "react";
import { buildDebrief } from "../../features/education/debrief";
import {
  activeAcademyFlight,
  saveLesson,
} from "../../features/education/academy";
import { localData } from "../../persistence/localData";
import { useGame } from "../../game/GameContext";
import { downloadJSON } from "../../sim/storage";
export function InteractiveDebrief({ result }) {
  const g = useGame(),
    report = useMemo(() => buildDebrief(result), [result]),
    [selected, setSelected] = useState(0),
    [reflection, setReflection] = useState(result.debrief?.reflection || ""),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  const learning = validPrediction(result.learning?.prediction)
    ? result.learning
    : null;
  const event = report.timeline[selected],
    session = activeAcademyFlight(),
    academy =
      session && result.learning?.prediction?.id === session.predictionId;
  const save = async () => {
    try {
      if (!reflection.trim())
        throw Error("Write an evidence-based explanation first.");
      const record = {
        version: 1,
        resultAt: result.at,
        missionId: result.missionId,
        reflection: reflection.trim().slice(0, 2000),
        evidence: report,
      };
      if (academy)
        saveLesson("orbit", {
          choice: session.choice,
          reflection,
          experiment: {
            periapsisMetres: report.periapsisMetres,
            peakAltitudeKm: report.peakAltitudeKm,
            resultAt: result.at,
            prediction: result.learning.prediction,
          },
        });
      const updatedLearning = learning
        ? { ...learning, reflection: record.reflection }
        : null;
      if (
        updatedLearning &&
        !saveLearningReview(updatedLearning, record.reflection)
      )
        throw Error("The learning journal could not be saved.");
      localData.setItem("mf.last-debrief", JSON.stringify(record));
      await localData.flush();
      g.setResult({
        ...result,
        ...(updatedLearning ? { learning: updatedLearning } : {}),
        debrief: record,
      });
      setSaved(true);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <section className="science-card" data-testid="interactive-debrief">
      <span className="science-kicker">Flight evidence → next decision</span>
      <h2>{report.title}</h2>
      <p>{report.why}</p>
      {learning && (
        <div className="education-observation" data-testid="debrief-prediction">
          <h3>Your original prediction</h3>
          <p>
            {
              PREDICTIONS.find((p) => p.id === learning.prediction.choice)
                ?.label
            }
          </p>
          <p>
            You estimated {learning.prediction.expectedSpeed.toLocaleString()}{" "}
            m/s. The ideal circular reference is{" "}
            {learning.targetSpeed.toFixed(1)} m/s; the absolute difference is{" "}
            {learning.predictionError.toFixed(1)} m/s.
          </p>
          {learning.nearestSample && (
            <p>
              Recorded inertial speed near{" "}
              {learning.nearestSample.altitudeKm.toFixed(1)} km:{" "}
              {learning.nearestSample.speed.toFixed(1)} m/s at T+
              {learning.nearestSample.t.toFixed(1)} s. This is not a
              horizontal-speed measurement.
            </p>
          )}
        </div>
      )}
      <p>
        <strong>Try next:</strong> {report.next}
      </p>
      <p>
        Peak sampled altitude:{" "}
        {report.peakAltitudeKm === null
          ? "unavailable"
          : report.peakAltitudeKm.toFixed(1) + " km"}{" "}
        · Final periapsis:{" "}
        {report.periapsisMetres === null
          ? "unavailable"
          : (report.periapsisMetres / 1000).toFixed(1) + " km"}
        . For comparison, ideal circular speed at 200 km above Earth is{" "}
        {report.referenceSpeed.toFixed(1)} m/s.
      </p>
      {report.missingHorizontal && (
        <p className="science-help">
          This recording does not include horizontal speed. Recorded total
          inertial speed is not a substitute for it.
        </p>
      )}
      {report.unmet.length > 0 && (
        <details>
          <summary>Objectives still unmet</summary>
          <ul>
            {report.unmet.map((o, i) => (
              <li key={i}>
                {o.label}: {o.detail}
              </li>
            ))}
          </ul>
        </details>
      )}
      <label htmlFor="debrief-event">
        Inspect a recorded event and its nearest telemetry sample
      </label>
      <select
        id="debrief-event"
        data-testid="debrief-event"
        value={selected}
        onChange={(e) => setSelected(Number(e.target.value))}
      >
        {report.timeline.map((e, i) => (
          <option key={i} value={i}>
            T+{e.t.toFixed(1)} s · {e.text}
          </option>
        ))}
      </select>
      {!event ? (
        <p>No event timeline was recorded.</p>
      ) : (
        <div data-testid="debrief-evidence">
          <p>{event.text}</p>
          {event.sample ? (
            <p>
              Nearest sample: T+{event.sample.t.toFixed(1)} s (
              {event.sample.offsetSeconds.toFixed(1)} s from this event),
              altitude {event.sample.altitudeKm.toFixed(1)} km, inertial speed{" "}
              {event.sample.inertialSpeed.toFixed(1)} m/s
              {event.sample.horizontalSpeed === null
                ? ""
                : `, horizontal speed ${event.sample.horizontalSpeed.toFixed(1)} m/s`}
              . Temporal proximity does not prove the event caused the outcome.
            </p>
          ) : (
            <p>Telemetry unavailable for this event.</p>
          )}
        </div>
      )}
      <label htmlFor="debrief-reflection">
        What happened, which measurement supports that, and what will you
        change?
      </label>
      <textarea
        id="debrief-reflection"
        data-testid="debrief-reflection"
        value={reflection}
        maxLength={2000}
        onChange={(e) => {
          setReflection(e.target.value);
          setSaved(false);
        }}
      />
      <div className="showcase-actions">
        <button
          className="ui-button"
          data-testid="debrief-save"
          disabled={!reflection.trim()}
          onClick={save}
        >
          Save explanation{academy ? " & Academy lesson" : ""}
        </button>
        <button
          className="ui-button"
          data-testid="debrief-retry"
          onClick={() => {
            g.setPendingCheckpoint(null);
            g.go("review");
          }}
        >
          Review rocket & retry
        </button>
        <button
          className="ui-button"
          data-testid="debrief-academy"
          onClick={() => g.go("academy")}
        >
          Continue Academy
        </button>
        <button
          className="ui-button"
          onClick={() =>
            downloadJSON("missionforge-debrief.json", {
              resultAt: result.at,
              prediction: result.learning.prediction,
              report,
              reflection,
            })
          }
        >
          Export debrief
        </button>
      </div>
      {saved && (
        <p role="status" data-testid="debrief-saved">
          Explanation saved locally
          {academy ? " and Academy lesson recorded" : ""}.
        </p>
      )}
      <p role="alert">{error}</p>
    </section>
  );
}
