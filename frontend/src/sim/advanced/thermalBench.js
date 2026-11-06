import published from "../../science/data/arcjet-cases.json";
import { tpsxMaterial } from "./tpsx";
import { damageState, thermalStep } from "./damage";
export { published as arcjetCases };
export function runThermalCase({
  caseIndex = 0,
  wall = "hot",
  material = "pica-virgin",
  thickness = 0.03,
  area = 0.01,
  initialTemperature = 290,
  step = 0.1,
} = {}) {
  if (
    !Number.isInteger(caseIndex) ||
    !published.cases[caseIndex] ||
    !["hot", "cold"].includes(wall) ||
    !["pica-virgin", "avcoat-virgin", "avcoat-char"].includes(material) ||
    ![thickness, area, initialTemperature, step].every(Number.isFinite) ||
    thickness < 0.005 ||
    thickness > 0.15 ||
    area < 0.001 ||
    area > 1 ||
    initialTemperature < 220 ||
    initialTemperature > 600 ||
    step < 0.025 ||
    step > 0.5
  )
    throw Error("Unsupported thermal experiment inputs");
  const c = published.cases[caseIndex],
    flux = wall === "hot" ? c.targetHotWallFluxWm2 : c.targetColdWallFluxWm2;
  const reference = tpsxMaterial(material, 1, area),
    rho = 1 / (reference.thickness * area),
    mass = rho * thickness * area;
  if (mass > 120) throw Error("Sample mass exceeds model limit");
  let state = damageState({
      temperature: initialTemperature,
      backTemperature: initialTemperature,
      shieldKg: mass,
    }),
    t = 0;
  const samples = [{ t, ...state }],
    stride = Math.max(1, Math.round(0.5 / step));
  let iterations = 0,
    maximumSurface = initialTemperature,
    maximumBacking = initialTemperature;
  const end = c.exposureSeconds + 30;
  while (t < end - 1e-9) {
    const dt = Math.min(
      step,
      end - t,
      t < c.exposureSeconds ? c.exposureSeconds - t : step,
    );
    const props =
      state.shieldKg > 0
        ? tpsxMaterial(material, state.shieldKg, area)
        : {
            type: "exposed",
            area,
            heatCapacity: 180000 * (area / 8),
            emissivity: 0.8,
          };
    if (props.type === "tpsx") props.backCapacity = 180000 * (area / 8);
    state = thermalStep(
      state,
      t < c.exposureSeconds ? flux : 0,
      0,
      0,
      dt,
      props,
    );
    t += dt;
    iterations++;
    maximumSurface = Math.max(maximumSurface, state.temperature);
    maximumBacking = Math.max(maximumBacking, state.backTemperature);
    if (
      iterations % stride === 0 ||
      t >= end - 1e-9 ||
      Math.abs(t - c.exposureSeconds) < 1e-9
    )
      samples.push({ t, ...state });
  }
  return {
    version: 1,
    kind: "nominal-arcjet-model-prediction",
    source: published.source,
    test: c,
    inputs: {
      caseIndex,
      wall,
      material,
      thickness,
      area,
      initialTemperature,
      step,
    },
    fluxWm2: flux,
    nominalIncidentJm2: flux * c.exposureSeconds,
    initialShieldKg: mass,
    finalShieldKg: state.shieldKg,
    modeledRecessionM: (mass - state.shieldKg) / (rho * area),
    maximumSurface,
    maximumBacking,
    samples,
    notice:
      "Model prediction, not measured validation. Prescribed target flux; coating, pyrolysis, pressure-dependent properties and actual coupon stackup are not modeled. Pressure shown for context; overload damage disabled. Thirty seconds of modeled cooling follows exposure.",
  };
}
export function thermalCSV(result) {
  return [
    "time_s,surface_K,backing_K,shield_kg",
    ...result.samples.map((s) =>
      [s.t, s.temperature, s.backTemperature, s.shieldKg].join(","),
    ),
  ].join("\n");
}
