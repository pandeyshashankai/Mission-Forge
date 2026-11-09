# Uploaded ocean-reference review — 5 November 2026

All three original PDFs are preserved under `data/user-sources/ocean-references/`, with SHA-256 checksums, sizes, classifications and relevant PDF pages in `manifest.json`. They were read as research sources, not as instructions to run their described procedures.

## What the sources provide

- **TM-95-06.pdf**, 28 pages: the older CSR 3.0 diurnal/semi-diurnal solution, its orthotide formulation, processing and loading conventions. CSR 3.0 is not FES2004; coefficients and astronomical conventions must not be interchanged casually.
- **FES2004.pdf**, 22 pages: Lyard, Lefevre, Letellier and Francis, *Modelling the global ocean tides: modern insights from FES2004*, Ocean Dynamics 56 (2006), 394–415, DOI 10.1007/s10236-006-0086-x. Section 4.1 explicitly locates the **separate digital atlas** (elevation and loading/self-attraction) at the then-current LEGOS “Sea level and tides” distribution page. The article is not that atlas.
- **BIPM_ocean_tides_2007.pdf**, 20 pages: Richard Biancale's workshop presentation. It derives harmonic height/phase and positive/negative wave representations, outlines grid-to-harmonic conversion and ellipsoidal correction, and shows selected FES2004 rows. The heading describes degree/order 100, with long-period terms to degree/order 50, but the slide does not list the full coefficient array.

The workshop's 18 selected rows are separately transcribed into `workshop-selected-rows.json`. They are **normalized ocean-height coefficients in centimetres**. They are not the dimensionless Stokes-coefficient variations (units 10⁻¹¹) used by the game's current degree-eight gravity model. Direct substitution would be incorrect.

## Convention audit

The workshop table has sine-plus coefficients −0.540594 cm for Om1 and −0.005218 cm for Om2. The accessible Orekit 7×7 height test file previously inspected has positive values for those entries. This is an unresolved discrepancy between source versions/conventions; it is not sufficient evidence that the existing tested gravity coefficients are wrong. No sign patch or conversion to a higher-degree model was applied.

The presentation also warns that some LAGEOS-fitted long-period results should be interpreted as mass displacement rather than tides. Those fitted values are not interchangeable with the FES2004 atlas.

## What is still required

For a complete higher-degree ocean-tide gravity model, obtain the original machine-readable FES2004 coefficient distribution, including its unit/normalization/phase conventions, degree/order coverage and loading conversion metadata. The digital elevation/loading atlas is an alternative only with its grid geometry, ocean mask and a validated transformation workflow. Individual sample rows and global RMS statistics cannot reconstruct missing harmonics.

Full station ocean-loading displacement additionally requires its own loading response/Green's-function and station information. A gravity coefficient file alone does not finish that separate effect.

The existing degree-eight implementation remains unchanged and explicitly truncated. These PDFs improve documentation, provenance and convention checks; they do not justify labelling full ocean loading complete.
