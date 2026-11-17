// Procedural WebAudio: engine hum, siren, gunshots, pickup blips, mission jingle.
// No audio files; everything is synthesized from oscillators and noise.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch {
      return false;
    }
    return true;
  }
  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const o = ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(ctx.currentTime + dur);
    } catch { /* audio is best-effort */ }
  }
  function noise(dur, vol, lowpass) {
    if (!ensure() || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = lowpass || 1200;
      const g = ctx.createGain();
      g.gain.value = vol || 0.25;
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
    } catch { /* audio is best-effort */ }
  }
  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.35;
    },
    engine(speed01, on) {
      if (!ensure() || muted) return;
      try {
        engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.05);
        engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.05 : 0, ctx.currentTime, 0.08);
      } catch { /* ignore */ }
    },
    siren(on, t) {
      if (!ensure() || muted) return;
      try {
        sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, ctx.currentTime, 0.1);
        if (on) sirenOsc.frequency.setTargetAtTime(650 + Math.sin(t * 4) * 220, ctx.currentTime, 0.05);
      } catch { /* ignore */ }
    },
    shot() { noise(0.12, 0.3, 2400); },
    punch() { noise(0.08, 0.2, 700); },
    pickup() { blip(660, 0.12, 'sine', 0.2, 990); },
    crash() { noise(0.25, 0.3, 500); },
    jingle() { blip(523, 0.12, 'triangle', 0.22); setTimeout(() => blip(659, 0.12, 'triangle', 0.22), 110); setTimeout(() => blip(784, 0.2, 'triangle', 0.22), 220); },
    busted() { blip(220, 0.4, 'sawtooth', 0.2, 110); },
    fail() { blip(330, 0.25, 'sawtooth', 0.18, 165); },
  };
}
