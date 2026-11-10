import * as THREE from 'three';

// A display-only curve. Prediction and flight integration keep their own state.
export class FlightPath {
  constructor(count = 241) {
    this.count = count;
    this.current = new Float64Array(count * 3);
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
    // Never blend curves belonging to different planetary coordinate frames.
    if (!this.ready || body !== this.body) this.current.set(this.target);
    this.body = body;
    this.ready = true;
  }

  update(dt, craft, bodyOrigin = [0, 0, 0]) {
    if (!this.ready) return;
    const blend = -Math.expm1(-Math.max(0, dt) / 0.12);
    const out = this.positions.array;
    for (let i = 0; i < this.current.length; i += 3) {
      for (let j = 0; j < 3; j++) this.current[i + j] += (this.target[i + j] - this.current[i + j]) * blend;
      // Subtract the floating origin in double precision BEFORE the GPU upload.
      // Sending planet-sized Float32 positions loses detail beside the rocket.
      out[i] = this.current[i] + bodyOrigin[0] - craft[0];
      out[i + 1] = this.current[i + 2] + bodyOrigin[2] - craft[2];
      out[i + 2] = -(this.current[i + 1] + bodyOrigin[1] - craft[1]);
    }
    // Discard the travelled prefix between predictions, especially at time warp.
    // Otherwise the first segment can point backwards until the next refresh.
    let start = 0, closest = Infinity;
    for (let i = 0; i < this.count - 1; i++) {
      const a = i * 3, b = a + 3;
      const dx = out[b] - out[a], dy = out[b + 1] - out[a + 1], dz = out[b + 2] - out[a + 2];
      const length2 = dx * dx + dy * dy + dz * dz;
      const t = length2 > 0 ? Math.max(0, Math.min(1, -(out[a] * dx + out[a + 1] * dy + out[a + 2] * dz) / length2)) : 0;
      const distance2 = (out[a] + t * dx) ** 2 + (out[a + 1] + t * dy) ** 2 + (out[a + 2] + t * dz) ** 2;
      if (distance2 < closest) { closest = distance2; start = i; }
    }
    out[start * 3] = out[start * 3 + 1] = out[start * 3 + 2] = 0;
    this.geometry.setDrawRange(start, this.count - start);
    this.positions.needsUpdate = true;
  }
}
