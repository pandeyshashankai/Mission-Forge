/* global globalThis */
import { validateEntries } from './backup';
// Synchronous session cache, asynchronously committed to IndexedDB.
// Small preferences remain in native localStorage. No network persistence.
const PREFIX = 'mf.',
  PREFERENCES = new Set(['mf.settings']);
const cache = new Map(),
  failedWrites = new Map();
let database = null,
  boot = null,
  queue = Promise.resolve(),
  mode = 'native',
  failure = null,
  fallbackWarning = null,
  writeFailure = null,
  pending = 0,
  sequence = 0;
const native = () => {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
};
const signal = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('mf:storage-status', {
    detail: storageStatus()
  }));
};
export function storageStatus() {
  return {
    mode,
    pending,
    error: failure,
    lastCommitted: localData.lastCommitted || null
  };
}
function transaction(store, access, action) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, access);
    let value;
    tx.oncomplete = () => resolve(value);
    tx.onabort = () => reject(tx.error || Error('Storage transaction aborted'));
    tx.onerror = () => {};
    try {
      action(tx, v => {
        value = v;
      });
    } catch (e) {
      tx.abort();
      reject(e);
    }
  });
}
async function initialize() {
  let ownsLock = true;
  if (globalThis.navigator?.locks) {
    ownsLock = await new Promise(resolve => {
      navigator.locks.request('missionforge-writer', {
        ifAvailable: true
      }, lock => {
        resolve(!!lock);
        return lock ? new Promise(() => {}) : undefined;
      }).catch(() => resolve(false));
    });
  }
  if (!globalThis.indexedDB) {
    failure = fallbackWarning = 'IndexedDB unavailable; using legacy local storage. Export a backup.';
    signal();
    return storageStatus();
  }
  try {
    database = await new Promise((resolve, reject) => {
      let expired = false;
      const timer = setTimeout(() => {
          expired = true;
          reject(Error('Local database did not open in time'));
        }, 5000),
        request = indexedDB.open('missionforge', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('entries', {
          keyPath: 'key'
        });
        const history = db.createObjectStore('recovery', {
          keyPath: 'id'
        });
        history.createIndex('key', 'key');
      };
      request.onsuccess = () => {
        clearTimeout(timer);
        if (expired) {
          request.result.close();
          return;
        }
        resolve(request.result);
      };
      request.onerror = () => {
        clearTimeout(timer);
        reject(request.error);
      };
      request.onblocked = () => {
        clearTimeout(timer);
        reject(Error('Close older MissionForge tabs to upgrade local storage'));
      };
    });
    database.onversionchange = () => {
      database.close();
      database = null;
      mode = 'blocked';
      failure = 'Local database changed in another tab. Reload before saving.';
      signal();
    };
    const rows = await transaction('entries', 'readonly', (tx, set) => {
      const request = tx.objectStore('entries').getAll();
      request.onsuccess = () => set(request.result);
    });
    for (const row of rows) if (typeof row.key === 'string' && typeof row.value === 'string') cache.set(row.key, row.value);
    if (rows.some(row => row.schemaVersion !== undefined && row.schemaVersion !== 1)) {
      mode = 'blocked';
      failure = 'Local saves use an unsupported record schema. Open the matching app version or export a backup; writes are blocked.';
      signal();
      return storageStatus();
    }
    const legacy = [];
    const store = native();
    for (let i = 0; i < (store?.length || 0); i++) {
      const key = store.key(i);
      if (key.startsWith(PREFIX) && !PREFERENCES.has(key) && !cache.has(key)) {
        const value = store.getItem(key);
        legacy.push({
          key,
          value,
          at: Date.now(),
          schemaVersion: 1
        });
        cache.set(key, value);
      }
    }
    if (legacy.length && ownsLock) await transaction('entries', 'readwrite', tx => {
      for (const entry of legacy) tx.objectStore('entries').put(entry);
    });
    // Only retire legacy data after its successful database commit.
    const retired = [];
    for (let i = 0; i < (store?.length || 0); i++) {
      const key = store.key(i);
      if (key.startsWith(PREFIX) && !PREFERENCES.has(key) && cache.has(key)) retired.push(key);
    }
    for (const key of ownsLock ? retired : []) {
      try {
        store.removeItem(key);
      } catch {/* The committed primary copy remains intact. */}
    }
    mode = ownsLock ? 'indexeddb' : 'blocked';
    failure = ownsLock ? null : 'Another MissionForge tab owns local saves. Close it and reload this tab before editing.';
  } catch (e) {
    database?.close();
    database = null;
    cache.clear();
    mode = 'native';
    failure = fallbackWarning = `Recovery database unavailable: ${e.message}. Database records were not removed; any legacy saves remain available. Export a backup.`;
  }
  signal();
  return storageStatus();
}
function updateFailures() {
  writeFailure = [...failedWrites.values()].at(-1) || null;
  if (mode !== 'blocked') failure = writeFailure || fallbackWarning;
  signal();
}
function enqueue(action, key) {
  pending++;
  signal();
  queue = queue.then(() => {
    if (mode === 'blocked') throw Error(failure);
    return action();
  }).then(() => {
    localData.lastCommitted = new Date().toISOString();
    if (key === '*') failedWrites.clear();else failedWrites.delete(key);
  }, e => {
    failedWrites.set(key, `Save failed: ${e.message}. Previous committed saves remain available. Export a backup before leaving.`);
  }).finally(() => {
    pending--;
    updateFailures();
  });
}
const recoveryKeys = new Set(['mf.autosave', 'mf.checkpoints', 'mf.fleet-world', 'mf.recovery-flight']);
export const localData = {
  lastCommitted: null,
  ready() {
    return boot ??= initialize();
  },
  getItem(key) {
    if (key.startsWith(PREFIX) && cache.has(key)) return cache.get(key);
    if ((mode === 'indexeddb' || mode === 'blocked') && key.startsWith(PREFIX) && !PREFERENCES.has(key)) return null;
    return native()?.getItem(key) ?? null;
  },
  setItem(key, value) {
    if (mode === 'blocked') throw Error(failure);
    if (typeof value !== 'string') value = String(value);
    if (mode !== 'indexeddb' || !key.startsWith(PREFIX) || PREFERENCES.has(key)) {
      try {
        if (!native()) throw Error('Local storage unavailable');
        native().setItem(key, value);
        cache.delete(key);
        failedWrites.delete(key);
        updateFailures();
      } catch (e) {
        if (key.startsWith(PREFIX)) cache.set(key, value);
        failedWrites.set(key, `Save failed: ${e.message}. Export a backup before leaving.`);
        updateFailures();
        throw e;
      }
      return;
    }
    cache.set(key, value);
    const at = Date.now(),
      order = ++sequence,
      id = at + '-' + order + '-' + Math.random().toString(36).slice(2);
    enqueue(async () => {
      await transaction(['entries', 'recovery'], 'readwrite', tx => {
        tx.objectStore('entries').put({
          key,
          value,
          at,
          schemaVersion: 1
        });
        if (recoveryKeys.has(key)) tx.objectStore('recovery').put({
          id,
          order,
          key,
          value,
          at
        });
      });
      if (recoveryKeys.has(key)) {
        const rows = await transaction('recovery', 'readonly', (tx, set) => {
          const r = tx.objectStore('recovery').index('key').getAll(key);
          r.onsuccess = () => set(r.result);
        });
        if (rows.length > 6) await transaction('recovery', 'readwrite', tx => {
          for (const row of rows.sort((a, b) => b.at - a.at || (b.order || 0) - (a.order || 0)).slice(6)) tx.objectStore('recovery').delete(row.id);
        });
      }
    }, key);
  },
  removeItem(key) {
    if (mode === 'blocked') throw Error(failure);
    if (mode !== 'indexeddb' || !key.startsWith(PREFIX) || PREFERENCES.has(key)) {
      native()?.removeItem(key);
      cache.delete(key);
      failedWrites.delete(key);
      updateFailures();
      return;
    }
    cache.delete(key);
    enqueue(() => transaction('entries', 'readwrite', tx => tx.objectStore('entries').delete(key)), key);
  },
  clear() {
    if (mode === 'blocked') throw Error(failure);
    if (mode !== 'indexeddb') {
      const s = native();
      for (const [key] of this.entries()) s?.removeItem(key);
      cache.clear();
      failedWrites.clear();
      updateFailures();
      return;
    }
    cache.clear();
    native()?.removeItem('mf.settings');
    enqueue(() => transaction(['entries', 'recovery'], 'readwrite', tx => {
      tx.objectStore('entries').clear();
      tx.objectStore('recovery').clear();
    }), '*');
  },
  async flush() {
    await queue;
    if (writeFailure) throw Error(writeFailure);
  },
  entries() {
    const all = new Map();
    const store = native();
    if (mode !== 'indexeddb' && mode !== 'blocked') {
      for (let i = 0; i < (store?.length || 0); i++) {
        const key = store.key(i);
        if (key.startsWith(PREFIX)) all.set(key, store.getItem(key));
      }
    } else {
      const settings = store?.getItem('mf.settings');
      if (settings != null) all.set('mf.settings', settings);
    }
    // Failed native writes are exportable too, including unsaved preferences.
    for (const [key, value] of cache) all.set(key, value);
    return [...all.entries()];
  },
  async recoveries() {
    await localData.ready();
    await queue;
    if (mode !== 'indexeddb') return [];
    return transaction('recovery', 'readonly', (tx, set) => {
      const request = tx.objectStore('recovery').getAll();
      request.onsuccess = () => set(request.result.sort((a, b) => b.at - a.at || (b.order || 0) - (a.order || 0)));
    });
  },
  async importEntries(entries) {
    validateEntries(entries);
    await localData.ready();
    await queue;
    if (mode !== 'indexeddb') throw Error('Transactional backup restore requires IndexedDB');
    const settings = entries.find(([key]) => PREFERENCES.has(key));
    if (settings) {
      const probe = 'mf.restore-probe';
      native()?.setItem(probe, settings[1]);
      native()?.removeItem(probe);
    }
    const root = entries.filter(([key]) => !PREFERENCES.has(key));
    await transaction('entries', 'readwrite', tx => {
      for (const [key, value] of root) tx.objectStore('entries').put({
        key,
        value,
        at: Date.now(),
        schemaVersion: 1
      });
    });
    for (const [key, value] of root) {
      cache.set(key, value);
      failedWrites.delete(key);
    }
    updateFailures();
    for (const [key, value] of entries) if (PREFERENCES.has(key)) localData.setItem(key, value);
    signal();
  }
};
if (typeof window !== 'undefined') window.missionForgeData = localData;
