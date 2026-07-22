---
name: cimu
description: Create reviewable, reproducible lyric music-video delivery packages from local audio plus LRC, SRT, ASS, or plain lyrics. Use when an agent must prepare or edit lyric timing, analyze a song's visual profile, render a deterministic WebGL lyric MV, validate H.264/AAC deliverables, or use the local lyric-timeline editor for rap, rock, folk, pop, ballad, or city-folk tracks.
---

# Cimu（词幕）

Create a local, reproducible delivery package. Treat this skill directory as the distributable unit; do not require a hosted service, local Whisper, generated background video, or cloud account for the supported path.

## Start every delivery

1. Run `node scripts/check-runtime.mjs`. Require Node 20+, FFmpeg, FFprobe, and Chrome/Chromium. When Chrome is not discovered, set `LYRIC_MV_CHROME_PATH` to its executable.
2. Require local audio and a target range. Prefer reviewed LRC/SRT/ASS. Treat plain text or ASR timing as review-required until an editor marks it final.
3. Keep the source lyric file immutable. Export a reviewed timeline instead of overwriting source material.

## Prepare the lyric timeline

Use one of these paths:

- **Timed lyrics:** Run `scripts/build-lyric-timeline.mjs` for LRC, SRT, or ASS, then validate.
- **No timestamps:** Start `node scripts/serve-timeline-editor.mjs`; use the local editor to paste/import lyrics, load local audio, set line timing, resolve validation findings, and mark final. The editor restores a local draft after a refresh; it cannot restore the browser-selected audio file, so select the audio again.
- **ASR sidecar:** Use the optional adapter only to obtain a draft. Review wording and timing before finalizing.

Read `references/user-guide-zh-CN.md` for the end-to-end operating guide, `references/timeline-editor.md` for editor behavior, and `references/input-contract.md` for the canonical schema.

## Render a delivery

Use the single entry point after timing is final:

```bash
node scripts/run-delivery.mjs \
  --audio /absolute/path/song.mp3 \
  --timeline /absolute/path/song.reviewed.json \
  --out /absolute/path/delivery \
  --visual-profile rock-indie-melancholy
```

Omit `--visual-profile` to use deterministic song routing. Use `--start`, `--duration`, `--width`, `--height`, and `--fps` only for deliberate overrides. The landscape default is 1920×1080 at 30fps. Request 9:16 only when it is an explicit delivery requirement.

The output directory is the per-song client handoff. Require these artifacts before calling it delivered:

```text
master-16x9.mp4
delivery-validation.json
delivery-manifest.json
timeline-validation.json
audio.json
song-profile.json
direction.json
style-plan.json
job.json
```

Do not treat a rendered preview as timing approval. `validate-lyric-timeline.mjs` blocks unresolved timing review, invalid ranges, overlap, out-of-bounds rows, empty text, and unreadable final groups. `validate-rendered-mv.mjs` blocks codec, duration, dimension, and sampled black-edge failures.

## Creative and safety rules

- Keep lyrics as the focal layer in one readable lane. Preserve full-sentence reading order; groups are visual phrase timing, not word karaoke.
- Keep creative selection deterministic and persisted in `style-plan.json`. Let explicit timeline style/effect/font overrides win.
- Use profile-aware procedural WebGL backgrounds by default. Keep Canvas templates as explicit manual fallbacks. Do not use song covers as automatic folk/pop backgrounds.
- Use the shared WebGL stage's fixed layer order: overscanned background world → light FX → independent lyric foreground.
- Inspect the first line, dense middle, hook/hero line, transition, and ending at delivery resolution. Do not approve a 9:16 adaptation without an independent safe-zone review.

## Verify the distributed skill

Run `node scripts/release-check.mjs` before handing the skill to another operator. In the source repository, additionally run:

```bash
node scripts/release-check.mjs --with-goldens
```

The latter verifies the six production golden artifacts and is intentionally not required from a standalone skill installation. Read `references/technical-architecture-zh-CN.md` only for rendering/profile changes, `references/manual-overrides.md` for intentional timing or style patches, and `references/style-resolution.md` when changing deterministic creative selection.
