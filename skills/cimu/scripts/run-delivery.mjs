#!/usr/bin/env node
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

function option(name) { const index = process.argv.indexOf(`--${name}`); return index === -1 ? null : process.argv[index + 1]; }
function optionalNumber(name) { const value = option(name); if (value === null) return null; const number = Number(value); if (!Number.isFinite(number)) throw new Error(`--${name} must be a number.`); return number; }
const audio = option('audio'), timelinePath = option('timeline'), outputRoot = option('out');
if (!audio || !timelinePath || !outputRoot) throw new Error('Usage: run-delivery.mjs --audio song.mp3 --timeline song.reviewed.json --out delivery-directory [--genre genre] [--visual-profile profile] [--start seconds] [--duration seconds] [--width 1920] [--height 1080] [--fps 30]');

const scriptRoot = resolve(dirname(new URL(import.meta.url).pathname));
const run = (script, args) => {
  const result = spawnSync(process.execPath, [resolve(scriptRoot, script), ...args], {stdio:'inherit'});
  if (result.status !== 0) throw new Error(`${script} failed (${result.status ?? result.signal ?? 'unknown'}).`);
};
run('check-runtime.mjs', []);

const timeline = JSON.parse(readFileSync(resolve(timelinePath), 'utf8'));
const job = {
  schemaVersion:1,
  audio:resolve(audio),
  timeline:resolve(timelinePath),
  sourceStartSeconds:optionalNumber('start') ?? Number(timeline.sourceStartSeconds ?? 0),
  durationSeconds:optionalNumber('duration') ?? Number(timeline.durationSeconds),
  width:optionalNumber('width') ?? 1920,
  height:optionalNumber('height') ?? 1080,
  fps:optionalNumber('fps') ?? 30
};
for (const [key, optionName] of [['genre','genre'], ['visualProfile','visual-profile']]) if (option(optionName)) job[key] = option(optionName);
if (!(job.durationSeconds > 0) || !(job.width > 0) || !(job.height > 0) || !(job.fps > 0)) throw new Error('Timeline duration, width, height, and fps must be positive.');

mkdirSync(resolve(outputRoot), {recursive:true});
const jobPath = resolve(outputRoot, 'job.json');
writeFileSync(jobPath, JSON.stringify(job, null, 2));
run('render-job.mjs', ['--job', jobPath, '--out', resolve(outputRoot)]);
console.log(`Delivery ready → ${resolve(outputRoot, 'delivery-manifest.json')}`);
