import { WORLD_MARKERS } from '../data/gameContent';
import { MARKER_3D_COLORS } from '../three/markerPalette';
import { FinalSubstate, FloorNumber, GamePhase, WorldMarker } from '../types';

export type MapMarkerVisibility = 'hidden' | 'dimmed' | 'active' | 'target';
export type MapRenderVariant = 'minimap' | 'full';

export interface MapViewport {
  width: number;
  height: number;
  padding: number;
}

export interface MapPlayerState {
  x: number;
  z: number;
  yaw: number;
  floor: FloorNumber;
}

export interface SchoolRoomRect {
  id: string;
  minimapLabel: string;
  fullLabel: string;
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

export interface SchoolCorridorRect {
  floor: FloorNumber | 'both';
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

/**
 * Límites espaciales únicos y compartidos del edificio en el mundo 3D de Three.js (metros).
 * Tanto el minimapa como el mapa completo usan exactamente estos bounds.
 */
export const SCHOOL_MAP_WORLD_BOUNDS = {
  minX: -31.8, // Extremo Oeste (Armario de Limpieza / Sala de Profesores)
  maxX: 31.8, // Extremo Este (Aparcabicicletas / Baños)
  minZ: -26.4, // Extremo Norte (-Z en Three.js -> arriba en el plano)
  maxZ: 9.8, // Extremo Sur (+Z en Three.js -> Entrada Genkan y salones abajo)
} as const;

const WORLD_SPAN_X = SCHOOL_MAP_WORLD_BOUNDS.maxX - SCHOOL_MAP_WORLD_BOUNDS.minX; // 63.6 m
const WORLD_SPAN_Z = SCHOOL_MAP_WORLD_BOUNDS.maxZ - SCHOOL_MAP_WORLD_BOUNDS.minZ; // 36.2 m

export const MINIMAP_VIEWPORT: MapViewport = {
  width: 224,
  height: 132,
  padding: 8,
};

export const FULL_MAP_VIEWPORT: MapViewport = {
  width: 760,
  height: 448,
  padding: 24,
};

/**
 * Geometría compartida de pasillos transitables en U para 1F y 2F.
 */
export const SCHOOL_CORRIDOR_RECTS: readonly SchoolCorridorRect[] = [
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

/**
 * Islas de casilleros de zapatos (Getabako) en la entrada Genkan del Piso 1.
 */
export const GENKAN_LOCKER_ISLANDS = [
  { minX: -3.5, minZ: 3.3, maxX: -2.4, maxZ: 6.7 },
  { minX: -0.55, minZ: 3.3, maxX: 0.55, maxZ: 6.7 },
  { minX: 2.4, minZ: 3.3, maxX: 3.5, maxZ: 6.7 },
] as const;

/**
 * Distribución arquitectónica unificada de salones y recintos por piso.
 */
export const SCHOOL_ROOMS: readonly SchoolRoomRect[] = [
  // --- PISO 1 (1F) ---
  {
    id: '1f_limpieza',
    minimapLabel: 'Limp.',
    fullLabel: 'Limpieza',
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
    minimapLabel: 'Bicis',
    fullLabel: 'Bicicletas',
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
    minimapLabel: '1A',
    fullLabel: 'Salón 1A',
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
    minimapLabel: '1B',
    fullLabel: 'Salón 1B',
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
    minimapLabel: '1C',
    fullLabel: 'Salón 1C',
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
    minimapLabel: '1D',
    fullLabel: 'Salón 1D',
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
    minimapLabel: 'Prof.',
    fullLabel: 'Sala Prof.',
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
    minimapLabel: 'Baños',
    fullLabel: 'Baños 2F',
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
    minimapLabel: '2A',
    fullLabel: 'Salón 2A',
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
    minimapLabel: '2B',
    fullLabel: 'Salón 2B',
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
    minimapLabel: '2C',
    fullLabel: 'Salón 2C',
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
    minimapLabel: '2D',
    fullLabel: 'Salón 2D',
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

export const ALL_SCHOOL_MAP_MARKERS: readonly WorldMarker[] = [
  ...WORLD_MARKERS,
  DESTINATION_DOOR_MARKER,
];

/**
 * Fórmula única de proyección 3D -> 2D (`worldToMap`) compartida entre el minimapa y el mapa completo.
 * Mantiene escala uniforme para preservar proporciones arquitectónicas y orientación real del jugador.
 */
export function worldToMap(
  worldX: number,
  worldZ: number,
  viewport: MapViewport
): { x: number; y: number; scale: number } {
  const usableW = viewport.width - viewport.padding * 2;
  const usableH = viewport.height - viewport.padding * 2;
  const scale = Math.min(usableW / WORLD_SPAN_X, usableH / WORLD_SPAN_Z);

  const offsetX = viewport.padding + (usableW - WORLD_SPAN_X * scale) * 0.5;
  const offsetY = viewport.padding + (usableH - WORLD_SPAN_Z * scale) * 0.5;

  return {
    x: offsetX + (worldX - SCHOOL_MAP_WORLD_BOUNDS.minX) * scale,
    y: offsetY + (worldZ - SCHOOL_MAP_WORLD_BOUNDS.minZ) * scale,
    scale,
  };
}

function worldRectToMap(
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
  viewport: MapViewport
) {
  const topLeft = worldToMap(minX, minZ, viewport);
  const bottomRight = worldToMap(maxX, maxZ, viewport);
  return {
    x: topLeft.x,
    y: topLeft.y,
    w: bottomRight.x - topLeft.x,
    h: bottomRight.y - topLeft.y,
  };
}

/**
 * Determina la visibilidad en los planos (minimapa y mapa completo) de cada marcador según el estado narrativo.
 */
export function resolveMapMarkerVisibility(
  marker: WorldMarker,
  phase: GamePhase,
  unlockedObjects: Record<string, boolean>,
  finalSubstate: FinalSubstate,
  activeFloor: FloorNumber
): MapMarkerVisibility {
  if (marker.floor !== activeFloor) return 'hidden';

  if (marker.kind === 'escalera') {
    const shouldGoUpstairs =
      activeFloor === 1 &&
      (phase === 'ESTADO_4' || phase === 'ESTADO_5' || phase === 'ESTADO_FINAL');
    const shouldGoDownstairs =
      activeFloor === 2 &&
      (phase === 'ESTADO_0' || phase === 'ESTADO_1' || phase === 'ESTADO_2' || phase === 'ESTADO_3');
    return shouldGoUpstairs || shouldGoDownstairs ? 'target' : 'active';
  }

  if (marker.id === 'puerta_aula_destino') {
    if (
      phase === 'ESTADO_FINAL' &&
      (finalSubstate === 'puerta_desbloqueada' || finalSubstate === 'completada')
    ) {
      return 'target';
    }
    return 'hidden';
  }

  if (marker.id === 'objeto_puerta_destino') {
    return phase === 'ESTADO_FINAL' && finalSubstate === 'pendiente' ? 'target' : 'hidden';
  }

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

  if (marker.id.startsWith('personaje_npc_')) {
    return 'active';
  }

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

export interface RenderSchoolMapOptions {
  ctx: CanvasRenderingContext2D;
  viewport: MapViewport;
  floor: FloorNumber;
  phase: GamePhase;
  unlockedObjects: Record<string, boolean>;
  finalSubstate: FinalSubstate;
  player: MapPlayerState;
  variant: MapRenderVariant;
}

/**
 * Renderizador unificado Canvas 2D compartido por el Minimapa HUD y el Mapa Completo desplegable.
 * Garantiza 100% de coherencia en planos, bounds, escala, marcadores y proyección del jugador.
 */
export function renderSchoolMapCanvas({
  ctx,
  viewport,
  floor,
  phase,
  unlockedObjects,
  finalSubstate,
  player,
  variant,
}: RenderSchoolMapOptions): void {
  const isFull = variant === 'full';
  const k = isFull ? 2.15 : 1.0;

  ctx.clearRect(0, 0, viewport.width, viewport.height);

  // 1. Fondo nocturno unificado (#070a12 / #0d1829)
  if (isFull) {
    const bgFull = ctx.createRadialGradient(
      viewport.width * 0.5,
      viewport.height * 0.46,
      24,
      viewport.width * 0.5,
      viewport.height * 0.5,
      viewport.width * 0.62
    );
    bgFull.addColorStop(0, '#0d1829');
    bgFull.addColorStop(0.68, '#080e1a');
    bgFull.addColorStop(1, '#070a12');
    ctx.fillStyle = bgFull;
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    // Cuadrícula arquitectónica alineada a coordenadas reales del mundo (cada 4 m)
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.065)';
    ctx.lineWidth = 1;
    for (let gx = -28; gx <= 28; gx += 4) {
      const pTop = worldToMap(gx, SCHOOL_MAP_WORLD_BOUNDS.minZ, viewport);
      const pBot = worldToMap(gx, SCHOOL_MAP_WORLD_BOUNDS.maxZ, viewport);
      ctx.beginPath();
      ctx.moveTo(pTop.x, pTop.y);
      ctx.lineTo(pBot.x, pBot.y);
      ctx.stroke();
    }
    for (let gz = -24; gz <= 8; gz += 4) {
      const pLeft = worldToMap(SCHOOL_MAP_WORLD_BOUNDS.minX, gz, viewport);
      const pRight = worldToMap(SCHOOL_MAP_WORLD_BOUNDS.maxX, gz, viewport);
      ctx.beginPath();
      ctx.moveTo(pLeft.x, pLeft.y);
      ctx.lineTo(pRight.x, pRight.y);
      ctx.stroke();
    }
  } else {
    const bgMist = ctx.createRadialGradient(
      viewport.width * 0.5,
      viewport.height * 0.5,
      16,
      viewport.width * 0.5,
      viewport.height * 0.5,
      viewport.width * 0.6
    );
    bgMist.addColorStop(0, 'rgba(7, 10, 18, 0.82)');
    bgMist.addColorStop(0.68, 'rgba(13, 24, 41, 0.64)');
    bgMist.addColorStop(1, 'rgba(7, 10, 18, 0.12)');
    ctx.fillStyle = bgMist;
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    ctx.strokeStyle = 'rgba(186, 230, 253, 0.06)';
    ctx.lineWidth = 0.8;
    for (let gx = 16; gx < viewport.width; gx += 16) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, viewport.height);
      ctx.stroke();
    }
    for (let gy = 16; gy < viewport.height; gy += 16) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(viewport.width, gy);
      ctx.stroke();
    }
  }

  // 2. Salones y recintos del piso activo
  const is2CDoorUnlocked =
    phase === 'ESTADO_FINAL' &&
    (finalSubstate === 'puerta_desbloqueada' || finalSubstate === 'completada');

  for (let i = 0; i < SCHOOL_ROOMS.length; i++) {
    const room = SCHOOL_ROOMS[i];
    if (room.floor !== floor) continue;

    const r = worldRectToMap(room.minX, room.minZ, room.maxX, room.maxZ, viewport);
    const isRoomUnlocked = room.isOpenRoom || (room.id === '2C' && is2CDoorUnlocked);

    ctx.fillStyle = isRoomUnlocked
      ? 'rgba(125, 211, 252, 0.16)'
      : 'rgba(13, 24, 41, 0.54)';
    ctx.fillRect(r.x, r.y, r.w, r.h);

    ctx.strokeStyle = isRoomUnlocked
      ? 'rgba(186, 230, 253, 0.74)'
      : 'rgba(125, 211, 252, 0.42)';
    ctx.lineWidth = isFull ? 1.5 : 0.95;
    ctx.strokeRect(r.x, r.y, r.w, r.h);

    ctx.fillStyle = isRoomUnlocked
      ? 'rgba(255, 255, 255, 0.96)'
      : 'rgba(186, 230, 253, 0.78)';
    ctx.font = isFull
      ? '500 11.5px Inter, -apple-system, sans-serif'
      : '500 7.5px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isFull ? room.fullLabel : room.minimapLabel, r.x + r.w * 0.5, r.y + r.h * 0.52);
  }

  // 3. Pasillos transitables en U (borde luminoso + cuerpo nocturno)
  const borderPad = isFull ? 1.5 : 0.85;
  ctx.fillStyle = isFull ? 'rgba(186, 230, 253, 0.52)' : 'rgba(186, 230, 253, 0.44)';
  for (let i = 0; i < SCHOOL_CORRIDOR_RECTS.length; i++) {
    const c = SCHOOL_CORRIDOR_RECTS[i];
    if (c.floor !== 'both' && c.floor !== floor) continue;
    const r = worldRectToMap(c.minX, c.minZ, c.maxX, c.maxZ, viewport);
    ctx.fillRect(r.x - borderPad, r.y - borderPad, r.w + borderPad * 2, r.h + borderPad * 2);
  }

  ctx.fillStyle = 'rgba(7, 10, 18, 0.9)';
  for (let i = 0; i < SCHOOL_CORRIDOR_RECTS.length; i++) {
    const c = SCHOOL_CORRIDOR_RECTS[i];
    if (c.floor !== 'both' && c.floor !== floor) continue;
    const r = worldRectToMap(c.minX, c.minZ, c.maxX, c.maxZ, viewport);
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }

  // Etiquetas sutiles en el patio central vacío (solo en el mapa completo)
  if (isFull) {
    const courtyardCenter = worldToMap(0, -13.5, viewport);
    ctx.fillStyle = 'rgba(125, 211, 252, 0.36)';
    ctx.font = '500 11px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PATIO CENTRAL', courtyardCenter.x, courtyardCenter.y - 8);

    ctx.fillStyle = 'rgba(186, 230, 253, 0.24)';
    ctx.font = '500 10px Inter, -apple-system, sans-serif';
    ctx.fillText(
      floor === 1 ? '— PRIMER PISO (1F) —' : '— SEGUNDO PISO (2F) —',
      courtyardCenter.x,
      courtyardCenter.y + 10
    );

    const hallLabelPos = worldToMap(0, 0, viewport);
    ctx.fillStyle = 'rgba(186, 230, 253, 0.42)';
    ctx.font = '500 10px Inter, -apple-system, sans-serif';
    ctx.fillText(
      floor === 1 ? 'VESTÍBULO · PASILLO PRINCIPAL' : 'PASILLO PRINCIPAL',
      hallLabelPos.x,
      hallLabelPos.y
    );

    // Brújula Norte discreta en la esquina superior del patio
    const northBadge = worldToMap(0, -23.2, viewport);
    ctx.fillStyle = 'rgba(186, 230, 253, 0.45)';
    ctx.font = '600 10px Inter, -apple-system, sans-serif';
    ctx.fillText('N ▲', northBadge.x, northBadge.y);
  }

