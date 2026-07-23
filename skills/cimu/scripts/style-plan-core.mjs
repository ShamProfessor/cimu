export const EFFECT_PHASES = ['build', 'breathe', 'resolve', 'transition', 'overlay'];

export const SCENE_ENGINES = {
  'editorial-depth': {
    profiles: ['rap-editorial', 'code-collision'],
    description: 'Layered editorial art plates, deep cards, and hard camera thrust.'
  },
  'heritage-print': {
    profiles: ['macau-heritage'],
    description: 'Warm heritage print material, stamped geometry, and restrained depth.'
  },
  'street-photocopy': {
    profiles: ['night-market-copy', 'concrete-anthem', 'gangster-flash'],
    description: 'Photocopy texture, street registration marks, and dense graphic travel.'
  },
  'live-stage': {
    profiles: ['rock-arena'],
    description: 'Dark live-stage depth, backlight beams, smoke texture, and amp silhouettes.'
  },
  'indie-night': {
    profiles: ['rock-indie-melancholy'],
    description: 'Wet night-drive material, quiet depth, and low-frequency camera drift.'
  },
  'memory-light': {
    profiles: ['pop-memory-release', 'ballad-editorial'],
    description: 'Warm memory-light space, soft frames, and slow cinematic depth.'
  },
  'folk-paper': {
    profiles: ['folk-letterpress'],
    description: 'Paper grain, landscape silhouettes, sun forms, and literary pacing.'
  },
  'city-route': {
    profiles: ['folk-city-walk'],
    description: 'Muted city field, route trace, window lights, and walking-speed parallax.'
  }
};

export const WEBGL_TEMPLATE_IDS = [
  'webgl-hiphop-hook',
  'webgl-hiphop-editorial',
  'webgl-lyric-stage',
  'webgl-folk-lyric-stage',
  'webgl-pop-memory-stage',
  'webgl-rock-stage',
  'webgl-rock-indie-stage'
];

export const WEBGL_SUPPORTED_EFFECTS = [
  'velocity-slam',
  'flash-slam',
  'stamp-spin',
  'scatter-assemble',
  'clip-wipe',
  'ink-slide',
  'weight-swell',
  'halo-pulse',
  'ghost-drift',
  'float-wind',
  'paper-rip',
  'chromatic-whip',
  'scatter-drop',
  'ink-swallow',
  'iris-burn',
  'focus-pull',
  'grain-plate',
  'flashbulb-field',
  'electric-field',
  'ember-field'
];

export function sceneEngineForProfile(profile) {
  return Object.entries(SCENE_ENGINES).find(([, definition]) => definition.profiles.includes(profile))?.[0] ?? 'editorial-depth';
}

export function normalizeStyleIntent(timeline = {}) {
  const source = timeline.styleIntent ?? timeline.userIntent ?? {};
  const list = (value) => [...new Set((Array.isArray(value) ? value : []).map(String).filter(Boolean))];
  const rawIntensity = Number(source.animationIntensity);
  const rawBackgroundMode = source.backgroundMode === undefined ? 'auto' : String(source.backgroundMode).trim().toLowerCase();
  if (!['auto', 'black', 'provided'].includes(rawBackgroundMode)) throw new Error('styleIntent.backgroundMode must be auto, black, or provided.');
  return {
    description: typeof source.description === 'string' ? source.description.trim() : null,
    animationIntensity: Number.isFinite(rawIntensity) ? Math.max(1, Math.min(5, Math.round(rawIntensity))) : null,
    preferredEffects: list(source.preferredEffects),
    excludedEffects: list(source.excludedEffects),
    palette: Array.isArray(source.palette) ? source.palette.map(String).slice(0, 6) : null,
    sceneEngine: source.sceneEngine ? String(source.sceneEngine) : null,
    backgroundMode: rawBackgroundMode
  };
}

function sectionRole(line) {
  if (line?.role === 'hook') return 'chorus';
  if (line?.role === 'release') return 'outro';
  return 'verse';
}

function defaultSectionIntensity(role) {
  return role === 'chorus' ? 5 : role === 'outro' ? 2 : 3;
}

