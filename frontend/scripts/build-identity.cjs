const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto'),
  {
    execFileSync
  } = require('node:child_process');
const root = path.resolve(__dirname, '..'),
  build = path.resolve(root, process.env.BUILD_PATH || 'build');
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
function walk(dir) {
  return fs.readdirSync(dir, {
    withFileTypes: true
  }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
const files = walk(build).map(f => path.relative(build, f)).filter(f => !['build-info.json', 'offline-worker.js'].includes(f)).sort();
const assets = files.map(f => ({
  path: '/' + f.split(path.sep).join('/'),
  sha256: sha(fs.readFileSync(path.join(build, f))),
  bytes: fs.statSync(path.join(build, f)).size
}));
let commit = 'unavailable',
  dirty = true;
try {
  commit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8'
  }).trim();
  dirty = !!execFileSync('git', ['status', '--porcelain'], {
    cwd: root,
    encoding: 'utf8'
  }).trim();
} catch {}
const template = fs.readFileSync(path.join(root, 'public/offline-worker.js'), 'utf8');
const workerTemplateHash = sha(template);
const id = sha(JSON.stringify({
    assets,
    workerTemplateHash
  })),
  info = {
    schemaVersion: 1,
    workerTemplateHash,
    id,
    commit,
    dirty,
    builtAt: new Date().toISOString(),
    assets
  };
fs.writeFileSync(path.join(build, 'build-info.json'), JSON.stringify(info, null, 2));
const worker = template.replace('__MF_BUILD_ID__', id);
fs.writeFileSync(path.join(build, 'offline-worker.js'), worker);
console.log(`Build ${id.slice(0, 12)} (${dirty ? 'working tree includes uncommitted changes' : 'clean source tree'}), ${assets.length} hashed artifacts`);
