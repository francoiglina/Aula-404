import { FloorNumber } from '../types';

export const SCHOOL_KANJI_TITLE = '迷幽高校';
export const SCHOOL_SUBTITLE = 'Instituto de las Sombras Perdidas';

/**
 * Niveles principales permitidos para la notificación central de piso.
 * Se ignoran habitaciones individuales, aulas y pasillos secundarios.
 */
export const FLOOR_NOTICE_TITLES: Record<FloorNumber, string> = {
  1: '- Primer Piso -',
  2: '- Segundo Piso -',
};

/**
 * Valida y resuelve únicamente los dos niveles principales del mapa (Piso 1 y Piso 2).
 * Devuelve `null` para cualquier habitación individual, aula o pasillo secundario.
 */
export function resolveAllowedFloorNotice(
  zoneOrFloor: FloorNumber | number | string
): { floor: FloorNumber; floorTitle: string } | null {
  if (zoneOrFloor === 1) {
    return { floor: 1, floorTitle: FLOOR_NOTICE_TITLES[1] };
  }
  if (zoneOrFloor === 2) {
    return { floor: 2, floorTitle: FLOOR_NOTICE_TITLES[2] };
  }

  if (typeof zoneOrFloor === 'string') {
    const normalized = zoneOrFloor.trim().toLowerCase();
    if (
      normalized === '1' ||
      normalized === '1f' ||
      normalized === 'primer piso' ||
      normalized === '- primer piso -'
    ) {
      return { floor: 1, floorTitle: FLOOR_NOTICE_TITLES[1] };
    }
    if (
      normalized === '2' ||
      normalized === '2f' ||
      normalized === 'segundo piso' ||
      normalized === '- segundo piso -'
    ) {
      return { floor: 2, floorTitle: FLOOR_NOTICE_TITLES[2] };
    }
  }

  return null;
}
