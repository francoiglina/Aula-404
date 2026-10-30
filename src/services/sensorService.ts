import * as THREE from 'three';

export class SensorService {
  public permissions = {
    gyroscopeAllowed: false,
    motionAllowed: false,
    micAllowed: false,
    cameraAllowed: false,
    lightSensorAllowed: false,
    facingMode: 'environment' as 'environment' | 'user',
  };

  // 1. Gyroscope / Orientation (Isolated: disabled by default, enabled only on-demand in PASO 6)
  public isGyroActive = false;
  private rawOrientation = { alpha: 0, beta: 65, gamma: 0 };
  private calibrationOffset = { alpha: 0, beta: 65, gamma: 0 };
  private hasInitialCalibration = false;
  public orientation = { alpha: 0, beta: 0, gamma: 0 }; // Relative calibrated degrees
  public absoluteOrientation = { alpha: 0, beta: 0, gamma: 0 }; // Smoothed raw degrees
  public simulatedTilt: { beta: number; gamma: number } | null = null;

  // 2. Accelerometer / Shake
  private lastAccel = { x: 0, y: 0, z: 0, initialized: false };
  private lastShakeMs = 0;
  public shakeIntensity = 0;
  public totalShakes = 0;
  public onShakeSpike?: (intensity: number) => void;

  // 3. Microphone (Web Audio API AnalyserNode)
  private micContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private freqBins: Uint8Array | null = null;
  private simulatedAudioBoost = 0;
  public audioMetrics = {
    volume: 0,
    bassLevel: 0,
  };

  // 4. Camera (WebRTC VideoTexture + Luminance Light Detector)
  public videoElement: HTMLVideoElement | null = null;
  private cameraStream: MediaStream | null = null;
  public videoTexture: THREE.VideoTexture | null = null;
  public fallbackMirrorTexture: THREE.CanvasTexture;
  private mirrorCanvas: HTMLCanvasElement;
  private mirrorCtx: CanvasRenderingContext2D;

  private luminanceCanvas: HTMLCanvasElement;
  private luminanceCtx: CanvasRenderingContext2D | null;
  private lastLuminanceSampleMs = 0;
  private nativeLux: number | null = null;
  public simulatedLuminance: number | null = null;
  public lightMetrics = {
    luminance: 145, // 0..255
    isDark: false,
  };

  constructor() {
    this.mirrorCanvas = document.createElement('canvas');
    this.mirrorCanvas.width = 512;
    this.mirrorCanvas.height = 512;
    this.mirrorCtx = this.mirrorCanvas.getContext('2d')!;
    this.drawFallbackMirror(0);
    this.fallbackMirrorTexture = new THREE.CanvasTexture(this.mirrorCanvas);
    this.fallbackMirrorTexture.colorSpace = THREE.SRGBColorSpace;

    this.luminanceCanvas = document.createElement('canvas');
    this.luminanceCanvas.width = 32;
    this.luminanceCanvas.height = 32;
    this.luminanceCtx = this.luminanceCanvas.getContext('2d', { willReadFrequently: true });
  }

  // Startup permissions: intentionally excludes DeviceOrientationEvent.requestPermission()
  async requestAllPermissions() {
    await this.requestMotionOnly();
    await this.requestMicrophone();
    await this.requestCamera('environment');
    this.initAmbientLightSensor();
    return { ...this.permissions };
  }

  async requestMotionOnly(): Promise<boolean> {
    let motionGranted = false;
    try {
      const DME = DeviceMotionEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DME.requestPermission === 'function') {
        const res = await DME.requestPermission();
        motionGranted = res === 'granted';
      } else if (typeof window !== 'undefined' && 'ondevicemotion' in window) {
        motionGranted = true;
      }
    } catch {
      motionGranted = false;
    }

