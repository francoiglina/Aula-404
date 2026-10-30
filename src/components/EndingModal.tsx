import React from 'react';
import { Award, Camera, Compass, RotateCcw } from 'lucide-react';
import { ClueRecord } from '../types';

interface EndingModalProps {
  clues: ClueRecord[];
  onKeepExploring: () => void;
  onCaptureMemento: () => void;
  onRestart: () => void;
}

export const EndingModal: React.FC<EndingModalProps> = ({
  clues,
  onKeepExploring,
  onCaptureMemento,
  onRestart,
}) => {
  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-stone-950/92 p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-3xl border border-amber-500/40 bg-stone-900 p-6 sm:p-8 shadow-2xl my-auto text-center">
        <div className="mx-auto h-14 w-14 rounded-2xl border border-amber-400/50 bg-amber-500/15 flex items-center justify-center text-amber-400">
          <Award className="h-8 w-8" />
        </div>

        <p className="mt-3 text-xs font-semibold text-amber-400">
          Misterio Resuelto · Estado Final Alcanzado
        </p>
        <h2
          className="mt-1 font-display text-3xl sm:text-4xl font-bold text-stone-50"
          style={{ textWrap: 'balance' }}
        >
          Bienvenido al Aula 404
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-stone-300">
          Nivelaste el compartimento sellado en la Sala de Profesores y recuperaste tu pase oficial.
          El Aula 404 nunca estuvo perdida: solo se revela ante quienes escuchan, observan entre
          sombras y mantienen el equilibrio.
        </p>

        {/* Official Seal Pass Card */}
        <div className="mt-5 rounded-2xl border border-stone-800 bg-[#FAF6EE] p-4 text-left text-stone-900 shadow-inner">
          <div className="flex items-center justify-between border-b border-stone-300 pb-2">
            <span className="font-display text-lg font-bold">Pase Oficial · Aula 404</span>
            <span className="font-mono-tech text-xs font-semibold text-amber-800">
              {clues.filter((c) => c.unlocked).length}/6 Pistas
            </span>
          </div>
          <p className="mt-2 text-xs text-stone-700 leading-relaxed">
            Sensores verificados: Táctil Háptico · Acelerómetro (Shake) · Micrófono Web Audio ·
            Cámara y Luz Ambiental · Giroscopio 3D.
          </p>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={onKeepExploring}
            className="flex-1 min-h-[46px] rounded-xl bg-amber-500 px-4 py-2.5 text-xs sm:text-sm font-bold text-stone-950 hover:bg-amber-400 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Compass className="h-4 w-4" />
            <span>Seguir Explorando</span>
          </button>

          <button
            type="button"
            onClick={onCaptureMemento}
            className="min-h-[46px] rounded-xl border border-stone-700 bg-stone-800 px-4 py-2.5 text-xs font-semibold text-stone-100 hover:bg-stone-700 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Camera className="h-4 w-4 text-sky-400" />
            <span>Guardar Foto</span>
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="min-h-[46px] rounded-xl border border-stone-700 bg-stone-800 px-4 py-2.5 text-xs font-semibold text-stone-300 hover:bg-stone-700 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reiniciar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
