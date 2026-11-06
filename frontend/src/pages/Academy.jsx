import { useState } from "react";
import { EducationShell } from "../components/education/EducationShell";
import {
  LESSONS,
  readAcademy,
  saveLesson,
  lessonExperiment,
} from "../features/education/academy";
import { useGame } from "../game/GameContext";
import { localData } from "../persistence/localData";
import { makePrediction } from "../science/learning";
import { presetFalconLike } from "../sim/presets";
import { DEFAULT_PROFILE } from "../sim/guidance";
import { downloadJSON } from "../sim/storage";
const f = (x) =>
  Number(x).toLocaleString(undefined, { maximumFractionDigits: 1 });
export default function Academy() {
  const g = useGame(),
    [progress, setProgress] = useState(readAcademy),
    [id, setId] = useState("orbit"),
    [choice, setChoice] = useState(""),
    [value, setValue] = useState(200),
    [speed, setSpeed] = useState(""),
    [experiment, setExperiment] = useState(null),
    [reflection, setReflection] = useState(""),
    [error, setError] = useState("");
  const lesson = LESSONS.find((l) => l.id === id);
  const select = (id) => {
    setId(id);
    setChoice("");
    setValue(
      id === "staging"
        ? 500
        : id === "inclination"
          ? 30
          : id === "heat"
            ? 300
            : 200,
    );
    setExperiment(null);
    setReflection("");
    setError("");
  };
  const launch = async () => {
    try {
      if (choice === "") throw Error("Save a prediction before launching.");
      const prediction = makePrediction(
        ["sideways", "height", "engine"][Number(choice)],
        speed.trim() === "" ? NaN : Number(speed),
      );
      g.setLearningPrediction(prediction);
      localData.setItem(
        "mf.academy-flight",
        JSON.stringify({
          version: 1,
          predictionId: prediction.id,
          choice: Number(choice),
          startedAt: new Date().toISOString(),
        }),
      );
      await localData.flush();
      g.loadDesign(presetFalconLike());
      g.setMissionId("first_orbit");
      g.setDifficulty("amateur");
      g.setPendingCheckpoint(null);
      g.setProfile({
        ...DEFAULT_PROFILE,
        targetAltitude: 200000,
        targetInclination: 28.6,
      });
      g.go("review");
    } catch (e) {
      setError(e.message);
    }
  };
  const run = () => {
    try {
      if (choice === "") throw Error("Choose a prediction first.");
      setExperiment(lessonExperiment(id, Number(value)));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };
  const complete = async () => {
    try {
      const nextProgress = saveLesson(id, {
        choice: Number(choice),
        reflection,
        experiment,
      });
      await localData.flush();
      setProgress(nextProgress);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <EducationShell title="Mission Control Academy" testId="academy">
      <span className="science-kicker">Predict → experiment → explain</span>
      <h1>Learn one flight decision at a time.</h1>
      <p>
        Start with a guided First Orbit flight. Every lesson keeps your original
        prediction and reflection locally. A completed lesson records
        participation, not measured mastery.
      </p>
      <nav className="education-lesson-list" aria-label="Academy lessons">
        {LESSONS.map((l, i) => (
          <button
            className="ui-button"
            key={l.id}
            data-testid={"academy-lesson-" + l.id}
            aria-pressed={id === l.id}
            onClick={() => select(l.id)}
          >
            {i + 1}. {l.title}
            {progress.lessons[l.id] ? " ✓" : ""}
          </button>
        ))}
      </nav>
      <section className="science-card">
        <h2>{lesson.title}</h2>
        <p>{lesson.action}</p>
        <label htmlFor="academy-choice">{lesson.question}</label>
        <select
          id="academy-choice"
          data-testid="academy-choice"
          value={choice}
          onChange={(e) => {
            setChoice(e.target.value);
            setExperiment(null);
          }}
        >
          <option value="">Your prediction…</option>
          {lesson.choices.map((c, i) => (
            <option key={c} value={i}>
              {c}
            </option>
          ))}
        </select>
        {id === "orbit" ? (
          <>
            <label htmlFor="academy-speed">
              Estimated circular speed at 200 km (m/s)
            </label>
            <input
              id="academy-speed"
              data-testid="academy-speed"
              type="number"
              min="0"
              max="20000"
              value={speed}
              onChange={(e) => setSpeed(e.target.value)}
            />
            <ol>
              <li>Predict and review the tested Orbiter-9.</li>
              <li>Start the countdown; guidance handles ascent and staging.</li>
              <li>
                Use ×10 for the demonstration, inspect periapsis and finish the
                mission.
              </li>
              <li>Explain your evidence in the interactive debrief.</li>
            </ol>
            <button
              className="ui-button ui-button-primary"
              data-testid="academy-launch"
              disabled={choice === "" || speed.trim() === ""}
              onClick={launch}
            >
              Save prediction & begin guided flight
            </button>
          </>
        ) : (
          <>
            <label htmlFor="academy-value">
              {id === "staging"
                ? "Payload (kg)"
                : id === "inclination"
                  ? "Plane change (degrees)"
                  : id === "heat"
                    ? "Incident heat flux (kW/m²)"
                    : "Circular orbit altitude (km)"}
            </label>
            <input
              id="academy-value"
              data-testid="academy-value"
              type="number"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setExperiment(null);
              }}
            />
            <button
              className="ui-button ui-button-primary"
              data-testid="academy-run"
              onClick={run}
            >
              Run experiment
            </button>
          </>
        )}
        {experiment && (
          <div
            className="education-observation"
            data-testid="academy-observation"
          >
            <h3>
              {Number(choice) === lesson.answer
                ? "Your prediction agrees with this reference."
                : "Compare the evidence with your prediction."}
            </h3>
            <p>{lesson.explanation}</p>
            {experiment.kind === "orbit" && (
              <p>
                At {experiment.altitudeKm} km: {f(experiment.circularSpeed)} m/s
                · {f(experiment.period / 60)} minutes per orbit.
              </p>
            )}
            {experiment.kind === "staging" && (
              <p>
                Discard empty lower stage: {f(experiment.staged)} m/s. Retain
                it: {f(experiment.retained)} m/s.
              </p>
            )}
            {experiment.kind === "inclination" && (
              <p>
                {experiment.angleDeg}° at {f(experiment.speed)} m/s costs{" "}
                {f(experiment.deltaV)} m/s in the ideal maneuver.
              </p>
            )}
            {experiment.kind === "heat" && (
              <p>
                After ten seconds: shielded backing {f(experiment.shieldK)} K;
                exposed assumed structure {f(experiment.exposedK)} K.
              </p>
            )}
            <p>{experiment.equation}</p>
            <p className="science-help">{experiment.limit}</p>
            <label htmlFor="academy-reflection">
              What changed, and what evidence supports your explanation?
            </label>
            <textarea
              id="academy-reflection"
              data-testid="academy-reflection"
              maxLength={2000}
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
            />
            <button
              className="ui-button"
              data-testid="academy-save"
              disabled={!reflection.trim()}
              onClick={complete}
            >
              Save lesson reflection
            </button>
          </div>
        )}
        <p role="alert">{error}</p>
        {progress.lessons[id] && (
          <details data-testid="academy-completed">
            <summary>Lesson reflection saved · inspect your record</summary>
            <p>
              Original prediction: {lesson.choices[progress.lessons[id].choice]}
            </p>
            <p>{progress.lessons[id].reflection}</p>
            <p>{progress.lessons[id].completedAt}</p>
          </details>
        )}
      </section>
      <div className="showcase-actions">
        <button className="ui-button" onClick={() => g.go("data")}>
          Inspect NASA data
        </button>
        <button className="ui-button" onClick={() => g.go("comparison")}>
          Compare flight models
        </button>
        <button className="ui-button" onClick={() => g.go("hangar")}>
          Build your spacecraft
        </button>
        <button
          className="ui-button"
          data-testid="academy-export"
          onClick={() => downloadJSON("missionforge-academy.json", progress)}
        >
          Export learning record
        </button>
      </div>
    </EducationShell>
  );
}
