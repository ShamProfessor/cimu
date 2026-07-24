#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {CimuPipelineError, option} from './pipeline-utils.mjs';

function summary(path, range) {
  const document = JSON.parse(readFileSync(resolve(path), 'utf8'));
  if (Array.isArray(document.lines)) {
    const [start, end] = String(range ?? '').split(':').map(Number);
    const lines = document.lines.filter((line) => !Number.isFinite(start) || (line.end >= start && (!Number.isFinite(end) || line.start <= end))).slice(0, 6)
      .map((line) => ({start:line.start,end:line.end,text:line.text,role:line.role}));
    return {kind:'timeline', lineCount:document.lines.length, range:{start:document.sourceStartSeconds ?? 0,end:document.durationSeconds}, anomalies:document.validation?.errors?.length ?? 0, lines};
  }
  if (Array.isArray(document.frames)) return {kind:'audio', duration:document.duration, fps:document.fps, frameCount:document.frames.length, beatCount:document.beats?.length ?? 0, beats:document.beats?.slice(0, 12) ?? []};
  if (Array.isArray(document.sections)) return {kind:'style-plan', sceneCount:document.sections.length, font:document.font?.id ?? document.typography?.font ?? null, palette:document.palette ?? document.userIntent?.palette ?? [], effects:[...new Set((document.lines ?? []).flatMap((line) => ['build','breathe','resolve','transition','overlay'].map((key) => line[key]).filter(Boolean)))], anomalies:document.errors?.length ?? 0};
  if ('passed' in document) return {kind:'validation', passed:Boolean(document.passed), errors:document.errors?.map((error) => error.code).slice(0, 10) ?? [], warningCount:document.warnings?.length ?? 0, path:resolve(path)};
  return {kind:'json', keys:Object.keys(document).slice(0, 20), path:resolve(path)};
}

try {
  const input = option(process.argv, 'input');
  if (!input) throw new CimuPipelineError('summary', 'invalid-usage', 'Usage: summarize-artifact.mjs --input artifact.json [--range start:end]');
  process.stdout.write(`${JSON.stringify(summary(input, option(process.argv, 'range')))}\n`);
} catch (error) {
  process.stdout.write(`${JSON.stringify({status:'failed', stage:error.stage ?? 'summary', code:error.code ?? 'unexpected'})}\n`);
  process.exit(1);
}
