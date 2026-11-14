import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Lock, LockOpen, RotateCcw } from 'lucide-react';
import { soundEngine } from '../services/soundEngine';

interface KarakuriLockChallengeProps {
  onUnlocked: () => void;
}

const INITIAL_RING_ANGLES: [number, number, number, number] = [120, -90, 150, -60];
const ALIGN_TOLERANCE_DEG = 7.4; // Estricto < 7.5° para coincidir exactamente con dientes de 15°
const SNAP_TOOTH_DEG = 15;
const TICK_STEP_DEG = 24;
const COUPLE_FACTOR = 0.5;
const BUTTON_STEP_DEG = 30;

interface RingConfig {
  label: string;
  rOuter: number;
  rInner: number;
  gradId: string;
  stroke: string;
}

const RINGS: RingConfig[] = [
  { label: 'Exterior', rOuter: 130, rInner: 103, gradId: 'karakuriIronGrad', stroke: '#785a46' },
  { label: 'Cedro', rOuter: 100, rInner: 75, gradId: 'karakuriWoodGrad', stroke: '#8f623d' },
  { label: 'Bronce', rOuter: 72, rInner: 49, gradId: 'karakuriBrassGrad', stroke: '#b8944f' },
  { label: 'Núcleo', rOuter: 46, rInner: 24, gradId: 'karakuriSteelGrad', stroke: '#6b7280' },
];

