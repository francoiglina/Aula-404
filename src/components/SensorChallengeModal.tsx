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
    soundEngine.vibrate(35);

    window.setTimeout(() => {
      onComplete(challengeType);
    }, 480);
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
              ctx.fillStyle = `rgba(7, 10, 18, ${Math.max(0.22, 1 - lum / 180)})`;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else {
              ctx.fillStyle = lum < 55 ? '#070a12' : '#0d1829';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            if (lum < 60) {
              ctx.fillStyle = '#bae6fd';
              ctx.font = '700 17px "Inter", sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('SALA DE PROFESORES', canvas.width / 2, canvas.height / 2 - 4);
              ctx.font = '500 12px "Inter", sans-serif';
              ctx.fillStyle = '#7dd3fc';
              ctx.fillText('PASANDO LA 2A · FONDO IZQ.', canvas.width / 2, canvas.height / 2 + 18);
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
    <div className="font-sans pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-[#070a12]/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="modal-nocturnal-panel relative w-full max-w-lg my-auto p-2.5 sm:p-3">
        <div className="modal-nocturnal-inner relative p-4 sm:p-5">
          {/* Acentos finos de esquina congruentes con el Textbox */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-[4px] right-[4px] h-[1.5px] w-12 bg-gradient-to-l from-[#e0f2fe] via-[#bae6fd]/75 to-transparent"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-[4px] right-[4px] w-[1.5px] h-9 bg-gradient-to-b from-[#e0f2fe] via-[#bae6fd]/75 to-transparent"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[4px] left-[4px] h-[1.5px] w-12 bg-gradient-to-r from-[#e0f2fe] via-[#bae6fd]/75 to-transparent"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[4px] left-[4px] w-[1.5px] h-9 bg-gradient-to-t from-[#e0f2fe] via-[#bae6fd]/75 to-transparent"
          />

          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-[#7dd3fc]/20 pb-3.5">
            <div>
              <p className="font-mono-tech text-[11px] font-medium uppercase tracking-[0.16em] text-[#7dd3fc]">
                {challengeType === 'touch_closet' && 'Rumor II · Cuarto de Mantenimiento'}
                {challengeType === 'shake_bikes' && 'Rumor III · Patio de Bicicletas'}
                {challengeType === 'mic_whisper' && 'Rumor IV · Pasillo frente a 1B'}
                {challengeType === 'light_hanako' && 'Rumor V · Baños del 2° Piso'}
                {challengeType === 'gyro_profesor' && 'Rumor VI · Sala de Profesores'}
              </p>
              <h2 className="hud-text-contrast mt-0.5 font-display text-xl sm:text-2xl font-semibold tracking-tight text-white">
                {challengeType === 'touch_closet' && 'Armario de Limpieza'}
                {challengeType === 'shake_bikes' && 'Bicicletas con Hojas'}
                {challengeType === 'mic_whisper' && 'Campanita de Vidrio'}
                {challengeType === 'light_hanako' && 'Espejo de los Lavabos'}
                {challengeType === 'gyro_profesor' && 'Caja del Escritorio'}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar ventana de sensor"
              className="min-h-[38px] min-w-[38px] rounded-lg border border-[#7dd3fc]/30 bg-[#0d1829]/80 text-[#bae6fd]/80 hover:border-[#bae6fd]/70 hover:text-white transition-colors flex items-center justify-center cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Challenge Specific Interactive Body */}
          <div className="mt-4">
            {challengeType === 'touch_closet' && (
              <div className="space-y-4">
                <p className="text-sm font-normal leading-relaxed text-slate-200/90">
                  Toca el interior del armario en tres pasos para quitar el seguro, apartar las
                  escobas y sacar la nota escondida.
                </p>

                <button
                  type="button"
                  onClick={handleClosetTap}
                  className="w-full rounded-xl border border-[#7dd3fc]/35 bg-[#0d1829]/75 hover:border-[#bae6fd]/80 hover:bg-[#0d1829] hover:shadow-[0_0_24px_rgba(125,211,252,0.16)] p-6 text-center transition-all active:scale-[0.98] cursor-pointer flex flex-col items-center gap-3"
                >
                  <div className="h-14 w-14 rounded-xl bg-[#070a12]/80 border border-[#7dd3fc]/45 flex items-center justify-center text-[#bae6fd] shadow-[0_0_16px_rgba(125,211,252,0.18)]">
                    <Hand className="h-7 w-7 stroke-[1.5]" />
                  </div>
                  <div>
                    <p className="text-sm sm:text-base font-medium text-white">
                      {closetStage === 0 && '1. Tocar para quitar el seguro de madera'}
                      {closetStage === 1 && '2. Tocar para apartar las escobas y cubetas'}
                      {closetStage === 2 && '3. Tocar el sobre escondido entre los estantes'}
                      {closetStage === 3 && '¡Nota recuperada del armario!'}
                    </p>
                    <p className="text-xs font-normal text-[#bae6fd]/65 mt-1">
                      Vibración táctil activa en dispositivos compatibles
                    </p>
                  </div>
                </button>
              </div>
            )}

            {challengeType === 'shake_bikes' && (
              <div className="space-y-4">
                <p className="text-sm font-normal leading-relaxed text-slate-200/90">
                  Sacude tu teléfono varias veces con firmeza para apartar las hojas secas acumuladas
                  debajo de las bicicletas.
                </p>

                <div className="rounded-xl border border-[#7dd3fc]/25 bg-[#0d1829]/70 p-5 flex flex-col items-center gap-3.5">
                  <Smartphone
                    style={{
                      transform: `rotate(${Math.sin(performance.now() * 0.04) * liveShake * 18}deg)`,
                    }}
                    className="h-11 w-11 text-[#bae6fd] transition-transform"
                  />
                  <div className="w-full">
                    <div className="flex justify-between text-xs font-normal text-slate-300 mb-1.5">
                      <span>Fuerza instantánea del acelerómetro</span>
                      <span className="font-mono-tech font-semibold text-[#bae6fd]">
                        {Math.round(liveShake * 100)}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#070a12] border border-[#7dd3fc]/20 overflow-hidden">
                      <div
                        style={{ transform: `scaleX(${Math.max(0.03, liveShake)})` }}
                        className="h-full w-full origin-left bg-[#7dd3fc] transition-transform duration-75"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => sensorService.triggerSimulatedShake(0.92)}
                    className="mt-1 min-h-[42px] w-full rounded-xl border border-[#7dd3fc]/40 bg-[#070a12]/80 px-4 py-2 text-xs font-medium text-white hover:border-[#bae6fd]/80 hover:bg-[#0d1829] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Sacudir Hojas (Toque / Simulador PC)
                  </button>
                </div>
              </div>
            )}

            {challengeType === 'mic_whisper' && (
              <div className="space-y-4">
                <p className="text-sm font-normal leading-relaxed text-slate-200/90">
                  Sopla suavemente hacia el micrófono de tu teléfono (o emite un sonido continuo) para
                  hacer sonar la campanita de vidrio frente al salón 1B.
                </p>

                <div className="rounded-xl border border-[#7dd3fc]/25 bg-[#0d1829]/70 p-5 flex flex-col items-center gap-4">
                  <div className="flex items-end justify-center gap-1.5 h-16">
                    {[0.5, 0.8, 1.0, 0.9, 0.65, 0.85, 0.55].map((mult, idx) => {
                      const barScale = Math.max(0.15, Math.min(1, liveVolume * 1.45 * mult));
                      return (
                        <div
                          key={idx}
                          style={{ transform: `scaleY(${barScale})` }}
                          className="w-2.5 h-14 origin-bottom rounded-full bg-[#7dd3fc] shadow-[0_0_10px_rgba(125,211,252,0.4)] transition-transform duration-75"
                        />
                      );
                    })}
                  </div>

                  <p className="font-mono-tech text-xs font-medium text-[#bae6fd]/85">
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
                        className="flex-1 min-h-[42px] rounded-xl border border-[#bae6fd]/75 bg-[#0d1829] px-4 py-2 text-xs font-medium text-white hover:border-white hover:shadow-[0_0_18px_rgba(125,211,252,0.28)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Mic className="h-4 w-4 text-[#7dd3fc]" />
                        <span>Permitir Micrófono</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onPointerDown={() => sensorService.triggerSimulatedBlow(0.85, 2200)}
                      onClick={() => sensorService.triggerSimulatedBlow(0.85, 900)}
                      className="flex-1 min-h-[42px] rounded-xl border border-[#7dd3fc]/35 bg-[#070a12]/80 px-4 py-2 text-xs font-medium text-white hover:border-[#bae6fd]/75 hover:bg-[#0d1829] active:scale-[0.98] transition-all cursor-pointer"
                    >
                      Mantener o Pulsar para Soplar (Modo PC)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {challengeType === 'light_hanako' && (
              <div className="space-y-4">
                <p className="text-sm font-normal leading-relaxed text-slate-200/90">
                  Cubre con la palma de tu mano la cámara de tu teléfono (o apaga la luz del lugar)
                  hasta dejar el espejo a oscuras.
                </p>

                <div className="rounded-xl border border-[#7dd3fc]/25 bg-[#0d1829]/70 p-4 flex flex-col items-center gap-3">
                  <canvas
                    ref={mirrorPreviewRef}
                    width={320}
                    height={150}
                    className="w-full max-w-xs rounded-lg border border-[#7dd3fc]/35 bg-[#070a12]"
                  />

                  <div className="w-full flex items-center justify-between text-xs text-slate-200">
                    <span className="flex items-center gap-1.5">
                      <SunDim className="h-4 w-4 text-[#7dd3fc]" />
                      Luminosidad actual:
                    </span>
                    <span className="font-mono-tech font-medium text-[#bae6fd]">
                      {liveLuminance} / 255 {liveLuminance < 55 ? '(Oscuridad Activa)' : '(Demasiada Luz)'}
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
                        className="flex-1 min-h-[42px] rounded-xl border border-[#bae6fd]/75 bg-[#0d1829] px-3 py-2 text-xs font-medium text-white hover:border-white hover:shadow-[0_0_18px_rgba(125,211,252,0.28)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="h-4 w-4 text-[#7dd3fc]" />
                        <span>Activar Cámara</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => sensorService.toggleCameraFacing()}
                        className="min-h-[42px] rounded-xl border border-[#7dd3fc]/35 bg-[#070a12]/80 px-3 py-2 text-xs font-medium text-slate-100 hover:border-[#bae6fd]/75 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <SwitchCamera className="h-4 w-4 text-[#7dd3fc]" />
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
                      className="flex-1 min-h-[42px] rounded-xl border border-[#7dd3fc]/35 bg-[#070a12]/80 px-3 py-2 text-xs font-medium text-white hover:border-[#bae6fd]/75 hover:bg-[#0d1829] active:bg-[#070a12] transition-all cursor-pointer"
                    >
                      Mantener Cubierto (Simulador PC)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {challengeType === 'gyro_profesor' && (
              <div className="space-y-4">
                <p className="text-sm font-normal leading-relaxed text-slate-200/90">
                  Inclina suavemente tu teléfono (o arrastra el indicador en pantalla) para centrar el
                  punto luminoso en el centro y mantener la caja nivelada.
                </p>

                <div className="rounded-xl border border-[#7dd3fc]/25 bg-[#0d1829]/70 p-5 flex flex-col items-center gap-3.5">
                  <div
                    onPointerDown={handleAstrolabePointer}
                    onPointerMove={handleAstrolabePointer}
                    className="relative h-44 w-44 rounded-full border border-[#7dd3fc]/55 bg-[#070a12] shadow-[inset_0_0_24px_rgba(125,211,252,0.12)] flex items-center justify-center touch-none cursor-crosshair select-none"
                  >
                    <div className="h-28 w-28 rounded-full border border-[#7dd3fc]/20 pointer-events-none" />
                    <div className="h-12 w-12 rounded-full border border-[#bae6fd]/80 bg-[#7dd3fc]/10 pointer-events-none" />

                    <div
                      style={{
                        transform: `translate3d(${Math.max(
                          -64,
                          Math.min(64, liveTilt.gamma * 2.1)
                        )}px, ${Math.max(-64, Math.min(64, liveTilt.beta * 2.1))}px, 0)`,
                      }}
                      className="pointer-events-none absolute h-6 w-6 rounded-full bg-[#bae6fd] shadow-[0_0_14px_rgba(186,230,253,0.85)] border border-[#070a12] transition-transform duration-75"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 w-full text-xs text-slate-300">
                    <span className="font-mono-tech font-medium text-[#bae6fd]/85">
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
                          className="min-h-[36px] px-3 rounded-lg border border-[#bae6fd]/75 bg-[#0d1829] text-xs font-medium text-white hover:border-white flex items-center gap-1.5 cursor-pointer"
                        >
                          <Compass className="h-3.5 w-3.5 text-[#7dd3fc]" />
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
                        className="min-h-[36px] px-3 rounded-lg border border-[#7dd3fc]/35 bg-[#070a12]/80 text-xs font-medium text-slate-200 hover:border-[#bae6fd]/70 hover:text-white flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="h-3.5 w-3.5 text-[#7dd3fc]" />
                        <span>Nivelar / Calibrar</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Shared Completion Progress Bar */}
          <div className="mt-5 pt-4 border-t border-[#7dd3fc]/20">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-medium text-slate-100 flex items-center gap-1.5">
                {completed ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-[#bae6fd]" />
                    <span className="text-[#bae6fd]">¡Era cierto el rumor!</span>
                  </>
                ) : (
                  <>
                    <Compass className="h-4 w-4 text-[#7dd3fc]" />
                    <span>Comprobando el rumor</span>
                  </>
                )}
              </span>
              <span className="font-mono-tech font-semibold text-[#bae6fd]">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-[#070a12] border border-[#7dd3fc]/25 overflow-hidden">
              <div
                style={{ transform: `scaleX(${progress / 100})` }}
                className={`h-full w-full origin-left transition-transform duration-100 ${
                  completed
                    ? 'bg-[#bae6fd] shadow-[0_0_12px_rgba(186,230,253,0.85)]'
                    : 'bg-[#7dd3fc]'
                }`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
