#!/usr/bin/env node
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {
  EFFECT_PHASES,
  SCENE_ENGINES,
  WEBGL_TEMPLATE_IDS,
  WEBGL_SUPPORTED_EFFECTS,
  normalizeStyleIntent,
  resolveSections,
  sceneEngineForProfile,
  sectionForLine,
  validateStylePlan
} from './style-plan-core.mjs';

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
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}
function mulberry32(seed) {
  return () => {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
const random = mulberry32(hash(seedText));
const choose = (items) => items[Math.floor(random() * items.length)];
const includes = (value, list) => list.includes(value) || list.includes('all');

const profileRules = {
  'rap-editorial': {prefer:['velocity-slam','scatter-assemble','scatter-drop','grain-plate'], block:['electric-field','iris-burn','float-wind']},
  'code-collision': {prefer:['velocity-slam','scatter-assemble','chromatic-whip','electric-field'], block:['float-wind','ink-swallow']},
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

function tagsFor(profile) {
  const tags = {
    'rap-editorial': ['rap', 'street', 'raw', 'analog', 'high-energy'],
    'code-collision': ['rap', 'street', 'raw', 'analog', 'high-energy', 'digital', 'electronic'],
    'macau-heritage': ['rap', 'heritage', 'street', 'analog'],
    'night-market-copy': ['rap', 'street', 'raw', 'warm'],
    'concrete-anthem': ['rap', 'raw', 'industrial', 'high-energy'],
    'gangster-flash': ['rap', 'street', 'raw', 'impact', 'high-energy', 'night'],
    'rock-arena': ['rock', 'raw', 'impact', 'high-energy', 'night', 'street'],
    'rock-indie-melancholy': ['rock', 'folk', 'raw', 'night'],
    'pop-memory-release': ['pop', 'ballad', 'warm', 'melodic'],
    'folk-letterpress': ['folk', 'ballad', 'warm', 'organic', 'heritage'],
    'folk-city-walk': ['folk', 'ballad', 'warm', 'city', 'night', 'heritage'],
    'ballad-editorial': ['ballad', 'folk', 'pop', 'warm', 'heritage']
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
  if (timeline.fontPlan) return {...timeline.fontPlan, previewOnly:false};
  const plan = routing[profile] ?? routing['concrete-anthem'];
  const allowed = (id) => preview || fontManifest.fonts.find((font) => font.id === id)?.licenseStatus === 'recorded';
  const primaryCandidates = plan.primary.filter(allowed);
  const emphasisCandidates = plan.emphasis.filter(allowed);
  const primary = primaryCandidates.length ? choose(primaryCandidates) : null;
  const emphasis = emphasisCandidates.length ? choose(emphasisCandidates) : null;
  const needsRecord = [primary, emphasis].filter(Boolean).some((id) => fontManifest.fonts.find((font) => font.id === id)?.licenseStatus !== 'recorded');
  return {primary, emphasis, previewOnly:!primary || needsRecord};
}

function preferredBackground(profile, engine) {
  const engineCandidates = backgroundManifest.backgrounds.filter((background) => background.status === 'ready' && background.sceneEngine === engine);
  const profileCandidates = engineCandidates.filter((background) => background.profiles.includes(profile));
  return profileCandidates.length ? choose(profileCandidates) : engineCandidates.length ? choose(engineCandidates) : null;
}

const profile = timeline.visualProfile ?? songProfile?.visualProfile ?? (timeline.musicProfile?.genre?.includes('ballad') ? 'ballad-editorial' : 'concrete-anthem');
const lines = timeline.lines ?? timeline.lyrics ?? [];
const userIntent = normalizeStyleIntent(timeline);
const sceneEngine = userIntent.sceneEngine ?? sceneEngineForProfile(profile);
const background = timeline.backgroundPlan ?? preferredBackground(profile, sceneEngine)?.id ?? null;
const template = timeline.template ?? 'webgl-lyric-stage';
const rule = profileRules[profile] ?? {prefer:[], block:[]};
const excludedEffects = new Set([...rule.block, ...userIntent.excludedEffects]);
const preferredEffects = new Set([...userIntent.preferredEffects, ...rule.prefer]);
const effectById = new Map(effectManifest.effects.map((effect) => [effect.id, effect]));

for (const id of [...userIntent.preferredEffects, ...userIntent.excludedEffects]) {
  if (!effectById.has(id)) throw new Error(`Unknown user-requested effect: ${id}`);
}
if (!WEBGL_TEMPLATE_IDS.includes(template)) throw new Error(`Template ${template} is not capability-checked for delivery.`);

function compatible(effect, phase, role) {
  return effect.phase === phase
    && includes(role, effect.roles)
    && effect.tags.some((tag) => tagsFor(profile).includes(tag))
    && !excludedEffects.has(effect.id);
}

function effectFor(phase, role, previousBuild, importance, intensityOverride = null) {
  const maximumIntensity = userIntent.animationIntensity ?? intensityOverride ?? (importance === 5 ? 5 : 3);
  const options = effectManifest.effects
    .filter((effect) => compatible(effect, phase, role))
    .filter((effect) => phase !== 'build' || effect.id !== previousBuild)
    .filter((effect) => effect.intensity <= maximumIntensity);
  const preferred = options.filter((effect) => preferredEffects.has(effect.id));
  return (preferred.length ? choose(preferred) : options.length ? choose(options) : null)?.id ?? null;
}

const sections = resolveSections(timeline, {
  sceneEngine,
  background,
  engineForBackground: (id) => backgroundManifest.backgrounds.find((entry) => entry.id === id)?.sceneEngine ?? null,
  transitionFor: (role) => role === 'chorus'
    ? effectFor('transition', 'hook', null, 5, 5)
    : role === 'verse'
      ? effectFor('transition', 'verse', null, 3, 2)
      : null
});

let previousBuild = null;
const heroCounts = new Map();
const resolvedLines = lines.map((line, index) => {
  const role = line.role ?? 'verse';
  const importance = Number(line.importance ?? 3);
  const section = sectionForLine(sections, line);
  const sectionOverride = Object.fromEntries(Object.entries(section?.effectPlan ?? {}).filter(([phase]) => phase !== 'transition'));
  const lineOverride = line.effectPlan ?? {};
  const override = {...sectionOverride, ...lineOverride};
  for (const phase of EFFECT_PHASES) {
    if (override[phase] && !effectById.has(override[phase])) throw new Error(`Line ${index} requests unknown ${phase} effect: ${override[phase]}`);
    if (override[phase] && effectById.get(override[phase]).phase !== phase) throw new Error(`Line ${index} uses ${override[phase]} in the wrong phase (${phase}).`);
    if (override[phase] && excludedEffects.has(override[phase])) throw new Error(`Line ${index} requests excluded effect: ${override[phase]}`);
  }
  const bucket = Math.floor(Number(line.start ?? 0) / 30);
  const heroCount = heroCounts.get(bucket) ?? 0;
  const isHero = importance === 5 && heroCount < effectManifest.selectionRules.maxHeroLinesPer30Seconds;
  if (isHero) heroCounts.set(bucket, heroCount + 1);
  const build = override.build ?? effectFor('build', role, previousBuild, importance, section?.intensity);
  previousBuild = build ?? previousBuild;
  const breathe = override.breathe ?? effectFor('breathe', role, null, importance, section?.intensity);
  const resolveEffect = override.resolve ?? effectFor('resolve', role, null, importance, section?.intensity);
  const isSectionOpening = section && index === lines.findIndex((candidate) => sectionForLine(sections, candidate)?.id === section.id);
  const transition = lineOverride.transition ?? (isSectionOpening ? section.transition : null);
  const overlay = override.overlay ?? (isHero ? effectFor('overlay', role, null, importance, section?.intensity) : 'grain-plate');
  return {
    index,
    start:line.start,
    end:line.end,
    sectionId:section?.id ?? null,
    role,
    importance,
    hero:isHero,
    build,
    breathe,
    resolve:resolveEffect,
    transition,
    overlay
  };
});

const result = {
  schemaVersion:2,
  sourceTimeline:resolve(timelinePath),
  sourceSongProfile:songProfilePath ? resolve(songProfilePath) : null,
  durationSeconds:Number(timeline.durationSeconds),
  seed:seedText,
  preview,
  profile,
  userIntent,
  resolvedStyle:{
    sceneEngine,
    animationIntensity:userIntent.animationIntensity ?? 3,
    palette:userIntent.palette,
    deterministic:true
  },
  musicProfile:timeline.musicProfile ?? songProfile?.musicProfile ?? null,
  fontPlan:fontPlan(profile),
  background,
  template,
  sceneEngine,
  sections,
  constraints:effectManifest.selectionRules,
  capabilityContract:{
    version:1,
    template,
    sceneEngines:Object.keys(SCENE_ENGINES),
    supportedEffects:WEBGL_SUPPORTED_EFFECTS
  },
  lines:resolvedLines
};

const report = validateStylePlan(result, {timeline, effectManifest, backgroundManifest});
if (!report.passed) throw new Error(`Resolved StylePlan is invalid: ${JSON.stringify(report.errors)}`);

mkdirSync(dirname(resolve(outputPath)), {recursive:true});
writeFileSync(resolve(outputPath), JSON.stringify(result, null, 2));
console.log(`Resolved ${result.lines.length} lyric lines across ${result.sections.length} sections with seed ${seedText} → ${resolve(outputPath)}`);
