import { getMission, DIFFICULTIES } from "./missions";
import { PARTS } from "./parts";

const read = (k, d) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : d;
  } catch {
    return d;
  }
};
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

export const storage = {
  settings: () => read("mf.settings", { graphics: "medium", camera: "chase" }),
  saveSettings: (s) => write("mf.settings", s),
  autosave: () => {
    const saved = read("mf.autosave", null);
    return saved && getMission(saved.missionId) && isValidDesign(saved.design) ? saved : null;
  },
  saveAutosave: (s) => write("mf.autosave", s),
  designs: () => read("mf.designs", []).filter(isValidDesign),
  saveDesign(design) {
    const list = read("mf.designs", []).filter((d) => d.name !== design.name);
    list.unshift({ ...design, savedAt: new Date().toISOString() });
    write("mf.designs", list.slice(0, 30));
  },
  deleteDesign(name) {
    write("mf.designs", read("mf.designs", []).filter((d) => d.name !== name));
  },
  checkpoints: () => read("mf.checkpoints", []).filter((c) =>
    c && getMission(c.missionId) && DIFFICULTIES[c.difficulty] && isValidDesign(c.design) && c.state?.rt
  ),
  saveCheckpoint(ck) {
    let list = [ck, ...read("mf.checkpoints", [])];
    const autos = list.filter((c) => c.auto && c.missionId === ck.missionId);
    if (autos.length > 6) list = list.filter((c) => c !== autos[autos.length - 1]);
    list = list.slice(0, 16);
    for (;;) {
      try {
        write("mf.checkpoints", list);
        return true;
      } catch {
        if (list.length <= 1) return false;
        list = list.slice(0, -1);
      }
    }
  },
  deleteCheckpoint(id) {
    write("mf.checkpoints", read("mf.checkpoints", []).filter((c) => c.id !== id));
  },
  attempts: (missionId, difficulty) => read(`mf.attempts.${missionId}.${difficulty}`, []),
  addAttempt(result) {
    const k = `mf.attempts.${result.missionId}.${result.difficulty}`;
    const list = read(k, []);
    list.unshift({ at: result.at, designName: result.designName, outcome: result.outcome, total: result.total, ...result.summary });
    write(k, list.slice(0, 20));
  },
};

export function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function readJSONFile(file) {
  return new Promise((res, rej) => {
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
  const validNode = (n) => n && typeof n.uid === "string" && !!PARTS[n.partId];
  return !!d && typeof d.name === "string" && Array.isArray(d.stack) && d.stack.length > 0 &&
    d.stack.every(validNode) && new Set(d.stack.map((n) => n.uid)).size === d.stack.length &&
    (d.radials === undefined || (Array.isArray(d.radials) && d.radials.every((n) =>
      validNode(n) && PARTS[n.partId].look === "srb" && [2, 3, 4].includes(n.symmetry) && d.stack.some((p) => p.uid === n.parentUid)
    )));
}
