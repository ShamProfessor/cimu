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
const summary = {status:report.passed ? 'passed' : 'failed', stage:'timelineQa', passed:report.passed, errorCodes:report.errors.map((issue) => issue.code), warningCount:report.warnings.length, report:outputPath ? resolve(outputPath) : null};
if (process.argv.includes('--verbose')) console.log(JSON.stringify(report, null, 2));
else console.log(process.argv.includes('--summary-json') ? JSON.stringify(summary) : `${report.passed ? 'PASS' : 'FAIL'} stage=timelineQa report=${summary.report ?? 'none'} errors=${summary.errorCodes.join(',') || 'none'} warnings=${summary.warningCount}`);
if (report.errors.length) process.exit(1);
