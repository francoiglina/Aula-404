import * as THREE from 'three';
import { FloorNumber, WalkableRect } from '../types';

export const PLAYER_COLLISION_RADIUS = 0.24;
const WALL_CORNER_OVERLAP = 0.2;
const WALL_PERPENDICULAR_PAD = 0.04;
const FURNITURE_PAD = 0.02;

export type ColliderKind = 'wall' | 'pillar' | 'door' | 'furniture' | 'bike' | 'none';

export interface FloorCollisionData {
  walls: THREE.Box3[];
  obstacles: THREE.Box3[];
  allColliders: THREE.Box3[];
  walkableZones: WalkableRect[];
  safetyPerimeter: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
}

export const FLOOR_SAFETY_PERIMETERS: Record<
  FloorNumber,
  { minX: number; maxX: number; minZ: number; maxZ: number }
> = {
  1: { minX: -29.35, maxX: 30.35, minZ: -25.05, maxZ: 7.48 },
  2: { minX: -29.35, maxX: 29.85, minZ: -24.55, maxZ: 3.92 },
};

const _tempBox = new THREE.Box3();
const _tempSize = new THREE.Vector3();
const _resolvedPos = { x: 0, z: 0 };

function circleIntersectsBoxXZ(x: number, z: number, radius: number, box: THREE.Box3): boolean {
  const closestX = THREE.MathUtils.clamp(x, box.min.x, box.max.x);
  const closestZ = THREE.MathUtils.clamp(z, box.min.z, box.max.z);
  const dx = x - closestX;
  const dz = z - closestZ;
  return dx * dx + dz * dz < radius * radius;
}

/**
 * Recorre una única vez la jerarquía estática de un piso al inicializar la escena
 * y precalcula todas las `THREE.Box3` sólidas (muros con solapamiento en esquinas,
 * columnas, puertas, mobiliario, equipamiento de baños, bicicletas y soportes),
 * excluyendo marcadores interactivos, hojas y decoraciones altas o rasantes.
 */
export function buildFloorCollisionData(
  floorGroup: THREE.Group,
  floor: FloorNumber,
  allWalkableZones: WalkableRect[]
): FloorCollisionData {
  floorGroup.updateMatrixWorld(true);

  const walls: THREE.Box3[] = [];
  const obstacles: THREE.Box3[] = [];

  const traverseForColliders = (node: THREE.Object3D) => {
    if (!node.visible) return;
    if (node.userData?.noCollision || node.userData?.isInteractiveMarker) return;

    const kind = node.userData?.colliderKind as ColliderKind | undefined;
    if (kind === 'none') return;

    // Grupos compuestos (p. ej. cada bicicleta completa) generan un único Box3 optimizado
    if (kind === 'bike') {
      const box = new THREE.Box3().setFromObject(node);
      if (box.min.y < 1.92 && box.max.y > 0.1) {
        box.min.x -= FURNITURE_PAD;
        box.max.x += FURNITURE_PAD;
        box.min.z -= FURNITURE_PAD;
        box.max.z += FURNITURE_PAD;
        obstacles.push(box);
      }
      return;
    }

    if ((node as THREE.Mesh).isMesh && !(node as THREE.InstancedMesh).isInstancedMesh) {
      const mesh = node as THREE.Mesh;

      // Excluye geometrías planas de suelos, techos o láminas decorativas
      const geoType = mesh.geometry?.type ?? '';
      if (geoType === 'PlaneGeometry' || geoType === 'RingGeometry') {
        return;
      }

      _tempBox.setFromObject(mesh);
      _tempBox.getSize(_tempSize);

      // Solo elementos dentro de la franja vertical del jugador (0.10m .. 1.92m)
      if (_tempBox.min.y >= 1.92 || _tempBox.max.y <= 0.1) {
        return;
      }

      const footprintArea = _tempSize.x * _tempSize.z;

      if (kind === 'wall') {
        const wallBox = _tempBox.clone();
        // Solapamiento longitudinal de seguridad (0.20m) en los extremos para sellar esquinas en "L"
        if (_tempSize.x >= _tempSize.z) {
          wallBox.min.x -= WALL_CORNER_OVERLAP;
          wallBox.max.x += WALL_CORNER_OVERLAP;
          wallBox.min.z -= WALL_PERPENDICULAR_PAD;
          wallBox.max.z += WALL_PERPENDICULAR_PAD;
        } else {
          wallBox.min.z -= WALL_CORNER_OVERLAP;
          wallBox.max.z += WALL_CORNER_OVERLAP;
          wallBox.min.x -= WALL_PERPENDICULAR_PAD;
          wallBox.max.x += WALL_PERPENDICULAR_PAD;
        }
        walls.push(wallBox);
        return;
      }

      if (kind === 'pillar' || kind === 'door' || kind === 'furniture') {
        const obsBox = _tempBox.clone();
        obsBox.min.x -= FURNITURE_PAD;
        obsBox.max.x += FURNITURE_PAD;
        obsBox.min.z -= FURNITURE_PAD;
        obsBox.max.z += FURNITURE_PAD;
        obstacles.push(obsBox);
        return;
      }

      // Respaldo automático para mobiliario o estructuras sólidas estáticas sin etiqueta explícita
      // (excluye piezas diminutas o placas extensas como losas/pisos)
      if (_tempSize.y >= 0.2 && footprintArea >= 0.025 && footprintArea <= 28) {
        const autoBox = _tempBox.clone();
        autoBox.min.x -= FURNITURE_PAD;
        autoBox.max.x += FURNITURE_PAD;
        autoBox.min.z -= FURNITURE_PAD;
        autoBox.max.z += FURNITURE_PAD;
        obstacles.push(autoBox);
      }
      return;
    }

    for (let i = 0; i < node.children.length; i++) {
      traverseForColliders(node.children[i]);
    }
  };

  traverseForColliders(floorGroup);

  const walkableZones = allWalkableZones.filter((z) => z.floor === floor);

  return {
    walls,
    obstacles,
    allColliders: [...walls, ...obstacles],
    walkableZones,
    safetyPerimeter: FLOOR_SAFETY_PERIMETERS[floor],
  };
}

