#!/usr/bin/env node
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {cleanText, parseLyrics, withGroups} from './timeline-editor-core.mjs';

function option(name, fallback = undefined) { const index = process.argv.indexOf(`--${name}`); return index === -1 ? fallback : process.argv[index + 1]; }
function number(name, fallback) { const value = Number(option(name, fallback)); if (!Number.isFinite(value)) throw new Error(`--${name} must be a number.`); return value; }
const lrcPath = option('lrc');
const srtPath = option('srt');
const assPath = option('ass');
const textPath = option('text');
const alignmentPath = option('alignment');
const outputPath = option('out');
const timedSourcePaths = [lrcPath, srtPath, assPath].filter(Boolean);
if (!outputPath || (Boolean(textPath) && timedSourcePaths.length) || (!textPath && timedSourcePaths.length !== 1)) throw new Error('Usage: build-lyric-timeline.mjs (--lrc song.lrc | --srt song.srt | --ass song.ass | --text lyrics.txt) --out timeline.json [--alignment asr.json] [--start 0] [--duration seconds] [--audio song.mp3] [--cover cover.jpg]');
if (alignmentPath && !textPath) throw new Error('--alignment is only valid with --text. Timed lyric sources already contain timings.');

const sourceStart = number('start', '0');
const requestedDuration = option('duration') === undefined ? null : number('duration', '0');
if (requestedDuration !== null && requestedDuration <= 0) throw new Error('--duration must be positive.');
const title = option('title');
const audio = option('audio');
const cover = option('cover');

