import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  Aula404MarkerViewer,
  MARKER_GLB_PATHS,
  MarkerGlbKind,
} from '../three/Aula404MarkerViewer';

interface MarkerShowcaseViewProps {
  initialKind?: MarkerGlbKind;
}

export const MarkerShowcaseView: React.FC<MarkerShowcaseViewProps> = ({
  initialKind = 'objeto',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Aula404MarkerViewer | null>(null);

  const [activeKind, setActiveKind] = useState<MarkerGlbKind>(initialKind);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const viewer = new Aula404MarkerViewer(container, {
      initialMarker: initialKind,
      onLoadStateChange: ({ loading, error, activeKind: loadedKind }) => {
        setIsLoading(loading);
        setLoadError(error);
        setActiveKind(loadedKind);
      },
    });
    viewerRef.current = viewer;

    return () => {
      viewer.dispose();
      viewerRef.current = null;
    };
  }, [initialKind]);

  const handleSelectKind = (kind: MarkerGlbKind) => {
    setActiveKind(kind);
    void viewerRef.current?.loadMarker(kind);
  };

  return (
    <div className="mt-4 space-y-3">
      {/* Selector de Marcador GLB ("objeto" / "persona") + Reset de Cámara */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 rounded-xl border border-stone-800 bg-stone-900 p-1">
          <button
            type="button"
            onClick={() => handleSelectKind('objeto')}
            className={`min-h-[38px] px-3.5 rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap ${
              activeKind === 'objeto'
                ? 'bg-rose-600 font-semibold text-white'
                : 'font-medium text-stone-300 hover:text-stone-100'
            }`}
          >
            Marcador Objeto
          </button>

          <button
            type="button"
            onClick={() => handleSelectKind('persona')}
            className={`min-h-[38px] px-3.5 rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap ${
              activeKind === 'persona'
                ? 'bg-sky-600 font-semibold text-white'
                : 'font-medium text-stone-300 hover:text-stone-100'
            }`}
          >
            Marcador Persona
          </button>
        </div>

        <button
          type="button"
          onClick={() => viewerRef.current?.resetCamera()}
          className="min-h-[38px] px-3.5 rounded-xl border border-stone-800 bg-stone-900 text-xs font-medium text-stone-200 hover:bg-stone-800 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <RotateCcw className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span>Centrar encuadre</span>
        </button>
      </div>

      {/* Viewport WebGL Transparente integrado sobre el tema oscuro de Aula 404 */}
      <div
        className={`relative w-full aspect-[16/10] overflow-hidden rounded-2xl border border-stone-800 ${
          activeKind === 'objeto' ? 'marker-viewport-objeto' : 'marker-viewport-persona'
        }`}
      >
        {/* Contenedor aislado para el canvas de Three.js */}
        <div ref={mountRef} className="h-full w-full" />

        {isLoading && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-medium text-stone-300">
              Cargando modelo 3D...
            </span>
          </div>
        )}

        {loadError && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center">
            <span className="text-xs font-medium text-rose-400">{loadError}</span>
          </div>
        )}

        {/* Leyenda discreta inferior sin cubrir el marcador central */}
        <div className="pointer-events-none absolute bottom-3 left-4 right-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-400">
          <span className="truncate">
            {MARKER_GLB_PATHS[activeKind].replace(/^\//, '')}
          </span>
          <span className="whitespace-nowrap">
            Arrastra para rotar · Rueda o pellizco para zoom
          </span>
        </div>
      </div>
    </div>
  );
};