  // 4. Islas de casilleros (Getabako) y umbral de entrada en el Piso 1
  if (floor === 1) {
    ctx.fillStyle = 'rgba(13, 24, 41, 0.88)';
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.56)';
    ctx.lineWidth = isFull ? 1.2 : 0.8;
    for (let i = 0; i < GENKAN_LOCKER_ISLANDS.length; i++) {
      const isl = GENKAN_LOCKER_ISLANDS[i];
      const r = worldRectToMap(isl.minX, isl.minZ, isl.maxX, isl.maxZ, viewport);
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }

    const entLeft = worldToMap(-3.0, 7.55, viewport);
    const entRight = worldToMap(3.0, 7.55, viewport);
    ctx.strokeStyle = '#bae6fd';
    ctx.lineWidth = isFull ? 2.4 : 1.5;
    ctx.beginPath();
    ctx.moveTo(entLeft.x, entLeft.y);
    ctx.lineTo(entRight.x, entRight.y);
    ctx.stroke();

    if (isFull) {
      const genkanLabel = worldToMap(0, 8.85, viewport);
      ctx.fillStyle = 'rgba(186, 230, 253, 0.72)';
      ctx.font = '500 10px Inter, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ENTRADA GENKAN', genkanLabel.x, genkanLabel.y);
    }
  }

  // 5. Indicadores de puertas abiertas y cerradas
  for (let i = 0; i < SCHOOL_ROOMS.length; i++) {
    const room = SCHOOL_ROOMS[i];
    if (room.floor !== floor) continue;
    const dLeft = worldToMap(room.doorX - room.doorWidth * 0.5, room.doorZ, viewport);
    const dRight = worldToMap(room.doorX + room.doorWidth * 0.5, room.doorZ, viewport);
    const isDoorOpen = room.isOpenRoom || (room.id === '2C' && is2CDoorUnlocked);

    ctx.strokeStyle = isDoorOpen ? '#bae6fd' : 'rgba(148, 163, 184, 0.55)';
    ctx.lineWidth = isFull ? 2.6 : 1.6;
    ctx.beginPath();
    ctx.moveTo(dLeft.x, dLeft.y);
    ctx.lineTo(dRight.x, dRight.y);
    ctx.stroke();
  }

  // 6. Marcadores dinámicos sincronizados exactamente con los colores de los modelos 3D / GLB
  for (let i = 0; i < ALL_SCHOOL_MAP_MARKERS.length; i++) {
    const marker = ALL_SCHOOL_MAP_MARKERS[i];
    const vis = resolveMapMarkerVisibility(
      marker,
      phase,
      unlockedObjects,
      finalSubstate,
      floor
    );
    if (vis === 'hidden') continue;

    const pt = worldToMap(marker.position[0], marker.position[2], viewport);
    ctx.save();
    ctx.translate(pt.x, pt.y);

    if (vis === 'dimmed') {
      ctx.globalAlpha = 0.42;
    }

    if (marker.kind === 'escalera') {
      if (vis === 'target') {
        const hs = 5.5 * k;
        ctx.strokeStyle = MARKER_3D_COLORS.escalera.halo;
        ctx.lineWidth = isFull ? 1.8 : 1.25;
        ctx.strokeRect(-hs, -hs, hs * 2, hs * 2);
      }
      const s = 3.6 * k;
      ctx.fillStyle = MARKER_3D_COLORS.escalera.fill;
      ctx.strokeStyle = '#070a12';
      ctx.lineWidth = isFull ? 1.4 : 1;
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.strokeRect(-s, -s, s * 2, s * 2);

      ctx.strokeStyle = '#070a12';
      ctx.lineWidth = isFull ? 1.5 : 0.9;
      ctx.beginPath();
      ctx.moveTo(-2.1 * k, 1.7 * k);
      ctx.lineTo(0, 1.7 * k);
      ctx.lineTo(0, 0);
      ctx.lineTo(2.1 * k, 0);
      ctx.lineTo(2.1 * k, -1.7 * k);
      ctx.stroke();
    } else if (marker.kind === 'personaje') {
      if (vis === 'target') {
        ctx.beginPath();
        ctx.arc(0, 0, 5.9 * k, 0, Math.PI * 2);
        ctx.strokeStyle = MARKER_3D_COLORS.personaje.halo;
        ctx.lineWidth = isFull ? 1.8 : 1.25;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, (vis === 'dimmed' ? 2.6 : 3.4) * k, 0, Math.PI * 2);
      ctx.fillStyle = MARKER_3D_COLORS.personaje.fill;
      ctx.fill();
      ctx.lineWidth = isFull ? 1.4 : 1;
      ctx.strokeStyle = '#070a12';
      ctx.stroke();
    } else if (marker.kind === 'puerta') {
      ctx.beginPath();
      ctx.arc(0, 0, 6.4 * k, 0, Math.PI * 2);
      ctx.strokeStyle = MARKER_3D_COLORS.puerta.halo;
      ctx.lineWidth = isFull ? 1.8 : 1.25;
      ctx.stroke();

      const ds = 3.1 * k;
      ctx.fillStyle = MARKER_3D_COLORS.puerta.fill;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = isFull ? 1.4 : 1;
      ctx.fillRect(-ds, -ds, ds * 2, ds * 2);
      ctx.strokeRect(-ds, -ds, ds * 2, ds * 2);
    } else {
      if (vis === 'target') {
        ctx.beginPath();
        ctx.arc(0, 0, 6.0 * k, 0, Math.PI * 2);
        ctx.strokeStyle = MARKER_3D_COLORS.objeto.halo;
        ctx.lineWidth = isFull ? 1.8 : 1.25;
        ctx.stroke();
      }
      ctx.rotate(Math.PI / 4);
      const s = (vis === 'dimmed' ? 2.2 : 2.95) * k;
      ctx.fillStyle = MARKER_3D_COLORS.objeto.fill;
      ctx.strokeStyle = '#070a12';
      ctx.lineWidth = isFull ? 1.4 : 1;
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.strokeRect(-s, -s, s * 2, s * 2);
    }

    ctx.restore();
  }

  // 7. Cursor del jugador en tiempo real (solo si el jugador está en el piso visualizado)
  if (player.floor === floor) {
    const playerPt = worldToMap(player.x, player.z, viewport);

    ctx.save();
    ctx.translate(playerPt.x, playerPt.y);

    // Cono de visión + flecha direccional rotados con la misma convención exacta que SchoolEngine
    ctx.save();
    ctx.rotate(-player.yaw);

    const fovHalfRad = (34 * Math.PI) / 180;
    const coneRadius = isFull ? 40 : 18;
    const coneGrad = ctx.createRadialGradient(0, 0, 2 * k, 0, 0, coneRadius);
    coneGrad.addColorStop(0, isFull ? 'rgba(186, 230, 253, 0.52)' : 'rgba(186, 230, 253, 0.45)');
    coneGrad.addColorStop(1, 'rgba(125, 211, 252, 0)');

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, coneRadius, -Math.PI / 2 - fovHalfRad, -Math.PI / 2 + fovHalfRad);
    ctx.closePath();
    ctx.fillStyle = coneGrad;
    ctx.fill();

    const arrowScale = isFull ? 1.85 : 1.0;
    ctx.beginPath();
    ctx.moveTo(0, -5.6 * arrowScale);
    ctx.lineTo(4.0 * arrowScale, 4.3 * arrowScale);
    ctx.lineTo(0, 2.1 * arrowScale);
    ctx.lineTo(-4.0 * arrowScale, 4.3 * arrowScale);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = isFull ? 1.6 : 1.15;
    ctx.strokeStyle = '#070a12';
    ctx.stroke();
    ctx.restore();

    if (isFull) {
      ctx.font = '600 10.5px Inter, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(7, 10, 18, 0.92)';
      ctx.strokeText('TÚ', 0, 13);
      ctx.fillStyle = '#bae6fd';
      ctx.fillText('TÚ', 0, 13);
    }

    ctx.restore();
  }
}
