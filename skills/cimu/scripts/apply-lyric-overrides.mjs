#!/usr/bin/env node
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : process.argv[index + 1];
}

const timelinePath = option('timeline');
const overridePath = option('overrides');
const outputPath = option('out');
if (!timelinePath || !overridePath || !outputPath) throw new Error('Usage: apply-lyric-overrides.mjs --timeline timeline.json --overrides overrides.json --out timeline.reviewed.json');

const timeline = JSON.parse(readFileSync(resolve(timelinePath), 'utf8'));
const overrides = JSON.parse(readFileSync(resolve(overridePath), 'utf8'));
if (overrides.schemaVersion !== 1) throw new Error('Overrides must declare schemaVersion: 1.');
const lines = [...(timeline.lines ?? timeline.lyrics ?? [])];
if (!lines.length) throw new Error('Timeline has no lyric lines.');

const allowedLineFields = new Set(['start', 'end', 'text', 'groups', 'groupStarts', 'role', 'importance', 'emphasis', 'treatment', 'effectPlan']);
for (const entry of overrides.lines ?? []) {
  if (!Number.isInteger(entry.index) || entry.index < 0 || entry.index >= lines.length) throw new Error(`Override has invalid line index: ${entry.index}`);
  const current = lines[entry.index];
  if (entry.matchText !== undefined && entry.matchText !== current.text) throw new Error(`Override line ${entry.index} does not match expected text.`);
  const patch = entry.patch ?? {};
  for (const key of Object.keys(patch)) if (!allowedLineFields.has(key)) throw new Error(`Override line ${entry.index} has unsupported field: ${key}`);
  if (patch.groups && !patch.groupStarts) throw new Error(`Override line ${entry.index} must provide groupStarts when changing groups.`);
  if (patch.groupStarts && !patch.groups && patch.groupStarts.length !== (current.groups ?? [current.text]).length) throw new Error(`Override line ${entry.index} groupStarts must match the existing group count.`);
  lines[entry.index] = {...current, ...patch};
}

const allowedTimelineFields = new Set(['title', 'visualProfile', 'template', 'backgroundPlan', 'fontPlan', 'musicProfile', 'styleIntent', 'sections', 'styleSeed']);
const timelinePatch = overrides.timeline ?? {};
for (const key of Object.keys(timelinePatch)) if (!allowedTimelineFields.has(key)) throw new Error(`Overrides has unsupported timeline field: ${key}`);

const timingApproval = overrides.timingApproval;
if (timingApproval?.approved !== undefined && typeof timingApproval.approved !== 'boolean') throw new Error('timingApproval.approved must be boolean.');
const reviewed = {
  ...timeline,
  ...timelinePatch,
  sourceTimeline: resolve(timelinePath),
  appliedOverrides: {
    path: resolve(overridePath),
    note: overrides.note ?? null,
    timingApproval: timingApproval ?? null
  },
  review: timingApproval?.approved
    ? {required:false, reason:`Manual timing review approved${timingApproval.reviewer ? ` by ${timingApproval.reviewer}` : ''}.`}
    : timeline.review,
  lines
};

writeFileSync(resolve(outputPath), JSON.stringify(reviewed, null, 2));
console.log(`Applied ${overrides.lines?.length ?? 0} lyric overrides → ${resolve(outputPath)}`);
