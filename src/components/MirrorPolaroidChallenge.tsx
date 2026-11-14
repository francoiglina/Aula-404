import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, SwitchCamera } from 'lucide-react';
import { sensorService } from '../services/sensorService';
import { soundEngine } from '../services/soundEngine';
import { PolaroidPhotoCard } from './PolaroidPhotoCard';

interface MirrorPolaroidChallengeProps {
  onDeveloped: () => void;
}

const DEVELOP_DURATION_MS = 2500;

export const MirrorPolaroidChallenge: React.FC<MirrorPolaroidChallengeProps> = ({
  onDeveloped,
}) => {
  const [stage, setStage] = useState<'viewfinder' | 'developing'>('viewfinder');
  const [camGranted, setCamGranted] = useState(sensorService.permissions.cameraAllowed);
  const [flashOpacity, setFlashOpacity] = useState(0);
  const [revealProgress, setRevealProgress] = useState(0);

  const mirrorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const shutterTriggeredRef = useRef(false);
  const developedCallbackFiredRef = useRef(false);
  const onDevelopedRef = useRef(onDeveloped);

  useEffect(() => {
    onDevelopedRef.current = onDeveloped;
  }, [onDeveloped]);

  // Vista previa en vivo de la cámara frente al espejo del baño (con respaldo procedural J-Horror)
  useEffect(() => {
    if (stage !== 'viewfinder') return;

    let rafId = 0;
    let lastDraw = 0;

    const renderViewfinder = (now: number) => {
      const canvas = mirrorCanvasRef.current;
      if (canvas && now - lastDraw >= 33) {
        lastDraw = now;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          const t = now * 0.001;

          if (
            sensorService.permissions.cameraAllowed &&
            sensorService.videoElement &&
            sensorService.videoElement.readyState >= 2
          ) {
            ctx.save();
            ctx.drawImage(sensorService.videoElement, 0, 0, w, h);
            // Tinte frío de espejo de baño nocturno sobre la cámara real
            ctx.fillStyle = 'rgba(8, 16, 30, 0.34)';
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
          } else {
            // Espejo empañado procedural del baño 2F para escritorio o sin cámara
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#09111f');
            grad.addColorStop(0.5, '#111d30');
            grad.addColorStop(1, '#050811');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            // Reflejo tenue de tubo fluorescente superior y azulejos en el cristal
            const glow = ctx.createRadialGradient(w * 0.5, h * 0.28, 12, w * 0.5, h * 0.45, w * 0.6);
            glow.addColorStop(0, `rgba(186, 230, 253, ${0.14 + Math.sin(t * 2.1) * 0.03})`);
            glow.addColorStop(0.55, 'rgba(56, 189, 248, 0.05)');
            glow.addColorStop(1, 'rgba(2, 6, 14, 0.25)');
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, w, h);

            // Ondas suaves de vapor y silueta difusa detrás del espejo
            ctx.strokeStyle = 'rgba(186, 230, 253, 0.1)';
            ctx.lineWidth = 2;
            for (let i = 0; i < 3; i++) {
              const r = 34 + i * 28 + Math.sin(t * 1.4 + i) * 4;
              ctx.beginPath();
              ctx.arc(w * 0.5, h * 0.52, r, 0, Math.PI * 2);
              ctx.stroke();
            }

            // Sutil grieta lateral en el espejo
            ctx.strokeStyle = 'rgba(224, 242, 254, 0.18)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(w * 0.84, 0);
            ctx.lineTo(w * 0.77, h * 0.22);
            ctx.lineTo(w * 0.81, h * 0.36);
            ctx.stroke();
          }
        }
      }
      rafId = requestAnimationFrame(renderViewfinder);
    };

    rafId = requestAnimationFrame(renderViewfinder);
    return () => cancelAnimationFrame(rafId);
  }, [stage]);

  // Controlador determinista del revelado químico (2.5s exactos, inmune a re-renders del padre)
  useEffect(() => {
    if (stage !== 'developing') return;

    const startTime = performance.now();
    let rafId = 0;

    const finalizeReveal = () => {
      setRevealProgress(1);
      if (!developedCallbackFiredRef.current) {
        developedCallbackFiredRef.current = true;
        onDevelopedRef.current();
      }
    };

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / DEVELOP_DURATION_MS);
      setRevealProgress(t);

      if (t >= 1) {
        finalizeReveal();
        return;
      }
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);

    // Respaldo garantizado por temporizador en caso de suspensión de RAF en móviles
    const fallbackTimer = window.setTimeout(() => {
      cancelAnimationFrame(rafId);
      finalizeReveal();
    }, DEVELOP_DURATION_MS + 80);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(fallbackTimer);
    };
  }, [stage]);

  const handleTakePhoto = useCallback(() => {
    if (shutterTriggeredRef.current) return;
    shutterTriggeredRef.current = true;

    soundEngine.playCameraShutter();
    setFlashOpacity(0.92);
    setStage('developing');

    window.setTimeout(() => {
      setFlashOpacity(0);
    }, 90);
  }, []);

  useEffect(() => {
    if (stage !== 'viewfinder') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        handleTakePhoto();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stage, handleTakePhoto]);

  return (
    <div className="space-y-4 relative">
      {/* Destello sutil de flash analógico */}
      <div
        aria-hidden="true"
        style={{ opacity: flashOpacity }}
        className="pointer-events-none fixed inset-0 z-50 bg-white transition-opacity duration-300 ease-out"
      />

      {stage === 'viewfinder' ? (
        <>
          <p className="text-sm font-normal leading-relaxed text-slate-200/90">
            Apunta la cámara hacia el espejo de los lavabos y presiona el disparador para comprobar
            si la leyenda urbana muestra algo más allá del reflejo.
          </p>

          <div className="rounded-xl border border-[#7dd3fc]/25 bg-[#0d1829]/70 p-3.5 sm:p-4 flex flex-col items-center gap-3.5">
            {/* Visor de cámara apuntando al espejo */}
            <div className="relative w-full max-w-[320px] aspect-[4/3] overflow-hidden rounded-lg border border-[#7dd3fc]/35 bg-[#050811]">
              <canvas
                ref={mirrorCanvasRef}
                width={360}
                height={270}
                className="block h-full w-full object-cover"
              />

              {/* Marcas minimalistas de encuadre del visor */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-3">
                <span className="absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-[#bae6fd]/75" />
                <span className="absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-[#bae6fd]/75" />
                <span className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-[#bae6fd]/75" />
                <span className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-[#bae6fd]/75" />
                <span className="absolute top-1/2 left-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#bae6fd]/45" />
              </div>
            </div>

            <div className="flex flex-wrap w-full gap-2">
              {!camGranted ? (
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await sensorService.requestCamera('environment');
                    setCamGranted(ok);
                  }}
                  className="min-h-[46px] rounded-xl border border-[#7dd3fc]/35 bg-[#070a12]/80 px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-[#bae6fd]/75 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Camera className="h-4 w-4 text-[#7dd3fc]" />
                  <span>Usar Lente Real</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => sensorService.toggleCameraFacing()}
                  className="min-h-[46px] rounded-xl border border-[#7dd3fc]/35 bg-[#070a12]/80 px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-[#bae6fd]/75 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <SwitchCamera className="h-4 w-4 text-[#7dd3fc]" />
                  <span>Cambiar Lente</span>
                </button>
              )}

              <button
                type="button"
                data-no-confirm-sfx="true"
                onClick={handleTakePhoto}
                className="flex-1 min-h-[46px] rounded-xl border border-[#bae6fd]/80 bg-[#0d1829] px-4 py-2 text-sm font-medium text-white shadow-[0_0_20px_rgba(125,211,252,0.22)] hover:border-white hover:bg-[#13233d] hover:shadow-[0_0_26px_rgba(186,230,253,0.36)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Camera className="h-4 w-4 text-[#bae6fd]" />
                <span>Sacar Foto</span>
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-2">
          <p className="mb-3 text-xs font-medium tracking-[0.1em] uppercase text-[#bae6fd]/80">
            Revelando fotografía instantánea...
          </p>
          <div className="w-[240px] sm:w-[270px] animate-[polaroidSlideIn_520ms_cubic-bezier(0.16,1,0.3,1)_forwards]">
            <PolaroidPhotoCard revealProgress={revealProgress} />
          </div>
        </div>
      )}
    </div>
  );
};
