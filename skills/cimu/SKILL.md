---
name: cimu
description: Create, revise, review, and export local lyric music videos from audio plus a reviewed LRC, SRT, ASS, or timeline. Use when a user asks for a lyric MV, timed subtitle video, visual style revision, timing revision, or a validated 16:9 or 9:16 export. Agents own the technical workflow; users supply files and creative direction.
---

# Cimu（词幕）

Turn local audio and reviewed lyrics into a reproducible lyric-video delivery. Keep source media unchanged; write work records and logs only under the delivery directory’s `.cimu/`.

## Route inputs

- A new render needs audio plus an LRC/SRT/ASS-derived reviewed timeline. Plain-text lyrics require line-level human timing review first.
- A revision starts by reading `.cimu/context-card.json`, then calls the single preferred entry once: `node scripts/cimu-run.mjs --mode revision --changed style|timing|lyrics|format --quiet --summary-json` from the delivery directory.
- A new render calls the same entry with `--mode new --changed audio --audio … --timeline …`. `cimu-run`/`run-delivery` performs the only normal runtime check; do not run it separately.
- Do not call build, analysis, validation, rendering, or QA scripts one by one to “confirm state”. Diagnose a specific failing stage only after the entry point returns an error code.

## Incremental execution

`.cimu/session.json` owns input fingerprints and reusable artifact paths. Respect its DAG:

| Change | Run | Reuse |
|---|---|---|
| `style` | StylePlan, render, QA | audio, timeline, lyric direction |
| `format` | render, QA | audio, timeline, StylePlan |
| `timing` / `lyrics` | direction, StylePlan, render, QA | audio |
| `audio` / new | full pipeline | nothing |

Do not re-read complete lyrics, timing, audio analysis, StylePlan, old logs, or all `.cimu` files when the session fingerprint and requested scope say they are reusable. Use `scripts/summarize-artifact.mjs --input … [--range start:end]` for targeted inspection.

## Quiet delivery and QA

- Default to `--quiet` (the default). Full subprocess logs belong in `.cimu/logs/<run-id>.log`; complete reports stay in `.cimu/*.json`.
- `--summary-json` returns one machine-readable line. `--verbose` is only for human debugging and may print the detailed log.
- Success reports only status, stage, MP4 path, duration, resolution, and log path. Failures report stage, error code, log path, and at most ten lines.
- Rendered-video validation must pass. Visual QA opens only `.cimu/review-sheet.jpg`, a five-frame contact sheet (opening, dense lyric, hook, transition, ending). Open at most one matching original frame only when the sheet identifies a concrete problem.
- End every user-facing turn with a handoff summary under 600 characters: result, changed scope, delivery path, review status, and the next allowed action.

## Context and token policy

Default to silent execution and compact paths. Continue from `context-card.json`; never reconstruct context by reading old chats, scanning `.cimu`, dumping JSON, dumping lyrics, dumping logs, returning audio-frame arrays, base64, or a gallery of screenshots. Read references only when the requested work needs them: `input-contract.md` for input mapping, `timeline-editor.md` for timing review, `manual-overrides.md` for recorded overrides, `style-resolution.md` for routing changes, and `technical-architecture-zh-CN.md` only for renderer maintenance.

## Maintainers

Run `scripts/release-check.mjs` and the project tests before distributing a changed skill. Architecture and effect details intentionally live in `references/` and manifests rather than this routing file.