const CREDIT = /^(作词|作曲|编曲|制作人|贝斯|鼓|钢琴|箱琴|笛子|弦乐|和声|童声|录音|混音|母带)\s*[:：]/;
const clean = cleanText;
function key(value) { return clean(value).toLowerCase().replace(/[\s，。！？、,.!?“”"'《》()（）\-—]/g, ''); }
function parseLrc(contents) { return parseLyrics(contents, 'lrc').filter((row) => !CREDIT.test(row.text)); }
function parseSrt(contents) { return parseLyrics(contents, 'srt').filter((row) => !CREDIT.test(row.text)); }
function parseAss(contents) { return parseLyrics(contents, 'ass').filter((row) => !CREDIT.test(row.text)); }
function plainLines(contents) { return contents.split(/\r?\n/).map(clean).filter((line) => line && !line.startsWith('#')); }
function lcsScore(a, b) {
  const left = key(a), right = key(b); if (!left || !right) return 0;
  const previous = new Uint16Array(right.length + 1), current = new Uint16Array(right.length + 1);
  for (let i = 1; i <= left.length; i += 1) { for (let j = 1; j <= right.length; j += 1) current[j] = left[i - 1] === right[j - 1] ? previous[j - 1] + 1 : Math.max(previous[j], current[j - 1]); previous.set(current); current.fill(0); }
  return previous[right.length] / Math.max(left.length, right.length);
}
function readAlignment(file) {
  const document = JSON.parse(readFileSync(resolve(file), 'utf8'));
  const rows = document.segments ?? document.lines ?? document.lyrics ?? [];
  return {relative:Boolean(document.sourceStartSeconds !== undefined || document.timingCoordinate === 'relative'), rows:rows.map((row) => ({start:Number(row.start), end:Number(row.end), text:clean(row.text), confidence:Number(row.confidence ?? row.score ?? 0.75)})).filter((row) => Number.isFinite(row.start) && Number.isFinite(row.end) && row.end > row.start && row.text)};
}
function groups(line) { const normalized = withGroups(line); return {groups:normalized.groups, groupStarts:normalized.groupStarts}; }
function draftTiming(lines, start, duration) {
  const weight = lines.reduce((sum, line) => sum + Math.max(1, key(line).length), 0); let cursor = start;
  return lines.map((text, index) => { const span = index === lines.length - 1 ? start + duration - cursor : duration * Math.max(1, key(text).length) / weight; const line = {start:cursor, end:cursor + Math.max(.8, span), text, confidence:0, timingSource:'draft'}; cursor = line.end; return line; });
}
function alignText(lines, alignment, start, duration) {
  if (!alignment.rows.length) return draftTiming(lines, 0, duration).map((line) => ({...line, start:line.start, end:line.end, timingSource:'draft-no-alignment'}));
  const candidates = alignment.rows.map((segment) => ({...segment, start:alignment.relative ? segment.start : segment.start - start, end:alignment.relative ? segment.end : segment.end - start})).filter((segment) => segment.end > 0 && segment.start < duration);
  let cursor = 0;
  const result = [];
  lines.forEach((text) => {
    let best = null;
    for (let begin = cursor; begin < candidates.length; begin += 1) for (let end = begin; end < Math.min(candidates.length, begin + 4); end += 1) {
      const joined = candidates.slice(begin, end + 1).map((segment) => segment.text).join('');
      const score = lcsScore(text, joined);
      if (!best || score > best.score) best = {begin, end, score};
    }
    if (best && best.score >= .54) {
      const selected = candidates.slice(best.begin, best.end + 1); cursor = best.end + 1;
      result.push({start:Math.max(0, selected[0].start), end:Math.min(duration, selected.at(-1).end), text, confidence:Number((best.score * selected.reduce((sum, segment) => sum + segment.confidence, 0) / selected.length).toFixed(3)), timingSource:'alignment'});
    } else result.push({text, confidence:0, timingSource:'unmatched'});
  });
  const missing = result.filter((line) => !Number.isFinite(line.start));
  if (missing.length) {
    const fallback = draftTiming(missing.map((line) => line.text), 0, duration);
    missing.forEach((line, index) => Object.assign(line, fallback[index]));
  }
  result.sort((a, b) => a.start - b.start);
  result.forEach((line, index) => { const next = result[index + 1]; line.end = Math.max(line.start + .8, Math.min(line.end, next ? next.start : duration)); });
  return result;
}

let lines, sourceKind, timingStatus, review;
if (timedSourcePaths.length) {
  const sourcePath = lrcPath ?? srtPath ?? assPath;
  const parser = lrcPath ? parseLrc : srtPath ? parseSrt : parseAss;
  const kind = lrcPath ? 'lrc' : srtPath ? 'srt' : 'ass';
  const parsed = parser(readFileSync(resolve(sourcePath), 'utf8'));
  if (!parsed.length) throw new Error(`No lyric rows found in ${kind.toUpperCase()}.`);
  const sourceEnd = requestedDuration === null ? Math.max(...parsed.map((line) => line.end ?? line.start + 4)) : sourceStart + requestedDuration;
  lines = parsed.filter((line) => line.start >= sourceStart && line.start < sourceEnd).map((line, index, selected) => ({start:line.start - sourceStart, end:Math.min(sourceEnd, line.end ?? selected[index + 1]?.start ?? sourceEnd) - sourceStart, text:line.text, confidence:1, timingSource:kind}));
  if (!lines.length) throw new Error('No timed lyric rows fall inside the requested source range.');
  sourceKind = kind;
  timingStatus = `timed-${kind}`; review = {required:false, reason:null};
} else {
  const textLines = plainLines(readFileSync(resolve(textPath), 'utf8'));
  if (!textLines.length) throw new Error('No usable lyric text rows found.');
  if (requestedDuration === null) throw new Error('Plain text requires --duration until an ASR alignment is supplied.');
  const alignment = alignmentPath ? readAlignment(alignmentPath) : {relative:false, rows:[]};
  lines = alignText(textLines, alignment, sourceStart, requestedDuration);
  timingStatus = alignmentPath ? (lines.every((line) => line.timingSource === 'alignment') ? 'alignment-backed' : 'mixed-review') : 'draft-no-alignment';
  review = {required: timingStatus !== 'alignment-backed' || lines.some((line) => line.confidence < .86), reason:alignmentPath ? 'Review low-confidence or unmatched alignment rows before delivery.' : 'Draft timings are proportional estimates; attach ASR alignment or manually review before delivery.'};
}
const durationSeconds = requestedDuration ?? Math.max(...lines.map((line) => line.end));
const timeline = {
  schemaVersion: 2,
  title: title ?? null,
  audio: audio ? resolve(audio) : null,
  cover: cover ? resolve(cover) : null,
  sourceStartSeconds: sourceStart,
  durationSeconds:Number(durationSeconds.toFixed(3)),
  lyricSource:{kind:sourceKind ?? (timedSourcePaths.length ? 'timed' : 'plain-text'), path:resolve(lrcPath ?? srtPath ?? assPath ?? textPath), alignment:alignmentPath ? resolve(alignmentPath) : null, timingStatus},
  review,
  lines: lines.map((line) => ({...line, start:Number(line.start.toFixed(3)), end:Number(line.end.toFixed(3)), ...groups(line)}))
};
writeFileSync(resolve(outputPath), JSON.stringify(timeline, null, 2));
console.log(`Built ${timeline.lines.length} ${timingStatus} lyric rows → ${resolve(outputPath)}`);
