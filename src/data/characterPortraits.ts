import { CharacterPortraitId } from '../types';

/**
 * Diccionario central de retratos de personajes (Character Portraits) para el modal de diálogos.
 * Asocia cada identificador canónico de personaje con su archivo de arte correspondiente.
 */
export const CHARACTER_PORTRAITS: Record<CharacterPortraitId, string> = {
  tsuki: '/assets/aistudio/Tsuki2_c677260b.png',
  conserje: '/assets/aistudio/Conserje2_5d55b2e7.png',
  hanako: '/assets/aistudio/Hanako2_7a34c78c.png',
  hotaru: '/assets/aistudio/Hotaru2_3389cbdb.png',
  kaoru: '/assets/aistudio/Kaoru2_842aa04a.png',
  profe: '/assets/aistudio/Profe2_aad73b60.png',
};

const CHARACTER_ID_ALIASES: Record<string, CharacterPortraitId> = {
  tsuki: 'tsuki',
  personaje_tsuki: 'tsuki',
  conserje: 'conserje',
  personaje_conserje: 'conserje',
  hanako: 'hanako',
  personaje_hanako: 'hanako',
  hotaru: 'hotaru',
  personaje_hotaru: 'hotaru',
  kaoru: 'kaoru',
  kaeru: 'kaoru',
  personaje_kaoru: 'kaoru',
  personaje_kaeru: 'kaoru',
  profe: 'profe',
  profesor: 'profe',
  personaje_profe: 'profe',
  personaje_profesor: 'profe',
};

let portraitsPreloaded = false;

/**
 * Resuelve la ruta de imagen del retrato a partir del identificador del personaje o marcador.
 */
export function resolveCharacterPortrait(
  identifier?: string | null,
  fallbackUrl?: string
): string | null {
  if (identifier) {
    const normalized = identifier.trim().toLowerCase();
    const canonicalId = CHARACTER_ID_ALIASES[normalized];
    if (canonicalId) {
      return CHARACTER_PORTRAITS[canonicalId];
    }
  }
  return fallbackUrl ?? null;
}

/**
 * Precarga y decodifica de forma asíncrona los 6 retratos en caché del navegador
 * para evitar saltos visuales al abrir la caja de diálogo en dispositivos móviles.
 */
export function preloadCharacterPortraits(): void {
  if (portraitsPreloaded || typeof window === 'undefined' || typeof Image === 'undefined') {
    return;
  }
  portraitsPreloaded = true;

  Object.values(CHARACTER_PORTRAITS).forEach((src) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
  });
}
