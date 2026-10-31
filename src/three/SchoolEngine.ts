import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { WALKABLE_ZONES, WORLD_MARKERS } from '../data/gameContent';
import { sensorService } from '../services/sensorService';
import { soundEngine } from '../services/soundEngine';
import { FinalSubstate, FloorNumber, GamePhase, WalkableRect, WorldMarker } from '../types';
import {
  createCharacterStandeeTexture,
  createLockerTexture,
  createMarkerPlaqueTexture,
  createSchoolWallTexture,
  createSlidingDoorTexture,
  createStoneTileTexture,
  createWoodPlankTexture,
} from './proceduralTextures';

interface EngineCallbacks {
  onNearbyMarkerChange: (marker: WorldMarker | null) => void;
  onZoneNameChange: (zoneName: string) => void;
  onPlayerMove?: (pos: { x: number; z: number; yaw: number; floor: FloorNumber }) => void;
}

interface MarkerVisual {
  marker: WorldMarker;
  root: THREE.Group;
  floatingCore: THREE.Object3D;
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

  private floor1Group = new THREE.Group();
  private floor2Group = new THREE.Group();
  private markersById = new Map<string, MarkerVisual>();
  private hitProxies: THREE.Object3D[] = [];
  private shoeLockerColliders: THREE.Box3[] = [];
  private raycaster = new THREE.Raycaster();

  private currentFloor: FloorNumber = 1;
  private currentPhase: GamePhase = 'ESTADO_0';
  private finalSubstate: FinalSubstate = 'pendiente';
  private unlockedObjects = new Set<string>();
  private isPaused = false;
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
  private leafSeeds: Array<{
    angle: number;
    radius: number;
    height: number;
    speed: number;
    scatter: number;
  }> = [];
  private windChimeGroup: THREE.Group | null = null;
  private acousticParticles: THREE.Points | null = null;
  private hanakoMirrorMat: THREE.MeshStandardMaterial | null = null;
  private hanakoSealRing: THREE.Mesh | null = null;
  private astrolabeOuterGimbal: THREE.Group | null = null;
  private astrolabeInnerGimbal: THREE.Group | null = null;
  private astrolabeLidPivot: THREE.Group | null = null;

