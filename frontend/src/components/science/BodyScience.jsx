import { AtmosphereCard } from "./AtmosphereCard";
import { SourceDetails } from "./SourceDetails";
import { NASA_DATA, sourceFor, orbitFacts } from "../../science/catalog";

const number = (value, digits = 2) =>
  Number(value).toLocaleString("en-US", { maximumFractionDigits: digits });
export function BodyScience({ body, altitude = 200000, open = false }) {
  const data = NASA_DATA.bodies[body.id],
    facts = orbitFacts(body, altitude);
  if (!data) return null;
  return (
    <details
      className="body-science"
      open={open || undefined}
      data-testid={`body-science-${body.id}`}
    >
      <summary>Data & science · {body.name}</summary>
      <div className="body-science-content">
        <p className="science-kicker">NASA data → your flight</p>
        <dl className="science-facts">
          <div>
            <dt>Spherical radius</dt>
            <dd>
              {number(body.radius / 1000, 3)} km
              <SourceDetails
                sourceId={data.radiusSource}
                field={`BODY${data.naifId}_RADII`}
                units="km"
                conversion="1000 × (a × b × c)⅓ → metres"
              />
            </dd>
          </div>
          <div>
            <dt>Gravitational parameter (μ)</dt>
            <dd>
              {body.mu.toExponential(7)} m³/s²
              <SourceDetails
                sourceId={data.muSource}
                field={data.muField}
                units="km³/s²"
                conversion="×10⁹ → m³/s²"
              />
            </dd>
          </div>
          <div>
            <dt>Gravity at model surface</dt>
            <dd>{number(facts.gravity, 3)} m/s²</dd>
          </div>
          <div>
            <dt>Ideal speed at {number(altitude / 1000)} km</dt>
            <dd data-testid="science-circular-speed">
              {number(facts.circularSpeed, 1)} m/s
            </dd>
          </div>
        </dl>
        <p>
          Radius sets the surface and your altitude. μ sets gravitational
          acceleration and the speed needed to stay in orbit. These are inputs
          to the simulation, rather than decorative statistics.
        </p>
        <p>
          <strong>Radius source:</strong> JPL/NAIF pck00011, BODY{data.naifId}
          _RADII = {data.radiiKm.join(" × ")} km. We use the volume-equivalent
          sphere (a × b × c)⅓.
        </p>
        {Math.abs(body.radius - data.radius) > 0.01 && (
          <p>
            The scored mission rounds this imported radius to the nearest
            kilometre; exploration uses the unrounded value.
          </p>
        )}
        <p>
          <strong>Gravity source:</strong>{" "}
          {data.muSource
            ? `NASA GMAT ${data.muField} = ${data.muKm3s2} km³/s²; converted to m³/s² by ×10⁹.`
            : "Existing game model value; not verified by the imported NASA files."}
        </p>
        <div>
          <SourceDetails
            sourceId={data.rotationSource}
            field={data.rotationField}
            units="degrees/day"
            conversion="86400 × 360 / rate → signed seconds"
          />
          <strong>Rotation source:</strong> {data.rotationField}[1] ={" "}
          {data.rotationRateDegDay}°/day gives a signed period of{" "}
          {(data.rotation / 3600).toFixed(3)} hours. Exploration uses the linear
          rate, with a simplified spin axis; periodic orientation terms are
          omitted.
        </div>
        {NASA_DATA.atmospheres[body.id] && (
          <div>
            <SourceDetails
              sourceId={NASA_DATA.atmospheres[body.id].source}
              field="altitude, density, scale height"
              units="km, kg/m³, km"
              conversion="altitude and scale height ×1000 → m; exponential band evaluation"
            />
            <strong>Density source:</strong> NASA GMAT’s {body.name} table
            provides {NASA_DATA.atmospheres[body.id].bands.length} exponential
            bands. Default exploration uses those bands for drag; the optional
            Earth NRLMSISE model can replace them. Flight engineering shows the
            model and units.
          </div>
        )}
        <p>
          <strong>Model limits:</strong> spherical bodies; fixed Kepler orbits;
          linear rotation with a simplified axis. Earth/Mars density uses
          archived NASA models; other atmospheres remain game approximations.
          Surface gravity excludes rotation and oblateness.
        </p>
        <AtmosphereCard body={body} />
        <p className="science-equation">
          v = √(μ / r) · T = 2π√(r³ / μ) · r = radius + altitude
        </p>
        <div className="science-source-links">
          {[data.radiusSource, data.muSource].filter(Boolean).map((id) => {
            const source = sourceFor(id);
            return (
              <a
                key={id}
                href={source.repositoryUrl}
                target="_blank"
                rel="noreferrer"
              >
                {source.name} ↗
              </a>
            );
          })}
          <a href="/science/planetary-data.json" download>
            Download dataset & provenance
          </a>
          <a href="/science/analysis.csv" download>
            Download body analysis CSV
          </a>
        </div>
        <small>
          Retrieved {NASA_DATA.retrievedAt} · pinned NASA repository snapshot ·
          not a live ephemeris.
        </small>
      </div>
    </details>
  );
}
