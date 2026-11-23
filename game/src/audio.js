// All sound is synthesised with WebAudio — no audio files, no network. The context starts on
// the first user gesture (browsers require one). Music is a small step-sequenced loop: a bass
// line, a kick and a hat, at 104 BPM.

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let muted = false;
  let musicOn = true;
  let musicTimer = 0;
  let step = 0;
  let noiseBuffer = null;

  const BASS = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 65.4, 0];

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      // Engine hum: a sawtooth whose pitch follows the car's speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 400;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Police siren: one oscillator that alternates between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      // Music bus.
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!ctx || !master) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq, when = 0) {
    if (!ctx || !master || !noiseBuffer) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function musicStep() {
    if (!ctx || !musicGain || !musicOn || muted) return;
    const beat = step % 16;
    const bass = BASS[beat];
    if (bass > 0) tone(bass, 0.22, 'square', 0.5);
    if (beat % 4 === 0) {
      // Kick: a sine dropping fast.
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.7, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(g);
      g.connect(musicGain);
      osc.start(t);
      osc.stop(t + 0.16);
    }
    if (beat % 2 === 1) noise(0.04, 0.12, 6000);
    step += 1;
  }

  return {
    /** Call on any user gesture; safe to call often. */
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
    toggleMusic() {
      musicOn = !musicOn;
      return musicOn;
    },
    /** dt in seconds; speed 0..1 of the car, wanted 0..5. */
    update(dt, speed, wanted) {
      if (!ctx) return;
      musicTimer += dt;
      const stepDur = 60 / 104 / 2;
      while (musicTimer >= stepDur) {
        musicTimer -= stepDur;
        musicStep();
      }
      if (engineGain && engineOsc) {
        engineOsc.frequency.value = 55 + speed * 160;
        engineGain.gain.value = muted ? 0 : speed * 0.05;
      }
      if (sirenGain && sirenOsc) {
        sirenTimer += dt;
        if (sirenTimer > 0.45) {
          sirenTimer = 0;
          sirenHigh = !sirenHigh;
          sirenOsc.frequency.value = sirenHigh ? 950 : 700;
        }
        sirenGain.gain.value = muted || wanted === 0 ? 0 : 0.02 + wanted * 0.008;
      }
    },
    blip() {
      if (!ensure()) return;
      tone(880, 0.09, 'sine', 0.25);
      tone(1320, 0.12, 'sine', 0.2, 0.07);
    },
    thud() {
      if (!ensure()) return;
      noise(0.12, 0.5, 300);
      tone(90, 0.12, 'sine', 0.4);
    },
    shot() {
      if (!ensure()) return;
      noise(0.16, 0.6, 2400);
      tone(160, 0.08, 'square', 0.25);
    },
    crash() {
      if (!ensure()) return;
      noise(0.25, 0.5, 500);
    },
    jingle() {
      if (!ensure()) return;
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.3, i * 0.11));
    },
    busted() {
      if (!ensure()) return;
      [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.2, i * 0.16));
    },
  };
}
