import React from 'react';
import { SCHOOL_KANJI_TITLE, SCHOOL_SUBTITLE } from '../data/locationZones';

interface LocationNoticeProps {
  floorTitle: string;
  kanjiTitle?: string;
  schoolSubtitle?: string;
}

/**
 * Notificación central minimalista de cambio de piso en texto plano (estética J-Horror).
 * Tres niveles de jerarquía tipográfica con Inter, sin fondos, bordes ni marcos.
 */
export const LocationNotice: React.FC<LocationNoticeProps> = ({
  floorTitle,
  kanjiTitle = SCHOOL_KANJI_TITLE,
  schoolSubtitle = SCHOOL_SUBTITLE,
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="location-notice-overlay font-sans select-none"
    >
      <span lang="ja" className="location-notice-kanji">
        {kanjiTitle}
      </span>
      <span className="location-notice-subtitle">{schoolSubtitle}</span>
      <span className="location-notice-floor">{floorTitle}</span>
    </div>
  );
};
