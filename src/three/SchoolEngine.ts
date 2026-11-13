import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { WALKABLE_ZONES, WORLD_MARKERS } from '../data/gameContent';
import { sensorService } from '../services/sensorService';
import { soundEngine } from '../services/soundEngine';
import { FinalSubstate, FloorNumber, GamePhase, WalkableRect, WorldMarker } from '../types';
import { createGlbMarkerInstance, GlbMarkerInstance } from './Aula404MarkerViewer';
import {
  AparcabicicletasFoliageHandle,
  LeafSeed,
  loadAparcabicicletasLeafInstancing,
} from './aparcabicicletasLeafSystem';
import {
  buildFloorCollisionData,
  findValidWalkableZone,
  FloorCollisionData,
  PLAYER_COLLISION_RADIUS,
  resolvePlayerMovement,
} from './collisionSystem';
import {
  createCeilingPlankTexture,
  createCharacterStandeeTexture,
  createConcreteBlockWallTexture,
  createLockerTexture,
  createOutdoorConcretePbrMaps,
  createSchoolWallTexture,
  createSlidingDoorTexture,
  createStoneTileTexture,
  createWoodFloorPbrMaps,
  createWoodenSignTexture,
} from './proceduralTextures';
import { AtmosphericSkyboxHandle, createAtmosphericSkybox } from './skybox';

interface EngineCallbacks {
  onNearbyMarkerChange: (marker: WorldMarker | null) => void;
  onZoneNameChange: (zoneName: string) => void;
  onFloorChangeNotice?: (floor: FloorNumber) => void;
  onPlayerMove?: (pos: { x: number; z: number; yaw: number; floor: FloorNumber }) => void;
}

interface MarkerVisual {
  marker: WorldMarker;
  root: THREE.Group;
  floatingCore: THREE.Object3D;
  fallbackVisual: THREE.Group;
  glbInstance?: GlbMarkerInstance;
  ringMesh: THREE.Mesh;
  standeeMesh?: THREE.Mesh;
  hitProxy: THREE.Mesh;
}

