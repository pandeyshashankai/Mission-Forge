export function PhysicsBadge({
  exploration = false,
  drag = true,
  options = {},
}) {
  return (
    <details className="physics-badge" data-testid="physics-badge">
      <summary>
        Physics ·{" "}
        {exploration
          ? `central gravity${options.harmonicDegree ? ` + EGM96 ${options.harmonicDegree}` : options.j2 ? " + Earth J2" : ""}${options.relativity ? " + 1PN" : ""}${options.thirdBody ? " + differential gravity" : ""}${options.srp ? " + SRP" : ""}${options.tides ? " + elastic tides" : ""}`
          : "Earth J2 / Moon"}
        {drag ? " + drag" : " · drag off"}
      </summary>
      <p>
        Numerical finite burns ·{" "}
        {exploration
          ? "spherical central-body gravity with sphere-of-influence handoffs"
          : "Earth gravity including J2 oblateness, switching to central Moon gravity inside its sphere of influence"}
        .
      </p>
      <p>
        {drag
          ? "Atmospheric drag is active where density is modelled."
          : "Drag force disabled. Density can still be inspected."}{" "}
        No precision ephemerides.{" "}
        {exploration
          ? options.thirdBody
            ? "Differential third-body forces use approximate Kepler source positions."
            : "Third-body perturbations disabled."
          : "No simultaneous third-body perturbations."}{" "}
        {exploration &&
          !options.j2 &&
          !options.harmonicDegree &&
          "J2 is not integrated in exploration."}
      </p>
    </details>
  );
}
