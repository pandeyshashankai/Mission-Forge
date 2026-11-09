# Arc-jet material laboratory — 5 November 2026

Open Home → Sandbox lab → Arc-jet materials.

The implemented bench uses all six public MEDLI2 Table 4 target-condition cases. Select a case, choose its hot-wall or cold-wall flux reference, set an assumed coupon thickness (5–150 mm), then compare generic TPSX PICA virgin, AVCOAT virgin and AVCOAT char.

Three curves show predicted shield surface/backing temperatures on a shared temperature/time scale. Each exposure is followed by thirty seconds of modeled cooling. Cards report peak temperatures and modeled recession. Each material exports a CSV history; the comparison exports JSON with source identification, complete inputs, nominal exposure, state samples and limitations. Changing an input clears stale results.

The model uses the existing implicit shield/backing heat balance. Coupon area is 0.01 m², mass is density × thickness × area, and backing capacity is the game's assumed area-scaled value. AVCOAT virgin has the supplied effective ablation energy; PICA and AVCOAT char do not borrow an unavailable recession parameter. Geometry bounds and finite time/step limits bound computation.

This is an educational **model-prediction bench**, not measured experimental validation. The target wall-reference flux is prescribed unchanged; no inferred absorbed-flux or temperature-feedback correction is claimed. Pressure is context only in this thermal-only calculation, not an overload input. The selected TPSX phase is distinct from MEDLI2 flight-lot PICA. The paper's measured multilayer coupon stackup, coating, fibre orientation, pyrolysis, chemistry and temperature/pressure property curves are not reconstructed. SLA-561V cases supply exposure context; no SLA-561V material model is supplied.

Four tests verify hot/cold exposure conversion and sensitivity; all 18 published-case/material combinations; bounded finite states and missing recession behavior; input validation/CSV units; and integration-step convergence. Full regression suite: 276 tests. A production-browser test checks phone layout, reference switching, stale-result clearing, three charts and actual CSV/JSON downloads.

Source data: `frontend/public/science/arcjet-cases.json`, extracted from the user-supplied `AIAA_2022_Monk.pdf`, Table 4. Original SHA-256 and review: `thermal-sources.md`. This completes the public-data educational comparison feature without requesting additional source collection.
