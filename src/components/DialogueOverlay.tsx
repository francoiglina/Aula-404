import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  preloadCharacterPortraits,
  resolveCharacterPortrait,
} from '../data/characterPortraits';
import { soundEngine } from '../services/soundEngine';
import { DialoguePayload } from '../types';

interface DialogueOverlayProps {
  dialogue: DialoguePayload;
  onFinishDialogue: (dialogue: DialoguePayload) => void;
  onClose?: () => void;
}

export const DialogueOverlay: React.FC<DialogueOverlayProps> = ({
  dialogue,
  onFinishDialogue,
}) => {
  const [lineIndex, setLineIndex] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);

  const portraitSrc = resolveCharacterPortrait(
    dialogue.characterId ?? dialogue.markerId,
    dialogue.portraitUrl
  );

  const currentFullLine = dialogue.lines[lineIndex] || '';
  const isTyping = charCount < currentFullLine.length;
  const isLastLine = lineIndex >= dialogue.lines.length - 1;

  useEffect(() => {
    preloadCharacterPortraits();
  }, []);

  useEffect(() => {
    setLineIndex(0);
    setCharCount(0);
    setImgFailed(false);
  }, [dialogue]);

  useEffect(() => {
    if (charCount >= currentFullLine.length) return;
    const timer = window.setTimeout(() => {
      setCharCount((prev) => {
        const next = prev + 2;
        if (next % 6 === 0) {
          soundEngine.playTextTick();
        }
        return Math.min(currentFullLine.length, next);
      });
    }, 22);
    return () => clearTimeout(timer);
  }, [charCount, currentFullLine]);

  const handleAdvance = () => {
    if (isTyping) {
      soundEngine.playConfirm();
      setCharCount(currentFullLine.length);
      return;
    }
    if (!isLastLine) {
      soundEngine.playConfirm();
      setLineIndex((prev) => prev + 1);
      setCharCount(0);
    } else {
      if (!dialogue.sensorCompletion) {
        soundEngine.playConfirm();
      }
      onFinishDialogue(dialogue);
    }
  };

  return (
    <div className="font-sans pointer-events-auto fixed inset-0 z-30 flex items-end justify-center bg-black/45 px-3 pb-4 pt-12 sm:px-6 sm:pb-7">
      <div className="relative w-full max-w-3xl">
        {/* Retrato del personaje posicionado DETRÁS (z-10) emergiendo sobre la solapa izquierda sin distorsión */}
        {portraitSrc && !imgFailed && (
          <div
            key={portraitSrc}
            className="dialogue-portrait-stage animate-portrait-emerge pointer-events-none absolute left-1.5 sm:left-5 bottom-[calc(100%-4.25rem)] sm:bottom-[calc(100%-5rem)] z-10 w-[clamp(10rem,44vw,14rem)] sm:w-[clamp(13rem,28vw,16.5rem)] h-[clamp(14.5rem,44vh,19.5rem)] sm:h-[clamp(18.5rem,50vh,23.5rem)] flex items-end justify-center overflow-visible"
          >
            {/* Resplandor radial uniforme sin blur costoso para contrastar siluetas oscuras y transparencias en móvil */}
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

        {/* Contenedor Text Box estilo Carpeta / Pestaña (z-20 por delante del retrato) */}
        <div className="animate-folder-box-enter relative z-20 drop-shadow-[0_18px_38px_rgba(0,0,0,0.62)]">
          {/* Solapa superior izquierda elevada con el nombre del personaje */}
          <div className="relative z-10 -mb-px flex items-end">
            <div className="h-9 sm:h-11 min-w-[164px] sm:min-w-[228px] max-w-[74%] rounded-tl-[24px] sm:rounded-tl-[28px] bg-[#48484b] pl-5 pr-3 sm:pl-7 sm:pr-4 flex items-center">
              <h2 className="text-sm sm:text-base font-bold tracking-tight text-stone-100 whitespace-nowrap truncate">
                {dialogue.speakerName}
              </h2>
            </div>

            {/* Curva en S continua que une la solapa con el cuerpo rectangular */}
            <svg
              viewBox="0 0 52 44"
              aria-hidden="true"
              className="h-9 sm:h-11 w-11 sm:w-[52px] -ml-px shrink-0 block text-[#48484b]"
              preserveAspectRatio="none"
            >
              <path d="M 0,0 C 20,0 26,44 52,44 L 0,44 Z" fill="currentColor" />
            </svg>
          </div>

          {/* Cuerpo rectangular gris oscuro con borde interior muy fino */}
          <div className="rounded-tr-[7px] rounded-b-[7px] bg-[#48484b] p-[8px] sm:p-[10px]">
            <div
              onClick={handleAdvance}
              className="relative border border-white/85 px-5 py-4 sm:px-7 sm:py-5 min-h-[136px] sm:min-h-[154px] flex flex-col justify-between cursor-pointer"
            >
              {/* Acento interior fino esquina superior derecha (fiel a la referencia) */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-[5px] right-[5px] h-px w-12 bg-gradient-to-l from-white/75 to-transparent"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-[5px] right-[5px] w-px h-9 bg-gradient-to-b from-white/75 to-transparent"
              />

              {/* Acento interior fino esquina inferior izquierda (fiel a la referencia) */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-[5px] left-[5px] h-px w-12 bg-gradient-to-r from-white/75 to-transparent"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-[5px] left-[5px] w-px h-9 bg-gradient-to-t from-white/75 to-transparent"
              />

              {/* Texto del diálogo */}
              <p className="text-sm sm:text-base font-normal leading-relaxed text-stone-100 pr-1">
                {currentFullLine.slice(0, charCount)}
              </p>

              {/* Botón único de Siguiente / avanzar */}
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  data-no-confirm-sfx="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAdvance();
                  }}
                  className="min-h-[40px] rounded-[5px] border border-white/80 bg-white/10 px-4 py-1.5 text-xs sm:text-sm font-semibold text-white hover:bg-white/20 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <span>Siguiente</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
