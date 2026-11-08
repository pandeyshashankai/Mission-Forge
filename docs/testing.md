# Reproduce the release checks

Use Node.js 24, npm and Chromium. No credentials are needed. From the repository:

```sh
cd frontend
npm ci
npm test
npm run build
```

In separate terminals, from the repository root:

```sh
python3 -m http.server 8080 --directory frontend/build
```

```sh
chromium --headless --no-sandbox --disable-dev-shm-usage --enable-unsafe-swiftshader --remote-debugging-port=9222 --user-data-dir=/tmp/mission-forge-browser about:blank
```

`--no-sandbox` is for a disposable development/CI container; use the browser's
normal sandbox on a supported personal machine. Keep CDP bound to localhost.

From `frontend`, run the audit against that isolated browser:

```sh
MF_AUDIT_OUTPUT=/tmp/mission-forge-audit npm run audit:release -- --extended
```

Scripts share a browser tab and must run sequentially. Do not rebuild the served
assets during an audit. The command runs regressions, then builds once, followed
by campaign, generated cases and browser flows. It stops at the first failure and
writes individual logs plus a build-scoped manifest. GitHub Actions uses the same
command and uploads evidence even on failure.

New milestone checks are `npm run test:milestones` and
`npm run test:milestones:ui`. They cover independent station reference series,
invalid BLQ/hull input, fracture conservation, contact/spin/debris persistence,
Wasm parity across all built-in worlds/craft, actual worker flows and small-screen
layouts. The offline audit also starts the complete Wasm worker without network.

The generated scenarios are a finite matrix. Browser emulation cannot establish
thermal throttling, touch ergonomics or graphics-driver compatibility on every
physical device. Conduct the final Android/desktop checks on the deployed URL.

Supplemental release layout checks open all three new labs at 320×568, 568×320
and 768×1024 and assert `document.documentElement.scrollWidth <= innerWidth`.
They use `browserSession()` from `scripts/browser-session.cjs`, then `viewport`,
`home`, `click("menu-sandbox-btn")` and each `sandbox-tab-loading/fracture/engine`.
The nine results are retained in `docs/submission/milestones-extra-layouts.json`.

## Lab scrolling and private submission boundary

`npm run test:labs:ui` checks Guided Showcase, Mission Lab and all nine Sandbox
tabs at small-phone, portrait-phone, landscape-phone, tablet and desktop sizes.
It uses real touch/wheel gestures to reach the bottom and scroll back.
`npm run test:submission` now checks that handouts are absent from the public build,
legacy URLs are unavailable and public menus/search do not expose the removed page.
The offline suite checks retired-document cache cleanup and HTTP 410 responses
for private submission URLs. These are browser checks, not physical-device proof.