  // Destination classroom door (Salón 2C, 2° Piso) for final two-step sequence
  private destDoorGroup: THREE.Group | null = null;
  private destDoorPanel: THREE.Mesh | null = null;
  private destDoorMat: THREE.MeshStandardMaterial | null = null;
  private destDoorPlaqueMat: THREE.MeshBasicMaterial | null = null;
  private destDoorLockedTex: THREE.CanvasTexture | null = null;
  private destDoorUnlockedTex: THREE.CanvasTexture | null = null;
  private destPlaqueLockedTex: THREE.CanvasTexture | null = null;
  private destPlaqueUnlockedTex: THREE.CanvasTexture | null = null;
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

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#131110');
    this.scene.fog = new THREE.FogExp2('#131110', 0.032);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(68, width / height, 0.1, 85);
    this.camera.position.copy(this.playerPos);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    // SDD Section 2.2: Strict mobile pixelRatio cap at 2
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.id = 'three-canvas';
    this.renderer.domElement.className = 'block h-full w-full touch-none outline-none';

    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    // Studio environment map for realistic wood/brass/glass reflections
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    this.setupLighting();
    this.buildSchoolArchitecture();
    this.buildMarkers();
    this.setFloor(1, [-1.5, 0, 6.0], 0);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.clock.start();
    this.scheduleNextFrame();
  }

  private setupLighting() {
    // Cool twilight sky vs warm wooden floor hemisphere fill
    const hemiLight = new THREE.HemisphereLight('#c7d2fe', '#573b26', 0.72);
    this.scene.add(hemiLight);

    // Warm golden-hour directional sunlight slanting through courtyard windows
    const sunLight = new THREE.DirectionalLight('#ffedd5', 1.35);
    sunLight.position.set(14, 24, -18);
    if (!this.isSoftwareGl) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024);
      sunLight.shadow.camera.near = 2;
      sunLight.shadow.camera.far = 70;
      sunLight.shadow.camera.left = -34;
      sunLight.shadow.camera.right = 34;
      sunLight.shadow.camera.top = 34;
      sunLight.shadow.camera.bottom = -34;
      sunLight.shadow.bias = -0.0005;
      sunLight.shadow.normalBias = 0.02;
    }
    this.scene.add(sunLight);

    // Subtle rim light from south Genkan entrance
    const rimLight = new THREE.DirectionalLight('#fb923c', 0.45);
    rimLight.position.set(-8, 10, 18);
    this.scene.add(rimLight);
  }

  private buildSchoolArchitecture() {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const woodTex = createWoodPlankTexture(maxAniso);
    woodTex.repeat.set(16, 2);

    const wingWoodTex = createWoodPlankTexture(maxAniso);
    wingWoodTex.repeat.set(2, 8);

    const roomWoodTex = createWoodPlankTexture(maxAniso);
    roomWoodTex.repeat.set(3, 3);

    const stoneTex = createStoneTileTexture(maxAniso, '#363432', '#1f1d1b');
    stoneTex.repeat.set(4, 4);

    const bathTileTex = createStoneTileTexture(maxAniso, '#cfd8dc', '#90a4ae');
    bathTileTex.repeat.set(5, 5);

    const wallTex = createSchoolWallTexture(maxAniso);
    wallTex.repeat.set(8, 1);

    const shortWallTex = createSchoolWallTexture(maxAniso);
    shortWallTex.repeat.set(2, 1);

    const lockerTex = createLockerTexture(maxAniso);

    const woodFloorMat = new THREE.MeshStandardMaterial({
      map: woodTex,
      roughness: 0.55,
      metalness: 0.05,
    });
    const wingFloorMat = new THREE.MeshStandardMaterial({
      map: wingWoodTex,
      roughness: 0.55,
      metalness: 0.05,
    });
    const roomFloorMat = new THREE.MeshStandardMaterial({
      map: roomWoodTex,
      roughness: 0.52,
      metalness: 0.06,
    });
    const stoneFloorMat = new THREE.MeshStandardMaterial({
      map: stoneTex,
      roughness: 0.82,
      metalness: 0.04,
    });
    const bathFloorMat = new THREE.MeshStandardMaterial({
      map: bathTileTex,
      roughness: 0.28,
      metalness: 0.08,
    });
    const wallLongMat = new THREE.MeshStandardMaterial({
      map: wallTex,
      roughness: 0.78,
      metalness: 0.02,
    });
    const wallShortMat = new THREE.MeshStandardMaterial({
      map: shortWallTex,
      roughness: 0.78,
      metalness: 0.02,
    });
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: '#e7e0d2',
      roughness: 0.9,
      metalness: 0.0,
    });
    const cedarTimberMat = new THREE.MeshStandardMaterial({
      color: '#432916',
      roughness: 0.65,
      metalness: 0.05,
    });

    this.scene.add(this.floor1Group);
    this.scene.add(this.floor2Group);

    // Build shared U-shape structure for Floor 1 and Floor 2
    this.populateFloorBase(this.floor1Group, 1, {
      woodFloorMat,
      wingFloorMat,
      roomFloorMat,
      stoneFloorMat,
      bathFloorMat,
      wallLongMat,
      wallShortMat,
      ceilingMat,
      cedarTimberMat,
      lockerTex,
      maxAniso,
    });

    this.populateFloorBase(this.floor2Group, 2, {
      woodFloorMat,
      wingFloorMat,
      roomFloorMat,
      stoneFloorMat,
      bathFloorMat,
      wallLongMat,
      wallShortMat,
      ceilingMat,
      cedarTimberMat,
      lockerTex,
      maxAniso,
    });

    // Build unique interactive story rooms & sensor-reactive props
    this.buildFloor1Props(maxAniso, cedarTimberMat);
    this.buildFloor2Props(maxAniso, cedarTimberMat);
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
      stoneFloorMat: THREE.Material;
      bathFloorMat: THREE.Material;
      wallLongMat: THREE.Material;
      wallShortMat: THREE.Material;
      ceilingMat: THREE.Material;
      cedarTimberMat: THREE.Material;
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

    // Warm fluorescent ceiling fixtures along Main Corridor
    const lampGeo = new THREE.BoxGeometry(1.5, 0.08, 0.35);
    const lampMat = new THREE.MeshStandardMaterial({
      color: '#fffbeb',
      emissive: '#fde68a',
      emissiveIntensity: 1.2,
      roughness: 0.2,
    });
    for (let lx = -22; lx <= 22; lx += 8.8) {
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(lx, wallH - 0.05, 0);
      group.add(lamp);
    }

    // Cedar structural pillars along corridor
    const pillarGeo = new THREE.BoxGeometry(0.24, wallH, 0.24);
    for (let px = -24; px <= 24; px += 6) {
      if (floor === 1 && Math.abs(px) < 5.5) continue;
      const pNorth = new THREE.Mesh(pillarGeo, mats.cedarTimberMat);
      pNorth.position.set(px, wallH / 2, -2.3);
      group.add(pNorth);

      const pSouth = new THREE.Mesh(pillarGeo, mats.cedarTimberMat);
      pSouth.position.set(px, wallH / 2, 2.3);
      group.add(pSouth);
    }

    // North Wall of Main Corridor (with central vestibule bump-out on 1F)
    if (floor === 1) {
      this.addBoxWall(group, -14.8, wallH / 2, -2.4, 18.4, wallH, 0.25, mats.wallLongMat);
      this.addBoxWall(group, 14.8, wallH / 2, -2.4, 18.4, wallH, 0.25, mats.wallLongMat);

      // 1F Vestibule North Alcove (x: -5.6..5.6, z: -4.2..2.4)
      const vestFloor = new THREE.Mesh(new THREE.PlaneGeometry(11.2, 4.4), mats.roomFloorMat);
      vestFloor.rotation.x = -Math.PI / 2;
      vestFloor.position.set(0, 0.005, -2.1);
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
      group.add(genkanFloor);

      // Genkan Side & South Entrance Walls
      this.addBoxWall(group, -5.6, wallH / 2, 5.0, 0.25, wallH, 5.2, mats.wallShortMat);
      this.addBoxWall(group, 5.6, wallH / 2, 5.0, 0.25, wallH, 5.2, mats.wallShortMat);
      this.addGlassEntranceWall(group, 0, 7.6, 11.2, wallH, mats.cedarTimberMat);

      // 3 Traditional Getabako Shoe-Locker Islands creating the 4 aisles on Map 1
      const lockerMat = new THREE.MeshStandardMaterial({
        map: mats.lockerTex,
        roughness: 0.62,
        metalness: 0.06,
      });
      const lockerTopMat = new THREE.MeshStandardMaterial({
        color: '#4e331e',
        roughness: 0.5,
      });
      this.shoeLockerColliders = [];
      const bodyW = 1.1;
      const bodyH = 1.75;
      const bodyD = 3.4;

      [-2.95, 0, 2.95].forEach((lx) => {
        const island = new THREE.Group();
        island.position.set(lx, 0, 5.0);
        const body = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyD), lockerMat);
        body.position.y = bodyH / 2;
        body.castShadow = !this.isSoftwareGl;
        island.add(body);

        const cap = new THREE.Mesh(new THREE.BoxGeometry(bodyW + 0.06, 0.08, bodyD + 0.06), lockerTopMat);
        cap.position.y = 1.79;
        island.add(cap);

        const plinth = new THREE.Mesh(new THREE.BoxGeometry(bodyW - 0.04, 0.1, bodyD - 0.06), mats.cedarTimberMat);
        plinth.position.y = 0.05;
        island.add(plinth);
        group.add(island);

        // Tight THREE.Box3 adjusted strictly to real visual bounds (no Z/X phantom expansion)
        this.shoeLockerColliders.push(
          new THREE.Box3(
            new THREE.Vector3(lx - bodyW * 0.5, 0, 5.0 - bodyD * 0.5),
            new THREE.Vector3(lx + bodyW * 0.5, bodyH, 5.0 + bodyD * 0.5)
          )
        );
      });
    } else {
      // 2F Continuous North & Center-South Corridor Walls
      this.addBoxWall(group, 0, wallH / 2, -2.4, 48.0, wallH, 0.25, mats.wallLongMat);
      this.addBoxWall(group, 0, wallH / 2, 2.4, 11.4, wallH, 0.25, mats.wallShortMat);
    }

    // Courtyard Windows along North Corridor Wall
    this.addCorridorWindows(group, -18.5, -2.26, mats.cedarTimberMat);
    this.addCorridorWindows(group, -11.5, -2.26, mats.cedarTimberMat);
    this.addCorridorWindows(group, 11.5, -2.26, mats.cedarTimberMat);
    this.addCorridorWindows(group, 18.5, -2.26, mats.cedarTimberMat);

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

    // Closed Classroom Doors along South Corridor (1A-1D on 1F, 2A-2D on 2F)
    const prefix = floor === 1 ? '1' : '2';
    const classrooms = [
      { code: `${prefix}A`, label: `Salón ${prefix}A`, x: -18.2 },
      { code: `${prefix}B`, label: `Salón ${prefix}B`, x: -10.8 },
      { code: `${prefix}C`, label: `Salón ${prefix}C`, x: 10.8 },
      { code: `${prefix}D`, label: `Salón ${prefix}D`, x: 18.2 },
    ];
    classrooms.forEach((cls) => {
      const isDestinationDoor = floor === 2 && cls.code === '2C';
      this.addClassroomDoor(
        group,
        cls.x,
        2.26,
        Math.PI,
        cls.label,
        false,
        mats.maxAniso,
        mats.cedarTimberMat,
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
      mats.maxAniso
    );

    // West North Room (Armario de Limpieza on 1F / Sala de Profesores on 2F)
    const westRoomFloor = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 6.8), mats.roomFloorMat);
    westRoomFloor.rotation.x = -Math.PI / 2;
    westRoomFloor.position.set(-26.0, 0.004, -21.4);
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
      floor === 1 ? 'Aparcabicicletas' : 'Baños 2° Piso',
      mats.cedarTimberMat,
      mats.maxAniso
    );

    if (floor === 2) {
      // 2F Bathrooms Enclosed Tiled Room (x: 22.0..30.0, z: -24.0..-15.0)
      const bathFloor = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 9.0), mats.bathFloorMat);
      bathFloor.rotation.x = -Math.PI / 2;
      bathFloor.position.set(26.0, 0.004, -19.5);
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
      color: '#fde68a',
      emissive: '#ea580c',
      emissiveIntensity: 0.24,
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: 0.55,
    });

    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(width, height), glassMat);
    backdrop.position.set(0, height / 2, 0.05);
    backdrop.rotation.y = Math.PI;
    entrance.add(backdrop);

    const mullionCount = 6;
    for (let i = 0; i <= mullionCount; i++) {
      const mx = -width / 2 + (i / mullionCount) * width;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, height, 0.16), frameMat);
      bar.position.set(mx, height / 2, 0);
      entrance.add(bar);
    }

    const crossBar = new THREE.Mesh(new THREE.BoxGeometry(width, 0.12, 0.16), frameMat);
    crossBar.position.set(0, 2.3, 0);
    entrance.add(crossBar);

    group.add(entrance);
  }

  private addCorridorWindows(group: THREE.Group, x: number, z: number, frameMat: THREE.Material) {
    const winGroup = new THREE.Group();
    winGroup.position.set(x, 1.9, z);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.45, 0.08), frameMat);
    winGroup.add(frame);

    const skyMat = new THREE.MeshStandardMaterial({
      color: '#334155',
      emissive: '#fb923c',
      emissiveIntensity: 0.18,
      roughness: 0.15,
    });

    for (let i = -1; i <= 1; i++) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 1.25), skyMat);
      pane.position.set(i * 1.2, 0, 0.05);
      winGroup.add(pane);
    }

    group.add(winGroup);
  }

  private addClassroomDoor(
    group: THREE.Group,
    x: number,
    z: number,
    rotY: number,
    label: string,
    isOpen: boolean,
    maxAniso: number,
    frameMat: THREE.Material,
    isDestinationDoor = false
  ) {
    const doorGroup = new THREE.Group();
    doorGroup.position.set(x, 0, z);
    doorGroup.rotation.y = rotY;

    const tex = createSlidingDoorTexture(label, isOpen, maxAniso);
    const doorMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.58,
      metalness: 0.05,
    });

    if (isDestinationDoor) {
      // Warm sunlit classroom doorway backdrop revealed when the sliding panel unlocks
      const portalFrame = new THREE.Mesh(
        new THREE.BoxGeometry(1.76, 2.52, 0.03),
        frameMat
      );
      portalFrame.position.set(0, 1.26, 0.005);
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
      doorGroup.add(interiorGlow);
    }

    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.65, 2.45, 0.06), doorMat);
    panel.position.set(0, 1.225, isDestinationDoor ? 0.055 : 0.02);
    doorGroup.add(panel);

    // Protruding Japanese hallway room plaque perpendicular to wall
    const signArm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.55), frameMat);
    signArm.position.set(1.05, 2.55, 0.25);
    doorGroup.add(signArm);

    const plaqueTex = createMarkerPlaqueTexture(
      label,
      isOpen ? 'Abierta' : 'Cerrada',
      isOpen ? '#22c55e' : '#ef4444'
    );
    const plaqueMat = new THREE.MeshBasicMaterial({
      map: plaqueTex,
      side: THREE.DoubleSide,
      transparent: true,
    });
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.22), plaqueMat);
    plaque.position.set(1.05, 2.38, 0.34);
    plaque.rotation.y = Math.PI / 2;
    doorGroup.add(plaque);

    if (isDestinationDoor) {
      this.destDoorGroup = doorGroup;
      this.destDoorPanel = panel;
      this.destDoorMat = doorMat;
      this.destDoorPlaqueMat = plaqueMat;
      this.destDoorLockedTex = tex;
      this.destDoorUnlockedTex = createSlidingDoorTexture(label, true, maxAniso);
      this.destPlaqueLockedTex = plaqueTex;
      this.destPlaqueUnlockedTex = createMarkerPlaqueTexture(label, 'Abierta', '#22c55e');

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
      doorGroup.add(thresholdRing);
      this.destDoorThresholdRing = thresholdRing;

      // Invisible DoubleSide collider proxy on the door frame for reliable close/mid-range raycasting
      const doorHitBox = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 2.65, 0.9),
        new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
      );
      doorHitBox.position.set(0, 1.32, 0.25);
      doorHitBox.userData = { markerId: 'puerta_aula_destino', isDestinationDoor: true };
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
    maxAniso: number
  ) {
    const arch = new THREE.Group();
    arch.position.set(x, 0, z);

    // Header lintel above open doorway
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(corridorWidth, 0.85, 0.28), frameMat);
    lintel.position.set(0, wallH - 0.425, 0);
    arch.add(lintel);

    // Slid-open wooden hikido door tucked to one side
    const tex = createSlidingDoorTexture(title.slice(0, 12), true, maxAniso);
    const doorMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
    const slidDoor = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.6, 0.08), doorMat);
    slidDoor.position.set(-corridorWidth / 2 + 0.72, 1.3, 0.14);
    arch.add(slidDoor);

    // Overhead room banner
    const bannerTex = createMarkerPlaqueTexture(title, 'Acceso Abierto', '#22c55e');
    const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex, transparent: true, side: THREE.DoubleSide });
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 0.52), bannerMat);
    banner.position.set(0, 2.86, 0.18);
    arch.add(banner);

    group.add(arch);
  }

  private buildStaircasePocket(
    group: THREE.Group,
    centerX: number,
    floor: FloorNumber,
    mats: {
      roomFloorMat: THREE.Material;
      wallShortMat: THREE.Material;
      ceilingMat: THREE.Material;
      cedarTimberMat: THREE.Material;
    }
  ) {
    const wallH = 3.5;
    const pocket = new THREE.Group();
    pocket.position.set(centerX, 0, 0);

    // Landing floor (z: 2.0..4.5)
    const landing = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.8), mats.roomFloorMat);
    landing.rotation.x = -Math.PI / 2;
    landing.position.set(0, 0.004, 3.4);
    pocket.add(landing);

    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 5.4), mats.ceilingMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, wallH + 1.2, 4.7);
    pocket.add(ceil);

    // Pocket side & back walls
    this.addBoxWall(pocket, -1.7, (wallH + 1.2) / 2, 4.7, 0.24, wallH + 1.2, 4.8, mats.wallShortMat);
    this.addBoxWall(pocket, 1.7, (wallH + 1.2) / 2, 4.7, 0.24, wallH + 1.2, 4.8, mats.wallShortMat);
    this.addBoxWall(pocket, 0, (wallH + 1.2) / 2, 7.0, 3.6, wallH + 1.2, 0.24, mats.wallShortMat);

    // Composite 3D Steps behind the staircase marker (z: 3.9..6.7)
    const stepMat = new THREE.MeshStandardMaterial({ color: '#6b492e', roughness: 0.55 });
    const riserMat = new THREE.MeshStandardMaterial({ color: '#dfd8ca', roughness: 0.85 });
    const stepCount = 9;
    for (let s = 0; s < stepCount; s++) {
      const sy = floor === 1 ? (s + 1) * 0.24 : Math.max(0.06, 1.9 - s * 0.2);
      const sz = 4.05 + s * 0.28;
      const step = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.07, 0.3), stepMat);
      step.position.set(0, sy, sz);
      pocket.add(step);

      const riser = new THREE.Mesh(new THREE.BoxGeometry(2.9, sy, 0.04), riserMat);
      riser.position.set(0, sy / 2, sz - 0.13);
      pocket.add(riser);
    }

    // Wooden handrail banisters
    [-1.35, 1.35].forEach((rx) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.05, 10), mats.cedarTimberMat);
      post.position.set(rx, 0.52, 3.95);
      pocket.add(post);

      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 3.1, 10), mats.cedarTimberMat);
      rail.position.set(rx, floor === 1 ? 1.65 : 1.15, 5.2);
      rail.rotation.x = floor === 1 ? -0.62 : 0.45;
      pocket.add(rail);
    });

    group.add(pocket);
  }

  private buildFloor1Props(maxAniso: number, timberMat: THREE.Material) {
    // 1. Vestibule Notice Board (near objeto_vestibulo at (2.2, 0, -1.6))
    const boardGroup = new THREE.Group();
    boardGroup.position.set(2.2, 0, -3.95);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.35, 0.1), timberMat);
    frame.position.y = 1.65;
    boardGroup.add(frame);

    const corkMat = new THREE.MeshStandardMaterial({ color: '#9c6f44', roughness: 0.9 });
    const cork = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.15), corkMat);
    cork.position.set(0, 1.65, 0.06);
    boardGroup.add(cork);

    const paperMat = new THREE.MeshStandardMaterial({ color: '#faf6ee', roughness: 0.8 });
    [-0.6, 0, 0.62].forEach((px, idx) => {
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.62), paperMat);
      sheet.position.set(px, 1.68 + (idx % 2) * 0.05, 0.07);
      sheet.rotation.z = (idx - 1) * 0.04;
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
    closetGroup.add(carcass);

    const crown = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.1, 0.86), timberMat);
    crown.position.y = 2.4;
    closetGroup.add(crown);

    // Hinged right door that swings slightly open when unlocked
    this.closetDoorPivot = new THREE.Group();
    this.closetDoorPivot.position.set(0.82, 1.175, 0.4);
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
    closetGroup.add(bucket);

    const broomStick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.45, 8), timberMat);
    broomStick.position.set(-1.22, 0.72, 0.2);
    broomStick.rotation.z = 0.14;
    closetGroup.add(broomStick);

    const roomLight1 = new THREE.PointLight('#fed7aa', 1.8, 11);
    roomLight1.position.set(-26.0, 2.9, -21.5);
    this.floor1Group.add(roomLight1);
    this.floor1Group.add(closetGroup);

    // 3. Aparcabicicletas (1F East Outdoor Courtyard: x: 22.0..30.5, z: -25.5..-15.0)
    // Natural outdoor ground + cedar courtyard fence + polycarbonate shelter + composite bicycles + 90 reactive leaves
    const gravelTex = createStoneTileTexture(maxAniso, '#44403c', '#292524');
    gravelTex.repeat.set(8, 8);
    const courtyardGround = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 22),
      new THREE.MeshStandardMaterial({ map: gravelTex, roughness: 0.92 })
    );
    courtyardGround.rotation.x = -Math.PI / 2;
    courtyardGround.position.set(26.5, 0.003, -22.5);
    this.floor1Group.add(courtyardGround);

    // Natural wooden courtyard perimeter fence (with gaps showing twilight pine silhouettes)
    const fenceMat = new THREE.MeshStandardMaterial({ color: '#4a321f', roughness: 0.75 });
    for (let fx = 21.8; fx <= 30.6; fx += 1.4) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.95, 0.14), fenceMat);
      post.position.set(fx, 0.975, -25.0);
      this.floor1Group.add(post);
    }
    const fenceSlats = new THREE.Mesh(new THREE.BoxGeometry(9.2, 1.55, 0.07), fenceMat);
    fenceSlats.position.set(26.2, 0.95, -25.0);
    this.floor1Group.add(fenceSlats);

    const fenceEast = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.55, 10.2), fenceMat);
    fenceEast.position.set(30.4, 0.95, -20.0);
    this.floor1Group.add(fenceEast);

    const fenceWest = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.55, 10.2), fenceMat);
    fenceWest.position.set(21.9, 0.95, -20.0);
    this.floor1Group.add(fenceWest);

    // Outdoor Pine / Maple Courtyard Trees beyond fence for organic outdoor depth
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#3b2313', roughness: 0.85 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: '#7c2d12', roughness: 0.75 });
    [
      [23.0, -27.2],
      [27.8, -27.8],
      [32.2, -22.5],
    ].forEach(([tx, tz]) => {
      const tree = new THREE.Group();
      tree.position.set(tx, 0, tz);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 3.2, 8), trunkMat);
      trunk.position.y = 1.6;
      tree.add(trunk);
      const canopy1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.55, 1), foliageMat);
      canopy1.position.set(0, 3.5, 0);
      tree.add(canopy1);
      const canopy2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15, 1), foliageMat);
      canopy2.position.set(0.7, 2.9, 0.4);
      tree.add(canopy2);
      this.floor1Group.add(tree);
    });

    // Translucent Bike Shelter + 4 Composite Bicycles
    const shelter = new THREE.Group();
    shelter.position.set(27.5, 0, -22.4);
    const steelMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.32, metalness: 0.82 });
    const roofMat = new THREE.MeshStandardMaterial({
      color: '#bae6fd',
      roughness: 0.18,
      metalness: 0.1,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    [-2.1, 2.1].forEach((sx) => {
      [-1.1, 1.1].forEach((sz) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.35, 10), steelMat);
        leg.position.set(sx, 1.175, sz);
        shelter.add(leg);
      });
    });
    const shelterRoof = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.07, 2.8), roofMat);
    shelterRoof.position.set(0, 2.4, 0);
    shelterRoof.rotation.x = 0.12;
    shelter.add(shelterRoof);

    // 4 Composite Bicycles (wheels + frame + handlebar + saddle)
    const tireMat = new THREE.MeshStandardMaterial({ color: '#1c1917', roughness: 0.85 });
    const frameColors = ['#dc2626', '#0284c7', '#eab308', '#16a34a'];
    [-1.35, -0.45, 0.45, 1.35].forEach((bx, idx) => {
      const bike = this.createCompositeBicycle(frameColors[idx], steelMat, tireMat);
      bike.position.set(bx, 0, 0);
      bike.rotation.y = Math.PI / 2 + (idx % 2 === 0 ? 0.06 : -0.05);
      shelter.add(bike);
    });
    this.floor1Group.add(shelter);

    // Swirling Autumn Leaves (InstancedMesh reactive to Shake sensor!)
    const leafCount = 90;
    const leafGeo = new THREE.PlaneGeometry(0.18, 0.12);
    const leafMat = new THREE.MeshStandardMaterial({
      color: '#ea580c',
      roughness: 0.6,
      side: THREE.DoubleSide,
    });
    this.leavesInstanced = new THREE.InstancedMesh(leafGeo, leafMat, leafCount);
    this.leavesInstanced.frustumCulled = false;
    const leafPalette = [new THREE.Color('#ea580c'), new THREE.Color('#f59e0b'), new THREE.Color('#b91c1c')];

    for (let i = 0; i < leafCount; i++) {
      this.leafSeeds.push({
        angle: (i / leafCount) * Math.PI * 6,
        radius: 0.5 + (i % 9) * 0.24,
        height: 0.12 + (i % 12) * 0.16,
        speed: 0.7 + (i % 5) * 0.25,
        scatter: 0,
      });
      this.leavesInstanced.setColorAt(i, leafPalette[i % leafPalette.length]);
    }
    this.floor1Group.add(this.leavesInstanced);

    // 4. Pasillo Aula 1B — Acoustic Japanese Wind Chime (Fūrin) + Audio Particles at (-9.2, 0, -1.2)
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

    // Audio-reactive spirit dust ring around Wind Chime
    const pCount = 64;
    const pPositions = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      const a = (i / pCount) * Math.PI * 2;
      const r = 0.6 + (i % 4) * 0.25;
      pPositions[i * 3] = -9.2 + Math.cos(a) * r;
      pPositions[i * 3 + 1] = 1.1 + (i % 8) * 0.22;
      pPositions[i * 3 + 2] = -1.2 + Math.sin(a) * r;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    const pMat = new THREE.PointsMaterial({
      color: '#7dd3fc',
      size: 0.08,
      transparent: true,
      opacity: 0.75,
    });
    this.acousticParticles = new THREE.Points(pGeo, pMat);
    this.floor1Group.add(this.acousticParticles);
  }

  private createCompositeBicycle(
    colorHex: string,
    steelMat: THREE.Material,
    tireMat: THREE.Material
  ): THREE.Group {
    const bike = new THREE.Group();
    const paintMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3, metalness: 0.55 });

    const wheelGeo = new THREE.TorusGeometry(0.32, 0.035, 10, 22);
    const backWheel = new THREE.Mesh(wheelGeo, tireMat);
    backWheel.position.set(-0.52, 0.35, 0);
    bike.add(backWheel);

    const frontWheel = new THREE.Mesh(wheelGeo, tireMat);
    frontWheel.position.set(0.52, 0.35, 0);
    bike.add(frontWheel);

    const topTube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.92, 8), paintMat);
    topTube.position.set(0, 0.68, 0);
    topTube.rotation.z = Math.PI / 2;
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
      this.floor2Group.add(partition);
    }

    // Countertop & Sinks along East Wall near objeto_hanako (27.6, 0, -21.2)
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.85, 3.6),
      new THREE.MeshStandardMaterial({ color: '#e7e5e4', roughness: 0.25 })
    );
    counter.position.set(29.45, 0.425, -21.2);
    this.floor2Group.add(counter);

    // Framed Mirror mapped live to Camera WebRTC VideoTexture or Procedural Mist Mirror
    const mirrorGroup = new THREE.Group();
    mirrorGroup.position.set(29.82, 1.65, -21.2);
    mirrorGroup.rotation.y = -Math.PI / 2;

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

    const bathLight = new THREE.PointLight('#bae6fd', 1.4, 12);
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
    this.floor2Group.add(chalkboard);

    const deskMat = new THREE.MeshStandardMaterial({ color: '#5c3d24', roughness: 0.5 });
    const mainDesk = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.82, 1.0), deskMat);
    mainDesk.position.set(-24.5, 0.41, -23.45);
    this.floor2Group.add(mainDesk);

    const sideDesk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.82, 0.9), deskMat);
    sideDesk.position.set(-27.8, 0.41, -23.2);
    this.floor2Group.add(sideDesk);

    // Composite Gyro-Reactive Sealed Astrolabe Box on Main Desk
    const cofferBase = new THREE.Group();
    cofferBase.position.set(-24.5, 0.84, -23.45);

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

    const staffLight = new THREE.PointLight('#fde68a', 1.7, 12);
    staffLight.position.set(-25.8, 2.95, -21.5);
    this.floor2Group.add(staffLight);
    this.floor2Group.add(cofferBase);
  }

  private buildMarkers() {
    const gltfLoader = new GLTFLoader();

    WORLD_MARKERS.forEach((marker) => {
      const root = new THREE.Group();
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

      const floatingCore = new THREE.Group();
      root.add(floatingCore);

      let standeeMesh: THREE.Mesh | undefined;

      if (marker.kind === 'personaje') {
        // Washi-paper Character Portrait Standee + Sky-Blue Crystal Beacon
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
        root.add(standeeMesh);

        // Wooden pedestal base
        const base = new THREE.Mesh(
          new THREE.CylinderGeometry(0.36, 0.42, 0.14, 16),
          new THREE.MeshStandardMaterial({ color: '#3b2514', roughness: 0.65 })
        );
        base.position.y = 0.07;
        root.add(base);

        // Floating blue crystal above character standee
        const diamond = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.14, 0),
          new THREE.MeshStandardMaterial({
            color: '#38bdf8',
            emissive: '#0284c7',
            emissiveIntensity: 0.85,
            roughness: 0.2,
            metalness: 0.5,
          })
        );
        diamond.position.y = 2.08;
        floatingCore.add(diamond);
      } else if (marker.kind === 'objeto') {
        // Composite Crimson Object Marker (Pedestal + Lantern Octahedron + Orbit Ring)
        const gem = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.24, 0),
          new THREE.MeshStandardMaterial({
            color: '#f43f5e',
            emissive: '#e11d48',
            emissiveIntensity: 0.8,
            roughness: 0.22,
            metalness: 0.55,
          })
        );
        gem.position.y = 1.15;
        floatingCore.add(gem);

        const halo = new THREE.Mesh(
          new THREE.TorusGeometry(0.34, 0.02, 10, 28),
          new THREE.MeshStandardMaterial({
            color: '#fda4af',
            roughness: 0.25,
            metalness: 0.8,
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
          emissiveIntensity: 0.8,
          roughness: 0.25,
          metalness: 0.65,
        });
        const coneDir = marker.targetFloor === 2 ? 1 : -1;
        [0.95, 1.32].forEach((cy) => {
          const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.28, 4), stairMat);
          cone.position.y = cy;
          if (coneDir < 0) cone.rotation.x = Math.PI;
          floatingCore.add(cone);
        });
      }

      // Floating World Label Plaque
      const plaqueTex = createMarkerPlaqueTexture(marker.label, marker.sublabel, accentHex);
      const spriteMat = new THREE.SpriteMaterial({
        map: plaqueTex,
        transparent: true,
        depthWrite: false,
      });
      const labelSprite = new THREE.Sprite(spriteMat);
      labelSprite.scale.set(1.65, 0.52, 1);
      labelSprite.position.y = marker.kind === 'personaje' ? 2.48 : 1.85;
      root.add(labelSprite);

      // Simplified invisible cylinder proxy (DoubleSide so close-range internal rays hit cleanly)
      const hitProxy = new THREE.Mesh(
        new THREE.CylinderGeometry(0.75, 0.75, 2.4, 8),
        new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
      );
      hitProxy.position.y = 1.2;
      hitProxy.userData = { markerId: marker.id };
      root.add(hitProxy);
      this.hitProxies.push(hitProxy);

      // Optional drop-in GLB support if dpwii_parcial2_marcadores_*.glb exists as binary in /public
      this.tryAttachOptionalGlb(gltfLoader, marker.glbFile, floatingCore);

      const targetFloorGroup = marker.floor === 1 ? this.floor1Group : this.floor2Group;
      targetFloorGroup.add(root);

      this.markersById.set(marker.id, {
        marker,
        root,
        floatingCore,
        ringMesh,
        standeeMesh,
        hitProxy,
      });
    });

    this.syncMarkerVisibility();
  }

  private async tryAttachOptionalGlb(
    loader: GLTFLoader,
    glbFile: string,
    targetGroup: THREE.Group
  ) {
    try {
      const res = await fetch(`/${glbFile}`, { method: 'HEAD' });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || contentType.includes('text/html')) return;

      loader.load(
        `/${glbFile}`,
        (gltf) => {
          gltf.scene.scale.setScalar(0.85);
          targetGroup.add(gltf.scene);
        },
        undefined,
        () => {}
      );
    } catch {
      // Procedural composite 3D marker remains active
    }
  }

  public getCurrentFloor(): FloorNumber {
    return this.currentFloor;
  }

  public setFloor(floor: FloorNumber, spawnPos?: [number, number, number], yaw?: number) {
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

    this.lastNearbyId = null;
    this.callbacks.onNearbyMarkerChange(null);
    this.updateZoneAndProximity();
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

    if (this.destDoorMat && this.destDoorLockedTex && this.destDoorUnlockedTex) {
      const targetTex = isDoorUnlocked ? this.destDoorUnlockedTex : this.destDoorLockedTex;
      if (this.destDoorMat.map !== targetTex) {
        this.destDoorMat.map = targetTex;
        this.destDoorMat.needsUpdate = true;
      }
    }

    if (this.destDoorPlaqueMat && this.destPlaqueLockedTex && this.destPlaqueUnlockedTex) {
      const targetPlaque = isDoorUnlocked ? this.destPlaqueUnlockedTex : this.destPlaqueLockedTex;
      if (this.destDoorPlaqueMat.map !== targetPlaque) {
        this.destDoorPlaqueMat.map = targetPlaque;
        this.destDoorPlaqueMat.needsUpdate = true;
      }
    }

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

  public resetCameraView() {
    this.playerPitch = 0;
  }

  public captureScreenshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  private isWalkable(x: number, z: number, floor: FloorNumber): WalkableRect | null {
    const playerRadius = 0.18;

    // 1. Physical Circle-vs-Box3 collision strictly against the 3 shoe-locker islands on 1F
    if (floor === 1) {
      for (let i = 0; i < this.shoeLockerColliders.length; i++) {
        const box = this.shoeLockerColliders[i];
        const closestX = THREE.MathUtils.clamp(x, box.min.x, box.max.x);
        const closestZ = THREE.MathUtils.clamp(z, box.min.z, box.max.z);
        const dx = x - closestX;
        const dz = z - closestZ;
        if (dx * dx + dz * dz < playerRadius * playerRadius) {
          return null;
        }
      }
    }

    // 2. Room & corridor walkable bounds check
    for (let i = 0; i < WALKABLE_ZONES.length; i++) {
      const r = WALKABLE_ZONES[i];
      if (r.floor !== floor) continue;
      if (
        x >= r.minX + playerRadius &&
        x <= r.maxX - playerRadius &&
        z >= r.minZ + playerRadius &&
        z <= r.maxZ - playerRadius
      ) {
        return r;
      }
    }
    return null;
  }

  private updateMovement(delta: number) {
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

      const nextX = this.playerPos.x + _moveVec.x;
      const nextZ = this.playerPos.z + _moveVec.z;

      // Axis-separated sliding collision against school walls
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

      this.bobTimer += delta * 9.5 * Math.min(1, mag);
      this.playerPos.y = 1.65 + Math.sin(this.bobTimer) * 0.032;
      soundEngine.playFootstep();
    } else {
      this.playerPos.y = THREE.MathUtils.damp(this.playerPos.y, 1.65, 8, delta);
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
    // 1. Animate markers gently & billboard character standees cleanly around Y
    this.markersById.forEach((vis) => {
      if (vis.marker.floor !== this.currentFloor || !vis.root.visible) return;

      vis.floatingCore.position.y = Math.sin(elapsed * 2.4 + vis.marker.position[0]) * 0.08;
      vis.floatingCore.rotation.y = elapsed * 1.1;

      if (vis.standeeMesh) {
        const dx = this.camera.position.x - vis.root.position.x;
        const dz = this.camera.position.z - vis.root.position.z;
        vis.standeeMesh.rotation.y = Math.atan2(dx, dz);
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
        _dummyObj.rotation.set(elapsed + i, a, Math.sin(elapsed * 3 + i) * 0.6);
        _dummyObj.updateMatrix();
        this.leavesInstanced.setMatrixAt(i, _dummyObj.matrix);
      }
      this.leavesInstanced.instanceMatrix.needsUpdate = true;
    }

    // 4. Wind Chime & Acoustic Particles in Hallway 1B react to Microphone!
    if (this.windChimeGroup && this.acousticParticles && this.currentFloor === 1) {
      const vol = sensorService.audioMetrics.volume;
      this.windChimeGroup.rotation.z = Math.sin(elapsed * 7.5) * (0.04 + vol * 0.48);
      this.windChimeGroup.rotation.x = Math.cos(elapsed * 6.2) * (0.03 + vol * 0.35);

      const pMat = this.acousticParticles.material as THREE.PointsMaterial;
      pMat.size = 0.06 + vol * 0.18;
      this.acousticParticles.rotation.y = elapsed * (0.25 + vol * 2.2);
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

    if (!this.isPaused && !document.hidden) {
      sensorService.update(delta, elapsed);
      this.updateMovement(delta);
      this.updateZoneAndProximity();
      this.updateReactiveWorldProps(delta, elapsed);

      if (elapsed - this.lastHudSyncTime > 0.12) {
        this.lastHudSyncTime = elapsed;
        this.callbacks.onPlayerMove?.({
          x: this.playerPos.x,
          z: this.playerPos.z,
          yaw: this.playerYaw,
          floor: this.currentFloor,
        });
      }

      this.renderer.render(this.scene, this.camera);
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
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
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

    this.destDoorLockedTex?.dispose();
    this.destDoorUnlockedTex?.dispose();
    this.destPlaqueLockedTex?.dispose();
    this.destPlaqueUnlockedTex?.dispose();

    this.renderer.dispose();
  }
}
