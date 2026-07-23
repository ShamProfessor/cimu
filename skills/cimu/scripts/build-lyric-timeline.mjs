#!/usr/bin/env node
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {cleanText, parseLyrics, withGroups} from './timeline-editor-core.mjs';

function option(name, fallback = undefined) { const index = process.argv.indexOf(`--${name}`); return index === -1 ? fallback : process.argv[index + 1]; }
function number(name, fallback) { const value = Number(option(name, fallback)); if (!Number.isFinite(value)) throw new Error(`--${name} must be a number.`); return value; }
const lrcPath = option('lrc');
const srtPath = option('srt');
const assPath = option('ass');
const textPath = option('text');
const outputPath = option('out');
const timedSourcePaths = [lrcPath, srtPath, assPath].filter(Boolean);
if (!outputPath || (Boolean(textPath) && timedSourcePaths.length) || (!textPath && timedSourcePaths.length !== 1)) throw new Error('Usage: build-lyric-timeline.mjs (--lrc song.lrc | --srt song.srt | --ass song.ass | --text lyrics.txt) --out timeline.json [--start 0] [--duration seconds] [--audio song.mp3] [--cover cover.jpg]');

const sourceStart = number('start', '0');
const requestedDuration = option('duration') === undefined ? null : number('duration', '0');
if (requestedDuration !== null && requestedDuration <= 0) throw new Error('--duration must be positive.');
const title = option('title');
const audio = option('audio');
const cover = option('cover');
function probeAudioDuration(path) {
  if (!path) return null;
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', resolve(path)], {encoding:'utf8'});
  if (result.status !== 0) throw new Error(`Could not read audio duration: ${result.stderr?.trim() || path}`);
  const duration = Number(result.stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Audio has an invalid duration: ${path}`);
  return duration;
}
const probedAudioDuration = requestedDuration === null ? probeAudioDuration(audio) : null;

const CREDIT = /^(作词|作曲|编曲|制作人|贝斯|鼓|钢琴|箱琴|笛子|弦乐|和声|童声|录音|混音|母带)\s*[:：]/;
const clean = cleanText;
function key(value) { return clean(value).toLowerCase().replace(/[\s，。！？、,.!?“”"'《》()（）\-—]/g, ''); }
function parseLrc(contents) { return parseLyrics(contents, 'lrc').filter((row) => !CREDIT.test(row.text)); }
function parseSrt(contents) { return parseLyrics(contents, 'srt').filter((row) => !CREDIT.test(row.text)); }
function parseAss(contents) { return parseLyrics(contents, 'ass').filter((row) => !CREDIT.test(row.text)); }
function plainLines(contents) { return contents.split(/\r?\n/).map(clean).filter((line) => line && !line.startsWith('#')); }
function groups(line) { const normalized = withGroups(line); return {groups:normalized.groups, groupStarts:normalized.groupStarts}; }
function draftTiming(lines, start, duration) {
  const weight = lines.reduce((sum, line) => sum + Math.max(1, key(line).length), 0); let cursor = start;
  return lines.map((text, index) => { const span = index === lines.length - 1 ? start + duration - cursor : duration * Math.max(1, key(text).length) / weight; const line = {start:cursor, end:cursor + Math.max(.8, span), text, confidence:0, timingSource:'draft'}; cursor = line.end; return line; });
}

let lines, sourceKind, timingStatus, review;
if (timedSourcePaths.length) {
  const sourcePath = lrcPath ?? srtPath ?? assPath;
  const parser = lrcPath ? parseLrc : srtPath ? parseSrt : parseAss;
  const kind = lrcPath ? 'lrc' : srtPath ? 'srt' : 'ass';
  const parsed = parser(readFileSync(resolve(sourcePath), 'utf8'));
  if (!parsed.length) throw new Error(`No lyric rows found in ${kind.toUpperCase()}.`);
  const sourceEnd = requestedDuration === null ? (probedAudioDuration ?? Math.max(...parsed.map((line) => line.end ?? line.start + 4))) : sourceStart + requestedDuration;
  lines = parsed.filter((line) => line.start >= sourceStart && line.start < sourceEnd).map((line, index, selected) => ({start:line.start - sourceStart, end:Math.min(sourceEnd, line.end ?? selected[index + 1]?.start ?? line.start + 4) - sourceStart, text:line.text, confidence:1, timingSource:kind}));
  if (!lines.length) throw new Error('No timed lyric rows fall inside the requested source range.');
  sourceKind = kind;
  timingStatus = `timed-${kind}`; review = {required:false, reason:null};
} else {
  const textLines = plainLines(readFileSync(resolve(textPath), 'utf8'));
  if (!textLines.length) throw new Error('No usable lyric text rows found.');
  if (requestedDuration === null) throw new Error('Plain text requires --duration before manual timing review.');
  lines = draftTiming(textLines, 0, requestedDuration).map((line) => ({...line, timingSource:'draft-manual-timing'}));
  timingStatus = 'draft-manual-timing';
  review = {required:true, reason:'Draft timings are proportional estimates; review every lyric line in the local timeline editor before delivery.'};
}
const durationSeconds = requestedDuration ?? (probedAudioDuration ? probedAudioDuration - sourceStart : Math.max(...lines.map((line) => line.end)));
const timeline = {
  schemaVersion: 2,
  title: title ?? null,
  audio: audio ? resolve(audio) : null,
  cover: cover ? resolve(cover) : null,
  sourceStartSeconds: sourceStart,
  durationSeconds:Number(durationSeconds.toFixed(3)),
  lyricSource:{kind:sourceKind ?? (timedSourcePaths.length ? 'timed' : 'plain-text'), path:resolve(lrcPath ?? srtPath ?? assPath ?? textPath), timingStatus},
  review,
  lines: lines.map((line) => ({...line, start:Number(line.start.toFixed(3)), end:Number(line.end.toFixed(3)), ...groups(line)}))
};
writeFileSync(resolve(outputPath), JSON.stringify(timeline, null, 2));
console.log(`Built ${timeline.lines.length} ${timingStatus} lyric rows → ${resolve(outputPath)}`);