export function resolveSections(timeline, {sceneEngine, background, transitionFor, engineForBackground} = {}) {
  const lines = timeline.lines ?? timeline.lyrics ?? [];
  const duration = Number(timeline.durationSeconds);
  const explicit = Array.isArray(timeline.sections) && timeline.sections.length ? timeline.sections : null;
  if (explicit) {
    return explicit.map((section, index) => {
      const role = section.role ?? `section-${index + 1}`;
      return {
        id: section.id ?? `section-${index + 1}`,
        start: Number(section.start),
        end: Number(section.end),
        role,
        sceneEngine: section.sceneEngine ?? engineForBackground?.(section.background) ?? sceneEngine,
        background: section.background ?? background,
        intensity: Number.isFinite(Number(section.intensity)) ? Math.max(1, Math.min(5, Math.round(Number(section.intensity)))) : defaultSectionIntensity(role),
        transition: section.transition ?? transitionFor?.(role) ?? null,
        effectPlan: section.effectPlan ?? {},
        source: 'explicit'
      };
    });
  }

  if (!lines.length) return [];
  const sections = [];
  for (const line of lines) {
    const role = sectionRole(line);
    const previous = sections.at(-1);
    if (!previous || previous.role !== role) {
      sections.push({
        id: `${role}-${sections.length + 1}`,
        start: Number(line.start),
        end: Number(line.end),
        role,
        sceneEngine,
        background,
        intensity: defaultSectionIntensity(role),
        transition: transitionFor?.(role) ?? null,
        effectPlan: {},
        source: 'inferred'
      });
    } else {
      previous.end = Number(line.end);
    }
  }
  if (Number.isFinite(duration) && sections.length) sections.at(-1).end = Math.min(duration, Math.max(sections.at(-1).end, Number(lines.at(-1)?.end)));
  return sections;
}

export function sectionForLine(sections, line) {
  const midpoint = (Number(line.start) + Number(line.end)) / 2;
  return sections.find((section) => midpoint >= section.start && midpoint < section.end)
    ?? sections.find((section) => Number(line.start) >= section.start && Number(line.start) < section.end)
    ?? null;
}

