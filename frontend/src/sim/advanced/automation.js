export const PROGRAM_ACTIONS = ["throttle", "mode", "cut", "stop"];
export const PROGRAM_TRIGGERS = [
  "elapsed",
  "altitudeAbove",
  "altitudeBelow",
  "fuelBelow",
];
export function validateProgram(blocks) {
  if (!Array.isArray(blocks) || !blocks.length || blocks.length > 32)
    throw Error("Use 1–32 program blocks.");
  for (const b of blocks) {
    if (
      !PROGRAM_TRIGGERS.includes(b.trigger) ||
      !PROGRAM_ACTIONS.includes(b.action) ||
      !Number.isFinite(b.threshold) ||
      b.threshold < 0 ||
      b.threshold > 1e9
    )
      throw Error("Invalid program trigger.");
    if (
      b.action === "throttle" &&
      (!Number.isFinite(b.value) || b.value < 0 || b.value > 1)
    )
      throw Error("Throttle must be between 0 and 1.");
    if (
      b.action === "mode" &&
      ![
        "prograde",
        "retrograde",
        "normal",
        "antinormal",
        "radialOut",
        "radialIn",
      ].includes(b.value)
    )
      throw Error("Unknown attitude mode.");
  }
  return blocks.map((b) => ({ ...b }));
}
export function armProgram(sim, blocks) {
  const checked = validateProgram(blocks);
  sim.cancelTransfer("Program armed");
  sim.program = { blocks: checked, index: 0, startedAt: sim.t, running: true };
}
export function runProgram(sim) {
  const p = sim.program;
  if (!p?.running) return;
  const nav = sim.navigation(),
    block = p.blocks[p.index];
  if (!block) {
    p.running = false;
    sim.throttle = 0;
    return;
  }
  const value = {
    elapsed: sim.t - p.startedAt,
    altitudeAbove: nav.altitude / 1000,
    altitudeBelow: nav.altitude / 1000,
    fuelBelow: sim.fuel,
  }[block.trigger];
  const triggered = block.trigger.endsWith("Below")
    ? value <= block.threshold
    : value >= block.threshold;
  if (!triggered) return;
  if (block.action === "cut") sim.throttle = 0;
  if (block.action === "stop") {
    sim.throttle = 0;
    p.running = false;
  }
  if (block.action === "throttle") sim.throttle = block.value;
  if (block.action === "mode") {
    sim.mode = block.value;
    sim.pitch = sim.yaw = 0;
    sim.rcsEnabled = true;
  }
  p.index++;
  sim.record(`Program block ${p.index}: ${block.action}`);
  if (p.index >= p.blocks.length) p.running = false;
}
