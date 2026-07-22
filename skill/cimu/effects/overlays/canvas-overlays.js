(() => {
  function drawOverlay(effectPlan = {}, api) {
    const {ctx, H, p, time, hash, rect, circle, audio, line} = api;
    if (effectPlan.overlay === 'grain-plate') {
      for (let i = 0; i < 620; i += 1) {
        const x = hash(i) * 1920, y = hash(i * 7.2) * H, size = 1 + hash(i * 13) * 2.5;
        rect(x, y, size, size, i % 6 ? p.paper : p.accent, 0.035 + hash(i * 9) * 0.07);
      }
    }
    if (effectPlan.overlay === 'electric-field') {
      ctx.save(); ctx.globalAlpha = 0.22 + audio.treble * 0.2; ctx.strokeStyle = p.accent; ctx.lineWidth = 5; ctx.beginPath();
      for (let x = -80; x <= 2000; x += 80) { const y = H * 0.24 + Math.sin(x * 0.012 + time * 6) * (38 + audio.bass * 58); x === -80 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.stroke(); ctx.restore();
    }
    if (effectPlan.overlay === 'ember-field') {
      for (let i = 0; i < 36; i += 1) { const x = hash(i * 9) * 1920, y = (hash(i * 17) * H + time * (20 + hash(i) * 48)) % H; circle(x, y, 2 + hash(i * 4) * 6, p.accent, 0.15 + audio.rms * 0.25); }
    }
    if (effectPlan.overlay === 'flashbulb-field') {
      const age = Math.max(0, time - (line?.start ?? time));
      const hit = Math.exp(-age * 15) * (0.38 + audio.treble * 0.32);
      rect(0, 0, 1920, H, p.paper, hit * 0.50);
      circle(315 + hash((line?.index ?? 0) * 4) * 1120, H * (0.22 + hash((line?.index ?? 0) * 8) * 0.42), 180 + hit * 460, p.paper, hit * 0.23);
      rect(0, H * 0.18, 1920, 9, p.accent, hit * 0.76, -0.025);
      rect(1650, 72, 118, 14, p.paper, 0.38 + hit * 0.4, 0);
      rect(1696, 40, 14, 78, p.paper, 0.38 + hit * 0.4, 0);
    }
  }
  window.MVLyricEffects = window.MVLyricEffects || {};
  window.MVLyricEffects.drawOverlay = drawOverlay;
})();
