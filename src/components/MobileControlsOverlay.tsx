import React, { useRef, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Compass,
  Hand,
  MessageCircle,
  RefreshCw,
  ArrowUpDown,
  SwitchCamera,
} from 'lucide-react';
import { WorldMarker } from '../types';

interface MobileControlsOverlayProps {
  nearbyMarker: WorldMarker | null;
  objectiveText: string;
  gyroLookEnabled: boolean;
  cameraAllowed: boolean;
  onMoveInput: (x: number, y: number) => void;
  onInteract: () => void;
  onToggleGyroLook: () => void;
  onResetCamera: () => void;
  onCapturePhoto: () => void;
  onSwitchCamera: () => void;
}

export const MobileControlsOverlay: React.FC<MobileControlsOverlayProps> = ({
  nearbyMarker,
  objectiveText,
  gyroLookEnabled,
  cameraAllowed,
  onMoveInput,
  onInteract,
  onToggleGyroLook,
  onResetCamera,
  onCapturePhoto,
  onSwitchCamera,
}) => {
  const stickZoneRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [dockExpanded, setDockExpanded] = useState(false);

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
    // Forward is -dy (pushing stick up moves forward +1)
    onMoveInput(dx / maxRadius, -dy / maxRadius);
  };

  const handleStickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    activePointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
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
    setKnobOffset({ x: 0, y: 0 });
    onMoveInput(0, 0);
  };

  const interactStyle = nearbyMarker
    ? nearbyMarker.kind === 'personaje'
      ? 'border-sky-400 bg-sky-500 text-stone-950 shadow-lg shadow-sky-950/60'
      : nearbyMarker.kind === 'escalera'
      ? 'border-amber-300 bg-amber-400 text-stone-950 shadow-lg shadow-amber-950/60'
      : 'border-rose-400 bg-rose-500 text-white shadow-lg shadow-rose-950/60'
    : 'border-stone-700 bg-stone-900/90 text-stone-400';

  return (
    <>
      {/* Mobile Compact Objective Strip (only visible on extra-small screens where top bar hides center text) */}
      <div className="pointer-events-none fixed top-15 left-3 right-3 z-10 flex justify-center sm:hidden">
        <div className="rounded-xl border border-stone-800/90 bg-stone-950/88 px-3 py-1.5 text-[11px] text-stone-200 text-center max-w-md">
          {objectiveText}
        </div>
      </div>

      {/* Nearby Contextual Prompt Banner above bottom dock */}
      {nearbyMarker && (
        <div className="pointer-events-none fixed bottom-32 left-1/2 -translate-x-1/2 z-20 px-3 w-full max-w-sm flex justify-center">
          <div className="rounded-2xl border border-stone-700 bg-stone-950/92 px-4 py-2 text-center shadow-xl">
            <p className="text-xs font-bold text-stone-50">{nearbyMarker.label}</p>
            <p className="text-[11px] text-stone-300">
              {nearbyMarker.sublabel} · Pulsa el botón derecho
            </p>
          </div>
        </div>
      )}

      {/* LEFT OVERLAY: Console-Style Circular Virtual Analog Stick */}
      <div className="pointer-events-auto fixed bottom-5 left-5 z-20 flex flex-col items-center gap-1.5">
        <div
          ref={stickZoneRef}
          onPointerDown={handleStickDown}
          onPointerMove={handleStickMove}
          onPointerUp={handleStickUp}
          onPointerCancel={handleStickUp}
          aria-label="Stick analógico de movimiento"
          className="relative h-28 w-28 sm:h-32 sm:w-32 rounded-full border-2 border-stone-700 bg-stone-950/85 shadow-xl flex items-center justify-center touch-none cursor-grab active:cursor-grabbing"
        >
          {/* Subtle inner guide ring */}
          <div className="h-18 w-18 rounded-full border border-stone-800 pointer-events-none" />

          {/* Analog Thumb Cap */}
          <div
            style={{
              transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
            }}
            className="pointer-events-none absolute h-12 w-12 rounded-full border-2 border-amber-400/80 bg-stone-800 shadow-md flex items-center justify-center transition-transform duration-75"
          >
            <div className="h-4 w-4 rounded-full bg-amber-400/90" />
          </div>
        </div>
        <span className="text-[11px] font-medium text-stone-400">Mover</span>
      </div>

      {/* CENTER COLLAPSIBLE UTILITY DOCK (SDD 4.2 Camera/Gyro/Photo Tools) */}
      <div className="pointer-events-auto fixed bottom-5 left-1/2 -translate-x-1/2 z-20 hidden md:flex flex-col items-center">
        <button
          type="button"
          onClick={() => setDockExpanded((v) => !v)}
          className="min-h-[34px] px-3 py-1 rounded-t-xl border border-b-0 border-stone-800 bg-stone-950/92 text-[11px] font-medium text-stone-300 hover:text-stone-100 flex items-center gap-1 cursor-pointer whitespace-nowrap"
        >
          {dockExpanded ? (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              <span>Ocultar Herramientas</span>
            </>
          ) : (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              <span> Sensores y Cámara</span>
            </>
          )}
        </button>

        {dockExpanded && (
          <div className="rounded-2xl border border-stone-800 bg-stone-950/94 p-2 flex items-center gap-2 shadow-2xl">
            <button
              type="button"
              onClick={onToggleGyroLook}
              className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                gyroLookEnabled
                  ? 'bg-amber-500 text-stone-950'
                  : 'bg-stone-900 text-stone-200 hover:bg-stone-800 border border-stone-800'
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
              <span>{gyroLookEnabled ? 'Giroscopio Activo' : 'Mirar con Giroscopio'}</span>
            </button>

            <button
              type="button"
              onClick={onResetCamera}
              className="min-h-[40px] px-3 rounded-xl border border-stone-800 bg-stone-900 text-xs font-semibold text-stone-200 hover:bg-stone-800 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="h-3.5 w-3.5 text-stone-400" />
              <span>Centrar Vista</span>
            </button>

            {cameraAllowed && (
              <button
                type="button"
                onClick={onSwitchCamera}
                className="min-h-[40px] px-3 rounded-xl border border-stone-800 bg-stone-900 text-xs font-semibold text-stone-200 hover:bg-stone-800 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <SwitchCamera className="h-3.5 w-3.5 text-rose-400" />
                <span>Cambiar Lente</span>
              </button>
            )}

            <button
              type="button"
              onClick={onCapturePhoto}
              className="min-h-[40px] px-3 rounded-xl border border-stone-800 bg-stone-900 text-xs font-semibold text-stone-200 hover:bg-stone-800 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Camera className="h-3.5 w-3.5 text-sky-400" />
              <span>Capturar Foto</span>
            </button>
          </div>
        )}
      </div>

      {/* Compact Mobile Gyro / Photo Pill above right button on phones */}
      <div className="pointer-events-auto fixed top-15 right-3 z-20 flex md:hidden flex-col gap-1.5">
        <button
          type="button"
          onClick={onToggleGyroLook}
          aria-label="Alternar vista con giroscopio"
          className={`min-h-[44px] min-w-[44px] rounded-xl border flex items-center justify-center cursor-pointer ${
            gyroLookEnabled
              ? 'border-amber-400 bg-amber-500 text-stone-950'
              : 'border-stone-800 bg-stone-950/90 text-stone-300'
          }`}
        >
          <Compass className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onCapturePhoto}
          aria-label="Capturar foto de la escena"
          className="min-h-[44px] min-w-[44px] rounded-xl border border-stone-800 bg-stone-950/90 text-stone-300 flex items-center justify-center cursor-pointer"
        >
          <Camera className="h-4 w-4" />
        </button>
      </div>

      {/* RIGHT OVERLAY: Dedicated Single Action / Interact Button */}
      <div className="pointer-events-auto fixed bottom-5 right-5 z-20 flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={onInteract}
          disabled={!nearbyMarker}
          aria-label="Interactuar con marcador cercano"
          className={`h-24 w-24 sm:h-28 sm:w-28 rounded-full border-2 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:opacity-65 ${interactStyle}`}
        >
          {nearbyMarker?.kind === 'personaje' ? (
            <MessageCircle className="h-7 w-7" />
          ) : nearbyMarker?.kind === 'escalera' ? (
            <ArrowUpDown className="h-7 w-7" />
          ) : (
            <Hand className="h-7 w-7" />
          )}
          <span className="text-xs font-bold tracking-tight whitespace-nowrap">
            {nearbyMarker
              ? nearbyMarker.kind === 'personaje'
                ? 'Hablar'
                : nearbyMarker.kind === 'escalera'
                ? nearbyMarker.targetFloor === 2
                  ? 'Subir'
                  : 'Bajar'
                : 'Examinar'
              : 'Acción'}
          </span>
        </button>
        <span className="text-[11px] font-medium text-stone-400">Interactuar</span>
      </div>
    </>
  );
};
