import { CONTROL_ACTIONS } from './bindings';
const ids = new Set(CONTROL_ACTIONS.map(a => a.id));
export const DEFAULT_PAD_BUTTONS = {
  fullThrottle: 0,
  cutThrottle: 1,
  stage: 2,
  rcs: 3,
  warpDown: 4,
  warpUp: 5,
  map: 8,
  pause: 9,
  camera: 10,
  guidance: 11
};
export function normalizeGamepad(value = {}) {
  const v = value && typeof value === 'object' ? value : {};
  const buttons = {},
    used = new Set();
  for (const id of ids) {
    const n = v.buttons?.[id] ?? DEFAULT_PAD_BUTTONS[id] ?? -1;
    buttons[id] = Number.isInteger(n) && n >= -1 && n < 32 && (n < 0 || !used.has(n)) ? n : -1;
    if (buttons[id] >= 0) used.add(buttons[id]);
  }
  return {
    deadzone: Number.isFinite(v.deadzone) ? Math.max(.1, Math.min(.6, v.deadzone)) : .25,
    pitchAxis: Number.isInteger(v.pitchAxis) && v.pitchAxis >= 0 && v.pitchAxis < 8 ? v.pitchAxis : 1,
    yawAxis: Number.isInteger(v.yawAxis) && v.yawAxis >= 0 && v.yawAxis < 8 ? v.yawAxis : 0,
    throttleAxis: Number.isInteger(v.throttleAxis) && v.throttleAxis >= -1 && v.throttleAxis < 8 ? v.throttleAxis : 3,
    invertPitch: v.invertPitch === true,
    buttons
  };
}
export function gamepadActions(pad, settings) {
  const c = normalizeGamepad(settings),
    active = new Set();
  if (!pad || pad.connected === false) return active;
  const axis = i => Number.isFinite(pad.axes?.[i]) ? Math.max(-1, Math.min(1, pad.axes[i])) : 0;
  const pitch = axis(c.pitchAxis) * (c.invertPitch ? -1 : 1),
    yaw = axis(c.yawAxis),
    throttle = c.throttleAxis < 0 ? 0 : axis(c.throttleAxis);
  if (pitch < -c.deadzone) active.add('pitchForward');
  if (pitch > c.deadzone) active.add('pitchBack');
  if (yaw < -c.deadzone) active.add('yawLeft');
  if (yaw > c.deadzone) active.add('yawRight');
  if (throttle < -c.deadzone) active.add('throttleUp');
  if (throttle > c.deadzone) active.add('throttleDown');
  for (const [id, index] of Object.entries(c.buttons)) if (index >= 0 && (pad.buttons?.[index]?.pressed || pad.buttons?.[index]?.value > .5)) active.add(id);
  return active;
}
export function rebindGamepad(settings, action, index) {
  if (!ids.has(action) || !Number.isInteger(index) || index < -1 || index > 31) throw Error('Unsupported controller mapping');
  const c = normalizeGamepad(settings),
    old = c.buttons[action];
  if (index >= 0) for (const id of ids) if (id !== action && c.buttons[id] === index) c.buttons[id] = old;
  c.buttons[action] = index;
  return c;
}
