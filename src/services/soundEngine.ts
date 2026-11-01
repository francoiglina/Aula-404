import * as THREE from 'three';
import { FootstepAudioSystem } from './footstepSystem';

export const SCHOOL_BGM_AUDIO_URL = '/assets/aistudio/school_bgm_cb57cebb.mp3';
export const MENU_CONFIRM_AUDIO_URL = '/assets/aistudio/menu_confirm_4f8cbfb0.mp3';
export const SENSOR_SUCCESS_AUDIO_URL = '/assets/aistudio/sensor_success_66a79ca0.wav';

export interface BgmFadeOutOptions {
  pauseAfterFade?: boolean;
  targetVolume?: number;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private listener: THREE.AudioListener | null = null;
  private bgmSound: THREE.Audio | null = null;
  private attachedCamera: THREE.Camera | null = null;

  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private rewardGain: GainNode | null = null;
  public isMuted: boolean = false;

  // Niveles nominales de mezcla: BGM ambiental tenue (0.32) para no tapar pasos, UI ni pistas
  private readonly bgmBaseGain = 0.32;
  private bgmTargetVolume = 0.32;
  private readonly sfxBaseGain = 0.42;
  private readonly rewardBaseGain = 0.72;

  // Estado del bucle ambiental school_bgm.mp3 (THREE.Audio + THREE.AudioLoader)
  private isBgmLoading: boolean = false;
  private isBgmLoaded: boolean = false;
  private bgmShouldPlay: boolean = false;
  private bgmExplicitlyPaused: boolean = false;
  private wasBgmPlayingBeforeHidden: boolean = false;
  private bgmFadeTimer: number | null = null;
  private bgmHtmlFallback: HTMLAudioElement | null = null;
  private unlockListenersBound: boolean = false;

  // Gestor de pasos cíclicos (4 archivos WAV)
  public readonly footsteps = new FootstepAudioSystem({
    baseCooldownSec: 0.37,
    minTriggerGapMs: 220,
    baseVolume: 0.88,
    volumeVariation: 0.08,
    pitchVariation: 0.04,
  });

  // Efecto global de confirmación y selección de UI (menu_confirm.mp3)
  private confirmBuffer: AudioBuffer | null = null;
  private isConfirmLoading: boolean = false;
  private confirmHtmlAudio: HTMLAudioElement | null = null;
  private activeConfirmSource: AudioBufferSourceNode | null = null;
  private activeConfirmGain: GainNode | null = null;
  private lastConfirmTriggerMs: number = -100;
  private suppressConfirmUntilMs: number = 0;

  // Efecto prioritario de éxito/recompensa al completar un sensor (sensor_success)
  private sensorSuccessBuffer: AudioBuffer | null = null;
  private isSensorSuccessLoading: boolean = false;
  private sensorSuccessHtmlAudio: HTMLAudioElement | null = null;
  private activeSuccessSource: AudioBufferSourceNode | null = null;
  private duckRestoreTimer: number | null = null;

  private readonly confirmBufferVolume = 0.6;
  private readonly confirmHtmlVolume = 0.25;
  private readonly sensorSuccessHtmlVolume = 0.66;

