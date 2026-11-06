import { EARTH } from "../../sim/constants";
import { orbitFacts } from "../../science/catalog";
export function buildDebrief(result) {
  const samples = (result?.telemetry || [])
    .filter(
      (s) =>
        Number.isFinite(s.t) &&
        Number.isFinite(s.alt) &&
        Number.isFinite(s.speed),
    )
    .slice(0, 5000);
  const peak = samples.length ? Math.max(...samples.map((s) => s.alt)) : null,
    peri = result?.summary?.peri;
  const orbital =
    ["first_orbit", "earth_observer"].includes(result?.missionId) ||
    result?.missionId?.startsWith("local-");
  let title = "Use the recorded objectives to choose your next experiment.",
    why =
      "A result can have several causes. The evidence below describes this run; it does not diagnose every failure.",
    next =
      "Inspect the unmet objectives and change one variable before retrying.";
  if (orbital && Number.isFinite(peri)) {
    if (peri >= 140000) {
      title = "Your recorded periapsis clears the campaign atmosphere.";
      why =
        "This clears the 140 km threshold. Check bound-orbit, altitude, inclination, payload and budget objectives separately; periapsis alone does not establish success.";
      next =
        "Compare the achieved orbit with the mission target and inspect the remaining fuel margin.";
    } else if (peak !== null && peak >= 100) {
      title =
        "You reached space, but the orbit still intersects the atmosphere.";
      why =
        "The final recorded periapsis is below 140 km. Reaching a high altitude alone does not establish a stable orbit.";
      next =
        "Build sideways speed, inspect the periapsis marker and review staging before engine cutoff.";
    } else {
      title = "This flight did not establish a stable orbit.";
      why =
        "The recorded periapsis does not clear 140 km. Review liftoff, thrust, fuel and staging evidence before attributing a single cause.";
      next =
        "Use Preflight to check propulsion and TWR; change one design or guidance setting and retry.";
    }
  }
  const timeline = (result?.log || [])
    .filter((e) => Number.isFinite(e.t) && typeof e.text === "string")
    .slice(-80)
    .map((e) => {
      const sample = samples.reduce(
        (best, s) =>
          !best || Math.abs(s.t - e.t) < Math.abs(best.t - e.t) ? s : best,
        null,
      );
      return {
        t: e.t,
        text: e.text,
        sample: sample
          ? {
              t: sample.t,
              offsetSeconds: Math.abs(sample.t - e.t),
              altitudeKm: sample.alt,
              inertialSpeed: sample.speed,
              horizontalSpeed: Number.isFinite(sample.horizontalSpeed)
                ? sample.horizontalSpeed
                : null,
              fuelPercent: sample.fuel,
              pressureKPa: sample.q,
            }
          : null,
      };
    });
  return {
    title,
    why,
    next,
    peakAltitudeKm: peak,
    periapsisMetres: Number.isFinite(peri) ? peri : null,
    referenceSpeed: orbitFacts(EARTH, 200000).circularSpeed,
    timeline,
    missingHorizontal: !samples.some((s) => Number.isFinite(s.horizontalSpeed)),
    unmet: (result?.objectives || [])
      .filter((o) => !o.met)
      .map((o) => ({ label: o.label, detail: o.detail })),
  };
}
