import { useState } from "react";
import { EducationShell } from "../components/education/EducationShell";
import { BodyScience } from "../components/science/BodyScience";
import { NASA_DATA, orbitFacts } from "../science/catalog";
import { BODY_BY_ID, BODIES } from "../sim/solarSystem";
import { nasaDensity } from "../science/atmospheres";
import { downloadJSON } from "../sim/storage";
export default function NASADataExplorer() {
  const [body, setBody] = useState("earth"),
    [other, setOther] = useState("mars"),
    [height, setHeight] = useState(200);
  const valid =
      height !== "" &&
      Number.isFinite(Number(height)) &&
      Number(height) >= 0 &&
      Number(height) <= 100000,
    altitude = valid ? Number(height) * 1000 : null;
  const worlds = BODIES.filter((b) => NASA_DATA.bodies[b.id] && b.parent),
    f = (x) =>
      Number(x).toLocaleString(undefined, { maximumFractionDigits: 3 });
  return (
    <EducationShell title="NASA Data Explorer" testId="nasa-explorer">
      <span className="science-kicker">Source → conversion → simulation</span>
      <h1>See the numbers that change your flight.</h1>
      <p>
        Compare archived inputs at the same altitude. Source tags distinguish
        NASA-derived values from existing model inputs. These are spherical
        reference calculations, not current observations.
      </p>
      <div className="education-inputs">
        <label>
          World
          <select
            data-testid="data-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          >
            {worlds.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Compare with
          <select
            data-testid="data-compare"
            value={other}
            onChange={(e) => setOther(e.target.value)}
          >
            {worlds.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Altitude (km)
          <input
            data-testid="data-altitude"
            type="number"
            min="0"
            max="100000"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
        </label>
      </div>
      {!valid ? (
        <p role="alert">
          Enter 0–100,000 km. A reference orbit here does not guarantee it fits
          a body's sphere of influence.
        </p>
      ) : (
        <>
          <div className="education-grid" data-testid="data-comparison">
            {[body, other].map((id, i) => {
              const b = BODY_BY_ID[id],
                facts = orbitFacts(b, altitude),
                density = NASA_DATA.atmospheres[id]
                  ? nasaDensity(id, altitude)
                  : null;
              return (
                <section className="science-card" key={i}>
                  <h2>{b.name}</h2>
                  <dl className="science-facts">
                    <div>
                      <dt>Ideal circular speed</dt>
                      <dd>{f(facts.circularSpeed)} m/s</dd>
                    </div>
                    <div>
                      <dt>Period</dt>
                      <dd>{f(facts.period / 60)} min</dd>
                    </div>
                    <div>
                      <dt>Signed rotation</dt>
                      <dd>{f(b.rotation / 3600)} h</dd>
                    </div>
                    <div>
                      <dt>Archived atmospheric density here</dt>
                      <dd>
                        {density === null
                          ? "No imported density table"
                          : density.toExponential(4) + " kg/m³"}
                      </dd>
                    </div>
                  </dl>
                  <p>
                    Radius changes altitude/surface geometry; μ changes gravity,
                    speed and period; rotation changes the surface-relative
                    frame. Atmospheric density changes drag and dynamic
                    pressure.
                  </p>
                  <BodyScience body={b} altitude={altitude} open />
                  <p className="science-help">
                    Density tables have finite altitude ranges. A zero beyond
                    their cutoff is model behavior, not proof that no particles
                    exist.
                  </p>
                </section>
              );
            })}
          </div>
          <button
            className="ui-button"
            data-testid="data-export"
            onClick={() =>
              downloadJSON("missionforge-data-comparison.json", {
                kind: "nasa-data-comparison",
                altitudeMetres: altitude,
                bodies: [body, other].map((id) => ({
                  id,
                  sourceRecord: NASA_DATA.bodies[id],
                  appliedModel: {
                    radius: BODY_BY_ID[id].radius,
                    mu: BODY_BY_ID[id].mu,
                    rotation: BODY_BY_ID[id].rotation,
                  },
                  facts: orbitFacts(BODY_BY_ID[id], altitude),
                })),
                sources: NASA_DATA.sources,
                notice:
                  "Archived source values and ideal spherical calculations; not live observations.",
              })
            }
          >
            Export values, sources & calculation
          </button>
        </>
      )}
    </EducationShell>
  );
}
