#!/usr/bin/env node
import {mkdirSync, readFileSync} from 'node:fs';
import {basename, dirname, resolve} from 'node:path';
import {
  CimuPipelineError, compactSummary, createRunId, emitSummary, ensureLog, fingerprint,
  lastLines, loadJson, option, outputMode, planStages, runScript, saveJson, writeContextCard
} from './pipeline-utils.mjs';

function requireArtifact(session, name) {
  const value = session?.artifacts?.[name];
  if (!value) throw new CimuPipelineError('cache', 'missing-artifact', `Revision needs cached ${name}. Start a new delivery instead.`);
  return value;
}

async function main() {
  const mode = outputMode(process.argv);
  const jobPath = option(process.argv, 'job');
  const outputRoot = option(process.argv, 'out');
  if (!jobPath || !outputRoot) throw new CimuPipelineError('inputs', 'invalid-usage', 'Usage: render-job.mjs --job job.json --out .cimu [--quiet|--verbose|--summary-json]');
  const root = resolve(outputRoot);
  const job = JSON.parse(readFileSync(resolve(jobPath), 'utf8'));
  const runId = option(process.argv, 'run-id', createRunId());
  const logPath = option(process.argv, 'log', resolve(root, 'logs', `${runId}.log`));
  if (!option(process.argv, 'log')) ensureLog(logPath);
  const scriptRoot = resolve(dirname(new URL(import.meta.url).pathname));
  const sessionPath = resolve(root, 'session.json');
  const prior = loadJson(sessionPath, null);
  const revision = job.mode === 'revision';
  if (revision && !prior) throw new CimuPipelineError('cache', 'session-missing', 'Revision mode requires .cimu/session.json.');
  const audio = job.audio ?? prior?.inputs?.audio?.path;
  const timeline = job.timeline ?? prior?.inputs?.timeline?.path;
  if (!audio || !timeline) throw new CimuPipelineError('inputs', 'missing-input', 'The delivery needs audio and timeline inputs.');
  const inputs = {
    audio:fingerprint(audio, prior?.inputs?.audio),
    timeline:fingerprint(timeline, prior?.inputs?.timeline),
    // Timed lyrics are represented by the reviewed timeline; preserve a separate key for consumers.
    lyrics:fingerprint(timeline, prior?.inputs?.lyrics),
    style:{value:JSON.stringify({genre:job.genre ?? prior?.job?.genre ?? null, visualProfile:job.visualProfile ?? prior?.job?.visualProfile ?? null}), sha256:null}
  };
  inputs.style.sha256 = (await import('node:crypto')).createHash('sha256').update(inputs.style.value).digest('hex');
  const {stages, cacheReason} = planStages(job.mode ?? 'new', job.changed ?? 'audio', prior?.artifacts);
  const changedAudio = prior && inputs.audio.sha256 !== prior.inputs?.audio?.sha256;
  const changedTimeline = prior && inputs.timeline.sha256 !== prior.inputs?.timeline?.sha256;
  if (revision && job.changed === 'style' && (changedAudio || changedTimeline)) throw new CimuPipelineError('inputs', 'revision-scope-mismatch', 'Style revision changed audio or timeline; use --changed audio, timing, or lyrics.');
  if (revision && job.changed === 'format' && (changedAudio || changedTimeline)) throw new CimuPipelineError('inputs', 'revision-scope-mismatch', 'Format revision changed audio or timeline; use the matching revision scope.');
  mkdirSync(root, {recursive:true});
  const artifacts = {...prior?.artifacts};
  const width = Number(job.width ?? prior?.job?.width), height = Number(job.height ?? prior?.job?.height), fps = Number(job.fps ?? prior?.job?.fps);
  const duration = Number(job.durationSeconds ?? prior?.job?.durationSeconds), start = Number(job.sourceStartSeconds ?? prior?.job?.sourceStartSeconds ?? 0);
  const video = job.videoOutput ? resolve(job.videoOutput) : resolve(root, job.videoName ?? prior?.job?.videoName ?? 'preview-16x9.mp4');
  let currentStage = 'prepare';
  try {
    if (stages.includes('audio')) {
      currentStage = 'audio'; artifacts.audioProfile = resolve(root, 'audio.json');
      runScript({scriptRoot, script:'extract-audio-profile.mjs', args:['--input',audio,'--start',String(start),'--duration',String(duration),'--fps',String(fps),'--out',artifacts.audioProfile], stage:currentStage, logPath});
    }
    if (stages.includes('profile')) {
      currentStage = 'profile'; artifacts.songProfile = resolve(root, 'song-profile.json');
      const args = ['--timeline',timeline,'--audio-data',requireArtifact({artifacts}, 'audioProfile'),'--out',artifacts.songProfile];
      if (job.genre) args.push('--genre',job.genre); if (job.visualProfile) args.push('--visual-profile',job.visualProfile);
      runScript({scriptRoot, script:'analyze-song-profile.mjs', args, stage:currentStage, logPath});
    }
    if (stages.includes('direction')) {
      currentStage = 'direction'; artifacts.direction = resolve(root, 'direction.json');
      runScript({scriptRoot, script:'propose-lyric-direction.mjs', args:['--timeline',timeline,'--song-profile',requireArtifact({artifacts}, 'songProfile'),'--regroup','--out',artifacts.direction], stage:currentStage, logPath});
    }
    if (stages.includes('style')) {
      currentStage = 'style'; artifacts.stylePlan = resolve(root, 'style-plan.json');
      runScript({scriptRoot, script:'resolve-style-plan.mjs', args:['--timeline',requireArtifact({artifacts}, 'direction'),'--song-profile',requireArtifact({artifacts}, 'songProfile'),'--out',artifacts.stylePlan], stage:currentStage, logPath});
      artifacts.styleValidation = resolve(root, 'style-validation.json');
      runScript({scriptRoot, script:'validate-style-plan.mjs', args:['--style-plan',artifacts.stylePlan,'--timeline',artifacts.direction,'--out',artifacts.styleValidation], stage:'styleQa', logPath});
    }
    if (stages.includes('timelineQa')) {
      currentStage = 'timelineQa'; artifacts.timelineValidation = resolve(root, 'timeline-validation.json');
      runScript({scriptRoot, script:'validate-lyric-timeline.mjs', args:['--timeline',requireArtifact({artifacts}, 'direction'),'--out',artifacts.timelineValidation], stage:currentStage, logPath});
    }
    if (stages.includes('render')) {
      currentStage = 'render';
      const args = ['--timeline',requireArtifact({artifacts}, 'direction'),'--style-plan',requireArtifact({artifacts}, 'stylePlan'),'--audio-data',requireArtifact({artifacts}, 'audioProfile'),'--audio',audio,'--start',String(start),'--from','0','--duration',String(duration),'--timeline-duration',String(duration),'--width',String(width),'--height',String(height),'--fps',String(fps),'--out',video];
      if (job.workers) args.push('--workers',String(job.workers));
      runScript({scriptRoot, script:'render-browser-sample.mjs', args, stage:currentStage, logPath});
    }
    if (stages.includes('videoQa')) {
      currentStage = 'videoQa'; artifacts.videoValidation = resolve(root, 'delivery-validation.json');
      const plan = JSON.parse(readFileSync(requireArtifact({artifacts}, 'stylePlan'), 'utf8'));
      const args = ['--input',video,'--timeline',requireArtifact({artifacts}, 'direction'),'--fps',String(fps),'--width',String(width),'--height',String(height),'--out',artifacts.videoValidation];
      if (plan.backgroundMode === 'black') args.push('--allow-black-background');
      runScript({scriptRoot, script:'validate-rendered-mv.mjs', args, stage:currentStage, logPath});
    }
    if (stages.includes('reviewSheet')) {
      currentStage = 'reviewSheet'; artifacts.reviewSheet = resolve(root, 'review-sheet.jpg');
      runScript({scriptRoot, script:'generate-review-sheet.mjs', args:['--input',video,'--timeline',requireArtifact({artifacts}, 'direction'),'--out',artifacts.reviewSheet], stage:currentStage, logPath});
    }
    artifacts.video = video;
    const next = {
      schemaVersion:1, song:basename(timeline).replace(/\.[^.]+$/, ''), latestRun:runId,
      inputs, job:{...job, audio, timeline, width, height, fps, durationSeconds:duration, sourceStartSeconds:start, videoName:basename(video)}, artifacts,
      reviewStatus:'passed', cache:{reason:cacheReason, stages, inputCacheHits:Object.fromEntries(Object.entries(inputs).filter(([, value]) => value.cacheHit).map(([key]) => [key, true]))}
    };
    saveJson(sessionPath, next);
    const contextCard = writeContextCard({deliveryRoot:dirname(root), session:next, lastChange:job.changed, reviewStatus:'passed'});
    const summary = {status:'passed', stage:'delivery', video, duration, resolution:`${width}x${height}`, log:logPath};
    saveJson(resolve(root, 'run-metrics.json'), {
      runId, toolTextOutputBytes:Buffer.byteLength(compactSummary(summary)), returnedImageCount:1, stages,
      cache:{hits:next.cache.inputCacheHits, missReason:cacheReason}, contextCard
    });
    saveJson(resolve(root, 'delivery-manifest.json'), {schemaVersion:2, runId, status:'passed', duration, width, height, fps, job:resolve(jobPath), artifacts, session:sessionPath, contextCard});
    emitSummary(summary, mode, logPath);
  } catch (error) {
    const normalized = error instanceof CimuPipelineError ? error : new CimuPipelineError(currentStage, 'unexpected', error instanceof Error ? error.message : String(error));
    const summary = {status:'failed', stage:normalized.stage, code:normalized.code, log:logPath, errorLines:lastLines(normalized.details || normalized.message, 10)};
    saveJson(resolve(root, 'run-metrics.json'), {
      runId, toolTextOutputBytes:Buffer.byteLength(compactSummary(summary)), returnedImageCount:0,
      stages, cache:{hits:Object.fromEntries(Object.entries(inputs).filter(([, value]) => value.cacheHit).map(([key]) => [key, true])), missReason:cacheReason}, failedStage:summary.stage, code:summary.code
    });
    throw Object.assign(normalized, {summary});
  }
}

main().catch((error) => {
  const summary = error.summary ?? {status:'failed', stage:error.stage ?? 'inputs', code:error.code ?? 'unexpected', log:option(process.argv, 'log', process.cwd()), errorLines:lastLines(error.message, 10)};
  emitSummary(summary, outputMode(process.argv), summary.log);
  process.exit(1);
});
