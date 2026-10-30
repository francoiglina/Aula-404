import React from 'react';
import { BookOpen, Map as MapIcon, Volume2, VolumeX } from 'lucide-react';
import { FloorNumber, PhaseIndicator } from '../types';

const ROMAN_NUMERALS = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI'];

interface TopSensorHudProps {
  floor: FloorNumber;
  zoneName: string;
  phaseIndicator: PhaseIndicator;
  unlockedCluesCount: number;
  isMuted: boolean;
  onOpenMap: () => void;
  onOpenClues: () => void;
  onToggleMute: () => void;
}

export const TopSensorHud: React.FC<TopSensorHudProps> = ({
  floor,
  zoneName,
  phaseIndicator,
  unlockedCluesCount,
  isMuted,
  onOpenMap,
  onOpenClues,
  onToggleMute,
}) => {
  const romanProgress =
    unlockedCluesCount === 0
      ? '—'
      : ROMAN_NUMERALS[unlockedCluesCount] || String(unlockedCluesCount);

  return (
    <header className="font-sans pointer-events-auto fixed top-0 left-0 right-0 z-20 flex items-center justify-between gap-3 border-b border-stone-800/90 bg-stone-950/92 px-3 sm:px-5 h-13">
      {/* Zone 1: Brand & Current Floor/Room */}
      <div className="flex items-center gap-2 min-w-0 shrink-0">
        <span className="font-display text-base font-bold tracking-tight text-stone-50 whitespace-nowrap">
          Aula 404
        </span>
        <span aria-hidden="true" className="text-stone-600">
          ·
        </span>
        <span className="text-xs font-semibold text-amber-400 whitespace-nowrap">
          {floor}° Piso
        </span>
        <span aria-hidden="true" className="hidden lg:inline text-stone-600">
          ·
        </span>
        <span className="hidden lg:inline text-xs font-normal text-stone-400 truncate max-w-[190px]">
          {zoneName}
        </span>
      </div>

      {/* Zone 2: Enigmatic Phase / Rumor Indicator */}
      <div
        className="hidden sm:flex items-center justify-center gap-2 min-w-0 flex-1 px-2"
        title={phaseIndicator.whisper}
      >
        <span className="font-mono-tech text-[11px] font-semibold uppercase tracking-wider text-amber-400 shrink-0">
          {phaseIndicator.stageTag}
        </span>
        <span aria-hidden="true" className="text-stone-600 shrink-0">
          ·
        </span>
        <p className="font-display text-xs sm:text-sm font-medium text-stone-100 truncate max-w-md">
          {phaseIndicator.title}
        </p>
      </div>

      {/* Zone 3: Map, Rumors Archive & Audio Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onOpenMap}
          className="min-h-[40px] px-3 rounded-lg border border-stone-800 bg-stone-900 text-xs font-medium text-stone-100 hover:bg-stone-800 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <MapIcon className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span>Planos</span>
        </button>

        <button
          type="button"
          onClick={onOpenClues}
          className="min-h-[40px] px-3 rounded-lg border border-stone-800 bg-stone-900 text-xs font-medium text-stone-100 hover:bg-stone-800 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <BookOpen className="h-3.5 w-3.5 text-sky-400 shrink-0" />
          <span>Rumores</span>
          <span className="font-mono-tech text-[11px] font-semibold text-amber-400">
            {romanProgress}
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleMute}
          aria-label={isMuted ? 'Activar sonido' : 'Silenciar sonido'}
          className="min-h-[40px] min-w-[40px] rounded-lg border border-stone-800 bg-stone-900 text-stone-200 hover:bg-stone-800 active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer"
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4 text-stone-400" />
          ) : (
            <Volume2 className="h-4 w-4 text-amber-400" />
          )}
        </button>
      </div>
    </header>
  );
};

