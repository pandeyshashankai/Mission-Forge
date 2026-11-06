import {ReplayArchive} from "../components/app/ReplayArchive";
import { useEffect, useState } from 'react';
import { useGame } from '../game/GameContext';
import { localData, storageStatus } from '../persistence/localData';
import { makeBackup, verifyBackup } from '../persistence/backup';
import { validateArchive } from '../persistence/domain';
export default function LocalStorage() {
  const g = useGame(),
    [status, setStatus] = useState(storageStatus),
    [history, setHistory] = useState([]),
    [quota, setQuota] = useState(null),
    [preview, setPreview] = useState(null),
    [message, setMessage] = useState(''),
    [confirmation, setConfirmation] = useState('');
  const refresh = () => {
    setStatus(storageStatus());
    localData.recoveries().then(setHistory).catch(e => setMessage(e.message));
    navigator.storage?.estimate?.().then(setQuota).catch(() => {});
  };
  useEffect(() => {
    refresh();
    const update = () => setStatus(storageStatus());
    window.addEventListener('mf:storage-status', update);
    return () => window.removeEventListener('mf:storage-status', update);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async task => {
    try {
      await task();
    } catch (e) {
      setMessage(e.message);
    }
  };
  const exportBackup = () => run(async () => {
    await localData.flush().catch(() => {});
    let build = 'unidentified';
    try {
      const response = await fetch('/build-info.json');
      if (response.ok) build = (await response.json()).id;
    } catch {}
    const backup = await makeBackup(localData.entries(), build);
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json'
      })),
      a = document.createElement('a');
    a.href = url;
    a.download = 'missionforge-backup.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Backup exported. SHA-256 detects accidental modification; it does not authenticate the author.');
  });
  const inspect = e => {
    const file = e.target.files[0];
    e.target.value = '';
    setPreview(null);
    if (!file) return;
    run(async () => {
      if (file.size > 20 * 1024 * 1024) throw Error('Backup exceeds 20 MiB');
      const payload = await verifyBackup(await file.text());
      validateArchive([...new Map([...localData.entries(), ...payload.entries]).entries()]);
      setPreview(payload);
      setMessage('Checksum and supported content checks passed. Review the merge before applying.');
    });
  };
  return <main className="local-tools h-full overflow-y-auto p-4 md:p-8" data-testid="storage-screen"><div className="max-w-4xl mx-auto space-y-4"><button className="ui-button" onClick={() => g.go('menu')}>← Home</button><h1 className="text-3xl font-bold">Local data & recovery</h1><p>Progress stays on this device. Export a backup before clearing browser data or changing devices.</p><section className="ui-panel p-4 space-y-3"><h2 className="text-xl font-semibold">Storage health</h2><p data-testid="storage-status">{status.mode} · {status.pending} pending writes · {localData.entries().length} records</p><p role="status">{status.error || message || 'Ready'}</p>{quota && <p>Origin storage: {(quota.usage / 1048576).toFixed(1)} MiB used of {(quota.quota / 1048576).toFixed(0)} MiB estimated. This includes offline assets.</p>}<button className="ui-button" data-testid="storage-export" onClick={exportBackup}>Export verified backup</button>{navigator.storage?.persist && <button className="ui-button" onClick={() => run(async () => setMessage((await navigator.storage.persist()) ? 'Persistent storage granted. Keep external backups too.' : 'Browser declined persistent storage; exported backups remain available.'))}>Request persistent storage</button>}<label className="ui-button inline-block cursor-pointer">Inspect backup<input className="sr-only" data-testid="storage-import" type="file" accept="application/json,.json" onChange={inspect} /></label></section>
 {preview && <section className="ui-panel p-4 space-y-2" data-testid="backup-preview"><h2 className="text-xl">Verified backup preview</h2><p>{preview.entries.length} records · {preview.createdAt} · build {preview.build}</p><p>Matching records will be replaced; other records will remain. Reload applies restored content.</p><ul>{preview.entries.map(([key, value]) => <li key={key}>{key} — {new Blob([value]).size.toLocaleString()} bytes</li>)}</ul><button className="ui-button" data-testid="backup-apply" onClick={() => run(async () => {
          validateArchive([...new Map([...localData.entries(), ...preview.entries]).entries()]);
          await localData.importEntries(preview.entries);
          await localData.flush();
          window.location.reload();
        })}>Merge verified backup and reload</button></section>}
 <section className="ui-panel p-4 space-y-3"><h2 className="text-xl font-semibold">Previous committed snapshots</h2><p>Up to six recent versions per recovery category. Restore replaces that category and reloads the app.</p>{history.length === 0 ? <p>No recovery snapshots yet.</p> : history.map(row => <div key={row.id} className="flex flex-wrap justify-between gap-2 border-b py-2"><span>{row.key} · {new Date(row.at).toLocaleString()}</span><button className="ui-button" onClick={() => run(async () => {
            validateArchive([[row.key, row.value]]);
            await localData.importEntries([[row.key, row.value]]);
            window.location.reload();
          })}>Restore this snapshot</button></div>)}</section>
 <ReplayArchive/>
 <section className="ui-panel p-4 space-y-2"><h2 className="text-xl">Clear local progress</h2><p>Deletes saves, custom content, recovery history and preferences. Offline assets and replay archive files remain. Export first. Type DELETE to enable.</p><input className="ui-input" aria-label="Confirm deletion" value={confirmation} onChange={e => setConfirmation(e.target.value)} /><button className="ui-button" disabled={confirmation !== 'DELETE'} onClick={() => run(async () => {
          localData.clear();
          await localData.flush();
          window.location.reload();
        })}>Delete local progress</button></section></div></main>;
}
