import { useEffect, useState } from 'react';
import { useGame } from '../../game/GameContext';
import { CONTROL_ACTIONS } from '../../input/bindings';
import { normalizeGamepad, rebindGamepad } from '../../input/gamepad';
export function GamepadSettings() {
  const g = useGame(),
    [connected, setConnected] = useState('Press and release a controller button to expose it to the browser.'),
    [wake, setWake] = useState('Wake lock is requested only during flight or exploration.'),
    c = normalizeGamepad(g.settings.gamepad);
  const change = patch => g.setSettings({
    ...g.settings,
    ...patch
  });
  useEffect(() => {
    const read = () => {
      try {
        const pads = Array.from(navigator.getGamepads?.() || []).filter(Boolean);
        setConnected(pads.length ? pads.map(p => p.id).join(' · ') : 'No active controller. Press and release a button after connecting.');
      } catch {
        setConnected('Controller access is unavailable.');
      }
    };
    const status = e => setWake(e.detail);
    read();
    const timer = setInterval(read, 1000);
    window.addEventListener('mf:wake-status', status);
    return () => {
      clearInterval(timer);
      window.removeEventListener('mf:wake-status', status);
    };
  }, []);
  return <section className="space-y-3" data-testid="gamepad-settings"><h3>Controller and device comfort</h3><label className="control-setting-row"><span>Enable gamepad<small>{connected}</small></span><input type="checkbox" data-testid="gamepad-enable" checked={g.settings.gamepadEnabled} onChange={e => change({
        gamepadEnabled: e.target.checked
      })} /></label><p>Standard-layout defaults use the left stick for steering, right stick for throttle, A/B for full/cut, X for stage and Y for RCS. Release all controls once to arm. Stick axes issue digital hold commands.</p><label className="control-setting-row"><span>Stick deadzone</span><input aria-label="Stick deadzone" type="range" min="0.1" max="0.6" step="0.05" value={c.deadzone} onChange={e => change({
        gamepad: {
          ...c,
          deadzone: Number(e.target.value)
        }
      })} /><span>{c.deadzone.toFixed(2)}</span></label>{['pitchAxis', 'yawAxis', 'throttleAxis'].map(axis => <label className="control-setting-row" key={axis}><span>{axis.replace('Axis', ' axis')}</span><select value={c[axis]} onChange={e => change({
        gamepad: {
          ...c,
          [axis]: Number(e.target.value)
        }
      })}>{(axis === 'throttleAxis' ? [-1, 0, 1, 2, 3, 4, 5, 6, 7] : [0, 1, 2, 3, 4, 5, 6, 7]).map(i => <option key={i} value={i}>{i < 0 ? 'Disabled' : 'Axis ' + i}</option>)}</select></label>)}<label className="control-setting-row"><span>Invert pitch axis</span><input type="checkbox" checked={c.invertPitch} onChange={e => change({
        gamepad: {
          ...c,
          invertPitch: e.target.checked
        }
      })} /></label><details><summary>Remap controller buttons</summary>{CONTROL_ACTIONS.map(action => <label className="control-setting-row" key={action.id}><span>{action.label}</span><select aria-label={'Controller ' + action.label} data-testid={'pad-binding-' + action.id} value={c.buttons[action.id]} onChange={e => change({
          gamepad: rebindGamepad(c, action.id, Number(e.target.value))
        })}>{Array.from({
            length: 33
          }, (_, i) => i - 1).map(i => <option key={i} value={i}>{i < 0 ? 'Unassigned' : 'Button ' + i}</option>)}</select></label>)}</details><label className="control-setting-row"><span>Keep the screen awake during flight<small>{wake}</small></span><input type="checkbox" data-testid="wake-enable" checked={g.settings.keepAwake} onChange={e => change({
        keepAwake: e.target.checked
      })} /></label><label className="control-setting-row"><span>Haptic button feedback<small>{navigator.vibrate ? 'Short optional pulses on supported devices.' : 'Vibration unavailable; controls work normally.'}</small></span><input type="checkbox" data-testid="haptics-enable" checked={g.settings.haptics} onChange={e => change({
        haptics: e.target.checked
      })} /></label></section>;
}
