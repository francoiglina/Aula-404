import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  preloadCharacterPortraits,
  resolveCharacterPortrait,
} from '../data/characterPortraits';
import { soundEngine } from '../services/soundEngine';
import { DialoguePayload } from '../types';
import { MAX_CHARS_PER_PAGE, paginarDialogo } from '../utils/paginarDialogo';

interface DialogueOverlayProps {
  dialogue: DialoguePayload;
  onFinishDialogue: (dialogue: DialoguePayload) => void;
  onClose?: () => void;
}

export const DialogueOverlay: React.FC<DialogueOverlayProps> = ({
  dialogue,
  onFinishDialogue,
}) => {
  const [pageIndex, setPageIndex] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);

  const portraitSrc = resolveCharacterPortrait(
    dialogue.characterId ?? dialogue.markerId,
    dialogue.portraitUrl
  );

  // Paginación automática sintáctica en bloques de máximo 180 caracteres
  const paginatedPages = useMemo(
    () =>
      dialogue.lines.flatMap((line) => paginarDialogo(line, MAX_CHARS_PER_PAGE)),
    [dialogue]
  );

  const currentFullPage = paginatedPages[pageIndex] || '';
  const isTyping = charCount < currentFullPage.length;
  const isLastPage = pageIndex >= Math.max(0, paginatedPages.length - 1);

  useEffect(() => {
    preloadCharacterPortraits();
  }, []);

  useEffect(() => {
    setPageIndex(0);
    setCharCount(0);
    setImgFailed(false);
  }, [dialogue]);

  useEffect(() => {
    if (charCount >= currentFullPage.length) return;
    const timer = window.setTimeout(() => {
      setCharCount((prev) => {
        const next = prev + 2;
        if (next % 6 === 0) {
          soundEngine.playTextTick();
        }
        return Math.min(currentFullPage.length, next);
      });
    }, 22);
    return () => clearTimeout(timer);
  }, [charCount, currentFullPage]);

  const handleAdvance = useCallback(() => {
    // 1. Si el typewriter sigue escribiendo el bloque actual, completarlo de inmediato
    if (isTyping) {
      soundEngine.playConfirm();
      setCharCount(currentFullPage.length);
      return;
    }

    // 2. Si hay más páginas en el mismo diálogo, limpiar y reproducir la siguiente página
    if (!isLastPage) {
      soundEngine.playConfirm();
      setPageIndex((prev) => prev + 1);
      setCharCount(0);
      return;
    }

    // 3. Cerrar únicamente al avanzar tras la última página
    if (!dialogue.sensorCompletion) {
      soundEngine.playConfirm();
    }
    onFinishDialogue(dialogue);
  }, [currentFullPage.length, dialogue, isLastPage, isTyping, onFinishDialogue]);

  // Integrar Enter y Espacio para completar/paginar/cerrar el diálogo
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        handleAdvance();
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [handleAdvance]);

  return (
    <div
      className="font-sans pointer-events-auto fixed inset-0 z-30 flex items-end justify-center bg-black/45 px-3 pb-4 pt-12 sm:px-6 sm:pb-7"
      onClick={handleAdvance}
    >
      <div className="dialogue-folder-shell relative">
        {/* Retrato del personaje posicionado DETRÁS (z-10) emergiendo por la izquierda */}
        {portraitSrc && !imgFailed && (
          <div
            key={portraitSrc}
            className="dialogue-portrait-stage animate-portrait-emerge pointer-events-none absolute left-1.5 sm:left-5 bottom-[calc(100%-3.5rem)] sm:bottom-[calc(100%-4.25rem)] z-10 w-[clamp(10rem,44vw,14rem)] sm:w-[clamp(13rem,28vw,16.5rem)] h-[clamp(14.5rem,44vh,19.5rem)] sm:h-[clamp(18.5rem,50vh,23.5rem)] flex items-end justify-center overflow-visible"
          >
            <div
              aria-hidden="true"
              className="dialogue-portrait-backdrop absolute inset-x-1 top-2 bottom-3 rounded-full"
            />
            <img
              src={portraitSrc}
              alt={dialogue.speakerName}
              decoding="async"
              draggable={false}
              onError={() => setImgFailed(true)}
              className="dialogue-portrait-img relative select-none"
            />
          </div>
        )}

        {/* Contenedor Text Box estilo Carpeta Nocturna (basado en imagen de referencia) */}
        <div className="animate-folder-box-enter relative z-20 drop-shadow-[0_18px_38px_rgba(0,0,0,0.82)]">
          {/* Fila superior: Pestaña integrada + curva suave descendente + borde superior derecho */}
          <div className="flex items-stretch h-9 sm:h-11">
            {/* Pestaña superior izquierda con nombre del hablante */}
            <div className="dialogue-folder-tab min-w-[164px] sm:min-w-[228px] max-w-[70%] pl-5 pr-3 sm:pl-7 sm:pr-4 flex items-center">
              <h2 className="hud-text-contrast text-sm sm:text-base font-semibold tracking-wide text-[#bae6fd] whitespace-nowrap truncate">
                {dialogue.speakerName}
              </h2>
            </div>

            {/* Curva S suave unida sin costuras al borde superior derecho */}
            <svg
              viewBox="0 0 52 44"
              aria-hidden="true"
              className="dialogue-folder-curve w-11 sm:w-[52px] h-full shrink-0 block"
              preserveAspectRatio="none"
            >
              <path
                d="M 0,0.5 C 20,0.5 26,43.5 52,43.5 L 52,44 L 0,44 Z"
                fill="rgba(8, 12, 22, 0.92)"
              />
              <path
                d="M 0,0.5 C 20,0.5 26,43.5 52,43.5"
                fill="none"
                stroke="rgba(125, 211, 252, 0.45)"
                strokeWidth="1.2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {/* Extensión derecha del borde superior del cuerpo principal */}
            <div
              aria-hidden="true"
              className="flex-1 border-b border-[rgba(125,211,252,0.45)]"
            />
          </div>

          {/* Cuerpo rectangular con tamaño estricto constante + doble filete interior */}
          <div className="dialogue-folder-body p-[8px] sm:p-[10px]">
            <div
              role="button"
              tabIndex={0}
              data-no-confirm-sfx="true"
              aria-label={
                isTyping
                  ? 'Completar texto del diálogo'
                  : isLastPage
                  ? 'Cerrar diálogo'
                  : 'Siguiente página de diálogo'
              }
              onClick={(e) => {
                e.stopPropagation();
                handleAdvance();
              }}
              className="dialogue-textbox-fixed dialogue-textbox-inner-frame"
            >
              {/* Doble filete luminoso en esquina superior derecha e inferior izquierda */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-[4px] right-[4px] h-[1.5px] w-14 bg-gradient-to-l from-[#e0f2fe] via-[#bae6fd]/75 to-transparent shadow-[0_0_8px_rgba(125,211,252,0.55)]"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-[4px] right-[4px] w-[1.5px] h-10 bg-gradient-to-b from-[#e0f2fe] via-[#bae6fd]/75 to-transparent shadow-[0_0_8px_rgba(125,211,252,0.55)]"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-[4px] left-[4px] h-[1.5px] w-14 bg-gradient-to-r from-[#e0f2fe] via-[#bae6fd]/75 to-transparent shadow-[0_0_8px_rgba(125,211,252,0.55)]"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-[4px] left-[4px] w-[1.5px] h-10 bg-gradient-to-t from-[#e0f2fe] via-[#bae6fd]/75 to-transparent shadow-[0_0_8px_rgba(125,211,252,0.55)]"
              />

              {/* Texto paginado (<= 180 caracteres) */}
              <p className="dialogue-textbox-copy">
                {currentFullPage.slice(0, charCount)}
              </p>

              {/* Indicador visual en esquina inferior derecha: ▾ animada o ▪ final */}
              <span
                aria-hidden="true"
                className={`dialogue-advance-indicator ${
                  isLastPage ? 'is-end' : 'is-next'
                } ${isTyping ? 'is-typing' : 'is-ready'}`}
              >
                {isLastPage ? '▪' : '▾'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
