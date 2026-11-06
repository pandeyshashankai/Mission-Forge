/* global globalThis */
export function validateJson(value, {
  maxBytes = 20 * 1024 * 1024
} = {}) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, (_, v) => {
    if (typeof v === 'number' && !Number.isFinite(v)) throw Error('Non-finite number');
    return v;
  });
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > maxBytes) throw Error('Backup exceeds supported size');
  const data = JSON.parse(text);
  let nodes = 0;
  function walk(v, depth) {
    if (typeof v === 'number' && !Number.isFinite(v)) throw Error('Non-finite number');
    if (++nodes > 300000 || depth > 40) throw Error('Backup structure exceeds supported limits');
    if (v && typeof v === 'object') {
      for (const [key, x] of Object.entries(v)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) throw Error('Unsafe data key');
        walk(x, depth + 1);
      }
    }
  }
  walk(data, 0);
  return data;
}
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export async function digest(value) {
  const bytes = new TextEncoder().encode(canonical(value));
  if (!globalThis.crypto?.subtle) throw Error('Backup integrity requires HTTPS or localhost');
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
}
export function validateEntries(entries) {
  if (!Array.isArray(entries) || entries.length > 256) throw Error('Invalid backup entry count');
  const seen = new Set();
  for (const row of entries) {
    if (!Array.isArray(row) || row.length !== 2 || typeof row[0] !== 'string' || !row[0].startsWith('mf.') || row[0].length > 160 || seen.has(row[0]) || typeof row[1] !== 'string') throw Error('Invalid or duplicate backup key');
    seen.add(row[0]);
    validateJson(row[1]);
  }
  return entries;
}
export async function makeBackup(entries, build = 'unidentified') {
  validateEntries(entries);
  if (typeof build !== 'string' || build.length > 160) throw Error('Invalid build metadata');
  const payload = {
    entries,
    build,
    createdAt: new Date().toISOString()
  };
  const backup = {
    format: 'missionforge-local-backup',
    schemaVersion: 1,
    payload,
    sha256: '0'.repeat(64)
  };
  // Match the actual downloaded file's budget, including envelope and escaping.
  validateJson(JSON.stringify(backup, null, 2));
  backup.sha256 = await digest(payload);
  return backup;
}
export async function verifyBackup(raw) {
  const data = validateJson(raw);
  if (data.format !== 'missionforge-local-backup' || data.schemaVersion !== 1 || !data.payload || typeof data.sha256 !== 'string') throw Error('Unsupported backup format or schema');
  if (typeof data.payload.build !== 'string' || data.payload.build.length > 160 || typeof data.payload.createdAt !== 'string' || data.payload.createdAt.length > 64 || !Number.isFinite(Date.parse(data.payload.createdAt))) throw Error('Invalid backup metadata');
  validateEntries(data.payload.entries);
  if ((await digest(data.payload)) !== data.sha256) throw Error('Backup checksum mismatch; active data was not changed');
  return data.payload;
}
