import { useEffect, useState } from 'react';
import { localData, storageStatus } from '../../persistence/localData';
import { useGame } from '../../game/GameContext';
export function StorageHealth() {
  const g = useGame(),
    [status, setStatus] = useState(storageStatus);
  useEffect(() => {
    const update = () => setStatus(storageStatus());
    window.addEventListener('mf:storage-status', update);
    const leave = e => {
      if (storageStatus().pending) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', leave);
    return () => {
      window.removeEventListener('mf:storage-status', update);
      window.removeEventListener('beforeunload', leave);
    };
  }, []);
  if (!status.error) return null;
  return <aside role="alert" className="fixed bottom-2 left-2 right-2 z-50 rounded-lg bg-amber-950 text-amber-100 p-3 shadow-lg"><span>{status.error}</span> <button className="ui-button" onClick={() => {
      localData.flush().catch(() => {});
      g.go('storage');
    }}>Open data & recovery</button></aside>;
}
