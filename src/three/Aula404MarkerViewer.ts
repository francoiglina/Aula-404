import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export type MarkerGlbKind = 'objeto' | 'persona';

/**
 * Rutas oficiales de los modelos GLB de marcadores para Aula 404.
 * Se sirven desde /public/assets/glb/ (equivalente a "assets/glb/..." en el navegador).
 */
export const MARKER_GLB_PATHS: Record<MarkerGlbKind, string> = {
  objeto: '/assets/glb/dpwii_parcial2_marcadores_objeto.glb',
  persona: '/assets/glb/dpwii_parcial2_marcadores_persona.glb',
};

/**
 * Nombres de los clips de rotación interna exportados desde Blender:
 * - "objeto.glb" utiliza el sufijo ".001" ("empty_rotacion+Action.001" y "empty_rotacion-Action.001").
 * - "persona.glb" exporta las mismas pistas sin ".001" ("empty_rotacion+Action", "empty_rotacion-Action" y ".003").
 */
const ROTATION_ACTION_NAMES = [
  'empty_rotacion+Action.001',
  'empty_rotacion-Action.001',
  'empty_rotacion+Action',
  'empty_rotacion-Action',
  'empty_rotacion-Action.003',
] as const;

/**
 * Nodos objetivo para el efecto procedural de flotación senoidal en el eje Y.
 * Conviven con la rotación en Y de THREE.AnimationMixer porque las pistas nativas
 * de rotación solo animan `.quaternion` y dejan libre `.position.y`.
 */
const PRIMARY_FLOAT_NODE_NAMES = ['empty_rotacion+.001', 'empty_rotacion+'] as const;
const ICON_FLOAT_NODE_NAMES = [
  'empty_rotacion-.001',
  'empty_rotacion-',
  'empty_rotacion-.003',
] as const;

export interface FloatNodeBinding {
  node: THREE.Object3D;
  baseY: number;
  amplitudeFactor: number;
}

export interface GlbMarkerInstance {
  kind: MarkerGlbKind;
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: THREE.AnimationAction[];
  floatNodes: FloatNodeBinding[];
  update: (delta: number, elapsed: number) => void;
  dispose: () => void;
}

export interface CreateGlbMarkerOptions {
  /** Frecuencia angular del movimiento vertical Math.sin (rad/s). Por defecto 2.1 */
  floatFrequency?: number;
  /** Amplitud vertical en unidades locales del GLB. Por defecto 0.14 */
  floatAmplitude?: number;
  /** Desfase inicial para desincronizar múltiples marcadores en escena */
  phaseOffset?: number;
}

// Caché compartido en memoria para descargar y parsear cada archivo .glb una sola vez
const sharedGltfLoader = new GLTFLoader();
const gltfTemplateCache = new Map<MarkerGlbKind, Promise<GLTF>>();

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

/**
 * Carga y almacena en caché el recurso GLTF original para "objeto" o "persona".
 */
export function loadMarkerGltfTemplate(kind: MarkerGlbKind): Promise<GLTF> {
  const cached = gltfTemplateCache.get(kind);
  if (cached) return cached;

  const url = MARKER_GLB_PATHS[kind];
  const promise = new Promise<GLTF>((resolve, reject) => {
    sharedGltfLoader.load(
      url,
      (gltf) => resolve(gltf),
      undefined,
      (error) => {
        gltfTemplateCache.delete(kind);
        reject(error);
      }
    );
  });

  gltfTemplateCache.set(kind, promise);
  return promise;
}

/**
 * Prepara materiales PBR y emisión neón (KHR_materials_emissive_strength) sobre una instancia clonada.
 * Evita conflictos de z-buffer entre los cilindros translúcidos concéntricos (`alphaMode: BLEND`)
 * y el medallón central opaco.
 */
function configureMarkerMaterials(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;

    const cloneAndTune = (mat: THREE.Material): THREE.Material => {
      const cloned = mat.clone();
      const std = cloned as THREE.MeshStandardMaterial;

      if ('envMapIntensity' in std) {
        std.envMapIntensity = 1.2;
      }

      // GLTFLoader importa automáticamente KHR_materials_emissive_strength en std.emissiveIntensity.
      // Aseguramos orden de pintado limpio para los cilindros de aura translúcida.
      if (std.transparent) {
        std.depthWrite = false;
        std.side = THREE.DoubleSide;
        mesh.renderOrder = 2;
      } else {
        mesh.renderOrder = 1;
      }

      std.needsUpdate = true;
      return cloned;
    };

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(cloneAndTune);
    } else if (mesh.material) {
      mesh.material = cloneAndTune(mesh.material);
    }
  });
}

/**
 * Instancia un marcador GLB ("objeto" o "persona") listo para insertarse en cualquier escena Three.js,
 * con sus rotaciones nativas en bucle (`LoopRepeat`) y flotación senoidal (`Math.sin`) sobre el eje Y.
 */