export function validateStylePlan(plan, {timeline = null, effectManifest, backgroundManifest} = {}) {
  const errors = [];
  const warnings = [];
  const effects = effectManifest?.effects ?? [];
  const effectById = new Map(effects.map((effect) => [effect.id, effect]));
  const declaredEffects = new Set(plan.capabilityContract?.supportedEffects ?? []);
  const supportedEffects = new Set(WEBGL_SUPPORTED_EFFECTS);
  const duration = Number(timeline?.durationSeconds ?? plan.durationSeconds);
  const excluded = new Set(plan.userIntent?.excludedEffects ?? []);

  if (plan.schemaVersion !== 2) errors.push({code:'style-plan-schema', expected:2, actual:plan.schemaVersion ?? null});
  if (!WEBGL_TEMPLATE_IDS.includes(plan.template)) errors.push({code:'unsupported-template', template:plan.template ?? null, message:'Delivery StylePlans must use the capability-checked WebGL stage.'});
  if (!SCENE_ENGINES[plan.sceneEngine]) errors.push({code:'unknown-scene-engine', sceneEngine:plan.sceneEngine ?? null});
  if (!['auto', 'black', 'provided'].includes(plan.backgroundMode ?? 'auto')) errors.push({code:'invalid-background-mode', backgroundMode:plan.backgroundMode ?? null});
  if (plan.backgroundMode === 'provided' && !plan.backgroundImage) errors.push({code:'missing-provided-background'});
  if (plan.sceneEngine && plan.profile && !SCENE_ENGINES[plan.sceneEngine]?.profiles.includes(plan.profile) && !plan.userIntent?.sceneEngine) {
    warnings.push({code:'profile-scene-mismatch', profile:plan.profile, sceneEngine:plan.sceneEngine});
  }
  if (!Array.isArray(plan.sections) || !plan.sections.length) errors.push({code:'missing-sections'});
  if (!Array.isArray(plan.lines) || !plan.lines.length) errors.push({code:'missing-style-lines'});
  for (const color of plan.userIntent?.palette ?? []) if (!/^#[0-9a-f]{6}$/i.test(String(color))) errors.push({code:'invalid-palette-color', color});
  for (const id of [...(plan.userIntent?.preferredEffects ?? []), ...(plan.userIntent?.excludedEffects ?? [])]) {
    if (!effectById.has(id)) errors.push({code:'unknown-user-effect', effect:id});
  }

  let previousSectionEnd = 0;
  for (const [index, section] of (plan.sections ?? []).entries()) {
    if (!Number.isFinite(Number(section.start)) || !Number.isFinite(Number(section.end)) || Number(section.end) <= Number(section.start)) {
      errors.push({code:'invalid-section-range', section:index});
    }
    if (Number(section.start) < previousSectionEnd - .001) errors.push({code:'section-overlap', section:index});
    if (Number.isFinite(duration) && Number(section.end) > duration + .001) errors.push({code:'section-outside-duration', section:index});
    if (!SCENE_ENGINES[section.sceneEngine]) errors.push({code:'unknown-section-scene-engine', section:index, sceneEngine:section.sceneEngine ?? null});
    const sectionEffects = {...(section.effectPlan ?? {}), ...(section.transition ? {transition:section.transition} : {})};
    for (const [phase, id] of Object.entries(sectionEffects)) {
      if (!EFFECT_PHASES.includes(phase)) { errors.push({code:'unknown-section-effect-phase', section:index, phase}); continue; }
      const definition = effectById.get(id);
      if (!definition) errors.push({code:'unknown-section-effect', section:index, phase, effect:id});
      else if (definition.phase !== phase) errors.push({code:'section-effect-phase-mismatch', section:index, phase, effect:id, actualPhase:definition.phase});
      if (id && !supportedEffects.has(id)) errors.push({code:'unsupported-section-effect', section:index, phase, effect:id});
      if (excluded.has(id)) errors.push({code:'excluded-section-effect', section:index, phase, effect:id});
    }
    previousSectionEnd = Math.max(previousSectionEnd, Number(section.end) || 0);
  }

  for (const line of plan.lines ?? []) {
    if (!plan.sections?.some((section) => section.id === line.sectionId)) errors.push({code:'unknown-line-section', line:line.index, sectionId:line.sectionId ?? null});
    for (const phase of EFFECT_PHASES) {
      const id = line[phase];
      if (!id) continue;
      const definition = effectById.get(id);
      if (!definition) {
        errors.push({code:'unknown-effect', line:line.index, phase, effect:id});
        continue;
      }
      if (definition.phase !== phase) errors.push({code:'effect-phase-mismatch', line:line.index, phase, effect:id, actualPhase:definition.phase});
      if (!supportedEffects.has(id)) errors.push({code:'unsupported-effect', line:line.index, phase, effect:id, template:plan.template});
      if (excluded.has(id)) errors.push({code:'excluded-effect-selected', line:line.index, phase, effect:id});
    }
  }

  const readyBackgrounds = new Map((backgroundManifest?.backgrounds ?? []).filter((item) => item.status === 'ready').map((item) => [item.id, item]));
  for (const background of new Set([plan.background, ...(plan.sections ?? []).map((section) => section.background)].filter(Boolean))) {
    if (!readyBackgrounds.has(background)) errors.push({code:'background-not-ready', background});
  }
  for (const [index, section] of (plan.sections ?? []).entries()) {
    const definition = readyBackgrounds.get(section.background);
    if (definition?.sceneEngine && definition.sceneEngine !== section.sceneEngine) {
      errors.push({code:'background-scene-mismatch', section:index, background:section.background, expectedSceneEngine:definition.sceneEngine, actualSceneEngine:section.sceneEngine});
    }
  }

  const manifestEffectIds = effects.map((effect) => effect.id);
  for (const id of declaredEffects) if (!supportedEffects.has(id)) errors.push({code:'false-capability-claim', effect:id});
  for (const id of supportedEffects) if (!declaredEffects.has(id)) errors.push({code:'missing-capability-declaration', effect:id});
  for (const id of supportedEffects) if (!effectById.has(id)) errors.push({code:'renderer-effect-not-in-manifest', effect:id});
  for (const id of manifestEffectIds) if (!supportedEffects.has(id)) warnings.push({code:'manifest-effect-not-supported', effect:id});

  return {schemaVersion:1, errors, warnings, passed:errors.length === 0};
}
