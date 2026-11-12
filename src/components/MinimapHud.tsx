import React, { useEffect, useRef, useState } from 'react';
import { WORLD_MARKERS } from '../data/gameContent';
import { MARKER_3D_COLORS } from '../three/markerPalette';
import { SchoolEngine } from '../three/SchoolEngine';
import { FinalSubstate, FloorNumber, GamePhase, WorldMarker } from '../types';

interface MinimapHudProps {
  engineRef: React.RefObject<SchoolEngine | null>;
  floor: FloorNumber;
  phase: GamePhase;
  unlockedObjects: Record<string, boolean>;
  finalSubstate: FinalSubstate;
  onOpenFullMap?: () => void;
}

export type MinimapMarkerVisibility = 'hidden' | 'dimmed' | 'active' | 'target';

export interface MinimapViewport {
  width: number;
  height: number;
  padding: number;
}

// Límites espaciales del edificio en el mundo 3D de Three.js (metros)
const WORLD_BOUNDS = {
  minX: -31.8, // Extremo Oeste (Armario de Limpieza / Sala de Profesores)
  maxX: 31.8,  // Extremo Este (Aparcabicicletas / Baños)
  minZ: -26.4, // Extremo Norte (-Z en Three.js -> arriba en el minimapa)
  maxZ: 9.8,   // Extremo Sur (+Z en Three.js -> Entrada Genkan y salones abajo)
} as const;

const WORLD_SPAN_X = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX; // 63.6 m
const WORLD_SPAN_Z = WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ; // 36.2 m

// Resolución lógica interna en píxeles CSS (se multiplica por devicePixelRatio en el Canvas)
const LOGICAL_WIDTH = 224;
const LOGICAL_HEIGHT = 132;
const LOGICAL_PADDING = 8;

interface RoomRect {
  id: string;
  label: string;
  floor: FloorNumber;
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
  doorX: number;
  doorZ: number;
  doorWidth: number;
  isOpenRoom: boolean;
}

// Distribución arquitectónica fiel a los planos originales de Piso 1 y Piso 2
const CORRIDOR_RECTS: Array<{
  floor: FloorNumber | 'both';
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}> = [
  // Pasillo principal Este-Oeste (1F y 2F)
  { floor: 'both', minX: -28.2, minZ: -2.3, maxX: 28.2, maxZ: 2.3 },
  // Pasillo ala izquierda / Oeste (1F y 2F)
  { floor: 'both', minX: -28.2, minZ: -18.2, maxX: -23.8, maxZ: 2.3 },
  // Pasillo ala derecha / Este (1F y 2F)
  { floor: 'both', minX: 23.8, minZ: -15.2, maxX: 28.2, maxZ: 2.3 },
  // Huecos de escaleras Oeste y Este (1F y 2F)
  { floor: 'both', minX: -24.85, minZ: 0.4, maxX: -21.75, maxZ: 4.0 },
  { floor: 'both', minX: 23.15, minZ: 0.4, maxX: 26.25, maxZ: 4.0 },
  // Vestíbulo central + Entrada Genkan (exclusivo del Piso 1)
  { floor: 1, minX: -5.55, minZ: -4.15, maxX: 5.55, maxZ: 7.55 },
];

// Islas de casilleros de zapatos (Getabako) en la entrada Genkan del Piso 1
const GENKAN_LOCKER_ISLANDS = [
  { minX: -3.5, minZ: 3.3, maxX: -2.4, maxZ: 6.7 },
  { minX: -0.55, minZ: 3.3, maxX: 0.55, maxZ: 6.7 },
  { minX: 2.4, minZ: 3.3, maxX: 3.5, maxZ: 6.7 },
];

