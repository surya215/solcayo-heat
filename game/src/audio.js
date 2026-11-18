// All sound is synthesized with WebAudio — no audio files. Engine hum, sirens,
// gunshots, pickups and a laid-back sunset bassline are built from oscillators
// and filtered noise. Audio only starts after the player's first gesture.
export function createAudio() {
  const api = { muted: false, ready: false, ctx: null };
  let engineOsc = null;
  let engineGain = null;
  let musicTimer = null;
  let sirenOsc = null;
  let sirenGain = null;

  function ensure() {
    if (api.ctx) return true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      api.ctx = new Ctx();
      api.ready = true;
      startEngine();
      startMusic();
      return true;
    } catch {
      return false;
    }
  }

  function startEngine() {
    engineOsc = api.ctx.createOscillator();
    engineGain = api.ctx.createGain();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 50;
    const filter = api.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    engineGain.gain.value = 0;
    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(api.ctx.destination);
    engineOsc.start();
  }

  function startMusic() {
    // A slow Am–F–C–G bassline with a soft pluck on top, one bar every 2 s.
    const roots = [110, 87.31, 130.81, 98];
    let bar = 0;
    musicTimer = setInterval(() => {
      if (!api.ctx || api.muted) return;
      const t = api.ctx.currentTime;
      const root = roots[bar % roots.length];
      bar += 1;
      pluck(root / 2, t, 1.8, 0.05);
      pluck(root, t + 0.5, 0.5, 0.04);
      pluck(root * 1.5, t + 1.0, 0.5, 0.035);
      pluck(root * 2, t + 1.5, 0.4, 0.03);
    }, 2000);
    void musicTimer;
  }

  function pluck(freq, t, dur, vol) {
    const osc = api.ctx.createOscillator();
    const g = api.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(api.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noiseBurst(dur, vol, freq) {
    const len = Math.floor(api.ctx.sampleRate * dur);
    const buf = api.ctx.createBuffer(1, len, api.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = api.ctx.createBufferSource();
    src.buffer = buf;
    const filter = api.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const g = api.ctx.createGain();
    g.gain.value = vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(api.ctx.destination);
    src.start();
  }

  function tone(freq, dur, vol, type = 'sine') {
    const osc = api.ctx.createOscillator();
    const g = api.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, api.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, api.ctx.currentTime + dur);
    osc.connect(g);
    g.connect(api.ctx.destination);
    osc.start();
    osc.stop(api.ctx.currentTime + dur + 0.02);
  }

  api.unlock = function unlock() {
    if (ensure() && api.ctx.state === 'suspended') api.ctx.resume().catch(() => {});
  };

  api.setEngine = function setEngine(speedNorm, driving) {
    if (!api.ctx || !engineOsc) return;
    const target = api.muted ? 0 : driving ? 0.05 + speedNorm * 0.06 : 0.015;
    engineGain.gain.setTargetAtTime(target, api.ctx.currentTime, 0.1);
    engineOsc.frequency.setTargetAtTime(46 + speedNorm * 120, api.ctx.currentTime, 0.1);
  };

  api.setSiren = function setSiren(on) {
    if (!api.ctx) return;
    if (on && !sirenOsc) {
      sirenOsc = api.ctx.createOscillator();
      sirenGain = api.ctx.createGain();
      sirenOsc.type = 'triangle';
      sirenGain.gain.value = api.muted ? 0 : 0.02;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(api.ctx.destination);
      sirenOsc.start();
      const lfo = api.ctx.createOscillator();
      const lfoGain = api.ctx.createGain();
      lfo.frequency.value = 0.9;
      lfoGain.gain.value = 220;
      lfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenOsc.frequency.value = 760;
      lfo.start();
      sirenOsc._lfo = lfo;
    } else if (!on && sirenOsc) {
      try { sirenOsc._lfo.stop(); sirenOsc.stop(); } catch { /* already stopped */ }
      sirenOsc = null;
    }
  };

  api.shot = function shot() {
    if (!api.ctx || api.muted) return;
    noiseBurst(0.12, 0.25, 1800);
    tone(180, 0.08, 0.12, 'square');
  };
  api.enemyShot = function enemyShot() {
    if (!api.ctx || api.muted) return;
    noiseBurst(0.1, 0.1, 1200);
  };
  api.crash = function crash() {
    if (!api.ctx || api.muted) return;
    noiseBurst(0.25, 0.3, 500);
  };
  api.pickup = function pickup() {
    if (!api.ctx || api.muted) return;
    tone(660, 0.1, 0.12);
    setTimeout(() => tone(990, 0.14, 0.12), 70);
  };
  api.mission = function mission() {
    if (!api.ctx || api.muted) return;
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 0.14), i * 110));
  };
  api.busted = function busted() {
    if (!api.ctx || api.muted) return;
    [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.3, 0.14, 'triangle'), i * 180));
  };
  api.toggleMute = function toggleMute() {
    api.muted = !api.muted;
    if (engineGain) engineGain.gain.value = api.muted ? 0 : 0.015;
    if (sirenGain) sirenGain.gain.value = api.muted ? 0 : 0.02;
    return api.muted;
  };
  return api;
}
