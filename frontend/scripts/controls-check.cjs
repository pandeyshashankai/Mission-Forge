const assert = require("node:assert/strict");
const { browserSession } = require("./browser-session.cjs");
(async () => {
  const b = await browserSession();
  const { call, evaluate, click, wait, exists, pause } = b;
  const pressed = (action) =>
    `document.querySelector('[data-testid="touch-${action}"]')?.getAttribute('aria-pressed')==='true'`;
  const keyDown = (code, key) =>
    call("Input.dispatchKeyEvent", { type: "keyDown", code, key });
  const keyUp = (code, key) =>
    call("Input.dispatchKeyEvent", { type: "keyUp", code, key });
  const key = async (code, label) => {
    await keyDown(code, label);
    await keyUp(code, label);
    await pause(200);
  };
  const point = async (id) => {
    const p = await evaluate(
      `(()=>{const e=document.querySelector('[data-testid="${id}"]'),r=e.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return {x,y,w:r.width,h:r.height,ok:x>=0&&y>=0&&x<innerWidth&&y<innerHeight&&(e===hit||e.contains(hit)),top:hit?.outerHTML.slice(0,180)}})()`,
    );
    assert.ok(p.ok, `${id} is blocked/offscreen: ${JSON.stringify(p)}`);
    assert.ok(p.w >= 40 && p.h >= 40, `${id} target too small`);
    return { x: p.x, y: p.y, radiusX: 5, radiusY: 5, force: 1 };
  };
  const touch = (type, points) =>
    call("Input.dispatchTouchEvent", { type, touchPoints: points });
  const tap = async (id) => {
    const p = await point(id);
    await touch("touchStart", [{ ...p, id: 1 }]);
    await touch("touchEnd", []);
    await pause(250);
  };
  const throttle = () =>
    evaluate(
      'Number(document.querySelector("[data-testid=touch-flight-controls] .touch-control-label strong").textContent.replace(/[^0-9]/g,""))',
    );
  const settings = async () => {
    await click("display-settings-btn");
    await click("settings-tab-controls");
  };
  const bind = async (action, code, label) => {
    await click("binding-" + action);
    await key(code, label);
    await wait(
      `document.querySelector('[data-testid="binding-${action}"]').textContent===${JSON.stringify(label.toUpperCase())}`,
    );
  };
  const results = [];
  const passed = (s) => {
    results.push(s);
    console.log("PASS: " + s);
  };

  await b.viewport(390, 844);
  await b.home();
  await evaluate(
    'localStorage.clear();localStorage.setItem("mf.settings",JSON.stringify({graphics:"low",reduceMotion:true}))',
  );
  await b.home();
  await settings();
  await click("binding-pitchForward");
  await key("KeyD", "d");
  assert.equal(
    await evaluate(
      'document.querySelector("[data-testid=binding-yawRight]").textContent',
    ),
    "W",
  );
  await click("controls-default-wasd");
  await bind("pitchForward", "KeyI", "i");
  await bind("stage", "KeyN", "n");
  await bind("rcs", "KeyT", "t");
  await bind("pause", "KeyO", "o");
  await click("binding-map");
  await key("Escape", "Escape");
  assert.ok(await evaluate(exists("settings-dialog")));
  assert.equal(
    await evaluate(
      'document.querySelector("[data-testid=binding-map]").textContent',
    ),
    "M",
  );
  await b.screenshot("controls-bindings");
  await click("settings-done");
  await b.home();
  const saved = await evaluate(
    'JSON.parse(localStorage.getItem("mf.settings"))',
  );
  assert.equal(saved.bindings.pitchForward, "KeyI");
  assert.equal(saved.bindings.stage, "KeyN");
  passed(
    "remapping persists; duplicate keys swap; Escape cancels capture without closing Settings",
  );
  await click("menu-new-mission-btn");
  await click("mission-card-first_orbit");
  await click("planner-open-hangar-btn");
  await call("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  });
  await click("workspace-3d");
  const pinch = await evaluate(
    `(()=>{const c=document.querySelector('[data-testid="hangar-3d-viewport"] canvas'),r=c.getBoundingClientRect();return [{x:r.x+r.width*.35,y:r.y+r.height*.4,id:6,radiusX:5,radiusY:5,force:1},{x:r.x+r.width*.65,y:r.y+r.height*.4,id:7,radiusX:5,radiusY:5,force:1}]})()`,
  );
  await touch("touchStart", pinch);
  await pause(100);
  await touch(
    "touchMove",
    pinch.map((p, i) => ({ ...p, x: p.x + (i ? 20 : -20) })),
  );
  await touch("touchEnd", []);
  await pause(200);
  assert.equal(
    await evaluate(
      'document.querySelector(".builder-screen").dataset.builderPane',
    ),
    "build",
  );
  passed(
    "builder pinch/rotate gestures do not accidentally select a part or open its inspector",
  );
  await click("open-readiness-btn");
  await click("proceed-to-launch-btn");
  await click("start-countdown-btn");
  await wait(exists("flight-pause-btn"), 25000);
  await click("time-warp-10");
  await wait(
    'Number(document.querySelector("[data-testid=telemetry-altitude-value]")?.textContent.replace(/[^0-9.]/g,""))>0.2',
    30000,
  );
  await call("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  });
  await wait(exists("touch-flight-controls"));

  const up = await point("touch-pitchForward"),
    down = await point("touch-throttleDown");
  await touch("touchStart", [
    { ...up, id: 1 },
    { ...down, id: 2 },
  ]);
  await wait(pressed("pitchForward"));
  await wait(pressed("throttleDown"));
  const before = await throttle();
  await pause(1800);
  assert.ok((await throttle()) < before, "Held throttle must change thrust");
  await touch("touchEnd", [{ ...down, id: 2 }]);
  await wait(`!(${pressed("throttleDown")})`);
  assert.ok(await evaluate(pressed("pitchForward")));
  await touch("touchCancel", []);
  await wait(`!(${pressed("pitchForward")})`);
  passed(
    "two real touch pointers steer and throttle together; releasing one and cancelling gestures clears only the right inputs",
  );
  await tap("touch-cutThrottle");
  assert.equal(await throttle(), 0);
  await tap("touch-fullThrottle");
  assert.equal(await throttle(), 100);
  const right = await point("touch-yawRight"),
    rcs = await point("touch-rcs");
  const wasRcs = await evaluate(pressed("rcs"));
  await touch("touchStart", [{ ...right, id: 3 }]);
  await touch("touchStart", [
    { ...right, id: 3 },
    { ...rcs, id: 4 },
  ]);
  await touch("touchEnd", [{ ...rcs, id: 4 }]);
  await wait(wasRcs ? `!(${pressed("rcs")})` : pressed("rcs"));
  assert.ok(await evaluate(pressed("yawRight")));
  await touch("touchEnd", []);
  passed(
    "full/cut commands work and a second-finger RCS tap triggers exactly once while steering",
  );
  await keyDown("KeyW", "w");
  assert.equal(await evaluate(pressed("pitchForward")), false);
  await keyUp("KeyW", "w");
  await keyDown("KeyI", "i");
  await wait(pressed("pitchForward"));
  await keyUp("KeyI", "i");
  await wait(`!(${pressed("pitchForward")})`);
  await keyDown("KeyI", "i");
  await evaluate('window.dispatchEvent(new Event("blur"))');
  await wait(`!(${pressed("pitchForward")})`);
  await keyUp("KeyI", "i");
  await key("KeyO", "o");
  assert.equal(
    await evaluate(
      'document.querySelector("[data-testid=touch-pitchForward]").disabled',
    ),
    true,
  );
  await key("KeyM", "m");
  assert.equal(
    await evaluate('document.querySelector(".flight-screen").dataset.camera'),
    "map",
  );
  await key("KeyM", "m");
  await key("KeyO", "o");
  await key("Escape", "Escape");
  await wait(exists("settings-dialog"));
  await keyDown("KeyI", "i");
  await keyUp("KeyI", "i");
  assert.equal(await evaluate(pressed("pitchForward")), false);
  await click("settings-done");
  passed(
    "only remapped keys steer; blur clears held keys; remapped pause and Escape Settings work without leaking input behind dialogs",
  );
  const previousStage = await evaluate(
    'document.querySelector("[data-testid=next-stage-label]").textContent',
  );
  const stagePoint = await point("touch-stage");
  await touch("touchStart", [{ ...stagePoint, id: 8 }]);
  await touch("touchCancel", []);
  assert.equal(
    await evaluate(
      'document.querySelector("[data-testid=next-stage-label]").textContent',
    ),
    previousStage,
  );
  await key("Space", " ");
  assert.equal(
    await evaluate(
      'document.querySelector("[data-testid=next-stage-label]").textContent',
    ),
    previousStage,
  );
  await key("KeyN", "n");
  await wait(
    `document.querySelector('[data-testid=next-stage-label]').textContent!==${JSON.stringify(previousStage)}`,
  );
  await tap("touch-stage");
  await wait('document.querySelector("[data-testid=touch-stage]").disabled');
  passed(
    "remapped staging replaces Space; touch staging advances one event and disables at the last stage",
  );
  for (const [width, height] of [
    [844, 390],
    [768, 1024],
    [1024, 768],
  ]) {
    await b.viewport(width, height);
    await pause(250);
    for (const id of [
      "touch-pitchForward",
      "touch-yawLeft",
      "touch-throttleUp",
      "touch-rcs",
    ])
      await point(id);
    await b.screenshot(`controls-${width}x${height}`);
  }
  await settings();
  await b.select("touch-side-select", "right");
  await b.select("touch-size-select", "large");
  await click("settings-done");
  await b.viewport(390, 844);
  let x = await evaluate(
    '({steer:document.querySelector(".touch-steering").getBoundingClientRect().x,thrust:document.querySelector(".touch-thrust").getBoundingClientRect().x})',
  );
  assert.ok(x.steer > x.thrust);
  await point("touch-pitchForward");
  await point("touch-throttleUp");
  await b.screenshot("controls-phone-right-handed");
  passed(
    "portrait, landscape and tablet touch targets remain reachable; handedness and larger buttons work",
  );
  await call("Emulation.setSafeAreaInsetsOverride", {
    insets: { top: 59, bottom: 34, left: 0, right: 0 },
  });
  await pause(250);
  for (const id of ["touch-pitchForward", "touch-throttleUp", "touch-rcs"])
    await point(id);
  assert.ok(
    (await evaluate(
      'document.querySelector("[data-testid=cockpit-shortcuts]").getBoundingClientRect().top',
    )) >= 59,
  );
  await b.screenshot("controls-phone-safe-area");
  await b.viewport(844, 390);
  await call("Emulation.setSafeAreaInsetsOverride", {
    insets: { top: 0, bottom: 21, left: 44, right: 44 },
  });
  await pause(250);
  for (const id of ["touch-pitchForward", "touch-throttleUp", "touch-rcs"])
    await point(id);
  await b.screenshot("controls-landscape-safe-area");
  await call("Emulation.setSafeAreaInsetsOverride", {
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  await b.viewport(390, 844);
  passed(
    "notch and home-indicator safe areas keep flight buttons reachable in both orientations",
  );

  await b.home();
  await click("menu-explore-btn");
  await wait(exists("touch-flight-controls"));
  assert.equal(
    await evaluate(
      'document.querySelector("[data-testid=touch-stage]").disabled',
    ),
    true,
  );
  await click("explore-play");
  const forward = await point("touch-pitchForward");
  await touch("touchStart", [{ ...forward, id: 1 }]);
  await pause(1000);
  await touch("touchEnd", []);
  await click("explore-save");
  let expedition = await evaluate(
    'JSON.parse(localStorage.getItem("mf.exploration"))',
  );
  assert.ok(expedition.pitch < 0, "Exploration arrow must change pitch");
  await tap("touch-rcs");
  await click("explore-save");
  expedition = await evaluate(
    'JSON.parse(localStorage.getItem("mf.exploration"))',
  );
  assert.equal(expedition.rcsEnabled, false);
  const trim = expedition.pitch;
  await keyDown("KeyI", "i");
  await pause(600);
  await keyUp("KeyI", "i");
  await click("explore-save");
  assert.equal(
    await evaluate('JSON.parse(localStorage.getItem("mf.exploration")).pitch'),
    trim,
  );
  await tap("touch-rcs");
  await tap("touch-fullThrottle");
  await pause(500);
  await tap("touch-cutThrottle");
  await click("explore-view-system");
  await click("explore-view-orbit");
  await b.screenshot("controls-exploration-phone");
  await call("Emulation.setTouchEmulationEnabled", { enabled: false });
  await b.viewport(1440, 1000);
  await wait(exists("touch-flight-controls"));
  await keyDown("KeyI", "i");
  await pause(500);
  await keyUp("KeyI", "i");
  await click("explore-save");
  assert.ok(
    (await evaluate(
      'JSON.parse(localStorage.getItem("mf.exploration")).pitch',
    )) < trim,
  );
  await settings();
  await b.select("touch-controls-select", "on");
  await click("settings-done");
  await wait(exists("touch-flight-controls"));
  await settings();
  await click("controls-default-arrows");
  await click("settings-done");
  await keyDown("ArrowUp", "ArrowUp");
  await wait(pressed("pitchForward"));
  await keyUp("ArrowUp", "ArrowUp");
  await keyDown("ShiftLeft", "Shift");
  await keyDown("ShiftRight", "Shift");
  await keyUp("ShiftLeft", "Shift");
  assert.ok(await evaluate(pressed("throttleUp")));
  await keyUp("ShiftRight", "Shift");
  await wait(`!(${pressed("throttleUp")})`);
  const mousePoint = await point("touch-throttleDown");
  await call("Input.dispatchMouseEvent", {
    type: "mousePressed",
    button: "left",
    clickCount: 1,
    x: mousePoint.x,
    y: mousePoint.y,
  });
  await wait(pressed("throttleDown"));
  await call("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    button: "left",
    clickCount: 1,
    x: mousePoint.x,
    y: mousePoint.y,
  });
  await wait(`!(${pressed("throttleDown")})`);
  await settings();
  await click("controls-default-wasd");
  await click("settings-done");
  await keyDown("KeyW", "w");
  await wait(pressed("pitchForward"));
  await keyUp("KeyW", "w");
  passed(
    "arrow and WASD presets work in flight; both Shift keys and mouse-held buttons release independently",
  );
  await settings();
  await b.select("touch-controls-select", "off");
  await click("settings-done");
  await wait(`!(${exists("touch-flight-controls")})`);
  passed(
    "exploration shares keyboard/touch controls, RCS holds direction, single-stage craft cannot stage, and desktop Auto/Always/Keyboard-only settings work",
  );
  await b.viewport(390, 650);
  await b.home();
  await evaluate(
    'localStorage.clear();localStorage.setItem("mf.settings",JSON.stringify({graphics:"low",reduceMotion:true}))',
  );
  await b.home();
  await click("menu-new-mission-btn");
  await click("mission-card-first_orbit");
  await click("planner-open-hangar-btn");
  await b.select("preset-select", "empty");
  await click("open-readiness-btn");
  await click("launch-anyway-btn");
  await click("launch-anyway-confirm-btn");
  await click("start-countdown-btn");
  await wait(exists("flight-pause-btn"), 25000);
  await click("time-warp-10");
  await wait(exists("vehicle-lost-overlay"), 30000);
  await call("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  });
  await tap("view-report-btn");
  await wait(exists("results-outcome"));
  passed(
    "short-phone failure report stays above disabled flight controls and opens with a real touch tap",
  );
  assert.deepEqual(b.errors, [], "Uncaught browser errors");
  require("node:fs").writeFileSync(
    "/tmp/mission-forge-controls-report.json",
    JSON.stringify({ passed: results, exceptions: b.errors }, null, 2),
  );
  b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
