export const CONTROL_ACTIONS = [
  {
    id: "pitchForward",
    label: "Pitch forward",
    hint: "Tilt the nose forward",
    hold: true,
  },
  {
    id: "pitchBack",
    label: "Pitch back",
    hint: "Tilt the nose back",
    hold: true,
  },
  { id: "yawLeft", label: "Turn left", hint: "Steer left", hold: true },
  { id: "yawRight", label: "Turn right", hint: "Steer right", hold: true },
  {
    id: "throttleUp",
    label: "Throttle up",
    hint: "Hold to increase thrust",
    hold: true,
  },
  {
    id: "throttleDown",
    label: "Throttle down",
    hint: "Hold to decrease thrust",
    hold: true,
  },
  { id: "fullThrottle", label: "Full throttle", hint: "Set thrust to 100%" },
  { id: "cutThrottle", label: "Cut engine", hint: "Set thrust to 0%" },
  {
    id: "stage",
    label: "Next stage",
    hint: "Scored missions; sandbox craft are single-stage",
  },
  { id: "rcs", label: "Toggle RCS", hint: "Reaction control on or off" },
  {
    id: "guidance",
    label: "Toggle guidance",
    hint: "Autopilot on / off in scored missions",
  },
  {
    id: "pause",
    label: "Pause / resume",
    hint: "Stop or resume simulation time",
  },
  { id: "map", label: "Orbit map", hint: "Switch between the rocket and map" },
  { id: "camera", label: "Change camera", hint: "Cycle camera views" },
  { id: "warpDown", label: "Slower time", hint: "Reduce coast time speed" },
  { id: "warpUp", label: "Faster time", hint: "Increase coast time speed" },
];
export const DEFAULT_BINDINGS = {
  pitchForward: "KeyW",
  pitchBack: "KeyS",
  yawLeft: "KeyA",
  yawRight: "KeyD",
  throttleUp: "ShiftLeft",
  throttleDown: "ControlLeft",
  fullThrottle: "KeyE",
  cutThrottle: "KeyQ",
  stage: "Space",
  rcs: "KeyR",
  guidance: "KeyG",
  pause: "KeyP",
  map: "KeyM",
  camera: "KeyC",
  warpDown: "Comma",
  warpUp: "Period",
};
export const HELD_ACTIONS = new Set(
  CONTROL_ACTIONS.filter((a) => a.hold).map((a) => a.id),
);
export function canonicalCode(code) {
  return code === "ShiftRight"
    ? "ShiftLeft"
    : code === "ControlRight"
      ? "ControlLeft"
      : code;
}
export function isBindable(code) {
  if (typeof code !== "string") return false;
  return /^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Arrow(Up|Down|Left|Right)|Space|ShiftLeft|ControlLeft|Enter|Comma|Period|Slash|Semicolon|Quote|BracketLeft|BracketRight|Minus|Equal|Backquote|Home|End|PageUp|PageDown|Insert|Delete|Backspace)$/.test(
    canonicalCode(code),
  );
}
export function eventCode(event) {
  if (event.code) return canonicalCode(event.code);
  const k = event.key || "";
  if (/^[a-z]$/i.test(k)) return `Key${k.toUpperCase()}`;
  if (/^[0-9]$/.test(k)) return `Digit${k}`;
  return (
    {
      " ": "Space",
      Shift: "ShiftLeft",
      Control: "ControlLeft",
      ",": "Comma",
      ".": "Period",
      "[": "BracketLeft",
      "]": "BracketRight",
      "-": "Minus",
      "=": "Equal",
      "/": "Slash",
    }[k] || k
  );
}
export function keyLabel(code) {
  if (code?.startsWith("Key")) return code.slice(3);
  if (code?.startsWith("Digit")) return code.slice(5);
  return (
    {
      ShiftLeft: "Shift",
      ControlLeft: "Ctrl",
      Space: "Space",
      ArrowUp: "↑",
      ArrowDown: "↓",
      ArrowLeft: "←",
      ArrowRight: "→",
      Comma: ",",
      Period: ".",
      BracketLeft: "[",
      BracketRight: "]",
      Semicolon: ";",
      Quote: "'",
      Backquote: "`",
      Slash: "/",
      Minus: "−",
      Equal: "=",
    }[code] ||
    code ||
    "—"
  );
}
export function defaultBindings(preset = "wasd") {
  return preset === "arrows"
    ? {
        ...DEFAULT_BINDINGS,
        pitchForward: "ArrowUp",
        pitchBack: "ArrowDown",
        yawLeft: "ArrowLeft",
        yawRight: "ArrowRight",
      }
    : { ...DEFAULT_BINDINGS };
}
export function rebind(bindings, action, code) {
  code = canonicalCode(code);
  if (!Object.hasOwn(DEFAULT_BINDINGS, action) || !isBindable(code))
    return bindings;
  const next = { ...bindings };
  const other = Object.keys(next).find(
    (id) => id !== action && next[id] === code,
  );
  if (other) next[other] = next[action];
  next[action] = code;
  return next;
}
export function normalizeBindings(saved) {
  let bindings = defaultBindings();
  if (!saved || typeof saved !== "object") return bindings;
  for (const { id } of CONTROL_ACTIONS)
    if (isBindable(saved[id])) bindings = rebind(bindings, id, saved[id]);
  return bindings;
}
export function steeringAxes(active) {
  return {
    pitch: Number(active("pitchBack")) - Number(active("pitchForward")),
    yaw: Number(active("yawRight")) - Number(active("yawLeft")),
  };
}
export function editableTarget(target) {
  return !!target?.closest?.(
    "input, select, textarea, [contenteditable=true], [role=textbox]",
  );
}
