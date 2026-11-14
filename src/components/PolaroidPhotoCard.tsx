import React from 'react';

interface PolaroidPhotoCardProps {
  /** Progreso del revelado químico de 0 (oscuro/borroso) a 1 (foto revelada al 100%) */
  revealProgress: number;
  className?: string;
}

export const PolaroidPhotoCard: React.FC<PolaroidPhotoCardProps> = ({
  revealProgress,
  className = '',
}) => {
  const clamped = Math.max(0, Math.min(1, revealProgress));
  // Interpolación determinista solicitada:
  // opacity: 0 -> 1
  // filter: brightness(0) blur(6px) -> brightness(1) blur(0px)
  const imageOpacity = clamped;
  const brightness = clamped;
  const blurPx = (1 - clamped) * 6;
  const hazeOpacity = Math.max(0, 1 - clamped * 1.15);

  return (
    <div
      className={`relative select-none rounded-[4px] bg-gradient-to-b from-[#efece3] via-[#e5e0d4] to-[#d5cfc0] p-2.5 pb-7 sm:p-3 sm:pb-9 shadow-[0_24px_55px_rgba(0,0,0,0.92),0_0_26px_rgba(125,211,252,0.14)] border border-white/60 ${className}`}
    >
      {/* Cuadro fotográfico interno con borde rehundido */}
      <div className="relative aspect-square w-full overflow-hidden bg-[#050608] shadow-[inset_0_2px_10px_rgba(0,0,0,0.95)] border border-black/40">
        {/* Imagen vectorial embebida de alta nitidez pre-renderizada (sin dependencias externas) */}
        <svg
          viewBox="0 0 360 360"
          role="img"
          aria-label="Fotografía instantánea de un candado antiguo de anillos en espiral"
          style={{
            opacity: imageOpacity,
            filter: `brightness(${brightness.toFixed(3)}) blur(${blurPx.toFixed(2)}px)`,
          }}
          className="block h-full w-full"
        >
          <defs>
            <radialGradient id="polaroidFlashBg" cx="46%" cy="44%" r="64%">
              <stop offset="0%" stopColor="#433226" />
              <stop offset="38%" stopColor="#231914" />
              <stop offset="76%" stopColor="#100c0b" />
              <stop offset="100%" stopColor="#040406" />
            </radialGradient>

            <radialGradient id="polaroidLockShadow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#000000" stopOpacity="0.95" />
              <stop offset="75%" stopColor="#000000" stopOpacity="0.62" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>

            <linearGradient id="polaroidRingOuter" x1="12%" y1="8%" x2="88%" y2="92%">
              <stop offset="0%" stopColor="#94765b" />
              <stop offset="48%" stopColor="#564234" />
              <stop offset="100%" stopColor="#1c1512" />
            </linearGradient>

            <linearGradient id="polaroidRingWood" x1="15%" y1="10%" x2="85%" y2="90%">
              <stop offset="0%" stopColor="#77543b" />
              <stop offset="52%" stopColor="#422c1f" />
              <stop offset="100%" stopColor="#19110c" />
            </linearGradient>

            <linearGradient id="polaroidRingBrass" x1="10%" y1="12%" x2="90%" y2="88%">
              <stop offset="0%" stopColor="#af8c58" />
              <stop offset="50%" stopColor="#69512e" />
              <stop offset="100%" stopColor="#261c0f" />
            </linearGradient>

            <linearGradient id="polaroidRingSteel" x1="12%" y1="12%" x2="88%" y2="88%">
              <stop offset="0%" stopColor="#747d88" />
              <stop offset="52%" stopColor="#3c4148" />
              <stop offset="100%" stopColor="#16181c" />
            </linearGradient>

            <radialGradient id="polaroidFlashGlow" cx="35%" cy="32%" r="48%">
              <stop offset="0%" stopColor="#fff7e2" stopOpacity="0.26" />
              <stop offset="45%" stopColor="#e0f2fe" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="polaroidVignette" cx="50%" cy="50%" r="65%">
              <stop offset="48%" stopColor="#000000" stopOpacity="0" />
              <stop offset="82%" stopColor="#04070c" stopOpacity="0.46" />
              <stop offset="100%" stopColor="#020306" stopOpacity="0.9" />
            </radialGradient>

            <filter id="polaroidFilmGrain" x="0%" y="0%" width="100%" height="100%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.82"
                numOctaves="2"
                seed="404"
                result="noise"
              />
              <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
              <feComponentTransfer in="grayNoise" result="softNoise">
                <feFuncA type="linear" slope="0.14" />
              </feComponentTransfer>
              <feBlend mode="overlay" in="SourceGraphic" in2="softNoise" />
            </filter>
          </defs>

          <g filter="url(#polaroidFilmGrain)">
            {/* Mesa de madera iluminada por flash */}
            <rect x="0" y="0" width="360" height="360" fill="url(#polaroidFlashBg)" />

            {/* Vetas horizontales sutiles de la madera */}
            {Array.from({ length: 16 }).map((_, idx) => {
              const y = 14 + idx * 22;
              return (
                <path
                  key={idx}
                  d={`M 0 ${y} Q 110 ${y + (idx % 2 === 0 ? 4 : -4)}, 220 ${y} T 360 ${y + 1}`}
                  fill="none"
                  stroke="rgba(10, 6, 4, 0.34)"
                  strokeWidth={idx % 3 === 0 ? '2' : '1.2'}
                />
              );
            })}

            {/* Caja de madera lacada bajo el candado */}
            <rect
              x="40"
              y="68"
              width="280"
              height="232"
              rx="10"
              fill="rgba(20, 9, 8, 0.94)"
              stroke="rgba(140, 106, 78, 0.42)"
              strokeWidth="2"
            />
            <rect
              x="48"
              y="76"
              width="264"
              height="216"
              rx="6"
              fill="none"
              stroke="rgba(0, 0, 0, 0.65)"
              strokeWidth="2"
            />

            {/* Sombra dura proyectada por el flash */}
            <circle cx="187" cy="190" r="134" fill="url(#polaroidLockShadow)" />

            {/* Canal guía superior del candado */}
            <rect
              x="169"
              y="52"
              width="22"
              height="24"
              rx="2"
              fill="#070606"
              stroke="rgba(198, 174, 134, 0.55)"
              strokeWidth="1.6"
            />

            {/* Anillo 1: Hierro oxidado exterior */}
            <g transform="translate(180 180) rotate(-52)">
              <circle
                cx="0"
                cy="0"
                r="104"
                fill="none"
                stroke="url(#polaroidRingOuter)"
                strokeWidth="23"
              />
              <circle cx="0" cy="0" r="115.5" fill="none" stroke="#080605" strokeWidth="2.2" />
              <circle cx="0" cy="0" r="92.5" fill="none" stroke="#080605" strokeWidth="2.2" />
              {Array.from({ length: 12 }).map((_, i) => {
                const a = (i / 12) * Math.PI * 2;
                return (
                  <line
                    key={i}
                    x1={Math.cos(a) * 94}
                    y1={Math.sin(a) * 94}
                    x2={Math.cos(a + 0.06) * 114}
                    y2={Math.sin(a + 0.06) * 114}
                    stroke="rgba(10, 7, 6, 0.6)"
                    strokeWidth="1.5"
                  />
                );
              })}
              <rect
                x="-7"
                y="-116"
                width="14"
                height="24"
                rx="1.5"
                fill="#060505"
                stroke="rgba(218, 200, 165, 0.45)"
                strokeWidth="1.2"
              />
            </g>

            {/* Anillo 2: Cedro oscuro */}
            <g transform="translate(180 180) rotate(78)">
              <circle
                cx="0"
                cy="0"
                r="79.5"
                fill="none"
                stroke="url(#polaroidRingWood)"
                strokeWidth="21"
              />
              <circle cx="0" cy="0" r="90" fill="none" stroke="#080605" strokeWidth="2" />
              <circle cx="0" cy="0" r="69" fill="none" stroke="#080605" strokeWidth="2" />
              {Array.from({ length: 12 }).map((_, i) => {
                const a = (i / 12) * Math.PI * 2;
                return (
                  <line
                    key={i}
                    x1={Math.cos(a) * 70}
                    y1={Math.sin(a) * 70}
                    x2={Math.cos(a + 0.06) * 89}
                    y2={Math.sin(a + 0.06) * 89}
                    stroke="rgba(10, 7, 6, 0.6)"
                    strokeWidth="1.4"
                  />
                );
              })}
              <rect
                x="-6.5"
                y="-90.5"
                width="13"
                height="22"
                rx="1.5"
                fill="#060505"
                stroke="rgba(218, 200, 165, 0.42)"
                strokeWidth="1.2"
              />
            </g>

            {/* Anillo 3: Bronce envejecido */}
            <g transform="translate(180 180) rotate(-126)">
              <circle
                cx="0"
                cy="0"
                r="57"
                fill="none"
                stroke="url(#polaroidRingBrass)"
                strokeWidth="20"
              />
              <circle cx="0" cy="0" r="67" fill="none" stroke="#080605" strokeWidth="2" />
              <circle cx="0" cy="0" r="47" fill="none" stroke="#080605" strokeWidth="2" />
              {Array.from({ length: 10 }).map((_, i) => {
                const a = (i / 10) * Math.PI * 2;
                return (
                  <line
                    key={i}
                    x1={Math.cos(a) * 48}
                    y1={Math.sin(a) * 48}
                    x2={Math.cos(a + 0.07) * 66}
                    y2={Math.sin(a + 0.07) * 66}
                    stroke="rgba(10, 7, 6, 0.58)"
                    strokeWidth="1.3"
                  />
                );
              })}
              <rect
                x="-6"
                y="-67.5"
                width="12"
                height="21"
                rx="1.5"
                fill="#060505"
                stroke="rgba(226, 205, 168, 0.48)"
                strokeWidth="1.2"
              />
            </g>

            {/* Anillo 4: Núcleo de acero */}
            <g transform="translate(180 180) rotate(38)">
              <circle
                cx="0"
                cy="0"
                r="35.5"
                fill="none"
                stroke="url(#polaroidRingSteel)"
                strokeWidth="19"
              />
              <circle cx="0" cy="0" r="45" fill="none" stroke="#080605" strokeWidth="2" />
              <circle cx="0" cy="0" r="26" fill="none" stroke="#080605" strokeWidth="2" />
              <rect
                x="-5.5"
                y="-45.5"
                width="11"
                height="20"
                rx="1.5"
                fill="#060505"
                stroke="rgba(226, 232, 240, 0.45)"
                strokeWidth="1.1"
              />
            </g>

            {/* Núcleo central con espiral karakuri grabada */}
            <circle cx="180" cy="180" r="24" fill="#181513" stroke="#6e5a49" strokeWidth="1.8" />
            <path
              d="M 180,180 C 184,176 189,179 189,184 C 189,190 179,194 173,190 C 166,185 167,173 175,168 C 185,162 197,169 197,181"
              fill="none"
              stroke="rgba(226, 212, 184, 0.62)"
              strokeWidth="1.8"
              strokeLinecap="round"
            />

            {/* Pestillo superior trabado */}
            <rect
              x="173"
              y="52"
              width="14"
              height="30"
              rx="1.5"
              fill="#554d44"
              stroke="#0a0808"
              strokeWidth="1.6"
            />

            {/* Brillo irregular del flash + viñeta analógica */}
            <rect x="0" y="0" width="360" height="360" fill="url(#polaroidFlashGlow)" />
            <rect x="0" y="0" width="360" height="360" fill="url(#polaroidVignette)" />
          </g>
        </svg>

        {/* Capa de emulsión oscura inicial que se disipa durante los 2.5s */}
        <div
          aria-hidden="true"
          style={{ opacity: hazeOpacity }}
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_45%_40%,rgba(22,30,40,0.88),rgba(4,6,10,0.99))]"
        />

        {/* Reflejo diagonal sutil de papel fotográfico brillante */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/25"
        />
      </div>

      {/* Franja inferior de la Polaroid */}
      <div className="mt-2.5 flex items-center justify-between px-1 text-[11px] font-mono-tech tracking-[0.14em] text-[#3a362e]/85">
        <span>{clamped < 1 ? 'REVELANDO...' : 'SALA DE PROFESORES · 2F'}</span>
        <span>{clamped < 1 ? `${Math.round(clamped * 100)}%` : '¿...404?'}</span>
      </div>
    </div>
  );
};
