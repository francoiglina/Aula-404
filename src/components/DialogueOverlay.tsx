import React, { useEffect, useState } from 'react';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import { soundEngine } from '../services/soundEngine';
import { DialoguePayload } from '../types';

interface DialogueOverlayProps {
  dialogue: DialoguePayload;
  onFinishDialogue: (dialogue: DialoguePayload) => void;
  onClose: () => void;
}

export const DialogueOverlay: React.FC<DialogueOverlayProps> = ({
  dialogue,
  onFinishDialogue,
  onClose,
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
      setCharCount(currentFullLine.length);
      return;
    }
    soundEngine.playInteractTap();
    if (!isLastLine) {
      setLineIndex((prev) => prev + 1);
      setCharCount(0);
    } else {
      onFinishDialogue(dialogue);
    }
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-30 flex items-end justify-center bg-black/55 p-3 sm:p-6">
      <div className="w-full max-w-3xl rounded-3xl border border-stone-700 bg-stone-950/96 p-4 sm:p-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6">
          {/* Character Sumi-e Portrait on Warm Washi Paper (#FAF6EE) */}
          {dialogue.portraitUrl && (
            <div className="w-32 sm:w-44 shrink-0 rounded-2xl border-2 border-stone-800 bg-[#FAF6EE] p-2 shadow-lg">
              <div className="aspect-[3/4] w-full overflow-hidden rounded-xl bg-[#FAF6EE] flex items-center justify-center">
                {!imgFailed ? (
                  <img
                    src={dialogue.portraitUrl}
                    alt={dialogue.speakerName}
                    referrerPolicy="no-referrer"
                    onError={() => setImgFailed(true)}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="font-display text-lg font-bold text-stone-800 text-center px-2">
                    {dialogue.speakerName}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Dialogue Text Box */}
          <div className="flex-1 w-full flex flex-col justify-between min-h-[168px]">
            <div>
              <div className="flex items-start justify-between gap-3 border-b border-stone-800 pb-2.5">
                <div>
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-stone-50">
                    {dialogue.speakerName}
                  </h2>
                  <p className="text-xs text-amber-400 mt-0.5">{dialogue.speakerRole}</p>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar conversación"
                  className="min-h-[40px] min-w-[40px] rounded-xl border border-stone-800 bg-stone-900 text-stone-400 hover:text-stone-100 flex items-center justify-center cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div
                onClick={handleAdvance}
                className="mt-3.5 min-h-[84px] text-sm sm:text-base leading-relaxed text-stone-100 cursor-pointer"
              >
                {currentFullLine.slice(0, charCount)}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 pt-2 border-t border-stone-800/80">
              <span className="font-mono-tech text-xs text-stone-400">
                 Diálogo {lineIndex + 1} / {dialogue.lines.length}
              </span>

              <button
                type="button"
                onClick={handleAdvance}
                className="min-h-[44px] rounded-xl bg-amber-500 px-5 py-2.5 text-xs sm:text-sm font-bold text-stone-950 hover:bg-amber-400 active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                {isTyping ? (
                  <span>Mostrar texto</span>
                ) : !isLastLine ? (
                  <>
                    <span>Siguiente</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                ) : dialogue.openChallenge ? (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Usar Sensor</span>
                  </>
                ) : (
                  <span>Continuar</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
