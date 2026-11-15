// All sound is synthesised with WebAudio: no audio files. Gunshots are a filtered noise crack
// over a pitched thump, voiced per weapon; footsteps are short scuffs; the charge beeps; frags
// boom and flashes ring. Every world sound is placed by distance and by its bearing from the
// listener (gain and stereo pan), so you can hear which side a shot came from.

const VOICE = {
  pistol: { crack: 2400, q: 0.9, body: 140, len: 0.16, gain: 0.55 },
  heavy: { crack: 1500, q: 0.8, body: 95, len: 0.28, gain: 0.8 },
  smg: { crack: 3000, q: 1.1, body: 170, len: 0.11, gain: 0.45 },
  shotgun: { crack: 900, q: 0.6, body: 70, len: 0.38, gain: 0.95 },
  rifle: { crack: 1800, q: 0.9, body: 110, len: 0.22, gain: 0.7 },
  marksman: { crack: 1200, q: 0.7, body: 75, len: 0.55, gain: 1.0 },
};

export function createSound() {
  let ctx = null, master = null, noise = null;
  const listener = { x: 0, z: 0, yaw: 0 };

  /** Audio can only start inside a user gesture; main.js calls this on the first click. */
  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(comp).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  function setListener(x, z, yaw) { listener.x = x; listener.z = z; listener.yaw = yaw; }

  /** A gain + pan pair for a sound at (x, z); null when it is too far to hear. */
  function place(x, z, range) {
    if (!ctx) return null;
    const dx = x - listener.x, dz = z - listener.z;
    const d = Math.hypot(dx, dz);
    if (d > range) return null;
    const gain = ctx.createGain();
    gain.gain.value = Math.pow(1 - d / range, 1.6) * (d < 1 ? 1 : 0.9);
    const pan = ctx.createStereoPanner();
    // Bearing relative to where the listener faces: right of view pans right.
    const right = Math.cos(listener.yaw) * dx - Math.sin(listener.yaw) * dz;
    pan.pan.value = d > 0.5 ? Math.max(-0.9, Math.min(0.9, right / d)) : 0;
    gain.connect(pan).connect(master);
    return gain;
  }

  function noiseBurst(out, t, len, freq, q, type, peak) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5, len + 0.05);
  }

  function tone(out, t, len, f0, f1, type, peak) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + len + 0.02);
  }

  function gunshot(voice, x, z, own) {
    const out = own ? master : place(x, z, 120);
    if (!out) return;
    const v = VOICE[voice] ?? VOICE.rifle;
    const t = ctx.currentTime;
    const k = own ? 1 : 0.85;
    noiseBurst(out, t, v.len * 0.5, v.crack, v.q, 'bandpass', v.gain * 1.6 * k);
    noiseBurst(out, t, v.len, 600, 0.5, 'lowpass', v.gain * k);
    tone(out, t, v.len * 0.8, v.body * 2, v.body * 0.5, 'triangle', v.gain * 0.9 * k);
  }

  function step(x, z, own, hard) {
    const out = own ? master : place(x, z, 22);
    if (!out) return;
    const t = ctx.currentTime;
    noiseBurst(out, t, 0.07, hard ? 500 : 900 + Math.random() * 300, 1.2, 'bandpass', own ? 0.12 : 0.35);
  }

  function click(kind) {
    if (!ctx) return;
    const t = ctx.currentTime;
    if (kind === 'dry') tone(master, t, 0.03, 1800, 1500, 'square', 0.08);
    else if (kind === 'reload') { noiseBurst(master, t, 0.05, 2500, 3, 'bandpass', 0.25); noiseBurst(master, t + 0.35, 0.06, 1800, 3, 'bandpass', 0.3); }
    else if (kind === 'reloaded') noiseBurst(master, t, 0.07, 1400, 2.5, 'bandpass', 0.35);
    else if (kind === 'draw') noiseBurst(master, t, 0.08, 3200, 2, 'bandpass', 0.12);
    else if (kind === 'buy') { tone(master, t, 0.08, 880, 880, 'sine', 0.12); tone(master, t + 0.07, 0.1, 1320, 1320, 'sine', 0.1); }
    else if (kind === 'deny') tone(master, t, 0.12, 220, 180, 'square', 0.06);
    else if (kind === 'hit') tone(master, t, 0.05, 1900, 1600, 'sine', 0.14);
    else if (kind === 'headshot') { tone(master, t, 0.09, 2600, 2400, 'sine', 0.2); noiseBurst(master, t, 0.05, 4000, 2, 'bandpass', 0.2); }
    else if (kind === 'kill') tone(master, t, 0.18, 660, 990, 'triangle', 0.16);
    else if (kind === 'hurt') noiseBurst(master, t, 0.12, 300, 1, 'lowpass', 0.5);
    else if (kind === 'swing') noiseBurst(master, t, 0.12, 2000, 0.7, 'bandpass', 0.18);
    else if (kind === 'scope') noiseBurst(master, t, 0.04, 3000, 4, 'bandpass', 0.15);
    else if (kind === 'throw') noiseBurst(master, t, 0.15, 1200, 0.8, 'bandpass', 0.15);
  }

  function beep(x, z) {
    const out = place(x, z, 40);
    if (out) tone(out, ctx.currentTime, 0.09, 1760, 1760, 'square', 0.18);
  }

  function boom(kind, x, z) {
    const out = place(x, z, 110);
    if (!out) return;
    const t = ctx.currentTime;
    if (kind === 'frag') {
      noiseBurst(out, t, 1.1, 260, 0.6, 'lowpass', 1.4);
      tone(out, t, 0.6, 90, 30, 'sine', 1.2);
    } else if (kind === 'flash') {
      noiseBurst(out, t, 0.25, 3500, 0.8, 'highpass', 0.9);
    } else if (kind === 'smoke') {
      noiseBurst(out, t, 1.6, 1200, 0.4, 'bandpass', 0.35);
    } else if (kind === 'charge') {
      noiseBurst(out, t, 2.4, 180, 0.5, 'lowpass', 2.0);
      tone(out, t, 1.6, 70, 20, 'sine', 1.6);
    } else if (kind === 'bounce') {
      tone(out, t, 0.05, 900, 600, 'triangle', 0.2);
    }
  }

  /** The ringing a flashbang leaves; strength 0..1. */
  function ring(strength) {
    if (!ctx || strength <= 0) return;
    tone(master, ctx.currentTime, 0.8 + strength * 2.2, 3100, 2900, 'sine', 0.05 + strength * 0.12);
  }

  /** Short musical stings for round flow: start, win, loss, plant. */
  function sting(kind) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const notes = { start: [392, 523, 659], win: [523, 659, 784, 1046], loss: [392, 349, 294], plant: [740, 740, 988], half: [440, 554, 659] }[kind] ?? [440];
    notes.forEach((f, i) => tone(master, t + i * 0.11, 0.35, f, f, 'triangle', 0.09));
  }

  return { unlock, setListener, gunshot, step, click, beep, boom, ring, sting };
}
