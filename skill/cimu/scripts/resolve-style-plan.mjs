#!/usr/bin/env node
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

function readOption(name, fallback = undefined) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const timelinePath = readOption('timeline');
const outputPath = readOption('out');
const songProfilePath = readOption('song-profile');
const preview = process.argv.includes('--preview');
if (!timelinePath || !outputPath) throw new Error('Usage: resolve-style-plan.mjs --timeline timeline.json --out style-plan.json [--song-profile song-profile.json] [--seed value] [--preview]');

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const timeline = JSON.parse(readFileSync(resolve(timelinePath), 'utf8'));
const songProfile = songProfilePath ? JSON.parse(readFileSync(resolve(songProfilePath), 'utf8')) : null;
const fontManifest = JSON.parse(readFileSync(resolve(root, 'manifests/fonts.json'), 'utf8'));
const backgroundManifest = JSON.parse(readFileSync(resolve(root, 'manifests/backgrounds.json'), 'utf8'));
const effectManifest = JSON.parse(readFileSync(resolve(root, 'manifests/effects.json'), 'utf8'));
const seedText = readOption('seed', timeline.styleSeed ?? `${timeline.title ?? ''}:${timeline.sourceStartSeconds ?? 0}:${timeline.durationSeconds ?? timeline.duration ?? 0}`);

