import React, { useEffect, useRef } from 'react';

interface PolaroidPhotoCardProps {
  /** Progreso del revelado químico de 0 (oscuro/neblinoso) a 1 (foto revelada) */
  revealProgress: number;
  className?: string;
}

/**
 * Dibuja una sola vez la fotografía Polaroid perturbadora y granulada de un candado
 * japonés antiguo de anillos/espiral sobre un escritorio oscuro iluminado por flash.
 */
function paintSpiralLockPhotograph(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const cx = w * 0.5;
  const cy = h * 0.49;

  // 1. Fondo de madera oscura del escritorio iluminado por un flash frío cenital
  const bgGrad = ctx.createRadialGradient(cx * 0.94, cy * 0.92, w * 0.04, cx, cy, w * 0.72);
  bgGrad.addColorStop(0, '#3a2c22');
  bgGrad.addColorStop(0.36, '#1f1712');
  bgGrad.addColorStop(0.75, '#0e0b0a');
  bgGrad.addColorStop(1, '#040406');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Vetas horizontales sutiles de la mesa de madera
  ctx.save();
  for (let y = 0; y < h; y += 6) {
    const alpha = 0.03 + ((y * 17) % 7) * 0.008;
    ctx.strokeStyle = `rgba(12, 8, 6, ${alpha})`;
    ctx.lineWidth = 1 + (y % 3 === 0 ? 1 : 0);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(w * 0.35, y + Math.sin(y * 0.14) * 3, w * 0.7, y - Math.cos(y * 0.11) * 3, w, y + 1);
    ctx.stroke();
  }
  ctx.restore();

  // 2. Silueta oscura de la caja lacada bajo el candado
  ctx.save();
  ctx.fillStyle = 'rgba(18, 8, 8, 0.92)';
  ctx.strokeStyle = 'rgba(130, 98, 72, 0.35)';
  ctx.lineWidth = 2;
  const boxW = w * 0.78;
  const boxH = h * 0.64;
  ctx.beginPath();
  ctx.roundRect(cx - boxW / 2, cy - boxH / 2 + 6, boxW, boxH, 10);
  ctx.fill();
  ctx.stroke();

  // Sombra profunda debajo del candado circular
  const dropShadow = ctx.createRadialGradient(cx + 6, cy + 12, w * 0.14, cx + 6, cy + 12, w * 0.41);
  dropShadow.addColorStop(0, 'rgba(0, 0, 0, 0.92)');
  dropShadow.addColorStop(0.78, 'rgba(0, 0, 0, 0.58)');
  dropShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = dropShadow;
  ctx.beginPath();
  ctx.arc(cx + 6, cy + 12, w * 0.41, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 3. Candado antiguo japonés de anillos concéntricos en espiral (4 anillos + muescas desalineadas)
  const rings = [
    { rOuter: w * 0.32, rInner: w * 0.255, base: '#594538', highlight: '#8c6f56', notchAngle: -0.95 },
    { rOuter: w * 0.248, rInner: w * 0.19, base: '#3d2c22', highlight: '#6c503c', notchAngle: 1.4 },
    { rOuter: w * 0.183, rInner: w * 0.128, base: '#695333', highlight: '#9c7c4e', notchAngle: -2.1 },
    { rOuter: w * 0.121, rInner: w * 0.068, base: '#33363b', highlight: '#6b727d', notchAngle: 0.72 },
  ];

  // Canal superior fijo (muesca maestra arriba)
  ctx.save();
  ctx.fillStyle = '#070607';
  ctx.fillRect(cx - 10, cy - w * 0.355, 20, w * 0.06);
  ctx.strokeStyle = 'rgba(186, 165, 130, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - 10, cy - w * 0.355, 20, w * 0.06);
  ctx.restore();

  rings.forEach((ring, idx) => {
    ctx.save();
    // Aro principal con degradado metálico/madera oxidada
    const rGrad = ctx.createLinearGradient(
      cx - ring.rOuter,
      cy - ring.rOuter,
      cx + ring.rOuter,
      cy + ring.rOuter
    );
    rGrad.addColorStop(0, ring.highlight);
    rGrad.addColorStop(0.5, ring.base);
    rGrad.addColorStop(1, '#151210');

    ctx.beginPath();
    ctx.arc(cx, cy, ring.rOuter, 0, Math.PI * 2);
    ctx.arc(cx, cy, ring.rInner, 0, Math.PI * 2, true);
    ctx.fillStyle = rGrad;
    ctx.fill();

    // Borde oscuro entre anillos + reflejo de flash en borde superior izquierdo
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.88)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy, ring.rOuter, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(240, 232, 212, 0.24)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, ring.rOuter - 1.5, Math.PI * 0.9, Math.PI * 1.65);
    ctx.stroke();

    // Marcas grabadas en espiral sobre cada anillo
    const ticks = 12;
    for (let t = 0; t < ticks; t++) {
      const a = (t / ticks) * Math.PI * 2 + idx * 0.14;
      const rA = ring.rInner + 3;
      const rB = ring.rOuter - 3;
      ctx.strokeStyle = 'rgba(10, 8, 7, 0.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * rA, cy + Math.sin(a) * rA);
      ctx.lineTo(cx + Math.cos(a + 0.04) * rB, cy + Math.sin(a + 0.04) * rB);
      ctx.stroke();
    }

    // Muesca ranurada visible de cada anillo (la que debe alinearse en el candado)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ring.notchAngle);
    const notchW = 14 - idx * 1.4;
    const notchH = ring.rOuter - ring.rInner + 4;
    ctx.fillStyle = '#070606';
    ctx.fillRect(-notchW / 2, -ring.rOuter - 1, notchW, notchH);
    ctx.strokeStyle = 'rgba(214, 198, 165, 0.38)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-notchW / 2, -ring.rOuter - 1, notchW, notchH);
    ctx.restore();

    ctx.restore();
  });

  // Núcleo central y pestillo trabado
  ctx.save();
  const coreGrad = ctx.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, w * 0.068);
  coreGrad.addColorStop(0, '#6e6459');
  coreGrad.addColorStop(0.6, '#2a2420');
  coreGrad.addColorStop(1, '#090808');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.068, 0, Math.PI * 2);
  ctx.fill();

  // Espiral grabada al centro
  ctx.strokeStyle = 'rgba(220, 206, 178, 0.45)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (let s = 0; s < 40; s++) {
    const t = s / 40;
    const ang = t * Math.PI * 4.5;
    const rad = t * (w * 0.045);
    const sx = cx + Math.cos(ang) * rad;
    const sy = cy + Math.sin(ang) * rad;
    if (s === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  // Pestillo vertical superior encajado
  ctx.fillStyle = '#4e473f';
  ctx.strokeStyle = '#090808';
  ctx.lineWidth = 1.6;
  ctx.fillRect(cx - 7, cy - w * 0.355, 14, w * 0.085);
  ctx.strokeRect(cx - 7, cy - w * 0.355, 14, w * 0.085);
  ctx.restore();

  // 4. Destello irregular del flash analógico y rasguños finos de película
  ctx.save();
  const flashSpot = ctx.createRadialGradient(w * 0.34, h * 0.3, 4, w * 0.34, h * 0.3, w * 0.34);
  flashSpot.addColorStop(0, 'rgba(255, 248, 232, 0.24)');
  flashSpot.addColorStop(0.45, 'rgba(224, 242, 254, 0.06)');
  flashSpot.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = flashSpot;
  ctx.fillRect(0, 0, w, h);

  // Grano analógico de alta frecuencia
  const imgData = ctx.getImageData(0, 0, w, h);
  const pixels = imgData.data;
  let seed = 404913;
  for (let i = 0; i < pixels.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const grain = ((seed & 0xff) / 255 - 0.5) * 34;
    // Ligero viraje frío / verdoso típico de película instantánea envejecida
    pixels[i] = Math.max(0, Math.min(255, pixels[i] + grain - 4));
    pixels[i + 1] = Math.max(0, Math.min(255, pixels[i + 1] + grain + 3));
    pixels[i + 2] = Math.max(0, Math.min(255, pixels[i + 2] + grain + 5));
  }
  ctx.putImageData(imgData, 0, 0);

  // Viñeta fuerte de bordes quemados de Polaroid
  const vignette = ctx.createRadialGradient(cx, cy, w * 0.28, cx, cy, w * 0.72);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(0.72, 'rgba(3, 5, 10, 0.35)');
  vignette.addColorStop(1, 'rgba(2, 3, 6, 0.88)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export const PolaroidPhotoCard: React.FC<PolaroidPhotoCardProps> = ({
  revealProgress,
  className = '',
}) => {
  const photoCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = photoCanvasRef.current;
    if (!canvas) return;
    paintSpiralLockPhotograph(canvas);
  }, []);

  const clamped = Math.max(0, Math.min(1, revealProgress));
  // Curva química progresiva: arranca en emulsión oscura/neblinosa y aclara al final
  const imageOpacity = Math.pow(clamped, 1.35);
  const hazeOpacity = Math.max(0, 1 - clamped * 1.15);
  const contrastPct = 70 + clamped * 46;
  const brightnessPct = 28 + clamped * 82;
  const sepiaPct = 55 * (1 - clamped * 0.65);

  return (
    <div
      className={`relative select-none rounded-[4px] bg-gradient-to-b from-[#efece3] via-[#e5e0d4] to-[#d5cfc0] p-2.5 pb-7 sm:p-3 sm:pb-9 shadow-[0_24px_55px_rgba(0,0,0,0.92),0_0_26px_rgba(125,211,252,0.14)] border border-white/60 ${className}`}
    >
      {/* Cuadro fotográfico interno con borde rehundido */}
      <div className="relative aspect-square w-full overflow-hidden bg-[#06070a] shadow-[inset_0_2px_10px_rgba(0,0,0,0.95)] border border-black/40">
        <canvas
          ref={photoCanvasRef}
          width={360}
          height={360}
          aria-label="Fotografía instantánea de un candado antiguo de anillos en espiral"
          style={{
            opacity: imageOpacity,
            filter: `contrast(${contrastPct.toFixed(0)}%) brightness(${brightnessPct.toFixed(0)}%) sepia(${sepiaPct.toFixed(0)}%)`,
          }}
          className="block h-full w-full object-cover transition-opacity duration-150"
        />

        {/* Capa de emulsión oscura / neblinosa inicial que se disipa durante el revelado */}
        <div
          aria-hidden="true"
          style={{ opacity: hazeOpacity }}
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_45%_40%,rgba(28,38,48,0.82),rgba(5,7,12,0.98))]"
        />

        {/* Reflejo diagonal sutil de papel fotográfico brillante */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/25"
        />
      </div>

      {/* Franja inferior de la Polaroid */}
      <div className="mt-2.5 flex items-center justify-between px-1 text-[11px] font-mono-tech tracking-[0.14em] text-[#3a362e]/85">
        <span>{clamped < 0.98 ? 'REVELANDO...' : 'SALA DE PROFESORES · 2F'}</span>
        <span>{clamped < 0.98 ? `${Math.round(clamped * 100)}%` : '¿...404?'}</span>
      </div>
    </div>
  );
};
