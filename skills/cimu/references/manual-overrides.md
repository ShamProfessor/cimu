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
    "fontPlan": {"primary": "zhenyan", "emphasis": "qingkehuangyou"}
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

Allowed timeline fields are `title`, `visualProfile`, `template`, `backgroundPlan`, `fontPlan`, and `musicProfile`. Per-line patches may change timing, text, groups, semantic role, importance, emphasis, treatment, or an explicit `effectPlan`.

For `rap-editorial`, the default `webgl-hiphop-editorial` template keeps the entire segment inside one continuous software-WebGL 3D collage space. Hook/Punchline/Declaration lines increase camera motion and card density within that same space; they do not switch from a flat verse scene. `webgl-hiphop-hook` remains a backwards-compatible alias.

`timingApproval.approved: true` clears a review-required timing flag only as an explicit human action. It is not set by ASR, style resolution, or rendering.

```bash
node scripts/apply-lyric-overrides.mjs \
  --timeline song.timeline.json \
  --overrides song.overrides.json \
  --out song.reviewed.json
node scripts/validate-lyric-timeline.mjs --timeline song.reviewed.json
```
