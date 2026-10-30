import * as THREE from 'three';

export function createWoodPlankTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#7c5333';
  ctx.fillRect(0, 0, 512, 512);

  const plankCount = 8;
  const plankH = 512 / plankCount;

  for (let i = 0; i < plankCount; i++) {
    const y = i * plankH;
    const toneShift = (i % 3) * 7 - 7;
    const r = 124 + toneShift;
    const g = 83 + Math.floor(toneShift * 0.7);
    const b = 51 + Math.floor(toneShift * 0.5);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(0, y, 512, plankH - 2);

    // Subtle wood grain streaks
    ctx.strokeStyle = 'rgba(52, 30, 14, 0.22)';
    ctx.lineWidth = 1.2;
    for (let gLine = 0; gLine < 10; gLine++) {
      const gy = y + 5 + (gLine / 10) * (plankH - 10);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(
        170,
        gy + Math.sin(i + gLine) * 2.5,
        340,
        gy - Math.cos(i + gLine) * 2.5,
        512,
        gy
      );
      ctx.stroke();
    }

    // Horizontal seam
    ctx.fillStyle = '#3f2614';
    ctx.fillRect(0, y + plankH - 2, 512, 2);

    // Staggered vertical plank joint
    const jointX = ((i * 173 + 90) % 440) + 36;
    ctx.fillRect(jointX, y, 2, plankH);
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
  baseHex = '#3b3936',
  groutHex = '#23211f'
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
      ctx.fillStyle = `rgba(255,255,255,${0.015 * shade})`;
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

export function createSchoolWallTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Upper traditional Japanese plaster (shikkui cream)
  const upperGrad = ctx.createLinearGradient(0, 0, 0, 340);
  upperGrad.addColorStop(0, '#ded6c6');
  upperGrad.addColorStop(1, '#eae3d5');
  ctx.fillStyle = upperGrad;
  ctx.fillRect(0, 0, 512, 340);

  // Top ceiling trim molding
  ctx.fillStyle = '#4c321d';
  ctx.fillRect(0, 0, 512, 16);

  // Mid chair-rail wood trim
  ctx.fillStyle = '#4a2f1b';
  ctx.fillRect(0, 332, 512, 14);

  // Lower cedar wainscoting (koshi-ita)
  ctx.fillStyle = '#654227';
  ctx.fillRect(0, 346, 512, 166);

  const slats = 16;
  const slatW = 512 / slats;
  ctx.strokeStyle = 'rgba(36, 20, 9, 0.42)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= slats; i++) {
    ctx.beginPath();
    ctx.moveTo(i * slatW, 346);
    ctx.lineTo(i * slatW, 512);
    ctx.stroke();
  }

  // Baseboard
  ctx.fillStyle = '#331f11';
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

  ctx.fillStyle = '#6d4c32';
  ctx.fillRect(0, 0, 512, 512);

  const cols = 4;
  const rows = 5;
  const cw = 512 / cols;
  const ch = 512 / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cw + 6;
      const y = r * ch + 6;
      ctx.fillStyle = '#845e3f';
      ctx.fillRect(x, y, cw - 12, ch - 12);

      ctx.strokeStyle = '#3d2716';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, cw - 12, ch - 12);

      // Nameplate slot (getabako style)
      ctx.fillStyle = '#efe9dc';
      ctx.fillRect(x + cw * 0.25, y + 10, cw * 0.38, 12);

      // Ventilation slits
      ctx.fillStyle = '#3b2514';
      ctx.fillRect(x + cw * 0.22, y + ch - 30, cw * 0.44, 4);
      ctx.fillRect(x + cw * 0.22, y + ch - 22, cw * 0.44, 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createSlidingDoorTexture(
  roomLabel: string,
  isOpenDoor: boolean,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Wooden door frame
  ctx.fillStyle = '#5a3a22';
  ctx.fillRect(0, 0, 512, 512);

  // Inner panel
  ctx.fillStyle = '#7b5233';
  ctx.fillRect(22, 22, 468, 476);

  // Frosted shoji/glass upper panes
  const paneCols = 3;
  const paneW = (436 - 24) / paneCols;
  for (let i = 0; i < paneCols; i++) {
    const px = 38 + i * (paneW + 12);
    const grad = ctx.createLinearGradient(px, 44, px + paneW, 230);
    grad.addColorStop(0, '#9fb6be');
    grad.addColorStop(1, '#6f8791');
    ctx.fillStyle = grad;
    ctx.fillRect(px, 44, paneW, 185);
    ctx.strokeStyle = '#3f2817';
    ctx.lineWidth = 5;
    ctx.strokeRect(px, 44, paneW, 185);
  }

  // Lower wood kick panels
  ctx.strokeStyle = '#472d19';
  ctx.lineWidth = 6;
  ctx.strokeRect(38, 258, 436, 214);

  // Recessed sliding handle
  ctx.fillStyle = '#291a10';
  ctx.fillRect(426, 280, 20, 68);

  // Room nameplate banner
  ctx.fillStyle = '#faf6ee';
  ctx.fillRect(146, 275, 220, 74);
  ctx.strokeStyle = isOpenDoor ? '#16a34a' : '#dc2626';
  ctx.lineWidth = 5;
  ctx.strokeRect(146, 275, 220, 74);

  ctx.fillStyle = '#1c1917';
  ctx.font = '700 34px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(roomLabel, 256, 304);

  ctx.fillStyle = isOpenDoor ? '#15803d' : '#b91c1c';
  ctx.font = '600 16px "Inter", sans-serif';
  ctx.fillText(isOpenDoor ? 'ACCESO ABIERTO' : 'CERRADA', 256, 334);

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
      ctx.roundRect(46, 38, 420, 620, [142, 142, 14, 14]);
      ctx.clip();

      const scale = Math.min(420 / img.naturalWidth, 620 / img.naturalHeight) * 0.96;
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      const dx = 256 - dw / 2;
      const dy = 355 - dh / 2;
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

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    drawFrame(img);
    tex.needsUpdate = true;
  };
  img.src = portraitUrl;

  return tex;
}
