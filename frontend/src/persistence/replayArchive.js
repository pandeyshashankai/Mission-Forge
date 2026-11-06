import {storageStatus} from "./localData";
import { REPLAY_FILE_LIMIT } from './replayFile';
let dbPromise = null,
  queue = Promise.resolve();
const database = () => dbPromise ??= new Promise((resolve, reject) => {
  const request = indexedDB.open('missionforge-files', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('files', {
    keyPath: 'id'
  });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
async function transaction(mode, fn) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', mode),
      store = tx.objectStore('files');
    let value;
    tx.oncomplete = () => resolve(value);
    tx.onabort = () => reject(tx.error || Error('Archive transaction aborted'));
    tx.onerror = () => {};
    try {
      const r = fn(store);
      if (r) r.onsuccess = () => value = r.result;
    } catch (e) {
      tx.abort();
      reject(e);
    }
  });
}
const records = () => transaction('readonly', store => store.getAll());
async function directory() {
  if (!navigator.storage?.getDirectory) return null;
  try {
    return await (await navigator.storage.getDirectory()).getDirectoryHandle('missionforge-replays', {
      create: true
    });
  } catch {
    return null;
  }
}
function serialized(fn) {
  const task = queue.then(()=>{
    if(storageStatus().mode==='blocked')throw Error('This tab cannot change local files. Close the other writer tab and reload.');
    return navigator.locks?.request?navigator.locks.request('missionforge-replay-files',fn):fn();
  });
  queue = task.catch(() => {});
  return task;
}
function inspect(blob) {
  return new Promise(async (resolve, reject) => {
    let worker, timer;
    try {
      if (blob.size > REPLAY_FILE_LIMIT) throw Error('Replay exceeds 50 MiB');
      if (typeof Worker === 'undefined') throw Error('Replay file inspection requires worker support in this browser.');
      worker = new Worker(new URL('./replayFile.worker.js', import.meta.url));
      timer = setTimeout(() => {
        worker.terminate();
        reject(Error('Replay inspection timed out'));
      }, 30000);
      worker.onmessage = e => {
        clearTimeout(timer);
        worker.terminate();
        e.data.error ? reject(Error(e.data.error)) : resolve(e.data);
      };
      worker.onerror = e => {
        clearTimeout(timer);
        worker.terminate();
        reject(Error(e.message || 'Replay inspector failed'));
      };
      const bytes = await blob.arrayBuffer();
      worker.postMessage(bytes, [bytes]);
    } catch (e) {
      clearTimeout(timer);
      worker?.terminate();
      reject(e);
    }
  });
}
async function contents(record) {
  if (record.backend === 'opfs') {
    const dir = await directory();
    if (!dir) throw Error('OPFS is unavailable. Reopen this browser profile to recover its files.');
    return (await dir.getFileHandle(record.id)).getFile();
  }
  if (record.blob instanceof Blob) return record.blob;
  throw Error('Archive file is missing');
}
async function inventory() {
  const rows = await records(),
    dir = await directory();
  if (dir) {
    const known = new Set(rows.map(r => r.id));
    for await (const [id, handle] of dir.entries()) if (handle.kind === 'file' && /^replay-[a-z0-9-]+\.json$/.test(id) && !known.has(id)) {
      const f = await handle.getFile();
      rows.push({
        id,
        name: id,
        size: f.size,
        at: new Date(f.lastModified).toISOString(),
        backend: 'opfs',
        orphan: true
      });
    }
  }
  return rows;
}
export const replayArchive = {
  async list() {
    await queue;
    return (await inventory()).map(({
      blob,
      ...row
    }) => row).sort((a, b) => b.at.localeCompare(a.at));
  },
  add(file, {
    preferOPFS = true
  } = {}) {
    return serialized(async () => {
      const checked = await inspect(file),
        rows = await inventory(),
        existing = rows.find(r => r.hash === checked.hash);
      if (existing) return existing;
      if (rows.length >= 12 || rows.reduce((n, r) => n + r.size, 0) + file.size > 200 * 1024 * 1024) throw Error('Archive budget exceeded: at most 12 files and 200 MiB. Export or remove files first.');
      const id = 'replay-' + crypto.randomUUID() + '.json',
        dir = preferOPFS ? await directory() : null,
        record = {
          id,
          name: String(file.name || 'replay.json').slice(0, 120),
          size: file.size,
          at: new Date().toISOString(),
          hash: checked.hash,
          header: checked.header,
          backend: dir ? 'opfs' : 'indexeddb'
        };
      try {
        if (dir) {
          const handle = await dir.getFileHandle(id, {
              create: true
            }),
            writer = await handle.createWritable();
          try {
            await writer.write(file);
            await writer.close();
          } catch (e) {
            await writer.abort().catch(() => {});
            throw e;
          }
        } else record.blob = file;
        await transaction('readwrite', store => store.put(record));
        return record;
      } catch (e) {
        if (dir) await dir.removeEntry(id).catch(() => {});
        throw e;
      }
    });
  },
  async read(id) {
    await queue;
    const rows = await records(),
      record = rows.find(r => r.id === id);
    if (!record) throw Error('File index is unavailable; recover its index first.');
    const blob = await contents(record),
      checked = await inspect(blob);
    if (checked.hash !== record.hash) throw Error('Replay checksum mismatch. Stored file was not changed.');
    return {
      record,
      blob
    };
  },
  recover(record) {
    return serialized(async () => {
      if (!record.orphan) throw Error('Only unindexed files require recovery');
      const blob = await contents(record),
        checked = await inspect(blob);
      const row = {
        ...record,
        orphan: false,
        hash: checked.hash,
        header: checked.header
      };
      await transaction('readwrite', store => store.put(row));
      return row;
    });
  },
  remove(record) {
    return serialized(async () => {
      if (record.backend === 'opfs') {
        const dir = await directory();
        if (!dir) throw Error('OPFS is unavailable');
        try {
          await dir.removeEntry(record.id);
        } catch (e) {
          if (e.name !== "NotFoundError") throw e;
        }
      }
      await transaction('readwrite', store => store.delete(record.id));
    });
  }
};