export async function createGlbMarkerInstance(
  kind: MarkerGlbKind,
  options: CreateGlbMarkerOptions = {}
): Promise<GlbMarkerInstance> {
  const {
    floatFrequency = 2.1,
    floatAmplitude = 0.14,
    phaseOffset = 0,
  } = options;

  const gltf = await loadMarkerGltfTemplate(kind);
  const root = gltf.scene.clone(true);
  configureMarkerMaterials(root);

  // 1. Configurar THREE.AnimationMixer y reproducir los clips nativos de rotación en LoopRepeat
  const mixer = new THREE.AnimationMixer(root);
  const actions: THREE.AnimationAction[] = [];

  for (const clipName of ROTATION_ACTION_NAMES) {
    const clip = THREE.AnimationClip.findByName(gltf.animations, clipName);
    if (clip) {
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = false;
      action.enabled = true;
      action.reset().play();
      actions.push(action);
    }
  }

  // Fallback defensivo por si se exporta una variante con sufijo distinto
  if (actions.length === 0 && gltf.animations.length > 0) {
    gltf.animations.forEach((clip) => {
      if (clip.name.startsWith('empty_rotacion')) {
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.play();
        actions.push(action);
      }
    });
  }

  // 2. Registrar los nodos centrales (`empty_rotacion+.001` y medallón/icono `empty_rotacion-.001`)
  //    preservando su posición Y original para aplicar el desplazamiento senoidal limpio.
  const floatNodes: FloatNodeBinding[] = [];

  for (const name of PRIMARY_FLOAT_NODE_NAMES) {
    const node = root.getObjectByName(name);
    if (node) {
      floatNodes.push({
        node,
        baseY: node.position.y,
        amplitudeFactor: 0.7,
      });
    }
  }

  for (const name of ICON_FLOAT_NODE_NAMES) {
    const node = root.getObjectByName(name);
    if (node) {
      floatNodes.push({
        node,
        baseY: node.position.y,
        amplitudeFactor: 1.0,
      });
    }
  }

  const update = (delta: number, elapsed: number) => {
    // Avanza la rotación sobre el eje Y de los clips internos del GLB
    mixer.update(delta);

    // Flotación vertical suave (Math.sin) que convive con la rotación sobre Y
    const wave = Math.sin(elapsed * floatFrequency + phaseOffset);
    for (let i = 0; i < floatNodes.length; i++) {
      const target = floatNodes[i];
      target.node.position.y =
        target.baseY + wave * floatAmplitude * target.amplitudeFactor;
    }
  };

  const dispose = () => {
    mixer.stopAllAction();
    mixer.uncacheRoot(root);
    root.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      // No destruimos geometry porque se comparte con el template en caché; solo materiales clonados
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material?.dispose();
      }
    });
  };

  return {
    kind,
    root,
    mixer,
    actions,
    floatNodes,
    update,
    dispose,
  };
}

export interface Aula404MarkerViewerOptions {
  initialMarker?: MarkerGlbKind;
  onLoadStateChange?: (state: { loading: boolean; error: string | null; activeKind: MarkerGlbKind }) => void;
}

/**
 * Visor 3D modular y reutilizable para inspeccionar y alternar los marcadores GLB
 * ("objeto" y "persona") con iluminación PBR + Emissive Strength, canvas transparente,
 * OrbitControls amortiguados y ajuste responsivo automático.
 */
export class Aula404MarkerViewer {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private clock = new THREE.Clock();
  private resizeObserver: ResizeObserver | null = null;

  private isSoftwareGl: boolean;
  private disposed = false;
  private frameId = 0;
  private loadRequestId = 0;

  private currentKind: MarkerGlbKind;
  private activeInstance: GlbMarkerInstance | null = null;
  private markerAnchor = new THREE.Group();
  private onLoadStateChange?: Aula404MarkerViewerOptions['onLoadStateChange'];

  // Escala uniforme para encuadrar los ~7.12 unidades de Blender a ~2.65m métricos
  private static readonly VIEWER_MODEL_SCALE = 0.37;
  private static readonly DEFAULT_CAM_POS = new THREE.Vector3(0, 1.55, 4.15);
  private static readonly DEFAULT_TARGET = new THREE.Vector3(0, 1.28, 0);

  constructor(container: HTMLElement, options: Aula404MarkerViewerOptions = {}) {
    this.container = container;
    this.currentKind = options.initialMarker ?? 'objeto';
    this.onLoadStateChange = options.onLoadStateChange;
    this.isSoftwareGl = detectSoftwareWebGL();

    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);

    // 1. Escena con fondo transparente integrada al tema oscuro CSS de Aula 404
    this.scene = new THREE.Scene();

