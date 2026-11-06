import { NASA_DATA, sourceFor } from "../../science/catalog";
const COMPOSITION = {
  earth: "Nitrogen and oxygen dominate.",
  mars: "Carbon dioxide dominates.",
  venus: "Carbon dioxide dominates.",
  titan: "Mostly nitrogen, with methane.",
};
export function AtmosphereCard({ body }) {
  const model = body.atmosphere,
    table = NASA_DATA.atmospheres[body.id],
    first = table?.bands[0],
    rho = first?.density ?? model?.rho,
    height = first?.scaleHeight ?? model?.height;
  return (
    <details className="atmosphere-overview">
      <summary>Atmosphere overview · {body.name}</summary>
      {!model ? (
        <p>
          {body.id === "sun"
            ? "The stellar photosphere is a reference surface; no solar atmosphere or landing model is provided."
            : body.gas
              ? "The reference radius is not a solid surface. This game does not provide a gas-giant atmosphere profile."
              : "This model applies no atmospheric drag here; any physical exosphere is omitted."}
        </p>
      ) : (
        <>
          <dl>
            <div>
              <dt>Surface model density</dt>
              <dd>{rho.toExponential(3)} kg/m³</dd>
            </div>
            <div>
              <dt>Near-surface density scale height</dt>
              <dd>{(height / 1000).toFixed(2)} km</dd>
            </div>
            <div>
              <dt>Hydrostatic pressure scale</dt>
              <dd>
                {(((rho * body.mu) / body.radius ** 2) * height).toFixed(0)} Pa
              </dd>
            </div>
          </dl>
          <p>
            {COMPOSITION[body.id] ||
              "Composition is not specified by this model."}{" "}
            This qualitative context is separate from the imported density
            tables.
          </p>
          <p>
            Pressure is the estimate ρ × g × H, not an imported pressure
            measurement or a full vertical-column calculation.{" "}
            {table
              ? `${table.bands.length} archived exponential bands drive the default density.`
              : "A single exponential scale-height approximation drives this atmosphere."}{" "}
            Optional Earth NRLMSISE settings replace the default density during
            flight.
          </p>
          {table && (
            <a
              href={sourceFor(table.source).repositoryUrl}
              target="_blank"
              rel="noreferrer"
            >
              Pinned density table ↗
            </a>
          )}
        </>
      )}
    </details>
  );
}
