import {
  validatePrecisionForces,
  validateRelativisticTrajectories,
} from "../../science/precisionValidation";
import { loadPrecisionFrames } from "../../sim/advanced/precisionFrames";
import { useState } from "react";
import {
  validateOrekit,
  validateAtmosphere,
  validateHarmonics,
  validateFrames,
  validateOcean,
  orekitReference,
} from "../../science/advancedValidation";
import { loadWeatherModel } from "../../sim/advanced/weatherAtmosphere";
import { downloadJSON } from "../../sim/storage";
export function AdvancedChecks() {
  const [results, setResults] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const run = async () => {
    setBusy(true);
    try {
      await Promise.all([loadWeatherModel(), loadPrecisionFrames()]);
      setResults({
        orbits: validateOrekit(),
        atmospheres: validateAtmosphere(),
        gravity: validateHarmonics(),
        frames: validateFrames(),
        ocean: validateOcean(),
        precision: validatePrecisionForces(),
        relativisticOrbits: validateRelativisticTrajectories(),
      });
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="science-check" data-testid="advanced-validation">
      <h3>External-tool reference checks</h3>
      <p>
        Four trajectories from actual Orekit {orekitReference.version} runs,
        including fixed-axis Earth J2, three degree-8 gravity force vectors,
        plus six independently compiled native-C atmosphere cases for the
        browser NRLMSISE-00 port.
      </p>
      <button
        className="ui-button"
        data-testid="advanced-checks-run"
        disabled={busy}
        onClick={run}
      >
        {busy
          ? "Loading local model & checking…"
          : "Run external reference checks"}
      </button>
      <p role="status">{error}</p>
      {results && (
        <>
          <p data-testid="advanced-checks-summary">
            {results.orbits.filter((r) => r.pass).length} / 4 Orekit cases and{" "}
            {results.atmospheres.filter((r) => r.pass).length} / 6 atmosphere
            cases pass.
          </p>
          <div className="science-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Orekit case</th>
                  <th>Max position error</th>
                  <th>Max velocity error</th>
                  <th>Game max position error</th>
                </tr>
              </thead>
              <tbody>
                {results.orbits.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.maxPositionError.toFixed(3)} m</td>
                    <td>{r.maxVelocityError.toFixed(6)} m/s</td>
                    <td>{r.maxGamePositionError.toFixed(3)} m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Across 20 checkpoints: 10 m / 0.01 m/s limits. These checks apply to
            the error-controlled propagator and its live game integration under
            central gravity or fixed-axis J2, with no atmosphere or third
            bodies.
          </p>
          <div className="science-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Altitude / F10.7 / Ap</th>
                  <th>Density (kg/m³)</th>
                  <th>Relative error</th>
                </tr>
              </thead>
              <tbody>
                {results.atmospheres.map((r, i) => (
                  <tr key={i}>
                    <td>
                      {r.altitude / 1000} km / {r.flux} / {r.ap}
                    </td>
                    <td>{r.density.toExponential(4)}</td>
                    <td>{r.relativeError.toExponential(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            {results.gravity.filter((r) => r.pass).length} / 3 normalized
            degree/order-8 gravity vectors match Orekit, maximum acceleration
            error{" "}
            {Math.max(
              ...results.gravity.map((r) => r.absoluteAccelerationError),
            ).toExponential(2)}{" "}
            m/s² (limit 10⁻⁸).
          </p>
          <p>
            IAU 2006/2000A frame matrix:{" "}
            {results.frames.pass ? "Pass" : "Needs attention"} · maximum element
            error {results.frames.maximumMatrixError.toExponential(2)} (limit
            10⁻¹²).
          </p>
          <p>
            {results.ocean.filter((r) => r.pass).length} / 3 ocean-tide
            coefficient cases match Orekit (degree-8 truncated FES2004; not full
            ocean loading).
          </p>
          <p data-testid="precision-checks-summary">
            {results.precision.forces.filter((r) => r.pass).length} / 5
            relativistic forces,{" "}
            {results.precision.eclipses.filter((r) => r.pass).length} / 27
            finite-Sun eclipses and{" "}
            {results.relativisticOrbits.filter((r) => r.pass).length} / 2
            three-period relativistic trajectories match Orekit.
          </p>
          <div className="science-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>1PN orbit</th>
                  <th>Direct error</th>
                  <th>Game error</th>
                  <th>Limit</th>
                </tr>
              </thead>
              <tbody>
                {results.relativisticOrbits.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.directPositionError.toFixed(3)} m</td>
                    <td>{r.gamePositionError.toFixed(3)} m</td>
                    <td>{r.positionTolerance} m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Three periods, four checkpoints per orbit; Earth and Mercury-like
            solar orbits. Eclipse fractions use a spherical occultor and uniform
            solar disk. These matched configurations do not establish real-world
            ephemeris accuracy.
          </p>
          <button
            className="ui-button"
            onClick={() =>
              downloadJSON("mission-forge-external-validation.json", results)
            }
          >
            Export measured checks
          </button>
        </>
      )}
      <div className="showcase-actions">
        <a href="/science/orekit-reference.json" download>
          Orekit states & configuration
        </a>
        <a href="/science/precision-reference.json" download>
          Relativity & eclipse references
        </a>
        <a href="/science/ocean-reference.json" download>
          Ocean coefficient reference cases
        </a>
        <a href="/science/msis-reference.json" download>
          Native atmosphere references
        </a>
        <a href="/science/egm96.json" download>
          Gravity coefficients & source
        </a>
      </div>
      <p>
        Atmosphere checks compare the same empirical model compiled separately
        to native C and WebAssembly; they test the port, not agreement with
        measured space weather. EGM96 additionally has the three Orekit
        force-vector checks. Tides and third-body options have separate unit
        checks; those effects are not covered by the four trajectory fixtures.
      </p>
    </article>
  );
}
