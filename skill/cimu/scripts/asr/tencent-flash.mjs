#!/usr/bin/env node
import {createHmac} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {extname, resolve} from 'node:path';

const HOST = 'asr.cloud.tencent.com';
const DEFAULT_ENGINE = '16k_zh_en';
const DEFAULT_CONFIDENCE = 0.75;

function option(name, fallback = undefined) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

function required(name) {
  const value = option(name);
  if (!value) throw new Error(`Missing required option: --${name}`);
  return value;
}

function number(name, fallback) {
  const value = Number(option(name, fallback));
  if (!Number.isFinite(value)) throw new Error(`--${name} must be a number.`);
  return value;
}

function cleanLyric(value) {
  return String(value ?? '')
    .replace(/\uFEFF/g, '')
    .replace(/[，,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferFormat(audioPath) {
  const format = extname(audioPath).slice(1).toLowerCase();
  if (!['wav', 'pcm', 'ogg-opus', 'speex', 'silk', 'mp3', 'm4a', 'aac', 'amr'].includes(format)) {
    throw new Error(`Unsupported Tencent Flash ASR format: ${format || '(no extension)'}.`);
  }
  return format;
}

function hotwordsFromLyrics(lyricsPath, weight) {
  if (!lyricsPath) return null;
  const words = readFileSync(resolve(lyricsPath), 'utf8')
    .split(/\r?\n/)
    .map(cleanLyric)
    .filter((line) => line && !line.startsWith('#'));
  if (words.length > 128) throw new Error('--lyrics produces more than 128 Tencent temporary hotwords. Provide a curated file instead.');
  return words.length ? words.map((word) => `${word}|${weight}`).join(',') : null;
}

function canonicalQuery(params) {
  return [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

export function toAlignmentSidecar(response, {audioPath, engine, confidence = DEFAULT_CONFIDENCE, lyricsPath = null} = {}) {
  if (Number(response?.code) !== 0) {
    throw new Error(`Tencent Flash ASR failed (${response?.code ?? 'unknown'}): ${response?.message ?? 'No error message returned.'}`);
  }
  const sentences = (response.flash_result ?? []).flatMap((channel) => channel.sentence_list ?? []);
  if (!sentences.length) throw new Error('Tencent Flash ASR returned no sentence-level timing results. Ensure word_info=1 and check the input audio.');
  const segments = sentences.map((sentence) => {
    const start = Number(sentence.start_time) / 1000;
    const end = Number(sentence.end_time) / 1000;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error('Tencent Flash ASR returned an invalid sentence time range.');
    return {
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3)),
      text: String(sentence.text ?? '').trim(),
      confidence,
      words: (sentence.word_list ?? []).map((word) => ({
        start: Number((Number(word.start_time) / 1000).toFixed(3)),
        end: Number((Number(word.end_time) / 1000).toFixed(3)),
        text: String(word.word ?? '').trim()
      })).filter((word) => word.text && Number.isFinite(word.start) && Number.isFinite(word.end) && word.end > word.start)
    };
  }).filter((segment) => segment.text);
  if (!segments.length) throw new Error('Tencent Flash ASR returned only empty sentence text.');
  return {
    schemaVersion: 1,
    provider: {
      id: 'tencent-flash-asr',
      requestId: response.request_id ?? null,
      engine,
      wordTimestamps: true
    },
    timingCoordinate: 'absolute',
    audio: audioPath ? resolve(audioPath) : null,
    lyricHint: lyricsPath ? resolve(lyricsPath) : null,
    review: {
      required: true,
      reason: 'Cloud ASR timings are a draft. Review lyric wording and each low-confidence/fast-vocal segment before delivery.'
    },
    segments
  };
}

export async function transcribeTencentFlash({audioPath, appId, secretId, secretKey, engine = DEFAULT_ENGINE, lyricsPath, hotwordWeight = 10, confidence = DEFAULT_CONFIDENCE}) {
  const input = resolve(audioPath);
  const format = inferFormat(input);
  const timestamp = Math.floor(Date.now() / 1000);
  const params = new URLSearchParams({
    engine_type: engine,
    filter_dirty: '0',
    filter_modal: '0',
    filter_punc: '0',
    first_channel_only: '1',
    secretid: secretId,
    timestamp: String(timestamp),
    voice_format: format,
    word_info: '1'
  });
  const hotwordList = hotwordsFromLyrics(lyricsPath, hotwordWeight);
  if (hotwordList) params.set('hotword_list', hotwordList);
  const query = canonicalQuery(params);
  const path = `/asr/flash/v1/${appId}`;
  const signature = createHmac('sha1', secretKey).update(`POST${HOST}${path}?${query}`).digest('base64');
  const body = readFileSync(input);
  const response = await fetch(`https://${HOST}${path}?${query}`, {
    method: 'POST',
    headers: {
      Authorization: signature,
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(body.byteLength)
    },
    body
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok && !payload) throw new Error(`Tencent Flash ASR HTTP ${response.status} returned a non-JSON response.`);
  return toAlignmentSidecar(payload, {audioPath:input, engine, confidence, lyricsPath});
}

async function main() {
  const audioPath = required('input');
  const outputPath = required('out');
  const appId = option('appid', process.env.TENCENT_ASR_APP_ID);
  const secretId = option('secret-id', process.env.TENCENT_SECRET_ID);
  const secretKey = option('secret-key', process.env.TENCENT_SECRET_KEY);
  const engine = option('engine', DEFAULT_ENGINE);
  const lyricsPath = option('lyrics');
  const hotwordWeight = number('hotword-weight', '10');
  const confidence = number('confidence', String(DEFAULT_CONFIDENCE));
  if (!Number.isInteger(hotwordWeight) || hotwordWeight < 1 || hotwordWeight > 11) throw new Error('--hotword-weight must be an integer between 1 and 11.');
  if (confidence < 0 || confidence > 1) throw new Error('--confidence must be between 0 and 1.');
  if (process.argv.includes('--dry-run')) {
    inferFormat(resolve(audioPath));
    hotwordsFromLyrics(lyricsPath, hotwordWeight);
    console.log(JSON.stringify({provider:'tencent-flash-asr', engine, input:resolve(audioPath), output:resolve(outputPath), lyrics:lyricsPath ? resolve(lyricsPath) : null, wordTimestamps:true, networkRequest:false}, null, 2));
    return;
  }
  if (!appId || !secretId || !secretKey) throw new Error('Tencent credentials are required. Set TENCENT_ASR_APP_ID, TENCENT_SECRET_ID, and TENCENT_SECRET_KEY, or pass --appid, --secret-id, and --secret-key.');
  const sidecar = await transcribeTencentFlash({audioPath, appId, secretId, secretKey, engine, lyricsPath, hotwordWeight, confidence});
  writeFileSync(resolve(outputPath), JSON.stringify(sidecar, null, 2));
  console.log(`Wrote ${sidecar.segments.length} Tencent ASR timing segments → ${resolve(outputPath)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
