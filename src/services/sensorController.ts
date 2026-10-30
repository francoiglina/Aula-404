import * as THREE from 'three';
import { AudioMetrics, MotionAndLightMetrics, OrientationData } from '../types';

export class SensorController {
  public gyroscopeAllowed = false;
  public micAllowed = false;
  public cameraAllowed = false;
  public facingMode: 'environment' | 'user' = 'environment';

  // Raw and Lerp-smoothed orientation
  private rawOrientation: OrientationData = { alpha: 0, beta: 60, gamma: 0 };
  public smoothedOrientation: OrientationData = { alpha: 0, beta: 60, gamma: 0 };
  private baselineAlpha: number | null = null;
  private simulatedTilt: { beta: number; gamma: number } | null = null;

  // Motion / Shake detector (Hotaru)
  private lastAccel = { x: 0, y: 0, z: 0, initialized: false };
  private rawShakeImpulse = 0;

  // Web Audio Microphone (Kaeru)
  private micAudioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private freqBins: Uint8Array | null = null;
  private micStream: MediaStream | null = null;
  private simulatedMicLevel = 0;

  // WebRTC Camera & Ambient Light (Hanako + AR Skybox/Mirror)
  private videoEl: HTMLVideoElement | null = null;
  private camStream: MediaStream | null = null;
  public videoTexture: THREE.VideoTexture | null = null;
  private fallbackCanvas: HTMLCanvasElement;
  private fallbackCtx: CanvasRenderingContext2D;
  public fallbackTexture: THREE.CanvasTexture;

  private luminanceSampleCanvas: HTMLCanvasElement;
  private luminanceSampleCtx: CanvasRenderingContext2D | null;
  private hardwareLuxBrightness: number | null = null;
  private simulatedBrightness: number | null = null;
  private lastLuminanceSampleTime = 0;

  public audioMetrics: AudioMetrics = { volume: 0, bassLevel: 0 };
  public motionLightMetrics: MotionAndLightMetrics = {
    shakeIntensity: 0,
    ambientBrightness: 0.65,
  };

  constructor() {
    this.fallbackCanvas = document.createElement('canvas');
    this.fallbackCanvas.width = 256;
    this.fallbackCanvas.height = 256;
    this.fallbackCtx = this.fallbackCanvas.getContext('2d')!;
    this.drawFallbackCameraFrame(0);
    this.fallbackTexture = new THREE.CanvasTexture(this.fallbackCanvas);
    this.fallbackTexture.colorSpace = THREE.SRGBColorSpace;

    this.luminanceSampleCanvas = document.createElement('canvas');
    this.luminanceSampleCanvas.width = 16;
    this.luminanceSampleCanvas.height = 16;
    this.luminanceSampleCtx = this.luminanceSampleCanvas.getContext('2d', {
      willReadFrequently: true,
    });

    this.initAmbientLightSensorIfSupported();
  }

  private initAmbientLightSensorIfSupported() {
    try {
      const AmbientSensorCtor = (window as unknown as { AmbientLightSensor?: new () => { illuminance: number; start: () => void; addEventListener: (ev: string, cb: () => void) => void } }).AmbientLightSensor;
      if (AmbientSensorCtor) {
        const sensor = new AmbientSensorCtor();
        sensor.addEventListener('reading', () => {
          // Normalize typical indoor lux (0..350 lux) to 0..1
          this.hardwareLuxBrightness = THREE.MathUtils.clamp(sensor.illuminance / 280, 0, 1);
        });
        sensor.start();
      }
    } catch {
      // AmbientLightSensor requires flag or HTTPS permission in some browsers; camera luminance covers all devices
    }
  }

  async requestAllPermissions(): Promise<{
    gyroscopeAllowed: boolean;
    micAllowed: boolean;
    cameraAllowed: boolean;
  }> {
    await this.requestMotionAndOrientation();
    await this.requestMicrophone();
    await this.requestCamera(this.facingMode);
    return {
      gyroscopeAllowed: this.gyroscopeAllowed,
      micAllowed: this.micAllowed,
      cameraAllowed: this.cameraAllowed,
    };
  }

  async requestMotionAndOrientation(): Promise<boolean> {
    let granted = false;
    try {
      const DOE = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      const DME = (typeof DeviceMotionEvent !== 'undefined' ? DeviceMotionEvent : {}) as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };

      if (typeof DOE.requestPermission === 'function') {
        const res = await DOE.requestPermission();
        granted = res === 'granted';
      } else if ('ondeviceorientation' in window) {
        granted = true;
      }

      if (typeof DME.requestPermission === 'function') {
        await DME.requestPermission().catch(() => {});
      }

      if (granted) {
        window.addEventListener('deviceorientation', this.handleOrientation, { passive: true });
        window.addEventListener('devicemotion', this.handleMotion, { passive: true });
      }
    } catch {
      granted = false;
    }

