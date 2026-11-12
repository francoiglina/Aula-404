/**
 * Controlador de audio ambiental para TitleScreen y IntroLoreScreen.
 * - Arranque inmediato en nivel normal (volume = 1.0, currentTime = 0) sin fade-in lento.
 * - Precarga temprana con preload="auto".
 * - Desbloqueo automático ante políticas de Autoplay mediante listeners globales { once: true }.
 * - Fade-out suave únicamente al salir de cada pantalla.
 */
export const TITLE_SCREEN_AUDIO_URL = '/assets/aistudio/title_screen_151254f5.mp3';
export const OPENING_LORE_AUDIO_URL = '/assets/aistudio/opening_ae3411bf.mp3';

const UNLOCK_EVENTS: Array<keyof WindowEventMap> = [
  'pointerdown',
  'click',
  'keydown',
  'touchstart',
];

const preloadedAudioCache = new Map<string, HTMLAudioElement>();

export function preloadIntroAudioAssets(): void {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
  for (const url of [TITLE_SCREEN_AUDIO_URL, OPENING_LORE_AUDIO_URL]) {
    if (!preloadedAudioCache.has(url)) {
      const el = new Audio(url);
      el.preload = 'auto';
      el.load();
      preloadedAudioCache.set(url, el);
    }
  }
}

if (typeof window !== 'undefined') {
  preloadIntroAudioAssets();
}

export interface TitleAudioOptions {
  src?: string;
  targetVolume?: number;
  initialMuted?: boolean;
  onPlaybackStateChange?: (isPlaying: boolean, waitingForGesture: boolean) => void;
}

export class TitleAudioController {
  private audio: HTMLAudioElement | null = null;
  private readonly targetVolume: number;
  private readonly onPlaybackStateChange?: (isPlaying: boolean, waitingForGesture: boolean) => void;

  private isMuted: boolean;
  private isDisposed: boolean = false;
  private isFadingOut: boolean = false;
  private hasStartedPlayback: boolean = false;
  private currentFadeRaf: number | null = null;
  private gestureListenersBound: boolean = false;

  constructor(options: TitleAudioOptions = {}) {
    this.targetVolume = options.targetVolume ?? 1.0;
    this.isMuted = Boolean(options.initialMuted);
    this.onPlaybackStateChange = options.onPlaybackStateChange;

    if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      const src = options.src ?? TITLE_SCREEN_AUDIO_URL;
      const audio = new Audio(src);
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = this.isMuted ? 0 : this.targetVolume;
      audio.muted = this.isMuted;
      audio.load();
      this.audio = audio;
    }
  }

  /**
   * Inicia la reproducción inmediatamente desde currentTime = 0 y volume = 1.0 (sin retraso de fade-in).
   * Si el navegador bloquea el autoplay, los listeners globales fuerzan el arranque al instante en el
   * primer contacto del usuario con la ventana.
   */
  public start(): Promise<void> {
    if (this.isDisposed || !this.audio || this.isFadingOut) return Promise.resolve();

    this.bindGestureUnlock();
    this.audio.currentTime = 0;
    this.audio.muted = this.isMuted;
    this.audio.volume = this.isMuted ? 0 : this.targetVolume;

    return this.audio
      .play()
      .then(() => {
        if (this.isDisposed || !this.audio) {
          this.audio?.pause();
          return;
        }
        this.hasStartedPlayback = true;
        this.unbindGestureUnlock();
        this.onPlaybackStateChange?.(true, false);
      })
      .catch(() => {
        this.onPlaybackStateChange?.(false, true);
      });
  }

  private readonly handleUserGesture = () => {
    if (this.isDisposed || !this.audio || this.hasStartedPlayback || this.isFadingOut) return;

    this.audio.currentTime = 0;
    this.audio.muted = this.isMuted;
    this.audio.volume = this.isMuted ? 0 : this.targetVolume;

    this.audio
      .play()
      .then(() => {
        if (this.isDisposed || !this.audio) {
          this.audio?.pause();
          return;
        }
        this.hasStartedPlayback = true;
        this.unbindGestureUnlock();
        this.onPlaybackStateChange?.(true, false);
      })
      .catch(() => {
        if (!this.hasStartedPlayback && !this.isDisposed && !this.isFadingOut) {
          this.gestureListenersBound = false;
          this.bindGestureUnlock();
        }
      });
  };

  private bindGestureUnlock(): void {
    if (this.gestureListenersBound || typeof window === 'undefined') return;
    this.gestureListenersBound = true;
    for (const evt of UNLOCK_EVENTS) {
      window.addEventListener(evt, this.handleUserGesture, {
        once: true,
        capture: true,
        passive: true,
      });
    }
  }

  private unbindGestureUnlock(): void {
    if (!this.gestureListenersBound || typeof window === 'undefined') return;
    this.gestureListenersBound = false;
    for (const evt of UNLOCK_EVENTS) {
      window.removeEventListener(evt, this.handleUserGesture, { capture: true });
    }
  }

  private fadeVolumeTo(targetVol: number, durationMs: number, onComplete?: () => void): void {
    this.cancelActiveFade();
    if (!this.audio || this.isDisposed) {
      onComplete?.();
      return;
    }

    const clampedTarget = Math.max(0, Math.min(1, targetVol));
    const startVol = this.audio.volume;

    if (durationMs <= 16 || Math.abs(clampedTarget - startVol) < 0.002) {
      this.audio.volume = clampedTarget;
      onComplete?.();
      return;
    }

    const startTime = performance.now();

    const step = (now: number) => {
      if (this.isDisposed || !this.audio) {
        this.currentFadeRaf = null;
        return;
      }

      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 2.2);
      this.audio.volume = Math.max(0, Math.min(1, startVol + (clampedTarget - startVol) * eased));

      if (progress < 1) {
        this.currentFadeRaf = window.requestAnimationFrame(step);
      } else {
        this.currentFadeRaf = null;
        this.audio.volume = clampedTarget;
        onComplete?.();
      }
    };

    this.currentFadeRaf = window.requestAnimationFrame(step);
  }

  private cancelActiveFade(): void {
    if (this.currentFadeRaf !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.currentFadeRaf);
      this.currentFadeRaf = null;
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (!this.audio || this.isDisposed) return;
    this.audio.muted = muted;

    if (!this.hasStartedPlayback && !muted && !this.isFadingOut) {
      this.handleUserGesture();
      return;
    }

    if (!this.isFadingOut) {
      this.cancelActiveFade();
      this.audio.volume = muted ? 0 : this.targetVolume;
    }
  }

  public toggleMute(): boolean {
    const nextMuted = !this.isMuted;
    this.setMuted(nextMuted);
    return nextMuted;
  }

  /**
   * Fade-out suave al salir de la pantalla hasta llegar a 0 y pausar la pista.
   */
  public fadeOutAndStop(durationMs: number = 1500): Promise<void> {
    this.isFadingOut = true;
    this.unbindGestureUnlock();

    return new Promise((resolve) => {
      if (this.isDisposed || !this.audio || this.audio.paused) {
        if (this.audio) {
          this.audio.pause();
          this.audio.volume = 0;
        }
        resolve();
        return;
      }

      this.fadeVolumeTo(0, durationMs, () => {
        if (this.audio) {
          this.audio.pause();
          this.audio.currentTime = 0;
        }
        resolve();
      });
    });
  }

  public dispose(): void {
    this.isDisposed = true;
    this.cancelActiveFade();
    this.unbindGestureUnlock();
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
  }
}
