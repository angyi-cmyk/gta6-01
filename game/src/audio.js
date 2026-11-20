// Synthesized sound: every effect is a WebAudio oscillator or filtered noise,
// so the game ships no audio files at all. One job: make noise on demand.
let ctx = null;
let master = null;
let muted = false;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let sirenHigh = false;
let sirenTimer = 0;

export function initAudio() {
  if (ctx) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
}

export function setMuted(value) {
  muted = value;
  if (master) master.gain.value = muted ? 0 : 0.5;
}

export function isMuted() {
  return muted;
}

function tone(freq, duration, type = 'sine', volume = 0.25, slideTo = null) {
  if (!ctx || muted) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  } catch (error) {
    // Audio is decoration; a failure here must never break the game.
  }
}

function noiseBurst(duration, volume, cutoff) {
  if (!ctx || muted) return;
  try {
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  } catch (error) {
    // See tone(): audio must never break the game.
  }
}

export function playGunshot() {
  noiseBurst(0.14, 0.5, 2400);
  tone(160, 0.09, 'square', 0.16, 60);
}

export function playPunch() {
  noiseBurst(0.08, 0.3, 900);
}

export function playCrash(strength = 1) {
  noiseBurst(0.22, Math.min(0.6, 0.3 * strength), 700);
  tone(90, 0.18, 'sine', 0.3, 45);
}

export function playPickup() {
  tone(660, 0.1, 'sine', 0.25);
  setTimeout(() => tone(880, 0.14, 'sine', 0.25), 90);
}

export function playMissionComplete() {
  [523, 659, 784, 1047].forEach((freq, i) => setTimeout(() => tone(freq, 0.22, 'triangle', 0.3), i * 110));
}

export function playWasted() {
  [392, 330, 262, 196].forEach((freq, i) => setTimeout(() => tone(freq, 0.3, 'sawtooth', 0.2), i * 160));
}

export function playPhone() {
  tone(1200, 0.09, 'sine', 0.2);
  setTimeout(() => tone(1200, 0.09, 'sine', 0.2), 140);
}

// A continuous engine hum whose pitch follows the player's speed (0..1).
export function updateEngine(speedRatio, driving) {
  if (!ctx || muted) return;
  try {
    if (!driving || speedRatio < 0.03) {
      if (engineGain) engineGain.gain.value = 0;
      return;
    }
    if (!engineOsc) {
      engineOsc = ctx.createOscillator();
      engineGain = ctx.createGain();
      engineOsc.type = 'sawtooth';
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    }
    engineOsc.frequency.setValueAtTime(52 + speedRatio * 130, ctx.currentTime);
    engineGain.gain.value = 0.05 + speedRatio * 0.05;
  } catch (error) {
    // See tone().
  }
}

// A two-tone police siren while any police car is close.
export function updateSiren(active, dt) {
  if (!ctx || muted) return;
  try {
    if (!active) {
      if (sirenGain) sirenGain.gain.value = 0;
      return;
    }
    if (!sirenOsc) {
      sirenOsc = ctx.createOscillator();
      sirenGain = ctx.createGain();
      sirenOsc.type = 'square';
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    }
    sirenTimer += dt;
    if (sirenTimer > 0.42) {
      sirenTimer = 0;
      sirenHigh = !sirenHigh;
      sirenOsc.frequency.setValueAtTime(sirenHigh ? 920 : 660, ctx.currentTime);
    }
    sirenGain.gain.value = 0.045;
  } catch (error) {
    // See tone().
  }
}