  constructor() {
    if (typeof window !== 'undefined') {
      if (typeof Audio !== 'undefined') {
        this.confirmHtmlAudio = new Audio(MENU_CONFIRM_AUDIO_URL);
        this.confirmHtmlAudio.preload = 'auto';
        this.confirmHtmlAudio.volume = this.confirmHtmlVolume;

        this.sensorSuccessHtmlAudio = new Audio(SENSOR_SUCCESS_AUDIO_URL);
        this.sensorSuccessHtmlAudio.preload = 'auto';
        this.sensorSuccessHtmlAudio.volume = this.sensorSuccessHtmlVolume;
      }

      // Precarga en caché HTTP el archivo school_bgm.mp3 sin crear AudioContext antes del gesto del usuario
      void fetch(SCHOOL_BGM_AUDIO_URL).catch(() => {});

      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  /**
   * Vincula el THREE.AudioListener a la cámara principal de Three.js.
   */
  attachCamera(camera: THREE.Camera) {
    this.attachedCamera = camera;
    if (this.listener && this.listener.parent !== camera) {
      camera.add(this.listener);
    }
  }

  /**
   * Desvincula el THREE.AudioListener al destruir la escena de Three.js.
   */
  detachCamera(camera: THREE.Camera) {
    if (this.listener && this.listener.parent === camera) {
      camera.remove(this.listener);
    }
    if (this.attachedCamera === camera) {
      this.attachedCamera = null;
    }
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      void this.preloadConfirmBuffer();
      void this.preloadSensorSuccessBuffer();
      this.loadSchoolBgmBuffer();
      return;
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Sincroniza el AudioContext nativo con Three.js para usar THREE.AudioListener y THREE.AudioLoader
      THREE.AudioContext.setContext(this.ctx);
      this.listener = new THREE.AudioListener();
      if (this.attachedCamera) {
        this.attachedCamera.add(this.listener);
      }

      this.bgmSound = new THREE.Audio(this.listener);
      this.bgmSound.setLoop(true);
      this.bgmSound.setVolume(this.isMuted ? 0 : this.bgmTargetVolume);
      this.bgmGain = this.bgmSound.gain;

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxBaseGain, this.ctx.currentTime);
      this.sfxGain.connect(this.ctx.destination);

      // Bus prioritario independiente para que el hallazgo de pistas destaque sobre pasos y BGM
      this.rewardGain = this.ctx.createGain();
      this.rewardGain.gain.setValueAtTime(this.rewardBaseGain, this.ctx.currentTime);
      this.rewardGain.connect(this.ctx.destination);

      this.footsteps.attachAudioContext(this.ctx, this.sfxGain);
      this.footsteps.setMuted(this.isMuted);

      void this.preloadConfirmBuffer();
      void this.preloadSensorSuccessBuffer();
      this.loadSchoolBgmBuffer();
      this.bindAutoplayUnlockFallback();
    } catch {
      this.ensureHtmlBgmFallback();
    }
  }

  /**
   * Carga `school_bgm.mp3` mediante `THREE.AudioLoader` y configura `setLoop(true)` en `THREE.Audio`.
   */
  private loadSchoolBgmBuffer(): void {
    if (!this.ctx || !this.bgmSound || this.isBgmLoaded || this.isBgmLoading) return;
    this.isBgmLoading = true;

    const audioLoader = new THREE.AudioLoader();
    audioLoader.load(
      SCHOOL_BGM_AUDIO_URL,
      (buffer) => {
        this.isBgmLoading = false;
        if (!this.bgmSound || !this.ctx) return;

        this.bgmSound.setBuffer(buffer);
        this.bgmSound.setLoop(true);
        this.isBgmLoaded = true;

        if (this.bgmShouldPlay && !this.bgmExplicitlyPaused && !document.hidden) {
          this.startThreeBgmPlayback(1.1);
        } else {
          this.bgmSound.setVolume(this.isMuted ? 0 : this.bgmTargetVolume);
        }
      },
      undefined,
      () => {
        this.isBgmLoading = false;
        this.ensureHtmlBgmFallback();
        if (this.bgmShouldPlay && !this.bgmExplicitlyPaused && !document.hidden) {
          this.playHtmlBgmFallback();
        }
      }
    );
  }

  private ensureHtmlBgmFallback(): void {
    if (this.bgmHtmlFallback || typeof Audio === 'undefined') return;
    this.bgmHtmlFallback = new Audio(SCHOOL_BGM_AUDIO_URL);
    this.bgmHtmlFallback.loop = true;
    this.bgmHtmlFallback.preload = 'auto';
    this.bgmHtmlFallback.volume = this.isMuted ? 0 : this.bgmTargetVolume;
  }

  private playHtmlBgmFallback(): void {
    if (!this.bgmHtmlFallback) return;
    this.bgmHtmlFallback.loop = true;
    this.bgmHtmlFallback.volume = this.isMuted ? 0 : this.bgmTargetVolume;
    void this.bgmHtmlFallback.play().catch(() => {});
  }

