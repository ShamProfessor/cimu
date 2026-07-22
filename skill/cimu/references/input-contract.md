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

Use `review.required: true` for plain text, unreviewed ASR, or unfinished manual edits. Only an explicit editor final action or a reviewed override may clear it.

## Job contract

`run-delivery.mjs` writes this `job.json` and invokes the production renderer:

```json
{
  "schemaVersion": 1,
  "audio": "/absolute/path/song.mp3",
  "timeline": "/absolute/path/song.reviewed.json",
  "sourceStartSeconds": 75.877,
  "durationSeconds": 31.42,
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "visualProfile": "rock-indie-melancholy"
}
```

`genre` and `visualProfile` are optional overrides. Preserve the generated `audio.json`, `song-profile.json`, `direction.json`, and `style-plan.json`; they are the reproducibility record.

## Delivery gates

- Require `0 <= start < end <= durationSeconds`, non-empty text, ordered group starts, no unintended line overlap, and a readable final group hold.
- Treat short line dwell as a warning for human review.
- Require H.264 video, AAC audio, requested dimensions, duration within one frame, and no sampled black frame edge.
- Render 16:9 first. Treat a portrait version as a separate adaptation with its own safe-zone approval.
