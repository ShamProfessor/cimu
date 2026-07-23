#!/usr/bin/env node
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

function option(name, fallback = null) { const index = process.argv.indexOf(`--${name}`); return index === -1 ? fallback : process.argv[index + 1]; }
function optionalNumber(name) { const value = option(name); if (value === null) return null; const number = Number(value); if (!Number.isFinite(number)) throw new Error(`--${name} must be a number.`); return number; }
const audio = option('audio'), timelinePath = option('timeline'), outputRoot = option('out');
if (!audio || !timelinePath || !outputRoot) throw new Error('Usage: run-delivery.mjs --audio song.mp3 --timeline song.reviewed.json --out delivery-directory [--quality preview|final] [--genre genre] [--visual-profile profile] [--start seconds] [--duration seconds] [--width pixels] [--height pixels] [--fps frames] [--workers auto|count]');

const scriptRoot = resolve(dirname(new URL(import.meta.url).pathname));
const run = (script, args) => {
  const result = spawnSync(process.execPath, [resolve(scriptRoot, script), ...args], {stdio:'inherit'});
  if (result.status !== 0) throw new Error(`${script} failed (${result.status ?? result.signal ?? 'unknown'}).`);
};
run('check-runtime.mjs', []);

const timeline = JSON.parse(readFileSync(resolve(timelinePath), 'utf8'));
const requestedStart = optionalNumber('start');
const requestedDuration = optionalNumber('duration');
const quality = option('quality', 'preview');
const qualityPresets = {
  preview: {width:1280, height:720, fps:24},
  final: {width:1920, height:1080, fps:30}
};
if (!qualityPresets[quality]) throw new Error(`Unknown --quality ${quality}; use preview or final.`);
const preset = qualityPresets[quality];
const timelineStart = Number(timeline.sourceStartSeconds ?? 0);
const timelineDuration = Number(timeline.durationSeconds);
if (requestedStart !== null && Math.abs(requestedStart - timelineStart) > .001) throw new Error(`--start ${requestedStart} does not match timeline sourceStartSeconds ${timelineStart}. Rebuild the timeline for the requested range.`);
if (requestedDuration !== null && Math.abs(requestedDuration - timelineDuration) > .001) throw new Error(`--duration ${requestedDuration} does not match timeline durationSeconds ${timelineDuration}. Rebuild the timeline for the requested range.`);
const job = {
  schemaVersion:1,
  audio:resolve(audio),
  timeline:resolve(timelinePath),
  sourceStartSeconds:requestedStart ?? timelineStart,
  durationSeconds:requestedDuration ?? timelineDuration,
  quality,
  width:optionalNumber('width') ?? preset.width,
  height:optionalNumber('height') ?? preset.height,
  fps:optionalNumber('fps') ?? preset.fps
};
const videoLabel = quality === 'preview' ? 'preview' : 'master';
job.videoName = job.width * 9 === job.height * 16 ? `${videoLabel}-16x9.mp4` : job.width * 16 === job.height * 9 ? `${videoLabel}-9x16.mp4` : `${videoLabel}-${job.width}x${job.height}.mp4`;
for (const [key, optionName] of [['genre','genre'], ['visualProfile','visual-profile'], ['workers','workers']]) if (option(optionName)) job[key] = option(optionName);
if (!(job.durationSeconds > 0) || !(job.width > 0) || !(job.height > 0) || !(job.fps > 0)) throw new Error('Timeline duration, width, height, and fps must be positive.');

const deliveryRoot = resolve(outputRoot);
const workRoot = resolve(deliveryRoot, '.cimu');
mkdirSync(workRoot, {recursive:true});
job.videoOutput = resolve(deliveryRoot, job.videoName);
const jobPath = resolve(workRoot, 'job.json');
writeFileSync(jobPath, JSON.stringify(job, null, 2));
run('render-job.mjs', ['--job', jobPath, '--out', workRoot]);
console.log(`Delivery ready → ${job.videoOutput}`);