function hash(text) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) { value ^= text.charCodeAt(index); value = Math.imul(value, 16777619); }
  return value >>> 0;
}
function mulberry32(seed) { return () => { let value = seed += 0x6D2B79F5; value = Math.imul(value ^ value >>> 15, value | 1); value ^= value + Math.imul(value ^ value >>> 7, value | 61); return ((value ^ value >>> 14) >>> 0) / 4294967296; }; }
const random = mulberry32(hash(seedText));
const profileRules = {
  'rap-editorial': {prefer:['velocity-slam','scatter-assemble','scatter-drop','grain-plate'], block:['electric-field','iris-burn','float-wind']},
  'code-collision': {prefer:['velocity-slam','scatter-assemble','scatter-drop','grain-plate'], block:['electric-field','iris-burn','float-wind']},
  'macau-heritage': {prefer:['stamp-spin','ink-slide','paper-rip','ink-swallow','grain-plate'], block:['velocity-slam','chromatic-whip','electric-field','iris-burn','float-wind']},
  'night-market-copy': {prefer:['scatter-assemble','clip-wipe','paper-rip','scatter-drop','grain-plate'], block:['electric-field','iris-burn','ink-swallow']},
  'concrete-anthem': {prefer:['velocity-slam','scatter-assemble','scatter-drop','ember-field'], block:['stamp-spin','paper-rip','ink-swallow','float-wind']},
  'gangster-flash': {prefer:['flash-slam','stamp-spin','scatter-assemble','chromatic-whip','flashbulb-field','ember-field'], block:['float-wind','focus-pull']},
  'rock-arena': {prefer:['velocity-slam','flash-slam','scatter-assemble','flashbulb-field','ember-field'], block:['stamp-spin','ink-slide','float-wind']},
  'rock-indie-melancholy': {prefer:['clip-wipe','ghost-drift','focus-pull','grain-plate'], block:['flash-slam','stamp-spin','electric-field','ember-field']},
  'pop-memory-release': {prefer:['clip-wipe','float-wind','focus-pull','ink-swallow'], block:['velocity-slam','flash-slam','stamp-spin','scatter-assemble','chromatic-whip','iris-burn','electric-field','ember-field']},
  'folk-letterpress': {prefer:['clip-wipe','float-wind','ink-swallow','focus-pull'], block:['velocity-slam','flash-slam','stamp-spin','scatter-assemble','chromatic-whip','iris-burn','electric-field','ember-field']},
  'folk-city-walk': {prefer:['clip-wipe','float-wind','ink-swallow','focus-pull'], block:['velocity-slam','flash-slam','stamp-spin','scatter-assemble','chromatic-whip','iris-burn','electric-field','ember-field']},
  'ballad-editorial': {prefer:['clip-wipe','float-wind','focus-pull','ink-swallow'], block:['velocity-slam','stamp-spin','scatter-assemble','chromatic-whip','iris-burn','electric-field','ember-field']}
};
const profileTemplates = {
  'rap-editorial':'webgl-lyric-stage',
  'code-collision':'webgl-lyric-stage',
  'macau-heritage':'webgl-lyric-stage',
  'night-market-copy':'webgl-lyric-stage',
  'concrete-anthem':'webgl-lyric-stage',
  'gangster-flash':'webgl-lyric-stage',
  'rock-arena':'webgl-rock-stage',
  'rock-indie-melancholy':'webgl-rock-indie-stage',
  'pop-memory-release':'webgl-pop-memory-stage',
  'folk-letterpress':'webgl-folk-lyric-stage',
  'folk-city-walk':'webgl-folk-lyric-stage',
  'ballad-editorial':'webgl-pop-memory-stage'
};
function choose(items) { return items[Math.floor(random() * items.length)]; }
function includes(value, list) { return list.includes(value) || list.includes('all'); }
function tagsFor(profile) {
  const tags = {
    'rap-editorial': ['rap', 'street', 'raw', 'analog', 'high-energy'],
    'code-collision': ['rap', 'street', 'raw', 'analog', 'high-energy'],
    'macau-heritage': ['rap', 'heritage', 'street', 'analog'],
    'night-market-copy': ['rap', 'street', 'raw', 'warm'],
    'concrete-anthem': ['rap', 'raw', 'industrial', 'high-energy'],
    'gangster-flash': ['rap', 'street', 'raw', 'impact', 'high-energy', 'night'],
    'rock-arena': ['rock', 'raw', 'impact', 'high-energy', 'night'],
    'rock-indie-melancholy': ['rock', 'folk', 'raw', 'night'],
    'pop-memory-release': ['pop', 'ballad', 'warm', 'melodic'],
    'folk-letterpress': ['folk', 'ballad', 'warm', 'organic'],
    'folk-city-walk': ['folk', 'ballad', 'warm', 'city', 'night'],
    'ballad-editorial': ['ballad', 'folk', 'pop', 'warm']
  };
  return tags[profile] ?? ['rap'];
}
function fontPlan(profile) {
  const routing = {
    'rap-editorial': {primary:['zhenyan','lianmeng-qiyi','zhanku-cool-black'], emphasis:['qingkehuangyou']},
    'code-collision': {primary:['zhenyan','lianmeng-qiyi','zhanku-cool-black'], emphasis:['qingkehuangyou']},
    'macau-heritage': {primary:['youshe-title','zhanku-cool-black','lianmeng-qiyi'], emphasis:['zhimangxing']},
    'night-market-copy': {primary:['zhanku-cool-black','youshe-title','qingkehuangyou'], emphasis:['zhimangxing']},
    'concrete-anthem': {primary:['zhenyan','zhanku-cool-black','lianmeng-qiyi'], emphasis:[]},
    'gangster-flash': {primary:['zhenyan','lianmeng-qiyi','zhanku-cool-black'], emphasis:['youshe-title','zhimangxing']},
    'rock-arena': {primary:['zhenyan','zhanku-cool-black','lianmeng-qiyi'], emphasis:['youshe-title']},
    'rock-indie-melancholy': {primary:['zhanku-literary','zhenyan'], emphasis:['mashanzheng']},
    'pop-memory-release': {primary:['zhanku-literary','mashanzheng'], emphasis:['mashanzheng','zhimangxing']},
    'folk-letterpress': {primary:['zhanku-literary','mashanzheng'], emphasis:['mashanzheng']},
    'folk-city-walk': {primary:['zhanku-literary'], emphasis:[]},
    'ballad-editorial': {primary:['mashanzheng','zhanku-literary'], emphasis:['zhimangxing']}
  };
  const plan = routing[profile] ?? routing['concrete-anthem'];
  const allowed = (id) => preview || fontManifest.fonts.find((font) => font.id === id)?.licenseStatus === 'recorded';
  const primaryCandidates = plan.primary.filter(allowed);
  const emphasisCandidates = plan.emphasis.filter(allowed);
  const primary = primaryCandidates.length ? choose(primaryCandidates) : null;
  const emphasis = emphasisCandidates.length ? choose(emphasisCandidates) : null;
  const needsRecord = [primary, emphasis].filter(Boolean).some((id) => fontManifest.fonts.find((font) => font.id === id)?.licenseStatus !== 'recorded');
  return {primary, emphasis, previewOnly: !primary || needsRecord};
}
function compatible(effect, phase, profile, role) {
  if (effect.phase !== phase) return false;
  if (!includes(role, effect.roles)) return false;
  return effect.tags.some((tag) => tagsFor(profile).includes(tag));
}
function preferredBackground(profile) {
  const candidates = backgroundManifest.backgrounds.filter((background) => background.status === 'ready' && background.profiles.includes(profile));
  return candidates.length ? choose(candidates) : null;
}
function effectFor(phase, profile, role, previousBuild, importance) {
  const rule = profileRules[profile] ?? {prefer:[], block:[]};
  const options = effectManifest.effects.filter((effect) => compatible(effect, phase, profile, role))
    .filter((effect) => !rule.block.includes(effect.id))
    .filter((effect) => phase !== 'build' || effect.id !== previousBuild)
    .filter((effect) => importance === 5 || effect.intensity <= 3);
  const preferred = options.filter((effect) => rule.prefer.includes(effect.id));
  return (preferred.length ? choose(preferred) : options.length ? choose(options) : null)?.id ?? null;
}

