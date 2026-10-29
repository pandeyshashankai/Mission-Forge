export const G0 = 9.80665;

export const EARTH = {
  name: "Earth",
  mu: 3.986004418e14,
  radius: 6371000,
  rotationRate: 7.2921159e-5,
  atmosphereTop: 160000,
  source: "WGS-84 / IERS values (mean radius 6,371 km)",
};

export const LAUNCH_SITES = {
  cape: { id: "cape", name: "Cape Canaveral LC-39A (approx.)", lat: 28.6082, lon: -80.6041 },
  vandenberg: { id: "vandenberg", name: "Vandenberg SLC-4E (approx.)", lat: 34.632, lon: -120.611 },
};

export const STABLE_PERIAPSIS = 140000;
export const LAUNCH_OPS_COST = 4.0;
export const DEG = Math.PI / 180;
