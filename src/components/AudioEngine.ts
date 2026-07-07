/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private ambientOscs: { osc: OscillatorNode; gain: GainNode }[] = [];
  private boostOsc: { osc: OscillatorNode; gain: GainNode } | null = null;
  private isMuted: boolean = true;
  private ambientInterval: number | null = null;

  // Step-sequencer parameters for energetic synthwave loop
  private isPlayingLoop: boolean = false;
  private currentStep: number = 0;
  private lookaheadTimer: number | null = null;
  private nextNoteTime: number = 0.0;
  private scheduleAheadTime: number = 0.12;
  private lookaheadIntervalMs: number = 25;
  private bpm: number = 115;

  constructor() {
    // Load mute state from localStorage (default to muted to comply with browser autoplay policies)
    const savedMute = localStorage.getItem('slither_muted');
    this.isMuted = savedMute !== 'false';
  }

  private initContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  getMuted() {
    return this.isMuted;
  }

  setMuted(mute: boolean) {
    this.isMuted = mute;
    localStorage.setItem('slither_muted', String(mute));

    if (mute) {
      this.stopAmbient();
      this.stopBoostSound();
    } else {
      this.initContext();
      this.startAmbient();
    }
  }

  playClick() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playEat() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    // Soft high-pitched sweep
    const baseFreq = 600 + Math.random() * 200;
    osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  startBoostSound() {
    if (this.isMuted || this.boostOsc) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(55, this.ctx.currentTime); // Low engine hum

      gain.gain.setValueAtTime(0.03, this.ctx.currentTime);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      this.boostOsc = { osc, gain };
    } catch (e) {
      console.warn("Could not start boost sound:", e);
    }
  }

  stopBoostSound() {
    if (this.boostOsc) {
      try {
        this.boostOsc.osc.stop();
      } catch (e) {}
      this.boostOsc = null;
    }
  }

  playDeath() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    // Soft white-noise style crash explosion
    const duration = 0.4;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    noiseNode.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noiseNode.start();
  }

  private getMelodyFreq(step: number): number | null {
    // Synthwave melody frequencies (A minor / F major scale)
    const A4 = 440.00;
    const B4 = 493.88;
    const C5 = 523.25;
    const D5 = 587.33;
    const E5 = 659.25;
    const F5 = 698.46;
    const G4 = 392.00;
    const G5 = 783.99;

    const pattern: { [key: number]: number } = {
      // Am
      0: A4,
      3: C5,
      6: E5,
      8: D5,
      11: C5,
      14: B4,
      // F
      16: A4,
      19: C5,
      22: F5,
      24: E5,
      27: C5,
      30: A4,
      // C
      32: G4,
      35: C5,
      38: E5,
      40: G5,
      43: E5,
      46: D5,
      // G
      48: G4,
      51: B4,
      54: D5,
      56: G5,
      59: D5,
      62: B4
    };

    return pattern[step] || null;
  }

  private scheduleNote(step: number, time: number) {
    if (!this.ctx) return;

    // 1. KICK DRUM: Every 4 steps
    if (step % 4 === 0) {
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, time);
        osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
        gain.gain.setValueAtTime(0.12, time);
        gain.gain.linearRampToValueAtTime(0.001, time + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(time);
        osc.stop(time + 0.12);
      } catch (e) {}
    }

    // 2. SNARE: On step 4, 12, etc. (backbeat)
    if (step % 8 === 4) {
      try {
        const bufferSize = this.ctx.sampleRate * 0.12;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1000, time);
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.04, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
        noiseSource.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noiseSource.start(time);
        noiseSource.stop(time + 0.12);

        const bodyOsc = this.ctx.createOscillator();
        const bodyGain = this.ctx.createGain();
        bodyOsc.type = 'triangle';
        bodyOsc.frequency.setValueAtTime(180, time);
        bodyOsc.frequency.linearRampToValueAtTime(100, time + 0.08);
        bodyGain.gain.setValueAtTime(0.03, time);
        bodyGain.gain.linearRampToValueAtTime(0.001, time + 0.08);
        bodyOsc.connect(bodyGain);
        bodyGain.connect(this.ctx.destination);
        bodyOsc.start(time);
        bodyOsc.stop(time + 0.08);
      } catch (e) {}
    }

    // 3. HI-HAT: On step 2, 6, 10, 14, etc.
    if (step % 4 === 2) {
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(10000, time);
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(7000, time);
        gain.gain.setValueAtTime(0.015, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(time);
        osc.stop(time + 0.04);
      } catch (e) {}
    }

    // 4. ROLLING BASSLINE: On every even step (eighth notes)
    if (step % 2 === 0) {
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        const measure = Math.floor(step / 16) % 4;
        const isOctave = (step % 4 === 0 || step % 4 === 3);

        let baseFreq = 55.00; // Am
        if (measure === 1) baseFreq = 43.65; // F
        if (measure === 2) baseFreq = 65.41; // C
        if (measure === 3) baseFreq = 49.00; // G

        const freq = isOctave ? baseFreq * 2 : baseFreq;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(160, time);
        gain.gain.setValueAtTime(0.03, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(time);
        osc.stop(time + 0.15);
      } catch (e) {}
    }

    // 5. LEAD MELODY SYNTH
    const melodyFreq = this.getMelodyFreq(step);
    if (melodyFreq !== null) {
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(melodyFreq, time);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1100, time);
        filter.frequency.exponentialRampToValueAtTime(320, time + 0.35);

        gain.gain.setValueAtTime(0.0, time);
        gain.gain.linearRampToValueAtTime(0.015, time + 0.03); // rapid attack
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35); // decay/release

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(time);
        osc.stop(time + 0.35);
      } catch (e) {}
    }
  }

  private startAmbient() {
    if (this.isMuted) return;
    this.stopAmbient();
    this.initContext();
    if (!this.ctx) return;

    this.isPlayingLoop = true;
    this.nextNoteTime = this.ctx.currentTime + 0.05;

    const scheduler = () => {
      if (!this.isPlayingLoop || !this.ctx || this.isMuted) return;
      while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
        this.scheduleNote(this.currentStep, this.nextNoteTime);
        const secondsPerBeat = 60.0 / this.bpm;
        const secondsPerStep = secondsPerBeat / 4.0; // 16th notes
        this.nextNoteTime += secondsPerStep;
        this.currentStep = (this.currentStep + 1) % 64;
      }
    };

    this.lookaheadTimer = window.setInterval(scheduler, this.lookaheadIntervalMs);
  }

  private stopAmbient() {
    this.isPlayingLoop = false;
    if (this.lookaheadTimer) {
      clearInterval(this.lookaheadTimer);
      this.lookaheadTimer = null;
    }
  }
}

export const audioEngine = new AudioEngine();