/**
 * Comprueba si el cilindro del jugador en `(x, z)` está dentro del perímetro exterior
 * de seguridad, dentro de una zona transitable válida y libre de muros/mobiliario.
 */
export function findValidWalkableZone(
  x: number,
  z: number,
  data: FloorCollisionData,
  radius = PLAYER_COLLISION_RADIUS
): WalkableRect | null {
  const bounds = data.safetyPerimeter;
  if (
    x < bounds.minX + radius ||
    x > bounds.maxX - radius ||
    z < bounds.minZ + radius ||
    z > bounds.maxZ - radius
  ) {
    return null;
  }

  for (let i = 0; i < data.allColliders.length; i++) {
    if (circleIntersectsBoxXZ(x, z, radius, data.allColliders[i])) {
      return null;
    }
  }

  for (let i = 0; i < data.walkableZones.length; i++) {
    const r = data.walkableZones[i];
    if (
      x >= r.minX + radius &&
      x <= r.maxX - radius &&
      z >= r.minZ + radius &&
      z <= r.maxZ - radius
    ) {
      return r;
    }
  }

  return null;
}

/**
 * Resolución iterativa multi-paso (sub-stepping + doble pasada en ejes X/Z)
 * que permite deslizamiento suave sobre muros planos y bloquea por completo
 * el avance cuando el radio del jugador interseca dos planos en una esquina.
 */
export function resolvePlayerMovement(
  startX: number,
  startZ: number,
  deltaX: number,
  deltaZ: number,
  data: FloorCollisionData,
  radius = PLAYER_COLLISION_RADIUS
): { x: number; z: number } {
  const totalDist = Math.hypot(deltaX, deltaZ);
  if (totalDist < 1e-6) {
    return { x: startX, z: startZ };
  }

  const subSteps = Math.min(6, Math.max(1, Math.ceil(totalDist / 0.06)));
  const stepX = deltaX / subSteps;
  const stepZ = deltaZ / subSteps;

  let curX = startX;
  let curZ = startZ;

  for (let s = 0; s < subSteps; s++) {
    const targetX = curX + stepX;
    const targetZ = curZ + stepZ;

    // 1. Paso completo diagonal libre de obstáculos
    if (findValidWalkableZone(targetX, targetZ, data, radius) !== null) {
      curX = targetX;
      curZ = targetZ;
      continue;
    }

    // 2. Evaluación separada de ejes para detectar esquinas vs muros planos
    const canSlideX =
      Math.abs(stepX) > 1e-6 && findValidWalkableZone(targetX, curZ, data, radius) !== null;
    const canSlideZ =
      Math.abs(stepZ) > 1e-6 && findValidWalkableZone(curX, targetZ, data, radius) !== null;

    // Si ambos ejes están bloqueados simultáneamente en una esquina, detiene el desplazamiento
    if (!canSlideX && !canSlideZ) {
      break;
    }

    // Doble pasada ordenada por eje dominante para evitar vibración o cuelgue en juntas
    if (Math.abs(stepX) >= Math.abs(stepZ)) {
      if (canSlideX) {
        curX = targetX;
        if (Math.abs(stepZ) > 1e-6 && findValidWalkableZone(curX, targetZ, data, radius) !== null) {
          curZ = targetZ;
        }
      } else if (canSlideZ) {
        curZ = targetZ;
      }
    } else {
      if (canSlideZ) {
        curZ = targetZ;
        if (Math.abs(stepX) > 1e-6 && findValidWalkableZone(targetX, curZ, data, radius) !== null) {
          curX = targetX;
        }
      } else if (canSlideX) {
        curX = targetX;
      }
    }
  }

  // Resguardo absoluto de seguridad: nunca devolver una coordenada fuera de límites válidos
  if (findValidWalkableZone(curX, curZ, data, radius) === null) {
    if (findValidWalkableZone(startX, startZ, data, radius) !== null) {
      _resolvedPos.x = startX;
      _resolvedPos.z = startZ;
      return _resolvedPos;
    }
  }

  _resolvedPos.x = curX;
  _resolvedPos.z = curZ;
  return _resolvedPos;
}
