# Local lyric timeline editor

Start the editor with the bundled local server, then open the printed loopback URL in a modern browser:

```bash
node skill/cimu/scripts/serve-timeline-editor.mjs
```

It needs no package installation, login, upload, or cloud storage. The server only exposes files inside this skill on `127.0.0.1`.

1. Import an LRC, SRT, ASS, or plain-text lyric file. Plain text starts as a review-required draft.
2. Optionally import local audio. Browser playback highlights the active lyric line and refreshes the preview.
3. Edit line text and relative `start` / `end` seconds. Rows can be added, deleted, reordered, split, and merged.
4. Resolve validation findings, then click **标记 final** when the timing is approved.
5. Export `*.reviewed.json` for `run-delivery.mjs`, or export a relative-time SRT for the selected render range.

The editor auto-saves non-empty timeline edits in browser local storage and restores them on reopening. Audio files are never copied into storage: after recovery, select the local audio file again. Use **清除草稿** to remove the saved local timeline; use **清空全部** to clear both the active timeline and its draft.

The reviewed JSON preserves the existing schema v2 renderer contract. Exported subtitle times are relative to `0..durationSeconds`; `sourceStartSeconds` remains in the JSON for audio-range muxing.

The shared `scripts/timeline-editor-core.mjs` is the source of truth for parsing, time formatting, and validation. The CLI validator imports it, so editor feedback and production validation use the same checks for overlap, invalid ranges, out-of-bounds rows, short dwell, empty text, groups, and final-review state.
