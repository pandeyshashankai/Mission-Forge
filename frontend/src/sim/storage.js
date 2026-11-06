import {normalizeGamepad} from "../input/gamepad";
import { localData } from "../persistence/localData";
import { getMission, DIFFICULTIES } from "./missions";
import { normalizeBindings } from "../input/bindings";
import { PARTS } from "./parts";

const read = (k, d) => {
  try {
    const v = localData.getItem(k);
    return v ? JSON.parse(v) : d;
  } catch {
    return d;
  }
};
const readList = (k) => {
  const value = read(k, []);
  return Array.isArray(value) ? value : [];
};
const write = (k, v) => localData.setItem(k, JSON.stringify(v));

export const storage = {
  settings: () => {
    const saved = read("mf.settings", {}) || {};
    return {
      graphics: ["auto", "low", "medium", "high"].includes(saved.graphics)
        ? saved.graphics
        : "auto",
      camera: ["chase", "cinematic", "free", "map"].includes(saved.camera)
        ? saved.camera
        : "chase",
      theme: ["orbital", "nebula", "daylight"].includes(saved.theme)
        ? saved.theme
        : "orbital",
      textSize: saved.textSize === "large" ? "large" : "standard",
      reduceMotion: !!saved.reduceMotion,
      bindings: normalizeBindings(saved.bindings),
      gamepadEnabled:saved.gamepadEnabled===true,
      gamepad:normalizeGamepad(saved.gamepad),
      keepAwake:saved.keepAwake===true,
      haptics:saved.haptics===true,
      touchControls: ["auto", "on", "off"].includes(saved.touchControls)
        ? saved.touchControls
        : "auto",
      steeringSide: saved.steeringSide === "right" ? "right" : "left",
      touchSize: saved.touchSize === "large" ? "large" : "normal",
      steeringSensitivity: [0.5, 1, 1.5].includes(saved.steeringSensitivity)
        ? saved.steeringSensitivity
        : 1,
    };
  },
  saveSettings: (s) => write("mf.settings", s),
  autosave: () => {
    const saved = read("mf.autosave", null);
    return saved && getMission(saved.missionId) && isValidDesign(saved.design)
      ? saved
      : null;
  },
  saveAutosave: (s) => write("mf.autosave", s),
  designs: () => readList("mf.designs").filter(isValidDesign),
  saveDesign(design) {
    const list = readList("mf.designs").filter((d) => d.name !== design.name);
    list.unshift({ ...design, savedAt: new Date().toISOString() });
    write("mf.designs", list.slice(0, 30));
  },
  deleteDesign(name) {
    write(
      "mf.designs",
      readList("mf.designs").filter((d) => d.name !== name),
    );
  },
  checkpoints: () =>
    readList("mf.checkpoints").filter(
      (c) =>
        c &&
        getMission(c.missionId) &&
        DIFFICULTIES[c.difficulty] &&
        isValidDesign(c.design) &&
        c.state?.rt,
    ),
  saveCheckpoint(ck) {
    let list = [ck, ...readList("mf.checkpoints")];
    const autos = list.filter((c) => c.auto && c.missionId === ck.missionId);
    if (autos.length > 6)
      list = list.filter((c) => c !== autos[autos.length - 1]);
    list = list.slice(0, 16);
    for (;;) {
      try {
        write("mf.checkpoints", list);
        write("mf.recovery-flight", ck);
        return true;
      } catch {
        if (list.length <= 1) return false;
        list = list.slice(0, -1);
      }
    }
  },
  deleteCheckpoint(id) {
    write(
      "mf.checkpoints",
      readList("mf.checkpoints").filter((c) => c.id !== id),
    );
  },
  attempts: (missionId, difficulty) =>
    readList(`mf.attempts.${missionId}.${difficulty}`),
  addAttempt(result) {
    const k = `mf.attempts.${result.missionId}.${result.difficulty}`;
    const list = readList(k);
    list.unshift({
      at: result.at,
      designName: result.designName,
      outcome: result.outcome,
      total: result.total,
      ...result.summary,
      events:Array.isArray(result.log)?result.log.slice(-80):[],
    });
    write(k, list.slice(0, 20));
  },
};

export function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function readJSONFile(file) {
  return new Promise((res, rej) => {
    if(!file||file.size>8*1024*1024){rej(Error("Import exceeds the 8 MB limit"));return;}
    const fr = new FileReader();
    fr.onload = () => {
      try {
        res(JSON.parse(fr.result));
      } catch (e) {
        rej(e);
      }
    };
    fr.onerror = rej;
    fr.readAsText(file);
  });
}

export function isValidDesign(d) {
  const validNode = (n) =>
    n &&
    typeof n.uid === "string" &&
    n.uid.length > 0 &&
    n.uid.length <= 128 &&
    typeof n.partId === "string" &&
    Object.prototype.hasOwnProperty.call(PARTS, n.partId);
  return (
    !!d &&
    typeof d.name === "string" &&
    Array.isArray(d.stack) &&
    d.stack.length > 0 &&
    d.stack.length <= 512 &&
    d.name.length <= 160 &&
    d.stack.every((n) => validNode(n) && !PARTS[n.partId].radialOnly) &&
    new Set(d.stack.map((n) => n.uid)).size === d.stack.length &&
    (d.radials === undefined ||
      (Array.isArray(d.radials) && d.radials.length <= 128 &&
        new Set([...d.stack, ...d.radials].map((n) => n?.uid)).size ===
          d.stack.length + d.radials.length &&
        d.radials.every(
          (n) =>
            validNode(n) &&
            PARTS[n.partId].look === "srb" &&
            [2, 3, 4].includes(n.symmetry) &&
            d.stack.some((p) => p.uid === n.parentUid),
        )))
  );
}
