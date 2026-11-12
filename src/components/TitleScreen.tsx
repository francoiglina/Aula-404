import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { soundEngine } from '../services/soundEngine';
import { TitleAudioController } from '../services/titleAudioController';

export const TITLE_BG_IMAGE_URL = '/assets/aistudio/146a113c49fa6f23afa9427964dd46f4_m_3caeeecc.jpg';

interface TitleScreenProps {
  isMuted: boolean;
  onToggleMute: (nextMuted: boolean) => void;
  onComplete: () => void;
}

/**
 * Proyecta coordenadas planas normalizadas (u en [0, 1] ancho derecho del piso,
 * v en [0, 1] profundidad desde el horizonte hacia el primer plano) sobre el
 * trapezoide en perspectiva de Logo_Negro.png.
 */
function projectFloorPoint(u: number, v: number): [number, number] {
  const topLeft: [number, number] = [346, 534];
  const topRight: [number, number] = [816, 495];
  const botLeft: [number, number] = [436, 706];
  const botRight: [number, number] = [948, 654];

  const topX = topLeft[0] + (topRight[0] - topLeft[0]) * u;
  const topY = topLeft[1] + (topRight[1] - topLeft[1]) * u;
  const botX = botLeft[0] + (botRight[0] - botLeft[0]) * u;
  const botY = botLeft[1] + (botRight[1] - botLeft[1]) * u;

  // Ligero acortamiento en perspectiva (foreshortening) para dar peso tridimensional
  const perspV = v * (0.86 + 0.14 * v);
  const x = topX + (botX - topX) * perspV;
  const y = topY + (botY - topY) * perspV;
  return [Number(x.toFixed(1)), Number(y.toFixed(1))];
}

