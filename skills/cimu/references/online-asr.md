# Online ASR alignment

Online ASR supplies a timing proposal; it does not certify lyrics for delivery. Keep the provider response separate from the renderer-neutral sidecar, then pass the sidecar to `build-lyric-timeline.mjs`.

## Provider-neutral output

Every adapter writes the existing sidecar contract:

```json
{
  "timingCoordinate": "absolute",
  "segments": [
    {"start": 12.48, "end": 15.02, "text": "歌词文本", "confidence": 0.75}
  ],
  "review": {"required": true}
}
```

`start` and `end` are seconds from the source audio start. A later lyric-timeline build can choose a source range with `--start`; do not pre-shift the cloud timing data.

## Tencent Flash ASR adapter

`scripts/asr/tencent-flash.mjs` is the first adapter because its synchronous recording-file endpoint accepts MP3/M4A/AAC, can return sentence and word times, and supports temporary hotwords. It requires a Tencent Cloud ASR account and API credentials; credentials are read only from environment variables by default and are never written to an artifact.

```bash
TENCENT_ASR_APP_ID='…' \
TENCENT_SECRET_ID='…' \
TENCENT_SECRET_KEY='…' \
node skills/cimu/scripts/asr/tencent-flash.mjs \
  --input song.mp3 \
  --lyrics lyrics.txt \
  --engine 16k_zh_en \
  --out song.asr.json
```

`--lyrics` turns each non-empty lyric row into a temporary hotword. Use it to bias artist names, English phrases, slang, and known lyric wording. It is a recognition hint, not forced alignment. Use `--dry-run` to validate files and arguments without uploading audio.

Then build and validate the delivery timeline:

```bash
node skills/cimu/scripts/build-lyric-timeline.mjs \
  --text lyrics.txt --alignment song.asr.json --audio song.mp3 \
  --start 0 --duration 30 --out song.timeline.json
node skills/cimu/scripts/validate-lyric-timeline.mjs --timeline song.timeline.json
```

## Review policy

- Default adapter confidence is `0.75` because Tencent's Flash response does not provide a per-sentence confidence score. This intentionally keeps the generated timeline in review-required state.
- Check first/last vocal onset, fast rap runs, ad-libs, code switching, censored words, and any lyric line whose ASR text differs from the supplied lyric.
- Only after a human review should approved segments be promoted to the delivery confidence threshold used by `build-lyric-timeline.mjs`; never raise confidence automatically merely because the lyrics were supplied as hotwords.
- For songs with dense accompaniment or singing, ASR is an initial segmentation signal. A future forced-alignment adapter can use the same output contract and replace only this stage.

## Service boundaries

Do not upload audio until the artist or rights holder has agreed to the selected provider's terms. Record the provider, model/engine, request ID, and retention policy with the job metadata. Make timeout, retry, cost cap, and provider fallback policy part of the future job service—not the renderer.