    this.gyroscopeAllowed = granted;
    return granted;
  }

  private handleOrientation = (e: DeviceOrientationEvent) => {
    if (e.alpha === null && e.beta === null && e.gamma === null) return;
    if (this.baselineAlpha === null && e.alpha !== null) {
      this.baselineAlpha = e.alpha;
    }
    this.rawOrientation.alpha = e.alpha ?? 0;
    this.rawOrientation.beta = e.beta ?? 60;
    this.rawOrientation.gamma = e.gamma ?? 0;
  };

  private handleMotion = (e: DeviceMotionEvent) => {
    const acc = e.accelerationIncludingGravity || e.acceleration;
    if (!acc) return;
    const x = acc.x ?? 0;
    const y = acc.y ?? 0;
    const z = acc.z ?? 0;

    if (!this.lastAccel.initialized) {
      this.lastAccel = { x, y, z, initialized: true };
      return;
    }

    const dx = Math.abs(x - this.lastAccel.x);
    const dy = Math.abs(y - this.lastAccel.y);
    const dz = Math.abs(z - this.lastAccel.z);
    this.lastAccel.x = x;
    this.lastAccel.y = y;
    this.lastAccel.z = z;

    const deltaMag = dx + dy + dz;
    // Threshold > 11 m/s^2 delta corresponds to intentional physical shake
    if (deltaMag > 9.5) {
      const normalized = THREE.MathUtils.clamp((deltaMag - 9.5) / 22, 0, 1);
      this.rawShakeImpulse = Math.max(this.rawShakeImpulse, normalized);
    }
  };

  async requestMicrophone(): Promise<boolean> {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return false;
      if (this.micStream) return true;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.micStream = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.micAudioCtx = new AudioCtx();
      const source = this.micAudioCtx.createMediaStreamSource(stream);
      this.analyser = this.micAudioCtx.createAnalyser();
      this.analyser.fftSize = 128; // SDD Section 3.2 specification
      this.analyser.smoothingTimeConstant = 0.65;
      source.connect(this.analyser);

      this.freqBins = new Uint8Array(this.analyser.frequencyBinCount);
      this.micAllowed = true;
      return true;
    } catch {
      this.micAllowed = false;
      return false;
    }
  }

  async requestCamera(mode: 'environment' | 'user' = 'environment'): Promise<boolean> {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return false;

      if (this.camStream) {
        this.camStream.getTracks().forEach((t) => t.stop());
        this.camStream = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 480 },
          height: { ideal: 360 },
        },
        audio: false,
      });

      this.camStream = stream;
      this.facingMode = mode;

      if (!this.videoEl) {
        this.videoEl = document.createElement('video');
        this.videoEl.setAttribute('playsinline', 'true');
        this.videoEl.setAttribute('autoplay', 'true');
        this.videoEl.muted = true;
        this.videoEl.style.position = 'fixed';
        this.videoEl.style.width = '1px';
        this.videoEl.style.height = '1px';
        this.videoEl.style.opacity = '0';
        this.videoEl.style.pointerEvents = 'none';
        document.body.appendChild(this.videoEl);
      }

      this.videoEl.srcObject = stream;
      await this.videoEl.play();

      if (!this.videoTexture) {
        this.videoTexture = new THREE.VideoTexture(this.videoEl);
        this.videoTexture.colorSpace = THREE.SRGBColorSpace;
        this.videoTexture.minFilter = THREE.LinearFilter;
        this.videoTexture.magFilter = THREE.LinearFilter;
      }

      this.cameraAllowed = true;
      return true;
    } catch {
      this.cameraAllowed = false;
      return false;
    }
  }

  async toggleCameraFacing(): Promise<'environment' | 'user'> {
    const next = this.facingMode === 'environment' ? 'user' : 'environment';
    await this.requestCamera(next);
    return this.facingMode;
  }

  recenterGyroBaseline() {
    this.baselineAlpha = this.rawOrientation.alpha;
    this.simulatedTilt = null;
  }

  // Accessible fallback methods for desktop or sensor-restricted browsers
  pulseSimulatedShake(strength = 0.85) {
    this.rawShakeImpulse = Math.max(this.rawShakeImpulse, strength);
    this.vibrate(25);
  }

  setSimulatedMicBlow(active: boolean) {
    this.simulatedMicLevel = active ? 0.78 : 0;
  }

  setSimulatedBrightness(val: number | null) {
    this.simulatedBrightness = val;
  }

  setSimulatedTilt(beta: number, gamma: number) {
    this.simulatedTilt = { beta, gamma };
  }

  clearSimulatedTilt() {
    this.simulatedTilt = null;
  }

  vibrate(pattern: number | number[] = 35) {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore on unsupported browsers
      }
    }
  }

  getActiveCameraTexture(): THREE.Texture {
    if (this.cameraAllowed && this.videoTexture) {
      return this.videoTexture;
    }
    return this.fallbackTexture;
  }

  private drawFallbackCameraFrame(t: number) {
    const ctx = this.fallbackCtx;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 256, 256);

    const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 130);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.24)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0.96)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    const yLine = (t * 48) % 256;
    ctx.fillStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.fillRect(0, yLine, 256, 2);
  }

  update(delta: number, elapsedTime: number) {
    // 1. SDD Section 3.1: Lerp smoothing on alpha, beta, gamma
    const smoothFactor = 1 - Math.exp(-8.5 * delta);
    const targetBeta = this.simulatedTilt ? this.simulatedTilt.beta : this.rawOrientation.beta;
    const targetGamma = this.simulatedTilt ? this.simulatedTilt.gamma : this.rawOrientation.gamma;
    const relAlpha =
      this.baselineAlpha !== null ? this.rawOrientation.alpha - this.baselineAlpha : 0;

    this.smoothedOrientation.alpha = THREE.MathUtils.lerp(
      this.smoothedOrientation.alpha,
      relAlpha,
      smoothFactor
    );
    this.smoothedOrientation.beta = THREE.MathUtils.lerp(
      this.smoothedOrientation.beta,
      targetBeta,
      smoothFactor
    );
    this.smoothedOrientation.gamma = THREE.MathUtils.lerp(
      this.smoothedOrientation.gamma,
      targetGamma,
      smoothFactor
    );

    // 2. Shake decay
    this.motionLightMetrics.shakeIntensity = THREE.MathUtils.lerp(
      this.motionLightMetrics.shakeIntensity,
      this.rawShakeImpulse,
      1 - Math.exp(-14 * delta)
    );
    this.rawShakeImpulse = Math.max(0, this.rawShakeImpulse - delta * 2.4);

    // 3. SDD Section 3.2: Web Audio Microphone metrics
    let realMic = 0;
    let realBass = 0;
    if (this.analyser && this.freqBins) {
      this.analyser.getByteFrequencyData(this.freqBins as Uint8Array<ArrayBuffer>);
      let total = 0;
      let bassTotal = 0;
      const n = this.freqBins.length;
      const bassCount = Math.max(1, Math.floor(n * 0.25));
      for (let i = 0; i < n; i++) {
        total += this.freqBins[i];
        if (i < bassCount) bassTotal += this.freqBins[i];
      }
      realMic = total / (n * 255);
      realBass = bassTotal / (bassCount * 255);
    }

    const targetVol = Math.max(realMic, this.simulatedMicLevel);
    this.audioMetrics.volume = THREE.MathUtils.lerp(
      this.audioMetrics.volume,
      targetVol,
      1 - Math.exp(-12 * delta)
    );
    this.audioMetrics.bassLevel = THREE.MathUtils.lerp(
      this.audioMetrics.bassLevel,
      Math.max(realBass, this.simulatedMicLevel * 0.85),
      1 - Math.exp(-12 * delta)
    );

    // 4. Ambient brightness from hardware lux sensor OR WebRTC video frame luminance
    if (this.simulatedBrightness !== null) {
      this.motionLightMetrics.ambientBrightness = THREE.MathUtils.lerp(
        this.motionLightMetrics.ambientBrightness,
        this.simulatedBrightness,
        1 - Math.exp(-10 * delta)
      );
    } else if (this.hardwareLuxBrightness !== null) {
      this.motionLightMetrics.ambientBrightness = THREE.MathUtils.lerp(
        this.motionLightMetrics.ambientBrightness,
        this.hardwareLuxBrightness,
        1 - Math.exp(-8 * delta)
      );
    } else if (
      this.cameraAllowed &&
      this.videoEl &&
      this.videoEl.readyState >= 2 &&
      this.luminanceSampleCtx &&
      elapsedTime - this.lastLuminanceSampleTime > 0.12
    ) {
      this.lastLuminanceSampleTime = elapsedTime;
      try {
        this.luminanceSampleCtx.drawImage(this.videoEl, 0, 0, 16, 16);
        const pixels = this.luminanceSampleCtx.getImageData(0, 0, 16, 16).data;
        let lumaSum = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          lumaSum += (0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]) / 255;
        }
        const avgBrightness = lumaSum / (pixels.length / 4);
        this.motionLightMetrics.ambientBrightness = THREE.MathUtils.lerp(
          this.motionLightMetrics.ambientBrightness,
          avgBrightness,
          0.35
        );
      } catch {
        // Ignore cross-frame read glitches
      }
    }

    if (!this.cameraAllowed) {
      this.drawFallbackCameraFrame(elapsedTime);
      this.fallbackTexture.needsUpdate = true;
    }
  }

  dispose() {
    window.removeEventListener('deviceorientation', this.handleOrientation);
    window.removeEventListener('devicemotion', this.handleMotion);
    if (this.camStream) {
      this.camStream.getTracks().forEach((t) => t.stop());
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
    }
    if (this.videoEl?.parentNode) {
      this.videoEl.parentNode.removeChild(this.videoEl);
    }
    if (this.micAudioCtx) {
      this.micAudioCtx.close().catch(() => {});
    }
    this.fallbackTexture.dispose();
    this.videoTexture?.dispose();
  }
}

export const sensorController = new SensorController();
