# NASA source snapshots

Retrieved **4 November 2026** from NASA's official `nasa/GMAT` repository at commit `c9b78bd1c8499845cb78fde315e1f761b6b06f1c`. These files are unmodified. The planetary kernel identifies itself as JPL/NAIF `pck00011.tpc` dated 27 December 2022 and contains its own scientific references and applicability notes. GMAT's defaults are historical software defaults, not necessarily current best estimates.

`python3 scripts/import_nasa_data.py` verifies SHA-256 hashes and reproduces the app's SI-unit subset and `analysis.csv`. Add `--fetch` to retrieve the same pinned source files. The game's derived data is separate from these originals. GMAT's Apache 2.0 license is preserved in `LICENSE-GMAT.txt`; the original header and kernel notices are retained.

Direct NASA websites were denied by the cloud network policy during this work. The verified download channel was NASA's own public GitHub repository. Official upstream NASA links are provided in the generated manifest; they were not retrieved or represented as checked live pages.

The app uses volume-equivalent spherical radii, `1000 × (a×b×c)^(1/3)`, and converts gravitational parameters by `km³/s² × 10⁹ → m³/s²`. Europa/Titan gravity, atmosphere models, fixed orbital elements, and simplified rotation remain separately labelled model inputs.

## Expanded import

The importer now verifies **seven** original NASA snapshots: four data files (the shape/rotation kernel, gravitational defaults, Earth density table, Mars density table) and three method references (exponential-atmosphere implementation, Simple Orbit Transfer tutorial, ImpulsiveBurn documentation). The exact paths and hashes are in the generated manifest.

The additional fields are **12 signed linear rotation periods** from `BODY*_PM[1]`, **28 Earth density bands**, and **150 Mars density bands**. Rotation period is `86400 × 360 / rate` seconds; negative rates remain retrograde. Periodic rotation terms and tilted body axes are not evaluated.

Density bands use altitude in metres, density in kg/m³, and scale height in metres. Inter-band density follows the archived NASA implementation: `rho = rho0 × exp(-(h-h0)/H)`. Our geometric spherical altitude differs from GMAT's ellipsoid geodetic altitude. Exploration applies the Earth/Mars tables for drag within their source ranges. Scored Earth flight retains the existing lower atmosphere, blends to the imported density from 86–90 km, and retains its educational 160 km cutoff. Temperature above 86 km remains a separate game approximation; pressure is derived consistently from density and that temperature. None of these files provides live space weather.

`analysis.csv` includes body radius, gravity and rotation analysis. `atmospheres.csv` contains all 178 converted density bands. Both are regenerated and made downloadable from the app. The source files remain unmodified and the original GMAT license covers the added snapshots.
