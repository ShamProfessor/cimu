#!/usr/bin/env node
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {validateTimeline} from './timeline-editor-core.mjs';

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : process.argv[index + 1];
}

const timelinePath = option('timeline');
const outputPath = option('out');
const allowReviewRequired = process.argv.includes('--allow-review-required');
if (!timelinePath) throw new Error('Usage: validate-lyric-timeline.mjs --timeline timeline.json [--out report.json] [--allow-review-required]');

const timeline = JSON.parse(readFileSync(resolve(timelinePath), 'utf8'));
const report = {...validateTimeline(timeline), timeline:resolve(timelinePath)};
if (allowReviewRequired) {
  report.errors = report.errors.filter((issue) => issue.code !== 'timing-review-required');
  report.warnings = [...report.warnings, {code:'timing-review-required', message:timeline.review?.reason ?? 'Timing requires review before a delivery render.'}];
  report.passed = report.errors.length === 0;
}
if (outputPath) writeFileSync(resolve(outputPath), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.errors.length) process.exit(1);
