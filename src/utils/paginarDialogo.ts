export const MAX_CHARS_PER_PAGE = 180;

const MIN_SENTENCE_CUT_RATIO = 0.45;
const MIN_PAUSE_CUT_RATIO = 0.2;

/**
 * Determina si el carácter en `idx` forma parte de un número decimal o reloj (ej. "4.5", "10:30").
 */
function isNumericPunctuation(text: string, idx: number): boolean {
  const prev = idx > 0 ? text[idx - 1] : '';
  const next = idx + 1 < text.length ? text[idx + 1] : '';
  return /\d/.test(prev) && /\d/.test(next);
}

/**
 * Avanza más allá de signos de cierre encadenados (ej. "...", "?!", ".”") para no partirlos.
 */
function expandClosingCluster(text: string, startIdx: number): number {
  let end = startIdx + 1;
  while (end < text.length && /[.!?…"'»”’)]/.test(text[end])) {
    end += 1;
  }
  return end;
}

/**
 * Busca el mejor punto de corte sintáctico dentro de la ventana [0, maxChars] respetando:
 * 1) Cierre de oración (., !, ?, ..., …) si supera el 45% de maxChars.
 * 2) Pausa sintáctica (,, ;, :) si no hay cierre de oración válido.
 * 3) Último espacio en blanco para nunca partir palabras ni dejar signos huérfanos.
 */
function findSyntacticCutIndex(restante: string, maxChars: number): number {
  const minSentenceCut = Math.floor(maxChars * MIN_SENTENCE_CUT_RATIO);
  const minPauseCut = Math.floor(maxChars * MIN_PAUSE_CUT_RATIO);

  // 1) Prioridad 1: Cierre de oración (., !, ?, ..., …)
  for (let i = Math.min(maxChars - 1, restante.length - 1); i >= minSentenceCut; i--) {
    const ch = restante[i];
    if (ch !== '.' && ch !== '!' && ch !== '?' && ch !== '…') continue;
    if (ch === '.' && isNumericPunctuation(restante, i)) continue;

    // Si es parte de puntos suspensivos "...", aseguramos posicionarnos en el final del grupo
    const clusterEnd = expandClosingCluster(restante, i);
    if (clusterEnd > maxChars) continue;

    // Solo cortamos si después viene fin de texto o espacio en blanco (evita cortar abreviaturas o URLs)
    if (clusterEnd === restante.length || /\s/.test(restante[clusterEnd])) {
      return clusterEnd;
    }
  }

  // 2) Prioridad 2: Pausa sintáctica (,, ;, :)
  for (let i = Math.min(maxChars - 1, restante.length - 1); i >= minPauseCut; i--) {
    const ch = restante[i];
    if (ch !== ',' && ch !== ';' && ch !== ':') continue;
    if ((ch === ',' || ch === ':') && isNumericPunctuation(restante, i)) continue;

    const clusterEnd = expandClosingCluster(restante, i);
    if (clusterEnd > maxChars) continue;

    if (clusterEnd === restante.length || /\s/.test(restante[clusterEnd])) {
      return clusterEnd;
    }
  }

  // 3) Prioridad 3: Último espacio en blanco antes del límite de maxChars
  if (maxChars < restante.length && /\s/.test(restante[maxChars])) {
    return maxChars;
  }

  for (let i = Math.min(maxChars - 1, restante.length - 1); i > 0; i--) {
    if (!/\s/.test(restante[i])) continue;

    // Evita que el siguiente bloque arranque con un signo huérfano tras un espacio accidental
    let nextNonSpace = i + 1;
    while (nextNonSpace < restante.length && /\s/.test(restante[nextNonSpace])) {
      nextNonSpace += 1;
    }
    if (nextNonSpace < restante.length && /^[.,;:!?…]/.test(restante[nextNonSpace])) {
      continue;
    }

    return i;
  }

  // Respaldo seguro en palabras extremadamente largas sin espacios
  return maxChars;
}

/**
 * Divide un texto largo de diálogo en páginas de hasta `maxChars` caracteres (por defecto 180)
 * respetando la sintaxis natural del español y limpiando espacios sobrantes en cada bloque.
 */
export function paginarDialogo(
  texto: string,
  maxChars: number = MAX_CHARS_PER_PAGE
): string[] {
  const limpio = (texto ?? '').replace(/\s+/g, ' ').trim();
  if (!limpio) return [];
  if (limpio.length <= maxChars) return [limpio];

  const paginas: string[] = [];
  let restante = limpio;

  while (restante.length > maxChars) {
    const cutIdx = findSyntacticCutIndex(restante, maxChars);
    const fragmento = restante.slice(0, cutIdx).trim();

    if (fragmento.length > 0) {
      paginas.push(fragmento);
    }

    const siguiente = restante.slice(cutIdx).trim();
    if (siguiente.length === restante.length) {
      // Guardia defensiva para garantizar progreso del bucle
      paginas.push(restante.slice(0, maxChars).trim());
      restante = restante.slice(maxChars).trim();
    } else {
      restante = siguiente;
    }
  }

  if (restante.length > 0) {
    paginas.push(restante);
  }

  return paginas;
}
