// HARDISP-style 342-constituent admittance model. Source tables/notices are bundled.
import data from "../../science/data/ocean-loading.json";
export const loadingModel = data;
const century = 36525 * 86400,
  arc = Math.PI / (180 * 3600);
const polys = [
  [485868.249036, 1717915923.2178, 31.8792, 0.051635, -0.0002447],
  [1287104.793048, 129596581.0481, -0.5532, 0.000136, -0.00001149],
  [335779.526232, 1739527262.8478, -12.7512, -0.001037, 0.00000417],
  [1072260.703692, 1602961601.209, -6.3706, 0.006593, -0.00003169],
  [450160.398036, -6962890.5431, 7.4722, 0.007702, -0.00005939],
];
const gmst = [
  0.014506, 4612.156534, 1.3915817, -0.00000044, -0.000029956, -0.0000000368,
];
const polynomial = (p, t) => p.reduce((s, x, i) => s + x * t ** i, 0) * arc;
const derivative = (p, t) =>
  (p.reduce((s, x, i) => s + (i ? i * x * t ** (i - 1) : 0), 0) * arc) /
  century;
function argumentsAt(seconds, ttMinusUt1) {
  const t = (seconds + ttMinusUt1) / century;
  return {
    values: [
      2 * Math.PI * (0.779057273264 + (1.00273781191135448 * seconds) / 86400) +
        polynomial(gmst, t) +
        Math.PI,
      ...polys.map((p) => polynomial(p, t)),
    ],
    rates: [
      (2 * Math.PI * 1.00273781191135448) / 86400 + derivative(gmst, t),
      ...polys.map((p) => derivative(p, t)),
    ],
  };
}
const multipliers = ([t, s, h, p, n, ps]) => [
  t,
  -p,
  -ps,
  -t + s + h + p + ps,
  -h - ps,
  -t + s + h + p - n + ps,
];
const code = ([t, s, h, p, n, ps]) =>
  t * 100000 +
  (s + 5) * 10000 +
  (h + 5) * 1000 +
  (p + 5) * 100 +
  (n + 5) * 10 +
  ps +
  5;
