import { orbitalOrientation } from "../../sim/orbit";
const deg = n => n===null ? "Undefined for this orbit" : `${(n*180/Math.PI).toFixed(2)}°`;
export function OrbitalElements({ nav }) {
  const o=orbitalOrientation(nav.r,nav.v,nav.body.mu);
  return <details className="engineering-inspector" data-testid="orbital-elements"><summary>Orbit elements · shape & orientation</summary>
    <dl>{[["Semi-major axis a",`${(nav.el.a/1000).toFixed(1)} km`],["Eccentricity e",nav.el.e.toFixed(6)],["Inclination i",deg(nav.el.inc)],["Ascending node Ω",deg(o.raan)],["Periapsis argument ω",deg(o.argumentOfPeriapsis)],["True anomaly ν",deg(o.trueAnomaly)]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    <p>Relative to the simplified model's XY reference plane. Circular or equatorial orbits have undefined classical angles; they are shown explicitly.</p>
  </details>;
}
