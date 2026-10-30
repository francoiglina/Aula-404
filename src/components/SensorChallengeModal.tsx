import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Compass,
  Hand,
  Mic,
  RefreshCw,
  Smartphone,
  SunDim,
  SwitchCamera,
  X,
} from 'lucide-react';
import { sensorService } from '../services/sensorService';
import { soundEngine } from '../services/soundEngine';
import { SensorChallengeType } from '../types';

interface SensorChallengeModalProps {
  challengeType: SensorChallengeType;
  onComplete: (challengeType: SensorChallengeType) => void;
  onClose: () => void;
}

export const SensorChallengeModal: React.FC<SensorChallengeModalProps> = ({
  challengeType,
  onComplete,
  onClose,
}) => {
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);

  // Step 2: Closet tactile state
  const [closetStage, setClosetStage] = useState<0 | 1 | 2 | 3>(0);

  // Live sensor telemetry readouts for UI feedback
  const [liveVolume, setLiveVolume] = useState(0);
  const [liveShake, setLiveShake] = useState(0);
  const [liveLuminance, setLiveLuminance] = useState(145);
  const [liveTilt, setLiveTilt] = useState({ beta: 14, gamma: -12 });
  const [micGranted, setMicGranted] = useState(sensorService.permissions.micAllowed);
  const [camGranted, setCamGranted] = useState(sensorService.permissions.cameraAllowed);
  const [gyroGranted, setGyroGranted] = useState(sensorService.permissions.gyroscopeAllowed);

  const mirrorPreviewRef = useRef<HTMLCanvasElement | null>(null);
  const gyroTargetOffset = useRef({ beta: 14, gamma: -11 });
  const hasInitializedGyroOffset = useRef(false);
  const completedRef = useRef(false);

  const finishChallenge = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setCompleted(true);
    setProgress(100);
    sensorService.simulatedLuminance = null;
    sensorService.simulatedTilt = null;
    soundEngine.playClueUnlocked();

    window.setTimeout(() => {
      onComplete(challengeType);
    }, 950);
  };

  // Reset state when challenge opens & manage isolated gyroscope lifecycle for PASO 6
  useEffect(() => {
    completedRef.current = false;
    setCompleted(false);
    setProgress(0);
    setClosetStage(0);
    hasInitializedGyroOffset.current = false;

    if (challengeType === 'gyro_profesor') {
      void sensorService.enableGyroscope().then((ok) => {
        setGyroGranted(ok);
      });
    }

    return () => {
      sensorService.simulatedLuminance = null;
      sensorService.simulatedTilt = null;
      sensorService.onShakeSpike = undefined;
      if (challengeType === 'gyro_profesor') {
        sensorService.disableGyroscope();
      }
    };
  }, [challengeType]);

  // Shake listener for Step 3 (Aparcabicicletas)
  useEffect(() => {
    if (challengeType !== 'shake_bikes') return;

    sensorService.onShakeSpike = (intensity) => {
      if (completedRef.current) return;
      soundEngine.vibrate(35);
      setProgress((prev) => {
        const next = Math.min(100, prev + Math.max(18, Math.round(intensity * 28)));
        if (next >= 100) {
          finishChallenge();
        }
        return next;
      });
    };

    return () => {
      sensorService.onShakeSpike = undefined;
    };
  }, [challengeType]);

  // Continuous RAF sensor loop for Mic, Light/Camera, Shake bar, and Gyroscope
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (challengeType === 'shake_bikes') {
        setLiveShake(sensorService.shakeIntensity);
      } else if (challengeType === 'mic_whisper') {
        const vol = sensorService.audioMetrics.volume;
        setLiveVolume(vol);
        setMicGranted(sensorService.permissions.micAllowed);

        if (!completedRef.current && vol > 0.14) {
          setProgress((prev) => {
            const next = Math.min(100, prev + dt * (38 + vol * 45));
            if (next >= 100) {
              finishChallenge();
            }
            return next;
          });
        }
      } else if (challengeType === 'light_hanako') {
        const lum = Math.round(sensorService.lightMetrics.luminance);
        setLiveLuminance(lum);
        setCamGranted(sensorService.permissions.cameraAllowed);

        // Draw live mirror preview canvas
        const canvas = mirrorPreviewRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            if (
              sensorService.permissions.cameraAllowed &&
              sensorService.videoElement &&
              sensorService.videoElement.readyState >= 2
            ) {
              ctx.drawImage(sensorService.videoElement, 0, 0, canvas.width, canvas.height);
              ctx.fillStyle = `rgba(12, 10, 9, ${Math.max(0.18, 1 - lum / 180)})`;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else {
              ctx.fillStyle = lum < 55 ? '#0c0a09' : '#292524';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            if (lum < 60) {
              ctx.fillStyle = '#fb923c';
              ctx.font = 'bold 18px Georgia, serif';
              ctx.textAlign = 'center';
              ctx.fillText('SALA DE PROFESORES · 2° PISO', canvas.width / 2, canvas.height / 2 - 4);
              ctx.font = '13px monospace';
              ctx.fillStyle = '#fde68a';
              ctx.fillText('ALA IZQUIERDA (LLAVE REVELADA)', canvas.width / 2, canvas.height / 2 + 18);
            }
          }
        }

        if (!completedRef.current && lum < 55) {
          setProgress((prev) => {
            const next = Math.min(100, prev + dt * 56);
            if (next >= 100) {
              finishChallenge();
            }
            return next;
          });
        }
      } else if (challengeType === 'gyro_profesor') {
        if (!hasInitializedGyroOffset.current) {
          hasInitializedGyroOffset.current = true;
          // If no physical gyro movement yet, start orb offset so user actively centers it
          if (!sensorService.permissions.gyroscopeAllowed && !sensorService.simulatedTilt) {
            sensorService.simulatedTilt = { beta: 16, gamma: -14 };
            gyroTargetOffset.current = { beta: 0, gamma: 0 };
          } else {
            gyroTargetOffset.current = { beta: 0, gamma: 0 };
          }
        }

        const b = sensorService.orientation.beta - gyroTargetOffset.current.beta;
        const g = sensorService.orientation.gamma - gyroTargetOffset.current.gamma;
        setLiveTilt({ beta: b, gamma: g });

        const radialError = Math.hypot(b, g);
        if (!completedRef.current && radialError < 9.5) {
          setProgress((prev) => {
            const next = Math.min(100, prev + dt * 54);
            if (next >= 100) {
              finishChallenge();
            }
            return next;
          });
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [challengeType]);

  // Tactile Closet Step Handler
  const handleClosetTap = () => {
    if (completed) return;
    if (closetStage === 0) {
      soundEngine.vibrate(35);
      soundEngine.playInteractTap();
      setClosetStage(1);
      setProgress(34);
    } else if (closetStage === 1) {
      soundEngine.vibrate(45);
      soundEngine.playInteractTap();
      setClosetStage(2);
      setProgress(68);
    } else if (closetStage === 2) {
      setClosetStage(3);
      finishChallenge();
    }
  };

  // Pointer drag pad for Gyroscope desktop/touch fallback
  const handleAstrolabePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0 && e.pointerType === 'mouse') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1; // -1..1
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1; // -1..1
    sensorService.simulatedTilt = {
      beta: ny * 28,
      gamma: nx * 28,
    };
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-3xl border border-stone-700 bg-stone-950 p-5 sm:p-6 shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-stone-800 pb-3.5">
          <div>
            <p className="text-xs font-semibold text-amber-400">
              {challengeType === 'touch_closet' && 'Paso 2 · Sensor Táctil y Respuesta Háptica'}
              {challengeType === 'shake_bikes' && 'Paso 3 · Acelerómetro / Agitación (Shake)'}
              {challengeType === 'mic_whisper' && 'Paso 4 · Micrófono (Web Audio API)'}
              {challengeType === 'light_hanako' && 'Paso 5 · Sensor de Luz / Cámara WebRTC'}
              {challengeType === 'gyro_profesor' && 'Paso 6 · Giroscopio / Nivelación Precisa'}
            </p>
            <h2 className="mt-0.5 font-display text-xl sm:text-2xl font-bold text-stone-50">
              {challengeType === 'touch_closet' && 'Inspección del Armario de Limpieza'}
              {challengeType === 'shake_bikes' && 'Despejar el Aparcabicicletas'}
              {challengeType === 'mic_whisper' && 'La Campana del Susurro'}
              {challengeType === 'light_hanako' && 'El Espejo de la Penumbra'}
              {challengeType === 'gyro_profesor' && 'Compartimento Sellado del Aula 404'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de sensor"
            className="min-h-[40px] min-w-[40px] rounded-xl border border-stone-800 bg-stone-900 text-stone-400 hover:text-stone-100 flex items-center justify-center cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Challenge Specific Interactive Body */}
        <div className="mt-5">
          {challengeType === 'touch_closet' && (
            <div className="space-y-4">
              <p className="text-sm text-stone-300">
                Toca directamente el interior del armario en tres pasos para abrir el pestillo,
                apartar las escobas y recuperar la nota oculta.
              </p>

              <button
                type="button"
                onClick={handleClosetTap}
                className="w-full rounded-2xl border-2 border-stone-700 bg-stone-900 hover:border-amber-400 p-6 text-center transition-all active:scale-[0.98] cursor-pointer flex flex-col items-center gap-3"
              >
                <div className="h-16 w-16 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Hand className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-base font-bold text-stone-100">
                    {closetStage === 0 && '1. Tocar para deslizar el pestillo de madera'}
                    {closetStage === 1 && '2. Tocar para apartar las escobas y cubetas'}
                    {closetStage === 2 && '3. Tocar el sobre lacrado entre los estantes'}
                    {closetStage === 3 && '¡Nota recuperada del armario!'}
                  </p>
                  <p className="text-xs text-stone-400 mt-1">
                    Retroalimentación háptica activa en dispositivos compatibles
                  </p>
                </div>
              </button>
            </div>
          )}

          {challengeType === 'shake_bikes' && (
            <div className="space-y-4">
              <p className="text-sm text-stone-300">
                Sacude tu celular varias veces con firmeza para dispersar el remolino de hojas secas
                que cubre las bicicletas del patio.
              </p>

              <div className="rounded-2xl border border-stone-800 bg-stone-900/90 p-5 flex flex-col items-center gap-3">
                <Smartphone
                  style={{
                    transform: `rotate(${Math.sin(performance.now() * 0.04) * liveShake * 18}deg)`,
                  }}
                  className="h-12 w-12 text-amber-400 transition-transform"
                />
                <div className="w-full">
                  <div className="flex justify-between text-xs text-stone-400 mb-1">
                    <span>Fuerza instantánea del acelerómetro</span>
                    <span className="font-mono-tech text-stone-200">
                      {Math.round(liveShake * 100)}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-stone-800 overflow-hidden">
                    <div
                      style={{ transform: `scaleX(${Math.max(0.03, liveShake)})` }}
                      className="h-full w-full origin-left bg-sky-400 transition-transform duration-75"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => sensorService.triggerSimulatedShake(0.92)}
                  className="mt-2 min-h-[44px] w-full rounded-xl border border-stone-700 bg-stone-800 px-4 py-2.5 text-xs font-semibold text-stone-100 hover:bg-stone-700 active:scale-[0.98] transition-all cursor-pointer"
                >
                  Sacudir Hojas (Toque / Simulador PC)
                </button>
              </div>
            </div>
          )}

          {challengeType === 'mic_whisper' && (
            <div className="space-y-4">
              <p className="text-sm text-stone-300">
                Sopla suavemente hacia el micrófono de tu celular (o emite un sonido continuo) para
                hacer vibrar la campana espiritual frente al Aula 1B.
              </p>

              <div className="rounded-2xl border border-stone-800 bg-stone-900/90 p-5 flex flex-col items-center gap-4">
                <div className="flex items-end justify-center gap-1.5 h-16">
                  {[0.5, 0.8, 1.0, 0.9, 0.65, 0.85, 0.55].map((mult, idx) => {
                    const barScale = Math.max(0.15, Math.min(1, liveVolume * 1.45 * mult));
                    return (
                      <div
                        key={idx}
                        style={{ transform: `scaleY(${barScale})` }}
                        className="w-3 h-14 origin-bottom rounded-full bg-sky-400 transition-transform duration-75"
                      />
                    );
                  })}
                </div>

                <p className="font-mono-tech text-xs text-stone-300">
                  Nivel acústico detectado: {Math.round(liveVolume * 100)}%
                </p>

                <div className="flex flex-col sm:flex-row w-full gap-2">
                  {!micGranted && (
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await sensorService.requestMicrophone();
                        setMicGranted(ok);
                      }}
                      className="flex-1 min-h-[44px] rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-stone-950 hover:bg-sky-400 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Mic className="h-4 w-4" />
                      <span>Permitir Micrófono</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onPointerDown={() => sensorService.triggerSimulatedBlow(0.85, 2200)}
                    onClick={() => sensorService.triggerSimulatedBlow(0.85, 900)}
                    className="flex-1 min-h-[44px] rounded-xl border border-stone-700 bg-stone-800 px-4 py-2 text-xs font-semibold text-stone-100 hover:bg-stone-700 active:scale-[0.98] cursor-pointer"
                  >
                    Mantener o Pulsar para Soplar (Modo PC)
                  </button>
                </div>
              </div>
            </div>
          )}

          {challengeType === 'light_hanako' && (
            <div className="space-y-4">
              <p className="text-sm text-stone-300">
                Cubre con la palma de tu mano la cámara de tu celular (o apaga la luz del entorno)
                hasta sumergir el espejo en la penumbra.
              </p>

              <div className="rounded-2xl border border-stone-800 bg-stone-900/90 p-4 flex flex-col items-center gap-3">
                <canvas
                  ref={mirrorPreviewRef}
                  width={320}
                  height={150}
                  className="w-full max-w-xs rounded-xl border border-stone-700 bg-stone-950"
                />

                <div className="w-full flex items-center justify-between text-xs text-stone-300">
                  <span className="flex items-center gap-1.5">
                    <SunDim className="h-4 w-4 text-amber-400" />
                    Luminosidad actual:
                  </span>
                  <span className="font-mono-tech font-semibold text-stone-100">
                    {liveLuminance} / 255 {liveLuminance < 55 ? '(Penumbra Activa)' : '(Demasiada Luz)'}
                  </span>
                </div>

                <div className="flex flex-wrap w-full gap-2">
                  {!camGranted ? (
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await sensorService.requestCamera('environment');
                        setCamGranted(ok);
                      }}
                      className="flex-1 min-h-[44px] rounded-xl bg-rose-500 px-3 py-2 text-xs font-bold text-white hover:bg-rose-400 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="h-4 w-4" />
                      <span>Activar Cámara</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => sensorService.toggleCameraFacing()}
                      className="min-h-[44px] rounded-xl border border-stone-700 bg-stone-800 px-3 py-2 text-xs font-semibold text-stone-200 hover:bg-stone-700 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <SwitchCamera className="h-4 w-4 text-rose-400" />
                      <span>Cambiar Lente</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onPointerDown={() => {
                      sensorService.simulatedLuminance = 14;
                    }}
                    onPointerUp={() => {
                      sensorService.simulatedLuminance = null;
                    }}
                    onPointerLeave={() => {
                      sensorService.simulatedLuminance = null;
                    }}
                    className="flex-1 min-h-[44px] rounded-xl border border-stone-700 bg-stone-800 px-3 py-2 text-xs font-semibold text-stone-100 hover:bg-stone-700 active:bg-stone-950 cursor-pointer"
                  >
                    Mantener Cubierto (Simulador PC)
                  </button>
                </div>
              </div>
            </div>
          )}

          {challengeType === 'gyro_profesor' && (
            <div className="space-y-4">
              <p className="text-sm text-stone-300">
                Inclina suavemente tu celular (o arrastra el astrolabio en PC) para centrar la esfera
                dorada dentro del anillo maestro y mantenla nivelada.
              </p>

              <div className="rounded-2xl border border-stone-800 bg-stone-900/90 p-5 flex flex-col items-center gap-3">
                {/* Interactive Spirit-Level Astrolabe Dial */}
                <div
                  onPointerDown={handleAstrolabePointer}
                  onPointerMove={handleAstrolabePointer}
                  className="relative h-44 w-44 rounded-full border-2 border-amber-500/50 bg-stone-950 flex items-center justify-center touch-none cursor-crosshair select-none"
                >
                  <div className="h-28 w-28 rounded-full border border-stone-800 pointer-events-none" />
                  {/* Target Bullseye Ring */}
                  <div className="h-12 w-12 rounded-full border-2 border-emerald-400/80 bg-emerald-500/10 pointer-events-none" />

                  {/* Moving Tilt Bubble */}
                  <div
                    style={{
                      transform: `translate3d(${Math.max(
                        -64,
                        Math.min(64, liveTilt.gamma * 2.1)
                      )}px, ${Math.max(-64, Math.min(64, liveTilt.beta * 2.1))}px, 0)`,
                    }}
                    className="pointer-events-none absolute h-7 w-7 rounded-full bg-amber-400 shadow-md border-2 border-stone-950 transition-transform duration-75"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 w-full text-xs text-stone-400">
                  <span className="font-mono-tech">
                    Inclinación X: {liveTilt.gamma.toFixed(1)}° · Y: {liveTilt.beta.toFixed(1)}°
                  </span>

                  <div className="flex items-center gap-2">
                    {!gyroGranted && (
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await sensorService.enableGyroscope();
                          setGyroGranted(ok);
                          if (ok) {
                            sensorService.simulatedTilt = null;
                          }
                        }}
                        className="min-h-[36px] px-3 rounded-lg bg-amber-500 text-xs font-bold text-stone-950 hover:bg-amber-400 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Compass className="h-3.5 w-3.5" />
                        <span>Activar Giroscopio</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        sensorService.recalibrateGyro();
                        if (!sensorService.isGyroActive) {
                          sensorService.simulatedTilt = { beta: 0, gamma: 0 };
                        }
                      }}
                      className="min-h-[36px] px-3 rounded-lg border border-stone-700 bg-stone-800 text-xs font-semibold text-stone-200 hover:bg-stone-700 flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5 text-amber-400" />
                      <span>Nivelar / Calibrar</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Shared Completion Progress Bar */}
        <div className="mt-5 pt-4 border-t border-stone-800">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-stone-200 flex items-center gap-1.5">
              {completed ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-emerald-400">¡Pista desbloqueada!</span>
                </>
              ) : (
                <>
                  <Compass className="h-4 w-4 text-amber-400" />
                  <span>Progreso de sincronización</span>
                </>
              )}
            </span>
            <span className="font-mono-tech font-bold text-stone-100">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-stone-800 overflow-hidden">
            <div
              style={{ transform: `scaleX(${progress / 100})` }}
              className={`h-full w-full origin-left transition-transform duration-100 ${
                completed ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
