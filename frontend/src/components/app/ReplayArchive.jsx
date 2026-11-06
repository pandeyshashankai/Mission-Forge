import { useEffect, useState } from 'react';
import { replayArchive } from '../../persistence/replayArchive';
export function ReplayArchive() {
  const [files, setFiles] = useState([]),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [prefer, setPrefer] = useState(true),
    [deleting, setDeleting] = useState(null);
  const refresh = () => replayArchive.list().then(setFiles);
  useEffect(() => {
    refresh().catch(e => setMessage(e.message));
  }, []);
  const run = async fn => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  };
  return <section className="ui-panel p-4 space-y-3" data-testid="replay-archive"><h2 className="text-xl">Replay file archive</h2><p>Keep up to 12 replay files, 50 MiB each and 200 MiB total. OPFS stores file bytes outside progress records; IndexedDB is the fallback. These files are separate from the progress backup above. Download them individually before clearing browser storage.</p><p>Archiving verifies the file header and SHA-256. Playback compatibility and physics verification still run in the replay tools.</p><label><input type="checkbox" data-testid="archive-opfs" checked={prefer} onChange={e => setPrefer(e.target.checked)} /> Prefer OPFS when available</label><label className="ui-button inline-block">Archive exported replay<input className="sr-only" type="file" data-testid="archive-upload" accept=".json,application/json" disabled={busy} onChange={e => {
        const file = e.target.files[0];
        e.target.value = '';
        if (file) run(async () => {
          const row = await replayArchive.add(file, {
            preferOPFS: prefer
          });
          setMessage('Archived and verified: ' + row.name + ' · ' + row.backend);
        });
      }} /></label><p role="status" data-testid="archive-status">{busy ? 'Processing replay locally…' : message}</p>{files.map(file => <article key={file.id} className="border-b py-3 space-y-2"><strong>{file.name}</strong><p>{(file.size / 1048576).toFixed(2)} MiB · {file.backend} · {file.orphan ? 'Recovered file needs an index' : 'SHA-256 indexed'}</p>{file.orphan ? <button className="ui-button" disabled={busy} onClick={() => run(async () => {
        await replayArchive.recover(file);
        setMessage('File index recovered');
      })}>Recover index</button> : <button className="ui-button" data-testid="archive-download" disabled={busy} onClick={() => run(async () => {
        const {
            blob
          } = await replayArchive.read(file.id),
          url = URL.createObjectURL(blob),
          a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage('Verified and downloaded ' + file.name);
      })}>Verify and download</button>}<button className="ui-button" data-testid="archive-delete" disabled={busy} onClick={() => deleting === file.id ? run(async () => {
        await replayArchive.remove(file);
        setDeleting(null);
        setMessage('Replay removed');
      }) : setDeleting(file.id)}>{deleting === file.id ? 'Confirm deletion' : 'Delete file'}</button>{deleting === file.id && <button className="ui-button" onClick={() => setDeleting(null)}>Keep file</button>}</article>)}{!files.length && <p>No archived replay files.</p>}</section>;
}
