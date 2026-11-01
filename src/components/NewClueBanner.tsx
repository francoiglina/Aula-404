import React from 'react';

interface NewClueBannerProps {
  clueText: string;
}

/**
 * Notificación central minimalista en blanco y negro (estilo J-Horror) con tipografía Inter.
 * Se despliega en sincronía con el audio de éxito al cerrar la interacción final de un sensor.
 */
export const NewClueBanner: React.FC<NewClueBannerProps> = ({ clueText }) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="font-sans pointer-events-none fixed inset-0 z-35 flex items-center justify-center px-4 sm:px-8 -translate-y-4 sm:-translate-y-6 select-none"
    >
      <div className="jhorror-clue-card relative w-full max-w-xl px-6 py-4 sm:px-9 sm:py-5 text-center">
        {/* Línea superior minimalista */}
        <div
          aria-hidden="true"
          className="jhorror-clue-rule mx-auto mb-2.5 h-px w-16 bg-white/75 origin-center"
        />

        {/* Mensaje estructurado "NUEVA PISTA: [Texto dinámico]" */}
        <p className="text-xs sm:text-sm md:text-base leading-relaxed tracking-[0.02em] text-neutral-100">
          <span className="font-bold uppercase tracking-[0.14em] text-white">
            NUEVA PISTA:
          </span>{' '}
          <span className="font-normal text-neutral-200">{clueText}</span>
        </p>

        {/* Línea inferior minimalista */}
        <div
          aria-hidden="true"
          className="jhorror-clue-rule mx-auto mt-2.5 h-px w-16 bg-white/75 origin-center"
        />
      </div>
    </div>
  );
};
