import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import leafModelUrl from '../assets/glb/leaf.glb?url';

export interface LeafSeed {
  angle: number;
  radius: number;
  height: number;
  speed: number;
  scatter: number;
  scale: number;
  rotOffsetX: number;
  rotOffsetZ: number;
}

export interface AparcabicicletasFoliageHandle {
  swirlingInstanced: THREE.InstancedMesh;
  swirlingSeeds: LeafSeed[];
  textures: THREE.Texture[];
  dispose: () => void;
}

export interface AparcabicicletasLeafSystemOptions {
  targetGroup: THREE.Group;
  isSoftwareGl: boolean;
  onLoaded?: (handle: AparcabicicletasFoliageHandle) => void;
  onError?: (error: unknown) => void;
}

// Color base oliva-bosque para el remolino de hojas sobre las bicicletas, con variaciones otoñales y de sombra
const BASE_SWIRLING_LEAF_TONE = new THREE.Color('#5a7a47');

/**
 * Generador pseudoaleatorio determinista (Mulberry32) para distribuir las hojas
 * de forma natural y consistente entre cargas sin depender de Math.random global.
 */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Calcula una variación orgánica de color por instancia derivada del color base:
 * mezcla tonos amarillentos/otoñales (hojas secas o nuevas), tonos azulados/oscuros (sombra)
 * y variaciones de luminosidad para evitar un color plano uniforme.
 */
function computeVariedLeafColor(
  baseColor: THREE.Color,
  targetColor: THREE.Color,
  rand: () => number
): THREE.Color {
  const hsl = { h: 0, s: 0, l: 0 };
  baseColor.getHSL(hsl);

  const roll = rand();

  if (roll < 0.45) {
    // Hojas secas / amarillentas: desplazamiento hacia oliva cálido y ocre otoñal
    hsl.h -= 0.04 + rand() * 0.075;
    hsl.s = THREE.MathUtils.clamp(hsl.s + (rand() * 0.14 - 0.03), 0.18, 0.7);
    hsl.l = THREE.MathUtils.clamp(hsl.l + 0.02 + rand() * 0.1, 0.16, 0.62);
  } else if (roll < 0.75) {
    // Hojas en sombra: desplazamiento hacia tonos verde-azulado más fríos y oscuros
    hsl.h += 0.025 + rand() * 0.045;
    hsl.s = THREE.MathUtils.clamp(hsl.s - 0.04 + rand() * 0.08, 0.14, 0.56);
    hsl.l = THREE.MathUtils.clamp(hsl.l - (0.04 + rand() * 0.1), 0.12, 0.48);
  } else {
    // Rango verde oliva intermedio con variación orgánica de matiz y luminosidad
    hsl.h += (rand() - 0.5) * 0.04;
    hsl.s = THREE.MathUtils.clamp(hsl.s + (rand() - 0.5) * 0.14, 0.16, 0.62);
    hsl.l = THREE.MathUtils.clamp(hsl.l + (rand() - 0.5) * 0.14, 0.14, 0.56);
  }

  hsl.h = ((hsl.h % 1) + 1) % 1;
  return targetColor.setHSL(hsl.h, hsl.s, hsl.l);
}

/**
 * Extrae y normaliza la geometría y el material base del archivo `leaf.glb`,
 * centrando el pivote y ajustando la escala base de hoja para instancing PBR.
 */
function extractNormalizedLeafAssets(gltfScene: THREE.Object3D): {
  geometry: THREE.BufferGeometry;
  baseMaterial: THREE.MeshStandardMaterial | null;
} | null {
  let sourceMesh: THREE.Mesh | null = null;
  gltfScene.traverse((child) => {
    if (!sourceMesh && (child as THREE.Mesh).isMesh) {
      sourceMesh = child as THREE.Mesh;
    }
  });

  if (!sourceMesh) return null;

  const extractedMesh = sourceMesh as THREE.Mesh;
  const geometry = extractedMesh.geometry.clone();
  geometry.center();
  geometry.computeBoundingBox();

  if (geometry.boundingBox) {
    const size = new THREE.Vector3();
    geometry.boundingBox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const normalizedHeightMeters = 0.34;
    const scaleFactor = normalizedHeightMeters / maxDim;
    geometry.scale(scaleFactor, scaleFactor, scaleFactor);
  }

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const rawMat = Array.isArray(extractedMesh.material)
    ? extractedMesh.material[0]
    : extractedMesh.material;
  const baseMaterial =
    rawMat && (rawMat as THREE.MeshStandardMaterial).isMeshStandardMaterial
      ? (rawMat as THREE.MeshStandardMaterial)
      : null;

  return { geometry, baseMaterial };
}

