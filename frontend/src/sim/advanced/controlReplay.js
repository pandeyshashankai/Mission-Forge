import { installLocalBodies } from "../solarSystem";
import { ExplorationSim, FLIGHT_MODES } from "../exploration";
import { forceOptions, PHYSICS_REVISION } from "./forces";
import { NASA_DATA } from "../../science/catalog";
import { controlHash, controlState } from "./controlRecording";
import { len } from "../vec";
export function replayControls(record) {
  if (
    record?.version !== 1 ||
    record.physicsRevision !== PHYSICS_REVISION ||
    record.kind !== "exploration-control-trace" ||
    record.sourceCommit !== NASA_DATA.commit ||
    !Array.isArray(record.commands) ||
    record.commands.length > 12000 ||
    typeof record.drag !== "boolean"
  )
    throw Error(
      "Invalid or incompatible control recording. Use a trace recorded with current physics revision.",
    );
  let total = 0;
  for (const command of record.commands) {
    const input = command.input;
    if (
      input &&
      Object.keys(input).some(
        (key) =>
          ![
            "dragEnabled",
            "throttle",
            "mode",
            "pitch",
            "yaw",
            "rcsEnabled",
            "heldDirection",
            "physics",
          ].includes(key),
      )
    )
      throw Error("Recording contains unsupported control fields.");
    if (
      !Number.isFinite(command.seconds) ||
      command.seconds <= 0 ||
      command.seconds > 1e8 ||
      !Number.isInteger(command.maxSteps) ||
      command.maxSteps < 1 ||
      command.maxSteps > 600
    )
      throw Error("Invalid replay step.");
    total += command.maxSteps;
    if (total > 201000) throw Error("Replay exceeds work limit.");
    if (
      !input ||
      typeof input.dragEnabled !== "boolean" ||
      ![input.throttle, input.pitch, input.yaw].every(Number.isFinite) ||
      input.throttle < 0 ||
      input.throttle > 1 ||
      Math.abs(input.pitch) > 90 ||
      Math.abs(input.yaw) > 180 ||
      !FLIGHT_MODES.includes(input.mode) ||
      typeof input.rcsEnabled !== "boolean"
    )
      throw Error("Invalid replay controls.");
    if (
      input.heldDirection !== null &&
      (!Array.isArray(input.heldDirection) ||
        input.heldDirection.length !== 3 ||
        !input.heldDirection.every(Number.isFinite) ||
        len(input.heldDirection) < 0.9 ||
        len(input.heldDirection) > 1.1)
    )
      throw Error("Invalid held direction.");
    forceOptions(input.physics);
  }
  installLocalBodies(record.customBodies || []);
  const sim = ExplorationSim.restore(record.initial);
  sim.dragEnabled = record.drag;
  for (const command of record.commands) {
    Object.assign(sim, command.input, {
      physics: forceOptions(command.input.physics),
    });
    sim.advance(command.seconds, command.maxSteps);
  }
  const actual = controlState(sim),
    hash = controlHash(actual),
    expected = controlHash(record.reference);
  return {
    pass: hash === expected,
    hash,
    expected,
    commands: record.commands.length,
    actual,
  };
}
