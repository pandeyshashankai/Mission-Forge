import {
  loadPrecisionFrames,
  standardsRotation,
  applyMatrix,
  transpose,
} from "../../sim/advanced/precisionFrames";
import frameReference from "../../science/data/frame-reference.json";
import { useState } from "react";
import { BODY_BY_ID } from "../../sim/solarSystem";
import { toBodyFixed, fromBodyFixed } from "../../sim/advanced/frames";
export function FrameLab() {
  const [standards, setStandards] = useState(null),
    [status, setStatus] = useState(""),
    [tt, setTT] = useState(53736),
    [ut, setUT] = useState(53736),
    [xp, setXp] = useState((frameReference.input.xp * 180 * 3600) / Math.PI),
    [yp, setYp] = useState((frameReference.input.yp * 180 * 3600) / Math.PI);
  const [time, setTime] = useState(0),
    body = BODY_BY_ID.earth,
    r = [body.radius + 400000, 0, 0],
    v = [0, Math.sqrt(body.mu / r[0]), 0];
  const fixed = toBodyFixed(r, v, time, body),
    back = fromBodyFixed(fixed.r, fixed.v, time, body);
  return (
    <section>
      <h2>Reference-frame workbench</h2>
      <p>
        Convert a sample 400 km orbit between the game's simplified inertial
        frame and a rotating Earth-fixed frame, including the rotational
        velocity term.
      </p>
      <label>
        Seconds after model epoch
        <input
          className="subassembly-name"
          type="number"
          value={time}
          onChange={(e) =>
            setTime(
              Number.isFinite(Number(e.target.value))
                ? Math.max(-1e12, Math.min(1e12, Number(e.target.value)))
                : 0,
            )
          }
        />
      </label>
      <table className="sandbox-table">
        <thead>
          <tr>
            <th>State</th>
            <th>Position x/y/z (m)</th>
            <th>Velocity x/y/z (m/s)</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["Inertial", r, v],
            ["Earth fixed", fixed.r, fixed.v],
            ["Round trip", back.r, back.v],
          ].map(([name, r, v]) => (
            <tr key={name}>
              <th>{name}</th>
              <td>{r.map((x) => x.toFixed(2)).join(" / ")}</td>
              <td>{v.map((x) => x.toFixed(2)).join(" / ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        v_fixed = R(−ωt) [v_inertial − ω × r]. The imported linear rotation
        period drives ω. This tool does not include IERS Earth orientation,
        polar motion, precession/nutation or precision ITRF/GCRF
        transformations.
      </p>
      <h3>IAU 2006 / 2000A standards-frame experiment</h3>
      <p>
        GCRS celestial-to-ITRS terrestrial rotation, with precession/nutation,
        Earth rotation angle and polar motion. TT, UT1 and polar-motion inputs
        are explicit. Defaults reproduce a published reference-test case, not
        current Earth observations.
      </p>
      <div className="sandbox-form">
        {[
          ["TT modified Julian date", tt, setTT],
          ["UT1 modified Julian date", ut, setUT],
          ["Polar motion xp (arcsec)", xp, setXp],
          ["Polar motion yp (arcsec)", yp, setYp],
        ].map(([label, value, set]) => (
          <label key={label}>
            {label}
            <input
              type="number"
              step="0.00001"
              value={value}
              onChange={(e) => set(Number(e.target.value))}
            />
          </label>
        ))}
      </div>
      <button
        className="ui-button"
        data-testid="precision-frames-run"
        onClick={async () => {
          try {
            setStatus("Loading local standards library…");
            await loadPrecisionFrames();
            const matrix = standardsRotation({
              tta: 2400000.5,
              ttb: tt,
              uta: 2400000.5,
              utb: ut,
              xp: (xp * Math.PI) / (180 * 3600),
              yp: (yp * Math.PI) / (180 * 3600),
            });
            setStandards(matrix);
            setStatus("Standards rotation calculated locally.");
          } catch (e) {
            setStatus(e.message);
          }
        }}
      >
        Calculate standards rotation
      </button>
      <p role="status">{status}</p>
      {standards && (
        <>
          <div className="science-table-wrap">
            <table className="sandbox-table">
              <tbody>
                {standards.map((row, i) => (
                  <tr key={i}>
                    {row.map((x, j) => (
                      <td key={j}>{x.toFixed(12)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p data-testid="precision-frame-result">
            Terrestrial position:{" "}
            {applyMatrix(standards, r)
              .map((x) => x.toFixed(3))
              .join(" / ")}{" "}
            m. Round-trip position error:{" "}
            {Math.hypot(
              ...applyMatrix(
                transpose(standards),
                applyMatrix(standards, r),
              ).map((x, i) => x - r[i]),
            ).toExponential(2)}{" "}
            m.
          </p>
        </>
      )}
      <p>
        Uses unchanged TSOFA 18.1.0 routines derived from IAU SOFA; MissionForge
        is not software supplied or endorsed by SOFA.{" "}
        <a
          href="/science/models/tsofa/LICENSE-readable.txt"
          target="_blank"
          rel="noreferrer"
        >
          Full license and original attribution
        </a>
        . Current EOP and leap-second/UTC conversion data must be supplied
        independently; this positional workbench does not replace the game's
        simplified spin model.
      </p>
    </section>
  );
}
