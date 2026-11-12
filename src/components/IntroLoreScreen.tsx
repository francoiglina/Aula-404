import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { soundEngine } from '../services/soundEngine';
import {
  OPENING_LORE_AUDIO_URL,
  TitleAudioController,
} from '../services/titleAudioController';

const PARAGRAPH_1 =
  'Es tu primer día de clases en el Instituto De Las Sombras Perdidas. Todo el mundo conoce los rumores: dicen que en este edificio siempre ocurren cosas extrañas y misteriosas.';

const PARAGRAPH_2 =
  'Al cruzar la entrada, notás algo desconcertante: no hay carteles ni señalización por ningún lado, y nadie parece dispuesto a darte una respuesta directa. Para encontrar el camino correcto hacia tu aula, vas a tener que observar cada rincón del entorno y conversar con quienes se crucen en tu camino para ir uniendo las pistas.';

interface IntroLoreScreenProps {
  isMuted: boolean;
  onToggleMute: (nextMuted: boolean) => void;
  onPrepareMainScene: () => void;
  onComplete: () => void;
}

export const IntroLoreScreen: React.FC<IntroLoreScreenProps> = ({
  isMuted,
  onToggleMute,
  onPrepareMainScene,
  onComplete,
}) => {
  const [isEntered, setIsEntered] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const [p1Count, setP1Count] = useState(0);
  const [p2Count, setP2Count] = useState(0);
  const [isTypingComplete, setIsTypingComplete] = useState(false);

  const audioControllerRef = useRef<TitleAudioController | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);
  const isTypingCompleteRef = useRef(false);
  const hasTriggeredExitRef = useRef(false);

  useEffect(() => {
    isTypingCompleteRef.current = isTypingComplete;
  }, [isTypingComplete]);

  // Fade-in visual de la interfaz y arranque inmediato de opening.mp3 (volume = 1.0)
  useEffect(() => {
    const controller = new TitleAudioController({
      src: OPENING_LORE_AUDIO_URL,
      targetVolume: 1.0,
      initialMuted: isMuted,
    });
    audioControllerRef.current = controller;

    const rafId = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setIsEntered(true);
      });
    });

    void controller.start();

    return () => {
      window.cancelAnimationFrame(rafId);
      if (typingTimerRef.current !== null) {
        window.clearTimeout(typingTimerRef.current);
      }
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
      controller.dispose();
      audioControllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza el estado de Mute/Unmute global
  useEffect(() => {
    audioControllerRef.current?.setMuted(isMuted);
  }, [isMuted]);

  // Efecto máquina de escribir carácter por carácter para ambos párrafos
  useEffect(() => {
    let cancelled = false;
    let currentP1 = 0;
    let currentP2 = 0;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setP1Count(PARAGRAPH_1.length);
      setP2Count(PARAGRAPH_2.length);
      setIsTypingComplete(true);
      return;
    }

    const getCharDelay = (ch: string) => {
      if (ch === '.' || ch === ':') return 110;
      if (ch === ',') return 65;
      return 27;
    };

    const typeNextP2 = () => {
      if (cancelled || isTypingCompleteRef.current) return;
      if (currentP2 < PARAGRAPH_2.length) {
        currentP2 += 1;
        setP2Count(currentP2);
        const char = PARAGRAPH_2[currentP2 - 1] ?? '';
        typingTimerRef.current = window.setTimeout(typeNextP2, getCharDelay(char));
      } else {
        setIsTypingComplete(true);
      }
    };

    const typeNextP1 = () => {
      if (cancelled || isTypingCompleteRef.current) return;
      if (currentP1 < PARAGRAPH_1.length) {
        currentP1 += 1;
        setP1Count(currentP1);
        const char = PARAGRAPH_1[currentP1 - 1] ?? '';
        typingTimerRef.current = window.setTimeout(typeNextP1, getCharDelay(char));
      } else {
        // Breve pausa narrativa antes de comenzar el segundo párrafo
        typingTimerRef.current = window.setTimeout(typeNextP2, 650);
      }
    };

    // Pequeño respiro inicial tras el fade-in antes de teclear
    typingTimerRef.current = window.setTimeout(typeNextP1, 520);

    return () => {
      cancelled = true;
      if (typingTimerRef.current !== null) {
        window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, []);

  const completeTypingImmediately = useCallback(() => {
    if (isTypingCompleteRef.current) return;
    if (typingTimerRef.current !== null) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    isTypingCompleteRef.current = true;
    setP1Count(PARAGRAPH_1.length);
    setP2Count(PARAGRAPH_2.length);
    setIsTypingComplete(true);
  }, []);

  const triggerExitToScene = useCallback(() => {
    if (hasTriggeredExitRef.current) return;
    hasTriggeredExitRef.current = true;

    // Desbloquea AudioContext del juego dentro del gesto del usuario y reproduce confirm SFX
    onPrepareMainScene();
    soundEngine.playConfirm();

    setIsExiting(true);

    // Fade-out sincronizado de opening.mp3 (1.5s -> 0 -> pause) y de la pantalla a la escena 3D
    const audioFadePromise = audioControllerRef.current
      ? audioControllerRef.current.fadeOutAndStop(1500)
      : Promise.resolve();

    exitTimerRef.current = window.setTimeout(() => {
      void audioFadePromise.finally(() => {
        onComplete();
      });
    }, 1520);
  }, [onComplete, onPrepareMainScene]);

  const handleScreenInteraction = useCallback(() => {
    if (hasTriggeredExitRef.current) return;
    if (!isTypingCompleteRef.current) {
      completeTypingImmediately();
    } else {
      triggerExitToScene();
    }
  }, [completeTypingImmediately, triggerExitToScene]);

  // Atajos de teclado: cualquier tecla no modificadora completa el texto; Enter/Espacio continúa
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (hasTriggeredExitRef.current) return;

      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl?.dataset.introMute === 'true' && (e.code === 'Enter' || e.code === 'Space')) {
        return;
      }

      if (
        e.key === 'Shift' ||
        e.key === 'Control' ||
        e.key === 'Alt' ||
        e.key === 'Meta' ||
        e.code === 'Tab'
      ) {
        return;
      }

      if (!isTypingCompleteRef.current) {
        e.preventDefault();
        completeTypingImmediately();
        return;
      }

      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        triggerExitToScene();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [completeTypingImmediately, triggerExitToScene]);

  const handleMuteClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const nextMuted = !isMuted;
    onToggleMute(nextMuted);
    audioControllerRef.current?.setMuted(nextMuted);
  };

  const visibleP1 = PARAGRAPH_1.slice(0, p1Count);
  const visibleP2 = PARAGRAPH_2.slice(0, p2Count);
  const showCursorOnP1 = !isTypingComplete && p2Count === 0;
  const showCursorOnP2 = !isTypingComplete && p2Count > 0;

  return (
    <section
      id="intro-lore-screen"
      aria-label="Introducción narrativa de Aula 404"
      onClick={handleScreenInteraction}
      className={`${isEntered ? 'is-entered' : ''} ${isExiting ? 'is-exiting' : ''}`.trim()}
    >
      {/* Barra superior con control de audio sincronizado */}
      <div className="intro-lore-content relative z-20 flex w-full items-center justify-end">
        <button
          type="button"
          data-intro-mute="true"
          data-no-confirm-sfx="true"
          onClick={handleMuteClick}
          aria-label={isMuted ? 'Activar audio de introducción' : 'Silenciar audio de introducción'}
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

      {/* Texto narrativo centrado estilo visual novel / misterio */}
      <div className="intro-lore-content intro-lore-stage">
        <div className="intro-lore-divider" aria-hidden="true" />

        <div className="intro-lore-paragraphs" aria-live="polite">
          <p className="intro-lore-paragraph">
            <span>{visibleP1}</span>
            {showCursorOnP1 && <span className="intro-type-cursor" aria-hidden="true" />}
          </p>

          {(p2Count > 0 || isTypingComplete) && (
            <p className="intro-lore-paragraph">
              <span>{visibleP2}</span>
              {showCursorOnP2 && <span className="intro-type-cursor" aria-hidden="true" />}
            </p>
          )}
        </div>
      </div>

      {/* Espaciador inferior limpio para centrar verticalmente los párrafos sin textos instructivos */}
      <div className="intro-lore-spacer" aria-hidden="true" />
    </section>
  );
};
