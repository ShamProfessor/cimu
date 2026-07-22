# Font packs

The browser proof renderer may use a macOS fallback during local iteration, but a deliverable lyric MV must use a declared, licensed font pack.

## Contract

Place licensed `.woff2` files (preferred for delivery) or `.ttf` files (accepted by the local browser proof renderer) in a style folder and declare them with `@font-face` inside the style template. Keep a `license.md` beside each pack with source, license, and allowed usage.

```text
fonts/
  hiphop-stencil/
    display.woff2
    body.woff2
    license.md
  ballad-editorial/
    lyric.woff2
    label.woff2
    license.md
```

Do not copy fonts out of macOS system directories into a project. They are acceptable only as a local preview fallback.

## Style rules

- Hip-hop: use a licensed Chinese heavy display font plus a contrasting mono or condensed Latin face. Deform, clip, echo, and animate the glyphs; do not rely on generic UI sans text.
- Ballad: use a restrained Chinese serif/calligraphic lyric face and a quiet label face. The image and pacing should carry the emotion, not an over-decorated font.
- Emoji: never treat platform emoji as the default visual language. Use a deliberate SVG/PNG/Lottie sticker pack for hero semantic objects. `Apple Color Emoji` is permitted only for a consciously social, platform-native template and must have a fallback asset for non-macOS renders.
# Rap display pairing

- `hiphop-qingkehuangyou/`: graphic display voice for short, emphatic groups.
- `rap-zhimangxing/`: brush-display voice for one punchline or culturally specific hero phrase per beat; do not set entire dense verses in this face.
- Pair a display font with a restrained legibility face. Use expressive type as a voice, not a decorative effect on every word.
