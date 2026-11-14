import * as THREE from 'three';

function hash2d(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

export interface WoodFloorPbrMaps {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}

export interface OutdoorGroundPbrMaps {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}

/**
 * Genera textura difusa oscura de tablones japoneses envejecidos (512x512).
 * Mantiene tono nogal oscuro/carbón con vetas orgánicas y juntas pronunciadas.
 */
export function createWoodPlankTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#2b221a';
  ctx.fillRect(0, 0, 512, 512);

  const plankCount = 8;
  const plankH = 512 / plankCount;

  for (let i = 0; i < plankCount; i++) {
    const y = i * plankH;
    const toneShift = Math.floor((hash2d(i, 3) - 0.5) * 14);
    const r = 52 + toneShift;
    const g = 42 + Math.floor(toneShift * 0.82);
    const b = 33 + Math.floor(toneShift * 0.65);

    const plankGrad = ctx.createLinearGradient(0, y, 512, y + plankH);
    plankGrad.addColorStop(0, `rgb(${r}, ${g}, ${b})`);
    plankGrad.addColorStop(0.5, `rgb(${Math.max(22, r - 4)}, ${Math.max(18, g - 3)}, ${Math.max(14, b - 2)})`);
    plankGrad.addColorStop(1, `rgb(${r + 2}, ${g + 2}, ${b + 1})`);
    ctx.fillStyle = plankGrad;
    ctx.fillRect(0, y, 512, plankH - 3);

    // Sutil pátina verdosa/humedad envejecida en bordes de algunos tablones
    if (hash2d(i, 11) > 0.45) {
      ctx.fillStyle = 'rgba(34, 42, 34, 0.22)';
      ctx.fillRect(0, y + plankH * 0.62, 512, plankH * 0.34);
    }

    // Vetas longitudinales oscuras
    ctx.strokeStyle = 'rgba(18, 13, 9, 0.38)';
    ctx.lineWidth = 1.1;
    for (let gLine = 0; gLine < 12; gLine++) {
      const gy = y + 4 + (gLine / 12) * (plankH - 8);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(
        165,
        gy + Math.sin(i * 1.3 + gLine) * 2.4,
        345,
        gy - Math.cos(i * 1.1 + gLine) * 2.4,
        512,
        gy
      );
      ctx.stroke();
    }

    // Brillo sutil de desgaste central en zonas pisadas
    ctx.fillStyle = 'rgba(128, 114, 96, 0.08)';
    ctx.fillRect(0, y + plankH * 0.28, 512, plankH * 0.38);

    // Junta horizontal profunda entre tablones
    ctx.fillStyle = '#140f0b';
    ctx.fillRect(0, y + plankH - 3, 512, 3);

    // Junta vertical escalonada + clavos antiguos en los extremos
    const jointX = ((i * 173 + 90) % 440) + 36;
    ctx.fillStyle = '#120d09';
    ctx.fillRect(jointX, y, 2.5, plankH);

    ctx.fillStyle = '#0d0907';
    ctx.fillRect(jointX - 9, y + 10, 3, 3);
    ctx.fillRect(jointX - 9, y + plankH - 14, 3, 3);
    ctx.fillRect(jointX + 8, y + 10, 3, 3);
    ctx.fillRect(jointX + 8, y + plankH - 14, 3, 3);
  }

  // Micro-moteado de polvo/edad (ligero y determinista)
  for (let s = 0; s < 420; s++) {
    const sx = Math.floor(hash2d(s, 1) * 510);
    const sy = Math.floor(hash2d(s, 2) * 510);
    ctx.fillStyle = s % 2 === 0 ? 'rgba(10, 12, 10, 0.16)' : 'rgba(165, 160, 148, 0.04)';
    ctx.fillRect(sx, sy, 3, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Genera mapas PBR compartidos (512x512) para el piso de madera:
 * - map (sRGB)
 * - roughnessMap (NoColorSpace: centro del tablón semi-pulido ~0.35-0.48, juntas y desgaste ~0.72-0.88)
 * - bumpMap (NoColorSpace: juntas hundidas y relieve sutil de vetas)
 */
export function createWoodFloorPbrMaps(maxAnisotropy: number): WoodFloorPbrMaps {
  const map = createWoodPlankTexture(maxAnisotropy);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 512;
  roughCanvas.height = 512;
  const rCtx = roughCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bCtx = bumpCanvas.getContext('2d')!;

  rCtx.fillStyle = 'rgb(138, 138, 138)';
  rCtx.fillRect(0, 0, 512, 512);

  bCtx.fillStyle = 'rgb(168, 168, 168)';
  bCtx.fillRect(0, 0, 512, 512);

  const plankCount = 8;
  const plankH = 512 / plankCount;

  for (let i = 0; i < plankCount; i++) {
    const y = i * plankH;
    // Variación realista de barniz desgastado por tablón (0.38 .. 0.56)
    const baseRough = Math.floor(98 + hash2d(i, 7) * 44);
    const wornCenterRough = Math.max(82, baseRough - 20);

    const rGrad = rCtx.createLinearGradient(0, y, 0, y + plankH);
    rGrad.addColorStop(0, `rgb(${baseRough + 24}, ${baseRough + 24}, ${baseRough + 24})`);
    rGrad.addColorStop(0.5, `rgb(${wornCenterRough}, ${wornCenterRough}, ${wornCenterRough})`);
    rGrad.addColorStop(1, `rgb(${baseRough + 28}, ${baseRough + 28}, ${baseRough + 28})`);
    rCtx.fillStyle = rGrad;
    rCtx.fillRect(0, y, 512, plankH - 3);

    const baseBump = Math.floor(160 + hash2d(i, 19) * 26);
    bCtx.fillStyle = `rgb(${baseBump}, ${baseBump}, ${baseBump})`;
    bCtx.fillRect(0, y, 512, plankH - 3);

    // Vetas en roughness y bump
    for (let gLine = 0; gLine < 12; gLine++) {
      const gy = y + 4 + (gLine / 12) * (plankH - 8);
      rCtx.strokeStyle = 'rgba(190, 190, 190, 0.24)';
      rCtx.lineWidth = 1.2;
      rCtx.beginPath();
      rCtx.moveTo(0, gy);
      rCtx.bezierCurveTo(
        165,
        gy + Math.sin(i * 1.3 + gLine) * 2.4,
        345,
        gy - Math.cos(i * 1.1 + gLine) * 2.4,
        512,
        gy
      );
      rCtx.stroke();

      bCtx.strokeStyle = 'rgba(95, 95, 95, 0.35)';
      bCtx.lineWidth = 1.1;
      bCtx.beginPath();
      bCtx.moveTo(0, gy);
      bCtx.bezierCurveTo(
        165,
        gy + Math.sin(i * 1.3 + gLine) * 2.4,
        345,
        gy - Math.cos(i * 1.1 + gLine) * 2.4,
        512,
        gy
      );
      bCtx.stroke();
    }

    // Parches de polvo más mate para romper reflejos uniformes
    for (let p = 0; p < 5; p++) {
      const px = hash2d(i * 7 + p, 5) * 420;
      const pw = 45 + hash2d(i, p * 3) * 75;
      rCtx.fillStyle = 'rgba(205, 205, 205, 0.22)';
      rCtx.fillRect(px, y + 8, pw, plankH - 18);
    }

    // Ranuras de junta (muy rugosas y hundidas en bump)
    rCtx.fillStyle = 'rgb(235, 235, 235)';
    rCtx.fillRect(0, y + plankH - 3, 512, 3);
    bCtx.fillStyle = 'rgb(24, 24, 24)';
    bCtx.fillRect(0, y + plankH - 3, 512, 3);

    const jointX = ((i * 173 + 90) % 440) + 36;
    rCtx.fillRect(jointX, y, 3, plankH);
    bCtx.fillRect(jointX, y, 3, plankH);
  }

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAnisotropy;

  return { map, roughnessMap, bumpMap };
}

/**
 * Techo oscuro de tablones y listones transversales de escuela japonesa antigua (512x512).
 */
export function createCeilingPlankTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#231a13';
  ctx.fillRect(0, 0, 512, 512);

  const plankCount = 10;
  const plankH = 512 / plankCount;
  for (let i = 0; i < plankCount; i++) {
    const y = i * plankH;
    const shift = Math.floor((hash2d(i, 21) - 0.5) * 10);
    ctx.fillStyle = `rgb(${41 + shift}, ${30 + shift}, ${22 + Math.floor(shift * 0.7)})`;
    ctx.fillRect(0, y, 512, plankH - 2);

    ctx.fillStyle = '#120c08';
    ctx.fillRect(0, y + plankH - 2, 512, 2);
  }

  // Vigas/listones oscuros transversales
  ctx.fillStyle = '#19120c';
  for (let bx = 0; bx < 512; bx += 128) {
    ctx.fillRect(bx, 0, 12, 512);
    ctx.fillStyle = 'rgba(255, 236, 210, 0.04)';
    ctx.fillRect(bx + 12, 0, 3, 512);
    ctx.fillStyle = '#19120c';
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createStoneTileTexture(
  maxAnisotropy: number,
  baseHex = '#2a2c2b',
  groutHex = '#171818'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 512);

  const tiles = 4;
  const step = 512 / tiles;

  for (let row = 0; row < tiles; row++) {
    for (let col = 0; col < tiles; col++) {
      const x = col * step;
      const y = row * step;
      const shade = ((row * 3 + col * 5) % 4) * 4;
      ctx.fillStyle = `rgba(255,255,255,${0.012 * shade})`;
      ctx.fillRect(x + 3, y + 3, step - 6, step - 6);
    }
  }

  ctx.strokeStyle = groutHex;
  ctx.lineWidth = 4;
  for (let i = 0; i <= tiles; i++) {
    const pos = i * step;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, 512);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(512, pos);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Genera textura difusa compartida (512x512) de concreto/asfalto frío húmedo envejecido
 * para el patio exterior del aparcabicicletas (sin ningún tono ni veta de madera).
 */
export function createOutdoorConcreteTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = 512;
  colorCanvas.height = 512;
  const ctx = colorCanvas.getContext('2d')!;

  // Base fría gris-pizarra húmeda
  ctx.fillStyle = '#252a2c';
  ctx.fillRect(0, 0, 512, 512);

  // Losas de pavimento de cemento envejecido (4x4) con ligera variación tonal
  const tiles = 4;
  const step = 512 / tiles;
  for (let row = 0; row < tiles; row++) {
    for (let col = 0; col < tiles; col++) {
      const x = col * step;
      const y = row * step;
      const tone = Math.floor((hash2d(row * 7 + col, 13) - 0.5) * 12);
      ctx.fillStyle = `rgb(${39 + tone}, ${44 + tone}, ${46 + tone})`;
      ctx.fillRect(x + 2, y + 2, step - 4, step - 4);
    }
  }

  // Manchas de humedad / charcos suaves y leve musgo frío en esquinas
  for (let p = 0; p < 16; p++) {
    const px = hash2d(p, 41) * 512;
    const py = hash2d(p, 53) * 512;
    const pr = 26 + hash2d(p, 61) * 64;

    const dampGrad = ctx.createRadialGradient(px, py, 3, px, py, pr);
    dampGrad.addColorStop(0, p % 4 === 0 ? 'rgba(22, 30, 26, 0.34)' : 'rgba(16, 21, 24, 0.36)');
    dampGrad.addColorStop(1, 'rgba(16, 21, 24, 0)');
    ctx.fillStyle = dampGrad;
    ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  }

  // Micro-grano mineral del concreto/asfalto
  for (let g = 0; g < 1600; g++) {
    const gx = Math.floor(hash2d(g, 7) * 510);
    const gy = Math.floor(hash2d(g, 11) * 510);
    ctx.fillStyle = g % 2 === 0 ? 'rgba(12, 15, 16, 0.24)' : 'rgba(120, 132, 136, 0.08)';
    ctx.fillRect(gx, gy, 2, 2);
  }

  // Juntas de dilatación
  ctx.strokeStyle = '#141819';
  ctx.lineWidth = 3;
  for (let i = 0; i <= tiles; i++) {
    const pos = i * step;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(512, pos);
    ctx.stroke();
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = maxAnisotropy;
  return map;
}

/**
 * Genera mapas PBR compartidos (512x512) de concreto/asfalto frío húmedo envejecido
 * para el patio exterior del aparcabicicletas (sin ningún tono ni veta de madera).
 */
export function createOutdoorConcretePbrMaps(maxAnisotropy: number): OutdoorGroundPbrMaps {
  const map = createOutdoorConcreteTexture(maxAnisotropy);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 512;
  roughCanvas.height = 512;
  const rCtx = roughCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bCtx = bumpCanvas.getContext('2d')!;

  rCtx.fillStyle = 'rgb(214, 214, 214)';
  rCtx.fillRect(0, 0, 512, 512);

  bCtx.fillStyle = 'rgb(142, 142, 142)';
  bCtx.fillRect(0, 0, 512, 512);

  const tiles = 4;
  const step = 512 / tiles;
  for (let row = 0; row < tiles; row++) {
    for (let col = 0; col < tiles; col++) {
      const x = col * step;
      const y = row * step;
      const roughTile = Math.floor(196 + hash2d(col * 5 + row, 29) * 32);
      rCtx.fillStyle = `rgb(${roughTile}, ${roughTile}, ${roughTile})`;
      rCtx.fillRect(x + 2, y + 2, step - 4, step - 4);
    }
  }

  for (let p = 0; p < 16; p++) {
    const px = hash2d(p, 41) * 512;
    const py = hash2d(p, 53) * 512;
    const pr = 26 + hash2d(p, 61) * 64;
    const rGrad = rCtx.createRadialGradient(px, py, 2, px, py, pr * 0.85);
    rGrad.addColorStop(0, 'rgba(92, 92, 92, 0.72)');
    rGrad.addColorStop(1, 'rgba(205, 205, 205, 0)');
    rCtx.fillStyle = rGrad;
    rCtx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  }

  for (let g = 0; g < 1600; g++) {
    const gx = Math.floor(hash2d(g, 7) * 510);
    const gy = Math.floor(hash2d(g, 11) * 510);
    bCtx.fillStyle = g % 2 === 0 ? 'rgba(98, 98, 98, 0.35)' : 'rgba(182, 182, 182, 0.25)';
    bCtx.fillRect(gx, gy, 2, 2);
  }

  rCtx.strokeStyle = 'rgb(240, 240, 240)';
  rCtx.lineWidth = 3;
  bCtx.strokeStyle = 'rgb(42, 42, 42)';
  bCtx.lineWidth = 3;

  for (let i = 0; i <= tiles; i++) {
    const pos = i * step;
    [rCtx, bCtx].forEach((c) => {
      c.beginPath();
      c.moveTo(pos, 0);
      c.lineTo(pos, 512);
      c.stroke();
      c.beginPath();
      c.moveTo(0, pos);
      c.lineTo(512, pos);
      c.stroke();
    });
  }

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAnisotropy;

  return { map, roughnessMap, bumpMap };
}

/**
 * Textura procedural de muro perimetral escolar japonés (bloques de hormigón prefabricado
 * gris frío envejecido, juntas de mortero y manchas sutiles de humedad/musgo).
 */
export function createConcreteBlockWallTexture(
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Fondo base de concreto frío envejecido
  const baseGrad = ctx.createLinearGradient(0, 0, 0, 256);
  baseGrad.addColorStop(0, '#5a6164');
  baseGrad.addColorStop(0.55, '#4c5356');
  baseGrad.addColorStop(1, '#32383a');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, 512, 256);

  const rows = 4;
  const cols = 4;
  const rowH = 256 / rows;
  const colW = 512 / cols;

  // Bloques individuales trabados con ligera variación tonal
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 1 ? colW * 0.5 : 0;
    for (let c = -1; c <= cols; c++) {
      const x = c * colW + offset;
      const y = r * rowH;
      const tone = Math.floor((hash2d(r * 13 + c + 4, 29) - 0.5) * 14);
      const baseV = 78 - r * 5 + tone;
      ctx.fillStyle = `rgb(${baseV}, ${baseV + 5}, ${baseV + 8})`;
      ctx.fillRect(x + 2, y + 2, colW - 4, rowH - 4);
    }
  }

  // Juntas de mortero oscuras
  ctx.strokeStyle = '#252a2c';
  ctx.lineWidth = 4;
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * rowH);
    ctx.lineTo(512, r * rowH);
    ctx.stroke();
  }
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 1 ? colW * 0.5 : 0;
    for (let c = 0; c <= cols + 1; c++) {
      const vx = c * colW + offset;
      ctx.beginPath();
      ctx.moveTo(vx, r * rowH);
      ctx.lineTo(vx, (r + 1) * rowH);
      ctx.stroke();
    }
  }

  // Humedad ascendente y salpicaduras cerca de la base
  const mossGrad = ctx.createLinearGradient(0, 170, 0, 256);
  mossGrad.addColorStop(0, 'rgba(20, 28, 24, 0)');
  mossGrad.addColorStop(1, 'rgba(16, 22, 20, 0.58)');
  ctx.fillStyle = mossGrad;
  ctx.fillRect(0, 170, 512, 86);

  // Grano mineral y escorrentías verticales sutiles
  for (let g = 0; g < 900; g++) {
    const gx = Math.floor(hash2d(g, 19) * 510);
    const gy = Math.floor(hash2d(g, 37) * 254);
    ctx.fillStyle =
      g % 2 === 0 ? 'rgba(18, 22, 24, 0.22)' : 'rgba(165, 175, 178, 0.08)';
    ctx.fillRect(gx, gy, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createSchoolWallTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Yeso japonés superior envejecido (blanco sucio / grisáceo-verdoso apagado)
  const upperGrad = ctx.createLinearGradient(0, 0, 0, 340);
  upperGrad.addColorStop(0, '#aeb9ae');
  upperGrad.addColorStop(0.55, '#c1cabf');
  upperGrad.addColorStop(1, '#b4beb3');
  ctx.fillStyle = upperGrad;
  ctx.fillRect(0, 0, 512, 340);

  // Textura sutil de estuco y manchas suaves de humedad en el yeso
  for (let m = 0; m < 38; m++) {
    const mx = hash2d(m, 3) * 512;
    const my = hash2d(m, 9) * 320;
    const mr = 20 + hash2d(m, 17) * 54;
    const stain = ctx.createRadialGradient(mx, my, 2, mx, my, mr);
    stain.addColorStop(0, m % 2 === 0 ? 'rgba(92, 106, 94, 0.12)' : 'rgba(218, 224, 214, 0.09)');
    stain.addColorStop(1, 'rgba(92, 106, 94, 0)');
    ctx.fillStyle = stain;
    ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
  }
  for (let g = 0; g < 650; g++) {
    const gx = Math.floor(hash2d(g, 31) * 510);
    const gy = Math.floor(hash2d(g, 41) * 334);
    ctx.fillStyle = g % 2 === 0 ? 'rgba(65, 76, 66, 0.08)' : 'rgba(240, 244, 238, 0.06)';
    ctx.fillRect(gx, gy, 2, 2);
  }

  // Moldura superior de madera oscura envejecida
  ctx.fillStyle = '#25241b';
  ctx.fillRect(0, 0, 512, 16);

  // Guardasilla / moldura media en verde musgo apagado / nogal oscuro
  ctx.fillStyle = '#282c21';
  ctx.fillRect(0, 330, 512, 16);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(0, 344, 512, 3);

  // Lambrín / zócalo inferior de madera oscura (koshi-ita verde oliva oscuro / nogal)
  ctx.fillStyle = '#2b2e23';
  ctx.fillRect(0, 346, 512, 166);

  const slats = 16;
  const slatW = 512 / slats;
  for (let i = 0; i < slats; i++) {
    const sx = i * slatW;
    const tone = Math.floor((hash2d(i, 53) - 0.5) * 8);
    ctx.fillStyle = `rgb(${43 + tone}, ${46 + tone}, ${35 + Math.floor(tone * 0.7)})`;
    ctx.fillRect(sx + 1, 346, slatW - 2, 148);
  }

  ctx.strokeStyle = 'rgba(14, 16, 12, 0.72)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= slats; i++) {
    ctx.beginPath();
    ctx.moveTo(i * slatW, 346);
    ctx.lineTo(i * slatW, 512);
    ctx.stroke();
  }

  // Rodapié / zócalo base oscuro
  ctx.fillStyle = '#181813';
  ctx.fillRect(0, 494, 512, 18);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createLockerTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#2f2419';
  ctx.fillRect(0, 0, 512, 512);

  const cols = 4;
  const rows = 5;
  const cw = 512 / cols;
  const ch = 512 / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cw + 6;
      const y = r * ch + 6;
      ctx.fillStyle = '#3f3021';
      ctx.fillRect(x, y, cw - 12, ch - 12);

      ctx.strokeStyle = '#1c140d';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, cw - 12, ch - 12);

      // Nameplate slot (getabako envejecido)
      ctx.fillStyle = '#cbc6b8';
      ctx.fillRect(x + cw * 0.25, y + 10, cw * 0.38, 12);

      // Ventilation slits
      ctx.fillStyle = '#18110b';
      ctx.fillRect(x + cw * 0.22, y + ch - 30, cw * 0.44, 4);
      ctx.fillRect(x + cw * 0.22, y + ch - 22, cw * 0.44, 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Puerta corrediza escolar japonesa en madera natural envejecida y cristales esmerilados sucios,
 * completamente limpia de textos o etiquetas de estado impresas sobre la hoja.
 */
export function createSlidingDoorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Marco exterior en madera oscura envejecida
  ctx.fillStyle = '#29231a';
  ctx.fillRect(0, 0, 512, 512);

  // Panel interior de tablones verticales de cedro/nogal envejecido
  ctx.fillStyle = '#4a3624';
  ctx.fillRect(22, 22, 468, 476);

  const plankCount = 6;
  const innerW = 468 / plankCount;
  for (let p = 0; p < plankCount; p++) {
    const px = 22 + p * innerW;
    const tone = Math.floor((hash2d(p, 71) - 0.5) * 10);
    ctx.fillStyle = `rgb(${74 + tone}, ${54 + Math.floor(tone * 0.8)}, ${36 + Math.floor(tone * 0.6)})`;
    ctx.fillRect(px + 1, 22, innerW - 2, 476);

    ctx.fillStyle = 'rgba(18, 12, 7, 0.45)';
    ctx.fillRect(px, 22, 2, 476);
  }

  // Vetas sutiles verticales de madera en el panel de puerta
  ctx.strokeStyle = 'rgba(22, 14, 8, 0.3)';
  ctx.lineWidth = 1.4;
  for (let lx = 34; lx < 480; lx += 18) {
    ctx.beginPath();
    ctx.moveTo(lx, 240);
    ctx.bezierCurveTo(
      lx + Math.sin(lx) * 3,
      320,
      lx - Math.cos(lx) * 3,
      410,
      lx,
      492
    );
    ctx.stroke();
  }

  // Cristales superiores esmerilados y sucios con tono frío verdoso-azulado
  const paneCols = 3;
  const paneW = (436 - 24) / paneCols;
  for (let i = 0; i < paneCols; i++) {
    const px = 38 + i * (paneW + 12);
    const grad = ctx.createLinearGradient(px, 44, px + paneW, 230);
    grad.addColorStop(0, '#8ba0a0');
    grad.addColorStop(0.55, '#647b7f');
    grad.addColorStop(1, '#4b5e63');
    ctx.fillStyle = grad;
    ctx.fillRect(px, 44, paneW, 185);

    // Pátina de polvo en esquinas del vidrio
    ctx.fillStyle = 'rgba(24, 30, 28, 0.16)';
    ctx.fillRect(px, 198, paneW, 31);

    ctx.strokeStyle = '#211c14';
    ctx.lineWidth = 5;
    ctx.strokeRect(px, 44, paneW, 185);
  }

  // Moldura del tablero inferior de madera (sin ningún cartel ni texto)
  ctx.strokeStyle = '#241910';
  ctx.lineWidth = 6;
  ctx.strokeRect(38, 258, 436, 214);

  ctx.strokeStyle = 'rgba(120, 92, 64, 0.16)';
  ctx.lineWidth = 2;
  ctx.strokeRect(46, 266, 420, 198);

  // Tirador empotrado tradicional (hikite)
  ctx.fillStyle = '#140f0a';
  ctx.fillRect(424, 282, 22, 70);
  ctx.strokeStyle = '#3c2b1d';
  ctx.lineWidth = 2;
  ctx.strokeRect(424, 282, 22, 70);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Genera una textura procedural de cartel de madera oscura envejecida (512x160)
 * con veta orgánica, bordes desgastados, remaches y tipografía crema pintada a mano.
 */
export function createWoodenSignTexture(
  title: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  // Base de madera oscura envejecida con degradado vertical sutil
  const woodGrad = ctx.createLinearGradient(0, 0, 0, 160);
  woodGrad.addColorStop(0, '#3a2b1e');
  woodGrad.addColorStop(0.5, '#312318');
  woodGrad.addColorStop(1, '#251a11');
  ctx.fillStyle = woodGrad;
  ctx.fillRect(0, 0, 512, 160);

  // Vetas horizontales orgánicas del tablón
  for (let i = 0; i < 24; i++) {
    const gy = 6 + (i / 24) * 148;
    const wave = (hash2d(i, 83) - 0.5) * 7;
    ctx.strokeStyle =
      i % 3 === 0 ? 'rgba(18, 11, 6, 0.44)' : 'rgba(148, 118, 86, 0.08)';
    ctx.lineWidth = i % 4 === 0 ? 1.8 : 1.0;
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.bezierCurveTo(170, gy + wave, 340, gy - wave, 512, gy + wave * 0.4);
    ctx.stroke();
  }

  // Manchas suaves de desgaste / humedad en los extremos del tablón
  for (let s = 0; s < 14; s++) {
    const sx = hash2d(s, 91) * 512;
    const sy = hash2d(s, 97) * 160;
    const sr = 24 + hash2d(s, 101) * 42;
    const spot = ctx.createRadialGradient(sx, sy, 2, sx, sy, sr);
    spot.addColorStop(0, 'rgba(14, 10, 7, 0.24)');
    spot.addColorStop(1, 'rgba(14, 10, 7, 0)');
    ctx.fillStyle = spot;
    ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  }

  // Bisel oscuro perimetral y ranura interior sutilmente desgastada
  ctx.strokeStyle = '#160f09';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 502, 150);

  ctx.strokeStyle = 'rgba(205, 184, 152, 0.16)';
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, 484, 132);

  ctx.strokeStyle = 'rgba(14, 9, 5, 0.58)';
  ctx.lineWidth = 2;
  ctx.strokeRect(17, 17, 478, 126);

  // Pequeños clavos / remaches metálicos oscuros en las 4 esquinas
  const rivets = [
    [28, 28],
    [484, 28],
    [28, 132],
    [484, 132],
  ];
  rivets.forEach(([rx, ry]) => {
    ctx.fillStyle = '#14110f';
    ctx.beginPath();
    ctx.arc(rx, ry, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(218, 206, 186, 0.25)';
    ctx.beginPath();
    ctx.arc(rx - 1, ry - 1, 1.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Ajuste automático de tamaño para que cualquier título quepa cómodo sin recorte
  let fontSize = 46;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  while (fontSize > 26) {
    ctx.font = `700 ${fontSize}px "Georgia", "Times New Roman", serif`;
    if (ctx.measureText(title).width <= 426) break;
    fontSize -= 2;
  }

  // Sombra grabada + tinta crema envejecida
  ctx.fillStyle = 'rgba(10, 7, 4, 0.88)';
  ctx.fillText(title, 257, 83);

  ctx.fillStyle = '#e6decb';
  ctx.fillText(title, 256, 81);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createMarkerPlaqueTexture(
  title: string,
  subtitle: string,
  accentHex: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 512, 160);

  // Crisp dark plaque card
  ctx.fillStyle = 'rgba(18, 16, 14, 0.9)';
  ctx.beginPath();
  ctx.roundRect(16, 18, 480, 124, 22);
  ctx.fill();

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(16, 18, 480, 124, 22);
  ctx.stroke();

  ctx.fillStyle = '#faf6ee';
  ctx.font = '700 32px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 256, 72);

  ctx.fillStyle = accentHex;
  ctx.font = '600 21px "Inter", sans-serif';
  ctx.fillText(subtitle, 256, 114);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCharacterStandeeTexture(
  portraitUrl: string,
  characterName: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 768;
  const ctx = canvas.getContext('2d')!;

  const drawFrame = (img?: HTMLImageElement) => {
    ctx.clearRect(0, 0, 512, 768);

    // Warm Japanese rice-paper arched card so black sumi-e line art stands out crisply
    ctx.fillStyle = '#FAF6EE';
    ctx.beginPath();
    ctx.roundRect(28, 20, 456, 724, [160, 160, 28, 28]);
    ctx.fill();

    // Subtle inner ink border
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.roundRect(28, 20, 456, 724, [160, 160, 28, 28]);
    ctx.stroke();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(42, 34, 428, 696, [148, 148, 20, 20]);
    ctx.stroke();

    if (img && img.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(46, 38, 420, 628, [142, 142, 0, 0]);
      ctx.clip();

      const scale = Math.min(416 / img.naturalWidth, 616 / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      const dx = 256 - dw / 2;
      const dy = 666 - dh;
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();
    } else {
      ctx.fillStyle = '#44403c';
      ctx.font = '700 44px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(characterName, 256, 360);
    }

    // Bottom name seal
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(56, 666, 400, 54);
    ctx.fillStyle = '#faf6ee';
    ctx.font = '700 27px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(characterName.toUpperCase(), 256, 702);
  };

  drawFrame();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  if (portraitUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      drawFrame(img);
      tex.needsUpdate = true;
    };
    img.src = portraitUrl;
  }

  return tex;
}
