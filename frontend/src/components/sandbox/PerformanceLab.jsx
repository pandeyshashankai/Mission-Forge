import { accelerationX, circularTrace, benchmarkKernel } from "../../features/performance/kernel";
import { useEffect, useRef, useState } from 'react';
import { EARTH } from '../../sim/constants';
import { drawOrbit } from '../../features/performance/plot';
function OrbitPlot({
  trace
}) {
  const mount = useRef(null),
    [mode, setMode] = useState('');
  useEffect(() => {
    let worker;
    const host = mount.current;
    const make = () => {
      const c = document.createElement('canvas');
      c.width = 640;
      c.height = 320;
      c.style.width = '100%';
      c.setAttribute('aria-label', 'One circular central-gravity orbit');
      host.replaceChildren(c);
      return c;
    };
    const fallback = () => {
      drawOrbit(make(), trace);
      setMode('Main-thread canvas fallback');
    };
    const canvas = make();
    try {
      if (!canvas.transferControlToOffscreen || typeof Worker === 'undefined') {
        fallback();
      } else {
        worker = new Worker(new URL('../../features/performance/plot.worker.js', import.meta.url));
        worker.onmessage = e => {
          if (e.data.error) fallback();else setMode('OffscreenCanvas worker');
        };
        worker.onerror = fallback;
        const offscreen = canvas.transferControlToOffscreen();
        worker.postMessage({
          canvas: offscreen,
          trace
        }, [offscreen]);
      }
    } catch {
      fallback();
    }
    return () => {
      worker?.terminate();
      host.replaceChildren();
    };
  }, [trace]);
  return <div><div ref={mount} /><p data-testid="plot-backend">{mode}</p></div>;
}
export function PerformanceLab() {
  const [result, setResult] = useState(null),
    [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false),
    worker = useRef(null),
    watchdog = useRef(null);
  useEffect(() => () => {
    worker.current?.terminate();
    clearTimeout(watchdog.current);
  }, []);
  const run = () => {
    if (typeof Worker === 'undefined') {
      setResult({
        benchmark: benchmarkKernel(accelerationX, null, EARTH.mu),
        orbit: circularTrace(accelerationX, EARTH.mu, EARTH.radius + 200000),
        kernelError: 0,
        wasmAvailable: false
      });
      setStatus('Worker unavailable: bounded JavaScript fallback.');
      return;
    }
    setBusy(true);
    setStatus('Computing in a worker…');
    worker.current?.terminate();
    clearTimeout(watchdog.current);
    const task = new Worker(new URL('../../features/performance/benchmark.worker.js', import.meta.url));
    worker.current = task;
    const timer = watchdog.current = setTimeout(() => {
      task.terminate();
      setBusy(false);
      setStatus('Benchmark timed out');
    }, 30000);
    task.onmessage = e => {
      clearTimeout(timer);
      task.terminate();
      setBusy(false);
      if (e.data.error) setStatus(e.data.error);else {
        setResult(e.data);
        setStatus('Measured on this browser session.');
      }
    };
    task.onerror = e => {
      clearTimeout(timer);
      task.terminate();
      setBusy(false);
      setStatus(e.message || 'Worker unavailable');
    };
    task.postMessage({
      mu: EARTH.mu,
      radius: EARTH.radius + 200000
    });
  };
  return <section className="ui-panel p-4 space-y-3" data-testid="performance-lab"><h2 className="text-xl">Compute and rendering workbench</h2><p>Compare JavaScript and WebAssembly for one central-gravity acceleration component, then plot a 200 km Earth orbit. NASA-derived μ is {EARTH.mu.toExponential(7)} m³/s². This bounded experiment keeps the established flight models unchanged.</p><button className="ui-button" data-testid="performance-run" disabled={busy} onClick={run}>{busy ? 'Measuring…' : 'Run local benchmark'}</button><p role="status">{status}</p>{result && <div data-testid="performance-result"><p>Median of {result.benchmark.trials} trials × {result.benchmark.iterations.toLocaleString()} calls: JS {result.benchmark.jsMs.toFixed(3)} ms · Wasm {result.benchmark.wasmMs === null ? 'unavailable' : result.benchmark.wasmMs.toFixed(3) + ' ms'}.</p><p>Workload choice: {result.benchmark.preferred}. A measured 15% advantage is required before this experiment selects Wasm.</p><p>Acceleration disagreement {result.kernelError.toExponential(2)} m/s² · orbit energy drift {result.orbit.maxEnergyDrift.toExponential(2)} · maximum radius error {result.orbit.maxRadiusError.toFixed(4)} m.</p><OrbitPlot trace={result.orbit.trace} /><p>Single-component timings do not predict whole-game performance. Full force integration, contacts, React and GPU rendering have different costs. The plot uses a render worker where supported and a canvas fallback otherwise.</p></div>}</section>;
}
