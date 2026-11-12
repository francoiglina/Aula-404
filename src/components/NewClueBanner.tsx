import React from 'react';

interface NewClueBannerProps {
  clueText: string;
}

/**
 * Notificación central etérea minimalista (paleta nocturna cian/blanco del Title Screen).
 * Sin recuadros pesados; se despliega con líneas horizontales luminosas y bruma traslúcida.
 */
export const NewClueBanner: React.FC<NewClueBannerProps> = ({ clueText }) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="font-sans pointer-events-none fixed inset-0 z-35 flex items-center justify-center px-4 sm:px-8 -translate-y-4 sm:-translate-y-6 select-none"
    >
      <div className="jhorror-clue-ribbon relative w-full max-w-xl px-6 py-4 sm:px-10 sm:py-5 text-center">
        {/* Línea superior expansiva cian pálido */}
        <div
          aria-hidden="true"
          className="jhorror-clue-rule jhorror-clue-rule--top mx-auto mb-3 h-px w-full max-w-[16rem] origin-center"
        />

        {/* Mensaje estructurado "NUEVA PISTA: [Texto dinámico]" */}
        <p className="jhorror-clue-copy text-xs sm:text-sm md:text-base leading-relaxed tracking-[0.025em] text-white">
          <span className="jhorror-clue-prefix font-semibold uppercase tracking-[0.18em] text-[#bae6fd]">
            NUEVA PISTA:
          </span>{' '}
          <span className="font-normal text-white/95">{clueText}</span>
        </p>

        {/* Línea inferior expansiva cian pálido */}
        <div
          aria-hidden="true"
          className="jhorror-clue-rule jhorror-clue-rule--bottom mx-auto mt-3 h-px w-full max-w-[16rem] origin-center"
        />
      </div>
    </div>
  );
};
