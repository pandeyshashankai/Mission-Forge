import { storageStatus } from '../../persistence/localData';
import { useEffect, useState } from 'react';
function ask(worker) {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel(),
      timer = setTimeout(() => reject(Error('Offline status timed out')), 5000);
    channel.port1.onmessage = e => {
      clearTimeout(timer);
      resolve(e.data);
    };
    worker.postMessage({
      type: 'STATUS'
    }, [channel.port2]);
  });
}
const describe = s => s.ready ? `Offline package ready: ${s.count} assets · build ${s.build.slice(0, 12)}. Saves remain local.` : 'Offline package incomplete. Prepare again while online.';
export function OfflinePlay() {
  const [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false),
    [updateAvailable,setUpdateAvailable] = useState(false);
  useEffect(() => {
    if (!navigator.serviceWorker) return;
    let stopped=false, registration, worker;
    const available=()=>{if(!stopped&&registration?.waiting){setUpdateAvailable(true);setStatus('A game update is ready. Update to load the latest builder; saved rockets stay on this device.');}};
    const watch=()=>{worker=registration.installing;worker?.addEventListener('statechange',available);};
    navigator.serviceWorker.getRegistration('/').then(async r=>{
      if(!r?.active||stopped)return;
      registration=r;
      const installed=await ask(r.active);
      if(stopped)return;
      setStatus(describe(installed));
      r.addEventListener('updatefound',watch);watch();available();
      await r.update().catch(()=>{});available();
    }).catch(()=>{});
    return()=>{stopped=true;registration?.removeEventListener('updatefound',watch);worker?.removeEventListener('statechange',available);};
  }, []);
  return <div className="offline-play"><button className="ui-button" data-testid="offline-prepare" disabled={busy} onClick={async () => {
      if (!navigator.serviceWorker || !window.isSecureContext) {
        setStatus('Offline installation requires HTTPS or localhost.');
        return;
      }
      if (storageStatus().mode === 'blocked') {
        setStatus('Close the other MissionForge tab and reload before updating offline assets.');
        return;
      }
      setBusy(true);
      setStatus('Caching and verifying game, models and source assets…');
      try {
        const previous = await navigator.serviceWorker.getRegistration('/');
        let previousBuild=null;
        if(previous?.active)try{previousBuild=(await ask(previous.active)).build;}catch{}
        const registration = await navigator.serviceWorker.register('/offline-worker.js', {
          updateViaCache: 'none'
        });
        await registration.update();
        const worker = registration.installing || registration.waiting;
        if (worker) await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(Error('Offline installation timed out. Try again online.')), 60000);
          const check = () => {
            if (worker.state === 'installed') {
              worker.postMessage({
                type: 'APPLY_UPDATE'
              });
            }
            if (worker.state === 'activated') {
              clearTimeout(timer);
              resolve();
            }
            if (worker.state === 'redundant') {
              clearTimeout(timer);
              reject(Error('Offline package verification failed. Previous package retained.'));
            }
          };
          worker.addEventListener('statechange', check);
          check();
        });
        const ready = await navigator.serviceWorker.ready;
        const installed = await ask(ready.active);
        setStatus(describe(installed));
        setUpdateAvailable(false);
        if (previousBuild && installed.ready && previousBuild !== installed.build) window.location.reload();
      } catch (e) {
        setStatus(e.message);
      } finally {
        setBusy(false);
      }
    }}> {busy ? 'Preparing offline…' : updateAvailable ? 'Update game' : 'Prepare offline play'}</button><span role="status" data-testid="offline-status">{status}</span></div>;
}
