import { gamepadActions, normalizeGamepad } from "./gamepad";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HELD_ACTIONS, editableTarget, eventCode } from "./bindings";

// Each action can be held by several independent pointers or a key. Releasing one must not release the others.
export class FlightInputState {
  constructor() {
    this.sources = new Map();
  }
  press(action, source) {
    if (!this.sources.has(action)) this.sources.set(action, new Set());
    this.sources.get(action).add(source);
  }
  release(action, source) {
    const sources = this.sources.get(action);
    if (!sources) return;
    sources.delete(source);
    if (!sources.size) this.sources.delete(action);
  }
  active(action) {
    return !!this.sources.get(action)?.size;
  }
  clear() {
    this.sources.clear();
  }
}
export function useFlightInput({
  bindings,
  enabled,
  moving = true,
  onAction,
  onManual,
  onMenu,
  settings = {}
}) {
  const state = useRef(new FlightInputState());
  const latest = useRef(null);
  latest.current = {
    bindings,
    enabled,
    moving,
    onAction,
    onManual,
    onMenu,
    settings
  };
  const [pressed, setPressed] = useState(new Set());
  const refresh = useCallback(() => setPressed(new Set(state.current.sources.keys())), []);
  const clear = useCallback(() => {
    state.current.clear();
    refresh();
  }, [refresh]);
  const press = useCallback((action, source) => {
    const c = latest.current;
    if (!c.enabled || !c.moving) return;
    if (HELD_ACTIONS.has(action)) {
      state.current.press(action, source);
      c.onManual?.(action);
      refresh();
    }
  }, [refresh]);
  const release = useCallback((action, source) => {
    state.current.release(action, source);
    refresh();
  }, [refresh]);
  const trigger = useCallback(action => {
    if (latest.current.enabled) {
      latest.current.onAction?.(action);
      if (latest.current.settings.haptics && ["stage", "rcs", "guidance", "pause"].includes(action)) {
        try {
          navigator.vibrate?.(15);
        } catch {/* Optional feedback must never interrupt control. */}
      }
    }
  }, []);
  useEffect(() => {
    const inputState = state.current;
    const down = e => {
      const c = latest.current;
      if (e.defaultPrevented || !c.enabled || e.metaKey || e.altKey || editableTarget(e.target)) return;
      if (e.key === "Escape" && c.onMenu) {
        e.preventDefault();
        if (!e.repeat) c.onMenu();
        return;
      }
      const code = eventCode(e),
        action = Object.keys(c.bindings).find(id => c.bindings[id] === code);
      if (!action || (e.target?.closest?.("button,summary,a") && ["Space", "Enter"].includes(code))) return;
      e.preventDefault();
      if (e.repeat) return;
      if (HELD_ACTIONS.has(action)) press(action, `key:${e.code || code}`);else trigger(action);
    };
    const up = e => {
      const source = `key:${e.code || eventCode(e)}`;
      for (const [action] of state.current.sources) state.current.release(action, source);
      refresh();
    };
    const hidden = () => {
      if (document.hidden) clear();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    window.addEventListener("resize", clear);
    window.addEventListener("orientationchange", clear);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      window.removeEventListener("resize", clear);
      window.removeEventListener("orientationchange", clear);
      document.removeEventListener("visibilitychange", hidden);
      inputState.clear();
    };
  }, [press, refresh, clear, trigger]);
  useEffect(() => {
    clear();
  }, [enabled, moving, bindings, clear]);
  const padConfig = JSON.stringify(normalizeGamepad(settings.gamepad));
  useEffect(() => {
    if (!settings.gamepadEnabled || !enabled) return undefined;
    let raf,
      armed = false,
      previous = new Set(),
      signature = '';
    const releasePad = () => {
      for (const action of previous) if (HELD_ACTIONS.has(action)) release(action, 'gamepad');
      previous = new Set();
      armed = false;
    };
    const poll = () => {
      raf = requestAnimationFrame(poll);
      if (document.hidden || !document.hasFocus() || editableTarget(document.activeElement)) {
        releasePad();
        return;
      }
      let pads = [];
      try {
        pads = Array.from(navigator.getGamepads?.() || []).filter(Boolean);
      } catch {
        releasePad();
        return;
      }
      const identity = pads.map(p => p.index + ':' + p.id).join('|');
      if (identity !== signature) {
        releasePad();
        signature = identity;
      }
      if (!pads.length) {
        releasePad();
        return;
      }
      const active = new Set();
      for (const pad of pads) for (const action of gamepadActions(pad, JSON.parse(padConfig))) active.add(action);
      if (!armed) {
        if (!active.size) armed = true;
        return;
      }
      for (const action of previous) if (!active.has(action) && HELD_ACTIONS.has(action)) release(action, 'gamepad');
      for (const action of active) if (!previous.has(action)) {
        if (HELD_ACTIONS.has(action)) press(action, 'gamepad');else trigger(action);
      }
      previous = active;
    };
    raf = requestAnimationFrame(poll);
    window.addEventListener('blur', releasePad);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('blur', releasePad);
      releasePad();
    };
  }, [settings.gamepadEnabled, padConfig, enabled, moving, press, release, trigger]);
  return useMemo(() => ({
    pressed,
    press,
    release,
    trigger,
    clear,
    active: action => state.current.active(action)
  }), [pressed, press, release, trigger, clear]);
}
export function useTouchControlsVisible(preference) {
  const query = "(any-pointer: coarse), (max-width: 950px)";
  const [compact, setCompact] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query),
      change = () => setCompact(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return preference === "on" || (preference !== "off" && compact);
}