    // 2. Cámara en perspectiva encuadrada sobre el eje central del marcador
    this.camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 50);
    this.camera.position.copy(Aula404MarkerViewer.DEFAULT_CAM_POS);

    // 3. Renderer WebGL con canal alfa transparente y mapeo tonal ACES Filmic para brillo neón
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.setSize(width, height);
    this.renderer.domElement.className = 'block h-full w-full touch-none outline-none';

    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    // Mapa de entorno procedural para reflejos PBR nítidos en bordes metálicos/cerámicos
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 4. Iluminación Ambiental + Direccional optimizada para PBR y KHR_materials_emissive_strength
    this.setupLighting();

    // Sombra de contacto sutil bajo el marcador para asentarlo visualmente en el espacio
    const contactShadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.25, 36),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
      })
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.01;
    this.scene.add(contactShadow);

    this.scene.add(this.markerAnchor);

    // 5. OrbitControls con amortiguación suave y límites de zoom/ángulo para proteger el encuadre
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = false;
    this.controls.minDistance = 2.35;
    this.controls.maxDistance = 6.4;
    this.controls.minPolarAngle = Math.PI * 0.16;
    this.controls.maxPolarAngle = Math.PI * 0.76;
    this.controls.target.copy(Aula404MarkerViewer.DEFAULT_TARGET);
    this.controls.update();

    this.bindResizeEvents();
    void this.loadMarker(this.currentKind);

    this.clock.start();
    this.scheduleNextFrame();
  }

  private setupLighting(): void {
    // Luz ambiental fría tenue que preserva el contraste nocturno de Aula 404
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.78);
    this.scene.add(ambientLight);

    // Luz direccional principal (Key Light) para resaltar relieves PBR del medallón e icono SVG
    const keyLight = new THREE.DirectionalLight(0xf8fafc, 1.65);
    keyLight.position.set(4.5, 7.0, 5.5);
    this.scene.add(keyLight);

    // Contraluz neón cian (Rim Light izquierdo)
    const cyanRimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
    cyanRimLight.position.set(-5.0, 3.5, -4.5);
    this.scene.add(cyanRimLight);

    // Contraluz neón carmesí (Rim Light derecho)
    const crimsonRimLight = new THREE.DirectionalLight(0xfb7185, 0.72);
    crimsonRimLight.position.set(5.0, 2.2, -4.0);
    this.scene.add(crimsonRimLight);
  }

  /**
   * Carga o alterna dinámicamente entre el marcador "objeto" y "persona".
   */
  public async loadMarker(kind: MarkerGlbKind): Promise<void> {
    if (this.disposed) return;
    this.currentKind = kind;
    const requestId = ++this.loadRequestId;

    this.onLoadStateChange?.({
      loading: true,
      error: null,
      activeKind: kind,
    });

    try {
      const instance = await createGlbMarkerInstance(kind, {
        floatFrequency: 2.15,
        floatAmplitude: 0.14,
      });

      if (this.disposed || requestId !== this.loadRequestId) {
        instance.dispose();
        return;
      }

      if (this.activeInstance) {
        this.markerAnchor.remove(this.activeInstance.root);
        this.activeInstance.dispose();
        this.activeInstance = null;
      }

      instance.root.scale.setScalar(Aula404MarkerViewer.VIEWER_MODEL_SCALE);
      // Compensa el límite inferior (-0.27 * 0.37 ≈ -0.10) para apoyar la base sobre y = 0.02
      instance.root.position.set(0, 0.12, 0);

      this.markerAnchor.add(instance.root);
      this.activeInstance = instance;

      this.onLoadStateChange?.({
        loading: false,
        error: null,
        activeKind: kind,
      });
    } catch (err) {
      if (this.disposed || requestId !== this.loadRequestId) return;
      this.onLoadStateChange?.({
        loading: false,
        error: err instanceof Error ? err.message : 'No se pudo cargar el modelo GLB',
        activeKind: kind,
      });
    }
  }

  public getActiveMarkerKind(): MarkerGlbKind {
    return this.currentKind;
  }

  public resetCamera(): void {
    this.camera.position.copy(Aula404MarkerViewer.DEFAULT_CAM_POS);
    this.controls.target.copy(Aula404MarkerViewer.DEFAULT_TARGET);
    this.controls.update();
  }

  private handleResize = (): void => {
    if (this.disposed) return;
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private bindResizeEvents(): void {
    window.addEventListener('resize', this.handleResize);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.handleResize();
      });
      this.resizeObserver.observe(this.container);
    }
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterSoftwareDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private afterSoftwareDraw(cb: () => void): void {
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

  private tick = (): void => {
    if (this.disposed) return;

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsed = this.clock.elapsedTime;

    if (!document.hidden) {
      if (this.activeInstance) {
        this.activeInstance.update(delta, elapsed);
      }
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    }

    this.scheduleNextFrame();
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (this.activeInstance) {
      this.markerAnchor.remove(this.activeInstance.root);
      this.activeInstance.dispose();
      this.activeInstance = null;
    }

    this.controls.dispose();
    if (this.scene.environment) {
      this.scene.environment.dispose();
    }
    this.renderer.dispose();
  }
}
