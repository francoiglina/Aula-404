export const FOOTSTEP_WAV_URLS: readonly string[] = [
  '/assets/aistudio/paso_1_13a83041.wav', // Paso 1: paso_1.wav
  '/assets/aistudio/paso_2_99b87d60.wav', // Paso 2: paso_2.wav
  '/assets/aistudio/paso_3_1e02b963.wav', // Paso 3: paso_3.wav
  '/assets/aistudio/paso_4_8f61a019.wav', // Paso 4: paso_4.wav
];

export interface FootstepSystemOptions {
  audioUrls?: readonly string[];
  baseCooldownSec?: number;    // Cadencia base entre pasos al caminar a velocidad normal
  minTriggerGapMs?: number;    // Cooldown mínimo absoluto ante pulsaciones rápidas de teclas
  baseVolume?: number;         // Volumen base (0.0 a 1.0)
  volumeVariation?: number;    // Variación sutil de volumen por paso (ej. ±0.08)
  pitchVariation?: number;     // Variación sutil de tono/playbackRate por paso (ej. ±0.04)
}

/**
 * Sistema modular de audio para pasos cíclicos (paso_1 -> paso_2 -> paso_3 -> paso_4 -> paso_1)
 * diseñado para integrarse en el bucle de movimiento de Three.js.
 */
export class FootstepAudioSystem {
  private readonly audioUrls: readonly string[];
  private readonly baseCooldownSec: number;
  private readonly minTriggerGapMs: number;
  private readonly baseVolume: number;
  private readonly volumeVariation: number;
  private readonly pitchVariation: number;

  private ctx: AudioContext | null = null;
  private outputNode: AudioNode | null = null;
  private decodedBuffers: Array<AudioBuffer | null>;
  private htmlFallbacks: HTMLAudioElement[] = [];

  private isPreloading = false;
  private isLoaded = false;
  private isMuted = false;

  // Contador incremental para rotación estricta mediante (stepIndex % 4)
  private stepIndex = 0;
  private stepTimerSec = 0;
  private wasMoving = false;
  private lastStepTimestampMs = 0;

