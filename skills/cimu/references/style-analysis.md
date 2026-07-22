# Song style analysis

Run this pass before choosing a visual template. Genre labels alone are not enough: the same rap track can be aggressive, absurd, intimate, or nostalgic; the same ballad can be theatrical or nearly silent.

## Output contract

```json
{
  "musicProfile": {
    "genre": "mandopop-ballad",
    "energy": "restrained-rise",
    "vocalDensity": "measured",
    "emotionalArc": "memory-to-release",
    "visualRegister": "editorial-photo-poem",
    "typeRegister": "serif-lyric-plus-quiet-label",
    "backgroundStrategy": "album-cover-parallax",
    "motifPack": ["moon", "rail", "warm-light"],
    "avoid": ["beat-slam", "generic-confetti", "platform-emoji"]
  }
}
```

## Phase-two routing contract

Run `scripts/analyze-song-profile.mjs` after lyric ingest and audio profiling. It writes a reviewable `songProfile` with a proposed `visualProfile`, evidence, anti-patterns, and background strategy. Pass it to `resolve-style-plan.mjs --song-profile`; a timeline-level `visualProfile` remains the artist override.

## Decision rules

- Analyse the whole lyric first: repeated hook, imagery, shifts in tense, and emotional resolution matter more than a single punchline.
- Derive motion density from vocal density and arrangement. High-density rap may use phrase groups and fast resolves; a ballad needs longer readable holds and soft dissolves.
- Derive motifs from the lyric and assets. `月光` can become a crescent path; `不停站` can become a rail line. A motif must be a coherent SVG/Canvas/Lottie object, never a random decorative square or emoji substitution.
- Use supplied artist assets first. If no assets exist, choose a procedural motif pack or a licensed/generated asset pack before writing background code.
- The profile must state what to avoid. This prevents rap layouts from leaking into ballads and platform-native emoji from leaking into a cinematic MV.

## Rap visual-profile gate

Do not use a single generic `hiphop` treatment. Pick a profile from evidence in the cover, lyric imagery, arrangement, and artist register, then store it in the timeline as `visualProfile`.

| Profile | Use when | Palette / type register | Motion plate | Avoid |
| --- | --- | --- | --- | --- |
| `rap-editorial` | technical boast or abstract self-assertion in a rap lyric; the literal vocabulary is not a visual brief | charcoal / bone / brick / amber; compressed display plus brush accent | editorial collage, concert-photo halftone, torn paper and spray texture | cyberpunk, circuits, UI panels, blue neon, or treating code words as technology branding |
| `macau-heritage` | gambling, travel, brotherhood, old-money imagery | jade / vermilion / gold / paper; display plus brush emphasis | coin seal, mahjong tile, torn paper | red/black cyberpunk default |
| `night-market-copy` | local street detail, humorous realism, DIY tape texture | tobacco / orange / teal / paper | ticket/paper/photocopy plate | luxury-gold treatment |
| `concrete-anthem` | hard, direct, no narrative prop vocabulary | concrete / off-white / signal red | stencil and pulverized paper | semantic motifs not earned by lyrics |

### Timing gate for line-level lyrics

Line-level LRC timings are an upper bound, not a karaoke transcript. Preserve all source text, split it into 1–3 readable groups, and store `groupStarts` after audio analysis. The first group must begin no later than `line.start + 0.12`; later groups should be placed on nearby detected beats when they exist, otherwise at deliberate phrase intervals. Never use a progress function that waits until the end of the line to finish the last phrase.

## Required review questions

1. Does the font family carry the song's register, or is it a system fallback?
2. Does every lyric line resolve out of frame, rather than merely being covered by the next line?
3. Are the supporting objects semantically tied to the lyric and supplied assets?
4. Would the frame still read as the song's genre with the lyric text hidden?
