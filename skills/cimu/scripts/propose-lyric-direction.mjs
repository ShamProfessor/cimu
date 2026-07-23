#!/usr/bin/env node
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : process.argv[index + 1];
}

const timelinePath = option('timeline');
const outputPath = option('out');
const songProfilePath = option('song-profile');
const regroup = process.argv.includes('--regroup');
if (!timelinePath || !outputPath) throw new Error('Usage: propose-lyric-direction.mjs --timeline timeline.json --out direction.json [--song-profile song-profile.json] [--regroup]');

const timeline = JSON.parse(readFileSync(resolve(timelinePath), 'utf8'));
const songProfile = songProfilePath ? JSON.parse(readFileSync(resolve(songProfilePath), 'utf8')) : null;
const sourceLines = timeline.lines ?? timeline.lyrics ?? [];
if (!sourceLines.length) throw new Error('Timeline has no lyric lines.');

function key(value) {
  return String(value ?? '').toLowerCase().replace(/[\s，。！？、,.!?“”"'《》()（）\-—]/g, '');
}

function proposedGroups(text) {
  // Chinese lyrics do not contain word separators. Splitting them by character
  // count produces false phrases such as “是你对我在索 / 取着罗列着”, which
  // changes the sentence while it is being read. Keep an LRC line intact unless
  // the lyric itself supplies a punctuation boundary; deliberate phrase timing
  // remains an explicit, reviewable override.
  const containsHan = /[\u3400-\u9fff]/.test(text);
  const punctuationParts = text.split(/(?<=[，。！？、,.!?])/).map((part) => part.trim()).filter(Boolean);
  if (containsHan) return punctuationParts.length > 1 && punctuationParts.length <= 3 ? punctuationParts : [text];
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length >= 3) {
    const target = Math.min(3, Math.ceil(words.length / 2));
    const groups = Array.from({length:target}, () => []);
    words.forEach((word, index) => groups[Math.min(target - 1, Math.floor(index * target / words.length))].push(word));
    return groups.map((group) => group.join(' ')).filter(Boolean);
  }
  if (punctuationParts.length > 1 && punctuationParts.length <= 3) return punctuationParts;
  return [text];
}

function proposedGroupStarts(line, groups) {
  const duration = Number(line.end) - Number(line.start);
  const firstOffset = Math.min(.08, duration * .10);
  const finalOffset = Math.min(duration * .55, .12 + Math.max(0, groups.length - 1) * .32);
  return groups.map((_, index) => Number((Number(line.start) + firstOffset + (groups.length === 1 ? 0 : index * ((finalOffset - firstOffset) / (groups.length - 1)))).toFixed(3)));
}

const occurrences = new Map();
sourceLines.forEach((line) => {
  const text = key(line.text);
  if (text) occurrences.set(text, (occurrences.get(text) ?? 0) + 1);
});

let heroCount = 0;
const lines = sourceLines.map((line, index) => {
  const text = String(line.text ?? '').trim();
  const repeated = (occurrences.get(key(text)) ?? 0) >= 2;
  const punchline = /[!！？?]|\b(?:code|bug|api|deadline|flow|hook|punchline)\b/i.test(text);
  const proposedRole = repeated ? 'hook' : punchline ? 'punchline' : index === sourceLines.length - 1 ? 'release' : 'verse';
  const explicitImportance = Number(line.importance);
  const wantsHero = line.importance === 5 || (!Number.isFinite(explicitImportance) && (repeated || punchline));
  const importance = Number.isFinite(explicitImportance)
    ? explicitImportance
    : wantsHero && heroCount < 3 ? 5 : repeated || punchline ? 4 : index === sourceLines.length - 1 ? 4 : 3;
  if (importance === 5) heroCount += 1;
  const defaultSingleGroup = Array.isArray(line.groups) && line.groups.length === 1 && line.groups[0] === text;
  const groups = regroup && (!Array.isArray(line.groups) || defaultSingleGroup) ? proposedGroups(text) : line.groups;
  const groupStarts = regroup && (!Array.isArray(line.groups) || defaultSingleGroup) ? proposedGroupStarts(line, groups) : line.groupStarts;
  return {
    ...line,
    role: line.role ?? proposedRole,
    importance,
    ...(groups ? {groups, groupStarts} : {}),
    directionEvidence: {
      repeated,
      punctuationOrKeywordPunchline: punchline,
      regrouped: Boolean(regroup && (!Array.isArray(line.groups) || defaultSingleGroup))
    }
  };
});

const result = {
  ...timeline,
  sourceTimeline: resolve(timelinePath),
  songProfile: songProfilePath ? resolve(songProfilePath) : null,
  creativeDirection: {
    method: 'deterministic-heuristics-v1',
    review: {
      required: true,
      reason: 'Role and hero-treatment proposals are editable. Confirm artist intent, punchlines, and section boundaries before final delivery.'
    },
    profile: songProfile?.visualProfile ?? timeline.visualProfile ?? null
  },
  lines
};

writeFileSync(resolve(outputPath), JSON.stringify(result, null, 2));
console.log(`Proposed direction for ${lines.length} lyric rows (${heroCount} hero lines${regroup ? ', regrouped defaults' : ''}) → ${resolve(outputPath)}`);