const profile = timeline.visualProfile ?? songProfile?.visualProfile ?? (timeline.musicProfile?.genre?.includes('ballad') ? 'ballad-editorial' : 'concrete-anthem');
const lines = timeline.lines ?? timeline.lyrics ?? [];
let previousBuild = null;
let heroCount = 0;
const resolvedLines = lines.map((line, index) => {
  const role = line.role ?? 'verse';
  const importance = Number(line.importance ?? 3);
  const override = line.effectPlan ?? {};
  const isHero = importance === 5 && heroCount < effectManifest.selectionRules.maxHeroLinesPer30Seconds;
  if (isHero) heroCount += 1;
  const build = override.build ?? effectFor('build', profile, role, previousBuild, importance);
  previousBuild = build ?? previousBuild;
  const breathe = override.breathe ?? effectFor('breathe', profile, role, null, importance);
  const resolve = override.resolve ?? effectFor('resolve', profile, role, null, importance);
  const transition = override.transition ?? (isHero ? effectFor('transition', profile, role, null, importance) : null);
  const overlay = override.overlay ?? (isHero ? effectFor('overlay', profile, role, null, importance) : 'grain-plate');
  return {index, start:line.start, end:line.end, role, importance, hero:isHero, build, breathe, resolve, transition, overlay};
});

const result = {
  schemaVersion: 1,
  sourceTimeline: resolve(timelinePath),
  sourceSongProfile: songProfilePath ? resolve(songProfilePath) : null,
  seed: seedText,
  preview,
  profile,
  musicProfile: timeline.musicProfile ?? songProfile?.musicProfile ?? null,
  fontPlan: fontPlan(profile),
  background: timeline.backgroundPlan ?? preferredBackground(profile)?.id ?? null,
  template: timeline.template ?? profileTemplates[profile] ?? 'rap-adaptive-collage',
  constraints: effectManifest.selectionRules,
  lines: resolvedLines
};
mkdirSync(dirname(resolve(outputPath)), {recursive:true});
writeFileSync(resolve(outputPath), JSON.stringify(result, null, 2));
console.log(`Resolved ${result.lines.length} lyric lines with seed ${seedText} → ${resolve(outputPath)}`);
