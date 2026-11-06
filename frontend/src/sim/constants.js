import { physicalConstants } from "../science/catalog";

const nasaEarth = physicalConstants("earth");
export const G0 = 9.80665;

export const EARTH = {
  name: "Earth",
  mu: nasaEarth.mu,
  radius: Math.round(nasaEarth.radius / 1000) * 1000,
  rotationRate: (2 * Math.PI) / nasaEarth.rotation,
  atmosphereTop: 160000,
  source:
    "NASA GMAT gravitational parameter; NAIF volume-equivalent radius rounded to km. Rotation uses the NAIF linear prime-meridian rate.",
};

export const LAUNCH_SITES = {
  cape: {
    id: "cape",
    name: "Cape Canaveral LC-39A (approx.)",
    lat: 28.6082,
    lon: -80.6041,
  },
  vandenberg: {
    id: "vandenberg",
    name: "Vandenberg SLC-4E (approx.)",
    lat: 34.632,
    lon: -120.611,
  },
};

export const STABLE_PERIAPSIS = 140000;
export const LAUNCH_OPS_COST = 4.0;
export const DEG = Math.PI / 180;
