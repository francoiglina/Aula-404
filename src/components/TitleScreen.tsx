import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { soundEngine } from '../services/soundEngine';
import { TitleAudioController } from '../services/titleAudioController';

export const TITLE_BG_IMAGE_URL = '/assets/aistudio/146a113c49fa6f23afa9427964dd46f4_m_3caeeecc.jpg';
export const TITLE_LOGO_IMAGE_URL = '/assets/aistudio/Logo_Blanco_8a054557.png';

interface TitleScreenProps {
  isMuted: boolean;
  onToggleMute: (nextMuted: boolean) => void;
  onComplete: () => void;
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

      {/* Logo oficial "AULA 404" (fidelidad exacta con la "A" invertida inferior y trazos en blanco luminoso) */}
      <div className="title-logo-stage">
        <img
          src={TITLE_LOGO_IMAGE_URL}
          alt="AULA 404"
          draggable={false}
          className="title-logo-img"
        />
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
