class SoundEngine {
  private ctx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmInterval: number | null = null;
  public isMuted: boolean = false;
  private lastStepTime: number = 0;

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

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      this.bgmGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.22, this.ctx.currentTime);
      this.sfxGain.connect(this.ctx.destination);

      this.startAtmosphericChimes();
    } catch {
      // Ignore if AudioContext unavailable
    }
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.bgmGain) {
      this.bgmGain.gain.setTargetAtTime(muted ? 0 : 0.08, now, 0.08);
    }
    if (this.sfxGain) {
      this.sfxGain.gain.setTargetAtTime(muted ? 0 : 0.22, now, 0.08);
    }
  }

  private startAtmosphericChimes() {
    if (!this.ctx || this.bgmInterval !== null) return;

    // Japanese Hirajoshi pentatonic notes (D4, Eb4, G4, A4, Bb4, D5)
    const scale = [293.66, 311.13, 392.0, 440.0, 466.16, 587.33];
    let idx = 0;

    this.bgmInterval = window.setInterval(() => {
      if (!this.ctx || this.isMuted || document.hidden || this.ctx.state !== 'running') return;
      const freq = scale[(idx * 2 + Math.floor(Math.random() * 2)) % scale.length];
      idx++;
      this.playPluck(freq, 0.05, 3.2);
    }, 3800);
  }

  private playPluck(freq: number, volume: number, duration: number) {
    if (!this.ctx || !this.bgmGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(280, now + duration);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmGain);

    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  playFootstep() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const nowMs = performance.now();
    if (nowMs - this.lastStepTime < 360) return;
    this.lastStepTime = nowMs;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Warm wooden floorboard tap
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115 + Math.random() * 20, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.065);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.075);
  }

  playTextTick() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(520 + Math.random() * 50, now);
    gain.gain.setValueAtTime(0.028, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.035);
  }

  playInteractTap() {
    this.vibrate(25);
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(560, now + 0.08);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  playStairsTransition() {
    this.vibrate([30, 50, 30, 50, 40]);
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    [0, 0.16, 0.32, 0.48].forEach((offset, idx) => {
      const start = this.ctx!.currentTime + offset;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110 + idx * 14, start);
      osc.frequency.exponentialRampToValueAtTime(48, start + 0.09);
      gain.gain.setValueAtTime(0.13, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(start);
      osc.stop(start + 0.11);
    });
  }

  playClueUnlocked() {
    this.vibrate([45, 35, 80]);
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const notes = [440, 587.33, 659.25, 880];
    notes.forEach((freq, i) => {
      const start = this.ctx!.currentTime + i * 0.09;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.14, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.75);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(start);
      osc.stop(start + 0.8);
    });
  }

  vibrate(pattern: number | number[] = 35) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore on unsupported browsers
      }
    }
  }

  dispose() {
    if (this.bgmInterval !== null) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export const soundEngine = new SoundEngine();
