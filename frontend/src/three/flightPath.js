import * as THREE from 'three';

// A display-only curve. Prediction and flight integration keep their own state.
export class FlightPath {
  constructor(count = 241) {
    this.count = count;
    this.target = new Float64Array(count * 3);
    this.geometry = new THREE.BufferGeometry();
    this.positions = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    this.positions.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.positions);
    this.line = new THREE.Line(this.geometry, new THREE.LineBasicMaterial({
      color: '#38bdf8', transparent: true, opacity: 0.8,
    }));
    this.line.frustumCulled = false;
    this.reset();
  }

  reset() {
    this.body = null;
    this.ready = false;
    this.line.visible = false;
  }

  setTarget(points, body) {
    if (points.length < 2 || points.some(p => p.length !== 3 || !p.every(Number.isFinite))) {
      this.reset();
      return;
    }
    // Equal-distance samples keep correspondence when the predictor changes its
    // adaptive step count or the impact point moves during powered ascent.
    const distance = new Float64Array(points.length);
    for (let i = 1; i < points.length; i++) {
      distance[i] = distance[i - 1] + Math.hypot(...points[i].map((v, j) => v - points[i - 1][j]));
    }
    let segment = 1;
    for (let i = 0; i < this.count; i++) {
      const along = distance[distance.length - 1] * i / (this.count - 1);
      while (segment < points.length - 1 && distance[segment] < along) segment++;
      const length = distance[segment] - distance[segment - 1];
      const fraction = length > 0 ? (along - distance[segment - 1]) / length : 0;
      for (let j = 0; j < 3; j++) {
        this.target[i * 3 + j] = points[segment - 1][j] * (1 - fraction) + points[segment][j] * fraction;
      }
    }
    this.body = body;
    this.ready = true;
  }

  // Full map forecasts retain their original topology: do not morph an old
  // suborbital arc into a new staged/escape trajectory or splice its far loop.
  update(dt, craft, bodyOrigin = [0, 0, 0]) {
    if (!this.ready) return;
    const out = this.positions.array;
    for (let i = 0; i < this.target.length; i += 3) {
      out[i] = this.target[i] + bodyOrigin[0] - craft[0];
      out[i + 1] = this.target[i + 2] + bodyOrigin[2] - craft[2];
      out[i + 2] = -(this.target[i + 1] + bodyOrigin[1] - craft[1]);
    }
    this.geometry.setDrawRange(0, this.count);
    this.positions.needsUpdate = true;
  }

  // Close-up views need a live local tangent, not a planet-sized polyline
  // crossing the camera. This short coast forecast starts anew every frame.
  updateLocal(velocity, acceleration) {
    const speed = Math.hypot(...velocity);
    const horizon = Math.min(3, 2000 / Math.max(1, speed));
    const out = this.positions.array;
    for (let i = 0; i < this.count; i++) {
      const t = horizon * i / (this.count - 1);
      out[i * 3] = velocity[0] * t + acceleration[0] * t * t / 2;
      out[i * 3 + 1] = velocity[2] * t + acceleration[2] * t * t / 2;
      out[i * 3 + 2] = -(velocity[1] * t + acceleration[1] * t * t / 2);
    }
    out[0] = out[1] = out[2] = 0;
    this.geometry.setDrawRange(0, this.count);
    this.positions.needsUpdate = true;
  }
}
