# Creative direction pass

## Purpose

Do not animate every lyric line the same way. Use the entire lyric, repeated phrases, arrangement, and energy changes to produce a compact creative map before rendering.

## AI output contract

AI may propose the following fields. A creator approves or edits the high-importance entries before final render.

```json
{
  "musicProfile": {
    "genre": "hip-hop",
    "energy": "rising",
    "vocalDensity": "high",
    "backgroundStrategy": "procedural-code-grid"
  },
  "lines": [
    {
      "start": 0,
      "end": 1.2,
      "text": "Don't touch my code",
      "role": "hook",
      "importance": 5,
      "emphasis": ["code"],
      "treatment": "hook-lockup",
      "groups": ["DON'T", "TOUCH", "MY CODE"],
      "motionSpec": {
        "build": "velocity-snap",
        "breathe": "echo-drift",
        "resolve": "diagonal-cut",
        "layers": ["ghost-type", "tag-strip"]
      },
      "confidence": 0.95
    }
  ]
}
```

Do not fabricate word timestamps. `emphasis` is semantic markup; animate it at word level only when the reviewed input includes word timing.

`scripts/propose-lyric-direction.mjs` provides a deterministic baseline for line `role` and `importance`: repeated lines become hook candidates, punctuation and explicit technical/punchline vocabulary become punchline candidates, and no more than three lines per run receive `importance: 5`. It never overrides artist-supplied `role`, `importance`, `groups`, or `effectPlan`. `--regroup` is an explicit opt-in that replaces only an ingest-generated single-line group with a review-required visual-phrase proposal.

`groups` divides one lyric line into a few readable visual phrases. `motionSpec` is the choreography contract: every line has a fast or soft `build`, an active but readable `breathe`, and a `resolve` that hands momentum to the next line. It avoids the anti-pattern of a sentence simply appearing and then freezing.

## Direction rules

- Mark at most 10–15% of lyric lines as `importance: 5`; reserve hero motion for hooks, quotable punchlines, and section turns.
- Use recurrence as evidence: repeated chorus or title phrases are hook candidates.
- Combine text signals (repetition, contrast, humour, numbers, names, rhetorical questions) with audio signals (section boundary, pause, downbeat, sustained note).
- Let treatment express meaning, not merely energy. A deadline can slip; a promise can lock; a joke can interrupt; a release can breathe.
- Make the manual override authoritative. AI cannot reliably infer artist intent, irony, or an audience's existing in-jokes from text alone.

## Treatment vocabulary

| Treatment | Use for | Visual action |
|---|---|---|
| `hook-lockup` | repeated title / chorus | giant lockup, structural frame, recurring signature motion |
| `punch-stamp` | declarative punchline | stamp, freeze, overshoot, short debris burst |
| `requirement-redline` | conflict / demand / criticism | redline, strike, ticket stack, cursor interruption |
| `deadline-slip` | pressure / loss of control | skew, drift, duplicate shadow, accelerating exit |
| `comic-rise` | joke / self-deprecation | vertical rise, delayed secondary caption, restrained bounce |
| `backlog-stack` | accumulation | layered cards or tickets that compress the frame |
| `color-shift` | metaphor / emotional turn | palette change with low-frequency background motion |
| `retro-terminal` | period / technology reference | deliberate era-specific type, scanline, terminal boot |
| `breath-hold` | vulnerable or reflective line | reduce motion and visual density; let words be read |

## Background planning

Choose one per section, not one per lyric line:

1. **Procedural** — grid, type field, SVG, shader, particles, or geometry. Default when no assets exist.
2. **Artist pack** — cover, 3–8 photos, rehearsal/phone footage, logos, font, palette. Best value for independent musicians.
3. **Generated stills / loops** — create a coherent set from a shot list, then use slow camera moves and compositing. Keep rights and source prompts with the project.
4. **Live VJ scene** — a separate real-time patch for the stage, using the same creative map and palette but not necessarily the social-video renderer.

Always maintain a contrast plate behind lyrics. Background may evolve by section; it must not compete with the current line.

## Genre profiles

| Profile | Timing | Typography | Background / camera |
|---|---|---|---|
| Hip-hop | phrase and beat level | assertive, collision, punchline hierarchy | hard structural graphics, abrupt section turns |
| Pop | chorus and melodic phrase | recognizable hook lockup, cleaner repeats | cover/performer imagery, color identity, smooth reveals |
| Folk | sentence and breath level | restrained, highly readable, literary | photography/illustration, slow parallax, quiet holds |
| R&B | vocal run and groove level | soft contrast, selective word emphasis | liquid light, close crops, subtle depth and drift |
| Rock / metal | riff and vocal attack | distressed but readable, high-impact transitions | tactile footage, ink, grain, rough texture |
| Electronic | bar and drop level | less text during drops, symbol-led transitions | shader/geometry systems, audio-reactive scene changes |

Genre changes the pacing and art direction; it does not change the input contract.
