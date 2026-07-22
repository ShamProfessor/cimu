# Effect modules

This directory holds implementations; the selection contract lives in `../manifests/effects.json`.

Canvas modules attach deterministic adapters to `window.MVLyricEffects`; the current template calls `phraseMotion`, `renderResolve`, and `drawOverlay`. A non-Canvas renderer may implement the same effect IDs with its own adapter, but it must preserve the seeded `stylePlan` decision.

The first implemented primitives are `stamp-spin`, `scatter-assemble`, `ink-slide`, `weight-swell`, `halo-pulse`, `ghost-drift`, `paper-rip`, `scatter-drop`, `ink-swallow`, `iris-burn`, `focus-pull`, `grain-plate`, `electric-field`, and `ember-field`. Keep any future primitive bounded by its safe text scale, maximum blur, compatible profiles, and hero-only policy.

Do not add an effect by directly calling it from a song template. Register it in the manifest, make it selectable by the seeded resolver, and prove it in a short golden clip first.

Large AE, Lottie, or video plates belong in an external asset pack referenced by `manifests/backgrounds.json`; retain their license and safe-zone metadata beside the file.