function toPolygonPath(pts: Array<[number, number]>): string {
  return (
    pts
      .map(([u, v], idx) => {
        const [x, y] = projectFloorPoint(u, v);
        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ') + ' Z'
  );
}

/**
 * Genera el anillo exterior e interior en perspectiva para el dígito "0" sobre el piso.
 */
function buildProjectedZeroPath(): string {
  const steps = 28;
  const cx = 0.505;
  const cy = 0.49;
  const outerRx = 0.148;
  const outerRy = 0.45;
  const innerRx = 0.068;
  const innerRy = 0.27;

  const outerPts: Array<[number, number]> = [];
  const innerPts: Array<[number, number]> = [];

  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    outerPts.push([cx + Math.cos(theta) * outerRx, cy + Math.sin(theta) * outerRy]);
  }
  for (let i = steps - 1; i >= 0; i--) {
    const theta = (i / steps) * Math.PI * 2;
    innerPts.push([cx + Math.cos(theta) * innerRx, cy + Math.sin(theta) * innerRy]);
  }

  return `${toPolygonPath(outerPts)} ${toPolygonPath(innerPts)}`;
}

/**
 * Genera un dígito "4" geométrico grueso proyectado en perspectiva en el rango horizontal [uOffset].
 */
function buildProjectedFourPath(uOffset: number): string {
  // Contorno exterior en sentido horario
  const outer = toPolygonPath([
    [uOffset + 0.145, 0.04],
    [uOffset + 0.228, 0.04],
    [uOffset + 0.228, 0.62],
    [uOffset + 0.292, 0.62],
    [uOffset + 0.292, 0.77],
    [uOffset + 0.228, 0.77],
    [uOffset + 0.228, 0.96],
    [uOffset + 0.148, 0.96],
    [uOffset + 0.148, 0.77],
    [uOffset + 0.0, 0.77],
    [uOffset + 0.0, 0.6],
  ]);

  // Hueco triangular interior del "4"
  const hole = toPolygonPath([
    [uOffset + 0.15, 0.26],
    [uOffset + 0.072, 0.62],
    [uOffset + 0.15, 0.62],
  ]);

  return `${outer} ${hole}`;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  isMuted,
  onToggleMute,
  onComplete,
}) => {
  const [phase, setPhase] = useState<'entering' | 'ready' | 'exiting'>('entering');
  const [bgLoadError, setBgLoadError] = useState(false);

  const audioControllerRef = useRef<TitleAudioController | null>(null);
  const exitStartedRef = useRef(false);

  const projectedFloorPaths = useMemo(
    () => ({
      fourLeft: buildProjectedFourPath(0.03),
      zeroCenter: buildProjectedZeroPath(),
      fourRight: buildProjectedFourPath(0.68),
    }),
    []
  );

  // Inicia el fade-in desde negro (1.8s) y reproduce title_screen.mp3 al instante en volumen 1.0
  useEffect(() => {
    const controller = new TitleAudioController({
      targetVolume: 1.0,
      initialMuted: isMuted,
    });
    audioControllerRef.current = controller;

    const rafId = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setPhase((prev) => (prev === 'entering' ? 'ready' : prev));
      });
    });

    void controller.start();

    return () => {
      window.cancelAnimationFrame(rafId);
      controller.dispose();
      audioControllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza el estado mute con TitleAudioController cuando cambia
  useEffect(() => {
    audioControllerRef.current?.setMuted(isMuted);
  }, [isMuted]);

  const triggerStart = useCallback(() => {
    if (exitStartedRef.current) return;
    exitStartedRef.current = true;

    soundEngine.playConfirm();
    setPhase('exiting');

    // Fade-out sincronizado: pantalla a negro (1.5s) y música a 0 -> pause()
    const audioPromise = audioControllerRef.current
      ? audioControllerRef.current.fadeOutAndStop(1500)
      : Promise.resolve();

    const visualTimer = window.setTimeout(() => {
      void audioPromise.finally(() => {
        onComplete();
      });
    }, 1520);

    return () => window.clearTimeout(visualTimer);
  }, [onComplete]);

  // Permite iniciar presionando Enter o Espacio desde cualquier parte de la pantalla
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (exitStartedRef.current) return;
      if (e.code === 'Enter' || e.code === 'Space') {
        // Evitar doble disparo si el foco ya está en un botón distinto (ej. Mute)
        const activeEl = document.activeElement as HTMLElement | null;
        if (activeEl && activeEl.dataset.titleMute === 'true') {
          return;
        }
        e.preventDefault();
        triggerStart();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerStart]);

  const handleMuteButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const nextMuted = !isMuted;
    onToggleMute(nextMuted);
    audioControllerRef.current?.setMuted(nextMuted);
  };

  return (
    <section
      id="title-screen"
      aria-label="Pantalla de título de Aula 404"
    >
      {/* Telón negro inicial (Fade-In 1.8s) y de salida (Fade-Out 1.5s) */}
      <div
        aria-hidden="true"
        className={`title-black-curtain ${
          phase === 'ready' ? 'is-revealed' : phase === 'exiting' ? 'is-exiting' : ''
        }`}
      />

      {/* Fondo atmosférico nocturno con Ken Burns lento */}
      <div className="title-bg-layer" aria-hidden="true">
        {!bgLoadError ? (
          <img
            src={TITLE_BG_IMAGE_URL}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setBgLoadError(true)}
            className="title-bg-image"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-b from-[#040a18] via-[#061229] to-[#020308]" />
        )}
      </div>

      {/* Viñeta oscura, líneas CRT y grano cinematográfico */}
      <div className="title-vignette" aria-hidden="true" />
      <div className="title-scanlines" aria-hidden="true" />
      <div className="title-film-grain" aria-hidden="true" />

      {/* Barra superior minimalista con control de silencio */}
      <div className="relative z-20 flex w-full items-center justify-end">
        <button
          type="button"
          data-title-mute="true"
          data-no-confirm-sfx="true"
          onClick={handleMuteButtonClick}
          aria-label={isMuted ? 'Activar música de título' : 'Silenciar música de título'}
          title={isMuted ? 'Activar sonido' : 'Silenciar sonido'}
          className="title-audio-toggle"
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Volume2 className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Recreación Vectorial SVG del Logo "AULA 404" (invertido a blanco/cian luminoso) */}
      <div className="title-logo-stage">
        <svg
          className="title-logo-svg"
          viewBox="40 110 930 670"
          role="img"
          aria-label="Aula 404 — Logo arquitectónico con portal Torii"
        >
          <defs>
            {/* Resplandor blanco / cian pálido para trazos principales */}
            <linearGradient id="logoWhiteCyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="68%" stopColor="#ecfeff" />
              <stop offset="100%" stopColor="#a5f3fc" />
            </linearGradient>

            {/* Panel superior tipo ventana/pizarrón iluminado */}
            <linearGradient id="boardGlowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
              <stop offset="100%" stopColor="#cffafe" stopOpacity="0.9" />
            </linearGradient>

            {/* Haz de luz proyectado desde el umbral del Torii hacia el suelo */}
            <linearGradient id="doorwayLightConeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ecfeff" stopOpacity="0.88" />
              <stop offset="45%" stopColor="#a5f3fc" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#67e8f9" stopOpacity="0" />
            </linearGradient>

            {/* Proyección en perspectiva de "404" sobre el suelo */}
            <linearGradient id="floor404Grad" x1="20%" y1="0%" x2="35%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.96" />
              <stop offset="52%" stopColor="#cffafe" stopOpacity="0.76" />
              <stop offset="100%" stopColor="#67e8f9" stopOpacity="0.22" />
            </linearGradient>

            {/* Sombra / plano de pasillo donde reposa "404" */}
            <linearGradient id="floorPlaneBackdrop" x1="0%" y1="0%" x2="25%" y2="100%">
              <stop offset="0%" stopColor="#040b18" stopOpacity="0.62" />
              <stop offset="70%" stopColor="#081a30" stopOpacity="0.26" />
              <stop offset="100%" stopColor="#020612" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grupo 1: Marco arquitectónico de muro posterior con apertura en el portal Torii */}
          <g id="logo-wall-frame">
            <path
              d="M 81 184 L 832 128 L 832 494 L 321 536 L 321 386 L 193 398 L 193 546 L 81 553 Z"
              fill="rgba(2, 7, 18, 0.56)"
              stroke="rgba(165, 243, 252, 0.34)"
              strokeWidth="1.75"
            />
            {/* Línea sutil de zócalo/horizonte separando muro y suelo */}
            <path
              d="M 81 553 L 193 546 M 321 536 L 832 494"
              stroke="rgba(207, 250, 254, 0.45)"
              strokeWidth="1.5"
              fill="none"
            />
          </g>

          {/* Grupo 2: Portal Torii japonés formando la letra "A" de AULA */}
          <g id="logo-torii" fill="url(#logoWhiteCyanGrad)">
            {/* Kasagi superior curvo (dintel principal con puntas elevadas) */}
            <path d="M 130 285 Q 250 281 369 261 L 368 273 Q 361 286 354 290 Q 250 307 145 315 Q 135 305 130 285 Z" />
            {/* Gakuzuka (puntal central entre kasagi y viga superior) */}
            <path d="M 247 297 L 263 295 L 263 326 L 247 328 Z" />
            {/* Travesaño superior intermedio */}
            <path d="M 164 328 L 348 308 L 348 322 L 164 342 Z" />
            {/* Nuki inferior (viga horizontal sobre el dintel de acceso) */}
            <path d="M 163 374 L 348 355 L 348 370 L 163 389 Z" />
            {/* Pilar izquierdo (Hashira) con base ensanchada (Kamebara) */}
            <path d="M 172 308 L 193 306 L 193 546 L 168 548 L 168 507 L 172 505 Z" />
            {/* Pilar derecho (Hashira) con base ensanchada (Kamebara) */}
            <path d="M 321 291 L 341 289 L 344 534 L 319 536 L 319 496 L 321 494 Z" />
          </g>

          {/* Grupo 3: Rectángulo superior en perspectiva (Ventana / Pizarrón sobre ULA) */}
          <g id="logo-board">
            <path
              d="M 379 240 L 707 217 L 707 377 L 379 396 Z"
              fill="url(#boardGlowGrad)"
            />
          </g>

          {/* Grupo 4: Letras geométricas "U L A" alineadas junto al Torii */}
          <g id="logo-ula" fill="url(#logoWhiteCyanGrad)">
            {/* Letra U (base redondeada apoyada en la línea de horizonte) */}
            <path d="M 360 407 L 381 405 L 381 482 C 381 511 395 516 411 515 C 427 513 440 506 440 477 L 440 399 L 461 397 L 461 478 C 461 520 439 532 411 535 C 383 537 360 526 360 486 Z" />
            {/* Letra L */}
            <path d="M 486 395 L 507 393 L 507 506 L 561 501 L 561 519 L 486 526 Z" />
            {/* Letra A */}
            <path
              fillRule="evenodd"
              d="M 613 383 L 636 381 L 687 507 L 664 509 L 651 477 L 599 482 L 588 516 L 566 518 Z M 625 408 L 605 464 L 645 460 Z"
            />
          </g>

          {/* Grupo 5: Proyección en perspectiva sobre el suelo ("404" + haz de luz del Torii) */}
          <g id="logo-floor-404">
            {/* Cono de luz proyectado desde el umbral abierto del Torii */}
            <path
              d="M 193 546 L 321 536 L 319 746 L 178 755 Z"
              fill="url(#doorwayLightConeGrad)"
            />
            {/* Franja oscura izquierda en perspectiva fuera del umbral */}
            <path
              d="M 81 553 L 193 546 L 178 755 L 53 762 Z"
              fill="url(#floorPlaneBackdrop)"
            />
            {/* Plano derecho en perspectiva sobre el cual se proyecta "404" */}
            <path
              d="M 321 536 L 832 494 L 952 664 L 402 718 Z"
              fill="url(#floorPlaneBackdrop)"
              stroke="rgba(165, 243, 252, 0.14)"
              strokeWidth="1"
            />
            {/* Numerales "4 0 4" proyectados en perspectiva real sobre el suelo */}
            <path
              fillRule="evenodd"
              fill="url(#floor404Grad)"
              d={`${projectedFloorPaths.fourLeft} ${projectedFloorPaths.zeroCenter} ${projectedFloorPaths.fourRight}`}
            />
          </g>
        </svg>
      </div>

      {/* Prompt interactivo inferior "COMENZAR" estilo videojuego */}
      <div className="title-start-wrapper">
        <button
          id="btn-start-game"
          type="button"
          data-no-confirm-sfx="true"
          disabled={phase === 'exiting'}
          onClick={triggerStart}
          className="title-start-btn"
        >
          <span className="title-start-beam" aria-hidden="true" />
          <span className="title-start-line" aria-hidden="true" />
          <span>COMENZAR</span>
          <span className="title-start-line title-start-line--right" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
};
