import dataset from "../../science/data/tpsx-user.json";
export { dataset as tpsxData };
export function tpsxMaterial(id, mass = 120, area = 8) {
  const m = dataset.materials.find((m) => m.id === id);
  if (!m) throw Error("Unknown TPSX material");
  if (
    !Number.isFinite(mass) ||
    mass <= 0 ||
    mass > 120 ||
    !Number.isFinite(area) ||
    area <= 0 ||
    area > 1000
  )
    throw Error("Invalid thermal shield geometry");
  const p = m.properties;
  if (!p.specificHeat || !p.conductivity)
    throw Error("Incomplete TPSX properties: this phase is reference-only");
  return {
    type: "tpsx",
    id,
    area,
    ambient: 220,
    heatCapacity: mass * p.specificHeat.value,
    emissivity: p.emissivity.value,
    thickness: mass / (p.density.value * area),
    conductivity: p.conductivity.value,
    backCapacity: 180000,
    ablationEnergy: p.effectiveHeatOfAblation?.value ?? null,
    ablationOnset: 900,
    source: m.name,
    notice:
      "Constant screenshot-derived properties; source quality and conditions preserved. Geometry, 900 K onset and backing capacity are assumptions, not calibrated material response.",
  };
}
