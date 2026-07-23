# Manual lyric overrides

Keep source timing immutable. Apply artist/editor changes through `scripts/apply-lyric-overrides.mjs`, then validate the reviewed timeline before rendering.

```json
{
  "schemaVersion": 1,
  "note": "Artist review, 2026-07-22",
  "timingApproval": {"approved": true, "reviewer": "artist"},
  "timeline": {
    "visualProfile": "rap-editorial",
    "template": "webgl-hiphop-editorial",
    "backgroundPlan": "rap-editorial-collage-v1",
    "fontPlan": {"primary": "zhenyan", "emphasis": "qingkehuangyou"},
    "styleIntent": {
      "description": "Editorial code collage, controlled outside the hook.",
      "animationIntensity": 3,
      "preferredEffects": ["scatter-assemble", "halo-pulse"],
      "excludedEffects": ["flashbulb-field"]
    },
    "sections": [
      {"id":"verse-1","start":0,"end":8,"role":"verse","sceneEngine":"editorial-depth","intensity":2},
      {"id":"chorus-1","start":8,"end":16,"role":"chorus","sceneEngine":"editorial-depth","intensity":5,"transition":"iris-burn"}
    ]
  },
  "lines": [
    {
      "index": 0,
      "matchText": "Don't touch my code",
      "patch": {
        "groups": ["Don't touch", "my code"],
        "groupStarts": [0.08, 0.52],
        "role": "hook",
        "importance": 5,
        "effectPlan": {"build": "velocity-slam", "breathe": "halo-pulse", "resolve": "chromatic-whip"}
      }
    }
  ]
}
```

Allowed timeline fields are `title`, `visualProfile`, `template`, `backgroundPlan`, `fontPlan`, `musicProfile`, `styleIntent`, `sections`, and `styleSeed`. Per-line patches may change timing, text, groups, semantic role, importance, emphasis, treatment, or an explicit `effectPlan`.

`styleIntent.animationIntensity` is an integer from 1–5. `preferredEffects` and `excludedEffects` must use IDs from `manifests/effects.json`. Explicit section ranges use timeline-relative seconds, may choose one of the registered scene engines, and must not overlap. Line `effectPlan` overrides section effects; section effects override automatic selection.

For `rap-editorial`, the default `webgl-hiphop-editorial` template keeps the entire segment inside one continuous software-WebGL 3D collage space. Hook/Punchline/Declaration lines increase camera motion and card density within that same space; they do not switch from a flat verse scene. `webgl-hiphop-hook` remains a backwards-compatible alias.

`timingApproval.approved: true` clears a review-required timing flag only as an explicit human action. It is not set by style resolution or rendering.

```bash
node scripts/apply-lyric-overrides.mjs \
  --timeline song.timeline.json \
  --overrides song.overrides.json \
  --out song.reviewed.json
node scripts/validate-lyric-timeline.mjs --timeline song.reviewed.json
```
