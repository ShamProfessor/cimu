(() => {
  function renderTransition(effectPlan = {}, api) {
    const {q, H, p, rect, circle, easeIn} = api;
    if (effectPlan.transition === 'iris-burn') {
      const burn = easeIn(q);
      circle(960, H * .5, 80 + burn * 1180, p.accent, burn * .42);
      circle(960, H * .5, 32 + burn * 820, p.paper, burn * .16);
      rect(0, H * .48, 1920, 14 + burn * 100, p.sub, burn * .72, -.02);
    }
    if (effectPlan.transition === 'focus-pull') {
      const pull = easeIn(q);
      circle(960, H * .50, 150 + pull * 1320, p.paper, pull * .055);
      rect(0, 0, 1920, H, p.ink, pull * .20);
      rect(0, H * .17, 1920, 2 + pull * 16, p.paper, pull * .32);
    }
  }
  function renderResolve(effectPlan = {}, api) {
    const {q, H, p, image, rect, circle, easeIn} = api;
    if (effectPlan.resolve === 'paper-rip') image('rip', -60 + q * 980, H * (0.18 + q * 0.15), 1040, 180, 0.95 * q, -0.03);
    if (effectPlan.resolve === 'scatter-drop') rect(0, H * (0.24 + q * 0.42), 1920, 36 + q * 90, p.accent, q * 0.70, -0.035);
    if (effectPlan.resolve === 'ink-swallow') circle(960, H * 0.52, 80 + q * 1240, p.ink, q * 0.78);
    if (effectPlan.resolve === 'chromatic-whip') {
      rect(-120 + q * 2080, 0, 190, H, p.accent, q * 0.92, -0.04);
      rect(120 - q * 2080, 0, 82, H, p.sub, q * 0.78, 0.04);
    }
    rect(0, 0, 1920, H, p.ink, easeIn(q) * 0.38);
  }
  window.MVLyricEffects = window.MVLyricEffects || {};
  window.MVLyricEffects.renderTransition = renderTransition;
  window.MVLyricEffects.renderResolve = renderResolve;
})();
