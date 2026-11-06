# Cloudflare Pages release

Connect `pandeyshashankai/Mission-Forge`, production branch `main`, root directory
`frontend`, build command `npm ci && npm run build`, output `build`, environment
variable `NODE_VERSION=24`. No functions, database, account integration, API keys
or application servers are required. Host at the origin root over HTTPS.

The public `_headers` file keeps the entry page, build identity and offline worker
fresh; hashed static chunks can be cached indefinitely. Scientific engine files
are revalidated so a deployment cannot silently retain an old bundle/checksum.

After the first deployment, record the URL, Git commit and `/build-info.json` ID.
A deployment is not verified merely because the repository passed its local audit.

1. Open the URL in a fresh desktop browser and an actual Android browser.
2. Run First Orbit, open the debrief and record a reflection.
3. Open NASA Data Explorer and compare Earth and Mars.
4. Use touch controls, remap a desktop control and restore its default.
5. Save, export, reload and import an expedition; verify fuel/time and paused state.
6. Run the station-loading, fracture and full-engine labs, including paired parity.
7. Prepare offline play, wait for ready, close/reopen the site offline and run a lab.
8. Reconnect after a new deployment; verify the build ID changes and saves survive.
9. Rehearse the three-minute demo and keep the exported backup presentation handy.

Physical-device checks, hosted-origin behavior and participant usability results
are not replaced by local emulation. The release evidence identifies the exact
locally tested implementation commit; later evidence-only commits can differ.
