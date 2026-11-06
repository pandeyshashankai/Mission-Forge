import { localData } from "../../persistence/localData";
import { EARTH, G0 } from "../../sim/constants";
import { orbitFacts } from "../../science/catalog";
import { tpsxMaterial } from "../../sim/advanced/tpsx";
import { damageState, thermalStep } from "../../sim/advanced/damage";
export const LESSONS = [
  {
    id: "orbit",
    title: "Space is not orbit",
    question: "What keeps a spacecraft in orbit?",
    choices: [
      "Enough sideways speed",
      "Altitude alone",
      "Continuous engine thrust",
    ],
    answer: 0,
    explanation:
      "Gravity still acts in orbit. Sideways motion lets a spacecraft keep falling around Earth.",
    action: "Predict, launch and inspect your periapsis",
  },
  {
    id: "staging",
    title: "Mass, staging and delta-v",
    question: "What happens when empty lower-stage mass is discarded?",
    choices: [
      "More upper-stage delta-v",
      "Less upper-stage delta-v",
      "No change",
    ],
    answer: 0,
    explanation:
      "Discarding empty structure reduces the mass accelerated by the remaining propellant.",
    action: "Compare two ideal two-stage calculations",
  },
  {
    id: "altitude",
    title: "Higher orbit, lower circular speed",
    question:
      "How does ideal circular speed change as orbital altitude increases?",
    choices: ["It increases", "It decreases", "It stays fixed"],
    answer: 1,
    explanation:
      "Circular speed is sqrt(mu/r). Higher circular orbits need less speed, although reaching them still needs a transfer.",
    action: "Change altitude and compare sourced worlds",
  },
  {
    id: "inclination",
    title: "Turning an orbital plane",
    question:
      "At a fixed speed, which impulsive plane change needs more delta-v?",
    choices: ["5 degrees", "30 degrees", "They are equal"],
    answer: 1,
    explanation:
      "The ideal same-speed plane-change cost is 2v sin(delta-i/2). Launch geometry is a separate constraint.",
    action: "Change the angle and inspect the ideal cost",
  },
  {
    id: "heat",
    title: "Why a heat shield matters",
    question: "What can a heat shield do during entry?",
    choices: [
      "Remove gravity",
      "Manage heat reaching the structure",
      "Make every entry safe",
    ],
    answer: 1,
    explanation:
      "Thermal protection manages incoming energy. Temperature depends on forcing, duration and material; no shield guarantees safety.",
    action: "Compare shielded and exposed educational responses",
  },
];
export function lessonExperiment(id, value = 200) {
  if (!Number.isFinite(value)) throw Error("Enter a finite experiment value.");
  if (id === "orbit" || id === "altitude") {
    if (value < 160 || value > 2000)
      throw Error("Use an altitude from 160 to 2,000 km.");
    return {
      kind: "orbit",
      altitudeKm: value,
      ...orbitFacts(EARTH, value * 1000),
      equation: "v = sqrt(mu / (R + h))",
      limit: "Ideal circular two-body reference; not a transfer burn.",
    };
  }
  if (id === "staging") {
    if (value < 0 || value > 5000) throw Error("Payload must be 0–5,000 kg.");
    const ve = 320 * G0,
      upper = 4000 + value,
      first = ve * Math.log((8000 + upper) / (2000 + upper));
    return {
      kind: "staging",
      payloadKg: value,
      staged: first + ve * Math.log(upper / (1000 + value)),
      retained: first + ve * Math.log((2000 + upper) / (3000 + value)),
      equation: "delta-v = Isp g0 ln(m0/mf)",
      limit:
        "Ideal two-stage comparison: lower dry/fuel 2,000/6,000 kg; upper dry/fuel 1,000/3,000 kg; Isp 320 s. No drag or gravity losses.",
    };
  }
  if (id === "inclination") {
    if (value < 0 || value > 90)
      throw Error("Use an angle from 0 to 90 degrees.");
    const speed = orbitFacts(EARTH, 200000).circularSpeed;
    return {
      kind: "inclination",
      angleDeg: value,
      speed,
      deltaV: 2 * speed * Math.sin((value * Math.PI) / 360),
      equation: "delta-v = 2v sin(delta-i / 2)",
      limit:
        "Single instantaneous plane change at fixed speed in a 200 km orbit; not a launch-cost prediction.",
    };
  }
  if (id === "heat") {
    if (value < 0 || value > 1000) throw Error("Use 0–1,000 kW/m².");
    const shield = thermalStep(
        damageState(),
        value * 1000,
        0,
        0,
        10,
        tpsxMaterial("avcoat-virgin"),
      ),
      exposed = thermalStep(
        damageState({ shieldKg: 0 }),
        value * 1000,
        0,
        0,
        10,
        { type: "exposed", heatCapacity: 60000, area: 8, emissivity: 0.8 },
      );
    return {
      kind: "heat",
      fluxKW: value,
      shieldK: shield.backTemperature,
      exposedK: exposed.backTemperature,
      equation: "C dT/dt = absorbed heat − radiated heat",
      limit:
        "Ten-second constant forcing; assumed capacities and area. AVCOAT virgin reference properties and assumed backing; not measured entry or spacecraft certification.",
    };
  }
  throw Error("Unknown lesson");
}
export function readAcademy() {
  try {
    const s = JSON.parse(localData.getItem("mf.academy") || "null");
    const lessons = {};
    if (s?.version === 1 && s.lessons && typeof s.lessons === "object") {
      for (const lesson of LESSONS) {
        const entry = s.lessons[lesson.id];
        if (
          entry &&
          Number.isInteger(entry.choice) &&
          lesson.choices[entry.choice] &&
          typeof entry.reflection === "string" &&
          typeof entry.completedAt === "string"
        )
          lessons[lesson.id] = {
            choice: entry.choice,
            reflection: entry.reflection.slice(0, 2000),
            completedAt: entry.completedAt,
            experiment: entry.experiment,
          };
      }
    }
    return { version: 1, lessons };
  } catch {
    return { version: 1, lessons: {} };
  }
}
export function saveLesson(id, entry) {
  if (
    !LESSONS.some((l) => l.id === id) ||
    !Number.isInteger(entry.choice) ||
    !LESSONS.find((l) => l.id === id).choices[entry.choice] ||
    typeof entry.reflection !== "string" ||
    !entry.reflection.trim()
  )
    throw Error("Choose a prediction and write a reflection.");
  const state = readAcademy();
  state.lessons[id] = {
    choice: entry.choice,
    reflection: entry.reflection.trim().slice(0, 2000),
    experiment: entry.experiment,
    completedAt: new Date().toISOString(),
  };
  localData.setItem("mf.academy", JSON.stringify(state));
  return state;
}
export function activeAcademyFlight() {
  try {
    const s = JSON.parse(localData.getItem("mf.academy-flight"));
    return s?.version === 1 &&
      typeof s.predictionId === "string" &&
      s.predictionId.length < 100 &&
      Number.isInteger(s.choice) &&
      s.choice >= 0 &&
      s.choice <= 2
      ? s
      : null;
  } catch {
    return null;
  }
}
