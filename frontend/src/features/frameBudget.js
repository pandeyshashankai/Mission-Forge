// Limit work per presentation frame. Integration rules and recorded step counts stay authoritative.
export class FrameBudget {
  constructor(targetMs = 6) {
    this.targetMs = targetMs;
    this.msPerStep = .5;
  }
  limit(vessels = 1) {
    return Math.max(1, Math.min(600, Math.floor(this.targetMs / (this.msPerStep * Math.max(1, vessels)))));
  }
  observe(milliseconds, steps) {
    if (!Number.isFinite(milliseconds) || milliseconds < 0 || !Number.isFinite(steps) || steps <= 0) return;
    const measured = Math.max(.005, milliseconds / steps);
    this.msPerStep = .25 * this.msPerStep + .75 * measured;
  }
}