const SCHOOL_ROOMS: RoomRect[] = [
  // --- PISO 1 (1F) ---
  {
    id: '1f_limpieza',
    label: 'Limp.',
    floor: 1,
    minX: -29.4,
    minZ: -24.6,
    maxX: -22.6,
    maxZ: -18.1,
    doorX: -26.0,
    doorZ: -18.1,
    doorWidth: 2.4,
    isOpenRoom: true,
  },
  {
    id: '1f_bicis',
    label: 'Bicis',
    floor: 1,
    minX: 22.1,
    minZ: -24.6,
    maxX: 29.9,
    maxZ: -15.1,
    doorX: 26.0,
    doorZ: -15.1,
    doorWidth: 2.4,
    isOpenRoom: true,
  },
  {
    id: '1A',
    label: '1A',
    floor: 1,
    minX: -21.4,
    minZ: 2.45,
    maxX: -14.9,
    maxZ: 7.7,
    doorX: -18.2,
    doorZ: 2.45,
    doorWidth: 1.9,
    isOpenRoom: false,
  },
  {
    id: '1B',
    label: '1B',
    floor: 1,
    minX: -14.3,
    minZ: 2.45,
    maxX: -7.1,
    maxZ: 7.7,
    doorX: -10.8,
    doorZ: 2.45,
    doorWidth: 1.9,
    isOpenRoom: false,
  },
  {
    id: '1C',
    label: '1C',
    floor: 1,
    minX: 7.1,
    minZ: 2.45,
    maxX: 14.3,
    maxZ: 7.7,
    doorX: 10.8,
    doorZ: 2.45,
    doorWidth: 1.9,
    isOpenRoom: false,
  },
  {
    id: '1D',
    label: '1D',
    floor: 1,
    minX: 14.9,
    minZ: 2.45,
    maxX: 21.8,
    maxZ: 7.7,
    doorX: 18.2,
    doorZ: 2.45,
    doorWidth: 1.9,
    isOpenRoom: false,
  },

  // --- PISO 2 (2F) ---
  {
    id: '2f_profesores',
    label: 'Prof.',
    floor: 2,
    minX: -29.4,
    minZ: -24.6,
    maxX: -22.6,
    maxZ: -18.1,
    doorX: -26.0,
    doorZ: -18.1,
    doorWidth: 2.4,
    isOpenRoom: true,
  },
  {
    id: '2f_banos',
    label: 'Baños',
    floor: 2,
    minX: 22.1,
    minZ: -24.0,
    maxX: 29.9,
    maxZ: -15.1,
    doorX: 26.0,
    doorZ: -15.1,
    doorWidth: 2.4,
    isOpenRoom: true,
  },
  {
    id: '2A',
    label: '2A',
    floor: 2,
    minX: -21.4,
    minZ: 2.45,
    maxX: -14.9,
    maxZ: 7.7,
    doorX: -18.2,
    doorZ: 2.45,
    doorWidth: 1.9,
    isOpenRoom: false,
  },
  {
    id: '2B',
    label: '2B',
    floor: 2,
    minX: -14.3,
    minZ: 2.45,
    maxX: -7.1,
    maxZ: 7.7,
    doorX: -10.8,
    doorZ: 2.45,
    doorWidth: 1.9,
    isOpenRoom: false,
  },
  {
    id: '2C',
    label: '2C',
    floor: 2,
    minX: 7.1,
    minZ: 2.45,
    maxX: 14.3,
    maxZ: 7.7,
    doorX: 10.8,
    doorZ: 2.45,
    doorWidth: 1.9,
    isOpenRoom: false,
  },
  {
    id: '2D',
    label: '2D',
    floor: 2,
    minX: 14.9,
    minZ: 2.45,
    maxX: 21.8,
    maxZ: 7.7,
    doorX: 18.2,
    doorZ: 2.45,
    doorWidth: 1.9,
    isOpenRoom: false,
  },
];

const DESTINATION_DOOR_MARKER: WorldMarker = {
  id: 'puerta_aula_destino',
  kind: 'puerta',
  glbFile: '',
  label: 'Puerta Salón 2C',
  sublabel: 'Salón de destino',
  floor: 2,
  position: [10.8, 0, 2.26],
  requiredPhase: 'ESTADO_FINAL',
};

const ALL_MINIMAP_MARKERS: readonly WorldMarker[] = [
  ...WORLD_MARKERS,
  DESTINATION_DOOR_MARKER,
];

const DEFAULT_VIEWPORT: MinimapViewport = {
  width: LOGICAL_WIDTH,
  height: LOGICAL_HEIGHT,
  padding: LOGICAL_PADDING,
};

