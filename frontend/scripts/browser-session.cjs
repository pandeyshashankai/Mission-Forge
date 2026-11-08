const fs = require("node:fs");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function browserSession() {
  const tabs = await (await fetch("http://127.0.0.1:9222/json")).json();
  const ws = new WebSocket(
    tabs.find((t) => t.type === "page").webSocketDebuggerUrl,
  );
  await new Promise((resolve) => (ws.onopen = resolve));
  let id = 0;
  const pending = new Map(),
    errors = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id) {
      pending.get(m.id)?.(m);
      pending.delete(m.id);
    }
    if (m.method === "Runtime.exceptionThrown")
      errors.push(m.params.exceptionDetails);
  };
  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id,
        timer = setTimeout(() => {
          pending.delete(n);
          reject(Error(`Timed out: ${method}`));
        }, 30000);
      pending.set(n, (m) => {
        clearTimeout(timer);
        m.error
          ? reject(Error(method + ": " + JSON.stringify(m.error)))
          : resolve(m.result);
      });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await call("Runtime.evaluate", {
      expression: expression.replace(
        /(?<![\w.$])localStorage(?=\s*\.)/g,
        "(window.missionForgeData||window.localStorage)",
      ),
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails)
      throw Error(
        r.exceptionDetails.exception?.description || r.exceptionDetails.text,
      );
    return r.result?.value;
  };
  const wait = async (expression, timeout = 25000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await evaluate(expression)) return;
      await pause(150);
    }
    throw Error("Not ready: " + expression);
  };
  const exists = (id) =>
    `Boolean(document.querySelector('[data-testid="${id}"]'))`;
  const revealInspector = async (selector) => {
    const hidden = await evaluate(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)}),p=e?.closest('.explore-inspector');return !!p && getComputedStyle(p).display==='none' && !!document.querySelector('[data-testid=explore-instruments-toggle]');})()`,
    );
    if (hidden) await clickSelector("[data-testid=explore-instruments-toggle]");
  };
  const revealCockpitMenu = async selector => {
    const hidden = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),root=e?.closest('.flight-screen,.explore-workspace,.builder-screen');return !!e && e.getBoundingClientRect().width===0 && !!root && !!root.querySelector('[data-testid=cockpit-menu],[data-testid=builder-tools-toggle]');})()`);
    if(hidden){
      const control=await evaluate(`document.querySelector(${JSON.stringify(selector)}).closest('.flight-screen,.explore-workspace,.builder-screen').classList.contains('builder-screen')?'builder-tools-toggle':'cockpit-menu'`);
      await clickSelector('[data-testid="'+control+'"]');
    }
  };
  const clickSelector = async (selector) => {
    await wait(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
    const closeTools = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e?.closest('.builder-screen');return r?.dataset.builderTools==='open'&&!e.closest('.builder-toolbar');})()`);
    if(closeTools)await clickSelector('[data-testid="builder-tools-toggle"]');
    const openDetails = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});return !!e?.closest('.assembly-details')&&!e.offsetWidth;})()`);
    if(openDetails)await clickSelector('[data-testid="builder-panel-details"]');

    // Follow the mobile drawer navigation before operating its controls.
    const closeDrawer = await evaluate(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)}),w=document.querySelector('.explore-workspace');return w?.dataset.panel==='open' && !e?.closest('.explore-inspector') && e?.dataset.testid!=='explore-instruments-toggle' && document.querySelector('[data-testid=explore-instruments-toggle]')?.offsetWidth>0;})()`,
    );
    if (closeDrawer)
      await clickSelector("[data-testid=explore-instruments-toggle]");
    await revealCockpitMenu(selector);
    await revealInspector(selector);
    await evaluate(
      `document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',inline:'center',behavior:'instant'})`,
    );
    await pause(100);
    const p = await evaluate(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();const x=Math.max(1,Math.min(innerWidth-1,r.x+r.width/2)),y=Math.max(1,Math.min(innerHeight-1,r.y+r.height/2));const top=document.elementFromPoint(x,y);return {x,y,disabled:!!e.disabled,visible:r.width>0&&r.height>0,hit:e===top||e.contains(top),top:top?.outerHTML.slice(0,150)};})()`,
    );
    if (p.disabled || !p.visible || !p.hit)
      throw Error(`Cannot click ${selector}: ${JSON.stringify(p)}`);
    await call("Input.dispatchMouseEvent", {
      type: "mousePressed",
      button: "left",
      clickCount: 1,
      x: p.x,
      y: p.y,
    });
    await call("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      button: "left",
      clickCount: 1,
      x: p.x,
      y: p.y,
    });
    await pause(200);
  };
  const click = (id) => clickSelector(`[data-testid="${id}"]`);
  const select = async (id, value) => {
    await wait(exists(id));
    await revealCockpitMenu(`[data-testid="${id}"]`);
    await revealInspector(`[data-testid="${id}"]`);
    await evaluate(
      `(()=>{const e=document.querySelector('[data-testid="${id}"]');if(!e||!e.offsetWidth)throw Error('Hidden select');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
    );
    await pause(150);
  };
  const key = async (key, modifiers = 0) => {
    await call("Input.dispatchKeyEvent", { type: "keyDown", key, modifiers });
    await call("Input.dispatchKeyEvent", { type: "keyUp", key, modifiers: 0 });
    await pause(150);
  };
  const upload = async (selector, files) => {
    const doc = await call("DOM.getDocument");
    const node = await call("DOM.querySelector", {
      nodeId: doc.root.nodeId,
      selector,
    });
    if (!node.nodeId) throw Error("Missing file input " + selector);
    await call("DOM.setFileInputFiles", { nodeId: node.nodeId, files });
    await pause(300);
  };
  const viewport = async (width, height = 900, scale = 1) => {
    await call("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: scale,
      mobile: false,
    });
    await pause(300);
  };
  const screenshot = async (name) => {
    const r = await call("Page.captureScreenshot", { format: "png" });
    fs.mkdirSync("/tmp/mission-forge-ui-screens", { recursive: true });
    fs.writeFileSync(
      `/tmp/mission-forge-ui-screens/${name}.png`,
      Buffer.from(r.data, "base64"),
    );
  };
  const home = async () => {
    await evaluate("window.missionForgeData?.flush().catch(()=>{})");
    await call("Page.navigate", { url: "http://127.0.0.1:8080/" });
    await wait(exists("main-title"));
  };
  await call("Runtime.enable");
  await call("Page.enable");
  return {
    call,
    evaluate,
    wait,
    exists,
    click,
    clickSelector,
    select,
    key,
    upload,
    viewport,
    screenshot,
    home,
    errors,
    pause,
    close: () => ws.close(),
  };
}
module.exports = { browserSession };
