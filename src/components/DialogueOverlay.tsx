import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
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

  const currentFullLine = dialogue.lines[lineIndex] || '';
  const isTyping = charCount < currentFullLine.length;
  const isLastLine = lineIndex >= dialogue.lines.length - 1;

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
        {/* Retrato del personaje posicionado DETRÁS (z-10) emergiendo sobre la solapa izquierda */}
        {dialogue.portraitUrl && !imgFailed && (
          <div
            key={dialogue.portraitUrl}
            className="animate-portrait-emerge pointer-events-none absolute left-2 sm:left-6 bottom-[54%] sm:bottom-[52%] z-10 h-56 w-40 sm:h-72 sm:w-52 max-h-[46vh] flex items-end justify-center"
          >
            {/* Halo atmosférico suave para contrastar las líneas de tinta sobre fondos 3D oscuros */}
            <div
              aria-hidden="true"
              className="absolute inset-x-2 top-3 bottom-4 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(250,246,238,0.92)_0%,rgba(250,246,238,0.62)_48%,rgba(250,246,238,0)_76%)] blur-md"
            />
            <img
              src={dialogue.portraitUrl}
              alt={dialogue.speakerName}
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="relative h-full w-full object-contain object-bottom [filter:drop-shadow(0_0_2px_rgba(250,246,238,0.98))_drop-shadow(0_0_6px_rgba(250,246,238,0.88))_drop-shadow(0_10px_20px_rgba(0,0,0,0.45))]"
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
