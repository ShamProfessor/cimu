#!/usr/bin/env node
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {
  CimuPipelineError, createRunId, emitSummary, ensureLog, lastLines, option,
  outputMode, runScript
} from './pipeline-utils.mjs';

function optionalNumber(name) {
  const value = option(process.argv, name);
  if (value === null) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new CimuPipelineError('inputs', 'invalid-number', `--${name} must be a number.`);
  return number;
}

async function main() {
  const mode = outputMode(process.argv);
  const audio = option(process.argv, 'audio');
  const timelinePath = option(process.argv, 'timeline');
  const outputRoot = option(process.argv, 'out');
  const revisionMode = option(process.argv, 'mode', 'new');
  const changed = option(process.argv, 'changed', revisionMode === 'new' ? 'audio' : null);
  if (!outputRoot || !['new', 'revision'].includes(revisionMode) || !changed || !['style', 'timing', 'lyrics', 'format', 'audio'].includes(changed)) {
    throw new CimuPipelineError('inputs', 'invalid-usage', 'Usage: run-delivery.mjs --out delivery-directory [--audio song.mp3 --timeline song.reviewed.json] --mode new|revision --changed style|timing|lyrics|format|audio');
  }
  if (revisionMode === 'new' && (!audio || !timelinePath)) throw new CimuPipelineError('inputs', 'missing-input', 'New deliveries require --audio and --timeline.');
  if ((changed === 'audio' || changed === 'timing' || changed === 'lyrics') && (!audio || !timelinePath)) throw new CimuPipelineError('inputs', 'missing-input', `${changed} revisions require --audio and --timeline.`);

  const deliveryRoot = resolve(outputRoot);
  const workRoot = resolve(deliveryRoot, '.cimu');
  const runId = createRunId();
  const logPath = resolve(workRoot, 'logs', `${runId}.log`);
  mkdirSync(workRoot, {recursive: true});
  ensureLog(logPath);
  const scriptRoot = resolve(dirname(new URL(import.meta.url).pathname));
  let summary = {status:'failed', stage:'runtime', log:logPath};
  try {
    runScript({scriptRoot, script:'check-runtime.mjs', args:[], stage:'runtime', logPath});
    const cachedSessionPath = resolve(workRoot, 'session.json');
    const cachedJob = revisionMode === 'revision' && existsSync(cachedSessionPath) ? JSON.parse(readFileSync(cachedSessionPath, 'utf8')).job : null;
    const requestedQuality = option(process.argv, 'quality');
    const job = {schemaVersion:2, mode:revisionMode, changed, quality:requestedQuality ?? cachedJob?.quality ?? 'preview'};
    const qualityPresets = {preview:{width:1280,height:720,fps:24}, final:{width:1920,height:1080,fps:30}};
    if (!qualityPresets[job.quality]) throw new CimuPipelineError('inputs', 'unknown-quality', `Unknown --quality ${job.quality}.`);
    const preset = qualityPresets[job.quality];
    job.width = optionalNumber('width') ?? (requestedQuality ? preset.width : cachedJob?.width ?? preset.width);
    job.height = optionalNumber('height') ?? (requestedQuality ? preset.height : cachedJob?.height ?? preset.height);
    job.fps = optionalNumber('fps') ?? (requestedQuality ? preset.fps : cachedJob?.fps ?? preset.fps);
    for (const [key, flag] of [['genre','genre'], ['visualProfile','visual-profile'], ['workers','workers']]) if (option(process.argv, flag)) job[key] = option(process.argv, flag);
    if (audio) job.audio = resolve(audio);
    if (timelinePath) {
      job.timeline = resolve(timelinePath);
      const timeline = JSON.parse(readFileSync(job.timeline, 'utf8'));
      const requestedStart = optionalNumber('start');
      const requestedDuration = optionalNumber('duration');
      const timelineStart = Number(timeline.sourceStartSeconds ?? 0);
      const timelineDuration = Number(timeline.durationSeconds);
      if (requestedStart !== null && Math.abs(requestedStart - timelineStart) > .001) throw new CimuPipelineError('inputs', 'timeline-start-mismatch', '--start does not match timeline sourceStartSeconds.');
      if (requestedDuration !== null && Math.abs(requestedDuration - timelineDuration) > .001) throw new CimuPipelineError('inputs', 'timeline-duration-mismatch', '--duration does not match timeline durationSeconds.');
      job.sourceStartSeconds = requestedStart ?? timelineStart;
      job.durationSeconds = requestedDuration ?? timelineDuration;
    }
    if (!job.durationSeconds && revisionMode === 'revision') {
      if (!cachedJob) throw new CimuPipelineError('cache', 'session-missing', 'Revision mode requires .cimu/session.json.');
      const previous = JSON.parse(readFileSync(cachedSessionPath, 'utf8'));
      job.sourceStartSeconds = previous.job?.sourceStartSeconds ?? 0;
      job.durationSeconds = previous.job?.durationSeconds;
    }
    if (!(job.durationSeconds > 0) || !(job.width > 0) || !(job.height > 0) || !(job.fps > 0)) throw new CimuPipelineError('inputs', 'invalid-job', 'Timeline duration, width, height, and fps must be positive.');
    const label = job.quality === 'preview' ? 'preview' : 'master';
    job.videoName = job.width * 9 === job.height * 16 ? `${label}-16x9.mp4` : job.width * 16 === job.height * 9 ? `${label}-9x16.mp4` : `${label}-${job.width}x${job.height}.mp4`;
    job.videoOutput = resolve(deliveryRoot, job.videoName);
    const jobPath = resolve(workRoot, 'job.json');
    writeFileSync(jobPath, JSON.stringify(job, null, 2));
    runScript({scriptRoot, script:'render-job.mjs', args:['--job', jobPath, '--out', workRoot, '--run-id', runId, '--log', logPath, '--quiet'], stage:'pipeline', logPath});
    const manifest = JSON.parse(readFileSync(resolve(workRoot, 'delivery-manifest.json'), 'utf8'));
    summary = {status:'passed', stage:'delivery', video:manifest.artifacts.video, duration:manifest.duration, resolution:`${manifest.width}x${manifest.height}`, log:logPath};
  } catch (error) {
    const normalized = error instanceof CimuPipelineError ? error : new CimuPipelineError('unknown', 'unexpected', error instanceof Error ? error.message : String(error));
    summary = {status:'failed', stage:normalized.stage, code:normalized.code, log:logPath, errorLines:lastLines(normalized.details || normalized.message, 10)};
    throw Object.assign(normalized, {summary});
  } finally {
    if (summary.status === 'passed') emitSummary(summary, mode, logPath);
  }
}

main().catch((error) => {
  const mode = outputMode(process.argv);
  const fallbackRoot = option(process.argv, 'out') ? resolve(option(process.argv, 'out'), '.cimu', 'logs') : process.cwd();
  const summary = error.summary ?? {status:'failed', stage:error.stage ?? 'inputs', code:error.code ?? 'unexpected', log:fallbackRoot, errorLines:lastLines(error.message, 10)};
  emitSummary(summary, mode, summary.log);
  process.exit(1);
});
