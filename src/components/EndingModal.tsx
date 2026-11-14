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
    <div className="font-sans pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-[#070a12]/88 backdrop-blur-md p-4 overflow-y-auto">
      <div className="modal-nocturnal-panel relative w-full max-w-xl my-auto p-2.5 sm:p-3 text-center">
        <div className="modal-nocturnal-inner relative px-5 py-6 sm:px-8 sm:py-8">
          {/* Acentos dobles en esquinas congruentes con el Textbox */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-[4px] right-[4px] h-[1.5px] w-14 bg-gradient-to-l from-[#e0f2fe] via-[#bae6fd]/75 to-transparent"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-[4px] right-[4px] w-[1.5px] h-10 bg-gradient-to-b from-[#e0f2fe] via-[#bae6fd]/75 to-transparent"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[4px] left-[4px] h-[1.5px] w-14 bg-gradient-to-r from-[#e0f2fe] via-[#bae6fd]/75 to-transparent"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[4px] left-[4px] w-[1.5px] h-10 bg-gradient-to-t from-[#e0f2fe] via-[#bae6fd]/75 to-transparent"
          />

          <div className="mx-auto h-14 w-14 rounded-2xl border border-[#7dd3fc]/45 bg-[#0d1829]/90 flex items-center justify-center text-[#bae6fd] shadow-[0_0_24px_rgba(125,211,252,0.22)]">
            <Award className="h-7 w-7 stroke-[1.6]" />
          </div>

          <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.22em] text-[#7dd3fc]">
            Primer Día Completado · Destino Alcanzado
          </p>
          <h2
            className="hud-text-contrast mt-1.5 font-display text-2xl sm:text-3xl font-semibold tracking-tight text-white"
            style={{ textWrap: 'balance' }}
          >
            Llegaste a tu Salón
          </h2>

          <p className="mt-3 text-sm font-normal leading-relaxed text-slate-200/90">
            Recuperaste tu registro en la Sala de Profesores, quitaste el seguro exterior frente a la
            2C y lograste abrir la puerta de tu salón. Al final, todos los rumores que corrían de boca
            en boca desde la 1A hasta la 2D eran ciertos.
          </p>

          {/* Tarjeta Nocturna de Confirmación */}
          <div className="mt-5 rounded-xl border border-[#7dd3fc]/30 bg-[#0d1829]/75 p-4 text-left">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#7dd3fc]/20 pb-2.5">
              <span className="font-display text-base sm:text-lg font-semibold tracking-tight text-white">
                Inscripción Confirmada
              </span>
              <span className="font-mono-tech text-xs font-medium tracking-wider uppercase text-[#bae6fd]">
                {clues.every((c) => c.unlocked) ? 'VI Rumores Confirmados' : 'Ficha Sellada'}
              </span>
            </div>
            <p className="mt-2.5 text-xs font-normal text-slate-300 leading-relaxed">
              Pistas comprobadas: Tacto · Sacudida · Soplo · Fotografía · Karakuri.
            </p>
          </div>

          {/* Botones de Acción Nocturnos */}
          <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={onKeepExploring}
              className="flex-1 min-h-[46px] rounded-xl border border-[#bae6fd]/75 bg-[#0d1829] px-4 py-2.5 text-xs sm:text-sm font-medium tracking-wide text-white shadow-[0_0_22px_rgba(125,211,252,0.18)] hover:border-white hover:bg-[#13233d] hover:shadow-[0_0_26px_rgba(186,230,253,0.34)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Compass className="h-4 w-4 text-[#bae6fd]" />
              <span>Seguir Explorando</span>
            </button>

            <button
              type="button"
              onClick={onCaptureMemento}
              className="min-h-[46px] rounded-xl border border-[#7dd3fc]/35 bg-[#070a12]/80 px-4 py-2.5 text-xs font-medium text-slate-100 hover:border-[#bae6fd]/70 hover:bg-[#0d1829]/90 transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Camera className="h-4 w-4 text-[#7dd3fc]" />
              <span>Guardar Foto</span>
            </button>

            <button
              type="button"
              onClick={onRestart}
              className="min-h-[46px] rounded-xl border border-white/20 bg-[#070a12]/80 px-4 py-2.5 text-xs font-medium text-slate-300 hover:border-[#7dd3fc]/55 hover:text-white hover:bg-[#0d1829]/80 transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reiniciar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
