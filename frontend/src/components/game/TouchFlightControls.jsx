import { useRef } from "react";
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Plus,
  Minus,
  Layers,
  Crosshair,
  Navigation,
  Gauge,
  Octagon,
} from "lucide-react";

function HoldButton({
  action,
  controls,
  disabled,
  label,
  children,
  className = "",
}) {
  const release = (e) => controls.release(action, `pointer:${e.pointerId}`);
  return (
    <button
      type="button"
      className={`touch-flight-button ${className}`}
      aria-label={label}
      aria-pressed={controls.pressed.has(action)}
      disabled={disabled}
      data-testid={`touch-${action}`}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        controls.press(action, `pointer:${e.pointerId}`);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onKeyDown={(e) => {
        if ([" ", "Enter"].includes(e.key)) {
          e.preventDefault();
          if (!e.repeat) controls.press(action, `button:${action}`);
        }
      }}
      onKeyUp={(e) => {
        if ([" ", "Enter"].includes(e.key)) {
          e.preventDefault();
          controls.release(action, `button:${action}`);
        }
      }}
      onBlur={() => controls.release(action, `button:${action}`)}
    >
      {children}
    </button>
  );
}
function ActionButton({
  action,
  controls,
  disabled,
  children,
  className = "",
  pressed,
  title,
}) {
  const pointers = useRef(new Set());
  return (
    <button
      type="button"
      className={`touch-flight-button ${className}`}
      disabled={disabled}
      title={title}
      aria-pressed={pressed}
      data-testid={`touch-${action}`}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
        e.preventDefault();
        pointers.current.add(e.pointerId);
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerUp={(e) => {
        const armed = pointers.current.delete(e.pointerId),
          r = e.currentTarget.getBoundingClientRect();
        if (
          armed &&
          e.clientX >= r.left &&
          e.clientX <= r.right &&
          e.clientY >= r.top &&
          e.clientY <= r.bottom
        )
          controls.trigger(action);
      }}
      onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
      onLostPointerCapture={(e) => pointers.current.delete(e.pointerId)}
      onClick={(e) => {
        if (e.detail === 0) controls.trigger(action);
      }}
    >
      {children}
    </button>
  );
}

export function TouchFlightControls({
  controls,
  visible,
  disabled,
  settings,
  throttle,
  rcs,
  guidance,
  canStage,
  stageLabel,
  exploration = false,
  onThrottle,
  fuel = [],
}) {
  if (!visible) return null;
  return (
    <section
      className={`touch-flight-controls steering-${settings.steeringSide} size-${settings.touchSize}`}
      aria-label="Touch flight controls"
      data-testid="touch-flight-controls"
    >
      <div className="cockpit-fuel" data-testid="cockpit-fuel"><strong>Propellant</strong>{fuel.map((f,i)=><div key={i} title={`${f.label}: ${Math.round(f.pct)}%`}><span>{f.label}</span><meter min="0" max="100" value={f.pct} aria-label={`${f.label} remaining propellant`}/></div>)}</div>
      <div className="touch-steering">
        <span className="touch-control-label">
          Steer{exploration && !rcs ? " · RCS off" : ""}
        </span>
        <div className="touch-direction-pad">
          <HoldButton
            action="pitchForward"
            controls={controls}
            disabled={disabled || (exploration && !rcs)}
            label="Pitch forward"
            className="touch-north"
          >
            <ArrowUp size={23} />
          </HoldButton>
          <HoldButton
            action="yawLeft"
            controls={controls}
            disabled={disabled || (exploration && !rcs)}
            label="Turn left"
            className="touch-west"
          >
            <ArrowLeft size={23} />
          </HoldButton>
          <span className="touch-pad-center" aria-hidden="true">
            <Navigation size={17} />
          </span>
          <HoldButton
            action="yawRight"
            controls={controls}
            disabled={disabled || (exploration && !rcs)}
            label="Turn right"
            className="touch-east"
          >
            <ArrowRight size={23} />
          </HoldButton>
          <HoldButton
            action="pitchBack"
            controls={controls}
            disabled={disabled || (exploration && !rcs)}
            label="Pitch back"
            className="touch-south"
          >
            <ArrowDown size={23} />
          </HoldButton>
        </div>
      </div>
      <div className="touch-flight-actions">
        <ActionButton
          action="rcs"
          controls={controls}
          className={`touch-rcs ${rcs ? "is-on" : ""}`}
          disabled={disabled}
          pressed={rcs}
        >
          <Crosshair size={18} />
          <span>RCS {rcs ? "on" : "off"}</span>
        </ActionButton>
        {!exploration && (
          <ActionButton
            action="guidance"
            controls={controls}
            className={guidance ? "is-on" : ""}
            disabled={disabled}
            pressed={guidance}
          >
            <Navigation size={17} />
            <span>{guidance ? "Auto" : "Manual"}</span>
          </ActionButton>
        )}
        <ActionButton
          action="stage"
          controls={controls}
          className="touch-stage"
          disabled={disabled || !canStage}
          title={stageLabel || "This spacecraft has no further stages"}
        >
          <Layers size={19} />
          <span>{exploration ? "Single stage" : "Stage"}</span>
        </ActionButton>
      </div>
      <div className="touch-thrust">
        <span className="touch-control-label">
          Throttle <strong>{Math.round(throttle * 100)}%</strong>
        </span>
        <input className="cockpit-throttle" data-testid="cockpit-throttle" aria-label="Engine throttle" aria-orientation="vertical" orient="vertical" type="range" min="0" max="100" step="1" value={Math.round(throttle*100)} disabled={disabled} onChange={e=>onThrottle?.(Number(e.target.value)/100)}/>
        <div className="touch-thrust-hold">
          <HoldButton
            action="throttleUp"
            controls={controls}
            disabled={disabled}
            label="Increase throttle"
          >
            <Plus size={23} />
          </HoldButton>
          <HoldButton
            action="throttleDown"
            controls={controls}
            disabled={disabled}
            label="Decrease throttle"
          >
            <Minus size={23} />
          </HoldButton>
        </div>
        <ActionButton
          action="fullThrottle"
          controls={controls}
          disabled={disabled}
        >
          <Gauge size={17} />
          <span>Full</span>
        </ActionButton>
        <ActionButton
          action="cutThrottle"
          controls={controls}
          className="touch-cut"
          disabled={disabled}
        >
          <Octagon size={16} />
          <span>Cut</span>
        </ActionButton>
      </div>
    </section>
  );
}
