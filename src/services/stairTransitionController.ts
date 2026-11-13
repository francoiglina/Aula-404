export type StairDirection = 'subir' | 'bajar';

export const STAIR_WHIP_IN_MS = 360;
export const STAIR_BLACK_HOLD_MS = 180;
export const STAIR_WHIP_OUT_MS = 420;
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

async function runKeyframeAnimation(
  element: HTMLElement,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions
): Promise<void> {
  if (typeof element.animate !== 'function') {
    const last = keyframes[keyframes.length - 1];
    if (last?.transform) {
      element.style.transform = String(last.transform);
    }
    if (last?.opacity !== undefined) {
      element.style.opacity = String(last.opacity);
    }
    if (last?.backgroundColor !== undefined) {
      element.style.backgroundColor = String(last.backgroundColor);
    }
    await waitMs(typeof options.duration === 'number' ? options.duration : 360);
    return;
  }

  const durationMs = typeof options.duration === 'number' ? options.duration : 360;
  const anim = element.animate(keyframes, {
    fill: 'forwards',
    ...options,
  });

  // Respaldo de seguridad por si la pestaña pierde foco y anim.finished tarda en resolver
  await Promise.race([
    anim.finished.catch(() => {}),
    waitMs(durationMs + 220),
  ]);

  const last = keyframes[keyframes.length - 1];
  if (last?.transform !== undefined) {
    element.style.transform = String(last.transform);
  }
  if (last?.opacity !== undefined) {
    element.style.opacity = String(last.opacity);
  }
  if (last?.backgroundColor !== undefined) {
    element.style.backgroundColor = String(last.backgroundColor);
  }
  try {
    anim.cancel();
  } catch {
    // Ignorar
  }
}

/**
 * Ejecuta la transición cinemática de escaleras estilo whip pan horizontal con
 * desenfoque de movimiento en paleta nocturna (#000000, #071326, #0f294a, cian pálido)
 * y bloqueo de puntero durante toda la secuencia.
 *
 * Orquestación determinista en 3 fases sincronizadas con requestAnimationFrame:
 * 1. Whip-In: barrido desde fuera de pantalla hasta cubrir 100% en negro sólido.
 * 2. Midpoint: con el telón negro pintado, cambia de piso, reposiciona la cámara y
 *    pre-renderiza el nuevo piso antes de iniciar la salida.
 * 3. Whip-Out: barrido de salida revelando suavemente el nuevo piso (tanto en la
 *    primera subida a 2F como en transiciones posteriores).
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

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const startTransform =
    direccion === 'subir'
      ? 'translate3d(-165vw, 0, 0) skewX(-6deg)'
      : 'translate3d(165vw, 0, 0) skewX(6deg)';
  const centerTransform = 'translate3d(0vw, 0, 0) skewX(0deg)';
  const endTransform =
    direccion === 'subir'
      ? 'translate3d(165vw, 0, 0) skewX(-5deg)'
      : 'translate3d(-165vw, 0, 0) skewX(5deg)';

  if (reducedMotion) {
    carriage.style.opacity = '0';
  } else {
    carriage.style.transform = startTransform;
    backdrop.style.backgroundColor = 'rgba(2, 6, 16, 0)';
  }

  document.body.appendChild(overlay);

  try {
    // Asegura el primer layout y paint inicial fuera de pantalla antes de mover el telón
    void overlay.offsetWidth;
    await nextAnimationFrame();
    await nextAnimationFrame();

    if (reducedMotion) {
      await runKeyframeAnimation(
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
      await waitMs(140);
      await nextAnimationFrame();
      await runKeyframeAnimation(
        carriage,
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: 240, easing: 'ease-in-out' }
      );
    } else {
      // Fase 1: Whip-In (cubre la vista actual hasta el núcleo #000000)
      await Promise.all([
        runKeyframeAnimation(
          carriage,
          [{ transform: startTransform }, { transform: centerTransform }],
          { duration: STAIR_WHIP_IN_MS, easing: 'cubic-bezier(0.76, 0, 0.24, 1)' }
        ),
        runKeyframeAnimation(
          backdrop,
          [
            { backgroundColor: 'rgba(2, 6, 16, 0)' },
            { backgroundColor: 'rgba(2, 6, 16, 0.42)' },
          ],
          { duration: STAIR_WHIP_IN_MS, easing: 'ease-out' }
        ),
      ]);

      // Garantiza al menos un frame pintado en negro sólido antes del cambio de piso
      await nextAnimationFrame();

      // Fase 2: Midpoint en negro sólido -> cambio de piso + pre-render 3D
      try {
        await onMidpointCallback?.();
      } catch {
        // Evita dejar el overlay bloqueado si el callback fallara
      }

      // Mantiene el reposo en negro después de completar el render del nuevo piso
      // para que cualquier subida a GPU nunca consuma la animación de salida
      await waitMs(STAIR_BLACK_HOLD_MS);
      await nextAnimationFrame();

      // Fase 3: Whip-Out (despeja suavemente revelando el nuevo piso)
      await Promise.all([
        runKeyframeAnimation(
          carriage,
          [{ transform: centerTransform }, { transform: endTransform }],
          { duration: STAIR_WHIP_OUT_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
        ),
        runKeyframeAnimation(
          backdrop,
          [
            { backgroundColor: 'rgba(2, 6, 16, 0.42)' },
            { backgroundColor: 'rgba(2, 6, 16, 0)' },
          ],
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
