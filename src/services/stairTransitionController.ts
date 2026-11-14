export type StairDirection = 'subir' | 'bajar';

export const STAIR_WHIP_IN_MS = 320;
export const STAIR_BLACK_HOLD_MS = 120;
export const STAIR_WHIP_OUT_MS = 380;
export const STAIR_TRANSITION_DURATION_MS =
  STAIR_WHIP_IN_MS + STAIR_BLACK_HOLD_MS + STAIR_WHIP_OUT_MS;

let isTransitionRunning = false;

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function runGpuAnimation(
  element: HTMLElement,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions
): Promise<void> {
  if (typeof element.animate !== 'function') {
    const last = keyframes[keyframes.length - 1];
    if (last?.transform !== undefined) {
      element.style.transform = String(last.transform);
    }
    if (last?.opacity !== undefined) {
      element.style.opacity = String(last.opacity);
    }
    await waitMs(typeof options.duration === 'number' ? options.duration : 320);
    return;
  }

  const durationMs = typeof options.duration === 'number' ? options.duration : 320;
  const anim = element.animate(keyframes, {
    fill: 'forwards',
    ...options,
  });

  await Promise.race([
    anim.finished.catch(() => {}),
    waitMs(durationMs + 200),
  ]);

  const last = keyframes[keyframes.length - 1];
  if (last?.transform !== undefined) {
    element.style.transform = String(last.transform);
  }
  if (last?.opacity !== undefined) {
    element.style.opacity = String(last.opacity);
  }
  try {
    anim.cancel();
  } catch {
    // Ignorar
  }
}

/**
 * Ejecuta la transición cinemática de escaleras acelerada al 100% por GPU (únicamente
 * `opacity` y `transform: translate3d`, sin `filter: blur` ni cambios de layout):
 *
 * 1. Whip-In / Fade a negro: cubre la vista hasta #000000 sólido.
 * 2. Midpoint desacoplado (pantalla 100% en negro y sin animaciones corriendo):
 *    cambia visibilidad de piso, reposiciona cámara y realiza un render silencioso.
 * 3. Sincronización de frame (`requestAnimationFrame`): espera a que la GPU termine
 *    de dibujar el nuevo piso antes de disparar el Whip-Out / Fade-In hacia la escena.
 */
export async function ejecutarTransicionEscalera(
  direccion: StairDirection,
  onMidpointCallback?: () => void | Promise<void>
): Promise<void> {
  if (typeof document === 'undefined') {
    await onMidpointCallback?.();
    return;
  }

  if (isTransitionRunning) {
    return;
  }
  isTransitionRunning = true;

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

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const startTransform =
    direccion === 'subir' ? 'translate3d(-155vw, 0, 0)' : 'translate3d(155vw, 0, 0)';
  const centerTransform = 'translate3d(0vw, 0, 0)';
  const endTransform =
    direccion === 'subir' ? 'translate3d(155vw, 0, 0)' : 'translate3d(-155vw, 0, 0)';

  if (reducedMotion) {
    carriage.style.opacity = '0';
  } else {
    carriage.style.transform = startTransform;
    backdrop.style.opacity = '0';
  }

  document.body.appendChild(overlay);

  try {
    // Primer frame limpio para promover capas al compositor GPU antes de animar
    await nextAnimationFrame();
    await nextAnimationFrame();

    if (reducedMotion) {
      await runGpuAnimation(
        carriage,
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: 220, easing: 'ease-in-out' }
      );
      await nextAnimationFrame();
      try {
        await onMidpointCallback?.();
      } catch {
        // Evita bloquear el cierre de la transición
      }
      await waitMs(STAIR_BLACK_HOLD_MS);
      await nextAnimationFrame();
      await runGpuAnimation(
        carriage,
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: 240, easing: 'ease-in-out' }
      );
    } else {
      // Fase 1: Barrido a negro puro (GPU-only: translate3d + opacity)
      await Promise.all([
        runGpuAnimation(
          carriage,
          [{ transform: startTransform }, { transform: centerTransform }],
          { duration: STAIR_WHIP_IN_MS, easing: 'cubic-bezier(0.76, 0, 0.24, 1)' }
        ),
        runGpuAnimation(
          backdrop,
          [{ opacity: 0 }, { opacity: 0.44 }],
          { duration: STAIR_WHIP_IN_MS, easing: 'ease-out' }
        ),
      ]);

      // Garantiza pantalla 100% en negro sin animación activa antes de tocar WebGL
      await nextAnimationFrame();

      // Fase 2: Midpoint en negro sólido -> alterna visibilidad de piso, colisiones y render oculto
      try {
        await onMidpointCallback?.();
      } catch {
        // Evita dejar el overlay bloqueado si el callback fallara
      }

      // Espera a que la GPU termine de dibujar el nuevo piso en ese frame oculto
      await waitMs(STAIR_BLACK_HOLD_MS);
      await nextAnimationFrame();

      // Fase 3: Revelado suave hacia el nuevo piso (GPU-only: translate3d + opacity)
      await Promise.all([
        runGpuAnimation(
          carriage,
          [{ transform: centerTransform }, { transform: endTransform }],
          { duration: STAIR_WHIP_OUT_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
        ),
        runGpuAnimation(
          backdrop,
          [{ opacity: 0.44 }, { opacity: 0 }],
          { duration: STAIR_WHIP_OUT_MS, easing: 'ease-in' }
        ),
      ]);
    }

    await nextAnimationFrame();
  } finally {
    overlay.remove();
    isTransitionRunning = false;
  }
}
