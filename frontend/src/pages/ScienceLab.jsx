import {AdvancedChecks} from "../components/science/AdvancedChecks";
import { useMemo, useState } from "react";
import { ArrowLeft, FlaskConical, Rocket, Download } from "lucide-react";
import { useGame } from "../game/GameContext";
import { DisplayButton } from "../components/app/Appearance";
import { EngineeringLab } from "../components/science/EngineeringLab";
import { BodyScience } from "../components/science/BodyScience";
import { BODIES, BODY_BY_ID } from "../sim/solarSystem";
import { NASA_DATA, orbitFacts } from "../science/catalog";
import {
  makePrediction,
  PREDICTIONS,
  LEARNING_QUESTION,
  readJournal,
} from "../science/learning";
import {
  runScienceValidation,
  runEngineeringValidation,
  benchmarks,
} from "../science/validation";
import { presetFalconLike } from "../sim/presets";
import { getMission } from "../sim/missions";
import { DEFAULT_PROFILE } from "../sim/guidance";
import { downloadJSON } from "../sim/storage";

export default function ScienceLab() {
  const g = useGame(),
    [tab, setTab] = useState("mission"),
    [bodyId, setBodyId] = useState("earth"),
    [altitude, setAltitude] = useState(200),
    [choice, setChoice] = useState(""),
    [speed, setSpeed] = useState(""),
    [checks, setChecks] = useState(null),
    [engineeringChecks, setEngineeringChecks] = useState(null),
    [error, setError] = useState("");
  const body = BODY_BY_ID[bodyId],
    facts = orbitFacts(body, altitude * 1000),
    earth = orbitFacts(BODY_BY_ID.earth, altitude * 1000);
  const journal = useMemo(() => readJournal(), []);
  const start = () => {
    try {
      if (speed.trim() === "")
        throw new Error("Enter your speed estimate first.");
      g.setLearningPrediction(makePrediction(choice, Number(speed)));
      g.setMissionId("first_orbit");
      g.setDifficulty("amateur");
      g.loadDesign(presetFalconLike());
      g.setProfile({
        ...DEFAULT_PROFILE,
        targetAltitude: 200000,
        targetInclination: getMission("first_orbit").target.inclination,
      });
      g.go("review");
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <div className="science-screen" data-testid="science-lab">
      <header className="workflow-header">
        <button
          className="ui-button ui-button-quiet"
          data-testid="science-home"
          onClick={() => g.go("menu")}
        >
          <ArrowLeft size={16} /> Home
        </button>
        <strong>
          <FlaskConical size={18} /> Mission Lab
        </strong>
        <DisplayButton compact />
      </header>
      <main className="science-layout">
        <div className="science-intro">
          <span className="science-kicker">
            Ask a question. Test it in flight.
          </span>
          <h1>Turn space data into understanding.</h1>
          <p>
            Predict an outcome, fly a mission, and explain what happened using
            evidence. Explore the NASA inputs and the checks behind the model.
          </p>
        </div>
        <div className="showcase-actions"><button className="ui-button" onClick={()=>g.go('academy')}>Mission Control Academy</button><button className="ui-button" onClick={()=>g.go('data')}>NASA Data Explorer</button><button className="ui-button" onClick={()=>g.go('comparison')}>Model comparison</button></div><nav className="science-tabs" aria-label="Mission Lab sections">
          {[
            ["mission", "Predict & fly"],
            ["data", "NASA data"],
            ["engineering", "Flight engineering"],
            ["validation", "Science checks"],
          ].map(([id, label]) => (
            <button
              key={id}
              className="ui-button"
              aria-pressed={tab === id}
              data-testid={`science-tab-${id}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        {tab === "mission" && (
          <section className="science-card" data-testid="showcase-mission">
            <span className="science-kicker">
              Showcase · First Orbit · Amateur
            </span>
            <h2>Getting to space is only half the journey.</h2>
            <p>
              A spacecraft is 200 km above Earth. Choose an explanation and
              estimate its circular-orbit speed before flying. Predictions help
              you learn; they do not change your mission score.
            </p>
            <label htmlFor="learning-choice">{LEARNING_QUESTION}</label>
            <select
              id="learning-choice"
              data-testid="learning-choice"
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
            >
              <option value="">Choose your prediction…</option>
              {PREDICTIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <label htmlFor="learning-speed">
              Your estimated orbital speed (m/s)
            </label>
            <input
              id="learning-speed"
              data-testid="learning-speed"
              type="number"
              min="0"
              max="20000"
              value={speed}
              onChange={(e) => setSpeed(e.target.value)}
              placeholder="Enter an estimate"
            />
            <p className="science-help">
              The showcase loads the tested Orbiter-9 starter with guidance.
              Review it, launch, select ×10, and let guidance reach orbit.
              Complete the mission to compare your prediction with recorded
              telemetry. Use Builder if you want to change the design.
            </p>
            <button
              className="ui-button ui-button-primary"
              data-testid="showcase-start"
              disabled={
                !choice ||
                speed.trim() === "" ||
                !Number.isFinite(Number(speed)) ||
                Number(speed) < 0 ||
                Number(speed) > 20000
              }
              onClick={start}
            >
              <Rocket size={17} /> Save prediction & review rocket
            </button>
            <p role="alert">{error}</p>
            <details className="science-notes">
              <summary>Presenter checklist</summary>
              <ol>
                <li>
                  State the learning problem: reaching space and staying in
                  orbit are different.
                </li>
                <li>
                  Show NASA radius and μ in the NASA data tab; compare Earth and
                  the Moon.
                </li>
                <li>
                  Save your prediction and launch the showcase. Explain staging
                  and sideways acceleration.
                </li>
                <li>
                  Open the orbit map and show periapsis above the atmosphere.
                </li>
                <li>
                  Complete the mission, explain the recorded outcome, save a
                  reflection, and export the report.
                </li>
              </ol>
              <p>
                For a network-independent demonstration, keep this build running
                locally. NASA source data is bundled; no live API key is needed.
              </p>
            </details>
            <h3>Your local learning journal</h3>
            <p>
              {journal.length
                ? `${journal.length} completed learning flights stored on this browser.`
                : "No completed learning flights yet. Your first reflection will appear here."}
            </p>
            {journal.map((entry) => (
              <article className="journal-entry" key={entry.prediction.id}>
                <strong>
                  {entry.reachedOrbit
                    ? "Stable orbit observed"
                    : "Orbit not demonstrated"}
                </strong>
                <p>{entry.explanation}</p>
                {entry.reflection && <p>Your reflection: {entry.reflection}</p>}
              </article>
            ))}
            <button
              className="ui-button"
              disabled={!journal.length}
              data-testid="learning-export-journal"
              onClick={() =>
                downloadJSON("mission-forge-learning-journal.json", {
                  version: 1,
                  entries: readJournal(),
                })
              }
            >
              <Download size={16} /> Export learning journal
            </button>
          </section>
        )}
        {tab === "data" && (
          <section className="science-card" data-testid="science-data-panel">
            <h2>Different worlds. Different flight decisions.</h2>
            <p>
              The same altitude requires different orbital speeds because each
              world has a different size and gravitational parameter.
            </p>
            <div className="science-inputs">
              <label>
                World
                <select
                  data-testid="science-body"
                  value={bodyId}
                  onChange={(e) => setBodyId(e.target.value)}
                >
                  {BODIES.filter((b) => b.parent).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Comparison altitude (km)
                <input
                  data-testid="science-altitude"
                  type="range"
                  min="200"
                  max="2000"
                  step="25"
                  value={altitude}
                  onChange={(e) => setAltitude(Number(e.target.value))}
                />
                <output>{altitude} km</output>
              </label>
            </div>
            <div className="science-comparison">
              <div>
                <span>{body.name} · circular speed</span>
                <strong data-testid="science-selected-speed">
                  {Math.round(facts.circularSpeed).toLocaleString()} m/s
                </strong>
                <small>Period: {(facts.period / 60).toFixed(1)} min</small>
              </div>
              <div>
                <span>Earth at the same altitude</span>
                <strong>
                  {Math.round(earth.circularSpeed).toLocaleString()} m/s
                </strong>
                <small>
                  {(facts.circularSpeed / earth.circularSpeed).toFixed(2)}×
                  Earth speed
                </small>
              </div>
            </div>
            <p className="science-help">
              These are ideal two-body comparison orbits, not a promise that a
              safe orbit fits inside every moon’s sphere of influence or above
              every atmosphere. Gas giants have a reference radius, not a
              landing surface.
            </p>
            {body.custom&&<p className="science-help">Locally authored world: these are your model inputs, not NASA measurements.</p>}
            <BodyScience
              body={body}
              altitude={altitude * 1000}
              open
              key={bodyId}
            />
            <details className="science-notes">
              <summary>Dataset provenance & model boundaries</summary>
              <p>
                Imported {NASA_DATA.retrievedAt} from NASA’s official GMAT
                repository, commit <code>{NASA_DATA.commit}</code>. All seven
                source snapshots and their SHA-256 hashes are included with the
                project. The copy of pck00011 is dated 2022-12-27; import date
                does not imply a new measurement.
              </p>
              {NASA_DATA.sources.map((source) => (
                <div key={source.id}>
                  <a
                    href={source.repositoryUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {source.name} ↗
                  </a>
                  <p>{source.fields}</p>
                  <code className="science-hash">SHA-256 {source.sha256}</code>
                </div>
              ))}
              <ul>
                {NASA_DATA.limits.map((limit) => (
                  <li key={limit}>{limit}</li>
                ))}
              </ul>
              <p>
                The scored Earth mission uses the NASA-derived radius rounded to
                the nearest kilometre. Moon missions and exploration use the
                imported spherical radii. NASA does not endorse this project.
              </p>
            </details>
          </section>
        )}
        {tab === "engineering" && <EngineeringLab />}
        {tab === "validation" && (
          <section
            className="science-card"
            data-testid="science-validation-panel"
          >
            <h2>What has actually been checked?</h2>
            <AdvancedChecks />
            <p>
              Compare JavaScript results with independently generated 60-digit
              Python Decimal benchmarks for Earth, Moon, and Mars. Then coast
              the actual exploration integrator for one full orbit and measure
              closure and specific-energy drift.
            </p>
            <p className="science-help">
              The benchmarks use NASA inputs and analytic two-body equations.
              They are not measured spacecraft tracks, published mission
              validation results, or evidence that all physical effects are
              accurate.
            </p>
            <button
              className="ui-button ui-button-primary"
              data-testid="science-run-checks"
              onClick={() => {
                setChecks(runScienceValidation());
                setEngineeringChecks(runEngineeringValidation());
              }}
            >
              Run science checks
            </button>
            {checks && (
              <>
                <p role="status" data-testid="science-check-summary">
                  {checks.every((c) => c.pass) &&
                  engineeringChecks?.every((row) => row.pass)
                    ? "All 3 orbital cases and 6 engineering checks pass"
                    : "A benchmark case needs attention"}
                </p>
                {checks.map((check) => (
                  <article
                    className="science-check"
                    key={check.body}
                    data-testid={`science-check-${check.body}`}
                    data-status={check.pass ? "pass" : "fail"}
                  >
                    <h3>
                      {check.name} · {check.altitude / 1000} km ·{" "}
                      {check.pass ? "Pass" : "Needs attention"}
                    </h3>
                    <div className="science-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Quantity</th>
                            <th>Reference</th>
                            <th>Game</th>
                            <th>Relative error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {check.analytic.map((row) => (
                            <tr key={row.name}>
                              <td>{row.name}</td>
                              <td>
                                {row.expected.toFixed(3)} {row.unit}
                              </td>
                              <td>
                                {row.actual.toFixed(3)} {row.unit}
                              </td>
                              <td>{row.error.toExponential(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p>
                      One-orbit closure error:{" "}
                      {(check.integration.closure * 100).toFixed(6)}% of orbital
                      radius (limit 0.2%). Specific-energy drift:{" "}
                      {(check.integration.energyError * 100).toFixed(6)}% (limit
                      0.02%). Analytic relative-error limit: 10⁻¹⁰.
                    </p>
                  </article>
                ))}
                {engineeringChecks && (
                  <article
                    className="science-check"
                    data-testid="engineering-checks"
                  >
                    <h3>
                      Engineering references ·{" "}
                      {engineeringChecks.filter((row) => row.pass).length} /{" "}
                      {engineeringChecks.length} pass
                    </h3>
                    <p>
                      Independent Decimal references for archived atmospheric
                      density, the ideal rocket equation, and the two-burn
                      transfer. Relative-error limit: 10⁻¹⁰.
                    </p>
                    <div className="science-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Quantity</th>
                            <th>Game / reference</th>
                            <th>Relative error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {engineeringChecks.map((row) => (
                            <tr key={row.name}>
                              <td>{row.name}</td>
                              <td>
                                {row.actual.toExponential(5)} /{" "}
                                {row.expected.toExponential(5)} {row.unit}
                              </td>
                              <td>
                                {row.error.toExponential(2)} ·{" "}
                                {row.pass ? "Pass" : "Needs attention"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                )}
                <button
                  className="ui-button"
                  data-testid="science-export-checks"
                  onClick={() =>
                    downloadJSON("mission-forge-science-checks.json", {
                      at: new Date().toISOString(),
                      sourceCommit: NASA_DATA.commit,
                      method: benchmarks.method,
                      checks,
                      engineeringChecks,
                    })
                  }
                >
                  <Download size={16} /> Export check results
                </button>
              </>
            )}
            <details className="science-notes">
              <summary>Equations, assumptions & untested effects</summary>
              <p>
                Circular speed v = √(μ/r), escape speed vₑ = √(2μ/r), period T =
                2π√(r³/μ), specific energy ε = v²/2 − μ/r. Radius is measured
                from the body centre. Closed-form references are generated
                outside the JavaScript code.
              </p>
              <p>
                Exploration uses patched spheres of influence, fixed Kepler
                ephemerides, RK4 integration, finite fuel, and simplified
                atmospheres. Scored missions add their existing J2, staging,
                guidance, and re-entry models. This check exercises ideal
                coasting, not drag, atmospheric entry, RCS hardware, measured
                ephemeris accuracy, or human learning outcomes.
              </p>
            </details>
          </section>
        )}

      </main>
    </div>
  );
}
