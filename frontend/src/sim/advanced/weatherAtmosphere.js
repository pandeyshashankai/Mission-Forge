let model = null,
  pending = null;
export const weatherReady = () => !!model;
export function initializeWeatherModel(module) {
  model = new module.NrlmsiseModel();
  return model;
}
export function loadWeatherModel() {
  if (model) return Promise.resolve(model);
  if (!pending)
    pending = import(
      /* webpackIgnore: true */ "/science/models/nrlmsise-browser.mjs"
    )
      .then((module) => module.default())
      .then(initializeWeatherModel)
      .catch((error) => {
        pending = null;
        throw error;
      });
  return pending;
}
export function weatherDensity({
  altitude,
  latitude,
  longitude,
  doy,
  seconds,
  f107 = 150,
  f107a = 150,
  ap = 4,
}) {
  if (!model)
    throw Error(
      "Load the local NRLMSISE model before enabling this atmosphere.",
    );
  if (
    ![altitude, latitude, longitude, doy, seconds, f107, f107a, ap].every(
      Number.isFinite,
    ) ||
    altitude < 0 ||
    altitude > 1000000 ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 ||
    doy < 1 ||
    doy > 366 ||
    seconds < 0 ||
    seconds >= 86400 ||
    f107 < 50 ||
    f107 > 400 ||
    f107a < 50 ||
    f107a > 400 ||
    ap < 0 ||
    ap > 400
  )
    throw Error("Atmosphere inputs are outside the supported range.");
  const lst = (((seconds / 3600 + longitude / 15) % 24) + 24) % 24;
  model.run_model(
    doy,
    seconds,
    altitude / 1000,
    latitude,
    longitude,
    lst,
    f107a,
    f107,
    ap,
  );
  const density = model.TotalMassDensity;
  if (!Number.isFinite(density) || density < 0)
    throw Error("NRLMSISE produced an invalid density.");
  return {
    density,
    temperature: model.TemperatureAtAlt,
    exosphericTemperature: model.ExosphericTemp,
  };
}
export function weatherDensityForState(body, r, time, options) {
  const radius = Math.hypot(...r),
    altitude = Math.max(0, radius - body.radius);
  if (altitude > 1000000) return 0;
  const theta = (2 * Math.PI * time) / body.rotation,
    longitude =
      ((((((Math.atan2(r[1], r[0]) - theta) * 180) / Math.PI + 540) % 360) +
        360) %
        360) -
      180;
  const latitude =
    (Math.asin(Math.max(-1, Math.min(1, r[2] / radius))) * 180) / Math.PI;
  const epoch = new Date(Date.UTC(2000, 0, 1, 12) + time * 1000),
    year = epoch.getUTCFullYear(),
    doy =
      Math.floor(
        (Date.UTC(year, epoch.getUTCMonth(), epoch.getUTCDate()) -
          Date.UTC(year, 0, 1)) /
          86400000,
      ) + 1;
  const seconds =
    epoch.getUTCHours() * 3600 +
    epoch.getUTCMinutes() * 60 +
    epoch.getUTCSeconds() +
    epoch.getUTCMilliseconds() / 1000;
  return weatherDensity({
    altitude,
    latitude,
    longitude,
    doy,
    seconds,
    f107: options.f107,
    f107a: options.f107a,
    ap: options.ap,
  }).density;
}
