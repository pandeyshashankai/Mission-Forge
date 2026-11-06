import oceanReference from "./data/ocean-reference.json";
import { oceanCoefficients } from "../sim/advanced/oceanTides";
import frameReference from "./data/frame-reference.json";
import { standardsRotation } from "../sim/advanced/precisionFrames";
import { harmonicAcceleration } from "../sim/advanced/harmonics";
import { ExplorationSim } from "../sim/exploration";
import { BODY_BY_ID, bodyState } from "../sim/solarSystem";
import reference from "./data/orekit-reference.json";
import atmosphereReference from "./data/msis-reference.json";
import { adaptiveStep } from "../sim/advanced/integrator";
import { centralGravity, j2Acceleration } from "../sim/advanced/forces";
import { add, len, sub } from "../sim/vec";
import { weatherDensity } from "../sim/advanced/weatherAtmosphere";
export { reference as orekitReference, atmosphereReference };
export function validateOrekit() {
  return reference.cases.map((c) => {
    const body = BODY_BY_ID[c.body],
      sim = new ExplorationSim(
        c.body,
        "pathfinder",
        0,
        len(c.initial.r) - body.radius,
        { drag: false, j2: c.forceModel === "j2", integrator: "accurate" },
      ),
      base = bodyState(c.body, 0);
    sim.r = add(base.r, c.initial.r);
    sim.v = add(base.v, c.initial.v);
    let maxGamePositionError = 0,
      maxGameVelocityError = 0;
    let state = { r: [...c.initial.r], v: [...c.initial.v] },
      time = 0,
      maxPositionError = 0,
      maxVelocityError = 0;
    for (const expected of c.samples) {
      if (expected.seconds > time)
        state = adaptiveStep(
          state.r,
          state.v,
          time,
          expected.seconds - time,
          (r) =>
            c.forceModel === "j2"
              ? add(centralGravity(r, c.mu), j2Acceleration(r, c.mu))
              : centralGravity(r, c.mu),
        );
      while (expected.seconds - sim.t > 1e-7) {
        const advanced = sim.advance(expected.seconds - sim.t);
        if (!(advanced > 0)) break;
      }
      const live = sim.navigation();
      maxGamePositionError = Math.max(
        maxGamePositionError,
        len(sub(live.r, expected.r)),
      );
      maxGameVelocityError = Math.max(
        maxGameVelocityError,
        len(sub(live.v, expected.v)),
      );
      time = expected.seconds;
      maxPositionError = Math.max(
        maxPositionError,
        len(sub(state.r, expected.r)),
      );
      maxVelocityError = Math.max(
        maxVelocityError,
        len(sub(state.v, expected.v)),
      );
    }
    return {
      id: c.id,
      forceModel: c.forceModel,
      maxPositionError,
      maxVelocityError,
      maxGamePositionError,
      maxGameVelocityError,
      positionTolerance: 10,
      velocityTolerance: 0.01,
      pass:
        maxPositionError < 10 &&
        maxVelocityError < 0.01 &&
        maxGamePositionError < 10 &&
        maxGameVelocityError < 0.01,
    };
  });
}
export function validateAtmosphere() {
  return atmosphereReference.cases.map((c) => {
    const actual = weatherDensity(c.input),
      error = Math.abs(actual.density / c.density - 1),
      temperatureError = Math.abs(actual.temperature - c.temperature);
    return {
      altitude: c.input.altitude,
      flux: c.input.f107,
      ap: c.input.ap,
      density: actual.density,
      referenceDensity: c.density,
      relativeError: error,
      temperatureError,
      pass: error < 1e-10 && temperatureError < 1e-8,
    };
  });
}

export function validateHarmonics() {
  return reference.harmonicForces.samples.map((sample, i) => {
    const actual = harmonicAcceleration(
        sample.r,
        reference.harmonicForces.mu,
        0,
        86400,
        8,
      ),
      error = len(sub(actual, sample.acceleration));
    return {
      sample: i + 1,
      absoluteAccelerationError: error,
      tolerance: 1e-8,
      pass: error < 1e-8,
    };
  });
}

export function validateFrames() {
  const matrix = standardsRotation(frameReference.input);
  const error = Math.max(
    ...matrix.flatMap((row, i) =>
      row.map((x, j) => Math.abs(x - frameReference.matrix[i][j])),
    ),
  );
  return {
    model: "IAU 2006/2000A celestial-to-terrestrial rotation",
    maximumMatrixError: error,
    tolerance: frameReference.tolerance,
    pass: error < frameReference.tolerance,
  };
}

export function validateOcean() {
  return oceanReference.samples.map((sample) => {
    const actual = oceanCoefficients(sample.seconds),
      maximumError = Math.max(
        ...sample.terms.flatMap((t) => {
          const a = actual.find((x) => x.n === t.n && x.m === t.m);
          return [Math.abs(a.c - t.c), Math.abs(a.s - t.s)];
        }),
      );
    return {
      seconds: sample.seconds,
      maximumError,
      tolerance: 1e-17,
      pass: maximumError < 1e-17,
    };
  });
}