    if (motionGranted) {
      window.removeEventListener('devicemotion', this.handleMotion);
      window.addEventListener('devicemotion', this.handleMotion, { passive: true });
    }
    this.permissions.motionAllowed = motionGranted;
    return motionGranted;
  }

  // On-demand gyroscope activation exclusively for minigames that require it (e.g. PASO 6 / ESTADO_5)
  async enableGyroscope(): Promise<boolean> {
    let orientationGranted = this.permissions.gyroscopeAllowed;

    if (!orientationGranted) {
      try {
        const DOE = DeviceOrientationEvent as unknown as {
          requestPermission?: () => Promise<'granted' | 'denied'>;
        };
        if (
          typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DOE.requestPermission === 'function'
        ) {
          const res = await DOE.requestPermission();
          orientationGranted = res === 'granted';
        } else if (typeof window !== 'undefined' && 'ondeviceorientation' in window) {
          orientationGranted = true;
        }
      } catch {
        orientationGranted = false;
      }
    }

    this.permissions.gyroscopeAllowed = orientationGranted;

    if (orientationGranted && !this.isGyroActive) {
      this.hasInitialCalibration = false;
      window.addEventListener('deviceorientation', this.handleOrientation, { passive: true });
      this.isGyroActive = true;
    }

    return orientationGranted;
  }

  disableGyroscope() {
    if (this.isGyroActive) {
      window.removeEventListener('deviceorientation', this.handleOrientation);
      this.isGyroActive = false;
    }
    this.simulatedTilt = null;
  }

  private handleOrientation = (e: DeviceOrientationEvent) => {
    if (e.alpha === null && e.beta === null && e.gamma === null) return;
    const alpha = e.alpha ?? 0;
    const beta = e.beta ?? 0;
    const gamma = e.gamma ?? 0;

    if (!this.hasInitialCalibration) {
      this.calibrationOffset = { alpha, beta, gamma };
      this.hasInitialCalibration = true;
    }

    this.rawOrientation = { alpha, beta, gamma };
  };

  recalibrateGyro() {
    this.calibrationOffset = { ...this.rawOrientation };
    this.simulatedTilt = null;
  }

  private handleMotion = (e: DeviceMotionEvent) => {
    const acc = e.accelerationIncludingGravity || e.acceleration;
    if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

    if (!this.lastAccel.initialized) {
      this.lastAccel = { x: acc.x, y: acc.y, z: acc.z, initialized: true };
      return;
    }

    const dx = acc.x - this.lastAccel.x;
    const dy = acc.y - this.lastAccel.y;
    const dz = acc.z - this.lastAccel.z;
    this.lastAccel = { x: acc.x, y: acc.y, z: acc.z, initialized: true };

    const deltaMagnitude = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (deltaMagnitude > 11.5) {
      const normalized = Math.min(1, deltaMagnitude / 26);
      this.shakeIntensity = Math.max(this.shakeIntensity, normalized);

      const now = performance.now();
      if (now - this.lastShakeMs > 170) {
        this.lastShakeMs = now;
        this.totalShakes += 1;
        this.onShakeSpike?.(normalized);
      }
    }
  };

  triggerSimulatedShake(force = 0.85) {
    this.shakeIntensity = Math.max(this.shakeIntensity, force);
    this.totalShakes += 1;
    this.onShakeSpike?.(force);
  }

  async requestMicrophone(): Promise<boolean> {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.micStream = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.micContext = new AudioCtx();
      const source = this.micContext.createMediaStreamSource(stream);

      this.analyser = this.micContext.createAnalyser();
      this.analyser.fftSize = 128; // SDD Section 3.2: fftSize = 64 or 128
      this.analyser.smoothingTimeConstant = 0.65;
      source.connect(this.analyser);

      this.freqBins = new Uint8Array(this.analyser.frequencyBinCount);
      this.permissions.micAllowed = true;
      return true;
    } catch {
      this.permissions.micAllowed = false;
      return false;
    }
  }

  triggerSimulatedBlow(level = 0.82, durationMs = 1100) {
    this.simulatedAudioBoost = level;
    window.setTimeout(() => {
      this.simulatedAudioBoost = 0;
    }, durationMs);
  }

  async requestCamera(facingMode: 'environment' | 'user' = 'environment'): Promise<boolean> {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return false;

      if (this.cameraStream) {
        this.cameraStream.getTracks().forEach((t) => t.stop());
        this.cameraStream = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 480 },
          height: { ideal: 360 },
        },
        audio: false,
      });

      this.cameraStream = stream;
      this.permissions.facingMode = facingMode;

      if (!this.videoElement) {
        const video = document.createElement('video');
        video.setAttribute('playsinline', 'true');
        video.setAttribute('autoplay', 'true');
        video.setAttribute('muted', 'true');
        video.muted = true;
        video.style.position = 'fixed';
        video.style.width = '1px';
        video.style.height = '1px';
        video.style.opacity = '0';
        video.style.pointerEvents = 'none';
        document.body.appendChild(video);
        this.videoElement = video;
      }

      this.videoElement.srcObject = stream;
      await this.videoElement.play();

      if (!this.videoTexture) {
        this.videoTexture = new THREE.VideoTexture(this.videoElement);
        this.videoTexture.colorSpace = THREE.SRGBColorSpace;
        this.videoTexture.minFilter = THREE.LinearFilter;
        this.videoTexture.magFilter = THREE.LinearFilter;
      }

      this.permissions.cameraAllowed = true;
      return true;
    } catch {
      this.permissions.cameraAllowed = false;
      return false;
    }
  }

  async toggleCameraFacing(): Promise<'environment' | 'user'> {
    const next = this.permissions.facingMode === 'environment' ? 'user' : 'environment';
    await this.requestCamera(next);
    return next;
  }

  private initAmbientLightSensor() {
    try {
      const ALS = (window as unknown as { AmbientLightSensor?: new () => { illuminance: number; onreading: () => void; start: () => void } }).AmbientLightSensor;
      if (ALS) {
        const sensor = new ALS();
        sensor.onreading = () => {
          this.nativeLux = sensor.illuminance;
          this.permissions.lightSensorAllowed = true;
        };
        sensor.start();
      }
    } catch {
      // Fallback uses camera frame luminance automatically
    }
  }

  private sampleCameraLuminance(nowMs: number) {
    if (this.simulatedLuminance !== null) {
      this.lightMetrics.luminance = THREE.MathUtils.lerp(
        this.lightMetrics.luminance,
        this.simulatedLuminance,
        0.25
      );
      this.lightMetrics.isDark = this.lightMetrics.luminance < 48;
      return;
    }

    if (this.nativeLux !== null) {
      const mapped = THREE.MathUtils.clamp((this.nativeLux / 250) * 255, 0, 255);
      this.lightMetrics.luminance = THREE.MathUtils.lerp(this.lightMetrics.luminance, mapped, 0.25);
      this.lightMetrics.isDark = this.lightMetrics.luminance < 48;
      return;
    }

    if (nowMs - this.lastLuminanceSampleMs < 140) return;
    this.lastLuminanceSampleMs = nowMs;

    if (
      this.permissions.cameraAllowed &&
      this.videoElement &&
      this.videoElement.readyState >= 2 &&
      this.luminanceCtx
    ) {
      try {
        this.luminanceCtx.drawImage(this.videoElement, 0, 0, 32, 32);
        const pixels = this.luminanceCtx.getImageData(0, 0, 32, 32).data;
        let total = 0;
        const count = pixels.length / 4;
        for (let i = 0; i < pixels.length; i += 4) {
          total += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
        }
        const avg = total / count;
        this.lightMetrics.luminance = THREE.MathUtils.lerp(this.lightMetrics.luminance, avg, 0.35);
        this.lightMetrics.isDark = this.lightMetrics.luminance < 52;
      } catch {
        // Ignore security/frame read issues
      }
    }
  }

  private drawFallbackMirror(elapsed: number) {
    const ctx = this.mirrorCtx;
    const w = 512;
    const h = 512;

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1c1917');
    grad.addColorStop(0.5, '#292524');
    grad.addColorStop(1, '#0c0a09');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle mist ripple in bathroom mirror
    const glowAlpha = this.lightMetrics.isDark ? 0.55 : 0.14;
    ctx.strokeStyle = `rgba(234, 88, 12, ${glowAlpha})`;
    ctx.lineWidth = 3;
    for (let r = 0; r < 4; r++) {
      const radius = 60 + r * 42 + Math.sin(elapsed * 1.8 + r) * 8;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.lightMetrics.isDark) {
      ctx.fillStyle = '#fdba74';
      ctx.font = 'bold 42px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('SALA DE PROFESORES', w / 2, h / 2 - 12);
      ctx.font = '26px monospace';
      ctx.fillText('ALA IZQUIERDA · 2F', w / 2, h / 2 + 34);
    }
  }

  getActiveVideoOrMirrorTexture(): THREE.Texture {
    if (this.permissions.cameraAllowed && this.videoTexture) {
      return this.videoTexture;
    }
    return this.fallbackMirrorTexture;
  }

  // Per-frame sensor smoothing (gyroscope Lerp runs ONLY when isolated gyro capture is active)
  update(delta: number, elapsed: number) {
    const smooth = Math.min(1, delta * 8.0);

    if (this.simulatedTilt) {
      this.absoluteOrientation.beta = THREE.MathUtils.lerp(
        this.absoluteOrientation.beta,
        this.simulatedTilt.beta,
        smooth
      );
      this.absoluteOrientation.gamma = THREE.MathUtils.lerp(
        this.absoluteOrientation.gamma,
        this.simulatedTilt.gamma,
        smooth
      );
      this.orientation.beta = this.absoluteOrientation.beta;
      this.orientation.gamma = this.absoluteOrientation.gamma;
    } else if (this.isGyroActive) {
      this.absoluteOrientation.alpha = THREE.MathUtils.lerp(
        this.absoluteOrientation.alpha,
        this.rawOrientation.alpha,
        smooth
      );
      this.absoluteOrientation.beta = THREE.MathUtils.lerp(
        this.absoluteOrientation.beta,
        this.rawOrientation.beta,
        smooth
      );
      this.absoluteOrientation.gamma = THREE.MathUtils.lerp(
        this.absoluteOrientation.gamma,
        this.rawOrientation.gamma,
        smooth
      );

      const relBeta = THREE.MathUtils.clamp(
        this.rawOrientation.beta - this.calibrationOffset.beta,
        -65,
        65
      );
      const relGamma = THREE.MathUtils.clamp(
        this.rawOrientation.gamma - this.calibrationOffset.gamma,
        -65,
        65
      );
      this.orientation.alpha = THREE.MathUtils.lerp(
        this.orientation.alpha,
        this.rawOrientation.alpha - this.calibrationOffset.alpha,
        smooth
      );
      this.orientation.beta = THREE.MathUtils.lerp(this.orientation.beta, relBeta, smooth);
      this.orientation.gamma = THREE.MathUtils.lerp(this.orientation.gamma, relGamma, smooth);
    }

    // Decay shake intensity smoothly
    this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 4.5, delta);

    // Update Web Audio microphone metrics
    if (this.analyser && this.freqBins) {
      this.analyser.getByteFrequencyData(this.freqBins as Uint8Array<ArrayBuffer>);
      let sum = 0;
      let bass = 0;
      const len = this.freqBins.length;
      const bassCount = Math.max(1, Math.floor(len * 0.25));

      for (let i = 0; i < len; i++) {
        sum += this.freqBins[i];
        if (i < bassCount) bass += this.freqBins[i];
      }

      const normVol = Math.min(1, (sum / (len * 255)) * 2.2);
      const normBass = Math.min(1, (bass / (bassCount * 255)) * 1.8);
      const targetVol = Math.max(normVol, this.simulatedAudioBoost);

      this.audioMetrics.volume = THREE.MathUtils.lerp(this.audioMetrics.volume, targetVol, delta * 12);
      this.audioMetrics.bassLevel = THREE.MathUtils.lerp(this.audioMetrics.bassLevel, normBass, delta * 12);
    } else {
      this.audioMetrics.volume = THREE.MathUtils.lerp(
        this.audioMetrics.volume,
        this.simulatedAudioBoost,
        delta * 10
      );
      this.audioMetrics.bassLevel = this.audioMetrics.volume * 0.75;
    }

    // Update Light / Camera luminance
    this.sampleCameraLuminance(performance.now());

    if (!this.permissions.cameraAllowed) {
      this.drawFallbackMirror(elapsed);
      this.fallbackMirrorTexture.needsUpdate = true;
    }
  }

  dispose() {
    window.removeEventListener('deviceorientation', this.handleOrientation);
    window.removeEventListener('devicemotion', this.handleMotion);

    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((t) => t.stop());
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
    }
    if (this.videoElement?.parentNode) {
      this.videoElement.parentNode.removeChild(this.videoElement);
    }
    if (this.micContext) {
      this.micContext.close().catch(() => {});
    }
  }
}

export const sensorService = new SensorService();
