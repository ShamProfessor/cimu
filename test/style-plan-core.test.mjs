import assert from 'node:assert/strict';
import {
  SCENE_ENGINES,
  WEBGL_SUPPORTED_EFFECTS,
  resolveSections,
  sceneEngineForProfile,
  validateStylePlan
} from '../skills/cimu/scripts/style-plan-core.mjs';

assert.equal(Object.keys(SCENE_ENGINES).length, 8);
assert.equal(sceneEngineForProfile('rap-editorial'), 'editorial-depth');
assert.equal(sceneEngineForProfile('macau-heritage'), 'heritage-print');
assert.equal(sceneEngineForProfile('concrete-anthem'), 'street-photocopy');
assert.equal(sceneEngineForProfile('rock-arena'), 'live-stage');
assert.equal(sceneEngineForProfile('rock-indie-melancholy'), 'indie-night');
assert.equal(sceneEngineForProfile('pop-memory-release'), 'memory-light');
assert.equal(sceneEngineForProfile('folk-letterpress'), 'folk-paper');
assert.equal(sceneEngineForProfile('folk-city-walk'), 'city-route');

const timeline = {
  durationSeconds: 8,
  lines: [
    {start:0,end:2,role:'verse'},
    {start:2,end:4,role:'hook'},
    {start:4,end:6,role:'hook'},
    {start:6,end:8,role:'release'}
  ]
};
const sections = resolveSections(timeline, {sceneEngine:'editorial-depth', background:'ready-background'});
assert.deepEqual(sections.map((section) => section.role), ['verse', 'chorus', 'outro']);
assert.deepEqual(sections.map((section) => [section.start, section.end]), [[0,2],[2,6],[6,8]]);

const phaseFor = (id) => ['velocity-slam','flash-slam','stamp-spin','scatter-assemble','clip-wipe','ink-slide'].includes(id) ? 'build'
  : ['weight-swell','halo-pulse','ghost-drift','float-wind'].includes(id) ? 'breathe'
    : ['paper-rip','chromatic-whip','scatter-drop','ink-swallow'].includes(id) ? 'resolve'
      : ['iris-burn','focus-pull'].includes(id) ? 'transition'
        : 'overlay';
const effectManifest = {effects:WEBGL_SUPPORTED_EFFECTS.map((id) => ({id, phase:phaseFor(id)}))};
const backgroundManifest = {backgrounds:[
  {id:'ready-background', status:'ready'}
]};
const plan = {
  schemaVersion:2,
  durationSeconds:8,
  profile:'rap-editorial',
  template:'webgl-lyric-stage',
  sceneEngine:'editorial-depth',
  background:'ready-background',
  userIntent:{excludedEffects:[]},
  capabilityContract:{supportedEffects:WEBGL_SUPPORTED_EFFECTS},
  sections,
  lines:[
    {index:0,sectionId:sections[0].id,build:'clip-wipe',overlay:'grain-plate'}
  ]
};
assert.equal(validateStylePlan(plan, {timeline, effectManifest, backgroundManifest}).passed, true);

const invalid = structuredClone(plan);
invalid.lines[0].build = 'not-implemented';
assert.ok(validateStylePlan(invalid, {timeline, effectManifest, backgroundManifest}).errors.some((error) => error.code === 'unknown-effect'));

const excluded = structuredClone(plan);
excluded.userIntent.excludedEffects = ['clip-wipe'];
assert.ok(validateStylePlan(excluded, {timeline, effectManifest, backgroundManifest}).errors.some((error) => error.code === 'excluded-effect-selected'));

const invalidPalette = structuredClone(plan);
invalidPalette.userIntent.palette = ['red'];
assert.ok(validateStylePlan(invalidPalette, {timeline, effectManifest, backgroundManifest}).errors.some((error) => error.code === 'invalid-palette-color'));

console.log('style-plan-core tests passed');