  private bindAutoplayUnlockFallback(): void {
    if (this.unlockListenersBound || typeof window === 'undefined') return;
    this.unlockListenersBound = true;

    const unlock = () => {
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume().then(() => {
          if (this.bgmShouldPlay && !this.bgmExplicitlyPaused && !document.hidden) {
            this.startThreeBgmPlayback(0.6);
          }
        }).catch(() => {});
      }
      if (this.ctx.state === 'running') {
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('touchstart', unlock);
        window.removeEventListener('keydown', unlock);
        this.unlockListenersBound = false;
      }
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  private clearBgmFadeTimer(): void {
    if (this.bgmFadeTimer !== null) {
      clearTimeout(this.bgmFadeTimer);
      this.bgmFadeTimer = null;
    }
  }

  private startThreeBgmPlayback(fadeInSec = 0.9): void {
    if (!this.ctx || !this.bgmSound || !this.isBgmLoaded) return;

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }

    const target = this.isMuted ? 0 : this.bgmTargetVolume;
    const now = this.ctx.currentTime;
    const gainParam = this.bgmSound.gain.gain;

    if (!this.bgmSound.isPlaying) {
      gainParam.cancelScheduledValues(now);
      gainParam.setValueAtTime(fadeInSec > 0.02 ? 0.0001 : target, now);
      try {
        this.bgmSound.play();
      } catch {
        return;
      }
    }

    gainParam.cancelScheduledValues(now);
    if (fadeInSec > 0.02 && target > 0) {
      gainParam.setValueAtTime(Math.max(0.0001, gainParam.value), now);
      gainParam.linearRampToValueAtTime(target, now + fadeInSec);
    } else {
      gainParam.setTargetAtTime(target, now, 0.04);
    }
  }

  /**
   * Inicia la música ambiental `school_bgm.mp3` en bucle tras la primera interacción del usuario.
   */
  startBgm(fadeInSec = 1.2) {
    this.init();
    this.clearBgmFadeTimer();
    this.bgmShouldPlay = true;
    this.bgmExplicitlyPaused = false;
    this.bgmTargetVolume = this.bgmBaseGain;

    if (this.isBgmLoaded) {
      this.startThreeBgmPlayback(fadeInSec);
    } else if (this.ctx) {
      this.loadSchoolBgmBuffer();
    } else {
      this.ensureHtmlBgmFallback();
      this.playHtmlBgmFallback();
    }
  }

  /**
   * Pausa inmediatamente la reproducción de la banda sonora ambiental.
   */
  pauseBgm() {
    this.clearBgmFadeTimer();
    this.bgmExplicitlyPaused = true;

    if (this.bgmSound && this.bgmSound.isPlaying) {
      try {
        this.bgmSound.pause();
      } catch {
        // Ignorar
      }
    }

    if (this.bgmHtmlFallback) {
      this.bgmHtmlFallback.pause();
    }
  }

  /**
   * Reanuda la banda sonora ambiental desde el punto en que se pausó.
   */
  resumeBgm(fadeInSec = 0.65) {
    this.clearBgmFadeTimer();
    this.bgmShouldPlay = true;
    this.bgmExplicitlyPaused = false;
    if (this.bgmTargetVolume <= 0.01) {
      this.bgmTargetVolume = this.bgmBaseGain;
    }

    if (this.isBgmLoaded) {
      this.startThreeBgmPlayback(fadeInSec);
    } else if (this.ctx) {
      this.loadSchoolBgmBuffer();
    } else if (this.bgmHtmlFallback) {
      this.playHtmlBgmFallback();
    }
  }

  /**
   * Atenúa progresivamente (fade-out) la BGM al cambiar de escena o entrar en eventos especiales.
   */
  fadeOutBgm(durationSec = 0.85, options: BgmFadeOutOptions = {}) {
    const pauseAfterFade = options.pauseAfterFade ?? false;
    const nextTarget = Math.max(0, Math.min(1, options.targetVolume ?? 0));
    this.bgmTargetVolume = nextTarget;
    this.clearBgmFadeTimer();

    const effectiveTarget = this.isMuted ? 0 : nextTarget;

    if (this.ctx && this.bgmGain) {
      const now = this.ctx.currentTime;
      const safeDuration = Math.max(0.05, durationSec);
      this.bgmGain.gain.cancelScheduledValues(now);
      this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, now);
      this.bgmGain.gain.linearRampToValueAtTime(effectiveTarget, now + safeDuration);

      if (pauseAfterFade) {
        this.bgmFadeTimer = window.setTimeout(() => {
          this.bgmFadeTimer = null;
          this.pauseBgm();
        }, Math.round(safeDuration * 1000) + 40);
      }
      return;
    }

