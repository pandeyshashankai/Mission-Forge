import { PARTS } from "../parts";
export function geometryAnalysis(design, layout) {
  const all = [
    ...layout.items,
    ...layout.radials,
  ];
  let wet = 0,
    dry = 0,
    side = 0,
    thrust = 0;
  const moments = [0, 0, 0],
    dryMoments = [0, 0, 0],
    sideMoments = [0, 0, 0],
    thrustMoments = [0, 0, 0];
  for (const item of all) {
    const p = PARTS[item.partId],
      dm = p.dryMass,
      wm = dm + (p.propellant?.mass || 0),
      position = [item.x || 0, item.y + item.height / 2, item.z || 0],
      area = p.diameter * item.height;
    wet += wm;
    dry += dm;
    side += area;
    for (let k = 0; k < 3; k++) {
      moments[k] += position[k] * wm;
      dryMoments[k] += position[k] * dm;
      sideMoments[k] += position[k] * area;
    }
    if (p.engine) {
      thrust += p.engine.thrustVac;
      for (let k = 0; k < 3; k++)
        thrustMoments[k] +=
          (k === 1 ? item.y : position[k]) * p.engine.thrustVac;
    }
  }
  return {
    wetMass: wet,
    dryMass: dry,
    wetCOM: moments.map((x) => x / Math.max(1, wet)),
    dryCOM: dryMoments.map((x) => x / Math.max(1, dry)),
    sideAreaCenter: sideMoments.map((x) => x / Math.max(1, side)),
    thrustOrigin: thrustMoments.map((x) => x / Math.max(1, thrust)),
    thrust,
  };
}