function normalizeSignedDeg(deg: number): number {
  let d = ((deg % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

function isRingAligned(deg: number): boolean {
  return Math.abs(normalizeSignedDeg(deg)) <= ALIGN_TOLERANCE_DEG;
}

export const KarakuriLockChallenge: React.FC<KarakuriLockChallengeProps> = ({
  onUnlocked,
}) => {
  const [angles, setAngles] = useState<[number, number, number, number]>(INITIAL_RING_ANGLES);
  const [selectedRing, setSelectedRing] = useState<number>(0);
  const [draggingRing, setDraggingRing] = useState<number | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);

  const dialRef = useRef<SVGSVGElement | null>(null);
  const anglesRef = useRef<[number, number, number, number]>(INITIAL_RING_ANGLES);
  const activePointerRef = useRef<{
    pointerId: number;
    ringIndex: number;
    lastAngleRad: number;
  } | null>(null);
  const unlockedTriggeredRef = useRef(false);
  const solveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (solveTimerRef.current !== null) {
        clearTimeout(solveTimerRef.current);
      }
    };
  }, []);

  const checkSolved = useCallback(
    (nextAngles: [number, number, number, number]) => {
      if (unlockedTriggeredRef.current) return;
      if (nextAngles.every((deg) => isRingAligned(deg))) {
        unlockedTriggeredRef.current = true;
        setIsUnlocked(true);
        soundEngine.playLockOpen();
        solveTimerRef.current = window.setTimeout(() => {
          onUnlocked();
        }, 880);
      }
    },
    [onUnlocked]
  );

  const applyRingRotation = useCallback(
    (ringIdx: number, deltaDeg: number, snapOnApply = false) => {
      if (unlockedTriggeredRef.current || Math.abs(deltaDeg) < 0.01) return;

      const prev = anglesRef.current;
      const next: [number, number, number, number] = [...prev] as [
        number,
        number,
        number,
        number,
      ];

      // Giro principal del anillo elegido
      next[ringIdx] = prev[ringIdx] + deltaDeg;
      // Giro acoplado: arrastra levemente al anillo interior adyacente
      const coupledIdx = ringIdx < 3 ? ringIdx + 1 : null;
      if (coupledIdx !== null) {
        next[coupledIdx] = prev[coupledIdx] + deltaDeg * COUPLE_FACTOR;
      }

      if (snapOnApply) {
        next[ringIdx] = Math.round(next[ringIdx] / SNAP_TOOTH_DEG) * SNAP_TOOTH_DEG;
        if (coupledIdx !== null) {
          next[coupledIdx] = Math.round(next[coupledIdx] / SNAP_TOOTH_DEG) * SNAP_TOOTH_DEG;
        }
      }

      // Sonido mecánico al cruzar muescas de diente
      const prevStep = Math.round(prev[ringIdx] / TICK_STEP_DEG);
      const nextStep = Math.round(next[ringIdx] / TICK_STEP_DEG);
      if (prevStep !== nextStep) {
        soundEngine.playLockTick(ringIdx);
      }

      // Sonido metálico "clack" distinto + vibración cuando un anillo cae en su muesca exacta
      let clackTriggered = false;
      const indicesToCheck = coupledIdx !== null ? [ringIdx, coupledIdx] : [ringIdx];
      for (const idx of indicesToCheck) {
        if (!isRingAligned(prev[idx]) && isRingAligned(next[idx])) {
          clackTriggered = true;
          break;
        }
      }
      if (clackTriggered) {
        soundEngine.playLockNotchClack();
      }

      anglesRef.current = next;
      setAngles(next);
      checkSolved(next);
    },
    [checkSolved]
  );

  const snapDraggedRings = useCallback(
    (ringIdx: number) => {
      if (unlockedTriggeredRef.current) return;
      const prev = anglesRef.current;
      const next: [number, number, number, number] = [...prev] as [
        number,
        number,
        number,
        number,
      ];

      next[ringIdx] = Math.round(prev[ringIdx] / SNAP_TOOTH_DEG) * SNAP_TOOTH_DEG;
      const coupledIdx = ringIdx < 3 ? ringIdx + 1 : null;
      if (coupledIdx !== null) {
        next[coupledIdx] = Math.round(prev[coupledIdx] / SNAP_TOOTH_DEG) * SNAP_TOOTH_DEG;
      }

      if (!isRingAligned(prev[ringIdx]) && isRingAligned(next[ringIdx])) {
        soundEngine.playLockNotchClack();
      } else if (
        coupledIdx !== null &&
        !isRingAligned(prev[coupledIdx]) &&
        isRingAligned(next[coupledIdx])
      ) {
        soundEngine.playLockNotchClack();
      }

      anglesRef.current = next;
      setAngles(next);
      checkSolved(next);
    },
    [checkSolved]
  );

  const getDialPointerMetrics = (clientX: number, clientY: number) => {
    const svg = dialRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const radiusSvg = (Math.hypot(dx, dy) / (rect.width * 0.5)) * 150;
    const angleRad = Math.atan2(dy, dx);
    return { radiusSvg, angleRad };
  };

  const detectRingAtRadius = (rSvg: number): number | null => {
    if (rSvg >= 102 && rSvg <= 142) return 0;
    if (rSvg >= 74 && rSvg < 102) return 1;
    if (rSvg >= 48 && rSvg < 74) return 2;
    if (rSvg >= 16 && rSvg < 48) return 3;
    return null;
  };

  const handleDialPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (unlockedTriggeredRef.current) return;
    const metrics = getDialPointerMetrics(e.clientX, e.clientY);
    if (!metrics) return;

    const ringIdx = detectRingAtRadius(metrics.radiusSvg);
    if (ringIdx === null) return;

    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointerRef.current = {
      pointerId: e.pointerId,
      ringIndex: ringIdx,
      lastAngleRad: metrics.angleRad,
    };
    setSelectedRing(ringIdx);
    setDraggingRing(ringIdx);
  };

  const handleDialPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const active = activePointerRef.current;
    if (!active || active.pointerId !== e.pointerId || unlockedTriggeredRef.current) return;

    const metrics = getDialPointerMetrics(e.clientX, e.clientY);
    if (!metrics) return;

    let dRad = metrics.angleRad - active.lastAngleRad;
    if (dRad > Math.PI) dRad -= Math.PI * 2;
    if (dRad < -Math.PI) dRad += Math.PI * 2;
    active.lastAngleRad = metrics.angleRad;

    const deltaDeg = (dRad * 180) / Math.PI;
    applyRingRotation(active.ringIndex, deltaDeg, false);
  };

  const handleDialPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const active = activePointerRef.current;
    if (!active || active.pointerId !== e.pointerId) return;
    activePointerRef.current = null;
    setDraggingRing(null);
    snapDraggedRings(active.ringIndex);
  };

  const handleReset = () => {
    if (unlockedTriggeredRef.current) return;
    soundEngine.playLockTick(0);
    anglesRef.current = INITIAL_RING_ANGLES;
    setAngles(INITIAL_RING_ANGLES);
  };

  // Soporte de teclado en escritorio (Flechas Arriba/Abajo seleccionan anillo, Izquierda/Derecha giran)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (unlockedTriggeredRef.current) return;
      if (e.code === 'ArrowUp') {
        e.preventDefault();
        setSelectedRing((prev) => (prev + 3) % 4);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setSelectedRing((prev) => (prev + 1) % 4);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        applyRingRotation(selectedRing, -BUTTON_STEP_DEG, true);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        applyRingRotation(selectedRing, BUTTON_STEP_DEG, true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [applyRingRotation, selectedRing]);

  const alignedCount = angles.filter((deg) => isRingAligned(deg)).length;

  return (
    <div className="space-y-3.5">
      <p className="text-sm font-normal leading-relaxed text-slate-200/90">
        Arrastra cada anillo oxidado para alinear las cuatro muescas con la ranura superior. Al
        girar un aro, arrastra levemente al anillo interior contiguo; alinéalos de afuera hacia
        adentro.
      </p>

      {/* Candado Karakuri interactivo */}
      <div className="rounded-xl border border-[#7dd3fc]/25 bg-[#070a12]/88 p-3.5 sm:p-4 flex flex-col items-center gap-3">
        <div className="relative w-full max-w-[285px] sm:max-w-[305px] aspect-square flex items-center justify-center">
          <svg
            ref={dialRef}
            viewBox="-150 -150 300 300"
            onPointerDown={handleDialPointerDown}
            onPointerMove={handleDialPointerMove}
            onPointerUp={handleDialPointerUp}
            onPointerCancel={handleDialPointerUp}
            aria-label="Candado japonés de espiral con cuatro anillos concéntricos"
            className="h-full w-full touch-none select-none cursor-grab active:cursor-grabbing drop-shadow-[0_14px_28px_rgba(0,0,0,0.9)]"
          >
            <defs>
              <linearGradient id="karakuriIronGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#624d3f" />
                <stop offset="48%" stopColor="#3b2d25" />
                <stop offset="100%" stopColor="#1b1411" />
              </linearGradient>
              <linearGradient id="karakuriWoodGrad" x1="15%" y1="0%" x2="85%" y2="100%">
                <stop offset="0%" stopColor="#6b442b" />
                <stop offset="52%" stopColor="#422818" />
                <stop offset="100%" stopColor="#1f120b" />
              </linearGradient>
              <linearGradient id="karakuriBrassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#947444" />
                <stop offset="50%" stopColor="#5e4726" />
                <stop offset="100%" stopColor="#2c2111" />
              </linearGradient>
              <linearGradient id="karakuriSteelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#57606b" />
                <stop offset="50%" stopColor="#323841" />
                <stop offset="100%" stopColor="#171a1f" />
              </linearGradient>
              <radialGradient id="karakuriHousingGrad" cx="45%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#211814" />
                <stop offset="78%" stopColor="#110d0c" />
                <stop offset="100%" stopColor="#080708" />
              </radialGradient>
            </defs>

            {/* Placa base oxidada del candado */}
            <circle
              cx="0"
              cy="0"
              r="142"
              fill="url(#karakuriHousingGrad)"
              stroke="#4a382c"
              strokeWidth="2.5"
            />
            <circle
              cx="0"
              cy="0"
              r="135"
              fill="none"
              stroke="rgba(186, 230, 253, 0.14)"
              strokeWidth="1"
              strokeDasharray="4 6"
            />

            {/* Canal guía maestro en las 12 en punto */}
            <rect
              x="-9"
              y="-144"
              width="18"
              height="16"
              rx="2"
              fill="#05070b"
              stroke={isUnlocked ? '#bae6fd' : '#b8944f'}
              strokeWidth="1.4"
            />
            <polygon
              points="0,-134 -5,-143 5,-143"
              fill={isUnlocked || alignedCount === 4 ? '#bae6fd' : '#e2c286'}
            />

            {/* 4 anillos concéntricos ranurados */}
            {RINGS.map((ring, idx) => {
              const angle = angles[idx];
              const aligned = isRingAligned(angle);
              const isSelected = selectedRing === idx;
              const isDragging = draggingRing === idx;
              const rMid = (ring.rOuter + ring.rInner) * 0.5;
              const bandWidth = ring.rOuter - ring.rInner;

              return (
                <g
                  key={ring.label}
                  transform={`rotate(${angle})`}
                  className={isDragging ? '' : 'transition-transform duration-100 ease-out'}
                >
                  {/* Cuerpo anular */}
                  <circle
                    cx="0"
                    cy="0"
                    r={rMid}
                    fill="none"
                    stroke={`url(#${ring.gradId})`}
                    strokeWidth={bandWidth}
                  />

                  {/* Borde exterior e interior de anillo */}
                  <circle
                    cx="0"
                    cy="0"
                    r={ring.rOuter}
                    fill="none"
                    stroke={
                      isSelected
                        ? 'rgba(186, 230, 253, 0.72)'
                        : aligned
                        ? 'rgba(226, 194, 134, 0.65)'
                        : ring.stroke
                    }
                    strokeWidth={isSelected ? '1.8' : '1.1'}
                  />
                  <circle
                    cx="0"
                    cy="0"
                    r={ring.rInner}
                    fill="none"
                    stroke="rgba(0, 0, 0, 0.88)"
                    strokeWidth="1.6"
                  />

                  {/* Grabados en espiral (12 dientes alrededor del aro) */}
                  {Array.from({ length: 12 }).map((_, t) => {
                    const theta = (t / 12) * Math.PI * 2;
                    const x1 = Math.cos(theta) * (ring.rInner + 2.5);
                    const y1 = Math.sin(theta) * (ring.rInner + 2.5);
                    const x2 = Math.cos(theta + 0.08) * (ring.rOuter - 2.5);
                    const y2 = Math.sin(theta + 0.08) * (ring.rOuter - 2.5);
                    return (
                      <line
                        key={t}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="rgba(10, 8, 7, 0.55)"
                        strokeWidth="1.4"
                      />
                    );
                  })}

                  {/* Muesca ranurada de alineación en las 12 en punto del anillo */}
                  <rect
                    x="-6.5"
                    y={-ring.rOuter - 0.5}
                    width="13"
                    height={bandWidth + 1.5}
                    rx="1.5"
                    fill={aligned ? '#0c1c2c' : '#060709'}
                    stroke={aligned ? '#bae6fd' : '#c7a46b'}
                    strokeWidth={aligned ? '1.8' : '1.1'}
                  />

                  {/* Indicador de acople cuando cae en su muesca */}
                  {aligned && (
                    <line
                      x1="0"
                      y1={-ring.rOuter + 2}
                      x2="0"
                      y2={-ring.rInner - 2}
                      stroke="#bae6fd"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  )}
                </g>
              );
            })}

            {/* Núcleo central tallado con espiral */}
            <circle
              cx="0"
              cy="0"
              r="22"
              fill="#1b1817"
              stroke={isUnlocked ? '#bae6fd' : '#785a46'}
              strokeWidth="1.6"
            />
            <path
              d="M 0,0 C 3,-3 7,-1 7,3 C 7,8 -1,11 -6,8 C -12,4 -11,-6 -4,-11 C 5,-16 15,-10 15,1"
              fill="none"
              stroke={isUnlocked ? '#bae6fd' : '#c7a46b'}
              strokeWidth="1.6"
              strokeLinecap="round"
              opacity={isUnlocked ? 0.95 : 0.65}
            />

            {/* Pestillo central que se desliza hacia arriba al resolver */}
            <g
              style={{
                transform: isUnlocked ? 'translate3d(0, -24px, 0)' : 'translate3d(0, 0, 0)',
              }}
              className="transition-transform duration-300 ease-out"
            >
              <rect
                x="-5"
                y="-138"
                width="10"
                height={isUnlocked ? '24' : '118'}
                rx="2"
                fill={isUnlocked ? '#bae6fd' : 'rgba(184, 148, 79, 0.24)'}
                stroke={isUnlocked ? '#ffffff' : 'rgba(226, 194, 134, 0.55)'}
                strokeWidth="1.2"
                opacity={isUnlocked ? 0.92 : 0.38}
              />
            </g>
          </svg>
        </div>

        {/* Estado por anillo (color + ícono explícito, sin depender solo del tono) */}
        <div className="grid grid-cols-4 gap-1.5 w-full">
          {RINGS.map((ring, idx) => {
            const aligned = isRingAligned(angles[idx]);
            const active = selectedRing === idx;
            return (
              <button
                key={ring.label}
                type="button"
                disabled={isUnlocked}
                onClick={() => setSelectedRing(idx)}
                className={`min-h-[42px] rounded-lg border px-1.5 py-1.5 text-[11px] font-medium flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                  active
                    ? 'border-[#bae6fd]/80 bg-[#0d1829] text-white shadow-[0_0_12px_rgba(125,211,252,0.18)]'
                    : aligned
                    ? 'border-[#7dd3fc]/45 bg-[#0d1829]/60 text-[#bae6fd]'
                    : 'border-white/15 bg-[#070a12]/80 text-slate-300 hover:border-[#7dd3fc]/45 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-1 whitespace-nowrap">
                  {aligned ? (
                    <LockOpen className="h-3 w-3 text-[#bae6fd]" />
                  ) : (
                    <Lock className="h-3 w-3 text-slate-400" />
                  )}
                  <span>{ring.label}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Controles direccionales táctiles y de escritorio */}
        <div className="flex items-center justify-between gap-2 w-full">
          <button
            type="button"
            disabled={isUnlocked}
            data-no-confirm-sfx="true"
            onClick={() => applyRingRotation(selectedRing, -BUTTON_STEP_DEG, true)}
            className="flex-1 min-h-[44px] rounded-xl border border-[#7dd3fc]/35 bg-[#0d1829]/85 px-3 py-2 text-xs font-medium text-white hover:border-[#bae6fd]/80 hover:bg-[#13233d] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4 text-[#7dd3fc]" />
            <span>Girar Izq.</span>
          </button>

          <button
            type="button"
            disabled={isUnlocked}
            data-no-confirm-sfx="true"
            onClick={handleReset}
            title="Reiniciar anillos"
            aria-label="Reiniciar anillos del candado"
            className="min-h-[44px] min-w-[44px] rounded-xl border border-white/15 bg-[#070a12]/85 px-3 text-slate-300 hover:border-[#7dd3fc]/55 hover:text-white active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <button
            type="button"
            disabled={isUnlocked}
            data-no-confirm-sfx="true"
            onClick={() => applyRingRotation(selectedRing, BUTTON_STEP_DEG, true)}
            className="flex-1 min-h-[44px] rounded-xl border border-[#7dd3fc]/35 bg-[#0d1829]/85 px-3 py-2 text-xs font-medium text-white hover:border-[#bae6fd]/80 hover:bg-[#13233d] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span>Girar Der.</span>
            <ChevronRight className="h-4 w-4 text-[#7dd3fc]" />
          </button>
        </div>
      </div>

      {/* Estado de alineación sin telemetría falsa */}
      <div className="flex items-center justify-between text-xs text-slate-300 px-0.5">
        <span>
          {isUnlocked
            ? 'Pestillo liberado · Caja desbloqueada'
            : `Anillos alineados: ${alignedCount} de 4`}
        </span>
        <span className="font-mono-tech text-[#bae6fd]">
          {isUnlocked ? 'ABIERTO' : `ARO ${selectedRing + 1}`}
        </span>
      </div>
    </div>
  );
};