/**
 * Convierte coordenadas 3D (X, Z) de Three.js a coordenadas 2D (x, y) dentro del Canvas del minimapa,
 * manteniendo una escala uniforme para preservar proporciones y ángulos de rotación.
 */
export function worldToMinimap(
  worldX: number,
  worldZ: number,
  viewport: MinimapViewport
): { x: number; y: number; scale: number } {
  const usableW = viewport.width - viewport.padding * 2;
  const usableH = viewport.height - viewport.padding * 2;
  const scale = Math.min(usableW / WORLD_SPAN_X, usableH / WORLD_SPAN_Z);

  const offsetX = viewport.padding + (usableW - WORLD_SPAN_X * scale) * 0.5;
  const offsetY = viewport.padding + (usableH - WORLD_SPAN_Z * scale) * 0.5;

  return {
    x: offsetX + (worldX - WORLD_BOUNDS.minX) * scale,
    y: offsetY + (worldZ - WORLD_BOUNDS.minZ) * scale,
    scale,
  };
}

function worldRectToCanvas(
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
  viewport: MinimapViewport
) {
  const topLeft = worldToMinimap(minX, minZ, viewport);
  const bottomRight = worldToMinimap(maxX, maxZ, viewport);
  return {
    x: topLeft.x,
    y: topLeft.y,
    w: bottomRight.x - topLeft.x,
    h: bottomRight.y - topLeft.y,
  };
}

/**
 * Determina la visibilidad en el minimapa de cada marcador según la máquina de estados actual.
 * - 'hidden': aún no descubierto/habilitado (o ya consumido en el mundo 3D)
 * - 'dimmed': personaje no prioritario en el paso actual o ya visitado (atenuado)
 * - 'active': marcador disponible en el piso actual
 * - 'target': marcador clave habilitado en el estado actual
 */
