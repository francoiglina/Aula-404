export type GamePhase =
  | 'ESTADO_0'
  | 'ESTADO_1'
  | 'ESTADO_2'
  | 'ESTADO_3'
  | 'ESTADO_4'
  | 'ESTADO_5'
  | 'ESTADO_FINAL';

export type FinalSubstate = 'pendiente' | 'puerta_desbloqueada' | 'completada';

export type FloorNumber = 1 | 2;

export type MarkerKind = 'personaje' | 'objeto' | 'escalera' | 'puerta';

export type SensorChallengeType =
  | 'touch_closet'
  | 'shake_bikes'
  | 'mic_whisper'
  | 'light_hanako'
  | 'gyro_profesor';

// SDD Section 5.1 AppState Schema + Game State Machine extensions
export interface AppState {
  isInitialized: boolean;
  sensors: {
    gyroscopeAllowed: boolean;
    motionAllowed: boolean;
    micAllowed: boolean;
    cameraAllowed: boolean;
    lightSensorAllowed: boolean;
    facingMode: 'environment' | 'user';
  };
  orientationData: {
    alpha: number;
    beta: number;
    gamma: number;
  };
  audioMetrics: {
    volume: number; // 0.0 a 1.0
    bassLevel: number; // 0.0 a 1.0
  };
  motionMetrics: {
    shakeIntensity: number; // 0.0 a 1.0
    totalShakes: number;
  };
  lightMetrics: {
    luminance: number; // 0 (oscuro) a 255 (brillante)
    isDark: boolean;
  };
  renderConfig: {
    particleCount: number;
    colorPalette: string[];
    speedMultiplier: number;
    gyroCameraEnabled: boolean;
  };
}

export interface WalkableRect {
  id: string;
  name: string;
  floor: FloorNumber;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface WorldMarker {
  id: string;
  kind: MarkerKind;
  glbFile: string;
  label: string;
  sublabel: string;
  floor: FloorNumber;
  position: [number, number, number];
  targetFloor?: FloorNumber;
  spawnAfterStairs?: [number, number, number];
  spawnYaw?: number;
  portraitUrl?: string;
  requiredPhase?: GamePhase;
  challengeType?: SensorChallengeType;
}

export interface ClueRecord {
  id: string;
  stepNumber: number;
  title: string;
  location: string;
  sensorUsed: string;
  summary: string;
  unlocked: boolean;
}

export interface SensorInteractionData {
  sensorType: SensorChallengeType;
  clueStep: number;
  nextPhase: GamePhase;
  nextZoneHint: string;
}

export interface DialoguePayload {
  markerId: string;
  speakerName: string;
  speakerRole: string;
  portraitUrl?: string;
  lines: string[];
  advanceToPhase?: GamePhase;
  unlocksObjectId?: string;
  unlocksNpcTalkFlag?: string;
  sensorCompletion?: SensorInteractionData;
}

export interface PhaseIndicator {
  stageTag: string;
  title: string;
  whisper: string;
}


