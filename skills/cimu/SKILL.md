---
name: cimu
description: Create, review, repair, and render local lyric music videos from audio plus LRC, SRT, ASS, or plain-text lyrics. Use when a user asks to make a lyric MV, timed lyric video, subtitle music video, or to check lyric timing, choose visual direction, or export a validated 16:9 or 9:16 lyric-video deliverable. Handle the local rendering workflow yourself; do not require users to run shell commands.
---

# Cimu（词幕）

Turn local audio and lyrics into a reviewable, reproducible lyric-video delivery. Own the technical workflow: users should describe the desired result and provide files, not execute scripts or manipulate JSON.

## Start with the user's request

1. Identify the local audio and lyric inputs already attached or named by the user. Ask only for missing essentials: source audio, lyrics, target range when not the full song, and requested aspect ratio. Default to a 16:9 full-song master.
2. State the short plan in plain language. Do not show Node, FFmpeg, or internal script commands unless the user explicitly asks for developer instructions.
3. Run `scripts/check-runtime.mjs` from this skill directory. If a required runtime is unavailable, report the exact missing dependency and stop before producing a misleading partial delivery. When Chrome is installed outside the discovered paths, use `LYRIC_MV_CHROME_PATH`.

## Prepare timing

- For LRC, SRT, or ASS, build and validate a timeline with `scripts/build-lyric-timeline.mjs` and `scripts/validate-lyric-timeline.mjs`.
- For plain text or ASR output, treat all timings as drafts. Start `scripts/serve-timeline-editor.mjs`, guide the user through line-level timing review in the local editor, and continue only with its reviewed export.
- Keep source lyrics unchanged. Write working timelines and delivery output to a clearly named per-song work directory; do not overwrite user source files.
- Read `references/input-contract.md` only when mapping inputs or output JSON. Read `references/timeline-editor.md` only when the local editor is needed.

## Render and validate

1. Use `scripts/run-delivery.mjs` after timing is reviewed. Omit the visual-profile override unless the user specifies a visual direction; preserve deterministic routing and generated sidecars.
2. Use 1920×1080 at 30 fps for the default landscape master. Produce 9:16 only when explicitly requested and review its safe area independently.
3. Do not call a preview delivered. Verify timeline and rendered-video checks, then inspect the opening, a dense lyric section, a hook or hero line, a transition, and the ending at delivery resolution.
4. Report the exported MP4, output directory, aspect ratio, duration, timing-review status, and any remaining limitation in plain language.

## Creative and safety rules

- Keep lyrics in a single readable lane and preserve sentence reading order.
- Keep creative choices deterministic and persisted in `style-plan.json`; explicit reviewed overrides win.
- Never claim that automatically generated timings or an unreviewed ASR sidecar are delivery-ready.
- Use `references/manual-overrides.md` only for intentional recorded overrides, `references/style-resolution.md` for routing changes, and `references/technical-architecture-zh-CN.md` only when modifying the renderer.

## Maintain the skill

Run `scripts/release-check.mjs` before distributing an edited skill. The source repository's deeper regression check is `scripts/release-check.mjs --with-goldens`. These are maintainer checks, not user instructions.
