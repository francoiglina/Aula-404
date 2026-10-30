// Zero-dependency procedural Web Audio API soundscape & SFX for Traditional Japanese School
class SchoolAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private isMuted = false;
  private bgmTimer: number | null = null;
  private stepCooldown = 0;

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1.0;
      this.masterGain.connect(this.ctx.destination);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.14;
      this.bgmGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.28;
      this.sfxGain.connect(this.masterGain);
    } catch {
      // Ignore if AudioContext is restricted
    }
  }

  setPaused(paused: boolean) {
    if (!this.ctx) return;
    if (paused && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    } else if (!paused && !this.isMuted && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime, 0.04);
    }
    return this.isMuted;
  }

  getMuted(): boolean {
    return this.isMuted;
  }

  // Classic Japanese school Westminster chime (Kin-Kon-Kan-Kon: F4 - A4 - G4 - C4)
  playSchoolChime() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const notes = [349.23, 440.0, 392.0, 261.63];
    const now = this.ctx.currentTime;
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const harmonic = this.ctx.createOscillator();
      const g = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.55);
      harmonic.type = 'triangle';
      harmonic.frequency.setValueAtTime(freq * 2, now + i * 0.55);

      g.gain.setValueAtTime(0.001, now + i * 0.55);
      g.gain.linearRampToValueAtTime(0.16, now + i * 0.55 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0008, now + i * 0.55 + 1.25);

      osc.connect(g);
      harmonic.connect(g);
      g.connect(this.sfxGain);

      osc.start(now + i * 0.55);
      harmonic.start(now + i * 0.55);
      osc.stop(now + i * 0.55 + 1.3);
      harmonic.stop(now + i * 0.55 + 1.3);
    });
  }

  startAmbientBgm() {
    if (!this.ctx || !this.bgmGain || this.bgmTimer !== null) return;
    // Soft pentatonic Japanese afternoon school breeze notes (Hirajoshi / Yo scale)
    const scale = [293.66, 329.63, 392.0, 440.0, 523.25, 587.33];
    let idx = 0;

    this.bgmTimer = window.setInterval(() => {
      if (!this.ctx || !this.bgmGain || this.isMuted || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const freq = scale[(idx * 2 + Math.floor(idx / 3)) % scale.length];
      idx++;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.0005, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + 3.4);

      osc.connect(gain);
      gain.connect(this.bgmGain);
      osc.start(now);
      osc.stop(now + 3.5);
    }, 3200);
  }

  playFootstep(delta: number) {
    this.stepCooldown -= delta;
    if (this.stepCooldown > 0 || !this.ctx || !this.sfxGain || this.isMuted) return;
    this.stepCooldown = 0.42;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(115 + Math.random() * 22, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.065);

    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  playTextBlip(pitchBase = 420) {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitchBase + (Math.random() * 36 - 18), now);

    g.gain.setValueAtTime(0.045, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  playStairsTransition() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(130 + i * 18, now + i * 0.14);
      osc.frequency.exponentialRampToValueAtTime(55, now + i * 0.14 + 0.09);
      g.gain.setValueAtTime(0.12, now + i * 0.14);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.1);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now + i * 0.14);
      osc.stop(now + i * 0.14 + 0.11);
    }
  }

  playClueSuccess() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const now = this.ctx.currentTime;
    notes.forEach((f, i) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + i * 0.09);
      g.gain.setValueAtTime(0.14, now + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.65);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.7);
    });
  }

  playShutterClick() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.05);
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  dispose() {
    if (this.bgmTimer !== null) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export const audioEngine = new SchoolAudioEngine();
