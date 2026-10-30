import React, { useState } from 'react';
import { Compass, Mic, Camera, Vibrate, Volume2, ArrowRight } from 'lucide-react';
import { PORTRAITS } from '../data/gameContent';

interface WelcomePermissionsModalProps {
  onStartExperience: (requestFullSensors: boolean) => Promise<void>;
}

export const WelcomePermissionsModal: React.FC<WelcomePermissionsModalProps> = ({
  onStartExperience,
}) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [portraitError, setPortraitError] = useState(false);

  const handleStart = async (fullSensors: boolean) => {
    if (isRequesting) return;
    setIsRequesting(true);
    try {
      await onStartExperience(fullSensors);
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="font-sans fixed inset-0 z-50 flex items-center justify-center bg-stone-950/96 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl border border-stone-800 bg-stone-900 p-6 sm:p-8 shadow-2xl my-auto">
        <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-stretch">
          {/* Washi-paper Character Illustration Card */}
          <div className="w-36 sm:w-44 shrink-0 rounded-2xl bg-[#FAF6EE] border-2 border-stone-800 p-2.5 flex flex-col justify-between shadow-inner">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-[#FAF6EE] flex items-center justify-center">
              {!portraitError ? (
                <img
                  src={PORTRAITS.tsuki}
                  alt="Tsuki - Guía de Primer Año"
                  referrerPolicy="no-referrer"
                  onError={() => setPortraitError(true)}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="text-center text-stone-700 font-display text-xl font-bold px-2">
                  Aula 404
                </div>
              )}
            </div>
            <div className="mt-2 border-t border-stone-300 pt-1.5 text-center">
              <p className="text-[11px] font-semibold text-stone-800">Primer Día de Clases</p>
              <p className="text-[10px] font-normal text-stone-500">1° y 2° Piso · Escuela</p>
            </div>
          </div>

          {/* Editorial Title & Premise */}
          <div className="flex-1 flex flex-col justify-between text-center sm:text-left">
            <div>
              <p className="text-xs font-medium text-amber-400 tracking-wide">
                Experiencia Web Inmersiva 3D · Sensores Móviles
              </p>
              <h1
                className="mt-1 font-display text-3xl sm:text-4xl font-bold text-stone-50 tracking-tight"
                style={{ textWrap: 'balance' }}
              >
                Aula 404
              </h1>
              <p className="mt-3 text-sm font-normal leading-relaxed text-stone-300">
                Es tu primer día de clases y tu salón no figura en ningún registro. Explora los dos
                pisos de la escuela japonesa, conversa con sus habitantes y utiliza los sensores de
                tu celular para descubrir el camino verdadero.
              </p>
            </div>

            {/* Sensor Capabilities Grid */}
            <div className="mt-5 grid grid-cols-2 gap-2.5 text-left">
              <div className="rounded-xl border border-stone-800 bg-stone-950/70 p-2.5 flex items-center gap-2.5">
                <Compass className="h-4 w-4 text-amber-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-stone-100">Giroscopio y Shake</p>
                  <p className="text-[11px] font-normal text-stone-400">Inclinación y agitación</p>
                </div>
              </div>
              <div className="rounded-xl border border-stone-800 bg-stone-950/70 p-2.5 flex items-center gap-2.5">
                <Mic className="h-4 w-4 text-sky-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-stone-100">Micrófono</p>
                  <p className="text-[11px] font-normal text-stone-400">Soplo y eco acústico</p>
                </div>
              </div>
              <div className="rounded-xl border border-stone-800 bg-stone-950/70 p-2.5 flex items-center gap-2.5">
                <Camera className="h-4 w-4 text-rose-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-stone-100">Cámara y Luz</p>
                  <p className="text-[11px] font-normal text-stone-400">Espejo y penumbra</p>
                </div>
              </div>
              <div className="rounded-xl border border-stone-800 bg-stone-950/70 p-2.5 flex items-center gap-2.5">
                <Vibrate className="h-4 w-4 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-stone-100">Táctil y Háptico</p>
                  <p className="text-[11px] font-normal text-stone-400">Stick y botón de acción</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls Brief */}
        <div className="mt-5 rounded-2xl border border-stone-800 bg-stone-950/80 px-4 py-3 text-xs font-normal text-stone-300 flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong className="font-semibold text-stone-100">Izquierda:</strong> Stick analógico
            para caminar
          </span>
          <span aria-hidden="true" className="hidden sm:inline text-stone-600">
            ·
          </span>
          <span>
            <strong className="font-semibold text-stone-100">Pantalla:</strong> Arrastra para mirar
            alrededor
          </span>
          <span aria-hidden="true" className="hidden sm:inline text-stone-600">
            ·
          </span>
          <span>
            <strong className="font-semibold text-stone-100">Derecha:</strong> Botón único para
            interactuar
          </span>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            type="button"
            disabled={isRequesting}
            onClick={() => handleStart(true)}
            className="flex-1 min-h-[48px] rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-stone-950 hover:bg-amber-400 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap disabled:opacity-60"
          >
            <Volume2 className="h-4 w-4 shrink-0" />
            <span>
              {isRequesting ? 'Activando sensores...' : 'Iniciar Experiencia y Activar Sensores'}
            </span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </button>

          <button
            type="button"
            disabled={isRequesting}
            onClick={() => handleStart(false)}
            className="min-h-[48px] rounded-xl border border-stone-700 bg-stone-800/90 px-4 py-3 text-xs font-medium text-stone-200 hover:bg-stone-800 active:scale-[0.99] transition-all cursor-pointer whitespace-nowrap disabled:opacity-60"
          >
            Modo Escritorio / Simulador
          </button>
        </div>
      </div>
    </div>
  );
};
