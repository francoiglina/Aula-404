import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Compass,
  Hand,
  Mic,
  Smartphone,
  X,
} from 'lucide-react';
import { sensorService } from '../services/sensorService';
import { soundEngine } from '../services/soundEngine';
import { SensorChallengeType } from '../types';
import { KarakuriLockChallenge } from './KarakuriLockChallenge';
import { MirrorPolaroidChallenge } from './MirrorPolaroidChallenge';

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

  // Live sensor telemetry readouts for Rumores II–IV
  const [liveVolume, setLiveVolume] = useState(0);
  const [liveShake, setLiveShake] = useState(0);
  const [micGranted, setMicGranted] = useState(sensorService.permissions.micAllowed);

  const completedRef = useRef(false);

  const finishChallenge = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setCompleted(true);
    setProgress(100);
    soundEngine.vibrate(35);

    const delayMs = challengeType === 'karakuri_profesor' ? 220 : 480;
    window.setTimeout(() => {
      onComplete(challengeType);
    }, delayMs);
  };

  const handleMirrorDeveloped = useCallback(() => {
    onComplete('camera_mirror');
  }, [onComplete]);

  useEffect(() => {
    completedRef.current = false;
    setCompleted(false);
    setProgress(0);
    setClosetStage(0);

    return () => {
      sensorService.onShakeSpike = undefined;
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

  // Continuous RAF sensor loop strictly for shake_bikes and mic_whisper
  useEffect(() => {
    if (challengeType !== 'shake_bikes' && challengeType !== 'mic_whisper') return;

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

  const usesLinearProgressBar =
    challengeType === 'touch_closet' ||
    challengeType === 'shake_bikes' ||
    challengeType === 'mic_whisper';

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
                {challengeType === 'camera_mirror' && 'Rumor V · Baños del 2° Piso'}
                {challengeType === 'karakuri_profesor' && 'Rumor VI · Sala de Profesores'}
              </p>
              <h2 className="hud-text-contrast mt-0.5 font-display text-xl sm:text-2xl font-semibold tracking-tight text-white">
                {challengeType === 'touch_closet' && 'Armario de Limpieza'}
                {challengeType === 'shake_bikes' && 'Bicicletas con Hojas'}
                {challengeType === 'mic_whisper' && 'Campanita de Vidrio'}
                {challengeType === 'camera_mirror' && 'Espejo de los Lavabos'}
                {challengeType === 'karakuri_profesor' && 'Candado de Espiral Karakuri'}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar ventana"
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

            {challengeType === 'camera_mirror' && (
              <MirrorPolaroidChallenge onDeveloped={handleMirrorDeveloped} />
            )}

            {challengeType === 'karakuri_profesor' && (
              <KarakuriLockChallenge onUnlocked={finishChallenge} />
            )}
          </div>

          {/* Shared Completion Progress Bar (Rumores II–IV) */}
          {usesLinearProgressBar && (
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
          )}
        </div>
      </div>
    </div>
  );
};