const waves = data.rows.map((r) => ({
  ...r,
  code: code(r.doodson),
  m: multipliers(r.doodson),
  species: r.doodson[0],
}));
const columns = [
  255555, 273555, 245655, 275555, 165555, 145555, 163555, 135655, 75555, 65455,
  57555,
];
const scalar = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
export function validateLoadingStation(station) {
  if (
    !station ||
    typeof station.name !== "string" ||
    !station.name.trim() ||
    station.name.length > 80 ||
    ![station.latitude, station.longitude, station.height].every(
      Number.isFinite,
    ) ||
    Math.abs(station.latitude) > 90 ||
    Math.abs(station.longitude) > 180 ||
    station.height < -500 ||
    station.height > 10000 ||
    !Array.isArray(station.coefficients) ||
    station.coefficients.length !== 6 ||
    station.coefficients.some(
      (r, i) =>
        !Array.isArray(r) ||
        r.length !== 11 ||
        r.some(
          (x) =>
            !Number.isFinite(x) ||
            (i < 3 ? x < 0 || x > 10 : Math.abs(x) > 360),
        ),
    )
  )
    throw Error(
      "Use a BLQ station with coordinates, three amplitude rows (metres) and three lag rows (degrees), eleven constituents each.",
    );
  return {
    name: station.name.trim(),
    latitude: station.latitude,
    longitude: station.longitude,
    height: station.height,
    coefficients: station.coefficients.map((r) => [...r]),
    source:
      typeof station.source === "string"
        ? station.source.slice(0, 2000)
        : "Imported BLQ; provenance supplied by the user",
    ...(station.geographyWarning
      ? { geographyWarning: String(station.geographyWarning).slice(0, 500) }
      : {}),
  };
}
export function parseBLQ(text) {
  if (typeof text !== "string" || text.length > 250000)
    throw Error("BLQ input must be text up to 250 kB.");
  const stations = [];
  let station = null,
    rows = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("$$")) {
      const m = line.match(/lon\/lat:\s*([-+.\d]+)\s+([-+.\d]+)\s+([-+.\d]+)/i);
      if (m && station) {
        station.longitude = Number(m[1]);
        station.latitude = Number(m[2]);
        station.height = Number(m[3]);
      }
      if (station)
        station.source = (station.source + " " + line.slice(2).trim()).slice(
          0,
          2000,
        );
      continue;
    }
    const numbers = line.split(/\s+/).map(Number);
    if (numbers.length === 11 && numbers.every(Number.isFinite)) {
      if (!station) throw Error("Station name is missing before BLQ data.");
      rows.push(numbers);
      if (rows.length === 6) {
        station.coefficients = rows;
        stations.push(validateLoadingStation(station));
        station = null;
        rows = [];
        if (stations.length > 32) throw Error("Use at most 32 BLQ stations.");
      }
    } else {
      if (station || rows.length)
        throw Error("Incomplete or malformed BLQ station.");
      station = { name: line, source: "" };
    }
  }
  if (station || rows.length || !stations.length)
    throw Error("BLQ file has no complete station or ends mid-record.");
  if (
    new Set(stations.map((s) => s.name.toLowerCase())).size !== stations.length
  )
    throw Error("Duplicate BLQ station names.");
  return stations;
}
export function naturalSpline(x, y) {
  if (
    x.length !== y.length ||
    x.length < 3 ||
    x.some((v, i) => !Number.isFinite(v) || (i && v <= x[i - 1])) ||
    y.some((v) => !Number.isFinite(v))
  )
    throw Error("Invalid spline samples.");
  const n = x.length,
    h = x.slice(1).map((v, i) => v - x[i]),
    alpha = Array(n).fill(0),
    l = Array(n).fill(0),
    mu = Array(n).fill(0),
    z = Array(n).fill(0),
    c = Array(n).fill(0),
    b = Array(n - 1),
    d = Array(n - 1);
  l[0] = 1;
  for (let i = 1; i < n - 1; i++)
    alpha[i] =
      (3 * (y[i + 1] - y[i])) / h[i] - (3 * (y[i] - y[i - 1])) / h[i - 1];
  for (let i = 1; i < n - 1; i++) {
    l[i] = 2 * (x[i + 1] - x[i - 1]) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i];
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
  }
  l[n - 1] = 1;
  for (let j = n - 2; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (y[j + 1] - y[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }
  return (value) => {
    const t = Math.max(x[0], Math.min(x[n - 1], value));
    let i = n - 2;
    while (i > 0 && t < x[i]) i--;
    const dx = t - x[i];
    return y[i] + b[i] * dx + c[i] * dx ** 2 + d[i] * dx ** 3;
  };
}
export function loadingDisplacement(input, seconds, ttMinusUt1 = 64.184) {
  const station = validateLoadingStation(input);
  if (
    !Number.isFinite(seconds) ||
    Math.abs(seconds) > century ||
    !Number.isFinite(ttMinusUt1) ||
    ttMinusUt1 < -100 ||
    ttMinusUt1 > 200
  )
    throw Error(
      "Use an epoch within one century of J2000 and explicit TT−UT1 from −100 to 200 seconds.",
    );
  const args = argumentsAt(seconds, ttMinusUt1),
    splines = [];
  for (let species = 0; species < 3; species++) {
    const main = columns
      .map((c, index) => ({ ...waves.find((w) => w.code === c), index }))
      .filter((w) => w.species === species)
      .sort((a, b) => scalar(a.m, args.rates) - scalar(b.m, args.rates));
    const rates = main.map((w) => scalar(w.m, args.rates));
    splines[species] = Array.from({ length: 3 }, (_, axis) => [
      naturalSpline(
        rates,
        main.map(
          (w) =>
            (station.coefficients[axis][w.index] *
              Math.cos(
                (-station.coefficients[axis + 3][w.index] * Math.PI) / 180,
              )) /
            Math.abs(w.amplitude),
        ),
      ),
      naturalSpline(
        rates,
        main.map(
          (w) =>
            (station.coefficients[axis][w.index] *
              Math.sin(
                (-station.coefficients[axis + 3][w.index] * Math.PI) / 180,
              )) /
            Math.abs(w.amplitude),
        ),
      ),
    ]);
  }
  const components = [0, 0, 0];
  for (const w of waves) {
    const rate = scalar(w.m, args.rates),
      phase =
        scalar(w.m, args.values) +
        (w.species === 0 ? Math.PI : w.species === 1 ? Math.PI / 2 : 0);
    for (let axis = 0; axis < 3; axis++) {
      const re = splines[w.species][axis][0](rate),
        im = splines[w.species][axis][1](rate);
      components[axis] +=
        w.amplitude * Math.hypot(re, im) * Math.cos(phase + Math.atan2(im, re));
    }
  }
  const lat = (station.latitude * Math.PI) / 180,
    lon = (station.longitude * Math.PI) / 180,
    up = [
      Math.cos(lat) * Math.cos(lon),
      Math.cos(lat) * Math.sin(lon),
      Math.sin(lat),
    ],
    west = [Math.sin(lon), -Math.cos(lon), 0],
    south = [
      Math.sin(lat) * Math.cos(lon),
      Math.sin(lat) * Math.sin(lon),
      -Math.cos(lat),
    ];
  return {
    up: components[0],
    west: components[1],
    south: components[2],
    ecef: [0, 1, 2].map(
      (i) =>
        components[0] * up[i] +
        components[1] * west[i] +
        components[2] * south[i],
    ),
    constituents: waves.length,
    seconds,
    ttMinusUt1,
  };
}
export function stationPosition(station, displacement) {
  const s = validateLoadingStation(station),
    lat = (s.latitude * Math.PI) / 180,
    lon = (s.longitude * Math.PI) / 180,
    e2 = 6.6943799901413165e-3,
    N = 6378137 / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  return [
    (N + s.height) * Math.cos(lat) * Math.cos(lon),
    (N + s.height) * Math.cos(lat) * Math.sin(lon),
    (N * (1 - e2) + s.height) * Math.sin(lat),
  ].map((v, i) => v + (displacement?.ecef[i] || 0));
}