    if (this.bgmHtmlFallback) {
      this.bgmHtmlFallback.volume = effectiveTarget;
      if (pauseAfterFade) {
        this.bgmHtmlFallback.pause();
      }
    }
  }

  /**
   * Restaura progresivamente (fade-in) el volumen ambiental de la BGM.
   */
  fadeInBgm(durationSec = 0.85, targetVolume = this.bgmBaseGain) {
    this.clearBgmFadeTimer();
    this.bgmTargetVolume = Math.max(0, Math.min(1, targetVolume));
    this.bgmShouldPlay = true;
    this.bgmExplicitlyPaused = false;

    if (this.isBgmLoaded) {
      this.startThreeBgmPlayback(durationSec);
    } else if (this.ctx) {
      this.loadSchoolBgmBuffer();
    } else if (this.bgmHtmlFallback) {
      this.playHtmlBgmFallback();
    }
  }

  private handleVisibilityChange = () => {
    if (document.hidden) {
      if (this.bgmSound?.isPlaying || (this.bgmHtmlFallback && !this.bgmHtmlFallback.paused)) {
        this.wasBgmPlayingBeforeHidden = true;
        if (this.bgmSound?.isPlaying) {
          try {
            this.bgmSound.pause();
          } catch {
            // Ignorar
          }
        }
        this.bgmHtmlFallback?.pause();
      } else {
        this.wasBgmPlayingBeforeHidden = false;
      }
    } else if (this.wasBgmPlayingBeforeHidden && !this.bgmExplicitlyPaused && this.bgmShouldPlay) {
      this.wasBgmPlayingBeforeHidden = false;
      this.startThreeBgmPlayback(0.5);
      if (!this.ctx && this.bgmHtmlFallback) {
        this.playHtmlBgmFallback();
      }
    }
  };

  private async preloadConfirmBuffer(): Promise<void> {
    if (!this.ctx || this.confirmBuffer || this.isConfirmLoading) return;
    this.isConfirmLoading = true;

    try {
      const response = await fetch(MENU_CONFIRM_AUDIO_URL);
      if (!response.ok || !this.ctx) return;
      const arrayBuffer = await response.arrayBuffer();
      if (!this.ctx) return;
      this.confirmBuffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
    } catch {
      // Mantiene respaldo HTMLAudioElement activo
    } finally {
      this.isConfirmLoading = false;
    }
  }

  private async preloadSensorSuccessBuffer(): Promise<void> {
    if (!this.ctx || this.sensorSuccessBuffer || this.isSensorSuccessLoading) return;
    this.isSensorSuccessLoading = true;

    try {
      const response = await fetch(SENSOR_SUCCESS_AUDIO_URL);
      if (!response.ok || !this.ctx) return;
      const arrayBuffer = await response.arrayBuffer();
      if (!this.ctx) return;
      this.sensorSuccessBuffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
    } catch {
      // Mantiene respaldo HTMLAudioElement activo
    } finally {
      this.isSensorSuccessLoading = false;
    }
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    this.footsteps.setMuted(muted);

    if (muted) {
      if (this.confirmHtmlAudio) {
        this.confirmHtmlAudio.pause();
        this.confirmHtmlAudio.currentTime = 0;
      }
      if (this.sensorSuccessHtmlAudio) {
        this.sensorSuccessHtmlAudio.pause();
        this.sensorSuccessHtmlAudio.currentTime = 0;
      }
    }

    if (this.bgmHtmlFallback) {
      this.bgmHtmlFallback.volume = muted ? 0 : this.bgmTargetVolume;
    }

    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.bgmGain) {
      this.bgmGain.gain.cancelScheduledValues(now);
      this.bgmGain.gain.setTargetAtTime(muted ? 0 : this.bgmTargetVolume, now, 0.08);
    }
    if (this.sfxGain) {
      this.sfxGain.gain.cancelScheduledValues(now);
      this.sfxGain.gain.setTargetAtTime(muted ? 0 : this.sfxBaseGain, now, 0.08);
    }
    if (this.rewardGain) {
      this.rewardGain.gain.cancelScheduledValues(now);
      this.rewardGain.gain.setTargetAtTime(muted ? 0 : this.rewardBaseGain, now, 0.05);
    }
  }

  updateFootsteps(deltaSeconds: number, isMoving: boolean, speedNormalized = 1) {
    this.footsteps.update(deltaSeconds, isMoving, speedNormalized);
  }

  playFootstep() {
    this.footsteps.triggerNextStep(1);
  }

  playTextTick() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(520 + Math.random() * 50, now);
    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.035);
  }

  private stopActiveSecondaryUiAudio() {
    if (this.ctx && this.activeConfirmSource && this.activeConfirmGain) {
      const now = this.ctx.currentTime;
      try {
        this.activeConfirmGain.gain.cancelScheduledValues(now);
        this.activeConfirmGain.gain.setValueAtTime(
          Math.max(0.0001, this.activeConfirmGain.gain.value),
          now
        );
        this.activeConfirmGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.008);
        this.activeConfirmSource.stop(now + 0.01);
      } catch {
        // Ignorar si ya finalizó
      }
      this.activeConfirmSource = null;
      this.activeConfirmGain = null;
    }

    if (this.confirmHtmlAudio) {
      try {
        this.confirmHtmlAudio.pause();
        this.confirmHtmlAudio.currentTime = 0;
      } catch {
        // Ignorar
      }
    }
  }

  /**
   * Reproduce `menu_confirm.mp3` para confirmaciones, botones de menú, diálogos y selección en modales.
   */
  playConfirm() {
    const nowMs = performance.now();
    if (nowMs < this.suppressConfirmUntilMs) return;
    if (nowMs - this.lastConfirmTriggerMs < 18) return;
    this.lastConfirmTriggerMs = nowMs;

    this.vibrate(18);
    if (this.isMuted) return;

    if (this.ctx && this.sfxGain && this.confirmBuffer) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      const now = this.ctx.currentTime;
      this.stopActiveSecondaryUiAudio();

      const source = this.ctx.createBufferSource();
      source.buffer = this.confirmBuffer;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(this.confirmBufferVolume, now);

      source.connect(gain);
      gain.connect(this.sfxGain);

      this.activeConfirmSource = source;
      this.activeConfirmGain = gain;

      source.onended = () => {
        if (this.activeConfirmSource === source) {
          this.activeConfirmSource = null;
          this.activeConfirmGain = null;
        }
      };

      source.start(now, 0);
      return;
    }

    if (this.confirmHtmlAudio) {
      try {
        this.confirmHtmlAudio.pause();
        this.confirmHtmlAudio.currentTime = 0;
        this.confirmHtmlAudio.volume = this.confirmHtmlVolume;
        void this.confirmHtmlAudio.play().catch(() => {});
      } catch {
        // Ignorar bloqueo previo a gesto del usuario
      }
    }
  }

  playInteractTap() {
    this.playConfirm();
  }

  /**
   * Reproduce el sonido prioritario de éxito/recompensa (`sensor_success`) al completar un sensor o pista.
   * Detiene efectos secundarios de UI, corta la cadencia de pasos y atenúa temporalmente BGM/SFX secundarios.
   */
  playSensorSuccess() {
    this.vibrate([45, 35, 80]);

    this.suppressConfirmUntilMs = performance.now() + 360;
    this.footsteps.reset(false);
    this.stopActiveSecondaryUiAudio();

    if (this.isMuted) return;

    const restoreBgmTarget = this.bgmTargetVolume;

    // 1. Ruta principal Web Audio API con atenuación (ducking) temporal de BGM y pasos
    if (this.ctx && this.rewardGain && this.sensorSuccessBuffer) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      const now = this.ctx.currentTime;
      const clipDuration = this.sensorSuccessBuffer.duration;

      if (this.activeSuccessSource) {
        try {
          this.activeSuccessSource.stop(now);
        } catch {
          // Ignorar
        }
        this.activeSuccessSource = null;
      }

      const duckHoldSec = Math.max(0.8, Math.min(clipDuration * 0.82, 2.2));
      if (this.bgmGain) {
        this.bgmGain.gain.cancelScheduledValues(now);
        this.bgmGain.gain.setTargetAtTime(restoreBgmTarget * 0.22, now, 0.025);
        this.bgmGain.gain.setTargetAtTime(restoreBgmTarget, now + duckHoldSec, 0.28);
      }
      if (this.sfxGain) {
        this.sfxGain.gain.cancelScheduledValues(now);
        this.sfxGain.gain.setTargetAtTime(this.sfxBaseGain * 0.24, now, 0.02);
        this.sfxGain.gain.setTargetAtTime(this.sfxBaseGain, now + duckHoldSec, 0.22);
      }

      const source = this.ctx.createBufferSource();
      source.buffer = this.sensorSuccessBuffer;
      source.connect(this.rewardGain);
      this.activeSuccessSource = source;

      source.onended = () => {
        if (this.activeSuccessSource === source) {
          this.activeSuccessSource = null;
        }
      };

      source.start(now, 0);
      return;
    }

    // 2. Respaldo HTML5 Audio con ducking temporal si decodeAudioData aún sigue en curso
    if (this.sensorSuccessHtmlAudio) {
      try {
        if (this.ctx && this.bgmGain && this.sfxGain) {
          const now = this.ctx.currentTime;
          this.bgmGain.gain.setTargetAtTime(restoreBgmTarget * 0.22, now, 0.025);
          this.sfxGain.gain.setTargetAtTime(this.sfxBaseGain * 0.24, now, 0.02);

          if (this.duckRestoreTimer !== null) {
            clearTimeout(this.duckRestoreTimer);
          }
          this.duckRestoreTimer = window.setTimeout(() => {
            if (!this.ctx || this.isMuted) return;
            const restoreAt = this.ctx.currentTime;
            this.bgmGain?.gain.setTargetAtTime(this.bgmTargetVolume, restoreAt, 0.25);
            this.sfxGain?.gain.setTargetAtTime(this.sfxBaseGain, restoreAt, 0.22);
          }, 1600);
        }

        this.sensorSuccessHtmlAudio.pause();
        this.sensorSuccessHtmlAudio.currentTime = 0;
        this.sensorSuccessHtmlAudio.volume = this.sensorSuccessHtmlVolume;
        void this.sensorSuccessHtmlAudio.play().catch(() => {});
      } catch {
        // Ignorar bloqueo previo a gesto del usuario
      }
    }
  }

  /**
   * Alias de compatibilidad hacia el efecto de éxito/recompensa de pista.
   */
  playClueUnlocked() {
    this.playSensorSuccess();
  }

  playStairsTransition() {
    this.vibrate([30, 50, 30, 50, 40]);
    if (this.isMuted) return;
    this.footsteps.reset(false);
    [0, 0.16, 0.32, 0.48].forEach((delaySec) => {
      this.footsteps.triggerNextStep(1, delaySec);
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
    this.clearBgmFadeTimer();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (this.duckRestoreTimer !== null) {
      clearTimeout(this.duckRestoreTimer);
      this.duckRestoreTimer = null;
    }
    if (this.bgmSound) {
      try {
        if (this.bgmSound.isPlaying) {
          this.bgmSound.stop();
        }
        this.bgmSound.disconnect();
      } catch {
        // Ignorar
      }
      this.bgmSound = null;
    }
    if (this.listener && this.listener.parent) {
      this.listener.parent.remove(this.listener);
    }
    this.listener = null;
    if (this.bgmHtmlFallback) {
      this.bgmHtmlFallback.pause();
      this.bgmHtmlFallback = null;
    }
    if (this.confirmHtmlAudio) {
      this.confirmHtmlAudio.pause();
      this.confirmHtmlAudio = null;
    }
    if (this.sensorSuccessHtmlAudio) {
      this.sensorSuccessHtmlAudio.pause();
      this.sensorSuccessHtmlAudio = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export const soundEngine = new SoundEngine();
