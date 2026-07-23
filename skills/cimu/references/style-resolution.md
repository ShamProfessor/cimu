# Style resolution

The style resolver converts an approved song analysis into one reproducible visual plan. It is not a "random effects" button.

## Inputs

- `musicProfile` and `visualProfile` from song analysis;
- line role and importance;
- optional audio energy / beat data;
- `styleSeed`, supplied by the user or deterministically derived from title and source range;
- three manifests: fonts, effects, and backgrounds.

## Resolution stages

1. Resolve one of eight capability-checked scene engines: `editorial-depth`, `heritage-print`, `street-photocopy`, `live-stage`, `indie-night`, `memory-light`, `folk-paper`, or `city-route`.
2. Select one compatible background. The automatic WebGL route starts with a profile-specific authored procedural material, not the song cover: folk uses paper/landscape or city-trace material, pop uses a soft-focus memory-light material, and rap uses its editorial art plate. A supplied cover is an optional artist-personalization overlay, never the default background. An external AI/AE plate is only selected if its license and lyric-safe zone are recorded.
3. Select a font pairing: a primary readable face plus an optional emphasis face. Use any local project font marked `recorded`, including an artist-declared free-commercial font.
4. Resolve inferred or explicit verse/chorus/outro sections. Each section records its range, scene engine, background, intensity, and optional transition.
5. Select effect families compatible with the visual profile and user intent. A line receives `build`, `breathe`, and `resolve`; a section may contribute one transition and effect defaults.
6. Apply constraints: explicit line override > explicit section override > user style intent > profile rules. Do not select excluded effects, repeat adjacent builds, or exceed the requested animation intensity.
7. Persist the resulting `stylePlan` beside the timeline and validate it against the renderer capability contract. Rendering only consumes a passing plan; rerunning with the same seed produces the same choices.

## Profile routing

| Profile | Text vocabulary | Background | Effects to favor | Exclusions |
| --- | --- | --- | --- | --- |
| `code-collision` | compressed, sharp, chromatic | WebGL stage with art plate, fast card field, hard camera | velocity slam, chromatic whip, electric field | brush, gambling motifs |
| `rap-editorial` | compressed display plus printed brush accent | WebGL 3D editorial collage: art plate on distant planes plus moving texture cards at multiple Z depths | Hook/Punchline increases the same scene's camera thrust, card count, speed, and near-field occlusion | cyberpunk, UI panels, circuits, or a static/flat verse background |
| `macau-heritage` | poster body plus brush emphasis | WebGL collage material, red/green print palette, restrained camera | stamp spin, ink slide, paper rip, ink swallow, grain | cyber lightning / RGB whip by default |
| `night-market-copy` | photocopy hierarchy, imperfect edges | warm WebGL street plate, amber/teal cards | scatter assemble, paper rip, grain | luxury gold / clean UI |
| `concrete-anthem` | raw heavy display, hard contrast | WebGL concrete register, dense fast card field | velocity slam, scatter drop, ember field | decorative semantic props |
| `gangster-flash` | condensed street display, brush hit words | WebGL street stage, acid accent and strong camera | flash slam, stamp spin, scatter, chromatic whip | soft romance / dashboard UI |
| `rock-arena` | heavy display, high-contrast full phrases | dark WebGL live-stage field with smoke, warm backlight beams, amp-grid silhouettes, and fast card travel | velocity slam, flash slam, flashbulb, ember field | cyber grid, neon HUD, photoreal concert footage |
| `pop-memory-release` | literary lyrics plus handwritten emphasis | warm procedural WebGL memory-light field, low-speed depth | clip wipe, focus pull, float wind | rap slam / HUD / emoji |
| `folk-letterpress` | restrained literary text with brush release | paper, landscape and sun in a soft low-speed WebGL field | slow clip wipe, low-amplitude drift, warm glow, ink swallow | flat paper-only background / high-frequency flash / dense collage |
| `folk-city-walk` | unified literary sentence set | procedural muted city-toned WebGL field with route trace | slow clip wipe, route drift, print flecks, ink swallow | rural paper field / neon HUD / per-word colors |
| `ballad-editorial` | literary emphasis, restrained labels | procedural warm photo-memory WebGL space | clip wipe, float wind, focus pull | slam / abrupt RGB glitch |

The resolver is a proposal. Timeline-level `effectPlan` or `fontPlan` overrides always win.
