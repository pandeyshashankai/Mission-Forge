# Uploaded TPSX evidence — 5 November 2026

User-supplied screenshots were manually transcribed into `data/user-sources/tpsx-transcription.json` and the matching downloadable `frontend/public/science/tpsx-user.json`. This is screenshot-derived evidence, not an independently retrieved live TPSX database. Property source classifications and literal condition flags are retained, including `unknown`, `assumed/assumed`, `TRUE`, `nonstp` and `nonstp*`. Their exact test temperatures/pressures are not available.

| Material / phase | Density kg/m³ | Conductivity W/(m K) | Specific heat J/(kg K) | Emissivity | Effective heat of ablation J/kg |
| --- | --- | --- | --- | --- | --- |
| PICA virgin | 236 (uncertainty 12; type unspecified) | 0.305 | 1200 | 0.8 | Not supplied |
| PICA char | 160 | Not supplied | Not supplied | 0.89 | Not supplied |
| AVCOAT virgin | 529 | 0.242 | 1610 | 0.667 | 23,800,000 |
| AVCOAT char | 264 | 0.242 | 2780 | 0.49 | Not supplied |

PICA virgin density/conductivity/emissivity are labelled measured; its specific heat is labelled unknown. PICA char emissivity is labelled measured. The visible AVCOAT properties are labelled unknown. The numerical density uncertainty is preserved without claiming a confidence interval. AVCOAT blowing parameters 0.7/0.37 are retained as reference data, not applied as universal multipliers to the entry-heating estimate.

## Implemented flight behavior

Explore → Systems → Thermal material offers PICA virgin, AVCOAT virgin and AVCOAT char constant-property presets. Enable Thermal & structural failure to apply their thermal response. PICA char is reference-only because conductivity and specific heat are missing.

A two-node shield/backing energy balance uses conductivity, density, heat capacity and emissivity. Radiation and conduction are integrated implicitly for stability as the remaining shield becomes thin. Assumptions remain visible: initial shield mass 120 kg, area 8 m², backing heat capacity 180 kJ/K, and 900 K ablation onset. Remaining thickness follows `shield mass / (density × area)`. Material-specific specific heat determines shield thermal capacity.

Only AVCOAT virgin has a supplied effective heat of ablation, so only that preset models energy-limited recession. PICA and char presets do not borrow another material's ablation parameter. Exposed backing is used after depletion. Virgin/char transitions and NuSil coating chemistry are not simulated. Constant reference properties do not imply verified high-temperature/pressure behavior; the UI flags this limitation. No material is labelled experimentally calibrated. Flight heat forcing remains the existing Earth-air proxy; this upload does not add a Mars-entry heating law or calibrate a MEDLI/PICA-NuSil model.

## Report text supplied

`data/user-sources/ntrs-material-abstracts-2026-11-05.txt` preserves the original pasted bytes; its SHA-256 and seven NTRS citation links are in the adjacent manifest. These are abstracts and bibliographic metadata, not full experimental reports or machine-readable histories.

The reports support relevant context: NuSil can affect PICA response; MEDLI2 flight-lot models updated conductivity as a function of temperature/pressure; validation requires characterized forcing, temperatures and recession. FiberForm test pressures 3500/7500 Pa appear, but without the corresponding quantitative heat-flux and temperature histories. Those two pressures alone are not calibration cases. PICA, FiberForm and PICA-NuSil are kept distinct.

To calibrate the coupled material response, full reports/tables or CSV histories are still required: time, heat flux, pressure, temperature/sensor depth, specimen geometry, recession/mass loss, uncertainties and coating/phase identification. The ocean-loading coefficient file was not supplied in this upload.

## Verification

Five new tests check transcription, phase separation/missing data, SI ablation energy, two-node energy balance, thin-shield stability, material save/restore and differentiated recession behavior. Full regression count is 272. These tests validate code and the recorded transcription; they do not authenticate the screenshots or validate a real spacecraft against physical measurements.
