import { useEffect } from 'react';
import { useGame } from '../../game/GameContext';
export function DeviceSupport() {
  const g = useGame(),
    active = ['flight', 'explore'].includes(g.screen) && g.settings.keepAwake;
  useEffect(() => {
    let sentinel = null,
      cancelled = false,
      pending = false;
    const report = text => window.dispatchEvent(new CustomEvent('mf:wake-status', {
      detail: text
    }));
    const release = () => {
      sentinel?.release().catch(() => {});
      sentinel = null;
    };
    const acquire = async () => {
      if (cancelled || !active || document.hidden || sentinel || pending) return;
      if (!navigator.wakeLock?.request) {
        report('Wake lock unavailable in this browser');
        return;
      }
      pending = true;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled || document.hidden || !active) {
          await lock.release();
          return;
        }
        sentinel = lock;
        report('Keeping the display awake');
        lock.addEventListener('release', () => {
          if (sentinel === lock) sentinel = null;
          report('Wake lock released');
        }, {
          once: true
        });
      } catch (e) {
        report('Wake lock not granted: ' + e.name);
      } finally {
        pending = false;
      }
    };
    const visibility = () => document.hidden ? release() : acquire();
    if (active) acquire();else report('Wake lock off outside flight');
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', visibility);
      release();
    };
  }, [active]);
  return null;
}
