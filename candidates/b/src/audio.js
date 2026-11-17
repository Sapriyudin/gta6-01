// Procedural WebAudio only — no audio files. Engine hum follows the car's speed, the siren is a
// two-tone wail while any cop chases, gunshots are filtered noise bursts, pickups and mission
// events are short synth blips. Created lazily on the first user gesture.

export function createAudio() {
  let ctx = null, master = null, engineOsc = null, engineGain = null;
  let sirenOsc = null, sirenGain = null, sirenTimer = 0, muted = false;

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
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 420;
      engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch { return false; }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch { /* ignore */ }
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    try {
      const t = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = filterFreq || 1800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t);
    } catch { /* ignore */ }
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.35; return muted; },
    engine(speedNorm, driving) {
      if (!ensure() || muted) return;
      engineGain.gain.setTargetAtTime(driving ? 0.05 + 0.09 * speedNorm : 0, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + 130 * speedNorm, ctx.currentTime, 0.08);
    },
    siren(active, dt) {
      if (!ensure()) return;
      if (!active || muted) { sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1); return; }
      sirenTimer += dt;
      sirenOsc.frequency.setTargetAtTime((Math.floor(sirenTimer * 2.4) % 2 === 0) ? 660 : 880, ctx.currentTime, 0.05);
      sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.1);
    },
    shot() { noise(0.14, 0.4, 2400); },
    punch() { noise(0.08, 0.25, 900); },
    crash() { noise(0.25, 0.35, 700); },
    pickup() { blip(660, 0.12, 'sine', 0.22, 990); },
    coin() { blip(880, 0.1, 'triangle', 0.18, 1320); },
    jingle() {
      blip(523, 0.14, 'triangle', 0.22);
      setTimeout(() => blip(659, 0.14, 'triangle', 0.22), 130);
      setTimeout(() => blip(784, 0.24, 'triangle', 0.24), 260);
    },
    fail() { blip(220, 0.35, 'sawtooth', 0.16, 110); },
    bust() { blip(440, 0.3, 'square', 0.12, 220); },
  };
}
