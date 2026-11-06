import {GamepadSettings} from "./GamepadSettings";
import { useEffect, useState } from "react";
import { Keyboard, RotateCcw, Smartphone } from "lucide-react";
import { useGame } from "../../game/GameContext";
import {
  CONTROL_ACTIONS,
  defaultBindings,
  eventCode,
  isBindable,
  keyLabel,
  rebind,
} from "../../input/bindings";

export function ControlSettings() {
  const g = useGame();
  const [listening, setListening] = useState(null);
  const [message, setMessage] = useState("");
  const change = (patch) => g.setSettings({ ...g.settings, ...patch });
  useEffect(() => {
    if (!listening) return;
    const capture = (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.repeat) return;
      if (e.key === "Escape") {
        setListening(null);
        setMessage("Key change cancelled.");
        return;
      }
      const code = eventCode(e);
      if (!isBindable(code)) {
        setMessage(
          "Use a letter, number, arrow, punctuation, Shift or Ctrl. Browser/system keys stay reserved. Escape cancels.",
        );
        return;
      }
      if (
        e.metaKey ||
        e.altKey ||
        (e.ctrlKey && code !== "ControlLeft") ||
        (e.shiftKey && code !== "ShiftLeft")
      ) {
        setMessage(
          "Choose one key without a modifier combination. Escape cancels.",
        );
        return;
      }
      const other = CONTROL_ACTIONS.find(
        (a) => a.id !== listening && g.settings.bindings[a.id] === code,
      );
      g.setSettings({
        ...g.settings,
        bindings: rebind(g.settings.bindings, listening, code),
      });
      setMessage(
        other
          ? `${keyLabel(code)} assigned. Swapped with ${other.label.toLowerCase()} to keep every action usable.`
          : `Assigned ${keyLabel(code)}. Saved on this device.`,
      );
      setListening(null);
    };
    window.addEventListener("keydown", capture, true);
    return () => window.removeEventListener("keydown", capture, true);
  }, [listening, g]); // Settings are needed only while capturing a key.
  return (
    <div className="control-settings" data-testid="control-settings"><GamepadSettings/>
      <section>
        <h3 className="settings-heading">
          <Smartphone size={17} /> Touch & tablet controls
        </h3>
        <label className="control-setting-row">
          <span>
            Show flight buttons
            <small>
              Auto shows controls on touch devices and compact screens.
            </small>
          </span>
          <select
            data-testid="touch-controls-select"
            value={g.settings.touchControls}
            onChange={(e) => change({ touchControls: e.target.value })}
          >
            <option value="auto">Auto</option>
            <option value="on">Always</option>
            <option value="off">Keyboard only</option>
          </select>
        </label>
        <label className="control-setting-row">
          <span>
            Steering side
            <small>
              Place the arrow pad where your thumb is most comfortable.
            </small>
          </span>
          <select
            data-testid="touch-side-select"
            value={g.settings.steeringSide}
            onChange={(e) => change({ steeringSide: e.target.value })}
          >
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </label>
        <label className="control-setting-row">
          <span>Button size</span>
          <select
            data-testid="touch-size-select"
            value={g.settings.touchSize}
            onChange={(e) => change({ touchSize: e.target.value })}
          >
            <option value="normal">Standard</option>
            <option value="large">Larger</option>
          </select>
        </label>
        <label className="control-setting-row">
          <span>
            Steering sensitivity
            <small>Applies to held arrows and keyboard steering.</small>
          </span>
          <select
            data-testid="steering-sensitivity-select"
            value={g.settings.steeringSensitivity}
            onChange={(e) =>
              change({ steeringSensitivity: Number(e.target.value) })
            }
          >
            <option value="0.5">Gentle</option>
            <option value="1">Normal</option>
            <option value="1.5">Fast</option>
          </select>
        </label>
      </section>
      <section>
        <h3 className="settings-heading">
          <Keyboard size={17} /> Keyboard layout
        </h3>
        <p className="ui-help">
          Defaults: WASD steers. Shift / Ctrl changes throttle. E is full
          thrust, Q cuts the engine. Click a key below to change it; Escape
          cancels. Both left and right Shift / Ctrl work. Escape opens Settings
          during flight.
        </p>
        <div className="control-presets">
          <button
            className="ui-button"
            data-testid="controls-default-wasd"
            onClick={() => {
              change({ bindings: defaultBindings() });
              setListening(null);
              setMessage("WASD defaults restored.");
            }}
          >
            <RotateCcw size={14} /> WASD defaults
          </button>
          <button
            className="ui-button"
            data-testid="controls-default-arrows"
            onClick={() => {
              change({ bindings: defaultBindings("arrows") });
              setListening(null);
              setMessage("Arrow-key defaults applied.");
            }}
          >
            Arrow-key defaults
          </button>
        </div>
        <p className="ui-help">
          Presets replace your keyboard mappings. A key already in use swaps
          with the previous binding.
        </p>
        <div className="binding-list">
          {CONTROL_ACTIONS.map((a) => (
            <div className="binding-row" key={a.id}>
              <span>
                <strong>{a.label}</strong>
                <small>{a.hint}</small>
              </span>
              <button
                className={`binding-key ${listening === a.id ? "is-listening" : ""}`}
                aria-label={`Change ${a.label} key, currently ${keyLabel(g.settings.bindings[a.id])}`}
                aria-pressed={listening === a.id}
                data-testid={`binding-${a.id}`}
                onClick={() => {
                  setListening(a.id);
                  setMessage("Press one key. Escape cancels.");
                }}
              >
                {listening === a.id
                  ? "Press a key…"
                  : keyLabel(g.settings.bindings[a.id])}
              </button>
            </div>
          ))}
        </div>
        <p className="binding-feedback" role="status" aria-live="polite">
          {message ||
            "Changes save immediately and apply to both flight modes."}
        </p>
      </section>
    </div>
  );
}
