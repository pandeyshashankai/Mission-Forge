import loadingStations from '../../science/data/loading-stations.json';
import { tpsxData, tpsxMaterial } from "../../sim/advanced/tpsx";
import { calibrateThermal, aluminium } from "../../sim/advanced/materials";
import { GRAVITY_DATA } from "../../sim/advanced/harmonics";
import { SourceDetails } from "../science/SourceDetails";
import { useState } from "react";
import {
  loadWeatherModel,
  weatherReady,
} from "../../sim/advanced/weatherAtmosphere";
export function PhysicsSettings({ sim, onChange: applyChange, onDrag }) {
  const p = sim.physics,
    r = sim.resources(),
    [modelStatus, setModelStatus] = useState("");
  const onChange = (value) => {
    try {
      applyChange(value);
    } catch (e) {
      setModelStatus(e.message);
    }
  };
  return (
    <details className="engineering-inspector" data-testid="advanced-physics">
      <summary>Physics & spacecraft systems</summary>
      <div className="showcase-actions">
        {[
          [
            "Game",
            {
              relativity: false,
              j2: false,
              harmonicDegree: 0,
              tides: false,
              thirdBody: false,
              srp: false,
              integrator: "rk4",
              atmosphere: "nasa",
            },
          ],
          [
            "Accurate",
            {
              j2: true,
              harmonicDegree: 0,
              tides: false,
              thirdBody: false,
              srp: false,
              integrator: "accurate",
              atmosphere: "nasa",
            },
          ],
          [
            "Perturbed",
            {
              j2: false,
              relativity: true,
              harmonicDegree: 8,
              tides: true,
              thirdBody: true,
              srp: true,
              integrator: "accurate",
              atmosphere: "msis",
            },
          ],
        ].map(([label, options]) => (
          <button
            className="ui-button"
            key={label}
            onClick={async () => {
              try {
                if (options.atmosphere === "msis") await loadWeatherModel();
                onChange({ ...p, ...options });
                setModelStatus("");
              } catch (e) {
                setModelStatus(e.message);
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p>
        Independent local simulation options. Changing a model cuts active
        assisted burns. Solar-system trajectories remain approximate Kepler
        elements.
      </p>
      {[
        ["j2", "Earth oblateness (J2)"],
        ["relativity", "Relativistic central gravity (1PN)"],
        ["damage", "Thermal & structural failure"],
        ["thirdBody", "Differential Sun/Moon/parent gravity"],
        ["srp", "Solar radiation pressure + eclipses"],
        ["tides", "Elastic Earth tide"],
        ["oceanTides", "Ocean-tide gravity · FES2004 degree 8"],
        ["advancedTides", "Degree 3 + lagged elastic tide"],
        ["power", "Battery & solar power"],
        ["communications", "Ground-link ignition lock"],
      ].map(([id, label]) => (
        <label className="simulation-option" key={id}>
          <span>{label}</span>
          <input
            data-testid={`physics-${id}`}
            type="checkbox"
            checked={p[id]}
            onChange={(e) => onChange({ ...p, [id]: e.target.checked })}
          />
        </label>
      ))}
      <label className="simulation-option">
        Apply atmospheric drag
        <input
          type="checkbox"
          checked={sim.dragEnabled}
          onChange={(e) => onDrag(e.target.checked)}
        />
      </label>
      <label className="simulation-option">
        Ephemerides
        <select
          value={p.ephemeris}
          onChange={(e) => onChange({ ...p, ephemeris: e.target.value })}
        >
          <option value="kepler">Approximate Kepler</option>
          <option value="de421">JPL DE421 · January 2000 pack</option>
        </select>
      </label>
      {p.ephemeris === "de421" && (
        <p>
          Hourly JPL DE421 interpolation, January 2000 only. Outer planets use
          system barycentres. Uncovered custom bodies/Europa/Titan retain Kepler
          paths. TDB epoch; time-scale conversion and high-degree Earth
          orientation remain approximate.
        </p>
      )}
      <label className="simulation-option">
        Integrator
        <select
          aria-label="Exploration integrator"
          data-testid="physics-integrator"
          value={p.integrator}
          onChange={(e) => onChange({ ...p, integrator: e.target.value })}
        >
          <option value="rk4">Game · RK4</option>
          <option value="accurate">Accurate · error controlled</option>
        </select>
      </label>
      <label className="simulation-option">
        Earth harmonics
        <select
          aria-label="Earth spherical harmonics degree"
          data-testid="physics-harmonics"
          value={p.harmonicDegree}
          onChange={(e) =>
            onChange({ ...p, harmonicDegree: Number(e.target.value) })
          }
        >
          <option value="0">Off · use J2 switch</option>
          <option value="2">Degree/order 2</option>
          <option value="4">Degree/order 4</option>
          <option value="8">Degree/order 8</option>
        </select>
      </label>
      {p.harmonicDegree > 0 && (
        <>
          <p>
            Archived EGM96 fully normalized coefficients, truncated to the
            chosen degree/order. Replaces the separate J2 term; fixed +Z spin
            frame and finite-difference potential gradient.
          </p>
          <SourceDetails
            sourceOverride={GRAVITY_DATA.source}
            field="RECOEF n m C̄nm S̄nm"
            units="dimensionless"
            conversion="Fully normalized Legendre expansion; SI potential gradient"
          />
        </>
      )}
      {p.relativity && (
        <p>
          First post-Newtonian Schwarzschild correction around the current
          primary. No frame dragging or multi-body relativistic terms. Its small
          effect needs long or fast orbits to resolve.
        </p>
      )}
      {p.srp && (
        <p>
          Finite apparent solar disk with gradual penumbra and annular eclipses.
          Uniform brightness; no limb darkening or refraction. Primary and
          parent are checked; simultaneous partial shadows use the strongest
          obscuration.
        </p>
      )}
      {p.advancedTides && (
        <label className="simulation-option">
          Tidal response lag (s)
          <input
            type="number"
            min="0"
            max="600"
            value={p.tideLag}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n >= 0 && n <= 600) onChange({ ...p, tideLag: n });
            }}
          />
        </label>
      )}
      {p.advancedTides && (
        <p>
          Enable Earth tides above. Adds degree 3 with assumed k₃=0.093 and an
          adjustable body-rotating constant time lag. This is not an IERS
          frequency-dependent or ocean-loading model.
        </p>
      )}
      {p.oceanTides && (
        <p>
          FES2004 coefficient variations: 18 constituents, degree/order 8. This
          test dataset is explicitly truncated; it is not full global ocean
          loading. Earth spin/time scales remain simplified.
        </p>
      )}
      <label className="simulation-option">
        Thermal material
        <select
          value={p.thermalMaterial}
          onChange={(e) => onChange({ ...p, thermalMaterial: e.target.value })}
        >
          <option value="baseline">Illustrative baseline</option>
          <option value="aluminium">NASA CEA crystalline aluminium</option>
          <option value="pica-virgin">PICA virgin · TPSX constants</option>
          <option value="avcoat-virgin">AVCOAT virgin · TPSX constants</option>
          <option value="avcoat-char">AVCOAT char · TPSX constants</option>
          <option value="calibrated" disabled={!sim.thermalCalibration}>
            Imported experimental fit
          </option>
        </select>
      </label>
      {tpsxData.materials.some((m) => m.id === p.thermalMaterial) && (
        <div data-testid="tpsx-material-details">
          <p>
            {tpsxData.materials.find((m) => m.id === p.thermalMaterial).name} ·
            screenshot-transcribed TPSX properties. Two-node conduction with
            assumed 8 m² area, 120 kg initial shield and 180 kJ/K backing
            capacity. No automatic charring or NuSil coating model.
          </p>
          <p>
            Surface {sim.damage.temperature.toFixed(1)} K · backing{" "}
            {sim.damage.backTemperature.toFixed(1)} K · remaining shield
            thickness{" "}
            {sim.damage.shieldKg > 0
              ? (
                  1000 *
                  tpsxMaterial(p.thermalMaterial, sim.damage.shieldKg).thickness
                ).toFixed(1)
              : "0"}{" "}
            mm.
          </p>
          <dl>
            {Object.entries(
              tpsxData.materials.find((m) => m.id === p.thermalMaterial)
                .properties,
            ).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>
                  {value.value} {value.unit} · source: {value.source} ·
                  conditions: {value.conditions}
                </dd>
              </div>
            ))}
          </dl>
          <p>
            Constant-property approximation; temperature dependence and
            experimental calibration unavailable. PICA recession is disabled
            because its ablation-energy data is missing. AVCOAT virgin uses 23.8
            MJ/kg with an assumed 900 K onset.
          </p>
          <a href="/science/tpsx-user.json" download>
            Download properties and evidence labels
          </a>
        </div>
      )}
      {p.thermalMaterial === "aluminium" && (
        <p>
          {aluminium.reference}. Temperature-dependent specific heat, valid
          300–933.61 K, assumed 200 kg effective structural mass. Properties
          clamp at the fit boundary; integrity degrades above melting. Shield
          properties and emissivity remain assumptions, not calibrated flight
          hardware.
        </p>
      )}
      <label className="simulation-option">
        Import thermal measurements
        <input
          type="file"
          accept="application/json,.json"
          onChange={async (e) => {
            try {
              const f = e.target.files?.[0];
              if (!f) return;
              if (sim.recording?.active)
                throw Error("Stop recording before importing calibration");
              if (f.size > 1000000)
                throw Error("Calibration file exceeds 1 MB");
              const d = JSON.parse(await f.text());
              sim.thermalCalibration = calibrateThermal(d.records, d);
              setModelStatus(
                `Calibration fit accepted: ${sim.thermalCalibration.heldoutCount} held-out points, RMS ${sim.thermalCalibration.heldoutRmsW.toFixed(3)} W. Source: ${sim.thermalCalibration.source}`,
              );
            } catch (error) {
              setModelStatus(error.message);
            } finally {
              e.target.value = "";
            }
          }}
        />
      </label>
      {p.tides && (
        <p>
          Instantaneous elastic solid-Earth quadrupole response to Sun/Moon,
          assumed k₂=0.3. No ocean loading, lag, frequency corrections or
          precision Earth orientation.
        </p>
      )}
      <label className="simulation-option">
        Earth atmosphere
        <select
          aria-label="Earth atmosphere model"
          data-testid="physics-atmosphere"
          value={p.atmosphere}
          onChange={async (e) => {
            const atmosphere = e.target.value;
            try {
              setModelStatus("Loading local model…");
              if (atmosphere === "msis") await loadWeatherModel();
              onChange({ ...p, atmosphere });
              setModelStatus("");
            } catch (error) {
              setModelStatus(error.message);
            }
          }}
        >
          <option value="nasa">NASA GMAT bands</option>
          <option value="msis">NRLMSISE-00 · space weather</option>
        </select>
      </label>
      {p.atmosphere === "msis" && (
        <>
          <p>
            {weatherReady()
              ? "NRLMSISE loaded locally"
              : "NRLMSISE loading; flight is held until ready."}
          </p>
          {[
            ["f107", "Daily F10.7 (sfu)"],
            ["f107a", "81-day mean F10.7 (sfu)"],
            ["ap", "Daily Ap"],
          ].map(([key, label]) => (
            <label className="simulation-option" key={key}>
              {label}
              <input
                aria-label={label}
                type="number"
                min={key === "ap" ? 0 : 50}
                max="400"
                value={p[key]}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n >= (key === "ap" ? 0 : 50) && n <= 400)
                    onChange({ ...p, [key]: n });
                }}
              />
            </label>
          ))}
          <p>
            NRLMSISE-00 is an empirical Earth model, using entered F10.7/Ap
            values, model latitude/longitude and simulation epoch. Defaults are
            illustrative model inputs, not live observations. Spherical altitude
            and simplified Earth orientation remain assumptions. Mars keeps NASA
            bands.
          </p>
          <a
            href="/science/models/LICENSE-NRLMSISE.txt"
            target="_blank"
            rel="noreferrer"
          >
            Model license & original attribution
          </a>
        </>
      )}
      {sim.damage.propertyRangeExceeded && (
        <p role="alert">
          Temperature left the selected material data range. Results beyond that
          point are unvalidated.
        </p>
      )}
      <p role="status">{modelStatus}</p>
      {p.damage && (
        <p data-testid="damage-status">
          Temperature {sim.damage.temperature.toFixed(0)} K · shield{" "}
          {sim.damage.shieldKg.toFixed(1)} kg · integrity{" "}
          {(100 * sim.damage.integrity).toFixed(0)}%. Educational fixed-material
          model: Earth-air heating, radiation cooling, ablation, pressure and
          acceleration overload. Other atmospheres have pressure damage only.
        </p>
      )}
      <label className="simulation-option">Ground station loading<select data-testid="physics-ocean-loading" value={p.oceanLoading?'onsala':'off'} onChange={e=>onChange({...p,oceanLoading:e.target.value==='off'?null:{station:loadingStations.stations[0],ttMinusUt1:64.184}})}><option value="off">Illustrative equatorial station (default)</option><option value="onsala">Onsala · 342-constituent ocean loading</option></select></label><p>Station displacement is independent of the ocean-gravity switch. Flight uses its simplified spin frame and an explicit 64.184 s TT−UT1 assumption. Use the loading laboratory for imported BLQ stations and time inputs.</p>
      <dl>
        <div>
          <dt>Battery</dt>
          <dd>{r.batteryWh.toFixed(1)} / {r.capacityWh} Wh</dd>
        </div>
        <div>
          <dt>Illumination</dt>
          <dd>
            {r.lit <= 0
              ? "Umbra"
              : r.lit >= 1
                ? "Sunlit"
                : `Penumbra · ${(100 * r.lit).toFixed(1)}% sunlight`}
          </dd>
        </div>
        <div>
          <dt>Solar / consumption</dt>
          <dd>
            {r.solarWatts.toFixed(0)} / {r.loadWatts.toFixed(0)} W
          </dd>
        </div>
        {r.link && (
          <>
            <div>
              <dt>Earth ground link</dt>
              <dd>{r.link.connected ? "Connected" : "Unavailable"}</dd>
            </div>
            <div>
              <dt>One-way light time</dt>
              <dd>{r.link.delay.toFixed(2)} s</dd>
            </div>
          </>
        )}
      </dl>
      <p>
        Illustrative resources: {sim.craft.power?.solarWatts ?? 800} W array at 1 AU, {sim.craft.power?.batteryWh ?? 1200} Wh battery,
        fixed loads. The equatorial Earth station has line-of-sight and 2 AU
        range. Light time is displayed; commands are not delayed. Ground-link
        mode blocks ignition, not onboard coasting. Earth J2 uses a fixed +Z
        axis; the optional 1PN correction applies around any primary.
      </p>
      {sim.integrationStats && (
        <p>
          {sim.integrationStats.accepted} accepted /{" "}
          {sim.integrationStats.rejected} rejected substeps,{" "}
          {sim.integrationStats.evaluations} acceleration evaluations in the
          last physics step.
        </p>
      )}
    </details>
  );
}