// Pre-allocated math helpers for zero GC inside render loop
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveVec = new THREE.Vector3();
const _camEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _dummyObj = new THREE.Object3D();
const _pointerNdc = new THREE.Vector2();
const _markerTargetPos = new THREE.Vector3();
const _projectedNdc = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export class SchoolEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private sunLight: THREE.DirectionalLight | null = null;
  private skybox: AtmosphericSkyboxHandle | null = null;
  private readonly sunOffset = new THREE.Vector3(6.5, 9.5, -16);
  private sharedTextures: THREE.Texture[] = [];

  private floor1Group = new THREE.Group();
  private floor2Group = new THREE.Group();
  private markersById = new Map<string, MarkerVisual>();
  private hitProxies: THREE.Object3D[] = [];
  private floorCollisions: Record<FloorNumber, FloorCollisionData> | null = null;
  private lastNotifiedFloor: FloorNumber | null = null;
  private raycaster = new THREE.Raycaster();

  private currentFloor: FloorNumber = 1;
  private currentPhase: GamePhase = 'ESTADO_0';
  private finalSubstate: FinalSubstate = 'pendiente';
  private unlockedObjects = new Set<string>();
  private isPaused = false;
  private externallyPaused = false;
  private movementLocked = true;
  private disposed = false;

  // Player state (spawn in 1F Genkan aisle 2 facing north toward school interior)
  public playerPos = new THREE.Vector3(-1.5, 1.65, 6.0);
  public playerYaw = 0; // 0 looks toward -Z (North)
  public playerPitch = 0;
  private bobTimer = 0;

  // Controls state
  private moveInput = { x: 0, y: 0 };
  private keyState: Record<string, boolean> = {};
  private activeLookPointerId: number | null = null;
  private lookLastPos = { x: 0, y: 0 };

  // Sensor-reactive 3D scene references
  private closetDoorPivot: THREE.Group | null = null;
  private leavesInstanced: THREE.InstancedMesh | null = null;
  private leafSeeds: LeafSeed[] = [];
  private aparcabicicletasFoliageHandle: AparcabicicletasFoliageHandle | null = null;
  private cancelLeafLoad: (() => void) | null = null;
  private windChimeGroup: THREE.Group | null = null;
  private hanakoMirrorMat: THREE.MeshStandardMaterial | null = null;
  private hanakoSealRing: THREE.Mesh | null = null;
  private astrolabeOuterGimbal: THREE.Group | null = null;
  private astrolabeInnerGimbal: THREE.Group | null = null;
  private astrolabeLidPivot: THREE.Group | null = null;

  // Destination classroom door (Aula 2C, 2° Piso) for final two-step sequence
  private destDoorGroup: THREE.Group | null = null;
  private destDoorPanel: THREE.Mesh | null = null;
  private destDoorThresholdRing: THREE.Mesh | null = null;

  private readonly destinationDoorMarker: WorldMarker = {
    id: 'puerta_aula_destino',
    kind: 'puerta',
    glbFile: '',
    label: 'Puerta del Salón 2C',
    sublabel: 'Puerta desbloqueada · Entrar al salón',
    floor: 2,
    position: [10.8, 0, 2.26],
    requiredPhase: 'ESTADO_FINAL',
  };

  private lastNearbyId: string | null = null;
  private lastZoneName = '';
  private lastHudSyncTime = 0;

  private clock = new THREE.Clock();
  private frameId = 0;
  private hasCompletedBoot = false;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0c1315');
    this.scene.fog = new THREE.FogExp2('#0c1315', 0.036);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(68, width / height, 0.15, 160);
    this.camera.position.copy(this.playerPos);
    soundEngine.attachCamera(this.camera);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;
    // SDD Section 2.2: Strict mobile pixelRatio cap at 2
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.id = 'three-canvas';
    this.renderer.domElement.className = 'block h-full w-full touch-none outline-none';

    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    // Entorno PBR ligero (RoomEnvironment) con baja intensidad para reflejos sutiles en madera oscura
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.34;
    pmremGenerator.dispose();

    // Skybox / Domo atmosférico nocturno coherente con la niebla y la estética japonesa fría
    this.skybox = createAtmosphericSkybox(95);
    this.scene.add(this.skybox.mesh);

    this.setupLighting();
    this.buildSchoolArchitecture();
    this.applyArchitecturalPbrPass();
    this.floorCollisions = {
      1: buildFloorCollisionData(this.floor1Group, 1, WALKABLE_ZONES),
      2: buildFloorCollisionData(this.floor2Group, 2, WALKABLE_ZONES),
    };
    this.buildMarkers();
    this.setupPostProcessing(width, height);

    // Pre-compila ambos pisos (1F y 2F) y sus texturas/sombras durante el arranque
    // para evitar tirones de compilación WebGL al subir las escaleras por primera vez.
    this.floor1Group.visible = true;
    this.floor2Group.visible = true;
    this.updateSunShadowTracking();

    if (!this.isSoftwareGl) {
      for (let i = 0; i < this.sharedTextures.length; i++) {
        this.renderer.initTexture(this.sharedTextures[i]);
      }
      if (this.hanakoMirrorMat?.map) {
        this.renderer.initTexture(this.hanakoMirrorMat.map);
      }
      this.renderer.compile(this.scene, this.camera);
      this.renderCurrentFrame();
    }

    this.setFloor(1, [-1.5, 0, 6.0], 0, { silentFloorNotice: true });
    this.hasCompletedBoot = true;
    if (!this.isSoftwareGl) {
      this.renderCurrentFrame();
    }

    this.bindEvents();
    this.clock.start();
    this.scheduleNextFrame();
  }

  private setupPostProcessing(width: number, height: number) {
    if (this.isSoftwareGl) return;

    const composer = new EffectComposer(this.renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    composer.setSize(width, height);

    const renderPass = new RenderPass(this.scene, this.camera);
    composer.addPass(renderPass);

    // Bloom sutil de bajo costo (threshold 0.85) para plafones fríos, ventanas y halos neón
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.34,
      0.4,
      0.85
    );
    composer.addPass(bloomPass);

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    this.composer = composer;
    this.bloomPass = bloomPass;
  }

  private setupLighting() {
    // Penumbra fría superior vs rebote oscuro de madera inferior
    const hemiLight = new THREE.HemisphereLight('#8ea6b4', '#261e16', 0.56);
    this.scene.add(hemiLight);

    // Única luz direccional principal entrando en diagonal por los ventanales del patio
    const sunLight = new THREE.DirectionalLight('#ffebd2', 2.05);
    sunLight.position.set(
      this.playerPos.x + this.sunOffset.x,
      this.sunOffset.y,
      this.playerPos.z + this.sunOffset.z
    );
    if (!this.isSoftwareGl) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024);
      sunLight.shadow.camera.near = 1;
      sunLight.shadow.camera.far = 48;
      sunLight.shadow.camera.left = -16;
      sunLight.shadow.camera.right = 16;
      sunLight.shadow.camera.top = 16;
      sunLight.shadow.camera.bottom = -16;
      sunLight.shadow.bias = -0.0005;
      sunLight.shadow.normalBias = 0.02;
    }
    this.scene.add(sunLight);
    this.scene.add(sunLight.target);
    this.sunLight = sunLight;
  }

  private updateSunShadowTracking() {
    if (!this.sunLight) return;
    // Cuantiza a pasos de 0.5m para evitar parpadeo en el shadow map 1024x1024
    const snapX = Math.round(this.playerPos.x * 2) * 0.5;
    const snapZ = Math.round(this.playerPos.z * 2) * 0.5;
    this.sunLight.target.position.set(snapX, 0, snapZ);
    this.sunLight.position.set(
      snapX + this.sunOffset.x,
      this.sunOffset.y,
      snapZ + this.sunOffset.z
    );
    this.sunLight.target.updateMatrixWorld();
  }

  private buildSchoolArchitecture() {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const floorMaps = createWoodFloorPbrMaps(maxAniso);

    const woodTex = floorMaps.map;
    woodTex.repeat.set(16, 2);
    const woodRoughMap = floorMaps.roughnessMap;
    woodRoughMap.repeat.set(16, 2);
    const woodBumpMap = floorMaps.bumpMap;
    woodBumpMap.repeat.set(16, 2);

    const wingWoodTex = woodTex.clone();
    wingWoodTex.repeat.set(2, 8);
    wingWoodTex.needsUpdate = true;
    const wingRoughMap = woodRoughMap.clone();
    wingRoughMap.repeat.set(2, 8);
    wingRoughMap.needsUpdate = true;
    const wingBumpMap = woodBumpMap.clone();
    wingBumpMap.repeat.set(2, 8);
    wingBumpMap.needsUpdate = true;

    const roomWoodTex = woodTex.clone();
    roomWoodTex.repeat.set(3, 3);
    roomWoodTex.needsUpdate = true;
    const roomRoughMap = woodRoughMap.clone();
    roomRoughMap.repeat.set(3, 3);
    roomRoughMap.needsUpdate = true;
    const roomBumpMap = woodBumpMap.clone();
    roomBumpMap.repeat.set(3, 3);
    roomBumpMap.needsUpdate = true;

    const ceilingTex = createCeilingPlankTexture(maxAniso);
    ceilingTex.repeat.set(14, 2);

    const stoneTex = createStoneTileTexture(maxAniso, '#272928', '#151717');
    stoneTex.repeat.set(4, 4);

    const bathTileTex = createStoneTileTexture(maxAniso, '#8d9b9d', '#586668');
    bathTileTex.repeat.set(5, 5);

    const wallTex = createSchoolWallTexture(maxAniso);
    wallTex.repeat.set(8, 1);

    const shortWallTex = wallTex.clone();
    shortWallTex.repeat.set(2, 1);
    shortWallTex.needsUpdate = true;

    const lockerTex = createLockerTexture(maxAniso);
    const doorTex = createSlidingDoorTexture(maxAniso);

    this.sharedTextures.push(
      woodTex,
      woodRoughMap,
      woodBumpMap,
      wingWoodTex,
      wingRoughMap,
      wingBumpMap,
      roomWoodTex,
      roomRoughMap,
      roomBumpMap,
      ceilingTex,
      stoneTex,
      bathTileTex,
      wallTex,
      shortWallTex,
      lockerTex,
      doorTex
    );

    const woodFloorMat = new THREE.MeshStandardMaterial({
      map: woodTex,
      roughnessMap: woodRoughMap,
      bumpMap: woodBumpMap,
      bumpScale: 0.018,
      roughness: 0.95,
      metalness: 0.05,
      envMapIntensity: 0.38,
    });
    const wingFloorMat = new THREE.MeshStandardMaterial({
      map: wingWoodTex,
      roughnessMap: wingRoughMap,
      bumpMap: wingBumpMap,
      bumpScale: 0.018,
      roughness: 0.95,
      metalness: 0.05,
      envMapIntensity: 0.38,
    });
    const roomFloorMat = new THREE.MeshStandardMaterial({
      map: roomWoodTex,
      roughnessMap: roomRoughMap,
      bumpMap: roomBumpMap,
      bumpScale: 0.016,
      roughness: 0.95,
      metalness: 0.05,
      envMapIntensity: 0.35,
    });
    const stoneFloorMat = new THREE.MeshStandardMaterial({
      map: stoneTex,
      roughness: 0.84,
      metalness: 0.04,
      envMapIntensity: 0.3,
    });
    const bathFloorMat = new THREE.MeshStandardMaterial({
      map: bathTileTex,
      roughness: 0.32,
      metalness: 0.08,
      envMapIntensity: 0.42,
    });
    const wallLongMat = new THREE.MeshStandardMaterial({
      map: wallTex,
      roughness: 0.88,
      metalness: 0.02,
      envMapIntensity: 0.3,
    });
    const wallShortMat = new THREE.MeshStandardMaterial({
      map: shortWallTex,
      roughness: 0.88,
      metalness: 0.02,
      envMapIntensity: 0.3,
    });
    const ceilingMat = new THREE.MeshStandardMaterial({
      map: ceilingTex,
      roughness: 0.74,
      metalness: 0.04,
      envMapIntensity: 0.25,
    });
    const cedarTimberMat = new THREE.MeshStandardMaterial({
      color: '#2b2b22',
      roughness: 0.65,
      metalness: 0.04,
      envMapIntensity: 0.35,
    });
    const slidingDoorMat = new THREE.MeshStandardMaterial({
      map: doorTex,
      roughness: 0.64,
      metalness: 0.04,
      envMapIntensity: 0.35,
    });

    this.scene.add(this.floor1Group);
    this.scene.add(this.floor2Group);

    const stairTreadTex = woodTex.clone();
    stairTreadTex.repeat.set(1.2, 0.35);
    stairTreadTex.needsUpdate = true;
    const stairRoughMap = woodRoughMap.clone();
    stairRoughMap.repeat.set(1.2, 0.35);
    stairRoughMap.needsUpdate = true;
    const stairBumpMap = woodBumpMap.clone();
    stairBumpMap.repeat.set(1.2, 0.35);
    stairBumpMap.needsUpdate = true;

    const stairTreadMat = new THREE.MeshStandardMaterial({
      map: stairTreadTex,
      roughnessMap: stairRoughMap,
      bumpMap: stairBumpMap,
      bumpScale: 0.016,
      roughness: 0.92,
      metalness: 0.04,
      envMapIntensity: 0.34,
    });
    this.sharedTextures.push(stairTreadTex, stairRoughMap, stairBumpMap);

    // Build shared U-shape structure for Floor 1 and Floor 2
    this.populateFloorBase(this.floor1Group, 1, {
      woodFloorMat,
      wingFloorMat,
      roomFloorMat,
      stairTreadMat,
      stoneFloorMat,
      bathFloorMat,
      wallLongMat,
      wallShortMat,
      ceilingMat,
      cedarTimberMat,
      slidingDoorMat,
      lockerTex,
      maxAniso,
    });

    this.populateFloorBase(this.floor2Group, 2, {
      woodFloorMat,
      wingFloorMat,
      roomFloorMat,
      stairTreadMat,
      stoneFloorMat,
      bathFloorMat,
      wallLongMat,
      wallShortMat,
      ceilingMat,
      cedarTimberMat,
      slidingDoorMat,
      lockerTex,
      maxAniso,
    });

    // Build unique interactive story rooms & sensor-reactive props
    this.buildFloor1Props(maxAniso, cedarTimberMat);
    this.buildFloor2Props(maxAniso, cedarTimberMat);
  }

  /**
   * Ajusta envMapIntensity sobre los materiales arquitectónicos antes de instanciar marcadores .glb,
   * garantizando que los marcadores interactivos conserven intactos sus materiales originales.
   */
  private applyArchitecturalPbrPass() {
    const applyOnFloor = (group: THREE.Group) => {
      group.traverse((obj) => {
        if (obj.userData?.isInteractiveMarker) return;
        if (!(obj as THREE.Mesh).isMesh) return;
        const mesh = obj as THREE.Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((mat) => {
          if (mat && (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
            const std = mat as THREE.MeshStandardMaterial;
            std.envMapIntensity = Math.min(std.envMapIntensity ?? 0.35, 0.42);
            std.needsUpdate = true;
          }
        });
      });
    };

    applyOnFloor(this.floor1Group);
    applyOnFloor(this.floor2Group);
  }

  private addBoxWall(
    parent: THREE.Group,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material
  ) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = !this.isSoftwareGl;
    mesh.userData.colliderKind = 'wall';
    parent.add(mesh);
    return mesh;
  }

  private populateFloorBase(
    group: THREE.Group,
    floor: FloorNumber,
    mats: {
      woodFloorMat: THREE.Material;
      wingFloorMat: THREE.Material;
      roomFloorMat: THREE.Material;
      stairTreadMat: THREE.Material;
      stoneFloorMat: THREE.Material;
      bathFloorMat: THREE.Material;
      wallLongMat: THREE.Material;
      wallShortMat: THREE.Material;
      ceilingMat: THREE.Material;
      cedarTimberMat: THREE.Material;
      slidingDoorMat: THREE.Material;
      lockerTex: THREE.CanvasTexture;
      maxAniso: number;
    }
  ) {
    const wallH = 3.5;

    // 1. Main East-West Corridor Floor & Ceiling (x: -28.4..28.4, z: -2.4..2.4)
    const mainFloor = new THREE.Mesh(new THREE.PlaneGeometry(56.8, 4.8), mats.woodFloorMat);
    mainFloor.rotation.x = -Math.PI / 2;
    mainFloor.position.set(0, 0, 0);
    mainFloor.receiveShadow = !this.isSoftwareGl;
    group.add(mainFloor);

    const mainCeiling = new THREE.Mesh(new THREE.PlaneGeometry(56.8, 4.8), mats.ceilingMat);
    mainCeiling.rotation.x = Math.PI / 2;
    mainCeiling.position.set(0, wallH, 0);
    group.add(mainCeiling);

    // Plafones fluorescentes de pasillo en tono frío pálido (activan Bloom sutil sobre penumbra)
    const lampGeo = new THREE.BoxGeometry(1.45, 0.07, 0.34);
    const lampMat = new THREE.MeshStandardMaterial({
      color: '#e0f2fe',
      emissive: '#bae6fd',
      emissiveIntensity: 1.65,
      roughness: 0.18,
    });
    for (let lx = -22; lx <= 22; lx += 8.8) {
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(lx, wallH - 0.04, 0);
      group.add(lamp);
    }

    // Pilares estructurales de madera oscura a lo largo del corredor
    const pillarGeo = new THREE.BoxGeometry(0.24, wallH, 0.24);
    for (let px = -24; px <= 24; px += 6) {
      if (floor === 1 && Math.abs(px) < 5.5) continue;
      const pNorth = new THREE.Mesh(pillarGeo, mats.cedarTimberMat);
      pNorth.position.set(px, wallH / 2, -2.3);
      pNorth.castShadow = !this.isSoftwareGl;
      pNorth.userData.colliderKind = 'pillar';
      group.add(pNorth);

      const pSouth = new THREE.Mesh(pillarGeo, mats.cedarTimberMat);
      pSouth.position.set(px, wallH / 2, 2.3);
      pSouth.castShadow = !this.isSoftwareGl;
      pSouth.userData.colliderKind = 'pillar';
      group.add(pSouth);
    }

    // North Wall of Main Corridor con vanos reales de ventana hacia el patio para proyectar haces de luz
    if (floor === 1) {
      this.buildNorthCorridorWallWithWindows(group, -24.0, -5.6, -2.4, wallH, [-18.5, -11.5], mats.wallLongMat);
      this.buildNorthCorridorWallWithWindows(group, 5.6, 24.0, -2.4, wallH, [11.5, 18.5], mats.wallLongMat);

      // 1F Vestibule North Alcove (x: -5.6..5.6, z: -4.2..2.4)
      const vestFloor = new THREE.Mesh(new THREE.PlaneGeometry(11.2, 4.4), mats.roomFloorMat);
      vestFloor.rotation.x = -Math.PI / 2;
      vestFloor.position.set(0, 0.005, -2.1);
      vestFloor.receiveShadow = !this.isSoftwareGl;
      group.add(vestFloor);

      const vestCeil = new THREE.Mesh(new THREE.PlaneGeometry(11.2, 12.2), mats.ceilingMat);
      vestCeil.rotation.x = Math.PI / 2;
      vestCeil.position.set(0, wallH, 1.8);
      group.add(vestCeil);

      this.addBoxWall(group, 0, wallH / 2, -4.2, 11.2, wallH, 0.25, mats.wallShortMat);
      this.addBoxWall(group, -5.6, wallH / 2, -3.3, 0.25, wallH, 1.9, mats.wallShortMat);
      this.addBoxWall(group, 5.6, wallH / 2, -3.3, 0.25, wallH, 1.9, mats.wallShortMat);

      // 1F Genkan Entrance Sunken/Stone Floor (x: -5.6..5.6, z: 2.4..7.6)
      const genkanFloor = new THREE.Mesh(new THREE.PlaneGeometry(11.2, 5.2), mats.stoneFloorMat);
      genkanFloor.rotation.x = -Math.PI / 2;
      genkanFloor.position.set(0, 0.008, 5.0);
      genkanFloor.receiveShadow = !this.isSoftwareGl;
      group.add(genkanFloor);

      // Genkan Side & South Entrance Walls
      this.addBoxWall(group, -5.6, wallH / 2, 5.0, 0.25, wallH, 5.2, mats.wallShortMat);
      this.addBoxWall(group, 5.6, wallH / 2, 5.0, 0.25, wallH, 5.2, mats.wallShortMat);
      this.addGlassEntranceWall(group, 0, 7.6, 11.2, wallH, mats.cedarTimberMat);

      // 3 Traditional Getabako Shoe-Locker Islands creating the 4 aisles on Map 1
      const lockerMat = new THREE.MeshStandardMaterial({
        map: mats.lockerTex,
        roughness: 0.65,
        metalness: 0.05,
        envMapIntensity: 0.34,
      });
      const lockerTopMat = new THREE.MeshStandardMaterial({
        color: '#2b241b',
        roughness: 0.58,
        envMapIntensity: 0.35,
      });
      const bodyW = 1.1;
      const bodyH = 1.75;
      const bodyD = 3.4;

      [-2.95, 0, 2.95].forEach((lx) => {
        const island = new THREE.Group();
        island.position.set(lx, 0, 5.0);
        const body = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyD), lockerMat);
        body.position.y = bodyH / 2;
        body.castShadow = !this.isSoftwareGl;
        body.receiveShadow = !this.isSoftwareGl;
        body.userData.colliderKind = 'furniture';
        island.add(body);

        const cap = new THREE.Mesh(new THREE.BoxGeometry(bodyW + 0.06, 0.08, bodyD + 0.06), lockerTopMat);
        cap.position.y = 1.79;
        cap.userData.noCollision = true;
        island.add(cap);

        const plinth = new THREE.Mesh(new THREE.BoxGeometry(bodyW - 0.04, 0.1, bodyD - 0.06), mats.cedarTimberMat);
        plinth.position.y = 0.05;
        plinth.userData.noCollision = true;
        island.add(plinth);
        group.add(island);
      });
    } else {
      // 2F North Wall con los mismos vanos de ventana + Center-South Corridor Wall
      this.buildNorthCorridorWallWithWindows(
        group,
        -24.0,
        24.0,
        -2.4,
        wallH,
        [-18.5, -11.5, 11.5, 18.5],
        mats.wallLongMat
      );
      this.addBoxWall(group, 0, wallH / 2, 2.4, 11.4, wallH, 0.25, mats.wallShortMat);
    }

    // Courtyard Windows along North Corridor Wall (con montantes que proyectan sombras reales)
    this.addCorridorWindows(group, -18.5, -2.32, mats.cedarTimberMat);
    this.addCorridorWindows(group, -11.5, -2.32, mats.cedarTimberMat);
    this.addCorridorWindows(group, 11.5, -2.32, mats.cedarTimberMat);
    this.addCorridorWindows(group, 18.5, -2.32, mats.cedarTimberMat);

    // South Corridor Walls (flanking Genkan & Staircase pockets)
    // West end cap
    this.addBoxWall(group, -28.4, wallH / 2, 0, 0.25, wallH, 4.9, mats.wallShortMat);
    // East end cap
    this.addBoxWall(group, 28.4, wallH / 2, 0, 0.25, wallH, 4.9, mats.wallShortMat);

    // South wall segments around West Stairs (-24.9..-21.7) and East Stairs (23.1..26.3)
    this.addBoxWall(group, -26.65, wallH / 2, 2.4, 3.5, wallH, 0.25, mats.wallShortMat);
    this.addBoxWall(group, -13.65, wallH / 2, 2.4, 16.1, wallH, 0.25, mats.wallLongMat);
    this.addBoxWall(group, 14.35, wallH / 2, 2.4, 17.5, wallH, 0.25, mats.wallLongMat);
    this.addBoxWall(group, 27.35, wallH / 2, 2.4, 2.1, wallH, 0.25, mats.wallShortMat);

    // Classroom Doors along South Corridor (Aula 1A-1D on 1F, Aula 2A-2D on 2F)
    const prefix = floor === 1 ? '1' : '2';
    const classrooms = [
      { code: `${prefix}A`, label: `Aula ${prefix}A`, x: -18.2 },
      { code: `${prefix}B`, label: `Aula ${prefix}B`, x: -10.8 },
      { code: `${prefix}C`, label: `Aula ${prefix}C`, x: 10.8 },
      { code: `${prefix}D`, label: `Aula ${prefix}D`, x: 18.2 },
    ];
    classrooms.forEach((cls) => {
      const isDestinationDoor = floor === 2 && cls.code === '2C';
      this.addClassroomDoor(
        group,
        cls.x,
        2.26,
        Math.PI,
        cls.label,
        mats.maxAniso,
        mats.cedarTimberMat,
        mats.slidingDoorMat,
        isDestinationDoor
      );
    });

    // Staircase Pockets (West x = -23.3, East x = 24.7)
    this.buildStaircasePocket(group, -23.3, floor, mats);
    this.buildStaircasePocket(group, 24.7, floor, mats);

    // West Wing Corridor (x: -28.2..-23.8, z: -18.2..2.0)
    const westWingFloor = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 20.6), mats.wingFloorMat);
    westWingFloor.rotation.x = -Math.PI / 2;
    westWingFloor.position.set(-26.0, 0.002, -8.1);
    westWingFloor.receiveShadow = !this.isSoftwareGl;
    group.add(westWingFloor);

    const westWingCeil = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 20.6), mats.ceilingMat);
    westWingCeil.rotation.x = Math.PI / 2;
    westWingCeil.position.set(-26.0, wallH, -8.1);
    group.add(westWingCeil);

    this.addBoxWall(group, -28.2, wallH / 2, -8.1, 0.25, wallH, 20.6, mats.wallLongMat);
    this.addBoxWall(group, -23.8, wallH / 2, -10.2, 0.25, wallH, 16.0, mats.wallLongMat);

    // Open Doorway Frame at North of West Wing (z = -18.1)
    this.addOpenDoorwayArch(
      group,
      -26.0,
      -18.1,
      4.4,
      wallH,
      floor === 1 ? 'Armario de Limpieza' : 'Sala de Profesores',
      mats.cedarTimberMat,
      mats.slidingDoorMat,
      mats.maxAniso
    );

    // West North Room (Armario de Limpieza on 1F / Sala de Profesores on 2F)
    const westRoomFloor = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 6.8), mats.roomFloorMat);
    westRoomFloor.rotation.x = -Math.PI / 2;
    westRoomFloor.position.set(-26.0, 0.004, -21.4);
    westRoomFloor.receiveShadow = !this.isSoftwareGl;
    group.add(westRoomFloor);

    const westRoomCeil = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 6.8), mats.ceilingMat);
    westRoomCeil.rotation.x = Math.PI / 2;
    westRoomCeil.position.set(-26.0, wallH, -21.4);
    group.add(westRoomCeil);

    this.addBoxWall(group, -26.0, wallH / 2, -24.7, 7.0, wallH, 0.25, mats.wallShortMat);
    this.addBoxWall(group, -29.5, wallH / 2, -21.4, 0.25, wallH, 6.8, mats.wallShortMat);
    this.addBoxWall(group, -22.5, wallH / 2, -21.4, 0.25, wallH, 6.8, mats.wallShortMat);
    this.addBoxWall(group, -28.85, wallH / 2, -18.1, 1.3, wallH, 0.25, mats.wallShortMat);
    this.addBoxWall(group, -23.15, wallH / 2, -18.1, 1.3, wallH, 0.25, mats.wallShortMat);

    // East Wing Corridor (x: 23.8..28.2, z: -15.2..2.0)
    const eastWingFloor = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 17.6), mats.wingFloorMat);
    eastWingFloor.rotation.x = -Math.PI / 2;
    eastWingFloor.position.set(26.0, 0.002, -6.6);
    eastWingFloor.receiveShadow = !this.isSoftwareGl;
    group.add(eastWingFloor);

    const eastWingCeil = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 17.6), mats.ceilingMat);
    eastWingCeil.rotation.x = Math.PI / 2;
    eastWingCeil.position.set(26.0, wallH, -6.6);
    group.add(eastWingCeil);

    this.addBoxWall(group, 28.2, wallH / 2, -6.6, 0.25, wallH, 17.6, mats.wallLongMat);
    this.addBoxWall(group, 23.8, wallH / 2, -8.7, 0.25, wallH, 13.0, mats.wallLongMat);

    // Open Doorway Frame at North of East Wing (z = -15.1)
    this.addOpenDoorwayArch(
      group,
      26.0,
      -15.1,
      4.4,
      wallH,
      floor === 1 ? 'Aparcabicicletas' : 'Baños',
      mats.cedarTimberMat,
      mats.slidingDoorMat,
      mats.maxAniso
    );

    if (floor === 1) {
      // Cerramientos laterales en z = -15.1 a ambos lados de la salida hacia Aparcabicicletas
      this.addBoxWall(group, 22.8, wallH / 2, -15.1, 2.05, wallH, 0.25, mats.wallShortMat);
      this.addBoxWall(group, 29.35, wallH / 2, -15.1, 2.3, wallH, 0.25, mats.wallShortMat);
    } else {
      // 2F Bathrooms Enclosed Tiled Room (x: 22.0..30.0, z: -24.0..-15.0)
      const bathFloor = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 9.0), mats.bathFloorMat);
      bathFloor.rotation.x = -Math.PI / 2;
      bathFloor.position.set(26.0, 0.004, -19.5);
      bathFloor.receiveShadow = !this.isSoftwareGl;
      group.add(bathFloor);

      const bathCeil = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 9.0), mats.ceilingMat);
      bathCeil.rotation.x = Math.PI / 2;
      bathCeil.position.set(26.0, wallH, -19.5);
      group.add(bathCeil);

      this.addBoxWall(group, 26.0, wallH / 2, -24.0, 8.0, wallH, 0.25, mats.wallShortMat);
      this.addBoxWall(group, 22.0, wallH / 2, -19.5, 0.25, wallH, 9.0, mats.wallShortMat);
      this.addBoxWall(group, 30.0, wallH / 2, -19.5, 0.25, wallH, 9.0, mats.wallShortMat);
      this.addBoxWall(group, 22.9, wallH / 2, -15.1, 1.8, wallH, 0.25, mats.wallShortMat);
      this.addBoxWall(group, 29.1, wallH / 2, -15.1, 1.8, wallH, 0.25, mats.wallShortMat);
    }
  }

  private buildNorthCorridorWallWithWindows(
    group: THREE.Group,
    startX: number,
    endX: number,
    z: number,
    wallH: number,
    windowCentersX: number[],
    mat: THREE.Material
  ) {
    const winHalfW = 1.85;
    const sillH = 1.18;
    const winTopY = 2.62;
    const lintelH = wallH - winTopY;

    const sortedCenters = [...windowCentersX].sort((a, b) => a - b);
    let cursorX = startX;

    for (const cx of sortedCenters) {
      const bayMin = Math.max(startX, cx - winHalfW);
      const bayMax = Math.min(endX, cx + winHalfW);

      if (bayMin > cursorX + 0.02) {
        const pierW = bayMin - cursorX;
        const pier = this.addBoxWall(group, cursorX + pierW / 2, wallH / 2, z, pierW, wallH, 0.25, mat);
        pier.castShadow = !this.isSoftwareGl;
      }

      if (bayMax > bayMin + 0.05) {
        const bayW = bayMax - bayMin;
        const sill = this.addBoxWall(group, bayMin + bayW / 2, sillH / 2, z, bayW, sillH, 0.25, mat);
        sill.castShadow = !this.isSoftwareGl;

        const lintel = this.addBoxWall(
          group,
          bayMin + bayW / 2,
          winTopY + lintelH / 2,
          z,
          bayW,
          lintelH,
          0.25,
          mat
        );
        lintel.castShadow = !this.isSoftwareGl;
      }

      cursorX = Math.max(cursorX, bayMax);
    }

    if (endX > cursorX + 0.02) {
      const endPierW = endX - cursorX;
      const endPier = this.addBoxWall(
        group,
        cursorX + endPierW / 2,
        wallH / 2,
        z,
        endPierW,
        wallH,
        0.25,
        mat
      );
      endPier.castShadow = !this.isSoftwareGl;
    }
  }

  private addGlassEntranceWall(
    group: THREE.Group,
    x: number,
    z: number,
    width: number,
    height: number,
    frameMat: THREE.Material
  ) {
    const entrance = new THREE.Group();
    entrance.position.set(x, 0, z);

    const glassMat = new THREE.MeshStandardMaterial({
      color: '#9fb8b4',
      emissive: '#38bdf8',
      emissiveIntensity: 0.12,
      roughness: 0.18,
      metalness: 0.08,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      envMapIntensity: 0.4,
    });

    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(width, height), glassMat);
    backdrop.position.set(0, height / 2, 0.05);
    backdrop.rotation.y = Math.PI;
    backdrop.userData.noCollision = true;
    entrance.add(backdrop);

    const mullionCount = 6;
    for (let i = 0; i <= mullionCount; i++) {
      const mx = -width / 2 + (i / mullionCount) * width;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, height, 0.16), frameMat);
      bar.position.set(mx, height / 2, 0);
      bar.userData.colliderKind = 'pillar';
      entrance.add(bar);
    }

    const crossBar = new THREE.Mesh(new THREE.BoxGeometry(width, 0.12, 0.16), frameMat);
    crossBar.position.set(0, 2.3, 0);
    crossBar.userData.noCollision = true;
    entrance.add(crossBar);

    group.add(entrance);
  }

  private addCorridorWindows(group: THREE.Group, x: number, z: number, frameMat: THREE.Material) {
    const winGroup = new THREE.Group();
    winGroup.position.set(x, 1.9, z);
    winGroup.userData.noCollision = true;

    const winW = 3.74;
    const winH = 1.44;
    const barDepth = 0.14;

    // Marco perimetral abierto (sin placa sólida trasera) para dejar pasar los haces de luz direccional
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(winW, 0.08, barDepth), frameMat);
    topBar.position.y = winH / 2 - 0.04;
    topBar.castShadow = !this.isSoftwareGl;
    winGroup.add(topBar);

    const bottomBar = new THREE.Mesh(new THREE.BoxGeometry(winW, 0.08, barDepth), frameMat);
    bottomBar.position.y = -winH / 2 + 0.04;
    bottomBar.castShadow = !this.isSoftwareGl;
    winGroup.add(bottomBar);

    [-winW / 2 + 0.04, winW / 2 - 0.04].forEach((bx) => {
      const sideBar = new THREE.Mesh(new THREE.BoxGeometry(0.08, winH, barDepth), frameMat);
      sideBar.position.x = bx;
      sideBar.castShadow = !this.isSoftwareGl;
      winGroup.add(sideBar);
    });

    // Montantes internos que dibujan la retícula de ventana sobre los tablones del suelo
    [-0.62, 0.62].forEach((mx) => {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.06, winH - 0.08, barDepth * 0.85), frameMat);
      mullion.position.x = mx;
      mullion.castShadow = !this.isSoftwareGl;
      winGroup.add(mullion);
    });

    const transom = new THREE.Mesh(new THREE.BoxGeometry(winW - 0.1, 0.055, barDepth * 0.8), frameMat);
    transom.position.y = 0.22;
    transom.castShadow = !this.isSoftwareGl;
    winGroup.add(transom);

    // Vidrio translúcido envejecido con leve tinte cielo/crepúsculo frío
    const skyMat = new THREE.MeshStandardMaterial({
      color: '#9fb8b4',
      emissive: '#475569',
      emissiveIntensity: 0.22,
      roughness: 0.18,
      metalness: 0.06,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: THREE.DoubleSide,
      envMapIntensity: 0.4,
    });

    for (let i = -1; i <= 1; i++) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.14, 1.3), skyMat);
      pane.position.set(i * 1.21, 0, 0.02);
      pane.castShadow = false;
      winGroup.add(pane);
    }

    group.add(winGroup);
  }

  /**
   * Construye un cartel colgante de madera con grosor real (`BoxGeometry`) y dos caras independientes
   * (`FrontSide`) espalda con espalda, asegurando lectura correcta de izquierda a derecha en ambos sentidos.
   */
  private createWoodenSignBoard(
    title: string,
    width: number,
    height: number,
    depth: number,
    maxAniso: number,
    frameMat: THREE.Material
  ): THREE.Group {
    const board = new THREE.Group();

    const plank = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), frameMat);
    plank.castShadow = !this.isSoftwareGl;
    board.add(plank);

    const signTex = createWoodenSignTexture(title, maxAniso);
    this.sharedTextures.push(signTex);

    const faceMat = new THREE.MeshStandardMaterial({
      map: signTex,
      roughness: 0.75,
      metalness: 0.03,
      envMapIntensity: 0.32,
      side: THREE.FrontSide,
    });

    const faceW = Math.max(0.1, width - 0.01);
    const faceH = Math.max(0.06, height - 0.01);
    const halfD = depth * 0.5 + 0.0015;

    const frontFace = new THREE.Mesh(new THREE.PlaneGeometry(faceW, faceH), faceMat);
    frontFace.position.z = halfD;
    board.add(frontFace);

    const backFace = new THREE.Mesh(new THREE.PlaneGeometry(faceW, faceH), faceMat);
    backFace.position.z = -halfD;
    backFace.rotation.y = Math.PI;
    board.add(backFace);

    return board;
  }

  private addClassroomDoor(
    group: THREE.Group,
    x: number,
    z: number,
    rotY: number,
    label: string,
    maxAniso: number,
    frameMat: THREE.Material,
    doorMat: THREE.Material,
    isDestinationDoor = false
  ) {
    const doorGroup = new THREE.Group();
    doorGroup.position.set(x, 0, z);
    doorGroup.rotation.y = rotY;

    if (isDestinationDoor) {
      // Warm sunlit classroom doorway backdrop revealed when the sliding panel unlocks
      const portalFrame = new THREE.Mesh(
        new THREE.BoxGeometry(1.76, 2.52, 0.03),
        frameMat
      );
      portalFrame.position.set(0, 1.26, 0.005);
      portalFrame.userData.noCollision = true;
      doorGroup.add(portalFrame);

      const interiorGlow = new THREE.Mesh(
        new THREE.PlaneGeometry(1.56, 2.38),
        new THREE.MeshStandardMaterial({
          color: '#fef3c7',
          emissive: '#f59e0b',
          emissiveIntensity: 0.55,
          roughness: 0.35,
        })
      );
      interiorGlow.position.set(0, 1.225, 0.022);
      interiorGlow.userData.noCollision = true;
      doorGroup.add(interiorGlow);
    }

    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.65, 2.45, 0.06), doorMat);
    panel.position.set(0, 1.225, isDestinationDoor ? 0.055 : 0.02);
    panel.userData.colliderKind = 'door';
    doorGroup.add(panel);

    // Brazo y soporte colgante perpendicular al pasillo con tablón de madera de doble cara legible
    const signArm = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.62), frameMat);
    signArm.position.set(1.05, 2.55, 0.31);
    signArm.userData.noCollision = true;
    doorGroup.add(signArm);

    [0.2, 0.5].forEach((hz) => {
      const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.09, 0.024), frameMat);
      hanger.position.set(1.05, 2.49, hz);
      hanger.userData.noCollision = true;
      doorGroup.add(hanger);
    });

    const signBoard = this.createWoodenSignBoard(label, 0.68, 0.23, 0.036, maxAniso, frameMat);
    signBoard.position.set(1.05, 2.35, 0.35);
    signBoard.rotation.y = Math.PI / 2;
    signBoard.userData.noCollision = true;
    doorGroup.add(signBoard);

    if (isDestinationDoor) {
      this.destDoorGroup = doorGroup;
      this.destDoorPanel = panel;

      // Subtle emerald threshold ring on the hallway floor when unlocked
      const thresholdRing = new THREE.Mesh(
        new THREE.RingGeometry(0.52, 0.68, 32),
        new THREE.MeshBasicMaterial({
          color: '#10b981',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        })
      );
      thresholdRing.rotation.x = -Math.PI / 2;
      thresholdRing.position.set(0, 0.022, 0.42);
      thresholdRing.visible = false;
      thresholdRing.userData.isInteractiveMarker = true;
      thresholdRing.userData.noCollision = true;
      doorGroup.add(thresholdRing);
      this.destDoorThresholdRing = thresholdRing;

      // Invisible DoubleSide collider proxy on the door frame for reliable close/mid-range raycasting
      const doorHitBox = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 2.65, 0.9),
        new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
      );
      doorHitBox.position.set(0, 1.32, 0.25);
      doorHitBox.userData = {
        markerId: 'puerta_aula_destino',
        isDestinationDoor: true,
        noCollision: true,
      };
      doorGroup.add(doorHitBox);
    }

    group.add(doorGroup);
  }

  private addOpenDoorwayArch(
    group: THREE.Group,
    x: number,
    z: number,
    corridorWidth: number,
    wallH: number,
    title: string,
    frameMat: THREE.Material,
    doorMat: THREE.Material,
    maxAniso: number
  ) {
    const arch = new THREE.Group();
    arch.position.set(x, 0, z);

    // Header lintel above open doorway
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(corridorWidth, 0.85, 0.28), frameMat);
    lintel.position.set(0, wallH - 0.425, 0);
    lintel.userData.noCollision = true;
    arch.add(lintel);

    // Slid-open wooden hikido door tucked to one side (sin textos sobre la hoja)
    const slidDoor = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.6, 0.08), doorMat);
    slidDoor.position.set(-corridorWidth / 2 + 0.72, 1.3, 0.14);
    slidDoor.userData.colliderKind = 'door';
    arch.add(slidDoor);

    // Cartel colgante de madera suspendido bajo el dintel (legible de frente y desde el interior sin espejo)
    [-0.24, 0.68].forEach((hx) => {
      const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.14, 0.036), frameMat);
      hanger.position.set(hx, 2.64, 0);
      hanger.userData.noCollision = true;
      arch.add(hanger);
    });

    const signBoard = this.createWoodenSignBoard(title, 1.54, 0.36, 0.04, maxAniso, frameMat);
    signBoard.position.set(0.22, 2.45, 0);
    signBoard.userData.noCollision = true;
    arch.add(signBoard);

    group.add(arch);
  }

  private buildStaircasePocket(
    group: THREE.Group,
    centerX: number,
    floor: FloorNumber,
    mats: {
      roomFloorMat: THREE.Material;
      stairTreadMat: THREE.Material;
      wallShortMat: THREE.Material;
      ceilingMat: THREE.Material;
      cedarTimberMat: THREE.Material;
      slidingDoorMat: THREE.Material;
    }
  ) {
    const wallH = 3.5;
    const pocket = new THREE.Group();
    pocket.position.set(centerX, 0, 0);

    // Materiales coherentes en madera oscura envejecida (sin caras coplanares ni Z-fighting)
    const riserMat = new THREE.MeshStandardMaterial({
      color: '#241f18',
      roughness: 0.78,
      metalness: 0.03,
      envMapIntensity: 0.28,
    });
    const nosingMat = new THREE.MeshStandardMaterial({
      color: '#342b21',
      roughness: 0.62,
      metalness: 0.05,
      envMapIntensity: 0.34,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    if (floor === 1) {
      // 1F -> Escalera escolar realista de 18 peldaños (9 + descanso intermedio + 9)
      // conectando hasta el nivel del 2° piso (y = 3.78m) con desembarco abierto lateral sin Z-fighting.
      const slabThickness = 0.28;
      const upperFloorY = wallH + slabThickness; // 3.78m
      const upperCeilY = upperFloorY + wallH; // 7.28m
      const openSide = centerX < 0 ? 1 : -1;

      // Descanso inferior de arranque en planta baja (z = 2.40 .. 3.95, sin solapar mainFloor en z <= 2.40)
      const entryLanding = new THREE.Mesh(new THREE.PlaneGeometry(3.16, 1.55), mats.roomFloorMat);
      entryLanding.rotation.x = -Math.PI / 2;
      entryLanding.position.set(0, 0.002, 3.175);
      entryLanding.receiveShadow = !this.isSoftwareGl;
      pocket.add(entryLanding);

      // Cielo raso alto del cubo de escaleras (techo del 2° piso sobre toda la caja)
      const stairwellCeil = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 10.85), mats.ceilingMat);
      stairwellCeil.rotation.x = Math.PI / 2;
      stairwellCeil.position.set(0, upperCeilY, 7.675);
      pocket.add(stairwellCeil);

      // Dintel de losa en el umbral del corredor 1F (z = 2.4) y muro frontal superior separado por 5mm
      const entranceHeader = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, slabThickness - 0.006, 0.26),
        mats.cedarTimberMat
      );
      entranceHeader.position.set(0, wallH + slabThickness * 0.5, 2.4);
      pocket.add(entranceHeader);
      this.addBoxWall(
        pocket,
        0,
        upperFloorY + wallH * 0.5,
        2.4,
        3.64,
        wallH - 0.006,
        0.24,
        mats.wallShortMat
      );

      // Muros laterales en 1F (y = 0 .. 3.495), viga de entrepiso (3.50 .. 3.775) y muros 2F (3.78 .. 7.28)
      this.addBoxWall(pocket, -1.7, (wallH - 0.005) * 0.5, 7.675, 0.24, wallH - 0.005, 10.75, mats.wallShortMat);
      this.addBoxWall(pocket, 1.7, (wallH - 0.005) * 0.5, 7.675, 0.24, wallH - 0.005, 10.75, mats.wallShortMat);
      [-1.7, 1.7].forEach((wx) => {
        const slabBand = new THREE.Mesh(
          new THREE.BoxGeometry(0.26, slabThickness - 0.006, 10.75),
          mats.cedarTimberMat
        );
        slabBand.position.set(wx, wallH + slabThickness * 0.5, 7.675);
        pocket.add(slabBand);
      });

      this.addBoxWall(
        pocket,
        -openSide * 1.7,
        upperFloorY + wallH * 0.5,
        7.675,
        0.24,
        wallH - 0.004,
        10.75,
        mats.wallShortMat
      );
      this.addBoxWall(
        pocket,
        openSide * 1.7,
        upperFloorY + wallH * 0.5,
        6.245,
        0.24,
        wallH - 0.004,
        7.89,
        mats.wallShortMat
      );

      // Parámetros del tramo doble: 9 + descanso (1.20m) + 9 = 18 escalones totales -> y = 3.78m
      const stepsPerFlight = 9;
      const stepRise = 0.21;
      const stepRun = 0.28;
      const zStart = 3.95;
      const flightRun = stepsPerFlight * stepRun; // 2.52m
      const flightRise = stepsPerFlight * stepRise; // 1.89m
      const midLandingDepth = 1.2;
      const zMidStart = zStart + flightRun; // 6.47m
      const zUpperStart = zMidStart + midLandingDepth; // 7.67m
      const zTopEnd = zUpperStart + flightRun; // 10.19m
      const diagLen = Math.hypot(flightRun, flightRise);
      const slopeAngle = Math.atan2(flightRise, flightRun);
      const railX = 1.44; // Estrictamente fuera del ancho de huella (2.78m -> ±1.39m) para cero intersecciones

      const treadThick = 0.042;
      const riserThick = 0.036;

      const buildAscendingFlight = (baseZ: number, baseY: number) => {
        for (let s = 0; s < stepsPerFlight; s++) {
          const yTop = baseY + (s + 1) * stepRise;
          const zStepFront = baseZ + s * stepRun;
          const zStepBack = zStepFront + stepRun;
          const isLastStep = s === stepsPerFlight - 1;

          // 1. Contrahuella vertical retrasada 2.4cm respecto al borde frontal de la huella (cero caras coplanares)
          const riserHeight = stepRise - 0.036;
          const riserBottomY = baseY + s * stepRise - (s === 0 ? 0 : 0.004);
          const riser = new THREE.Mesh(
            new THREE.BoxGeometry(2.72, riserHeight, riserThick),
            riserMat
          );
          riser.position.set(
            0,
            riserBottomY + riserHeight * 0.5,
            zStepFront + riserThick * 0.5
          );
          riser.receiveShadow = !this.isSoftwareGl;
          pocket.add(riser);

          // 2. Huella horizontal con vuelo frontal de 2.4cm y entrega limpia hacia la siguiente contrahuella
          const treadFrontZ = zStepFront - 0.024;
          const treadBackZ = isLastStep ? zStepBack : zStepBack + 0.016;
          const treadDepth = treadBackZ - treadFrontZ;
          const tread = new THREE.Mesh(
            new THREE.BoxGeometry(2.78, treadThick, treadDepth),
            mats.stairTreadMat
          );
          tread.position.set(
            0,
            yTop - treadThick * 0.5,
            treadFrontZ + treadDepth * 0.5
          );
          tread.receiveShadow = !this.isSoftwareGl;
          tread.castShadow = !this.isSoftwareGl;
          pocket.add(tread);

          // 3. Cantonera antideslizante elevada 6mm sobre la huella y 5mm delante del borde (cero Z-fighting)
          const nosing = new THREE.Mesh(
            new THREE.BoxGeometry(2.76, 0.012, 0.028),
            nosingMat
          );
          nosing.position.set(0, yTop + 0.001, zStepFront - 0.015);
          pocket.add(nosing);
        }

        // Losa inclinada estructural hundida 0.22m bajo los peldaños para nunca atravesar huellas/contrahuellas
        const soffit = new THREE.Mesh(
          new THREE.BoxGeometry(2.74, 0.12, diagLen + 0.06),
          mats.cedarTimberMat
        );
        soffit.position.set(0, baseY + flightRise * 0.5 - 0.22, baseZ + flightRun * 0.5);
        soffit.rotation.x = -slopeAngle;
        pocket.add(soffit);

        // Zancas, postes maestros, pasamanos y balaustres en madera oscura fuera del ancho de peldaños
        [-railX, railX].forEach((rx) => {
          const stringer = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.24, diagLen + 0.14),
            mats.cedarTimberMat
          );
          stringer.position.set(rx * 1.03, baseY + flightRise * 0.5 - 0.11, baseZ + flightRun * 0.5);
          stringer.rotation.x = -slopeAngle;
          stringer.castShadow = !this.isSoftwareGl;
          pocket.add(stringer);

          const postBottom = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.02, 0.1), mats.cedarTimberMat);
          postBottom.position.set(rx, baseY + 0.51, baseZ - 0.04);
          pocket.add(postBottom);

          const postTop = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.02, 0.1), mats.cedarTimberMat);
          postTop.position.set(rx, baseY + flightRise + 0.51, baseZ + flightRun + 0.04);
          pocket.add(postTop);

          const rail = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.055, diagLen + 0.16),
            mats.cedarTimberMat
          );
          rail.position.set(rx, baseY + 0.96 + flightRise * 0.5, baseZ + flightRun * 0.5);
          rail.rotation.x = -slopeAngle;
          pocket.add(rail);

          for (let b = 1; b <= 4; b++) {
            const t = b / 5;
            const bal = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.94, 0.042), mats.cedarTimberMat);
            bal.position.set(rx, baseY + t * flightRise + 0.47, baseZ + t * flightRun);
            pocket.add(bal);
          }
        });
      };

      // Primer tramo (peldaños 1..9)
      buildAscendingFlight(zStart, 0);

      // Descanso intermedio (y = 1.89m, z = 6.473 .. 7.686) sin solaparse con el peldaño 9 ni el 10
      const midDeckStartZ = zMidStart + 0.003;
      const midDeckEndZ = zUpperStart + 0.016;
      const midDeckDepth = midDeckEndZ - midDeckStartZ;
      const midLandingCenterZ = midDeckStartZ + midDeckDepth * 0.5;
      const midLandingDeck = new THREE.Mesh(
        new THREE.BoxGeometry(3.14, 0.16, midDeckDepth),
        mats.stairTreadMat
      );
      midLandingDeck.position.set(0, flightRise - 0.08, midLandingCenterZ);
      midLandingDeck.receiveShadow = !this.isSoftwareGl;
      pocket.add(midLandingDeck);

      const underMidHeight = flightRise - 0.17;
      const underMidWall = new THREE.Mesh(
        new THREE.BoxGeometry(3.14, underMidHeight, 0.22),
        mats.cedarTimberMat
      );
      underMidWall.position.set(0, underMidHeight * 0.5, zMidStart + 0.14);
      pocket.add(underMidWall);

      [-railX, railX].forEach((rx) => {
        const midRail = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.055, midLandingDepth - 0.04),
          mats.cedarTimberMat
        );
        midRail.position.set(rx, flightRise + 0.96, zMidStart + midLandingDepth * 0.5);
        pocket.add(midRail);

        [0.33, 0.67].forEach((t) => {
          const bal = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.94, 0.042), mats.cedarTimberMat);
          bal.position.set(rx, flightRise + 0.47, zMidStart + midLandingDepth * t);
          pocket.add(bal);
        });
      });

      // Segundo tramo (peldaños 10..18 -> y = 1.89m .. 3.78m)
      buildAscendingFlight(zUpperStart, flightRise);

      // Base cerrada bajo el desembarco superior (y = 0 .. 3.49m, estrictamente por debajo de la losa 2F)
      const underTopHeight = wallH - 0.01;
      const underTopWall = new THREE.Mesh(
        new THREE.BoxGeometry(3.14, underTopHeight, 0.24),
        mats.cedarTimberMat
      );
      underTopWall.position.set(0, underTopHeight * 0.5, zTopEnd + 0.15);
      pocket.add(underTopWall);

      [-1.55, 1.55].forEach((bx) => {
        const midBaseboard = new THREE.Mesh(
          new THREE.BoxGeometry(0.045, 0.14, midLandingDepth - 0.04),
          mats.cedarTimberMat
        );
        midBaseboard.position.set(bx, flightRise + 0.072, zMidStart + midLandingDepth * 0.5);
        pocket.add(midBaseboard);
      });

      // Desembarco superior en nivel 2° Piso (y = 3.78m, z = 10.193 .. 12.95)
      const topLandingDepth = 2.757;
      const topLandingCenterZ = zTopEnd + 0.003 + topLandingDepth * 0.5;
      const topLandingSlab = new THREE.Mesh(
        new THREE.BoxGeometry(3.16, slabThickness - 0.006, topLandingDepth),
        mats.cedarTimberMat
      );
      topLandingSlab.position.set(0, upperFloorY - slabThickness * 0.5 - 0.003, topLandingCenterZ);
      pocket.add(topLandingSlab);

      const topLandingFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(3.16, topLandingDepth),
        mats.roomFloorMat
      );
      topLandingFloor.rotation.x = -Math.PI / 2;
      topLandingFloor.position.set(0, upperFloorY + 0.002, topLandingCenterZ);
      topLandingFloor.receiveShadow = !this.isSoftwareGl;
      pocket.add(topLandingFloor);

      const outerSideX = -openSide * railX;
      const topReturnRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.055, 1.35), mats.cedarTimberMat);
      topReturnRail.position.set(outerSideX, upperFloorY + 0.96, zTopEnd + 0.68);
      pocket.add(topReturnRail);

      const topReturnPost = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.02, 0.1), mats.cedarTimberMat);
      topReturnPost.position.set(outerSideX, upperFloorY + 0.51, zTopEnd + 1.32);
      pocket.add(topReturnPost);

      // Abertura arquitectónica hacia el pasillo superior del 2° Piso
      const archPillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, wallH - 0.006, 0.26),
        mats.cedarTimberMat
      );
      archPillar.position.set(openSide * 1.7, upperFloorY + wallH * 0.5, zTopEnd);
      pocket.add(archPillar);

      const archLintel = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.72, topLandingDepth + 0.16),
        mats.cedarTimberMat
      );
      archLintel.position.set(openSide * 1.7, upperCeilY - 0.36, topLandingCenterZ);
      pocket.add(archLintel);

      // Galería / corredor superior visible al terminar los 18 escalones
      const galleryLen = 4.8;
      const galleryCenterX = openSide * (1.704 + galleryLen * 0.5);
      const gallerySlab = new THREE.Mesh(
        new THREE.BoxGeometry(galleryLen, slabThickness - 0.006, topLandingDepth),
        mats.cedarTimberMat
      );
      gallerySlab.position.set(galleryCenterX, upperFloorY - slabThickness * 0.5 - 0.003, topLandingCenterZ);
      pocket.add(gallerySlab);

      const galleryFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(galleryLen, topLandingDepth),
        mats.roomFloorMat
      );
      galleryFloor.rotation.x = -Math.PI / 2;
      galleryFloor.position.set(galleryCenterX, upperFloorY + 0.002, topLandingCenterZ);
      galleryFloor.receiveShadow = !this.isSoftwareGl;
      pocket.add(galleryFloor);

      const galleryCeil = new THREE.Mesh(
        new THREE.PlaneGeometry(galleryLen, topLandingDepth),
        mats.ceilingMat
      );
      galleryCeil.rotation.x = Math.PI / 2;
      galleryCeil.position.set(galleryCenterX, upperCeilY, topLandingCenterZ);
      pocket.add(galleryCeil);

      this.addBoxWall(
        pocket,
        galleryCenterX,
        upperFloorY + wallH * 0.5,
        zTopEnd - 0.08,
        galleryLen,
        wallH - 0.004,
        0.24,
        mats.wallShortMat
      );
      this.addBoxWall(
        pocket,
        galleryCenterX,
        upperFloorY + wallH * 0.5,
        13.05,
        galleryLen,
        wallH - 0.004,
        0.24,
        mats.wallShortMat
      );
      this.addBoxWall(
        pocket,
        openSide * (1.7 + galleryLen),
        upperFloorY + wallH * 0.5,
        topLandingCenterZ,
        0.24,
        wallH - 0.004,
        topLandingDepth + 0.24,
        mats.wallShortMat
      );

      const upperEndDoor = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 2.45, 1.65),
        mats.slidingDoorMat
      );
      upperEndDoor.position.set(
        openSide * (1.7 + galleryLen - 0.16),
        upperFloorY + 1.227,
        topLandingCenterZ
      );
      pocket.add(upperEndDoor);

      const upperBaseboard = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.14, topLandingDepth - 0.06),
        mats.cedarTimberMat
      );
      upperBaseboard.position.set(-openSide * 1.55, upperFloorY + 0.072, topLandingCenterZ);
      pocket.add(upperBaseboard);

      const upperLamp = new THREE.Mesh(
        new THREE.BoxGeometry(1.25, 0.07, 0.3),
        new THREE.MeshStandardMaterial({
          color: '#e0f2fe',
          emissive: '#bae6fd',
          emissiveIntensity: 1.25,
          roughness: 0.2,
        })
      );
      upperLamp.position.set(openSide * 3.1, upperCeilY - 0.04, topLandingCenterZ);
      pocket.add(upperLamp);

      // Muro posterior del hueco de escalera (z = 13.05) con ventanal alto escolar japonés
      const backZ = 13.05;
      this.addBoxWall(pocket, 0, 2.272, backZ, 3.64, 4.545, 0.24, mats.wallShortMat);
      this.addBoxWall(pocket, 0, 6.965, backZ, 3.64, 0.625, 0.24, mats.wallShortMat);
      this.addBoxWall(pocket, -1.35, 5.6, backZ, 0.94, 2.09, 0.24, mats.wallShortMat);
      this.addBoxWall(pocket, 1.35, 5.6, backZ, 0.94, 2.09, 0.24, mats.wallShortMat);

      const stairWinW = 1.76;
      const stairWinH = 2.09;
      const stairWinY = 5.6;
      const winGlassMat = new THREE.MeshStandardMaterial({
        color: '#8faab0',
        emissive: '#3e5c69',
        emissiveIntensity: 0.34,
        roughness: 0.2,
        metalness: 0.05,
        transparent: true,
        opacity: 0.72,
      });
      const winPane = new THREE.Mesh(new THREE.PlaneGeometry(stairWinW, stairWinH), winGlassMat);
      winPane.position.set(0, stairWinY, backZ - 0.04);
      winPane.rotation.y = Math.PI;
      pocket.add(winPane);

      [-0.86, 0, 0.86].forEach((mx) => {
        const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, stairWinH, 0.12), mats.cedarTimberMat);
        vBar.position.set(mx, stairWinY, backZ - 0.03);
        pocket.add(vBar);
      });
      [-1.02, -0.34, 0.34, 1.02].forEach((my) => {
        const hBar = new THREE.Mesh(new THREE.BoxGeometry(stairWinW, 0.055, 0.12), mats.cedarTimberMat);
        hBar.position.set(0, stairWinY + my, backZ - 0.03);
        pocket.add(hBar);
      });

      const stairWindowLight = new THREE.PointLight('#8ab0c4', 1.15, 16);
      stairWindowLight.position.set(0, 5.6, 11.4);
      pocket.add(stairWindowLight);

      const upperHallLight = new THREE.PointLight('#b8d0de', 0.95, 11);
      upperHallLight.position.set(openSide * 2.8, upperFloorY + 2.4, topLandingCenterZ);
      pocket.add(upperHallLight);
    } else {
      // 2F -> Descanso superior alineado exactamente hasta el inicio del tiro descendente (z = 2.40 .. 3.95)
      const landing = new THREE.Mesh(new THREE.PlaneGeometry(3.16, 1.55), mats.roomFloorMat);
      landing.rotation.x = -Math.PI / 2;
      landing.position.set(0, 0.002, 3.175);
      landing.receiveShadow = !this.isSoftwareGl;
      pocket.add(landing);

      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 5.6), mats.ceilingMat);
      ceil.rotation.x = Math.PI / 2;
      ceil.position.set(0, wallH + 1.2, 5.1);
      pocket.add(ceil);

      // Paredes superiores del hueco de escalera (y = 0.004 .. 4.7)
      this.addBoxWall(pocket, -1.7, 2.352, 5.05, 0.24, 4.695, 5.5, mats.wallShortMat);
      this.addBoxWall(pocket, 1.7, 2.352, 5.05, 0.24, 4.695, 5.5, mats.wallShortMat);
      this.addBoxWall(pocket, 0, 2.352, 7.75, 3.6, 4.695, 0.24, mats.wallShortMat);

      const stepCount = 10;
      const stepRise = 0.22;
      const stepRun = 0.28;
      const zStart = 3.95;
      const totalRun = stepCount * stepRun; // 2.80m -> termina en z = 6.75
      const totalRise = stepCount * stepRise; // 2.20m
      const diagLen = Math.hypot(totalRun, totalRise);
      const slopeAngle = Math.atan2(totalRise, totalRun);

      // Cierre inferior del hueco de escalera (y = -2.60 .. -0.004) separado de muros superiores
      const shaftLowerWallMat = new THREE.MeshStandardMaterial({
        color: '#4e5850',
        roughness: 0.9,
        metalness: 0.02,
        envMapIntensity: 0.22,
      });

      const shaftLeft = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.59, 5.5), shaftLowerWallMat);
      shaftLeft.position.set(-1.7, -1.3, 5.05);
      pocket.add(shaftLeft);

      const shaftRight = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.59, 5.5), shaftLowerWallMat);
      shaftRight.position.set(1.7, -1.3, 5.05);
      pocket.add(shaftRight);

      const shaftBack = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.59, 0.24), shaftLowerWallMat);
      shaftBack.position.set(0, -1.3, 7.75);
      pocket.add(shaftBack);

      // Faldón bajo el descanso superior desplazado hacia -Z (z = 3.81) para no tocar la 1.ª contrahuella
      const fasciaWall = new THREE.Mesh(new THREE.BoxGeometry(3.16, 2.54, 0.14), shaftLowerWallMat);
      fasciaWall.position.set(0, -1.33, zStart - 0.14);
      pocket.add(fasciaWall);

      // Descanso inferior al pie de las escaleras (z = 6.754 .. 7.68) sin solaparse con el último peldaño
      const lowerLanding = new THREE.Mesh(new THREE.PlaneGeometry(3.16, 0.92), mats.roomFloorMat);
      lowerLanding.rotation.x = -Math.PI / 2;
      lowerLanding.position.set(0, -totalRise + 0.002, zStart + totalRun + 0.464);
      lowerLanding.receiveShadow = !this.isSoftwareGl;
      pocket.add(lowerLanding);

      const wellLight = new THREE.PointLight('#8fa8b8', 0.85, 10);
      wellLight.position.set(0, 1.75, 5.6);
      pocket.add(wellLight);

      const treadThick = 0.042;
      const riserThick = 0.036;
      const railX = 1.4;

      // Cantonera de arranque en el borde del descanso superior (z = 3.95)
      const startNosing = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.012, 0.028), nosingMat);
      startNosing.position.set(0, 0.003, zStart - 0.008);
      pocket.add(startNosing);

      for (let s = 0; s < stepCount; s++) {
        const yTop = -(s + 1) * stepRise;
        const zStepFront = zStart + s * stepRun;
        const zStepBack = zStepFront + stepRun;
        const isLastStep = s === stepCount - 1;

        // 1. Contrahuella vertical retrasada respecto al borde de salida (+Z) del peldaño superior
        const riserHeight = stepRise - 0.036;
        const riser = new THREE.Mesh(
          new THREE.BoxGeometry(2.66, riserHeight, riserThick),
          riserMat
        );
        riser.position.set(
          0,
          yTop + riserHeight * 0.5 - 0.004,
          zStepFront - riserThick * 0.5
        );
        riser.receiveShadow = !this.isSoftwareGl;
        pocket.add(riser);

        // 2. Huella horizontal con vuelo hacia +Z y entrega limpia bajo la contrahuella anterior
        const treadBackZ = zStepFront - 0.016;
        const treadFrontZ = isLastStep ? zStepBack : zStepBack + 0.024;
        const treadDepth = treadFrontZ - treadBackZ;
        const tread = new THREE.Mesh(
          new THREE.BoxGeometry(2.72, treadThick, treadDepth),
          mats.stairTreadMat
        );
        tread.position.set(
          0,
          yTop - treadThick * 0.5,
          treadBackZ + treadDepth * 0.5
        );
        tread.receiveShadow = !this.isSoftwareGl;
        tread.castShadow = !this.isSoftwareGl;
        pocket.add(tread);

        // 3. Cantonera antideslizante en el borde de bajada (+Z), elevada para cero Z-fighting
        const nosing = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.012, 0.028), nosingMat);
        nosing.position.set(0, yTop + 0.001, zStepBack + 0.015);
        pocket.add(nosing);
      }

      // Zancas laterales fuera del ancho de peldaños y pasamanos descendentes en madera oscura
      [-railX, railX].forEach((rx) => {
        const stringer = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.24, diagLen + 0.12),
          mats.cedarTimberMat
        );
        stringer.position.set(rx * 1.03, -totalRise * 0.5 - 0.14, zStart + totalRun * 0.5);
        stringer.rotation.x = slopeAngle;
        pocket.add(stringer);

        const postTop = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.02, 0.1), mats.cedarTimberMat);
        postTop.position.set(rx, 0.51, zStart - 0.04);
        pocket.add(postTop);

        const postBottom = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.02, 0.1), mats.cedarTimberMat);
        postBottom.position.set(rx, -totalRise + 0.51, zStart + totalRun + 0.04);
        pocket.add(postBottom);

        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(0.075, 0.055, diagLen + 0.18),
          mats.cedarTimberMat
        );
        rail.position.set(rx, 0.96 - totalRise * 0.5, zStart + totalRun * 0.5);
        rail.rotation.x = slopeAngle;
        pocket.add(rail);

        for (let b = 1; b <= 4; b++) {
          const t = b / 5;
          const bal = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.94, 0.042), mats.cedarTimberMat);
          bal.position.set(rx, -t * totalRise + 0.47, zStart + t * totalRun);
          pocket.add(bal);
        }
      });
    }

    // Conserva colisionadores de muros del hueco (`wall`) y excluye peldaños/balaustres lejanos del área transitable
    pocket.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && !child.userData.colliderKind) {
        child.userData.noCollision = true;
      }
    });

    group.add(pocket);
  }

  private buildFloor1Props(maxAniso: number, timberMat: THREE.Material) {
    // 1. Vestibule Notice Board (near objeto_vestibulo at (2.2, 0, -1.6))
    const boardGroup = new THREE.Group();
    boardGroup.position.set(2.2, 0, -3.95);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.35, 0.1), timberMat);
    frame.position.y = 1.65;
    frame.userData.colliderKind = 'furniture';
    boardGroup.add(frame);

    const corkMat = new THREE.MeshStandardMaterial({ color: '#9c6f44', roughness: 0.9 });
    const cork = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.15), corkMat);
    cork.position.set(0, 1.65, 0.06);
    cork.userData.noCollision = true;
    boardGroup.add(cork);

    const paperMat = new THREE.MeshStandardMaterial({ color: '#faf6ee', roughness: 0.8 });
    [-0.6, 0, 0.62].forEach((px, idx) => {
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.62), paperMat);
      sheet.position.set(px, 1.68 + (idx % 2) * 0.05, 0.07);
      sheet.rotation.z = (idx - 1) * 0.04;
      sheet.userData.noCollision = true;
      boardGroup.add(sheet);
    });
    this.floor1Group.add(boardGroup);

    // 2. Armario de Limpieza (1F West Room: x=-24.5, z=-23.8) — Composite 8-part Janitor Closet
    const closetGroup = new THREE.Group();
    closetGroup.position.set(-24.5, 0, -23.95);

    const cabinetMat = new THREE.MeshStandardMaterial({ color: '#583922', roughness: 0.62, metalness: 0.08 });
    const brassMat = new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.25, metalness: 0.85 });

    const carcass = new THREE.Mesh(new THREE.BoxGeometry(1.75, 2.35, 0.78), cabinetMat);
    carcass.position.y = 1.175;
    carcass.userData.colliderKind = 'furniture';
    closetGroup.add(carcass);

    const crown = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.1, 0.86), timberMat);
    crown.position.y = 2.4;
    crown.userData.noCollision = true;
    closetGroup.add(crown);

    // Hinged right door that swings slightly open when unlocked
    this.closetDoorPivot = new THREE.Group();
    this.closetDoorPivot.position.set(0.82, 1.175, 0.4);
    this.closetDoorPivot.userData.noCollision = true;
    const rightDoor = new THREE.Mesh(new THREE.BoxGeometry(0.82, 2.2, 0.06), cabinetMat);
    rightDoor.position.set(-0.41, 0, 0);
    this.closetDoorPivot.add(rightDoor);

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 10), brassMat);
    handle.position.set(-0.72, 0, 0.05);
    this.closetDoorPivot.add(handle);
    closetGroup.add(this.closetDoorPivot);

    // Mop bucket & broom beside closet
    const bucketMat = new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.35, metalness: 0.15 });
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.19, 0.38, 16), bucketMat);
    bucket.position.set(-1.25, 0.19, 0.2);
    bucket.userData.colliderKind = 'furniture';
    closetGroup.add(bucket);

    const broomStick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.45, 8), timberMat);
    broomStick.position.set(-1.22, 0.72, 0.2);
    broomStick.rotation.z = 0.14;
    broomStick.userData.noCollision = true;
    closetGroup.add(broomStick);

    const roomLight1 = new THREE.PointLight('#d9b98b', 1.15, 11);
    roomLight1.position.set(-26.0, 2.9, -21.5);
    this.floor1Group.add(roomLight1);
    this.floor1Group.add(closetGroup);

    // 3. Aparcabicicletas y Patio Exterior (1F East Courtyard: x: 21.8..30.5, z: -25.2..-15.1)
    // Concreto/asfalto frío húmedo PBR extendido + muros japoneses de bloques de concreto con reja metálica y setos oscuros
    const outdoorMaps = createOutdoorConcretePbrMaps(maxAniso);
    [outdoorMaps.map, outdoorMaps.roughnessMap, outdoorMaps.bumpMap].forEach((tex) => {
      tex.repeat.set(7.5, 6);
      this.sharedTextures.push(tex);
    });
    const outdoorConcreteMat = new THREE.MeshStandardMaterial({
      map: outdoorMaps.map,
      roughnessMap: outdoorMaps.roughnessMap,
      bumpMap: outdoorMaps.bumpMap,
      bumpScale: 0.02,
      roughness: 0.95,
      metalness: 0.04,
      envMapIntensity: 0.36,
    });

    const courtyardGround = new THREE.Mesh(new THREE.PlaneGeometry(32, 24), outdoorConcreteMat);
    courtyardGround.rotation.x = -Math.PI / 2;
    // Borde sur exacto en z = -15.1 (umbral de salida del pasillo este) para no pisar la madera interior ni viceversa
    courtyardGround.position.set(29.0, 0.005, -27.1);
    courtyardGround.receiveShadow = !this.isSoftwareGl;
    this.floor1Group.add(courtyardGround);

    // Patio Central exterior (x: -23.7..23.7, z: -36..-2.5) visible desde ventanales 1F y 2F (cero madera exterior)
    const centralCourtyardGround = new THREE.Mesh(new THREE.PlaneGeometry(47.4, 33.5), outdoorConcreteMat);
    centralCourtyardGround.rotation.x = -Math.PI / 2;
    centralCourtyardGround.position.set(0, -0.01, -19.25);
    centralCourtyardGround.receiveShadow = !this.isSoftwareGl;
    this.floor1Group.add(centralCourtyardGround);

    const centralCourtyardGround2F = new THREE.Mesh(new THREE.PlaneGeometry(54, 34), outdoorConcreteMat);
    centralCourtyardGround2F.rotation.x = -Math.PI / 2;
    centralCourtyardGround2F.position.set(0, -3.5, -19.5);
    this.floor2Group.add(centralCourtyardGround2F);

    // Luz exterior fría nublada coherente con la claridad azul-pizarra de los ventanales
    const courtyardFillLight = new THREE.PointLight('#7fa4b8', 1.05, 18);
    courtyardFillLight.position.set(26.2, 3.6, -20.8);
    this.floor1Group.add(courtyardFillLight);

    // Muros perimetrales japoneses de bloques de concreto desgastado + remate + reja metálica superior
    const blockWallTex = createConcreteBlockWallTexture(maxAniso);
    blockWallTex.repeat.set(3, 1);
    const blockWallTexSide = blockWallTex.clone();
    blockWallTexSide.repeat.set(3.5, 1);
    blockWallTexSide.needsUpdate = true;
    const blockWallTexCentral = blockWallTex.clone();
    blockWallTexCentral.repeat.set(14, 1);
    blockWallTexCentral.needsUpdate = true;
    this.sharedTextures.push(blockWallTex, blockWallTexSide, blockWallTexCentral);

    const concreteWallMat = new THREE.MeshStandardMaterial({
      map: blockWallTex,
      roughness: 0.9,
      metalness: 0.03,
      envMapIntensity: 0.28,
    });
    const concreteWallSideMat = new THREE.MeshStandardMaterial({
      map: blockWallTexSide,
      roughness: 0.9,
      metalness: 0.03,
      envMapIntensity: 0.28,
    });
    const concreteWallCentralMat = new THREE.MeshStandardMaterial({
      map: blockWallTexCentral,
      roughness: 0.9,
      metalness: 0.03,
      envMapIntensity: 0.26,
    });
    const copingMat = new THREE.MeshStandardMaterial({
      color: '#2d3233',
      roughness: 0.88,
      metalness: 0.04,
      envMapIntensity: 0.28,
    });
    const ironFenceMat = new THREE.MeshStandardMaterial({
      color: '#1b2024',
      roughness: 0.52,
      metalness: 0.72,
      envMapIntensity: 0.35,
    });

    const addSchoolPerimeterSpan = (
      targetGroup: THREE.Group,
      x1: number,
      z1: number,
      x2: number,
      z2: number,
      wallMat: THREE.Material
    ) => {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const spanLen = Math.hypot(dx, dz);
      const angle = Math.atan2(dx, dz); // rota para alinear a lo largo del eje Z local
      const span = new THREE.Group();
      span.position.set((x1 + x2) * 0.5, 0, (z1 + z2) * 0.5);
      span.rotation.y = angle;

      // Muro inferior de bloques de concreto (1.62m) + cornisa superior
      const baseWall = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.62, spanLen), wallMat);
      baseWall.position.y = 0.81;
      baseWall.castShadow = !this.isSoftwareGl;
      baseWall.receiveShadow = !this.isSoftwareGl;
      baseWall.userData.colliderKind = 'wall';
      span.add(baseWall);

      const coping = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, spanLen + 0.06), copingMat);
      coping.position.y = 1.67;
      coping.castShadow = !this.isSoftwareGl;
      coping.userData.noCollision = true;
      span.add(coping);

      // Pilares estructurales de concreto cada ~2.6m
      const pillarCount = Math.max(2, Math.round(spanLen / 2.6) + 1);
      for (let i = 0; i < pillarCount; i++) {
        const pz = -spanLen * 0.5 + (i / (pillarCount - 1)) * spanLen;
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.78, 0.36), copingMat);
        pillar.position.set(0, 0.89, pz);
        pillar.castShadow = !this.isSoftwareGl;
        pillar.userData.colliderKind = 'pillar';
        span.add(pillar);
      }

      // Reja metálica superior (y = 1.72 .. 2.62) para cerrar visualmente sin cortar el cielo
      [1.82, 2.58].forEach((ry) => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.045, spanLen), ironFenceMat);
        rail.position.y = ry;
        rail.userData.noCollision = true;
        span.add(rail);
      });
      const picketCount = Math.max(4, Math.floor(spanLen / 0.34));
      const picketGeo = new THREE.BoxGeometry(0.025, 0.86, 0.025);
      const pickets = new THREE.InstancedMesh(picketGeo, ironFenceMat, picketCount);
      pickets.userData.noCollision = true;
      const dummy = new THREE.Object3D();
      for (let p = 0; p < picketCount; p++) {
        const pz = -spanLen * 0.5 + ((p + 0.5) / picketCount) * spanLen;
        dummy.position.set(0, 2.2, pz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        pickets.setMatrixAt(p, dummy.matrix);
      }
      pickets.instanceMatrix.needsUpdate = true;
      span.add(pickets);

      targetGroup.add(span);
    };

    // Cierre completo de Aparcabicicletas: Norte (z=-25.2), Este (x=30.5) y Oeste (x=21.8)
    addSchoolPerimeterSpan(this.floor1Group, 21.8, -25.2, 30.5, -25.2, concreteWallMat);
    addSchoolPerimeterSpan(this.floor1Group, 30.5, -25.2, 30.5, -15.1, concreteWallSideMat);
    addSchoolPerimeterSpan(this.floor1Group, 21.8, -25.2, 21.8, -15.1, concreteWallSideMat);

    // Muro perimetral del fondo del patio central visible desde las ventanas de pasillo (1F y 2F)
    addSchoolPerimeterSpan(this.floor1Group, -23.7, -25.2, 21.8, -25.2, concreteWallCentralMat);

    // Setos densos oscuros pegados a los muros del aparcabicicletas para ocultar bordes duros
    const hedgeMat = new THREE.MeshStandardMaterial({
      color: '#1d281f',
      roughness: 0.9,
      envMapIntensity: 0.24,
    });
    const bushGeo = new THREE.DodecahedronGeometry(0.68, 1);
    const bushPositions: Array<[number, number, number]> = [
      // Base oeste del aparcabicicletas
      [22.35, 0.42, -16.2],
      [22.35, 0.48, -17.6],
      [22.35, 0.44, -19.2],
      [22.35, 0.5, -21.0],
      [22.35, 0.46, -22.8],
      [22.35, 0.48, -24.4],
      // Base norte detrás del aparcabicicletas
      [24.0, 0.46, -24.65],
      [25.6, 0.44, -24.65],
      [27.2, 0.48, -24.65],
      [29.4, 0.46, -24.65],
      // Costado este exterior detrás de la reja
      [30.95, 0.52, -16.4],
      [30.95, 0.56, -18.5],
      [30.95, 0.5, -20.8],
      [30.95, 0.58, -23.2],
      // Costado oeste exterior (patio central junto a la reja)
      [21.2, 0.55, -16.6],
      [21.2, 0.52, -19.4],
      [21.2, 0.58, -22.4],
    ];
    bushPositions.forEach(([bx, by, bz], idx) => {
      const bush = new THREE.Mesh(bushGeo, hedgeMat);
      bush.position.set(bx, by, bz);
      bush.scale.set(0.95 + (idx % 3) * 0.14, 0.8 + (idx % 2) * 0.18, 1.05);
      bush.castShadow = !this.isSoftwareGl;
      bush.receiveShadow = !this.isSoftwareGl;
      bush.userData.colliderKind = 'furniture';
      this.floor1Group.add(bush);
    });

    // Árboles oscuros más allá de las rejas (patio aparcabicicletas + patio central) para siluetas contra el cielo
    const trunkMat = new THREE.MeshStandardMaterial({
      color: '#241c16',
      roughness: 0.9,
      envMapIntensity: 0.25,
    });
    const foliageMat = new THREE.MeshStandardMaterial({
      color: '#243025',
      roughness: 0.84,
      envMapIntensity: 0.28,
    });
    const addCourtyardTree = (targetGroup: THREE.Group, tx: number, ty: number, tz: number) => {
      const tree = new THREE.Group();
      tree.position.set(tx, ty, tz);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 3.4, 8), trunkMat);
      trunk.position.y = 1.7;
      trunk.castShadow = !this.isSoftwareGl;
      trunk.userData.colliderKind = 'pillar';
      tree.add(trunk);
      const canopy1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.65, 1), foliageMat);
      canopy1.position.set(0, 3.7, 0);
      canopy1.castShadow = !this.isSoftwareGl;
      canopy1.userData.noCollision = true;
      tree.add(canopy1);
      const canopy2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 1), foliageMat);
      canopy2.position.set(0.7, 3.1, 0.4);
      canopy2.castShadow = !this.isSoftwareGl;
      canopy2.userData.noCollision = true;
      tree.add(canopy2);
      targetGroup.add(tree);
    };

    [
      [23.0, -27.2],
      [27.8, -27.8],
      [32.4, -22.5],
      [32.2, -17.8],
      [19.8, -20.5],
      [14.0, -21.5],
      [-14.5, -21.0],
      [-2.0, -22.5],
    ].forEach(([tx, tz]) => {
      addCourtyardTree(this.floor1Group, tx, 0, tz);
    });

    // Árboles en el patio central visibles desde las ventanas del 2° piso
    [
      [-15.5, -18.5],
      [-4.0, -21.0],
      [10.5, -19.5],
      [18.5, -17.5],
    ].forEach(([tx, tz]) => {
      addCourtyardTree(this.floor2Group, tx, -3.5, tz);
    });

    // Cobertizo metálico envejecido + 4 bicicletas con pintura apagada atmosférica
    const shelter = new THREE.Group();
    shelter.position.set(27.5, 0, -22.4);
    const steelMat = new THREE.MeshStandardMaterial({
      color: '#4e5963',
      roughness: 0.42,
      metalness: 0.78,
      envMapIntensity: 0.4,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: '#6f8c96',
      roughness: 0.28,
      metalness: 0.08,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      envMapIntensity: 0.38,
    });
    [-2.1, 2.1].forEach((sx) => {
      [-1.1, 1.1].forEach((sz) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.35, 10), steelMat);
        leg.position.set(sx, 1.175, sz);
        leg.castShadow = !this.isSoftwareGl;
        leg.userData.colliderKind = 'pillar';
        shelter.add(leg);
      });
    });
    [-1.1, 1.1].forEach((bz) => {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.06, 0.06), steelMat);
      beam.position.set(0, 2.34, bz);
      beam.castShadow = !this.isSoftwareGl;
      beam.userData.noCollision = true;
      shelter.add(beam);
    });
    const shelterRoof = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.07, 2.8), roofMat);
    shelterRoof.position.set(0, 2.4, 0);
    shelterRoof.rotation.x = 0.12;
    shelterRoof.userData.noCollision = true;
    shelter.add(shelterRoof);

    // 4 Bicicletas compuestas en tonos desgastados coherentes con la paleta nocturna
    const tireMat = new THREE.MeshStandardMaterial({ color: '#161514', roughness: 0.88, envMapIntensity: 0.25 });
    const frameColors = ['#6e1e24', '#1e3a54', '#6e541c', '#1f3d2b'];
    [-1.35, -0.45, 0.45, 1.35].forEach((bx, idx) => {
      const bike = this.createCompositeBicycle(frameColors[idx], steelMat, tireMat);
      bike.position.set(bx, 0, 0);
      bike.rotation.y = Math.PI / 2 + (idx % 2 === 0 ? 0.06 : -0.05);
      bike.userData.colliderKind = 'bike';
      shelter.add(bike);
    });
    this.floor1Group.add(shelter);

    // Vegetación y hojas en Aparcabicicletas usando geometría optimizada `leaf.glb` + THREE.InstancedMesh
    const leafLoaderHandle = loadAparcabicicletasLeafInstancing({
      targetGroup: this.floor1Group,
      isSoftwareGl: this.isSoftwareGl,
      onLoaded: (handle) => {
        if (this.disposed) {
          handle.dispose();
          return;
        }
        this.aparcabicicletasFoliageHandle = handle;
        this.leavesInstanced = handle.swirlingInstanced;
        this.leafSeeds = handle.swirlingSeeds;

        if (!this.isSoftwareGl) {
          handle.textures.forEach((tex) => this.renderer.initTexture(tex));
          if (this.hasCompletedBoot) {
            const prevVis = this.floor1Group.visible;
            this.floor1Group.visible = true;
            this.renderer.compile(this.scene, this.camera);
            this.floor1Group.visible = prevVis;
          }
        }
      },
    });
    this.cancelLeafLoad = leafLoaderHandle.cancel;

    // 4. Pasillo Aula 1B — Campanita de Viento Japonesa (Fūrin) en (-9.2, 0, -1.2)
    this.windChimeGroup = new THREE.Group();
    this.windChimeGroup.position.set(-9.2, 3.05, -1.2);

    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.65, 6), timberMat);
    cord.position.y = 0.2;
    this.windChimeGroup.add(cord);

    const bellGlassMat = new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      emissive: '#0284c7',
      emissiveIntensity: 0.35,
      roughness: 0.12,
      metalness: 0.2,
      transparent: true,
      opacity: 0.82,
    });
    const bellDome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.68), bellGlassMat);
    bellDome.position.y = -0.12;
    this.windChimeGroup.add(bellDome);

    const tanzakuSlip = new THREE.Mesh(
      new THREE.PlaneGeometry(0.11, 0.42),
      new THREE.MeshStandardMaterial({
        color: '#faf6ee',
        emissive: '#bae6fd',
        emissiveIntensity: 0.25,
        side: THREE.DoubleSide,
      })
    );
    tanzakuSlip.position.y = -0.52;
    this.windChimeGroup.add(tanzakuSlip);
    this.floor1Group.add(this.windChimeGroup);
  }

  private createCompositeBicycle(
    colorHex: string,
    steelMat: THREE.Material,
    tireMat: THREE.Material
  ): THREE.Group {
    const bike = new THREE.Group();
    const paintMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.44,
      metalness: 0.45,
      envMapIntensity: 0.38,
    });

    const wheelGeo = new THREE.TorusGeometry(0.32, 0.035, 10, 22);
    const backWheel = new THREE.Mesh(wheelGeo, tireMat);
    backWheel.position.set(-0.52, 0.35, 0);
    backWheel.castShadow = !this.isSoftwareGl;
    bike.add(backWheel);

    const frontWheel = new THREE.Mesh(wheelGeo, tireMat);
    frontWheel.position.set(0.52, 0.35, 0);
    frontWheel.castShadow = !this.isSoftwareGl;
    bike.add(frontWheel);

    const topTube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.92, 8), paintMat);
    topTube.position.set(0, 0.68, 0);
    topTube.rotation.z = Math.PI / 2;
    topTube.castShadow = !this.isSoftwareGl;
    bike.add(topTube);

    const seatPost = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.55, 8), paintMat);
    seatPost.position.set(-0.32, 0.58, 0);
    seatPost.rotation.z = 0.22;
    bike.add(seatPost);

    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.62, 8), steelMat);
    fork.position.set(0.44, 0.62, 0);
    fork.rotation.z = 0.24;
    bike.add(fork);

    const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.48, 8), steelMat);
    handlebar.position.set(0.38, 0.92, 0);
    handlebar.rotation.x = Math.PI / 2;
    bike.add(handlebar);

    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.14), tireMat);
    saddle.position.set(-0.38, 0.85, 0);
    bike.add(saddle);

    return bike;
  }

  private buildFloor2Props(_maxAniso: number, timberMat: THREE.Material) {
    // 1. Baños 2F (East Room: x: 22.0..30.0, z: -24.0..-15.0)
    // Stalls + Washbasins + Hanako's WebRTC / Light-Reactive Mirror at (29.75, 1.55, -21.2)
    const stallMat = new THREE.MeshStandardMaterial({ color: '#d6d3d1', roughness: 0.55 });
    for (let sz = -23.0; sz <= -19.4; sz += 1.75) {
      const partition = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.15, 0.06), stallMat);
      partition.position.set(22.9, 1.15, sz);
      partition.userData.colliderKind = 'furniture';
      this.floor2Group.add(partition);
    }

    // Countertop & Sinks along East Wall near objeto_hanako (27.6, 0, -21.2)
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.85, 3.6),
      new THREE.MeshStandardMaterial({ color: '#e7e5e4', roughness: 0.25 })
    );
    counter.position.set(29.45, 0.425, -21.2);
    counter.userData.colliderKind = 'furniture';
    this.floor2Group.add(counter);

    // Framed Mirror mapped live to Camera WebRTC VideoTexture or Procedural Mist Mirror
    const mirrorGroup = new THREE.Group();
    mirrorGroup.position.set(29.82, 1.65, -21.2);
    mirrorGroup.rotation.y = -Math.PI / 2;
    mirrorGroup.userData.noCollision = true;

    const mirrorFrame = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.45, 0.08), timberMat);
    mirrorGroup.add(mirrorFrame);

    this.hanakoMirrorMat = new THREE.MeshStandardMaterial({
      map: sensorService.getActiveVideoOrMirrorTexture(),
      emissive: new THREE.Color('#ea580c'),
      emissiveIntensity: 0.08,
      roughness: 0.14,
      metalness: 0.35,
    });
    const mirrorGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.18, 1.24), this.hanakoMirrorMat);
    mirrorGlass.position.z = 0.05;
    mirrorGroup.add(mirrorGlass);

    this.hanakoSealRing = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.39, 32),
      new THREE.MeshBasicMaterial({
        color: '#fb923c',
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
      })
    );
    this.hanakoSealRing.position.z = 0.06;
    mirrorGroup.add(this.hanakoSealRing);

    const bathLight = new THREE.PointLight('#94b8c8', 1.05, 12);
    bathLight.position.set(26.2, 2.95, -20.5);
    this.floor2Group.add(bathLight);
    this.floor2Group.add(mirrorGroup);

    // 2. Sala de Profesores 2F (West Room: x: -29.5..-22.5, z: -24.7..-18.1)
    // Chalkboard + Teacher Desks + Gyroscope-Reactive Astrolabe Sealed Compartment at (-24.5, 0, -23.4)
    const chalkboard = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 1.45, 0.07),
      new THREE.MeshStandardMaterial({ color: '#14532d', roughness: 0.78 })
    );
    chalkboard.position.set(-26.0, 1.85, -24.52);
    chalkboard.userData.colliderKind = 'furniture';
    this.floor2Group.add(chalkboard);

    const deskMat = new THREE.MeshStandardMaterial({ color: '#5c3d24', roughness: 0.5 });
    const mainDesk = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.82, 1.0), deskMat);
    mainDesk.position.set(-24.5, 0.41, -23.45);
    mainDesk.userData.colliderKind = 'furniture';
    this.floor2Group.add(mainDesk);

    const sideDesk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.82, 0.9), deskMat);
    sideDesk.position.set(-27.8, 0.41, -23.2);
    sideDesk.userData.colliderKind = 'furniture';
    this.floor2Group.add(sideDesk);

    // Composite Gyro-Reactive Sealed Astrolabe Box on Main Desk
    const cofferBase = new THREE.Group();
    cofferBase.position.set(-24.5, 0.84, -23.45);
    cofferBase.userData.noCollision = true;

    const lacquerMat = new THREE.MeshStandardMaterial({
      color: '#450a0a',
      roughness: 0.22,
      metalness: 0.25,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      roughness: 0.2,
      metalness: 0.9,
    });

    const boxBody = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.22, 0.52), lacquerMat);
    boxBody.position.y = 0.11;
    cofferBase.add(boxBody);

    this.astrolabeLidPivot = new THREE.Group();
    this.astrolabeLidPivot.position.set(0, 0.22, -0.25);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.54), lacquerMat);
    lid.position.set(0, 0.03, 0.25);
    this.astrolabeLidPivot.add(lid);
    cofferBase.add(this.astrolabeLidPivot);

    // Floating brass gyroscope gimbals above box that mirror real phone tilt!
    this.astrolabeOuterGimbal = new THREE.Group();
    this.astrolabeOuterGimbal.position.set(0, 0.52, 0);
    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.018, 12, 32), goldMat);
    this.astrolabeOuterGimbal.add(outerRing);

    this.astrolabeInnerGimbal = new THREE.Group();
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.015, 12, 28), goldMat);
    innerRing.rotation.y = Math.PI / 2;
    this.astrolabeInnerGimbal.add(innerRing);

    const coreCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.07, 0),
      new THREE.MeshStandardMaterial({
        color: '#fde047',
        emissive: '#f59e0b',
        emissiveIntensity: 0.7,
        roughness: 0.15,
      })
    );
    this.astrolabeInnerGimbal.add(coreCrystal);
    this.astrolabeOuterGimbal.add(this.astrolabeInnerGimbal);
    cofferBase.add(this.astrolabeOuterGimbal);

    const staffLight = new THREE.PointLight('#d9c296', 1.2, 12);
    staffLight.position.set(-25.8, 2.95, -21.5);
    this.floor2Group.add(staffLight);
    this.floor2Group.add(cofferBase);
  }

  private buildMarkers() {
    WORLD_MARKERS.forEach((marker) => {
      const root = new THREE.Group();
      root.userData.isInteractiveMarker = true;
      root.position.set(marker.position[0], marker.position[1], marker.position[2]);

      const accentHex =
        marker.kind === 'personaje'
          ? '#38bdf8'
          : marker.kind === 'escalera'
          ? '#facc15'
          : '#f43f5e';

      // Soft contact shadow disk on floor (prevent floating look)
      const shadowDisk = new THREE.Mesh(
        new THREE.CircleGeometry(0.68, 24),
        new THREE.MeshBasicMaterial({
          color: '#000000',
          transparent: true,
          opacity: 0.42,
          depthWrite: false,
        })
      );
      shadowDisk.rotation.x = -Math.PI / 2;
      shadowDisk.position.y = 0.012;
      root.add(shadowDisk);

      // Grounded emissive marker ring matching the Map Glossary colors
      const ringMesh = new THREE.Mesh(
        new THREE.RingGeometry(0.46, 0.62, 32),
        new THREE.MeshBasicMaterial({
          color: accentHex,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.88,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        })
      );
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.022;
      root.add(ringMesh);

      const fallbackVisual = new THREE.Group();
      root.add(fallbackVisual);

      const floatingCore = new THREE.Group();
      fallbackVisual.add(floatingCore);

      let standeeMesh: THREE.Mesh | undefined;

      if (marker.kind === 'personaje') {
        // Fallback visual while GLB loads
        const standeeTex = createCharacterStandeeTexture(marker.portraitUrl || '', marker.label);
        const standeeMat = new THREE.MeshStandardMaterial({
          map: standeeTex,
          roughness: 0.65,
          metalness: 0.02,
          transparent: true,
          side: THREE.DoubleSide,
        });
        standeeMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 1.62), standeeMat);
        standeeMesh.position.set(0, 1.05, 0);
        fallbackVisual.add(standeeMesh);

        const base = new THREE.Mesh(
          new THREE.CylinderGeometry(0.36, 0.42, 0.14, 16),
          new THREE.MeshStandardMaterial({ color: '#3b2514', roughness: 0.65 })
        );
        base.position.y = 0.07;
        fallbackVisual.add(base);

        const diamond = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.14, 0),
          new THREE.MeshStandardMaterial({
            color: '#38bdf8',
            emissive: '#0284c7',
            emissiveIntensity: 0.22,
            toneMapped: true,
            roughness: 0.25,
            metalness: 0.45,
          })
        );
        diamond.position.y = 2.08;
        floatingCore.add(diamond);
      } else if (marker.kind === 'objeto') {
        const gem = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.24, 0),
          new THREE.MeshStandardMaterial({
            color: '#f43f5e',
            emissive: '#e11d48',
            emissiveIntensity: 0.22,
            toneMapped: true,
            roughness: 0.25,
            metalness: 0.45,
          })
        );
        gem.position.y = 1.15;
        floatingCore.add(gem);

        const halo = new THREE.Mesh(
          new THREE.TorusGeometry(0.34, 0.02, 10, 28),
          new THREE.MeshStandardMaterial({
            color: '#fda4af',
            roughness: 0.28,
            metalness: 0.75,
          })
        );
        halo.position.y = 1.15;
        halo.rotation.x = Math.PI / 3;
        floatingCore.add(halo);
      } else {
        // Escalera Marker (Amber Gold Twin Ascending/Descending Chevrons)
        const stairMat = new THREE.MeshStandardMaterial({
          color: '#facc15',
          emissive: '#ca8a04',
          emissiveIntensity: 0.22,
          toneMapped: true,
          roughness: 0.28,
          metalness: 0.55,
          transparent: true,
          opacity: 0.36,
        });
        stairMat.needsUpdate = true;
        const coneDir = marker.targetFloor === 2 ? 1 : -1;
        [0.95, 1.32].forEach((cy) => {
          const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.28, 4), stairMat);
          cone.position.y = cy;
          if (coneDir < 0) cone.rotation.x = Math.PI;
          floatingCore.add(cone);
        });
      }

      // Simplified invisible cylinder proxy (DoubleSide so close-range internal rays hit cleanly)
      const hitProxy = new THREE.Mesh(
        new THREE.CylinderGeometry(0.78, 0.78, 2.45, 8),
        new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
      );
      hitProxy.position.y = 1.22;
      hitProxy.userData = { markerId: marker.id };
      root.add(hitProxy);
      this.hitProxies.push(hitProxy);

      const targetFloorGroup = marker.floor === 1 ? this.floor1Group : this.floor2Group;
      targetFloorGroup.add(root);

      const visRecord: MarkerVisual = {
        marker,
        root,
        floatingCore,
        fallbackVisual,
        ringMesh,
        standeeMesh,
        hitProxy,
      };
      this.markersById.set(marker.id, visRecord);

      // Attach official GLB marker ("objeto" or "persona") con rotación constante sobre Y en posición fija
      if (marker.kind === 'objeto' || marker.kind === 'personaje') {
        const glbKind = marker.kind === 'personaje' ? 'persona' : 'objeto';
        void this.attachAnimatedGlbMarker(glbKind, visRecord);
      }
    });

    this.syncMarkerVisibility();
  }

  private async attachAnimatedGlbMarker(
    glbKind: 'objeto' | 'persona',
    visRecord: MarkerVisual
  ) {
    try {
      const instance = await createGlbMarkerInstance(glbKind);

      if (this.disposed) {
        instance.dispose();
        return;
      }

      // Escala calibrada al pasillo escolar (altura ~1.92m, medallón a la altura de la vista ~1.60m)
      instance.root.scale.setScalar(0.265);
      instance.root.position.set(0, 0.08, 0);

      visRecord.fallbackVisual.visible = false;
      visRecord.glbInstance = instance;
      visRecord.root.add(instance.root);

      // Si el .glb corresponde a otro piso (ej. 2F), pre-compila sus materiales en GPU al cargar
      if (!this.isSoftwareGl && this.hasCompletedBoot && visRecord.marker.floor !== this.currentFloor) {
        const floorGroup = visRecord.marker.floor === 1 ? this.floor1Group : this.floor2Group;
        const prevFloorVisible = floorGroup.visible;
        const prevMarkerVisible = visRecord.root.visible;
        floorGroup.visible = true;
        visRecord.root.visible = true;
        instance.root.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((mat) => {
              if (mat && 'map' in mat && mat.map instanceof THREE.Texture) {
                this.renderer.initTexture(mat.map);
              }
            });
          }
        });
        this.renderer.compile(this.scene, this.camera);
        floorGroup.visible = prevFloorVisible;
        visRecord.root.visible = prevMarkerVisible;
      }
    } catch {
      // Mantiene activo el marcador procedural de respaldo si falla la red
    }
  }

  public getCurrentFloor(): FloorNumber {
    return this.currentFloor;
  }

  private renderCurrentFrame() {
    if (this.disposed) return;
    try {
      if (this.composer && !this.isSoftwareGl) {
        this.composer.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    } catch {
      // Evita interrumpir el ciclo principal si el contexto WebGL está temporalmente perdido
    }
  }

  public setFloor(
    floor: FloorNumber,
    spawnPos?: [number, number, number],
    yaw?: number,
    options?: { silentFloorNotice?: boolean }
  ) {
    this.currentFloor = floor;
    this.floor1Group.visible = floor === 1;
    this.floor2Group.visible = floor === 2;

    if (spawnPos) {
      this.playerPos.set(spawnPos[0], 1.65, spawnPos[2]);
    }
    if (typeof yaw === 'number') {
      this.playerYaw = yaw;
      this.playerPitch = 0;
    }

    // Sincroniza de inmediato cámara, skybox y escena para que el nuevo piso quede renderizado
    // detrás del telón negro antes de iniciar el barrido de salida.
    this.camera.position.copy(this.playerPos);
    _camEuler.set(
      THREE.MathUtils.clamp(this.playerPitch, -0.85, 0.85),
      this.playerYaw,
      0,
      'YXZ'
    );
    this.camera.quaternion.setFromEuler(_camEuler);
    this.camera.updateMatrixWorld();

    if (this.skybox) {
      this.skybox.mesh.position.set(this.playerPos.x, 0, this.playerPos.z);
    }

    if (this.lastNotifiedFloor !== floor) {
      this.lastNotifiedFloor = floor;
      if (!options?.silentFloorNotice) {
        this.callbacks.onFloorChangeNotice?.(floor);
      }
    }

    this.lastNearbyId = null;
    this.callbacks.onNearbyMarkerChange(null);
    this.updateSunShadowTracking();
    this.updateZoneAndProximity();
    this.updateReactiveWorldProps(0.016, this.clock.elapsedTime);

    // Descarta cualquier delta acumulado mientras ocurría la transición de piso
    this.clock.getDelta();

    if (this.hasCompletedBoot && !this.disposed) {
      this.renderCurrentFrame();
    }
  }

  public setGamePhase(phase: GamePhase) {
    this.currentPhase = phase;
    this.syncDestinationDoorVisuals();
    this.syncMarkerVisibility();
    this.updateZoneAndProximity();
  }

  public setFinalSubstate(substate: FinalSubstate) {
    this.finalSubstate = substate;
    this.syncDestinationDoorVisuals();
    this.syncMarkerVisibility();
    this.updateZoneAndProximity();
  }

  public setUnlockedObjects(objectIds: string[]) {
    this.unlockedObjects = new Set(objectIds);
    this.syncMarkerVisibility();
    this.updateZoneAndProximity();
  }

  private syncDestinationDoorVisuals() {
    const isDoorUnlocked =
      this.currentPhase === 'ESTADO_FINAL' &&
      (this.finalSubstate === 'puerta_desbloqueada' || this.finalSubstate === 'completada');

    if (this.destDoorThresholdRing) {
      this.destDoorThresholdRing.visible = isDoorUnlocked;
    }
  }

  private isMarkerEnabledInWorld(marker: WorldMarker): boolean {
    if (marker.id === 'objeto_puerta_destino') {
      return this.currentPhase === 'ESTADO_FINAL' && this.finalSubstate === 'pendiente';
    }
    if (marker.kind === 'objeto' && marker.challengeType) {
      return (
        marker.requiredPhase === this.currentPhase &&
        this.unlockedObjects.has(marker.id)
      );
    }
    return true;
  }

  private syncMarkerVisibility() {
    this.markersById.forEach((vis) => {
      vis.root.visible = this.isMarkerEnabledInWorld(vis.marker);
    });
  }

  public setMoveInput(x: number, y: number) {
    this.moveInput.x = THREE.MathUtils.clamp(x, -1, 1);
    this.moveInput.y = THREE.MathUtils.clamp(y, -1, 1);
  }

  public setMovementLocked(locked: boolean) {
    this.movementLocked = locked;
    if (locked) {
      this.moveInput.x = 0;
      this.moveInput.y = 0;
      this.keyState = {};
      soundEngine.footsteps.reset(false);
    }
  }

  public setExternalPause(paused: boolean) {
    this.externallyPaused = paused;
    if (!paused) {
      this.clock.getDelta();
    }
  }

  public resetCameraView() {
    this.playerPitch = 0;
  }

  public captureScreenshot(): string {
    if (this.composer && !this.isSoftwareGl) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    return this.renderer.domElement.toDataURL('image/png');
  }

  private isWalkable(x: number, z: number, floor: FloorNumber): WalkableRect | null {
    const floorData = this.floorCollisions?.[floor];
    if (floorData) {
      return findValidWalkableZone(x, z, floorData, PLAYER_COLLISION_RADIUS);
    }

    for (let i = 0; i < WALKABLE_ZONES.length; i++) {
      const r = WALKABLE_ZONES[i];
      if (r.floor !== floor) continue;
      if (
        x >= r.minX + PLAYER_COLLISION_RADIUS &&
        x <= r.maxX - PLAYER_COLLISION_RADIUS &&
        z >= r.minZ + PLAYER_COLLISION_RADIUS &&
        z <= r.maxZ - PLAYER_COLLISION_RADIUS
      ) {
        return r;
      }
    }
    return null;
  }

  private updateMovement(delta: number) {
    if (this.movementLocked) {
      this.playerPos.y = THREE.MathUtils.damp(this.playerPos.y, 1.65, 8, delta);
      soundEngine.updateFootsteps(delta, false, 0);
      this.camera.position.copy(this.playerPos);
      _camEuler.set(
        THREE.MathUtils.clamp(this.playerPitch, -0.85, 0.85),
        this.playerYaw,
        0,
        'YXZ'
      );
      this.camera.quaternion.setFromEuler(_camEuler);
      return;
    }

    let inputX = this.moveInput.x;
    let inputY = this.moveInput.y;

    // Desktop keyboard support (WASD + Arrows)
    if (this.keyState['KeyW'] || this.keyState['ArrowUp']) inputY += 1;
    if (this.keyState['KeyS'] || this.keyState['ArrowDown']) inputY -= 1;
    if (this.keyState['KeyD'] || this.keyState['ArrowRight']) inputX += 1;
    if (this.keyState['KeyA'] || this.keyState['ArrowLeft']) inputX -= 1;

    const mag = Math.hypot(inputX, inputY);
    if (mag > 0.04) {
      const normX = mag > 1 ? inputX / mag : inputX;
      const normY = mag > 1 ? inputY / mag : inputY;

      const moveSpeed = 4.6; // meters/sec comfortable corridor exploration pace
      _forward.set(-Math.sin(this.playerYaw), 0, -Math.cos(this.playerYaw));
      _right.set(Math.cos(this.playerYaw), 0, -Math.sin(this.playerYaw));

      _moveVec
        .set(0, 0, 0)
        .addScaledVector(_forward, normY * moveSpeed * delta)
        .addScaledVector(_right, normX * moveSpeed * delta);

      const prevX = this.playerPos.x;
      const prevZ = this.playerPos.z;
      const floorData = this.floorCollisions?.[this.currentFloor];

      if (floorData) {
        const resolved = resolvePlayerMovement(
          prevX,
          prevZ,
          _moveVec.x,
          _moveVec.z,
          floorData,
          PLAYER_COLLISION_RADIUS
        );
        this.playerPos.x = resolved.x;
        this.playerPos.z = resolved.z;
      } else {
        const nextX = prevX + _moveVec.x;
        const nextZ = prevZ + _moveVec.z;
        if (this.isWalkable(nextX, nextZ, this.currentFloor)) {
          this.playerPos.x = nextX;
          this.playerPos.z = nextZ;
        } else {
          if (this.isWalkable(nextX, this.playerPos.z, this.currentFloor)) {
            this.playerPos.x = nextX;
          }
          if (this.isWalkable(this.playerPos.x, nextZ, this.currentFloor)) {
            this.playerPos.z = nextZ;
          }
        }
      }

      const dxMoved = this.playerPos.x - prevX;
      const dzMoved = this.playerPos.z - prevZ;
      const didDisplace = dxMoved * dxMoved + dzMoved * dzMoved > 1e-6;
      const speedRatio = Math.min(1, mag);

      if (didDisplace) {
        this.bobTimer += delta * 9.5 * speedRatio;
        this.playerPos.y = 1.65 + Math.sin(this.bobTimer) * 0.032;
        soundEngine.updateFootsteps(delta, true, speedRatio);
      } else {
        this.playerPos.y = THREE.MathUtils.damp(this.playerPos.y, 1.65, 8, delta);
        soundEngine.updateFootsteps(delta, false, 0);
      }
    } else {
      this.playerPos.y = THREE.MathUtils.damp(this.playerPos.y, 1.65, 8, delta);
      soundEngine.updateFootsteps(delta, false, 0);
    }

    // Control de vista exclusivamente táctil (Touch Drag), sin orientación por giroscopio
    this.camera.position.copy(this.playerPos);
    _camEuler.set(
      THREE.MathUtils.clamp(this.playerPitch, -0.85, 0.85),
      this.playerYaw,
      0,
      'YXZ'
    );
    this.camera.quaternion.setFromEuler(_camEuler);
  }

  private checkMarkerRaycastAndDistance(vis: MarkerVisual): number | null {
    const m = vis.marker;
    if (m.floor !== this.currentFloor || !vis.root.visible) return null;
    if (!this.isMarkerEnabledInWorld(m)) return null;

    const dx = m.position[0] - this.playerPos.x;
    const dz = m.position[2] - this.playerPos.z;
    const distSq = dx * dx + dz * dz;
    const maxDist = 2.6;
    if (distSq > maxDist * maxDist) return null;

    this.camera.updateMatrixWorld();
    vis.root.updateMatrixWorld(true);

    const prevFar = this.raycaster.far;
    this.raycaster.far = maxDist + 0.45;

    // 1. Raycast desde el centro de la cámara hacia el marcador (.glb + hitProxy)
    _pointerNdc.set(0, 0);
    this.raycaster.setFromCamera(_pointerNdc, this.camera);
    if (this.raycaster.intersectObject(vis.root, true).length > 0) {
      this.raycaster.far = prevFar;
      return distSq;
    }

    // 2. Raycast proyectado dentro del campo visual frontal hacia el núcleo del marcador 3D
    _markerTargetPos.set(m.position[0], 1.5, m.position[2]);
    _projectedNdc.copy(_markerTargetPos).project(this.camera);

    const inFrontViewport =
      _projectedNdc.z > 0 &&
      _projectedNdc.z < 1 &&
      Math.abs(_projectedNdc.x) <= 0.86 &&
      Math.abs(_projectedNdc.y) <= 0.86;

    if (inFrontViewport) {
      _pointerNdc.set(_projectedNdc.x, _projectedNdc.y);
      this.raycaster.setFromCamera(_pointerNdc, this.camera);
      const hit = this.raycaster.intersectObject(vis.root, true).length > 0;
      this.raycaster.far = prevFar;
      return hit ? distSq : null;
    }

    this.raycaster.far = prevFar;
    return null;
  }

  private checkDestinationDoorRaycastAndDistance(): number | null {
    const isDoorUnlocked =
      this.currentFloor === 2 &&
      this.currentPhase === 'ESTADO_FINAL' &&
      (this.finalSubstate === 'puerta_desbloqueada' || this.finalSubstate === 'completada');

    if (!isDoorUnlocked || !this.destDoorGroup) return null;

    const doorPos = this.destinationDoorMarker.position;
    const dx = doorPos[0] - this.playerPos.x;
    const dz = doorPos[2] - this.playerPos.z;
    const distSq = dx * dx + dz * dz;
    const maxDoorDist = 2.85;
    if (distSq > maxDoorDist * maxDoorDist) return null;

    this.camera.updateMatrixWorld();
    this.destDoorGroup.updateMatrixWorld(true);

    const prevFar = this.raycaster.far;
    this.raycaster.far = maxDoorDist + 0.55;

    // 1. Raycast directo desde la retícula central hacia la geometría/hitbox de la puerta
    _pointerNdc.set(0, 0);
    this.raycaster.setFromCamera(_pointerNdc, this.camera);
    if (this.raycaster.intersectObject(this.destDoorGroup, true).length > 0) {
      this.raycaster.far = prevFar;
      return distSq;
    }

    // 2. Raycast proyectado dentro del campo visual frontal hacia el centro de la puerta
    _markerTargetPos.set(doorPos[0], 1.35, doorPos[2] - 0.12);
    _projectedNdc.copy(_markerTargetPos).project(this.camera);

    const inFrontViewport =
      _projectedNdc.z > 0 &&
      _projectedNdc.z < 1 &&
      Math.abs(_projectedNdc.x) <= 0.88 &&
      Math.abs(_projectedNdc.y) <= 0.88;

    if (inFrontViewport) {
      _pointerNdc.set(_projectedNdc.x, _projectedNdc.y);
      this.raycaster.setFromCamera(_pointerNdc, this.camera);
      const hit = this.raycaster.intersectObject(this.destDoorGroup, true).length > 0;
      this.raycaster.far = prevFar;
      return hit ? distSq : null;
    }

    this.raycaster.far = prevFar;
    return null;
  }

  public validateActiveMarkerInteraction(): WorldMarker | null {
    let closest: WorldMarker | null = null;
    let bestDistSq = Infinity;

    this.markersById.forEach((vis) => {
      const dSq = this.checkMarkerRaycastAndDistance(vis);
      if (dSq !== null && dSq < bestDistSq) {
        bestDistSq = dSq;
        closest = vis.marker;
      }
    });

    const doorDistSq = this.checkDestinationDoorRaycastAndDistance();
    if (doorDistSq !== null && doorDistSq < bestDistSq) {
      bestDistSq = doorDistSq;
      closest = this.destinationDoorMarker;
    }

    return closest;
  }

  private updateZoneAndProximity() {
    const zone = this.isWalkable(this.playerPos.x, this.playerPos.z, this.currentFloor);
    if (zone && zone.name !== this.lastZoneName) {
      this.lastZoneName = zone.name;
      this.callbacks.onZoneNameChange(zone.name);
    }

    const closest = this.validateActiveMarkerInteraction();
    const nextId = closest ? closest.id : null;
    if (nextId !== this.lastNearbyId) {
      this.lastNearbyId = nextId;
      this.callbacks.onNearbyMarkerChange(closest);
    }
  }

  private updateReactiveWorldProps(delta: number, elapsed: number) {
    // 1. Animate GLB markers (únicamente rotación constante en Y en posición fija) and fallback markers
    this.markersById.forEach((vis) => {
      if (vis.marker.floor !== this.currentFloor || !vis.root.visible) return;

      if (vis.glbInstance) {
        vis.glbInstance.update(delta);
      } else {
        vis.floatingCore.position.y = 0;
        vis.floatingCore.rotation.y = elapsed * 1.1;

        if (vis.standeeMesh) {
          const dx = this.camera.position.x - vis.root.position.x;
          const dz = this.camera.position.z - vis.root.position.z;
          vis.standeeMesh.rotation.y = Math.atan2(dx, dz);
        }
      }

      // Highlight active unlocked mission object markers (and final door key object) with emerald ring
      if (vis.marker.kind === 'objeto' && vis.marker.requiredPhase) {
        const isReady =
          vis.marker.id === 'objeto_puerta_destino'
            ? this.currentPhase === 'ESTADO_FINAL' && this.finalSubstate === 'pendiente'
            : vis.marker.requiredPhase === this.currentPhase &&
              this.unlockedObjects.has(vis.marker.id);
        const ringMat = vis.ringMesh.material as THREE.MeshBasicMaterial;
        ringMat.color.set(isReady ? '#10b981' : '#f43f5e');
      }
    });

    // Animate destination classroom door (Salón 2C) sliding ajar once unlocked
    if (this.destDoorPanel && this.currentFloor === 2) {
      const isDoorUnlocked =
        this.currentPhase === 'ESTADO_FINAL' &&
        (this.finalSubstate === 'puerta_desbloqueada' || this.finalSubstate === 'completada');
      const targetSlideX = isDoorUnlocked ? 0.68 : 0;
      this.destDoorPanel.position.x = THREE.MathUtils.damp(
        this.destDoorPanel.position.x,
        targetSlideX,
        5.5,
        delta
      );
    }

    // 2. Closet door opens slightly once inspected (ESTADO_2+)
    if (this.closetDoorPivot) {
      const targetAngle = this.currentPhase === 'ESTADO_0' || this.currentPhase === 'ESTADO_1' ? 0 : 0.72;
      this.closetDoorPivot.rotation.y = THREE.MathUtils.damp(
        this.closetDoorPivot.rotation.y,
        targetAngle,
        5,
        delta
      );
    }

    // 3. Swirling Autumn Leaves in Bike Courtyard react to Shake Sensor!
    if (this.leavesInstanced && this.currentFloor === 1) {
      const shakeBoost = sensorService.shakeIntensity;
      const cleared =
        this.currentPhase === 'ESTADO_3' ||
        this.currentPhase === 'ESTADO_4' ||
        this.currentPhase === 'ESTADO_5' ||
        this.currentPhase === 'ESTADO_FINAL';

      for (let i = 0; i < this.leafSeeds.length; i++) {
        const seed = this.leafSeeds[i];
        seed.scatter = THREE.MathUtils.damp(
          seed.scatter,
          cleared ? 2.4 : shakeBoost * 2.8,
          3.5,
          delta
        );
        const a = seed.angle + elapsed * seed.speed * (1 + shakeBoost * 4.5);
        const r = seed.radius + seed.scatter;
        const y = cleared
          ? 0.04
          : seed.height + Math.sin(elapsed * 2 + i) * 0.12 + shakeBoost * 1.1;

        _dummyObj.position.set(27.5 + Math.cos(a) * r, y, -21.8 + Math.sin(a) * r);
        _dummyObj.rotation.set(
          seed.rotOffsetX + elapsed + i,
          a,
          seed.rotOffsetZ + Math.sin(elapsed * 3 + i) * 0.6
        );
        _dummyObj.scale.setScalar(seed.scale);
        _dummyObj.updateMatrix();
        this.leavesInstanced.setMatrixAt(i, _dummyObj.matrix);
      }
      this.leavesInstanced.instanceMatrix.needsUpdate = true;
    }

    // 4. Campanita de viento en el pasillo frente a 1B reactiva al micrófono
    if (this.windChimeGroup && this.currentFloor === 1) {
      const vol = sensorService.audioMetrics.volume;
      this.windChimeGroup.rotation.z = Math.sin(elapsed * 7.5) * (0.04 + vol * 0.48);
      this.windChimeGroup.rotation.x = Math.cos(elapsed * 6.2) * (0.03 + vol * 0.35);
    }

    // 5. Bathroom Mirror on 2F updates WebRTC VideoTexture & glows in darkness!
    if (this.hanakoMirrorMat && this.hanakoSealRing && this.currentFloor === 2) {
      const activeTex = sensorService.getActiveVideoOrMirrorTexture();
      if (this.hanakoMirrorMat.map !== activeTex) {
        this.hanakoMirrorMat.map = activeTex;
        this.hanakoMirrorMat.needsUpdate = true;
      }
      const darknessRatio = 1 - THREE.MathUtils.clamp(sensorService.lightMetrics.luminance / 160, 0, 1);
      this.hanakoMirrorMat.emissiveIntensity = 0.06 + darknessRatio * 0.85;
      const sealMat = this.hanakoSealRing.material as THREE.MeshBasicMaterial;
      sealMat.opacity = 0.12 + darknessRatio * 0.82;
      this.hanakoSealRing.rotation.z = elapsed * 0.6;
    }

    // 6. Staff Room Astrolabe Box on 2F tilts with Gyroscope & opens on ESTADO_FINAL!
    if (
      this.astrolabeOuterGimbal &&
      this.astrolabeInnerGimbal &&
      this.astrolabeLidPivot &&
      this.currentFloor === 2
    ) {
      const tiltX = THREE.MathUtils.degToRad(
        THREE.MathUtils.clamp(sensorService.orientation.beta, -45, 45)
      );
      const tiltZ = THREE.MathUtils.degToRad(
        THREE.MathUtils.clamp(sensorService.orientation.gamma, -45, 45)
      );
      this.astrolabeOuterGimbal.rotation.x = tiltX;
      this.astrolabeInnerGimbal.rotation.z = tiltZ;
      this.astrolabeOuterGimbal.rotation.y = elapsed * 0.45;

      const targetLid = this.currentPhase === 'ESTADO_FINAL' ? -1.15 : 0;
      this.astrolabeLidPivot.rotation.x = THREE.MathUtils.damp(
        this.astrolabeLidPivot.rotation.x,
        targetLid,
        4.5,
        delta
      );
    }
  }

  private scheduleNextFrame() {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterSoftwareDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private afterSoftwareDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private tick = () => {
    if (this.disposed) return;

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsed = this.clock.elapsedTime;

    if (!this.isPaused && !this.externallyPaused && !document.hidden) {
      sensorService.update(delta, elapsed);
      this.updateMovement(delta);
      this.updateSunShadowTracking();
      this.updateZoneAndProximity();
      this.updateReactiveWorldProps(delta, elapsed);

      if (this.skybox) {
        this.skybox.uniforms.uTime.value = elapsed;
        this.skybox.mesh.position.set(this.playerPos.x, 0, this.playerPos.z);
      }

      if (elapsed - this.lastHudSyncTime > 0.12) {
        this.lastHudSyncTime = elapsed;
        this.callbacks.onPlayerMove?.({
          x: this.playerPos.x,
          z: this.playerPos.z,
          yaw: this.playerYaw,
          floor: this.currentFloor,
        });
      }

      if (this.composer && !this.isSoftwareGl) {
        this.composer.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    }

    this.scheduleNextFrame();
  };

  private bindEvents() {
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('visibilitychange', this.handleVisibility);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.handlePointerDown);
    dom.addEventListener('pointermove', this.handlePointerMove);
    dom.addEventListener('pointerup', this.handlePointerUp);
    dom.addEventListener('pointercancel', this.handlePointerUp);
  }

  private handleResize = () => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const pixelRatio = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height);
    if (this.composer && !this.isSoftwareGl) {
      this.composer.setPixelRatio(pixelRatio);
      this.composer.setSize(width, height);
    }
  };

  private handleVisibility = () => {
    this.isPaused = document.hidden;
    if (!document.hidden) {
      this.clock.getDelta();
    }
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    this.keyState[e.code] = true;
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keyState[e.code] = false;
  };

  private handlePointerDown = (e: PointerEvent) => {
    if (this.activeLookPointerId !== null) return;
    this.activeLookPointerId = e.pointerId;
    this.lookLastPos = { x: e.clientX, y: e.clientY };
    this.renderer.domElement.setPointerCapture?.(e.pointerId);
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (e.pointerId !== this.activeLookPointerId) return;
    const dx = e.clientX - this.lookLastPos.x;
    const dy = e.clientY - this.lookLastPos.y;
    this.lookLastPos = { x: e.clientX, y: e.clientY };

    const sensitivity = 0.0042;
    this.playerYaw -= dx * sensitivity;
    this.playerPitch = THREE.MathUtils.clamp(this.playerPitch - dy * sensitivity * 0.75, -0.75, 0.75);
  };

  private handlePointerUp = (e: PointerEvent) => {
    if (e.pointerId !== this.activeLookPointerId) return;
    this.activeLookPointerId = null;
  };

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);

    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.handlePointerDown);
    dom.removeEventListener('pointermove', this.handlePointerMove);
    dom.removeEventListener('pointerup', this.handlePointerUp);
    dom.removeEventListener('pointercancel', this.handlePointerUp);

    this.cancelLeafLoad?.();
    this.cancelLeafLoad = null;
    if (this.aparcabicicletasFoliageHandle) {
      this.aparcabicicletasFoliageHandle.dispose();
      this.aparcabicicletasFoliageHandle = null;
    }
    this.leavesInstanced = null;
    this.leafSeeds = [];

    this.markersById.forEach((vis) => {
      if (vis.glbInstance) {
        vis.root.remove(vis.glbInstance.root);
        vis.glbInstance.dispose();
        vis.glbInstance = undefined;
      }
    });

    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });

    this.sharedTextures.forEach((t) => t.dispose());
    this.sharedTextures = [];

    if (this.skybox) {
      this.skybox.dispose();
      this.skybox = null;
    }

    if (this.bloomPass) {
      this.bloomPass.dispose();
      this.bloomPass = null;
    }
    if (this.composer) {
      this.composer.dispose();
      this.composer = null;
    }
    if (this.scene.environment) {
      this.scene.environment.dispose();
      this.scene.environment = null;
    }

    soundEngine.detachCamera(this.camera);
    this.renderer.dispose();
  }
}
