import React, { useRef, useState } from 'react';
import { ArrowUpDown, DoorOpen, Hand, MessageCircle } from 'lucide-react';
import { WorldMarker } from '../types';

interface MobileControlsOverlayProps {
  nearbyMarker: WorldMarker | null;
  onMoveInput: (x: number, y: number) => void;
  onInteract: () => void;
}

/**
 * Controles minimalistas en pantalla: únicamente joystick analógico inferior izquierdo
 * y botón de acción inferior derecho con trazos finos blanco/cian pálido y resplandor al interactuar.
 */
export const MobileControlsOverlay: React.FC<MobileControlsOverlayProps> = ({
  nearbyMarker,
  onMoveInput,
  onInteract,
}) => {
  const stickZoneRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [isStickActive, setIsStickActive] = useState(false);

  const maxRadius = 40;

  const updateStickFromClient = (clientX: number, clientY: number) => {
    const el = stickZoneRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);

    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    setKnobOffset({ x: dx, y: dy });
    // Adelante corresponde a -dy
    onMoveInput(dx / maxRadius, -dy / maxRadius);
  };

  const handleStickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    activePointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsStickActive(true);
    updateStickFromClient(e.clientX, e.clientY);
  };

  const handleStickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== activePointerId.current) return;
    e.stopPropagation();
    updateStickFromClient(e.clientX, e.clientY);
  };

  const handleStickUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== activePointerId.current) return;
    e.stopPropagation();
    activePointerId.current = null;
    setIsStickActive(false);
    setKnobOffset({ x: 0, y: 0 });
    onMoveInput(0, 0);
  };

  const actionVerb = nearbyMarker
    ? nearbyMarker.kind === 'personaje'
      ? 'Hablar'
      : nearbyMarker.kind === 'escalera'
      ? nearbyMarker.targetFloor === 2
        ? 'Subir'
        : 'Bajar'
      : nearbyMarker.kind === 'puerta'
      ? 'Abrir'
      : 'Examinar'
    : 'Acción';

  return (
    <>
      {/* CONTROLADOR IZQUIERDO: Joystick minimalista de trazos finos blanco/cian */}
      <div className="font-sans pointer-events-auto fixed bottom-5 left-5 sm:bottom-6 sm:left-6 z-20 flex flex-col items-center gap-1.5">
        <div
          ref={stickZoneRef}
          onPointerDown={handleStickDown}
          onPointerMove={handleStickMove}
          onPointerUp={handleStickUp}
          onPointerCancel={handleStickUp}
          aria-label="Stick analógico de movimiento"
          className={`hud-joystick-pad relative h-28 w-28 sm:h-30 sm:w-30 rounded-full flex items-center justify-center touch-none cursor-grab active:cursor-grabbing ${
            isStickActive ? 'is-active' : ''
          }`}
        >
          {/* Aro guía interior con contorno oscuro sutil + trazo cian */}
          <div className="h-16 w-16 rounded-full border border-[#bae6fd]/30 shadow-[0_0_8px_rgba(0,0,0,0.65)] pointer-events-none" />

          {/* Pulgar central translúcido */}
          <div
            style={{
              transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
            }}
            className={`hud-joystick-knob pointer-events-none absolute h-11 w-11 rounded-full flex items-center justify-center transition-transform duration-75 ${
              isStickActive ? 'is-active' : ''
            }`}
          >
            <div className="h-2.5 w-2.5 rounded-full bg-[#e0f2fe] shadow-[0_0_8px_rgba(125,211,252,0.9),0_0_3px_rgba(0,0,0,0.9)]" />
          </div>
        </div>
        <span className="hud-text-contrast text-[10px] font-medium tracking-[0.2em] uppercase text-white/85">
          Mover
        </span>
      </div>

      {/* CONTROLADOR DERECHO: Botón de acción minimalista con resplandor y contraste garantizado */}
      <div className="font-sans pointer-events-auto fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-20 flex flex-col items-center gap-1.5">
        {nearbyMarker && (
          <span className="hud-text-contrast pointer-events-none mb-0.5 max-w-[168px] truncate text-[11px] font-medium tracking-[0.06em] text-[#e0f2fe]">
            {nearbyMarker.label}
          </span>
        )}

        <button
          type="button"
          data-no-confirm-sfx="true"
          onClick={onInteract}
          disabled={!nearbyMarker}
          aria-label={
            nearbyMarker ? `${actionVerb}: ${nearbyMarker.label}` : 'Interactuar'
          }
          className={`hud-action-button h-22 w-22 sm:h-25 sm:w-25 rounded-full flex flex-col items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed ${
            nearbyMarker ? 'is-ready' : 'is-idle'
          }`}
        >
          {nearbyMarker?.kind === 'personaje' ? (
            <MessageCircle className="h-6 w-6 stroke-[1.7] drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" />
          ) : nearbyMarker?.kind === 'escalera' ? (
            <ArrowUpDown className="h-6 w-6 stroke-[1.7] drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" />
          ) : nearbyMarker?.kind === 'puerta' ? (
            <DoorOpen className="h-6 w-6 stroke-[1.7] drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" />
          ) : (
            <Hand className="h-6 w-6 stroke-[1.7] drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" />
          )}
          <span className="hud-text-contrast text-[11px] font-medium tracking-[0.12em] uppercase whitespace-nowrap">
            {actionVerb}
          </span>
        </button>
      </div>
    </>
  );
};