export function resolveMinimapMarkerVisibility(
  marker: WorldMarker,
  phase: GamePhase,
  unlockedObjects: Record<string, boolean>,
  finalSubstate: FinalSubstate,
  activeFloor: FloorNumber
): MinimapMarkerVisibility {
  if (marker.floor !== activeFloor) return 'hidden';

  // 1. Escaleras: siempre visibles; resaltadas cuando el rumor activo está en el otro piso
  if (marker.kind === 'escalera') {
    const shouldGoUpstairs =
      activeFloor === 1 &&
      (phase === 'ESTADO_4' || phase === 'ESTADO_5' || phase === 'ESTADO_FINAL');
    const shouldGoDownstairs =
      activeFloor === 2 &&
      (phase === 'ESTADO_0' || phase === 'ESTADO_1' || phase === 'ESTADO_2' || phase === 'ESTADO_3');
    return shouldGoUpstairs || shouldGoDownstairs ? 'target' : 'active';
  }

  // 2. Puerta final del Salón 2C: solo visible cuando se destrabó el seguro exterior
  if (marker.id === 'puerta_aula_destino') {
    if (
      phase === 'ESTADO_FINAL' &&
      (finalSubstate === 'puerta_desbloqueada' || finalSubstate === 'completada')
    ) {
      return 'target';
    }
    return 'hidden';
  }

  // 3. Marcador de objeto frente al Salón 2C (Paso A del final)
  if (marker.id === 'objeto_puerta_destino') {
    return phase === 'ESTADO_FINAL' && finalSubstate === 'pendiente' ? 'target' : 'hidden';
  }

  // 4. Objetos interactivos de sensores: ocultos hasta que el diálogo los habilita en su fase
  if (marker.kind === 'objeto') {
    if (marker.id === 'objeto_vestibulo') {
      return phase === 'ESTADO_0' ? 'active' : 'dimmed';
    }
    if (marker.requiredPhase) {
      const isEnabledNow =
        marker.requiredPhase === phase && Boolean(unlockedObjects[marker.id]);
      return isEnabledNow ? 'target' : 'hidden';
    }
    return 'active';
  }

  // 5. Personajes: resaltados en su estado correspondiente, atenuados fuera de su turno narrativo
  switch (marker.id) {
    case 'personaje_tsuki':
      return phase === 'ESTADO_0' ? 'active' : 'dimmed';
    case 'personaje_conserje':
      if (phase === 'ESTADO_0') return 'target';
      if (phase === 'ESTADO_1') return 'active';
      return 'dimmed';
    case 'personaje_hotaru':
      if (phase === 'ESTADO_2') {
        return unlockedObjects.objeto_hotaru ? 'active' : 'target';
      }
      return 'dimmed';
    case 'personaje_kaeru':
      if (phase === 'ESTADO_3') {
        return unlockedObjects.objeto_kaeru ? 'active' : 'target';
      }
      return 'dimmed';
    case 'personaje_hanako':
      if (phase === 'ESTADO_4') {
        return unlockedObjects.objeto_hanako ? 'active' : 'target';
      }
      return 'dimmed';
    case 'personaje_profesor':
      if (phase === 'ESTADO_5') {
        return unlockedObjects.objeto_profesor ? 'active' : 'target';
      }
      return 'dimmed';
    default:
      return 'dimmed';
  }
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
        const targetW = Math.round(LOGICAL_WIDTH * dpr);
        const targetH = Math.round(LOGICAL_HEIGHT * dpr);

        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);

          const viewport = DEFAULT_VIEWPORT;

          // 1. Lienzo transparente con bruma nocturna profunda (#070a12) para contraste garantizado sobre paredes claras
          ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
          const bgMist = ctx.createRadialGradient(
            LOGICAL_WIDTH * 0.5,
            LOGICAL_HEIGHT * 0.5,
            16,
            LOGICAL_WIDTH * 0.5,
            LOGICAL_HEIGHT * 0.5,
            LOGICAL_WIDTH * 0.6
          );
          bgMist.addColorStop(0, 'rgba(7, 10, 18, 0.82)');
          bgMist.addColorStop(0.68, 'rgba(13, 24, 41, 0.64)');
          bgMist.addColorStop(1, 'rgba(7, 10, 18, 0.12)');
          ctx.fillStyle = bgMist;
          ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

          ctx.strokeStyle = 'rgba(186, 230, 253, 0.06)';
          ctx.lineWidth = 0.8;
          for (let gx = 16; gx < LOGICAL_WIDTH; gx += 16) {
            ctx.beginPath();
            ctx.moveTo(gx, 0);
            ctx.lineTo(gx, LOGICAL_HEIGHT);
            ctx.stroke();
          }
          for (let gy = 16; gy < LOGICAL_HEIGHT; gy += 16) {
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(LOGICAL_WIDTH, gy);
            ctx.stroke();
          }

          // 2. Salones y recintos del piso activo (1F o 2F) en paleta #070a12 / #0d1829 / #bae6fd
          const is2CDoorUnlocked =
            curState.phase === 'ESTADO_FINAL' &&
            (curState.finalSubstate === 'puerta_desbloqueada' ||
              curState.finalSubstate === 'completada');

          for (let i = 0; i < SCHOOL_ROOMS.length; i++) {
            const room = SCHOOL_ROOMS[i];
            if (room.floor !== liveFloor) continue;

            const r = worldRectToCanvas(room.minX, room.minZ, room.maxX, room.maxZ, viewport);
            const isRoomUnlocked = room.isOpenRoom || (room.id === '2C' && is2CDoorUnlocked);

            ctx.fillStyle = isRoomUnlocked
              ? 'rgba(125, 211, 252, 0.16)'
              : 'rgba(13, 24, 41, 0.52)';
            ctx.fillRect(r.x, r.y, r.w, r.h);

            ctx.strokeStyle = isRoomUnlocked
              ? 'rgba(186, 230, 253, 0.72)'
              : 'rgba(125, 211, 252, 0.38)';
            ctx.lineWidth = 0.95;
            ctx.strokeRect(r.x, r.y, r.w, r.h);

            ctx.fillStyle = isRoomUnlocked
              ? 'rgba(255, 255, 255, 0.96)'
              : 'rgba(186, 230, 253, 0.74)';
            ctx.font = '500 7.5px Inter, -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(room.label, r.x + r.w * 0.5, r.y + r.h * 0.52);
          }

          // 3. Pasillos transitables en U
          ctx.fillStyle = 'rgba(186, 230, 253, 0.44)';
          for (let i = 0; i < CORRIDOR_RECTS.length; i++) {
            const c = CORRIDOR_RECTS[i];
            if (c.floor !== 'both' && c.floor !== liveFloor) continue;
            const r = worldRectToCanvas(c.minX, c.minZ, c.maxX, c.maxZ, viewport);
            ctx.fillRect(r.x - 0.85, r.y - 0.85, r.w + 1.7, r.h + 1.7);
          }

          ctx.fillStyle = 'rgba(7, 10, 18, 0.88)';
          for (let i = 0; i < CORRIDOR_RECTS.length; i++) {
            const c = CORRIDOR_RECTS[i];
            if (c.floor !== 'both' && c.floor !== liveFloor) continue;
            const r = worldRectToCanvas(c.minX, c.minZ, c.maxX, c.maxZ, viewport);
            ctx.fillRect(r.x, r.y, r.w, r.h);
          }

          // 4. Islas de casilleros (Getabako) y umbral de entrada en el Piso 1
          if (liveFloor === 1) {
            ctx.fillStyle = 'rgba(13, 24, 41, 0.85)';
            ctx.strokeStyle = 'rgba(186, 230, 253, 0.52)';
            ctx.lineWidth = 0.8;
            for (let i = 0; i < GENKAN_LOCKER_ISLANDS.length; i++) {
              const isl = GENKAN_LOCKER_ISLANDS[i];
              const r = worldRectToCanvas(isl.minX, isl.minZ, isl.maxX, isl.maxZ, viewport);
              ctx.fillRect(r.x, r.y, r.w, r.h);
              ctx.strokeRect(r.x, r.y, r.w, r.h);
            }

            const entLeft = worldToMinimap(-3.0, 7.55, viewport);
            const entRight = worldToMinimap(3.0, 7.55, viewport);
            ctx.strokeStyle = '#bae6fd';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(entLeft.x, entLeft.y);
            ctx.lineTo(entRight.x, entRight.y);
            ctx.stroke();
          }

          // 5. Indicadores de puertas abiertas y cerradas
          for (let i = 0; i < SCHOOL_ROOMS.length; i++) {
            const room = SCHOOL_ROOMS[i];
            if (room.floor !== liveFloor) continue;
            const dLeft = worldToMinimap(room.doorX - room.doorWidth * 0.5, room.doorZ, viewport);
            const dRight = worldToMinimap(room.doorX + room.doorWidth * 0.5, room.doorZ, viewport);
            const isDoorOpen = room.isOpenRoom || (room.id === '2C' && is2CDoorUnlocked);

            ctx.strokeStyle = isDoorOpen ? '#bae6fd' : 'rgba(148, 163, 184, 0.52)';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(dLeft.x, dLeft.y);
            ctx.lineTo(dRight.x, dRight.y);
            ctx.stroke();
          }

          // 6. Marcadores dinámicos sincronizados EXACTAMENTE con los colores de los modelos 3D / GLB
          for (let i = 0; i < ALL_MINIMAP_MARKERS.length; i++) {
            const marker = ALL_MINIMAP_MARKERS[i];
            const vis = resolveMinimapMarkerVisibility(
              marker,
              curState.phase,
              curState.unlockedObjects,
              curState.finalSubstate,
              liveFloor
            );
            if (vis === 'hidden') continue;

            const pt = worldToMinimap(marker.position[0], marker.position[2], viewport);
            ctx.save();
            ctx.translate(pt.x, pt.y);

            if (vis === 'dimmed') {
              ctx.globalAlpha = 0.4;
            }

            if (marker.kind === 'escalera') {
              // Amarillo oro exacto del marcador 3D de escalera (#facc15)
              if (vis === 'target') {
                ctx.strokeStyle = MARKER_3D_COLORS.escalera.halo;
                ctx.lineWidth = 1.25;
                ctx.strokeRect(-5.5, -5.5, 11, 11);
              }
              ctx.fillStyle = MARKER_3D_COLORS.escalera.fill;
              ctx.strokeStyle = '#070a12';
              ctx.lineWidth = 1;
              ctx.fillRect(-3.6, -3.6, 7.2, 7.2);
              ctx.strokeRect(-3.6, -3.6, 7.2, 7.2);

              ctx.strokeStyle = '#070a12';
              ctx.lineWidth = 0.9;
              ctx.beginPath();
              ctx.moveTo(-2.1, 1.7);
              ctx.lineTo(0, 1.7);
              ctx.lineTo(0, 0);
              ctx.lineTo(2.1, 0);
              ctx.lineTo(2.1, -1.7);
              ctx.stroke();
            } else if (marker.kind === 'personaje') {
              // Cian eléctrico exacto de dpwii_parcial2_marcadores_persona.glb (#4ad0ff)
              if (vis === 'target') {
                ctx.beginPath();
                ctx.arc(0, 0, 5.9, 0, Math.PI * 2);
                ctx.strokeStyle = MARKER_3D_COLORS.personaje.halo;
                ctx.lineWidth = 1.25;
                ctx.stroke();
              }
              ctx.beginPath();
              ctx.arc(0, 0, vis === 'dimmed' ? 2.6 : 3.4, 0, Math.PI * 2);
              ctx.fillStyle = MARKER_3D_COLORS.personaje.fill;
              ctx.fill();
              ctx.lineWidth = 1;
              ctx.strokeStyle = '#070a12';
              ctx.stroke();
            } else if (marker.kind === 'puerta') {
              // Verde esmeralda exacto del anillo de puerta desbloqueada en 3D (#10b981)
              ctx.beginPath();
              ctx.arc(0, 0, 6.4, 0, Math.PI * 2);
              ctx.strokeStyle = MARKER_3D_COLORS.puerta.halo;
              ctx.lineWidth = 1.25;
              ctx.stroke();

              ctx.fillStyle = MARKER_3D_COLORS.puerta.fill;
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1;
              ctx.fillRect(-3.1, -3.1, 6.2, 6.2);
              ctx.strokeRect(-3.1, -3.1, 6.2, 6.2);
            } else {
              // Carmesí-coral neón exacto de dpwii_parcial2_marcadores_objeto.glb (#ff6588)
              if (vis === 'target') {
                ctx.beginPath();
                ctx.arc(0, 0, 6.0, 0, Math.PI * 2);
                ctx.strokeStyle = MARKER_3D_COLORS.objeto.halo;
                ctx.lineWidth = 1.25;
                ctx.stroke();
              }
              ctx.rotate(Math.PI / 4);
              const s = vis === 'dimmed' ? 2.2 : 2.95;
              ctx.fillStyle = MARKER_3D_COLORS.objeto.fill;
              ctx.strokeStyle = '#070a12';
              ctx.lineWidth = 1;
              ctx.fillRect(-s, -s, s * 2, s * 2);
              ctx.strokeRect(-s, -s, s * 2, s * 2);
            }

            ctx.restore();
          }

          // 7. Cursor del jugador en tiempo real (blanco puro con contorno oscuro + cono cian pálido)
          const px = engine ? engine.playerPos.x : -1.5;
          const pz = engine ? engine.playerPos.z : 6.0;
          const pyaw = engine ? engine.playerYaw : 0;
          const playerPt = worldToMinimap(px, pz, viewport);

          ctx.save();
          ctx.translate(playerPt.x, playerPt.y);
          ctx.rotate(-pyaw);

          const fovHalfRad = (34 * Math.PI) / 180;
          const coneRadius = 18;
          const coneGrad = ctx.createRadialGradient(0, 0, 1.5, 0, 0, coneRadius);
          coneGrad.addColorStop(0, 'rgba(186, 230, 253, 0.45)');
          coneGrad.addColorStop(1, 'rgba(125, 211, 252, 0)');

          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, coneRadius, -Math.PI / 2 - fovHalfRad, -Math.PI / 2 + fovHalfRad);
          ctx.closePath();
          ctx.fillStyle = coneGrad;
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(0, -5.6);
          ctx.lineTo(4.0, 4.3);
          ctx.lineTo(0, 2.1);
          ctx.lineTo(-4.0, 4.3);
          ctx.closePath();
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.lineWidth = 1.15;
          ctx.strokeStyle = '#070a12';
          ctx.stroke();

          ctx.restore();
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