/**
 * Carga `leaf.glb` mediante `THREE.GLTFLoader` y construye `swirlingInstanced`
 * exclusivamente para el remolino de hojas sobre las bicicletas en el Aparcabicicletas.
 */
export function loadAparcabicicletasLeafInstancing(
  options: AparcabicicletasLeafSystemOptions
): { cancel: () => void } {
  let cancelled = false;
  const loader = new GLTFLoader();

  loader.load(
    leafModelUrl,
    (gltf) => {
      if (cancelled) return;

      const assets = extractNormalizedLeafAssets(gltf.scene);
      if (!assets) return;

      const { geometry: leafGeometry, baseMaterial } = assets;
      const extractedTextures: THREE.Texture[] = [];
      if (baseMaterial?.map) extractedTextures.push(baseMaterial.map);
      if (baseMaterial?.normalMap) extractedTextures.push(baseMaterial.normalMap);
      if (baseMaterial?.roughnessMap) extractedTextures.push(baseMaterial.roughnessMap);

      const leafMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: baseMaterial?.map ?? null,
        normalMap: baseMaterial?.normalMap ?? null,
        roughnessMap: baseMaterial?.roughnessMap ?? null,
        alphaTest:
          baseMaterial?.alphaTest && baseMaterial.alphaTest > 0 ? baseMaterial.alphaTest : 0.42,
        roughness: 0.84,
        metalness: 0.0,
        side: THREE.DoubleSide,
        envMapIntensity: 0.28,
      });

      const rand = createSeededRandom(4042026);
      const dummy = new THREE.Object3D();
      const tempColor = new THREE.Color();

      // Remolino de hojas sobre las bicicletas (exclusivo con leaf.glb, mayor densidad: 90 -> 126)
      const swirlingLeafCount = options.isSoftwareGl ? 96 : 126;
      const swirlingInstanced = new THREE.InstancedMesh(
        leafGeometry,
        leafMaterial,
        swirlingLeafCount
      );
      swirlingInstanced.name = 'AparcabicicletasSwirlingLeavesInstanced';
      swirlingInstanced.frustumCulled = false;
      swirlingInstanced.userData.noCollision = true;

      const swirlingSeeds: LeafSeed[] = [];
      for (let i = 0; i < swirlingLeafCount; i++) {
        const seed: LeafSeed = {
          angle: (i / swirlingLeafCount) * Math.PI * 6 + rand() * 0.45,
          radius: 0.45 + rand() * 2.15,
          height: 0.08 + rand() * 1.85,
          speed: 0.65 + rand() * 1.15,
          scatter: 0,
          scale: 0.58 + rand() * 0.42,
          rotOffsetX: rand() * Math.PI * 2,
          rotOffsetZ: rand() * Math.PI * 2,
        };
        swirlingSeeds.push(seed);

        dummy.position.set(
          27.5 + Math.cos(seed.angle) * seed.radius,
          seed.height,
          -21.8 + Math.sin(seed.angle) * seed.radius
        );
        dummy.rotation.set(seed.rotOffsetX, seed.angle, seed.rotOffsetZ);
        dummy.scale.setScalar(seed.scale);
        dummy.updateMatrix();

        swirlingInstanced.setMatrixAt(i, dummy.matrix);
        swirlingInstanced.setColorAt(
          i,
          computeVariedLeafColor(BASE_SWIRLING_LEAF_TONE, tempColor, rand)
        );
      }
      swirlingInstanced.instanceMatrix.needsUpdate = true;
      if (swirlingInstanced.instanceColor) {
        swirlingInstanced.instanceColor.needsUpdate = true;
      }

      options.targetGroup.add(swirlingInstanced);

      // Libera los materiales/geometrías temporales del GLTF importado
      gltf.scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else {
            m.material?.dispose();
          }
        }
      });

      const handle: AparcabicicletasFoliageHandle = {
        swirlingInstanced,
        swirlingSeeds,
        textures: extractedTextures,
        dispose: () => {
          options.targetGroup.remove(swirlingInstanced);
          leafGeometry.dispose();
          leafMaterial.dispose();
          extractedTextures.forEach((tex) => tex.dispose());
        },
      };

      options.onLoaded?.(handle);
    },
    undefined,
    (err) => {
      if (!cancelled) {
        options.onError?.(err);
      }
    }
  );

  return {
    cancel: () => {
      cancelled = true;
    },
  };
}
