# Input and output contract

## Canonical reviewed timeline

The renderer consumes schema version 2. `start` and `end` are seconds relative to the selected audio range. Keep the original source offset in `sourceStartSeconds`.

```json
{
  "schemaVersion": 2,
  "title": "Song title",
  "audio": "/absolute/path/song.mp3",
  "sourceStartSeconds": 75.877,
  "durationSeconds": 31.42,
  "lyricSource": {"kind":"srt","timingStatus":"timed-srt"},
  "review": {"required": false, "reason":"Timing approved in local editor."},
  "lines": [{
    "start": 0,
    "end": 2.4,
    "text": "One readable lyric line",
    "groups": ["One readable", "lyric line"],
    "groupStarts": [0.08, 0.8],
    "role": "verse",
    "importance": 3
  }]
}
```

Use `review.required: true` for plain text or unfinished manual edits. Only an explicit editor final action or a reviewed override may clear it.

### Generated background plate

For a delivery-specific image, record its absolute local path instead of replacing a bundled asset. The renderer preserves the entire 16:9 plate in screen space and writes the path into `style-plan.json`:

```json
"generatedBackground": {
  "path": "/absolute/path/artist-plate.png",
  "type": "AI-generated still plate",
  "prompt": "Recorded generation prompt and license context"
}
```

The image must exist when the StylePlan is resolved. `safeZone` may choose a vertical reading lane, but landscape subtitles remain horizontally centered.

## Job contract

`run-delivery.mjs` writes this hidden `.cimu/job.json` and invokes the production renderer. The default preset is a review render; use `quality: "final"` for a master:

```json
{
  "schemaVersion": 1,
  "audio": "/absolute/path/song.mp3",
  "timeline": "/absolute/path/song.reviewed.json",
  "sourceStartSeconds": 75.877,
  "durationSeconds": 31.42,
  "quality": "preview",
  "width": 1280,
  "height": 720,
  "fps": 24,
  "visualProfile": "rock-indie-melancholy"
}
```

`genre`, `visualProfile`, and `workers` are optional overrides. Preserve the generated `audio.json`, `song-profile.json`, `direction.json`, and `style-plan.json` in `.cimu/`; they are the reproducibility record, not user-facing delivery files.

## Style intent and sections

Users may control the resolver without editing the generated StylePlan:

```json
{
  "styleIntent": {
    "description": "Restrained city-night film title.",
    "animationIntensity": 3,
    "preferredEffects": ["clip-wipe", "float-wind"],
    "excludedEffects": ["chromatic-whip", "flashbulb-field"],
    "backgroundMode": "auto",
    "sceneEngine": "city-route",
    "palette": ["#18201D", "#E7D8BE", "#B65D3C"]
  },
  "sections": [
    {
      "id": "verse-1",
      "start": 0,
      "end": 12.4,
      "role": "verse",
      "sceneEngine": "city-route",
      "intensity": 2,
      "effectPlan": {"build": "clip-wipe"}
    }
  ]
}
```

Palette order is `[background, lyric, accent, secondary]`; use six-digit hex colors. Missing entries fall back to the selected profile. `backgroundMode` may be `auto` (only profile-compatible approved plates), `black` (intentional pure-black fallback), or `provided` (requires `generatedBackground.path` or `backgroundImage`).

StylePlan schema v2 persists the resolved `userIntent`, `sceneEngine`, `sections`, line `sectionId`, `safeZone`, and `capabilityContract`. The resolver validates this plan before rendering and blocks an invalid plan directly.

## Delivery gates

- Require `0 <= start < end <= durationSeconds`, non-empty text, groups whose concatenation exactly covers the source lyric, ordered group starts, no unintended line overlap, and a readable final group hold.
- Treat short line dwell as a warning for human review.
- Require H.264 video, AAC audio, requested dimensions, duration within one frame, and no sampled black frame edge unless the resolved plan explicitly records an intentional black background.
- Require every StylePlan scene, background, section, and effect to be supported by the selected renderer capability contract.
- Render 16:9 first. Treat a portrait version as a separate adaptation with its own safe-zone approval.