  constructor(options: FootstepSystemOptions = {}) {
    this.audioUrls = options.audioUrls ?? FOOTSTEP_WAV_URLS;
    this.baseCooldownSec = options.baseCooldownSec ?? 0.37;
    this.minTriggerGapMs = options.minTriggerGapMs ?? 220;
    this.baseVolume = options.baseVolume ?? 0.68;
    this.volumeVariation = options.volumeVariation ?? 0.08;
    this.pitchVariation = options.pitchVariation ?? 0.04;
    this.decodedBuffers = new Array(this.audioUrls.length).fill(null);

    if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      this.htmlFallbacks = this.audioUrls.map((url) => {
        const el = new Audio(url);
        el.preload = 'auto';
        return el;
      });
    }
  }

  /**
   * Conecta el sistema al AudioContext principal (o crea uno propio) y decodifica los 4 archivos WAV.
   */
  public attachAudioContext(ctx: AudioContext, outputNode?: AudioNode): void {
    this.ctx = ctx;
    this.outputNode = outputNode ?? ctx.destination;
    void this.preloadBuffers();
  }

  public async preloadBuffers(): Promise<void> {
    if (!this.ctx || this.isPreloading || this.isLoaded) return;
    this.isPreloading = true;

    try {
      const results = await Promise.all(
        this.audioUrls.map(async (url) => {
          try {
            const response = await fetch(url);
            if (!response.ok) return null;
            const arrayBuffer = await response.arrayBuffer();
            if (!this.ctx) return null;
            return await this.ctx.decodeAudioData(arrayBuffer.slice(0));
          } catch {
            return null;
          }
        })
      );

      results.forEach((buf, idx) => {
        this.decodedBuffers[idx] = buf;
      });
      this.isLoaded = results.some((buf) => buf !== null);
    } finally {
      this.isPreloading = false;
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  public hasDecodedBuffers(): boolean {
    return this.isLoaded;
  }

  /**
   * Se invoca en cada fotograma del bucle de Three.js (`requestAnimationFrame`).
   * Administra la cadencia/cooldown mientras el personaje está en movimiento (WASD / Joystick).
   */
  public update(deltaSeconds: number, isMoving: boolean, speedNormalized = 1): void {
    if (!isMoving || speedNormalized <= 0.04) {
      this.wasMoving = false;
      this.stepTimerSec = 0;
      return;
    }

    const clampedSpeed = Math.min(1, Math.max(0.45, speedNormalized));
    const currentCooldownSec = this.baseCooldownSec / clampedSpeed;

    // Al iniciar la marcha tras estar detenido, dispara el siguiente paso respetando el anti-rebote mínimo
    if (!this.wasMoving) {
      this.wasMoving = true;
      this.stepTimerSec = 0;
      this.triggerNextStep(clampedSpeed);
      return;
    }

    this.stepTimerSec += deltaSeconds;
    if (this.stepTimerSec >= currentCooldownSec) {
      this.stepTimerSec %= currentCooldownSec;
      this.triggerNextStep(clampedSpeed);
    }
  }

  /**
   * Ejecuta inmediatamente el siguiente archivo de paso en orden estricto (stepIndex % 4):
   * Paso 1 -> paso_1.wav, Paso 2 -> paso_2.wav, Paso 3 -> paso_3.wav, Paso 4 -> paso_4.wav, Paso 5 -> paso_1.wav...
   */
  public triggerNextStep(intensity = 1, scheduledDelaySec = 0): number | null {
    if (this.isMuted) return null;

    if (scheduledDelaySec === 0) {
      const nowMs = performance.now();
      if (nowMs - this.lastStepTimestampMs < this.minTriggerGapMs) {
        return null;
      }
      this.lastStepTimestampMs = nowMs;
    }

    const totalClips = this.audioUrls.length;
    const currentClipIndex = this.stepIndex % totalClips;
    this.stepIndex = (this.stepIndex + 1) % totalClips;

    // Reseteo limpio de tono y volumen base + microvariación natural sin alterar el orden 1-2-3-4
    const rate = 1.0 + (Math.random() * 2 - 1) * this.pitchVariation;
    const volumeScale = 0.8 + 0.2 * Math.min(1, Math.max(0.25, intensity));
    const gainValue = Math.min(
      1,
      Math.max(0.05, this.baseVolume * volumeScale * (1 + (Math.random() * 2 - 1) * this.volumeVariation))
    );

    const buffer = this.decodedBuffers[currentClipIndex];
    if (this.ctx && buffer) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      const startAt = this.ctx.currentTime + Math.max(0, scheduledDelaySec);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.setValueAtTime(rate, startAt);

      const stepGain = this.ctx.createGain();
      stepGain.gain.setValueAtTime(gainValue, startAt);

      // Ligera alternancia espacial pie izquierdo (-0.08) / pie derecho (+0.08)
      if (typeof this.ctx.createStereoPanner === 'function') {
        const panner = this.ctx.createStereoPanner();
        panner.pan.setValueAtTime(currentClipIndex % 2 === 0 ? -0.08 : 0.08, startAt);
        source.connect(stepGain);
        stepGain.connect(panner);
        panner.connect(this.outputNode ?? this.ctx.destination);
      } else {
        source.connect(stepGain);
        stepGain.connect(this.outputNode ?? this.ctx.destination);
      }

      source.start(startAt);
      return currentClipIndex;
    }

    // Respaldo HTMLAudioElement si el buffer Web Audio aún está terminando de decodificarse
    const fallbackEl = this.htmlFallbacks[currentClipIndex];
    if (fallbackEl) {
      const playFallback = () => {
        try {
          const clone = fallbackEl.cloneNode(true) as HTMLAudioElement;
          clone.playbackRate = rate;
          clone.volume = Math.min(1, gainValue * 0.45);
          void clone.play().catch(() => {});
        } catch {
          // Ignorar bloqueo de autoplay si aún no hubo interacción
        }
      };

      if (scheduledDelaySec > 0) {
        window.setTimeout(playFallback, scheduledDelaySec * 1000);
      } else {
        playFallback();
      }
    }

    return currentClipIndex;
  }

  /**
   * Reinicia la cadencia temporal al detenerse; opcionalmente permite reiniciar la secuencia al Paso 1.
   */
  public reset(resetSequenceToFirst = false): void {
    this.wasMoving = false;
    this.stepTimerSec = 0;
    if (resetSequenceToFirst) {
      this.stepIndex = 0;
    }
  }
}
