#!/usr/bin/env node
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {validateStylePlan} from './style-plan-core.mjs';

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : process.argv[index + 1];
}

const stylePlanPath = option('style-plan');
const timelinePath = option('timeline');
const outputPath = option('out');
if (!stylePlanPath) throw new Error('Usage: validate-style-plan.mjs --style-plan style-plan.json [--timeline timeline.json] [--out report.json]');

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const plan = JSON.parse(readFileSync(resolve(stylePlanPath), 'utf8'));
const timeline = timelinePath ? JSON.parse(readFileSync(resolve(timelinePath), 'utf8')) : null;
const effectManifest = JSON.parse(readFileSync(resolve(root, 'manifests/effects.json'), 'utf8'));
const backgroundManifest = JSON.parse(readFileSync(resolve(root, 'manifests/backgrounds.json'), 'utf8'));
const report = {
  ...validateStylePlan(plan, {timeline, effectManifest, backgroundManifest}),
  stylePlan: resolve(stylePlanPath),
  timeline: timelinePath ? resolve(timelinePath) : null
};

if (outputPath) {
  mkdirSync(dirname(resolve(outputPath)), {recursive:true});
  writeFileSync(resolve(outputPath), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exit(1);
