# Public-evidence scope — 5 November 2026

The user has set the available published papers, screenshots and extracted tables as the project's evidence boundary. Do not hold the educational simulator release open pending deeper unpublished material data or repeatedly request the same missing datasets.

## Completion standard

- Implement and test educational thermal response using the provided public properties, with geometry, boundary conditions and assumptions visible.
- Preserve material phase, flight lot, coating, units, pressure conditions and source-quality labels. Do not merge generic TPSX and MEDLI2 records into a fabricated universal material.
- Use reported test conditions as nominal test inputs. Distinguish hot-wall, cold-wall and absorbed flux.
- Compare against published quantities only where geometry and boundary conditions can be matched. Label any digitized measurements and their uncertainty.
- Retain existing numerical/conservation/reference checks. Public-paper agreement is limited to the cases actually compared.
- Mark unavailable temperature-dependent properties, pyrolysis kinetics and coating behavior as assumptions or unsupported capabilities. Do not label them experimentally calibrated.
- Separate implemented educational features from unimplemented physics; source availability alone does not finish full global ocean loading or a general rigid-body constraint solver.

The data-collection phase is closed under this scope. Further source collection is optional unless the user expands the scientific requirements. This scope change does not retroactively claim that plot digitization, physical calibration or missing physics have been performed.

Evidence: `tpsx-uploaded-evidence.md`, `thermal-report-review.md`, `ocean-reference-review.md`.
