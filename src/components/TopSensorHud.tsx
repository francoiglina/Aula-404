import React from 'react';
import { BookOpen, Map as MapIcon, Volume2, VolumeX } from 'lucide-react';
import { FloorNumber } from '../types';

interface TopSensorHudProps {
  floor: FloorNumber;
  zoneName: string;
  objectiveText: string;
  unlockedCluesCount: number;
  totalCluesCount: number;
  isMuted: boolean;
  onOpenMap: () => void;
  onOpenClues: () => void;
  onToggleMute: () => void;
}

export const TopSensorHud: React.FC<TopSensorHudProps> = ({
  floor,
  zoneName,
  objectiveText,
  unlockedCluesCount,
  totalCluesCount,
  isMuted,
  onOpenMap,
  onOpenClues,
  onToggleMute,
}) => {
  return (
    <header className="pointer-events-auto fixed top-0 left-0 right-0 z-20 flex items-center justify-between gap-3 border-b border-stone-800/90 bg-stone-950/92 px-3 sm:px-5 h-13">
      {/* Zone 1: Brand & Current Floor/Room */}
      <div className="flex items-center gap-2 min-w-0 shrink-0">
        <span className="font-display text-base font-bold tracking-tight text-stone-50 whitespace-nowrap">
          Aula 404
        </span>
        <span aria-hidden="true" className="text-stone-600">
          ·
        </span>
        <span className="text-xs font-medium text-amber-400 whitespace-nowrap">
          {floor}° Piso
        </span>
        <span aria-hidden="true" className="hidden md:inline text-stone-600">
          ·
        </span>
        <span className="hidden md:inline text-xs text-stone-300 truncate max-w-[200px]">
          {zoneName}
        </span>
      </div>

      {/* Zone 2: Active Story Step Objective */}
      <div className="hidden sm:flex items-center justify-center min-w-0 flex-1 px-2">
        <p className="text-xs text-stone-200 truncate max-w-xl" title={objectiveText}>
          {objectiveText}
        </p>
      </div>

      {/* Zone 3: Map, Clues & Audio Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onOpenMap}
          className="min-h-[40px] px-3 rounded-lg border border-stone-800 bg-stone-900 text-xs font-semibold text-stone-100 hover:bg-stone-800 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <MapIcon className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span>Mapa</span>
        </button>

        <button
          type="button"
          onClick={onOpenClues}
          className="min-h-[40px] px-3 rounded-lg border border-stone-800 bg-stone-900 text-xs font-semibold text-stone-100 hover:bg-stone-800 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <BookOpen className="h-3.5 w-3.5 text-sky-400 shrink-0" />
          <span className="font-mono-tech">
            Pistas {unlockedCluesCount}/{totalCluesCount}
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleMute}
          aria-label={isMuted ? 'Activar sonido' : 'Silenciar sonido'}
          className="min-h-[40px] min-w-[40px] rounded-lg border border-stone-800 bg-stone-900 text-stone-200 hover:bg-stone-800 active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer"
        >
          {isMuted ? <VolumeX className="h-4 w-4 text-stone-400" /> : <Volume2 className="h-4 w-4 text-amber-400" />}
        </button>
      </div>
    </header>
  );
};
