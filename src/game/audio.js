import { FREQUENCY_META } from './constants.js';

const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.pulseTimer = 0;
    this.stepIndex = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 18;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.2;

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.34;

    this.master.connect(compressor);
    compressor.connect(this.ctx.destination);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.34, this.ctx.currentTime, 0.04);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  updateMusic(dt, isPlaying, speedRatio, freqKey, isNova) {
    if (!this.ctx || !this.master || this.muted || !isPlaying) return;
    const bpm = 114 + speedRatio * 34 + (isNova ? 14 : 0);
    const stepInterval = 60 / bpm / 2; // eighth-note pulse
    this.pulseTimer += dt;
    if (this.pulseTimer < stepInterval) return;
    this.pulseTimer -= stepInterval;

    const now = this.ctx.currentTime;
    const bassRoots = {
      cyan: [65.41, 65.41, 98.0, 73.42],
      magenta: [82.41, 82.41, 110.0, 98.0],
      gold: [98.0, 98.0, 130.81, 110.0],
    };
    const pattern = bassRoots[freqKey] || bassRoots.cyan;
    const root = pattern[Math.floor(this.stepIndex / 2) % pattern.length];

    // Subtle synthwave bass pulse
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = this.stepIndex % 2 === 0 ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(this.stepIndex % 4 === 2 ? root * 1.5 : root, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320 + speedRatio * 420 + (isNova ? 400 : 0), now);
    filter.Q.value = 3.2;

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + stepInterval * 0.85);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    osc.start(now);
    osc.stop(now + stepInterval * 0.9);

    // High shimmer arp on off-beats when speed or nova is high
    if ((this.stepIndex % 2 === 1 && speedRatio > 0.35) || isNova) {
      const arpOsc = this.ctx.createOscillator();
      const arpGain = this.ctx.createGain();
      const note = PENTATONIC[(this.stepIndex + (isNova ? 3 : 0)) % PENTATONIC.length];
      arpOsc.type = 'sine';
      arpOsc.frequency.setValueAtTime(note, now);
      arpGain.gain.setValueAtTime(0.001, now);
      arpGain.gain.linearRampToValueAtTime(isNova ? 0.065 : 0.032, now + 0.01);
      arpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      arpOsc.connect(arpGain);
      arpGain.connect(this.master);
      arpOsc.start(now);
      arpOsc.stop(now + 0.17);
    }

    this.stepIndex = (this.stepIndex + 1) % 16;
  }

  playShift(freqKey) {
    if (!this.ctx || !this.master || this.muted) return;
    const meta = FREQUENCY_META[freqKey] || FREQUENCY_META.cyan;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc2.type = 'sine';
    osc.frequency.setValueAtTime(meta.noteFreq * 0.75, now);
    osc.frequency.exponentialRampToValueAtTime(meta.noteFreq, now + 0.06);
    osc2.frequency.setValueAtTime(meta.noteFreq * 1.5, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.2);
    osc2.stop(now + 0.2);
  }

  playLaser(freqKey) {
    if (!this.ctx || !this.master || this.muted) return;
    const meta = FREQUENCY_META[freqKey] || FREQUENCY_META.cyan;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(meta.noteFreq * 1.6, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.1);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2800, now);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playJump(isDouble = false) {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const startFreq = isDouble ? 360 : 210;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 2.2, now + 0.15);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  playDash() {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.22);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.23);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  playSlam() {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(175, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.22);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  playCollect(combo = 1, matched = false) {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime;
    const idx = Math.min(PENTATONIC.length - 1, Math.floor(combo * 1.4));
    const f = PENTATONIC[idx] * (matched ? 1.5 : 1);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.exponentialRampToValueAtTime(f * 1.25, now + 0.08);
    gain.gain.setValueAtTime(matched ? 0.14 : 0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playGatePhase() {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.02);
      gain.gain.setValueAtTime(0.001, now + i * 0.02);
      gain.gain.linearRampToValueAtTime(0.085, now + i * 0.02 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.02 + 0.34);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now + i * 0.02);
      osc.stop(now + i * 0.02 + 0.36);
    });
  }

  playKill() {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(310, now);
    osc.frequency.exponentialRampToValueAtTime(72, now + 0.18);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, now);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playNova() {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime;
    [130.81, 261.63, 392.0, 523.25, 659.25, 987.77].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx < 2 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq * 0.85, now);
      osc.frequency.exponentialRampToValueAtTime(freq, now + 0.14);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.92);
    });
  }

  playHit() {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.3);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.34);
  }
}
