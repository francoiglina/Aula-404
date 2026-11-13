import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Box, CheckCircle2, Lock, Map as MapIcon, X } from 'lucide-react';
import { MARKER_3D_COLORS } from '../three/markerPalette';
import { SchoolEngine } from '../three/SchoolEngine';
import { ClueRecord, FinalSubstate, FloorNumber, GamePhase, PhaseIndicator } from '../types';
import { FULL_MAP_VIEWPORT, renderSchoolMapCanvas } from '../utils/schoolMapRenderer';
import { MarkerShowcaseView } from './MarkerShowcaseView';

const ROMAN_STEPS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

export type SchoolModalTab = 'map' | 'clues' | 'markers';

interface SchoolMapModalProps {
  initialTab: SchoolModalTab;
  engineRef?: React.RefObject<SchoolEngine | null>;
  currentFloor: FloorNumber;
  phase: GamePhase;
  unlockedObjects: Record<string, boolean>;
  finalSubstate: FinalSubstate;
  playerCoords: { x: number; z: number; yaw: number; floor: FloorNumber };
  clues: ClueRecord[];
  phaseIndicator: PhaseIndicator;
  onTabChange?: (tab: SchoolModalTab) => void;
  onClose: () => void;
}

export const SchoolMapModal: React.FC<SchoolMapModalProps> = ({
  initialTab,
  engineRef,
  currentFloor,
  phase,
  unlockedObjects,
  finalSubstate,
  playerCoords,
  clues,
  phaseIndicator,
  onTabChange,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<SchoolModalTab>(initialTab);
  const [viewingFloor, setViewingFloor] = useState<FloorNumber>(currentFloor);
  const fullMapCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const selectTab = (tab: SchoolModalTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  // Refs sincronizados para renderizar el plano completo en tiempo real con worldToMap
  const liveStateRef = useRef({
    viewingFloor,
    phase,
    unlockedObjects,
    finalSubstate,
    playerCoords,
  });

  useEffect(() => {
    liveStateRef.current = {
      viewingFloor,
      phase,
      unlockedObjects,
      finalSubstate,
      playerCoords,
    };
  }, [viewingFloor, phase, unlockedObjects, finalSubstate, playerCoords]);

  useEffect(() => {
    if (activeTab !== 'map') return;
    let rafId = 0;

    const renderFullMapFrame = () => {
      const canvas = fullMapCanvasRef.current;
      const engine = engineRef?.current;
      const cur = liveStateRef.current;

      if (canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const targetW = Math.round(FULL_MAP_VIEWPORT.width * dpr);
        const targetH = Math.round(FULL_MAP_VIEWPORT.height * dpr);

        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);

          renderSchoolMapCanvas({
            ctx,
            viewport: FULL_MAP_VIEWPORT,
            floor: cur.viewingFloor,
            phase: cur.phase,
            unlockedObjects: cur.unlockedObjects,
            finalSubstate: cur.finalSubstate,
            player: {
              x: engine ? engine.playerPos.x : cur.playerCoords.x,
              z: engine ? engine.playerPos.z : cur.playerCoords.z,
              yaw: engine ? engine.playerYaw : cur.playerCoords.yaw,
              floor: engine ? engine.getCurrentFloor() : cur.playerCoords.floor,
            },
            variant: 'full',
          });

          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(renderFullMapFrame);
    };

    rafId = requestAnimationFrame(renderFullMapFrame);
    return () => cancelAnimationFrame(rafId);
  }, [activeTab, engineRef]);

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
              {/* Selector de Piso + Leyenda Exacta Compartida con el Minimapa */}
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

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
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

              {/* Canvas Unificado del Plano Completo (idéntico al minimapa: mismos bounds, worldToMap y marcadores) */}
              <div className="relative w-full overflow-hidden rounded-xl border border-[#7dd3fc]/35 bg-[#070a12] shadow-[inset_0_0_32px_rgba(13,24,41,0.75)]">
                <canvas
                  ref={fullMapCanvasRef}
                  aria-label={`Plano interactivo del ${viewingFloor === 1 ? 'Primer Piso' : 'Segundo Piso'}`}
                  className="block w-full h-auto aspect-[760/448]"
                />

                {viewingFloor !== playerCoords.floor && (
                  <div className="pointer-events-none absolute bottom-2.5 right-3 rounded-lg border border-[#7dd3fc]/30 bg-[#070a12]/88 px-2.5 py-1 text-[10px] font-medium tracking-wide text-[#bae6fd]">
                    Tu posición actual está en el {playerCoords.floor}° Piso
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
