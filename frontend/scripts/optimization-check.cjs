// Compare identical work in separate processes; do not mutate production sources.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'mission-forge-perf-'));
const rounds = [];
try {
  for (let round = 0; round < 3; round++) {
    const reports = {};
    // Reverse order on alternating rounds to reduce systematic warm-machine bias.
    for (const variant of round % 2 ? ['after', 'before'] : ['before', 'after']) {
      const output = path.join(folder, `${round}-${variant}.json`);
      const run = spawnSync(process.execPath, [path.join(__dirname, 'profile-flight.cjs')], {
        env: { ...process.env, MF_PROFILE_REFERENCE: variant === 'before' ? '1' : '0', MF_PROFILE_OUTPUT: output },
        encoding: 'utf8', maxBuffer: 1024 * 1024,
      });
      assert.equal(run.status, 0, run.stderr || run.stdout);
      reports[variant] = JSON.parse(fs.readFileSync(output, 'utf8'));
    }
    for (let i = 0; i < reports.before.cases.length; i++) {
      const a = reports.before.cases[i], b = reports.after.cases[i];
      assert.equal(b.name, a.name);
      assert.equal(b.requestedSeconds, a.requestedSeconds);
      assert.equal(b.finalSimulationTime, a.finalSimulationTime);
      assert.equal(b.stateSHA256, a.stateSHA256, `${a.name}/${a.requestedSeconds} changed state`);
    }
    rounds.push(reports);
  }
  const median = values => [...values].sort((a, b) => a - b)[1];
  const cases = rounds[0].before.cases.map((c, i) => {
    const beforeMs = median(rounds.map(r => r.before.cases[i].medianMs));
    const afterMs = median(rounds.map(r => r.after.cases[i].medianMs));
    return { name: c.name, requestedSeconds: c.requestedSeconds, beforeMs, afterMs,
      cpuTimeReductionPercent: 100 * (1 - afterMs / beforeMs),
      identicalState: true, finalSimulationTime: c.finalSimulationTime, stateSHA256: c.stateSHA256 };
  });
  const report = { checkedAt: new Date().toISOString(), status: 'PASS',
    scope: 'Three paired isolated Node processes per implementation; alternating execution order. Each case uses 10 warmups and 100 identical advance requests. Median of per-process medians; timings are environment-specific, not a universal FPS guarantee. Small sub-millisecond timings are noisy.',
    invariants: 'No force-model, integrator, step-limit, warp, rendering-quality, control or UI changes. State checksums and achieved simulation times must match exactly.',
    cases, rounds };
  const output = path.resolve(require('./audit-output.cjs'), 'optimization-validation.json');
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log('PASS: all 27 paired workload outcomes have identical states and achieved simulation times');
  console.table(cases.map(({ name, requestedSeconds, beforeMs, afterMs, cpuTimeReductionPercent }) => ({ name, requestedSeconds, beforeMs, afterMs, cpuTimeReductionPercent })));
} finally {
  fs.rmSync(folder, { recursive: true, force: true });
}
