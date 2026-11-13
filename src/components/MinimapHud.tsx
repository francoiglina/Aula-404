import React, { useEffect, useRef, useState } from 'react';
import { SchoolEngine } from '../three/SchoolEngine';
import { FinalSubstate, FloorNumber, GamePhase } from '../types';
import {
  MINIMAP_VIEWPORT,
  renderSchoolMapCanvas,
  resolveMapMarkerVisibility,
  worldToMap,
} from '../utils/schoolMapRenderer';

export { worldToMap as worldToMinimap, resolveMapMarkerVisibility as resolveMinimapMarkerVisibility };

interface MinimapHudProps {
  engineRef: React.RefObject<SchoolEngine | null>;
  floor: FloorNumber;
  phase: GamePhase;
  unlockedObjects: Record<string, boolean>;
  finalSubstate: FinalSubstate;
  onOpenFullMap?: () => void;
}

export const MinimapHud: React.FC<MinimapHudProps> = ({
  engineRef,
  floor,
  phase,
  unlockedObjects,
  finalSubstate,
  onOpenFullMap,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [displayedFloor, setDisplayedFloor] = useState<FloorNumber>(floor);

  // Refs sincronizados para que el bucle requestAnimationFrame nunca lea estado obsoleto
  const stateRef = useRef({
    floor,
    phase,
    unlockedObjects,
    finalSubstate,
  });

  useEffect(() => {
    stateRef.current = {
      floor,
      phase,
      unlockedObjects,
      finalSubstate,
    };
    setDisplayedFloor(floor);
  }, [floor, phase, unlockedObjects, finalSubstate]);

  useEffect(() => {
    let rafId = 0;
    let lastKnownFloor: FloorNumber = stateRef.current.floor;

    const renderMinimapFrame = () => {
      const canvas = canvasRef.current;
      const engine = engineRef.current;
      const curState = stateRef.current;

      // Detectar cambio automático de piso desde el motor 3D al subir o bajar escaleras
      const liveFloor: FloorNumber = engine ? engine.getCurrentFloor() : curState.floor;
      if (liveFloor !== lastKnownFloor) {
        lastKnownFloor = liveFloor;
        setDisplayedFloor(liveFloor);
      }

      if (canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const targetW = Math.round(MINIMAP_VIEWPORT.width * dpr);
        const targetH = Math.round(MINIMAP_VIEWPORT.height * dpr);

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
            viewport: MINIMAP_VIEWPORT,
            floor: liveFloor,
            phase: curState.phase,
            unlockedObjects: curState.unlockedObjects,
            finalSubstate: curState.finalSubstate,
            player: {
              x: engine ? engine.playerPos.x : -1.5,
              z: engine ? engine.playerPos.z : 6.0,
              yaw: engine ? engine.playerYaw : 0,
              floor: liveFloor,
            },
            variant: 'minimap',
          });

          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(renderMinimapFrame);
    };

    rafId = requestAnimationFrame(renderMinimapFrame);
    return () => cancelAnimationFrame(rafId);
  }, [engineRef]);

  return (
    <div aria-label="Minimapa en tiempo real" className="w-full select-none">
      <button
        type="button"
        onClick={onOpenFullMap}
        title="Abrir plano detallado"
        aria-label={`Minimapa ${displayedFloor === 1 ? 'Primer Piso' : 'Segundo Piso'}. Toca para ver el plano completo`}
        className="group relative block w-full bg-transparent border-0 p-0 cursor-pointer focus:outline-none"
      >
        <div className="minimap-floating-mask transition-opacity duration-200 group-hover:opacity-100 opacity-95">
          <canvas
            ref={canvasRef}
            className="block w-full h-auto aspect-[224/132]"
          />
        </div>
        <span className="hud-text-contrast pointer-events-none mt-0.5 block text-right pr-1.5 text-[10px] font-medium tracking-[0.2em] uppercase text-[#bae6fd]">
          {displayedFloor === 1 ? '— 1F —' : '— 2F —'}
        </span>
      </button>
    </div>
  );
};
