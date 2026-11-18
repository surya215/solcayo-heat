// Every sound is synthesized with WebAudio — no audio files. A sawtooth
// engine hum, a two-tone siren, gunshots from filtered noise, pickup chimes
// and a slow sunset bassline. Nothing plays until the player's first
// gesture unlocks the audio context.
export function createAudio() {
  const api = { muted: false, ready: false, ctx: null };
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;

  // A short decaying oscillator note.
  function note(freq, dur, vol, type = 'sine', when = 0) {
    const t = api.ctx.currentTime + when;
    const osc = api.ctx.createOscillator();
    const g = api.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(api.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // A burst of filtered noise that fades out.
  function burst(dur, vol, cutoff) {
    const len = Math.floor(api.ctx.sampleRate * dur);
    const buf = api.ctx.createBuffer(1, len, api.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = api.ctx.createBufferSource();
    src.buffer = buf;
    const filter = api.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const g = api.ctx.createGain();
    g.gain.value = vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(api.ctx.destination);
    src.start();
  }

  function startEngineLoop() {
    engineOsc = api.ctx.createOscillator();
    engineGain = api.ctx.createGain();
    const filter = api.ctx.createBiquadFilter();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 50;
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    engineGain.gain.value = 0;
    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(api.ctx.destination);
    engineOsc.start();
  }

  function startMusicLoop() {
    // One bar every 2 s: a low root, then a soft plucked chord on top.
    // Am – F – C – G, a laid-back sunset bassline.
    const roots = [110, 87.31, 130.81, 98];
    let bar = 0;
    musicTimer = setInterval(() => {
      if (!api.ctx || api.muted) return;
      const t = api.ctx.currentTime;
      const root = roots[bar % roots.length];
      bar += 1;
      note(root / 2, 1.8, 0.05, 'triangle', 0);
      note(root, 0.5, 0.04, 'triangle', 0.5);
      note(root * 1.5, 0.5, 0.035, 'triangle', 1.0);
      note(root * 2, 0.4, 0.03, 'triangle', 1.5);
    }, 2000);
    void musicTimer;
  }

  function startContext() {
    if (api.ctx) return true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      api.ctx = new Ctx();
      api.ready = true;
      startEngineLoop();
      startMusicLoop();
      return true;
    } catch {
      return false;
    }
  }

  api.unlock = function unlock() {
    if (startContext() && api.ctx.state === 'suspended') api.ctx.resume().catch(() => {});
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
      sirenOsc.frequency.value = 760;
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
      lfo.start();
      sirenOsc._lfo = lfo;
    } else if (!on && sirenOsc) {
      try { sirenOsc._lfo.stop(); sirenOsc.stop(); } catch { /* already stopped */ }
      sirenOsc = null;
    }
  };

  api.shot = function shot() {
    if (!api.ctx || api.muted) return;
    burst(0.12, 0.25, 1800);
    note(180, 0.08, 0.12, 'square');
  };
  api.enemyShot = function enemyShot() {
    if (!api.ctx || api.muted) return;
    burst(0.1, 0.1, 1200);
  };
  api.crash = function crash() {
    if (!api.ctx || api.muted) return;
    burst(0.25, 0.3, 500);
  };
  api.pickup = function pickup() {
    if (!api.ctx || api.muted) return;
    note(660, 0.1, 0.12);
    setTimeout(() => note(990, 0.14, 0.12), 70);
  };
  api.mission = function mission() {
    if (!api.ctx || api.muted) return;
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => note(f, 0.22, 0.14), i * 110));
  };
  api.busted = function busted() {
    if (!api.ctx || api.muted) return;
    [392, 330, 262].forEach((f, i) => setTimeout(() => note(f, 0.3, 0.14, 'triangle'), i * 180));
  };
  api.toggleMute = function toggleMute() {
    api.muted = !api.muted;
    if (engineGain) engineGain.gain.value = api.muted ? 0 : 0.015;
    if (sirenGain) sirenGain.gain.value = api.muted ? 0 : 0.02;
    return api.muted;
  };
  return api;
}
