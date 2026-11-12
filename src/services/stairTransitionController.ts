export type StairDirection = 'subir' | 'bajar';

export const STAIR_TRANSITION_DURATION_MS = 1080;
export const STAIR_MIDPOINT_CALLBACK_MS = 460;

let isTransitionRunning = false;

/**
 * Ejecuta la transición cinemática de escaleras estilo whip pan horizontal con
 * desenfoque de movimiento en paleta nocturna (#000000, #071326, #0f294a, cian pálido)
 * y bloqueo de puntero durante toda la secuencia.
 *
 * - 'subir': barrido de izquierda a derecha -> negro sólido -> despeja hacia la derecha.
 * - 'bajar': barrido de derecha a izquierda -> negro sólido -> despeja hacia la izquierda.
 */
export function ejecutarTransicionEscalera(
  direccion: StairDirection,
  onMidpointCallback?: () => void
): Promise<void> {
  if (typeof document === 'undefined') {
    onMidpointCallback?.();
    return Promise.resolve();
  }

  if (isTransitionRunning) {
    return Promise.resolve();
  }
  isTransitionRunning = true;

  // Limpia cualquier overlay previo huérfano por seguridad
  const existing = document.getElementById('stair-whip-overlay');
  existing?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'stair-whip-overlay';
  overlay.className = direccion === 'subir' ? 'is-subir' : 'is-bajar';
  overlay.setAttribute('aria-hidden', 'true');

  const backdrop = document.createElement('div');
  backdrop.className = 'stair-whip-backdrop';

  const carriage = document.createElement('div');
  carriage.className = 'stair-whip-carriage';

  const blurWings = document.createElement('div');
  blurWings.className = 'stair-whip-blur-wings';

  const streaks = document.createElement('div');
  streaks.className = 'stair-whip-streaks';

  const blackCore = document.createElement('div');
  blackCore.className = 'stair-whip-black-core';

  carriage.appendChild(blurWings);
  carriage.appendChild(streaks);
  carriage.appendChild(blackCore);

  overlay.appendChild(backdrop);
  overlay.appendChild(carriage);
  document.body.appendChild(overlay);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const midpointDelay = reducedMotion ? 290 : STAIR_MIDPOINT_CALLBACK_MS;
  const totalDuration = reducedMotion ? 660 : STAIR_TRANSITION_DURATION_MS;

  return new Promise((resolve) => {
    // Punto medio: la pantalla está 100% cubierta en negro sólido (#000000)
    window.setTimeout(() => {
      try {
        onMidpointCallback?.();
      } catch {
        // Evita dejar el overlay bloqueado si el callback fallara
      }
    }, midpointDelay);

    // Fin del barrido: desmonta el overlay y libera la interacción
    window.setTimeout(() => {
      overlay.remove();
      isTransitionRunning = false;
      resolve();
    }, totalDuration + 20);
  });
}
