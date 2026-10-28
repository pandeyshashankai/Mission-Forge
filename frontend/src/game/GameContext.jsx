import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { storage } from "../sim/storage";
import { presetFalconLike } from "../sim/presets";
import { DEFAULT_PROFILE } from "../sim/guidance";

const GameCtx = createContext(null);
export const useGame = () => useContext(GameCtx);

export function GameProvider({ children }) {
  const auto = storage.autosave();
  const [screen, setScreen] = useState("menu");
  const [difficulty, setDifficulty] = useState(auto?.difficulty || "amateur");
  const [missionId, setMissionId] = useState(auto?.missionId || "first_orbit");
  const [design, setDesignState] = useState(auto?.design || presetFalconLike());
  const [profile, setProfile] = useState(auto?.profile || DEFAULT_PROFILE);
  const [settings, setSettingsState] = useState(storage.settings());
  const [result, setResult] = useState(null);
  const [hasAutosave, setHasAutosave] = useState(!!auto);
  const past = useRef([]);
  const future = useRef([]);
  const [, bump] = useState(0);

  const setDesign = useCallback((next, record = true) => {
    setDesignState((prev) => {
      const val = typeof next === "function" ? next(prev) : next;
      if (record && val !== prev) {
        past.current.push(prev);
        if (past.current.length > 100) past.current.shift();
        future.current = [];
      }
      return val;
    });
    bump((x) => x + 1);
  }, []);

  const resetHistory = () => {
    past.current = [];
    future.current = [];
  };

  const undo = useCallback(() => {
    if (!past.current.length) return;
    setDesignState((cur) => {
      future.current.push(cur);
      return past.current.pop();
    });
    bump((x) => x + 1);
  }, []);

  const redo = useCallback(() => {
    if (!future.current.length) return;
    setDesignState((cur) => {
      past.current.push(cur);
      return future.current.pop();
    });
    bump((x) => x + 1);
  }, []);

  useEffect(() => {
    if (screen === "menu") return;
    storage.saveAutosave({ difficulty, missionId, design, profile, at: new Date().toISOString() });
    setHasAutosave(true);
  }, [difficulty, missionId, design, profile, screen]);

  const setSettings = (s) => {
    setSettingsState(s);
    storage.saveSettings(s);
  };

  const loadDesign = (d) => {
    resetHistory();
    setDesignState({ ...d, savedAt: undefined });
    bump((x) => x + 1);
  };

  const value = {
    screen, go: setScreen, difficulty, setDifficulty, missionId, setMissionId,
    design, setDesign, loadDesign, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0,
    profile, setProfile, settings, setSettings, result, setResult, hasAutosave,
  };
  return <GameCtx.Provider value={value}>{children}</GameCtx.Provider>;
}
