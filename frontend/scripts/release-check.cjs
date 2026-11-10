// Run from any directory. Browser audits require the documented CDP/static services.
const fs = require('node:fs');
const path = require('node:path');
const {
  spawnSync
} = require('node:child_process');
const frontend = path.resolve(__dirname, '..');
const output = path.resolve(frontend, process.env.MF_AUDIT_OUTPUT || path.join(require('./audit-output.cjs'), 'release-audit'));
fs.mkdirSync(output, {
  recursive: true
});
const extended = process.argv.includes('--extended');
const browser = extended || process.argv.includes('--browser');
const tasks = [['regressions', 'test'], ['build', 'build'], ['campaign', 'test:campaign'], ['combinations', 'test:combinations'], ...(extended ? [['scenarios','test:scenarios'],['challenges','test:challenges'],['profile','test:optimization:profile']] : []), ...(browser ? [['persistence', 'test:persistence:ui'], ['interface', 'test:ui'], ['controls', 'test:controls'], ['engineering', 'test:engineering:ui'], ['visuals', 'test:visuals:ui'], ['roadmap', 'test:roadmap:ui'], ['advanced', 'test:advanced:ui'], ['catalogue', 'test:catalogue:ui'], ['private-assets', 'test:private-assets'], ['lab-scrolling', 'test:labs:ui'], ['compact-cockpit', 'test:cockpit:ui'], ['profile-camera', 'test:profile-view:ui'], ['map-path', 'test:map-path:ui'], ['assembly-controls','test:assembly:ui'], ['assembly-mobile','test:assembly:mobile'], ['builder-studio','test:studio:ui'], ['magnetic-builder','test:magnets:ui'], ['placed-part-touch','test:placed-parts:ui'], ...(extended ? [['mobile-visibility','test:mobile-visibility:ui'],['milestones','test:milestones:ui'],['education','test:education:ui'],['backlog','test:backlog:ui'],['devices', 'test:devices:ui'], ['skips', 'test:skips:ui'], ['mobile', 'test:mobile:ui'], ['vehicle', 'test:vehicle:ui'], ['contact', 'test:contact:ui'], ['tpsx', 'test:tpsx:ui'], ['thermal', 'test:thermal:ui'], ['empty', 'test:empty:ui'], ['legacy-flow', 'test:legacy-flow:ui']] : []), ['showcase', 'test:showcase'], ['offline', 'test:offline'], ['offline-update','test:offline:update']] : [])];
const results = [];
let failed = false;
for (const [name, script] of tasks) {
  const start = Date.now();
  const run = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', script], {
    cwd: frontend,
    // The release output is a directory; older leaf audits use this name for a file.
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'MF_AUDIT_OUTPUT')),
    shell: process.platform === 'win32',
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024
  });
  const text = (run.stdout || '') + (run.stderr || '') + (run.error ? String(run.error) : '');
  fs.writeFileSync(path.join(output, name + '.log'), text);
  const report = {
    name,
    command: 'npm run ' + script,
    status: run.status === 0 ? 'PASS' : 'FAIL',
    durationMs: Date.now() - start,
    completedAt: new Date().toISOString(),
    log: name + '.log'
  };
  if (name === 'regressions') report.checks = [...text.matchAll(/ℹ tests (\d+)/g)].reduce((n, m) => n + Number(m[1]), 0);
  fs.writeFileSync(path.join(output, name + '.json'), JSON.stringify(report, null, 2) + '\n');
  results.push(report);
  console.log(`${report.status}: ${name} (${(report.durationMs / 1000).toFixed(1)} s)`);
  if (run.status !== 0) {
    failed = true;
    console.error(`\n${name} failure details (last 80 lines):\n${text.split('\n').slice(-80).join('\n')}\nFull log: ${path.join(output, name + '.log')}`);
    break;
  }
}
let identity = null;
try {
  identity = JSON.parse(fs.readFileSync(path.join(frontend, 'build/build-info.json'), 'utf8'));
} catch {}
const manifest = {
  schemaVersion: 1,
  build: identity?.id || null,
  commit: identity?.commit || null,
  dirty: identity?.dirty ?? null,
  browserAuditsIncluded: browser,
  extendedAuditsIncluded: extended,
  status: failed ? 'FAIL' : 'PASS',
  scope: extended ? 'extended scenario/device/skip and release audits' : browser ? 'standard and browser release audits' : 'standard audits; browser checks not run',
  audits: results
};
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Audit manifest: ' + path.join(output, 'manifest.json'));
process.exitCode = failed ? 1 : 0;
