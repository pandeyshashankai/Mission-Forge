import {loadingDisplacement,stationPosition} from './oceanLoading';
import {rotateZ} from './frames';
import {dot} from '../vec';
import { stateFor } from "./ephemerides";
import { illumination, occluded } from "./forces";
import { BODY_BY_ID, AU } from "../solarSystem";
import { add, sub, len } from "../vec";
export const BATTERY_WH = 1200;
export function powerEnvironment(
  position,
  time,
  primaryId,
  throttle = 0,
  options,
  craftPower,
) {
  const lit = illumination(position, time, primaryId, options),
    solarWatts = lit * (craftPower?.solarWatts ?? 800) * (AU / len(position)) ** 2;
  return { capacityWh: craftPower?.batteryWh ?? BATTERY_WH, lit, solarWatts, loadWatts: 100 + Math.max(0, throttle) * 80 };
}
export function updateBattery(wh, environment, seconds, capacity = BATTERY_WH) {
  return Math.max(
    0,
    Math.min(
      capacity,
      wh + ((environment.solarWatts - environment.loadWatts) * seconds) / 3600,
    ),
  );
}
// Illustrative equatorial Earth ground station with model-fixed axis, 2 AU range.
export function groundLink(position, time, options) {
  const bodyState = (id, t) => stateFor(options, id, t);
  const earth = BODY_BY_ID.earth,
    center = bodyState("earth", time).r,
    theta = (2 * Math.PI * time) / earth.rotation;
  let ground = add(center, [
    earth.radius * Math.cos(theta),
    earth.radius * Math.sin(theta),
    0,
  ]);
  let loading=null,stationNormal=null;
  if(options?.oceanLoading){const {station,ttMinusUt1}=options.oceanLoading;loading=loadingDisplacement(station,time,ttMinusUt1);ground=add(center,rotateZ(stationPosition(station,loading),theta));const lat=station.latitude*Math.PI/180,lon=station.longitude*Math.PI/180;stationNormal=rotateZ([Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)],theta);}
  const range = len(sub(position, ground));
  const blocked =
    (stationNormal ? dot(sub(position,ground),stationNormal)<=0 : occluded(ground, position, center, earth.radius - 1)) ||
    Object.values(BODY_BY_ID).some(
      (b) =>
        b.id !== "sun" &&
        b.id !== "earth" &&
        occluded(ground, position, bodyState(b.id, time).r, b.radius),
    );
  return {
    connected: !blocked && range <= 2 * AU,
    range,
    delay: range / 299792458,
    blocked,
    ...(loading?{stationLoading:loading,station:options.oceanLoading.station.name}:{}),
  };
}
