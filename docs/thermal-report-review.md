# Uploaded thermal-report review — 5 November 2026

Original files and SHA-256 checksums are preserved under `data/user-sources/thermal-reports/`. The accompanying `manifest-and-public-tables.json` contains six SI-converted target-condition cases and two room-temperature PICA property rows. No flight-model parameters were silently replaced.

## What these files add

- **AIAA_2022_Monk.pdf** is the substantive 14-page material-response paper. Table 3 on PDF page 4 provides room-temperature conductivity and virgin density for Heritage and MEDLI2 PICA. The table was visually checked against the rendered PDF. Table 4 provides six arc-jet target conditions, explicitly distinguishing hot-wall and cold-wall heat flux. Figures show measured thermocouples and FIAT predictions; Table 5 compares peak responses. This is more evidence than the previously uploaded abstract.
- **20190028635.pdf** contains PICA-NuSil/FiberForm test-condition tables, coating-response observations and imagery. Coated PICA, uncoated PICA and FiberForm cannot be treated as interchangeable calibration specimens.
- **AW2022_Identification_and_Study_of_Validation_Level_Test_Cases.pdf** is a short paper with FiberForm surface-temperature/shape-change comparisons at 7500 Pa and 3500 Pa, plus spatial boundary-condition plots. It is not a complete machine-readable dataset or a PICA property model.
- **AIAA-SciTech-2022-Abstract-Monk-etal-v6.docx** contains an abstract and references. It adds context, not measured numerical histories.

## Extracted target conditions: Monk Table 4

| Facility/test | Material | Hot-wall W/cm² | Cold-wall W/cm² | Estimated pressure kPa | Exposure s |
| --- | --- | --- | --- | --- | --- |
| IHF362 | PICA | 176 | 210 | 17 | 33 |
| IHF362 | PICA | 66 | 81 | 20 | 84 |
| AHF350 | PICA | 65 | 81 | 4 | 25 |
| AHF350 | PICA | 50 | 63 | 3 | 25 |
| PTF162 | SLA-561V | 4.3 | 5.4 | 0.2 | 63 |
| PTF162 | SLA-561V | 8.6 | 9.7 | 0.8 | 25 |

Conversions: 1 W/cm² = 10,000 W/m²; 1 kPa = 1000 Pa. These are target exposures, not measured absorbed heat-flux histories. Neither flux column can be fed directly to the existing absorbed-flux inverse fitter without the appropriate boundary-condition model.

## Room-temperature evidence and discrepancies

Table 3 lists virgin densities 274 kg/m³ (Heritage) and 292 kg/m³ (MEDLI2), distinct from the earlier TPSX screenshot's generic 236 kg/m³. These are separate material/model records, not corrections to the screenshot.

At 1 atm, virgin/char conductivities are 0.174/0.224 W/(m K) for Heritage and 0.169/0.169 for MEDLI2. At the table-labelled 0.001 atm they are 0.520/0.202 and 0.127/0.143 respectively. The printed 0.520 was visually confirmed and not altered on physical-plausibility grounds. The surrounding characterization text mentions 0.01 atm, creating a source discrepancy that remains explicit.

## What cannot be inferred

On PDF page 3 the Monk paper explicitly says elevated-temperature PICA property data are not included. Room-temperature values must not be expanded into an invented high-temperature/pressure law. Digitized response plots could support limited comparisons, with documented plot-reading uncertainty and matched specimen geometry, but they would not reconstruct the omitted property model.

The public target tables, specimen stackups, sensor-depth descriptions and response plots provide a starting point for a bounded validation exercise. A defensible fit requires extracting paired forcing/response data, handling hot/cold-wall boundary conditions, matching geometry and thermocouple depths, treating coating/anisotropy, quantifying digitization uncertainty and keeping independent validation cases. Those steps have not been performed by this document review; no physical-calibration claim is made.
