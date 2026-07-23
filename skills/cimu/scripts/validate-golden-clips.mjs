#!/usr/bin/env node
import {existsSync, readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {validateStylePlan} from './style-plan-core.mjs';

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : process.argv[index + 1];
}

const manifestPath = option('manifest');
if (!manifestPath) throw new Error('Usage: validate-golden-clips.mjs --manifest golden-clips.json');
const resolvedManifestPath = resolve(manifestPath);
const manifestDirectory = dirname(resolvedManifestPath);
const skillRoot = resolve(dirname(new URL(import.meta.url).pathname), '..');
const manifest = JSON.parse(readFileSync(resolvedManifestPath, 'utf8'));
const effectManifest = JSON.parse(readFileSync(resolve(skillRoot, 'manifests/effects.json'), 'utf8'));
const backgroundManifest = JSON.parse(readFileSync(resolve(skillRoot, 'manifests/backgrounds.json'), 'utf8'));
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.clips)) throw new Error('Golden-clip manifest must declare schemaVersion: 1 and a clips array.');

function resolveManifestPath(path) { return resolve(manifestDirectory, path); }
function readJson(path) { return JSON.parse(readFileSync(resolveManifestPath(path), 'utf8')); }
function probe(path) {
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height,r_frame_rate', '-of', 'json', resolveManifestPath(path)], {encoding:'utf8'});
  if (result.status !== 0) throw new Error(`ffprobe failed for ${path}: ${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

const errors = [];
const checked = [];
for (const clip of manifest.clips) {
  const label = clip.id ?? 'unnamed-clip';
  for (const [name, path] of Object.entries(clip.artifacts ?? {})) if (!existsSync(resolveManifestPath(path))) errors.push({clip:label, code:'missing-artifact', artifact:name, path});
  if (errors.some((error) => error.clip === label)) continue;
  const validation = readJson(clip.artifacts.validation);
  if (!validation.passed) errors.push({clip:label, code:'timeline-validation-failed', details:validation.errors});
  if (clip.artifacts.deliveryValidation) {
    const deliveryValidation = readJson(clip.artifacts.deliveryValidation);
    if (!deliveryValidation.passed) errors.push({clip:label, code:'delivery-validation-failed', details:deliveryValidation.errors});
  }
  const plan = readJson(clip.artifacts.stylePlan);
  if (plan.profile !== clip.profile) errors.push({clip:label, code:'profile-mismatch', expected:clip.profile, actual:plan.profile});
  if (!plan.template) errors.push({clip:label, code:'missing-template'});
  const direction = readJson(clip.artifacts.direction);
  const liveStyleValidation = validateStylePlan(plan, {timeline:direction, effectManifest, backgroundManifest});
  if (!liveStyleValidation.passed) errors.push({clip:label, code:'style-plan-validation-failed', details:liveStyleValidation.errors});
  if (clip.artifacts.stylePlanValidation && !readJson(clip.artifacts.stylePlanValidation).passed) errors.push({clip:label, code:'stored-style-plan-validation-failed'});
  for (const [name, expected] of Object.entries(clip.outputs ?? {})) {
    if (!existsSync(resolveManifestPath(expected.path))) { errors.push({clip:label, code:'missing-output', output:name, path:expected.path}); continue; }
    const metadata = probe(expected.path);
    const video = metadata.streams.find((stream) => stream.codec_type === 'video');
    const audio = metadata.streams.find((stream) => stream.codec_type === 'audio');
    if (video?.codec_name !== 'h264' || audio?.codec_name !== 'aac') errors.push({clip:label, code:'delivery-codec-mismatch', output:name, video:video?.codec_name ?? null, audio:audio?.codec_name ?? null});
    if (expected.width && (video?.width !== expected.width || video?.height !== expected.height)) errors.push({clip:label, code:'dimension-mismatch', output:name, expected:{width:expected.width,height:expected.height}, actual:{width:video?.width,height:video?.height}});
  }
  checked.push({id:label, profile:clip.profile, template:plan.template});
}

const report = {schemaVersion:1, manifest:resolvedManifestPath, clipCount:manifest.clips.length, checked, errors, passed:errors.length === 0};
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exit(1);
