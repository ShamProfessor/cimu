import {appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {createHash, randomUUID} from 'node:crypto';
import {dirname, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

export class CimuPipelineError extends Error {
  constructor(stage, code, message, details = '') {
    super(message);
    this.stage = stage;
    this.code = code;
    this.details = details;
  }
}

export function option(argv, name, fallback = null) {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? fallback : argv[index + 1];
}

export function hasFlag(argv, name) { return argv.includes(`--${name}`); }

export function outputMode(argv) {
  return {verbose: hasFlag(argv, 'verbose'), summaryJson: hasFlag(argv, 'summary-json')};
}

export function createRunId() {
  return `${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${randomUUID().slice(0, 8)}`;
}

export function ensureLog(logPath) {
  mkdirSync(dirname(logPath), {recursive: true});
  writeFileSync(logPath, `Cimu pipeline log\nstarted=${new Date().toISOString()}\n`);
}

export function log(logPath, text) {
  appendFileSync(logPath, `${text.endsWith('\n') ? text : `${text}\n`}`);
}

export function lastLines(text, limit = 10) {
  return String(text ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(-limit);
}

export function runScript({scriptRoot, script, args, stage, logPath}) {
  log(logPath, `\n[${stage}] ${process.execPath} ${script} ${args.join(' ')}`);
  const result = spawnSync(process.execPath, [resolve(scriptRoot, script), ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (output) log(logPath, output);
  if (result.error) throw new CimuPipelineError(stage, 'spawn-failed', `${script} could not start.`, result.error.message);
  if (result.status !== 0) {
    throw new CimuPipelineError(stage, `exit-${result.status ?? 'signal'}`, `${script} failed.`, output);
  }
  return output;
}

export function loadJson(path, fallback = null) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback;
}

export function saveJson(path, value) {
  mkdirSync(dirname(path), {recursive: true});
  writeFileSync(path, JSON.stringify(value, null, 2));
}

// File metadata avoids re-reading large inputs when an earlier SHA-256 is still valid.
export function fingerprint(path, previous = null) {
  const absolute = resolve(path);
  const stats = statSync(absolute);
  if (previous && previous.path === absolute && previous.size === stats.size && previous.mtimeMs === stats.mtimeMs) {
    return {...previous, cacheHit: true};
  }
  return {
    path: absolute,
    size: stats.size,
    mtimeMs: stats.mtimeMs,
    sha256: createHash('sha256').update(readFileSync(absolute)).digest('hex'),
    cacheHit: false
  };
}

export function cacheMatches(current, prior) {
  return Boolean(current && prior && current.sha256 === prior.sha256);
}

export function planStages(mode, changed, cache = {}) {
  if (mode === 'new' || changed === 'audio') return {stages:['audio', 'profile', 'direction', 'style', 'timelineQa', 'render', 'videoQa', 'reviewSheet'], cacheReason: mode === 'new' ? 'new-run' : 'audio-changed'};
  if (changed === 'style') return {stages:['style', 'timelineQa', 'render', 'videoQa', 'reviewSheet'], cacheReason:'reused-audio-timeline-direction'};
  if (changed === 'format') return {stages:['render', 'videoQa', 'reviewSheet'], cacheReason:'reused-audio-timeline-style'};
  if (changed === 'timing' || changed === 'lyrics') return {stages:['direction', 'style', 'timelineQa', 'render', 'videoQa', 'reviewSheet'], cacheReason:'reused-audio'};
  throw new CimuPipelineError('inputs', 'invalid-changed-scope', `Unsupported revision scope: ${changed}.`);
}

export function compactSummary(summary, {json = false, verbose = false, logPath = null} = {}) {
  const compact = {
    status: summary.status,
    stage: summary.stage,
    video: summary.video ?? null,
    duration: summary.duration ?? null,
    resolution: summary.resolution ?? null,
    log: summary.log ?? logPath ?? null,
    ...(summary.code ? {code: summary.code} : {}),
    ...(summary.errorLines?.length ? {errors: summary.errorLines.slice(-10)} : {})
  };
  if (json) return JSON.stringify(compact);
  if (summary.status === 'passed') return `PASS stage=${compact.stage} video=${compact.video} duration=${compact.duration}s resolution=${compact.resolution} log=${compact.log}`;
  return `FAIL stage=${compact.stage} code=${compact.code ?? 'unknown'} log=${compact.log}${compact.errors?.length ? `\n${compact.errors.join('\n')}` : ''}`;
}

export function emitSummary(summary, mode, logPath) {
  const message = compactSummary(summary, {json:mode.summaryJson, verbose:mode.verbose, logPath});
  process.stdout.write(`${message.slice(0, mode.verbose ? undefined : 3900)}\n`);
  if (mode.verbose && logPath && existsSync(logPath)) process.stdout.write(readFileSync(logPath, 'utf8'));
}

export function writeContextCard({deliveryRoot, session, lastChange, reviewStatus}) {
  const card = {
    song: session.song ?? null,
    source: {audio: session.inputs?.audio?.path ?? null, lyrics: session.inputs?.lyrics?.path ?? null},
    latestRun: session.latestRun ?? null,
    video: session.artifacts?.video ?? null,
    timeline: session.artifacts?.direction ?? session.inputs?.timeline?.path ?? null,
    stylePlan: session.artifacts?.stylePlan ?? null,
    reviewStatus: reviewStatus ?? session.reviewStatus ?? 'unknown',
    lastChange,
    nextAllowedActions: ['style', 'timing', 'export']
  };
  const serialized = JSON.stringify(card);
  if (Buffer.byteLength(serialized) > 1024) throw new CimuPipelineError('context-card', 'context-card-too-large', 'Context card exceeds 1 KB.');
  const path = resolve(deliveryRoot, '.cimu/context-card.json');
  saveJson(path, card);
  return path;
}
