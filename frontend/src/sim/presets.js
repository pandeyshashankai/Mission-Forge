import { newUid } from "./design";

const n = (partId) => ({ uid: newUid(), partId });

export function presetFalconLike(payload = "sat_small") {
  const stack = [n("fairing_37"), n(payload), n("rcs_ring"), n("tank_mono"), n("tank_k_37_m"), n("tank_k_37_s"), n("eng_kv"), n("decoupler_37"), n("tank_k_37_l"), n("tank_k_37_l"), n("eng_k9")];
  return { name: "Orbiter-9 (preset)", stack, radials: [], events: null };
}

export function presetBoosted() {
  const stack = [n("fairing_37"), n("sat_small"), n("rcs_ring"), n("tank_mono"), n("tank_h_37"), n("eng_h10"), n("eng_h10"), n("decoupler_37"), n("tank_k_37_l"), n("tank_k_37_m"), n("eng_k9")];
  const parent = stack[8].uid;
  return { name: "Hydro-Boost (preset)", stack, radials: [{ uid: newUid(), parentUid: parent, partId: "srb_63", symmetry: 2 }], events: null };
}

export function presetEmpty() {
  return { name: "New design", stack: [n("probe_core")], radials: [], events: null };
}

export function presetLunarOrbiter() {
  const stack = [n("fairing_37"), n("sat_lunar"), n("rcs_ring"), n("tank_mono"), n("tank_hyp_18"), n("eng_oms"), n("decoupler_37"), n("tank_h_37"), n("eng_hm"), n("decoupler_37"), n("tank_k_37_m"), n("eng_kv"), n("decoupler_37"), n("tank_k_37_l"), n("tank_k_37_l"), n("eng_k9")];
  return { name: "Selene-1 (preset)", stack, radials: [{ uid: newUid(), parentUid: stack[12].uid, partId: "srb_63", symmetry: 2 }], events: null };
}

export function presetCrewedFlyby() {
  const stack = [n("chute_pack"), n("capsule_3"), n("heat_shield_37"), n("decoupler_37"), n("ls_pallet"), n("solar_array"), n("rcs_ring"), n("tank_mono"), n("tank_hyp_18"), n("eng_oms"), n("decoupler_37"), n("tank_h_37"), n("tank_h_37"), n("eng_hm"), n("decoupler_37"), n("tank_k_37_l"), n("tank_k_37_l"), n("tank_k_37_l"), n("tank_k_37_l"), n("tank_k_37_l"), n("eng_k9"), n("eng_k9")];
  const parent = stack[14].uid;
  return { name: "Odyssey Free-Return (preset)", stack, radials: [{ uid: newUid(), parentUid: parent, partId: "srb_63", symmetry: 4 }], events: null };
}

export function presetMarsOrbiter() {
  const stack = [n("fairing_37"), n("sat_lunar"), n("rcs_ring"), n("tank_mono"), n("tank_hyp_18"), n("tank_hyp_18"), n("eng_oms"), n("decoupler_37"), n("tank_h_37"), n("tank_h_37"), n("eng_hm"), n("decoupler_37"), n("tank_k_37_l"), n("tank_k_37_l"), n("tank_k_37_l"), n("tank_k_37_l"), n("tank_k_37_l"), n("eng_k9"), n("eng_k9")];
  return { name: "Ares Pathfinder (preset)", stack, radials: [{ uid: newUid(), parentUid: stack[12].uid, partId: "srb_63", symmetry: 4 }], events: null };
}

export const PRESETS = [
  { id: "orbiter9", label: "Orbiter-9 — two-stage kerolox", make: presetFalconLike },
  { id: "orbiter9eo", label: "Orbiter-9 EO — with 2.5 t Observation Bus", make: () => ({ ...presetFalconLike("sat_medium"), name: "Orbiter-9 EO (preset)" }) },
  { id: "hydroboost", label: "Hydro-Boost — kerolox + hydrolox + 2 SRBs", make: presetBoosted },
  { id: "lunar_orbiter", label: "Selene-1 — kerolox + hydrolox TLI stage + storable orbiter", make: presetLunarOrbiter },
  { id: "crewed_flyby", label: "Odyssey — super-heavy, hydrolox TLI, capsule + service module", make: presetCrewedFlyby },
  { id: "mars_orbiter", label: "Ares Pathfinder — super-heavy, hydrolox escape stage, storable orbiter", make: presetMarsOrbiter },
  { id: "empty", label: "Empty — probe core only", make: presetEmpty },
];
