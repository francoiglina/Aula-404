import React, { useEffect, useState } from 'react';

interface ClueTickerHudProps {
  clueText: string;
}

type ClueListener = (text: string) => void;
const clueListeners = new Set<ClueListener>();
let latestImperativeClue: string | null = null;

/**
 * Actualiza dinámicamente el texto desplazable del HUD (Marquee de Pistas debajo del minimapa).
 * Puede invocarse desde cualquier módulo o controlador externo sin acoplar estado React.
 */
export function actualizarPistaHUD(nuevoTexto: string): void {
  const cleanText = nuevoTexto.trim();
  if (!cleanText) return;

  latestImperativeClue = cleanText;
  clueListeners.forEach((listener) => listener(cleanText));

  if (typeof document !== 'undefined') {
    const tickerEl = document.getElementById('hud-clue-ticker');
    if (tickerEl) {
      tickerEl.setAttribute('data-clue-text', cleanText);
      const trackSpans = tickerEl.querySelectorAll<HTMLElement>('[data-clue-track-copy]');
      trackSpans.forEach((span) => {
        span.textContent = cleanText;
      });
    }
  }
}

/**
 * Texto desplazable sin recuadro ubicado justo debajo del minimapa (esquina superior derecha).
 * Solo texto blanco continuo con doble text-shadow oscuro y máscara suave en los bordes.
 */
export const ClueTickerHud: React.FC<ClueTickerHudProps> = ({ clueText }) => {
  const [displayedText, setDisplayedText] = useState<string>(clueText);

  useEffect(() => {
    latestImperativeClue = null;
    setDisplayedText(clueText);
  }, [clueText]);

  useEffect(() => {
    if (latestImperativeClue) {
      setDisplayedText(latestImperativeClue);
    }
    const listener: ClueListener = (nextText) => {
      setDisplayedText(nextText);
    };
    clueListeners.add(listener);
    return () => {
      clueListeners.delete(listener);
    };
  }, []);

  // Desplazamiento lento y continuo proporcional a la longitud del texto
  const durationSeconds = Math.max(18, Math.min(34, Math.round(displayedText.length * 0.28)));

  return (
    <aside
      id="hud-clue-ticker"
      aria-label="Pista actual"
      data-clue-text={displayedText}
      className="hud-clue-ticker font-sans pointer-events-none w-full select-none"
    >
      <div className="hud-clue-viewport">
        <div
          key={displayedText}
          style={{ animationDuration: `${durationSeconds}s` }}
          className="hud-clue-track"
        >
          <span data-clue-track-copy="true" className="hud-clue-copy">
            {displayedText}
          </span>
          <span aria-hidden="true" className="hud-clue-separator">
            ·
          </span>
          <span
            data-clue-track-copy="true"
            aria-hidden="true"
            className="hud-clue-copy"
          >
            {displayedText}
          </span>
          <span aria-hidden="true" className="hud-clue-separator">
            ·
          </span>
        </div>
      </div>
    </aside>
  );
};
