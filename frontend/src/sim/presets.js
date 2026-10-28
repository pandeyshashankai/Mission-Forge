import { newUid } from "./design";

const n = (partId) => ({ uid: newUid(), partId });

export function presetFalconLike() {
  const stack = [n("fairing_37"), n("sat_medium"), n("tank_k_37_m"), n("eng_kv"), n("decoupler_37"), n("tank_k_37_l"), n("tank_k_37_l"), n("eng_k9")];
  return { name: "Orbiter-9 (preset)", stack, radials: [], events: null };
}

export function presetBoosted() {
  const stack = [n("fairing_37"), n("sat_medium"), n("tank_h_37"), n("eng_h10"), n("eng_h10"), n("decoupler_37"), n("tank_k_37_l"), n("tank_k_37_m"), n("eng_k9")];
  const parent = stack[6].uid;
  return { name: "Hydro-Boost (preset)", stack, radials: [{ uid: newUid(), parentUid: parent, partId: "srb_63", symmetry: 2 }], events: null };
}

export function presetEmpty() {
  return { name: "New design", stack: [n("probe_core")], radials: [], events: null };
}

export const PRESETS = [
  { id: "orbiter9", label: "Orbiter-9 — two-stage kerolox", make: presetFalconLike },
  { id: "hydroboost", label: "Hydro-Boost — kerolox + hydrolox + 2 SRBs", make: presetBoosted },
  { id: "empty", label: "Empty — probe core only", make: presetEmpty },
];
