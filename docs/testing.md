# Run the checks

Use Node.js 24, npm and Chromium. From `frontend`:

```sh
npm ci
npm test
CI=true npm run build
```

Start a static server from the repository root:

```sh
python3 -m http.server 8080 --directory frontend/build
```

In a separate terminal, start an isolated browser:

```sh
chromium --headless --no-sandbox --disable-dev-shm-usage --disable-gpu-rasterization --use-angle=swiftshader --enable-unsafe-swiftshader --remote-debugging-port=9222 --user-data-dir=/tmp/mission-forge-test-browser about:blank
```

Use `--no-sandbox` only in a disposable development/CI environment. Keep the
debugging port bound to localhost. Do not rebuild the served files during browser
checks. Browser scripts share a tab and must run sequentially.

From `frontend`, run:

```sh
npm run test:engineering:ui
npm run test:studio:ui
npm run test:flight-thermal:ui
npm run test:private-assets
```

The engineering check opens the mobile instruments drawer before touching
transfer controls. It verifies actual transfer fuel use, achieved orbit, coast
hold and keyboard/touch cancellation; it does not click invisible controls.

For the full sequence:

```sh
MF_AUDIT_OUTPUT=/tmp/mission-forge-release-audit npm run audit:release -- --extended
```

The runner stops at a failure, prints its final log lines and preserves full
per-check logs plus the build identity. Without an override, results go to
`/tmp/mission-forge-test-results/release-audit` (using the system temporary
directory on other platforms). Individual scenario/profile checks use the same
temporary parent directory. CI uploads these files as diagnostic artifacts.

Use `npm run` to list all checks. Tests include finite scenario matrices,
construction, numerical references, persistence, responsive layouts and offline
recovery. Physical-device ergonomics, thermal throttling and graphics-driver
compatibility require direct testing on the hosted game.
