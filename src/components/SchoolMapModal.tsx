import React, { useState } from 'react';
import { BookOpen, Box, CheckCircle2, Lock, Map as MapIcon, Navigation, X } from 'lucide-react';
import { MAP_IMAGES } from '../data/gameContent';
import { MARKER_3D_COLORS } from '../three/markerPalette';
import { ClueRecord, FloorNumber, PhaseIndicator } from '../types';
import { MarkerShowcaseView } from './MarkerShowcaseView';

const ROMAN_STEPS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

export type SchoolModalTab = 'map' | 'clues' | 'markers';

interface SchoolMapModalProps {
  initialTab: SchoolModalTab;
  currentFloor: FloorNumber;
  playerCoords: { x: number; z: number; yaw: number; floor: FloorNumber };
  clues: ClueRecord[];
  phaseIndicator: PhaseIndicator;
  onTabChange?: (tab: SchoolModalTab) => void;
  onClose: () => void;
}

export const SchoolMapModal: React.FC<SchoolMapModalProps> = ({
  initialTab,
  currentFloor,
  playerCoords,
  clues,
  phaseIndicator,
  onTabChange,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<SchoolModalTab>(initialTab);
  const [viewingFloor, setViewingFloor] = useState<FloorNumber>(currentFloor);
  const [mapImgError, setMapImgError] = useState<Record<number, boolean>>({});

  const selectTab = (tab: SchoolModalTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  // Map world coordinates (x: -31..31, z: -26..9) onto percentage coordinates for live radar pin
  const radarLeftPct = Math.min(92, Math.max(8, ((playerCoords.x + 31) / 62) * 100));
  const radarTopPct = Math.min(92, Math.max(8, ((playerCoords.z + 26) / 35) * 100));

  return (
    <div className="font-sans pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-[#070a12]/82 backdrop-blur-md p-3 sm:p-6 overflow-y-auto">
      <div className="modal-nocturnal-panel relative w-full max-w-3xl my-auto p-2.5 sm:p-3">
        <div className="modal-nocturnal-inner relative p-4 sm:p-5">
          {/* Acentos finos de esquina congruentes con el Textbox */}
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

          {/* Top Modal Header & Segmented Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#7dd3fc]/20 pb-3.5">
            <div className="flex flex-wrap items-center gap-1 rounded-xl bg-[#070a12]/90 p-1 border border-[#7dd3fc]/25">
              <button
                type="button"
                onClick={() => selectTab('map')}
                className={`min-h-[38px] px-3.5 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'map'
                    ? 'border border-[#bae6fd]/70 bg-[#0d1829] font-semibold text-white shadow-[0_0_14px_rgba(125,211,252,0.2)]'
                    : 'font-medium text-slate-300 hover:text-white'
                }`}
              >
                <MapIcon className="h-3.5 w-3.5 text-[#7dd3fc]" />
                <span>Planos de la Escuela</span>
              </button>

              <button
                type="button"
                onClick={() => selectTab('clues')}
                className={`min-h-[38px] px-3.5 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'clues'
                    ? 'border border-[#bae6fd]/70 bg-[#0d1829] font-semibold text-white shadow-[0_0_14px_rgba(125,211,252,0.2)]'
                    : 'font-medium text-slate-300 hover:text-white'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5 text-[#7dd3fc]" />
                <span>Archivo de Rumores</span>
              </button>

              <button
                type="button"
                onClick={() => selectTab('markers')}
                className={`min-h-[38px] px-3.5 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'markers'
                    ? 'border border-[#bae6fd]/70 bg-[#0d1829] font-semibold text-white shadow-[0_0_14px_rgba(125,211,252,0.2)]'
                    : 'font-medium text-slate-300 hover:text-white'
                }`}
              >
                <Box className="h-3.5 w-3.5 text-[#7dd3fc]" />
                <span>Marcadores 3D</span>
              </button>
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

          {/* Enigmatic Phase Whisper Banner */}
          <div className="mt-3.5 rounded-xl border border-[#7dd3fc]/25 bg-[#0d1829]/70 px-3.5 py-2.5 text-xs text-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono-tech text-[11px] font-medium uppercase tracking-[0.14em] text-[#7dd3fc]">
                {phaseIndicator.stageTag}
              </span>
              <span aria-hidden="true" className="text-[#7dd3fc]/40">
                ·
              </span>
              <strong className="font-display text-sm font-semibold text-white">
                {phaseIndicator.title}
              </strong>
            </div>
            <p className="mt-1 font-normal text-slate-300/90">{phaseIndicator.whisper}</p>
          </div>

          {activeTab === 'map' ? (
            <div className="mt-4 space-y-3">
              {/* Floor Selector + Exact 3D Marker Color Legend */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {([1, 2] as FloorNumber[]).map((fl) => (
                    <button
                      key={fl}
                      type="button"
                      onClick={() => setViewingFloor(fl)}
                      className={`min-h-[38px] px-3.5 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                        viewingFloor === fl
                          ? 'border border-[#bae6fd]/80 bg-[#0d1829] text-white shadow-[0_0_14px_rgba(125,211,252,0.18)]'
                          : 'bg-[#070a12]/80 text-slate-300 border border-[#7dd3fc]/25 hover:border-[#7dd3fc]/55 hover:text-white'
                      }`}
                    >
                      {fl === 1 ? 'Primer Piso (1F)' : 'Segundo Piso (2F)'}
                      {currentFloor === fl ? ' · Estás aquí' : ''}
                    </button>
                  ))}
                </div>

                <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span
                      style={{ backgroundColor: MARKER_3D_COLORS.personaje.fill }}
                      className="inline-block h-2 w-2 rounded-full"
                    />
                    Persona
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      style={{ backgroundColor: MARKER_3D_COLORS.objeto.fill }}
                      className="inline-block h-2 w-2 rotate-45"
                    />
                    Objeto
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      style={{ backgroundColor: MARKER_3D_COLORS.escalera.fill }}
                      className="inline-block h-2 w-2"
                    />
                    Escalera
                  </span>
                </div>
              </div>

              {/* Official Architectural Map Image + Live Position Indicator */}
              <div className="relative w-full overflow-hidden rounded-xl border border-[#7dd3fc]/30 bg-[#070a12] aspect-[16/10] flex items-center justify-center">
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
                  <div className="text-center p-6 text-slate-200">
                    <p className="font-display text-lg font-semibold">
                      Plano del {viewingFloor}° Piso
                    </p>
                    <p className="text-xs mt-1 text-[#bae6fd]/75">
                      Ala Izquierda · Pasillo Central · Ala Derecha
                    </p>
                  </div>
                )}

                {viewingFloor === playerCoords.floor && (
                  <div
                    style={{
                      left: `${radarLeftPct}%`,
                      top: `${radarTopPct}%`,
                    }}
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                  >
                    <div className="h-7 w-7 rounded-full border-2 border-[#bae6fd] bg-[#070a12] text-white shadow-[0_0_16px_rgba(125,211,252,0.7)] flex items-center justify-center">
                      <Navigation
                        style={{ transform: `rotate(${-playerCoords.yaw}rad)` }}
                        className="h-3.5 w-3.5 text-[#bae6fd]"
                      />
                    </div>
                    <span className="mt-0.5 rounded bg-[#070a12]/90 border border-[#7dd3fc]/40 px-1.5 py-0.5 text-[10px] font-semibold text-[#bae6fd] whitespace-nowrap">
                      Tú
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'markers' ? (
            <MarkerShowcaseView />
          ) : (
            <div className="mt-4 max-h-[58vh] overflow-y-auto space-y-2.5 pr-1">
              {clues.map((clue) => (
                <div
                  key={clue.id}
                  className={`rounded-xl border p-3.5 transition-colors ${
                    clue.unlocked
                      ? 'border-[#7dd3fc]/35 bg-[#0d1829]/80'
                      : 'border-[#7dd3fc]/15 bg-[#070a12]/60 opacity-65'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {clue.unlocked ? (
                        <CheckCircle2 className="h-4 w-4 text-[#bae6fd] shrink-0" />
                      ) : (
                        <Lock className="h-4 w-4 text-slate-500 shrink-0" />
                      )}
                      <h3 className="text-sm font-medium text-white">
                        Rumor {ROMAN_STEPS[clue.stepNumber] || clue.stepNumber} ·{' '}
                        {clue.unlocked ? clue.title : 'Todavía sin confirmar'}
                      </h3>
                    </div>
                    <span className="text-[11px] font-medium text-[#7dd3fc]/80 whitespace-nowrap">
                      {clue.sensorUsed}
                    </span>
                  </div>

                  <p className="mt-1.5 text-xs font-normal leading-relaxed text-slate-300">
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
    </div>
  );
};
