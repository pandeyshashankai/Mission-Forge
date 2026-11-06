import reference from "./data/precision-reference.json";
import { apparentEclipse } from "../sim/advanced/eclipse";
import {
  centralGravity,
  relativisticAcceleration,
} from "../sim/advanced/forces";
import { adaptiveStep } from "../sim/advanced/integrator";
import { ExplorationSim } from "../sim/exploration";
import { BODY_BY_ID, bodyState } from "../sim/solarSystem";
import { add, len, sub } from "../sim/vec";
export { reference as precisionReference };
export function validatePrecisionForces() {
  const forces = reference.relativity.map((c) => {
    const error = len(
      sub(relativisticAcceleration(c.r, c.v, c.mu), c.acceleration),
    );
    const tolerance = Math.max(1e-20, len(c.acceleration) * 1e-12);
    return { body: c.body, error, tolerance, pass: error <= tolerance };
  });
  const eclipses = reference.eclipses.map((c) => {
    const actual = apparentEclipse(
      c.r,
      c.sun,
      c.sunRadius,
      c.center,
      c.radius,
    ).fraction;
    const error = Math.abs(actual - c.fraction),
      tolerance = 2e-8;
    return {
      id: c.id,
      actual,
      expected: c.fraction,
      error,
      tolerance,
      pass: error <= tolerance,
    };
  });
  return {
    forces,
    eclipses,
    pass: [...forces, ...eclipses].every((r) => r.pass),
  };
}
export function validateRelativisticTrajectories() {
  return reference.trajectories.map((c) => {
    let state = { r: c.initial.r, v: c.initial.v },
      time = 0;
    const body = BODY_BY_ID[c.body],
      base = bodyState(c.body, 0);
    const sim = new ExplorationSim(
      c.body === "sun" ? "earth" : c.body,
      "pathfinder",
      0,
      c.body === "sun" ? 200000 : len(c.initial.r) - body.radius,
      { drag: false, integrator: "accurate", relativity: true },
    );
    sim.primary = c.body;
    sim.r = add(base.r, c.initial.r);
    sim.v = add(base.v, c.initial.v);
    let directPositionError = 0,
      gamePositionError = 0,
      velocityError = 0;
    for (const expected of c.samples) {
      state = adaptiveStep(
        state.r,
        state.v,
        time,
        expected.seconds - time,
        (r, v) =>
          add(centralGravity(r, c.mu), relativisticAcceleration(r, v, c.mu)),
        {
          relativeTolerance: 1e-12,
          positionTolerance: 1e-4,
          velocityTolerance: 1e-8,
          maxEvaluations: 100000,
        },
      );
      let advances = 0;
      while (expected.seconds - sim.t > 1e-7 && advances++ < 1000) {
        if (!(sim.advance(expected.seconds - sim.t) > 0))
          throw Error("Relativistic reference coast stopped early");
      }
      if (Math.abs(expected.seconds - sim.t) > 1e-6 || sim.primary !== c.body)
        throw Error(
          "Reference coast did not retain its configured primary/epoch",
        );
      const live = sim.navigation();
      directPositionError = Math.max(
        directPositionError,
        len(sub(state.r, expected.r)),
      );
      gamePositionError = Math.max(
        gamePositionError,
        len(sub(live.r, expected.r)),
      );
      velocityError = Math.max(
        velocityError,
        len(sub(state.v, expected.v)),
        len(sub(live.v, expected.v)),
      );
      time = expected.seconds;
    }
    const positionTolerance = c.body === "sun" ? 100 : 1;
    return {
      id: c.id,
      periods: 3,
      checkpoints: c.samples.length,
      directPositionError,
      gamePositionError,
      velocityError,
      positionTolerance,
      velocityTolerance: 0.001,
      pass:
        directPositionError < positionTolerance &&
        gamePositionError < positionTolerance &&
        velocityError < 0.001,
    };
  });
}
