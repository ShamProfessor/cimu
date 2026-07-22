(() => {
  function phraseMotion(effectPlan = {}, enter, audio, direction) {
    const build = effectPlan.build;
    const breathe = effectPlan.breathe;
    const distance = build === 'scatter-assemble' ? 640 : build === 'ink-slide' ? 210 : build === 'flash-slam' ? 720 : build === 'velocity-slam' ? 800 : 310;
    const rotation = build === 'stamp-spin' ? (1 - enter) * direction * 0.82 : build === 'flash-slam' ? (1 - enter) * direction * 0.10 : 0;
    const breatheScale = breathe === 'weight-swell' ? audio.bass * 0.065 : breathe === 'halo-pulse' ? audio.treble * 0.052 : 0;
    const glow = breathe === 'halo-pulse' ? 14 + audio.treble * 38 : build === 'flash-slam' ? 18 : 2;
    return {
      distance,
      rotation,
      breatheScale,
      glow,
      flash: build === 'flash-slam' ? Math.pow(1 - enter, 1.8) : 0,
      scatter: build === 'scatter-assemble' ? 1 - enter : 0,
      split: build === 'flash-slam' || build === 'velocity-slam' ? 1 - enter : 0,
      ghostOffsetY: breathe === 'ghost-drift' ? 17 : 0
    };
  }
  window.MVLyricEffects = window.MVLyricEffects || {};
  window.MVLyricEffects.phraseMotion = phraseMotion;
})();
