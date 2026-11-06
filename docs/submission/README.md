# Submission pack

- [Detailed project report](project-report.md): problem, NASA provenance, transformations, physics, validation, implementation, limitations, and reproduction.
- [Presentation](presentation.html): seven keyboard-navigable slides; use arrows or the visible controls. Print shows every slide.
- [Presenter script](demo-script.md): timed narrative, live-flight steps, backup plan, and likely questions.
- [Recorded validation results](validation-results.json): numerical errors and campaign outcomes from the completed checks.
- [Learner pilot protocol](user-testing-protocol.md): practical session plan and anonymous notes template. No user study is claimed yet.

The application's `public/submission` folder includes standalone HTML and printable PDFs. `python3 scripts/build_submission.py` regenerates the documents from Markdown using ReportLab. The presentation HTML is maintained here and copied to the public folder. Its PDF can be exported using the browser's Print function or `npm --prefix frontend run docs:slides` against the served production build and dedicated Chromium debugging port.

Review all materials against Astroverse's final rubric and file requirements once released. Keep any later student feedback and presentation recordings factual and clearly dated.

A labelled automated flight backup is included as `public/submission/showcase-replay.html` and `showcase-result.json`. It is generated from the real simulator and is explicitly distinct from the live browser showcase and from any student evidence. `node frontend/scripts/export-showcase.cjs` refreshes the result JSON; `python3 scripts/build_showcase_replay.py` regenerates the HTML snapshot from that exported telemetry.

The [serverless readiness update](../serverless-readiness.md) documents recoverable
local saves, verified backups, build identity and the release-audit command.
Home → Mission evidence collects the presentation route and its limitations.
