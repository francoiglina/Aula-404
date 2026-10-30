import React, { useState } from 'react';
import { BookOpen, CheckCircle2, Lock, Map as MapIcon, Navigation, X } from 'lucide-react';
import { MAP_IMAGES } from '../data/gameContent';
import { ClueRecord, FloorNumber, PhaseIndicator } from '../types';

const ROMAN_STEPS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

interface SchoolMapModalProps {
  initialTab: 'map' | 'clues';
  currentFloor: FloorNumber;
  playerCoords: { x: number; z: number; yaw: number; floor: FloorNumber };
  clues: ClueRecord[];
  phaseIndicator: PhaseIndicator;
  onClose: () => void;
}

export const SchoolMapModal: React.FC<SchoolMapModalProps> = ({
  initialTab,
  currentFloor,
  playerCoords,
  clues,
  phaseIndicator,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'map' | 'clues'>(initialTab);
  const [viewingFloor, setViewingFloor] = useState<FloorNumber>(currentFloor);
  const [mapImgError, setMapImgError] = useState<Record<number, boolean>>({});

  // Map world coordinates (x: -31..31, z: -26..9) onto percentage coordinates for live radar pin
  const radarLeftPct = Math.min(92, Math.max(8, ((playerCoords.x + 31) / 62) * 100));
  const radarTopPct = Math.min(92, Math.max(8, ((playerCoords.z + 26) / 35) * 100));

  return (
    <div className="font-sans pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-3xl border border-stone-700 bg-stone-950 p-4 sm:p-6 shadow-2xl my-auto">
        {/* Top Modal Header & Segmented Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 pb-3.5">
          <div className="flex items-center gap-1 rounded-xl bg-stone-900 p-1 border border-stone-800">
            <button
              type="button"
              onClick={() => setActiveTab('map')}
              className={`min-h-[38px] px-3.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'map'
                  ? 'bg-amber-500 font-semibold text-stone-950'
                  : 'font-medium text-stone-300 hover:text-stone-100'
              }`}
            >
              <MapIcon className="h-3.5 w-3.5" />
              <span>Planos de la Escuela</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('clues')}
              className={`min-h-[38px] px-3.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'clues'
                  ? 'bg-amber-500 font-semibold text-stone-950'
                  : 'font-medium text-stone-300 hover:text-stone-100'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Archivo de Rumores</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar mapa"
            className="min-h-[40px] min-w-[40px] rounded-xl border border-stone-800 bg-stone-900 text-stone-400 hover:text-stone-100 flex items-center justify-center cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Enigmatic Phase Whisper Banner */}
        <div className="mt-3 rounded-xl border border-stone-800 bg-stone-900/80 px-3.5 py-2.5 text-xs text-stone-200">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono-tech text-[11px] font-semibold uppercase tracking-wider text-amber-400">
              {phaseIndicator.stageTag}
            </span>
            <span aria-hidden="true" className="text-stone-600">
              ·
            </span>
            <strong className="font-display text-sm font-semibold text-stone-50">
              {phaseIndicator.title}
            </strong>
          </div>
          <p className="mt-1 font-normal text-stone-400">{phaseIndicator.whisper}</p>
        </div>

        {activeTab === 'map' ? (
          <div className="mt-4 space-y-3">
            {/* Floor Selector */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {([1, 2] as FloorNumber[]).map((fl) => (
                  <button
                    key={fl}
                    type="button"
                    onClick={() => setViewingFloor(fl)}
                    className={`min-h-[38px] px-3.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      viewingFloor === fl
                        ? 'bg-stone-100 text-stone-950'
                        : 'bg-stone-900 text-stone-300 border border-stone-800 hover:bg-stone-800'
                    }`}
                  >
                    {fl === 1 ? 'Primer Piso (1F)' : 'Segundo Piso (2F)'}
                    {currentFloor === fl ? ' · Estás aquí' : ''}
                  </button>
                ))}
              </div>

              <span className="hidden sm:inline text-xs text-stone-400">
                Azul: Persona · Rojo: Objeto · Amarillo: Escalera
              </span>
            </div>

            {/* Official Architectural Map Image + Live Position Indicator */}
            <div className="relative w-full overflow-hidden rounded-2xl border border-stone-800 bg-[#FAF6EE] aspect-[16/10] flex items-center justify-center">
              {!mapImgError[viewingFloor] ? (
                <img
                  src={MAP_IMAGES[viewingFloor]}
                  alt={`Plano arquitectónico del piso ${viewingFloor}`}
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setMapImgError((prev) => ({ ...prev, [viewingFloor]: true }))
                  }
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="text-center p-6 text-stone-700">
                  <p className="font-display text-lg font-bold">
                    Plano del {viewingFloor}° Piso
                  </p>
                  <p className="text-xs mt-1">
                    Ala Izquierda · Pasillo Central · Ala Derecha
                  </p>
                </div>
              )}

              {/* Live Player Position Pin when viewing active floor */}
              {viewingFloor === playerCoords.floor && (
                <div
                  style={{
                    left: `${radarLeftPct}%`,
                    top: `${radarTopPct}%`,
                  }}
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                >
                  <div className="h-7 w-7 rounded-full border-2 border-white bg-emerald-600 text-white shadow-lg flex items-center justify-center">
                    <Navigation
                      style={{ transform: `rotate(${-playerCoords.yaw}rad)` }}
                      className="h-3.5 w-3.5"
                    />
                  </div>
                  <span className="mt-0.5 rounded bg-stone-950/90 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 whitespace-nowrap">
                    Tú
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 max-h-[58vh] overflow-y-auto space-y-2.5 pr-1">
            {clues.map((clue) => (
              <div
                key={clue.id}
                className={`rounded-2xl border p-3.5 transition-colors ${
                  clue.unlocked
                    ? 'border-stone-700 bg-stone-900/90'
                    : 'border-stone-800/70 bg-stone-950/60 opacity-65'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {clue.unlocked ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Lock className="h-4 w-4 text-stone-500 shrink-0" />
                    )}
                    <h3 className="text-sm font-semibold text-stone-100">
                      Rumor {ROMAN_STEPS[clue.stepNumber] || clue.stepNumber} ·{' '}
                      {clue.unlocked ? clue.title : 'Todavía sin confirmar'}
                    </h3>
                  </div>
                  <span className="text-[11px] font-medium text-stone-400 whitespace-nowrap">
                    {clue.sensorUsed}
                  </span>
                </div>

                <p className="mt-1.5 text-xs font-normal leading-relaxed text-stone-300">
                  {clue.unlocked
                    ? clue.summary
                    : 'Todavía no escuchaste qué andan comentando por los pasillos sobre esto.'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
