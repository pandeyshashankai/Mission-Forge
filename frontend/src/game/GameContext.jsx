import { localData } from "../persistence/localData";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useState,
} from "react";
import { designHistory } from "./history";
import { storage } from "../sim/storage";
import { presetFalconLike } from "../sim/presets";
import { DIFFICULTIES } from "../sim/missions";
import { validPrediction } from "../science/learning";
import { DEFAULT_PROFILE } from "../sim/guidance";

const GameCtx = createContext(null);
export const useGame = () => useContext(GameCtx);

export function GameProvider({ children }) {
  const [auto] = useState(() => storage.autosave());
  const [screen, setScreen] = useState(() => window.location.hash.startsWith("#mission=") ? "missionDesign" : "menu");
  useEffect(() => {
    const openSharedMission = event => {
      if (window.location.hash.startsWith('#mission=')) setScreen('missionDesign');
      else if (new URL(event.oldURL).hash.startsWith('#mission=')) setScreen('menu');
    };
    window.addEventListener('hashchange', openSharedMission);
    return () => window.removeEventListener('hashchange', openSharedMission);
  }, []);
  const [difficulty, setDifficulty] = useState(
    DIFFICULTIES[auto?.difficulty] ? auto.difficulty : "amateur",
  );
  const [missionId, setMissionId] = useState(auto?.missionId || "first_orbit");
  const [history, dispatchDesign] = useReducer(
    designHistory,
    auto?.design,
    (design) => ({
      present: design || presetFalconLike(),
      past: [],
      future: [],
    }),
  );
  const design = history.present;
  const [profile, setProfile] = useState({
    ...DEFAULT_PROFILE,
    ...auto?.profile,
  });
  const [settings, setSettingsState] = useState(storage.settings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [overlayOpen,setOverlayOpen]=useState(false);
  const [result, setResult] = useState(null);
  const [learningPrediction, setLearningPrediction] = useState(() => {
    try {
      const saved = JSON.parse(localData.getItem("mf.learning-prediction"));
      return validPrediction(saved) ? saved : null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    try {
      if (learningPrediction)
        localData.setItem(
          "mf.learning-prediction",
          JSON.stringify(learningPrediction),
        );
      else localData.removeItem("mf.learning-prediction");
    } catch {
      /* The current session can continue without persistence. */
    }
  }, [learningPrediction]);
  const [pendingCheckpoint, setPendingCheckpoint] = useState(null);
  const [hasAutosave, setHasAutosave] = useState(!!auto);
  const setDesign = useCallback(
    (next, record = true) => dispatchDesign({ type: "set", next, record }),
    [],
  );
  const undo = useCallback(() => dispatchDesign({ type: "undo" }), []);
  const redo = useCallback(() => dispatchDesign({ type: "redo" }), []);

  useEffect(() => {
    if (!["hangar", "review", "flight"].includes(screen)) return;
    try {storage.saveAutosave({
      difficulty,
      missionId,
      design,
      profile,
      at: new Date().toISOString(),
    });
    setHasAutosave(true);}catch{setHasAutosave(false);}
  }, [difficulty, missionId, design, profile, screen]);

  const setSettings = (s) => {
    setSettingsState(s);
    try{storage.saveSettings(s)}catch{/* Storage status provides the recovery/export action. */}
  };

  const loadDesign = (d) => dispatchDesign({ type: "load", design: d });

  const value = {
    screen,
    go: setScreen,
    difficulty,
    setDifficulty,
    missionId,
    setMissionId,
    design,
    setDesign,
    loadDesign,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    profile,
    setProfile,
    settings,
    setSettings,
    overlayOpen,
    setOverlayOpen,
    settingsOpen,
    setSettingsOpen,
    result,
    setResult,
    learningPrediction,
    setLearningPrediction,
    hasAutosave,
    pendingCheckpoint,
    setPendingCheckpoint,
  };
  return <GameCtx.Provider value={value}>{children}</GameCtx.Provider>;
}
