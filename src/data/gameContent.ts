import {
  ClueRecord,
  DialoguePayload,
  FinalSubstate,
  GamePhase,
  PhaseIndicator,
  SensorChallengeType,
  SensorInteractionData,
  WalkableRect,
  WorldMarker,
} from '../types';

export const PORTRAITS = {
  conserje: '/assets/aistudio/Conserje_be5458b0.png',
  hotaru: '/assets/aistudio/Hotaru_4d378ebf.png',
  kaeru: '/assets/aistudio/Kaeru_0a390eb4.png',
  hanako: '/assets/aistudio/Hanako_0752d4d7.png',
  profesor: '/assets/aistudio/Profesor_0a390eb4.png',
  tsuki: '/assets/aistudio/Tsuki_f950e1ef.png',
};

export const MAP_IMAGES = {
  1: '/assets/aistudio/dpii_parcial2_mapa_01_primerpiso_03508a29.jpg',
  2: '/assets/aistudio/dpii_parcial2_mapa_02_segundopiso_1673663b.jpg',
};

// Walkable architectural layout faithful to dpii_parcial2_mapa_01 & 02
export const WALKABLE_ZONES: WalkableRect[] = [
  // ================= PRIMER PISO (1F) =================
  // Unified Vestibule + Genkan Hall (the 3 shoe-locker islands collide via tight THREE.Box3)
  {
    id: '1f_vestibulo_genkan',
    name: 'Entrada Genkan · Vestíbulo (1° Piso)',
    floor: 1,
    minX: -5.45,
    maxX: 5.45,
    minZ: -4.05,
    maxZ: 7.45,
  },
  {
    id: '1f_pasillo_principal',
    name: 'Pasillo Principal (1° Piso)',
    floor: 1,
    minX: -28.05,
    maxX: 28.05,
    minZ: -2.2,
    maxZ: 2.2,
  },
  {
    id: '1f_escalera_oeste',
    name: 'Escaleras Oeste (1° Piso)',
    floor: 1,
    minX: -24.85,
    maxX: -21.75,
    minZ: 0.4,
    maxZ: 3.9,
  },
  {
    id: '1f_escalera_este',
    name: 'Escaleras Este (1° Piso)',
    floor: 1,
    minX: 23.15,
    maxX: 26.25,
    minZ: 0.4,
    maxZ: 3.9,
  },
  {
    id: '1f_pasillo_oeste',
    name: 'Pasillo Ala Izquierda (1° Piso)',
    floor: 1,
    minX: -28.0,
    maxX: -24.0,
    minZ: -19.2,
    maxZ: 2.15,
  },
  {
    id: '1f_armario_limpieza',
    name: 'Armario de Limpieza (1° Piso)',
    floor: 1,
    minX: -29.25,
    maxX: -22.75,
    minZ: -24.45,
    maxZ: -17.2,
  },
  {
    id: '1f_pasillo_este',
    name: 'Pasillo Ala Derecha (1° Piso)',
    floor: 1,
    minX: 24.0,
    maxX: 28.0,
    minZ: -16.2,
    maxZ: 2.15,
  },
  {
    id: '1f_aparcabicicletas',
    name: 'Aparcabicicletas (1° Piso)',
    floor: 1,
    minX: 22.2,
    maxX: 29.8,
    minZ: -24.6,
    maxZ: -14.2,
  },

  // ================= SEGUNDO PISO (2F) =================
  {
    id: '2f_pasillo_principal',
    name: 'Pasillo Principal (2° Piso)',
    floor: 2,
    minX: -28.05,
    maxX: 28.05,
    minZ: -2.2,
    maxZ: 2.2,
  },
  {
    id: '2f_escalera_oeste',
    name: 'Escaleras Oeste (2° Piso)',
    floor: 2,
    minX: -24.85,
    maxX: -21.75,
    minZ: 0.4,
    maxZ: 3.9,
  },
  {
    id: '2f_escalera_este',
    name: 'Escaleras Este (2° Piso)',
    floor: 2,
    minX: 23.15,
    maxX: 26.25,
    minZ: 0.4,
    maxZ: 3.9,
  },
  {
    id: '2f_pasillo_oeste',
    name: 'Pasillo Ala Izquierda (2° Piso)',
    floor: 2,
    minX: -28.0,
    maxX: -24.0,
    minZ: -19.2,
    maxZ: 2.15,
  },
  {
    id: '2f_sala_profesores',
    name: 'Sala de Profesores (2° Piso)',
    floor: 2,
    minX: -29.25,
    maxX: -22.75,
    minZ: -24.5,
    maxZ: -17.2,
  },
  {
    id: '2f_pasillo_este',
    name: 'Pasillo Ala Derecha (2° Piso)',
    floor: 2,
    minX: 24.0,
    maxX: 28.0,
    minZ: -16.2,
    maxZ: 2.15,
  },
  {
    id: '2f_banos',
    name: 'Baños (2° Piso)',
    floor: 2,
    minX: 22.25,
    maxX: 29.75,
    minZ: -23.75,
    maxZ: -14.2,
  },
];

export const WORLD_MARKERS: WorldMarker[] = [
  // --- Vestíbulo Inicial (1F) ---
  {
    id: 'personaje_tsuki',
    kind: 'personaje',
    glbFile: 'dpwii_parcial2_marcadores_personaje.glb',
    label: 'Tsuki',
    sublabel: 'Estudiante · Entrada Principal',
    floor: 1,
    position: [-2.8, 0, -0.8],
    portraitUrl: PORTRAITS.tsuki,
  },
  {
    id: 'objeto_vestibulo',
    kind: 'objeto',
    glbFile: 'dpwii_parcial2_marcadores_objeto.glb',
    label: 'Tablero de Avisos',
    sublabel: 'Listas de Grupos · 1° Piso',
    floor: 1,
    position: [2.2, 0, -1.6],
  },

  // --- PASO 1: Conserje y Armario de Limpieza (1F Ala Izquierda) ---
  {
    id: 'personaje_conserje',
    kind: 'personaje',
    glbFile: 'dpwii_parcial2_marcadores_personaje.glb',
    label: 'El Conserje',
    sublabel: 'Personal de Mantenimiento',
    floor: 1,
    position: [-27.2, 0, -20.8],
    portraitUrl: PORTRAITS.conserje,
  },
  {
    id: 'objeto_armario',
    kind: 'objeto',
    glbFile: 'dpwii_parcial2_marcadores_objeto.glb',
    label: 'Armario de Limpieza',
    sublabel: 'Cuarto de Limpieza · Fondo Izquierdo',
    floor: 1,
    position: [-24.5, 0, -22.6],
    requiredPhase: 'ESTADO_1',
    challengeType: 'touch_closet',
  },

  // --- PASO 2: Hotaru y Bicicletas (1F Ala Derecha) ---
  {
    id: 'personaje_hotaru',
    kind: 'personaje',
    glbFile: 'dpwii_parcial2_marcadores_personaje.glb',
    label: 'Hotaru',
    sublabel: 'Estudiante · Zona de Bicicletas',
    floor: 1,
    position: [24.2, 0, -18.5],
    portraitUrl: PORTRAITS.hotaru,
  },
  {
    id: 'objeto_hotaru',
    kind: 'objeto',
    glbFile: 'dpwii_parcial2_marcadores_objeto.glb',
    label: 'Bicicletas con Hojas',
    sublabel: 'Patio Exterior · Ala Derecha',
    floor: 1,
    position: [27.5, 0, -21.8],
    requiredPhase: 'ESTADO_2',
    challengeType: 'shake_bikes',
  },

  // --- PASO 3: Kaeru y Campanita cerca de 1B (1F) ---
  {
    id: 'personaje_kaeru',
    kind: 'personaje',
    glbFile: 'dpwii_parcial2_marcadores_personaje.glb',
    label: 'Kaeru',
    sublabel: 'Estudiante · Pasillo frente a 1B',
    floor: 1,
    position: [-12.0, 0, 0.7],
    portraitUrl: PORTRAITS.kaeru,
  },
  {
    id: 'objeto_kaeru',
    kind: 'objeto',
    glbFile: 'dpwii_parcial2_marcadores_objeto.glb',
    label: 'Campanita de Vidrio',
    sublabel: 'Pasillo Principal · Cerca de 1B',
    floor: 1,
    position: [-9.2, 0, -1.2],
    requiredPhase: 'ESTADO_3',
    challengeType: 'mic_whisper',
  },

  // --- Escaleras Primer Piso -> Segundo Piso ---
  {
    id: 'escalera_1f_oeste',
    kind: 'escalera',
    glbFile: 'dpwii_parcial2_marcadores_escalera.glb',
    label: 'Subir al Segundo Piso',
    sublabel: 'Escalera Izquierda',
    floor: 1,
    position: [-23.3, 0, 2.9],
    targetFloor: 2,
    spawnAfterStairs: [-23.3, 0, 1.0],
    spawnYaw: 0,
  },
  {
    id: 'escalera_1f_este',
    kind: 'escalera',
    glbFile: 'dpwii_parcial2_marcadores_escalera.glb',
    label: 'Subir al Segundo Piso',
    sublabel: 'Escalera Derecha',
    floor: 1,
    position: [24.7, 0, 2.9],
    targetFloor: 2,
    spawnAfterStairs: [24.7, 0, 1.0],
    spawnYaw: 0,
  },

  // --- Escaleras Segundo Piso -> Primer Piso ---
  {
    id: 'escalera_2f_oeste',
    kind: 'escalera',
    glbFile: 'dpwii_parcial2_marcadores_escalera.glb',
    label: 'Bajar al Primer Piso',
    sublabel: 'Escalera Izquierda',
    floor: 2,
    position: [-23.3, 0, 2.9],
    targetFloor: 1,
    spawnAfterStairs: [-23.3, 0, 1.0],
    spawnYaw: 0,
  },
  {
    id: 'escalera_2f_este',
    kind: 'escalera',
    glbFile: 'dpwii_parcial2_marcadores_escalera.glb',
    label: 'Bajar al Primer Piso',
    sublabel: 'Escalera Derecha',
    floor: 2,
    position: [24.7, 0, 2.9],
    targetFloor: 1,
    spawnAfterStairs: [24.7, 0, 1.0],
    spawnYaw: 0,
  },

  // --- PASO 4: Hanako y Espejo de los Baños (2F Ala Derecha) ---
  {
    id: 'personaje_hanako',
    kind: 'personaje',
    glbFile: 'dpwii_parcial2_marcadores_personaje.glb',
    label: 'Hanako',
    sublabel: 'Estudiante · Baños del 2° Piso',
    floor: 2,
    position: [24.2, 0, -18.5],
    portraitUrl: PORTRAITS.hanako,
  },
  {
    id: 'objeto_hanako',
    kind: 'objeto',
    glbFile: 'dpwii_parcial2_marcadores_objeto.glb',
    label: 'Espejo de los Lavabos',
    sublabel: 'Baños · Ala Derecha (2° Piso)',
    floor: 2,
    position: [27.6, 0, -21.2],
    requiredPhase: 'ESTADO_4',
    challengeType: 'light_hanako',
  },

  // --- PASO 5: El Profesor y Caja del Escritorio (2F Ala Izquierda) ---
  {
    id: 'personaje_profesor',
    kind: 'personaje',
    glbFile: 'dpwii_parcial2_marcadores_personaje.glb',
    label: 'El Profesor',
    sublabel: 'Docente · Sala de Profesores',
    floor: 2,
    position: [-27.2, 0, -20.8],
    portraitUrl: PORTRAITS.profesor,
  },
  {
    id: 'objeto_profesor',
    kind: 'objeto',
    glbFile: 'dpwii_parcial2_marcadores_objeto.glb',
    label: 'Caja del Escritorio',
    sublabel: 'Sala de Profesores · 2° Piso',
    floor: 2,
    position: [-24.5, 0, -22.6],
    requiredPhase: 'ESTADO_5',
    challengeType: 'gyro_profesor',
  },

  // --- SECUENCIA FINAL: Marcador de objeto (.glb) frente a la puerta del Salón 2C (2F) ---
  {
    id: 'objeto_puerta_destino',
    kind: 'objeto',
    glbFile: 'dpwii_parcial2_marcadores_objeto.glb',
    label: 'Seguro del Salón 2C',
    sublabel: 'Frente a la puerta · 2° Piso',
    floor: 2,
    position: [10.8, 0, 1.35],
    requiredPhase: 'ESTADO_FINAL',
  },
];

export const INITIAL_CLUES: ClueRecord[] = [
  {
    id: 'clue_1',
    stepNumber: 1,
    title: 'Lo que comentaban los de la 1D',
    location: 'Cuarto de limpieza · 1° Piso',
    sensorUsed: 'Rumor de Pasillo',
    summary:
      'El conserje escuchó a dos chicos de la 1D decir que alguien había guardado un sobre detrás de las cubetas, en el armario viejo que tiene el seguro flojo.',
    unlocked: false,
  },
  {
    id: 'clue_2',
    stepNumber: 2,
    title: 'La hoja arrancada de cuaderno',
    location: 'Armario de limpieza · 1° Piso',
    sensorUsed: 'Tacto',
    summary:
      'En una nota pasada entre alumnos de la 1A comentaban que Hotaru vio quién se llevó la lista faltante mientras dejaba su bicicleta en el patio de la derecha.',
    unlocked: false,
  },
  {
    id: 'clue_3',
    stepNumber: 3,
    title: 'Huellas rumbo al salón 1B',
    location: 'Zona de bicicletas · 1° Piso',
    sensorUsed: 'Sacudida',
    summary:
      'Tal como contaban los de la 2C, al sacudir las hojas secas aparecieron huellas hacia el pasillo; dicen que Kaeru siempre pasa el rato frente a la 1B.',
    unlocked: false,
  },
  {
    id: 'clue_4',
    stepNumber: 4,
    title: 'Rumores del segundo piso',
    location: 'Pasillo frente a la 1B',
    sensorUsed: 'Soplo / Sonido',
    summary:
      'Después de comprobar lo que decían las chicas de la 1B sobre la campanita, Kaeru recordó que los de la 2D siempre mencionan a Hanako en los baños de arriba.',
    unlocked: false,
  },
  {
    id: 'clue_5',
    stepNumber: 5,
    title: 'El mensaje en el vidrio empañado',
    location: 'Baños del 2° Piso',
    sensorUsed: 'Oscuridad',
    summary:
      'Como decían los de la 2C, al cubrir la luz se leyó el espejo de los lavabos; en la 2A cuentan que un profesor guarda esos registros al otro extremo del piso.',
    unlocked: false,
  },
  {
    id: 'clue_6',
    stepNumber: 6,
    title: 'El registro asignado a la 2C',
    location: 'Sala de Profesores · 2° Piso',
    sensorUsed: 'Equilibrio',
    summary:
      'Al nivelar la caja del escritorio apareció tu registro para el salón 2C; cuentan que alguien dejó una pieza frente a esa puerta para quitarle el seguro exterior.',
    unlocked: false,
  },
];

export const PHASE_INDICATORS: Record<GamePhase, PhaseIndicator> = {
  ESTADO_0: {
    stageTag: 'Rumor I',
    title: 'Comentarios en la entrada',
    whisper: 'Los de la 1C dicen que los papeles extraviados suelen terminar en limpieza, al fondo a la izquierda.',
  },
  ESTADO_1: {
    stageTag: 'Rumor II',
    title: 'El rumor de los de la 1D',
    whisper: 'Cuentan que alguien dejó algo escondido entre las escobas del armario viejo.',
  },
  ESTADO_2: {
    stageTag: 'Rumor III',
    title: 'Lo que vieron en las bicicletas',
    whisper: 'Una nota de los de la 1A menciona a Hotaru afuera, en el patio del ala derecha.',
  },
  ESTADO_3: {
    stageTag: 'Rumor IV',
    title: 'Conversaciones frente a la 1B',
    whisper: 'Dicen que Kaeru siempre se queda conversando cerca de la puerta de la 1B.',
  },
  ESTADO_4: {
    stageTag: 'Rumor V',
    title: 'El comentario de los de la 2D',
    whisper: 'Aseguran que subiendo a los baños del segundo piso, Hanako se entera de todo.',
  },
  ESTADO_5: {
    stageTag: 'Rumor VI',
    title: 'Rumores pasando la 2A',
    whisper: 'Los de la 2A cuentan que en la sala de profesores guardan los registros fuera de lista.',
  },
  ESTADO_FINAL: {
    stageTag: 'Rumor Final',
    title: 'Lo que dejaron frente a la 2C',
    whisper: 'Tu registro indica el salón 2C; dicen que frente a su puerta quedó el pase para abrirla.',
  },
};

export function getPhaseIndicator(
  phase: GamePhase,
  unlockedObjects: Record<string, boolean>,
  finalSubstate: FinalSubstate = 'pendiente'
): PhaseIndicator {
  if (phase === 'ESTADO_FINAL') {
    if (finalSubstate === 'puerta_desbloqueada') {
      return {
        stageTag: 'Puerta Abierta',
        title: 'Entrada al salón 2C',
        whisper: 'Quitaste el seguro exterior; ya puedes acercarte y abrir la puerta del salón 2C.',
      };
    }
    if (finalSubstate === 'completada') {
      return {
        stageTag: 'Resuelto',
        title: 'Primer día completado',
        whisper: 'Al final, todo lo que se comentaba en los pasillos resultó ser cierto.',
      };
    }
    return PHASE_INDICATORS.ESTADO_FINAL;
  }
  if (phase === 'ESTADO_2' && unlockedObjects.objeto_hotaru) {
    return {
      stageTag: 'Rumor III',
      title: 'La anécdota de las bicicletas',
      whisper: 'Los de la 2C contaban que solo con una buena sacudida se quitaron las hojas secas.',
    };
  }
  if (phase === 'ESTADO_3' && unlockedObjects.objeto_kaeru) {
    return {
      stageTag: 'Rumor IV',
      title: 'La historia de la campanita',
      whisper: 'Unas chicas de la 1B decían que ese vidrio devuelve sonidos si alguien sopla cerca.',
    };
  }
  if (phase === 'ESTADO_4' && unlockedObjects.objeto_hanako) {
    return {
      stageTag: 'Rumor V',
      title: 'El mensaje en el espejo',
      whisper: 'Según los de la 2C, con tanta claridad no se distingue nada hasta dejar todo a oscuras.',
    };
  }
  if (phase === 'ESTADO_5' && unlockedObjects.objeto_profesor) {
    return {
      stageTag: 'Rumor VI',
      title: 'El mecanismo de la caja antigua',
      whisper: 'En secretaría dicen que esa cerradura solo cede si se mantiene completamente nivelada.',
    };
  }
  return PHASE_INDICATORS[phase];
}

export const SENSOR_COMPLETION_DATA: Record<SensorChallengeType, SensorInteractionData> = {
  touch_closet: {
    sensorType: 'touch_closet',
    clueStep: 2,
    nextPhase: 'ESTADO_2',
    nextZoneHint: 'Alguien vio quién se llevó la lista cerca de las bicicletas del patio derecho...',
  },
  shake_bikes: {
    sensorType: 'shake_bikes',
    clueStep: 3,
    nextPhase: 'ESTADO_3',
    nextZoneHint: 'Las huellas bajo las hojas regresan hacia el salón 1B, donde cuelga la campanita...',
  },
  mic_whisper: {
    sensorType: 'mic_whisper',
    clueStep: 4,
    nextPhase: 'ESTADO_4',
    nextZoneHint: 'El susurro proviene del segundo piso, rumbo a los baños del fondo...',
  },
  light_hanako: {
    sensorType: 'light_hanako',
    clueStep: 5,
    nextPhase: 'ESTADO_5',
    nextZoneHint: 'El mensaje en el espejo empañado apunta hacia la sala de profesores...',
  },
  gyro_profesor: {
    sensorType: 'gyro_profesor',
    clueStep: 6,
    nextPhase: 'ESTADO_FINAL',
    nextZoneHint: 'Tu registro indica el salón 2C; dejaron una pieza frente a su puerta para abrirla...',
  },
};

export const POST_CHALLENGE_DIALOGUES: Record<SensorChallengeType, DialoguePayload> = {
  touch_closet: {
    markerId: 'objeto_armario',
    speakerName: 'Hoja de Cuaderno',
    speakerRole: 'Nota doblada entre las escobas',
    lines: [
      'Es una hoja cuadriculada escrita con prisa, como si dos compañeros se la hubieran pasado durante la clase:',
      '"Oye, me acaban de contar unos chicos de la 1A que hoy temprano Hotaru vio quién se llevó la lista que falta mientras dejaba su bicicleta afuera, en el patio del fondo a la derecha."',
    ],
    sensorCompletion: SENSOR_COMPLETION_DATA.touch_closet,
  },
  shake_bikes: {
    markerId: 'personaje_hotaru',
    speakerName: 'Hotaru',
    speakerRole: 'Estudiante · Zona de Bicicletas',
    portraitUrl: PORTRAITS.hotaru,
    lines: [
      '¡Mira eso, de verdad habían quedado las huellas de lodo debajo de las hojas! Regresaron directo hacia el pasillo principal.',
      '¿Escuchaste lo que cuentan sobre Kaeru? Unos compañeros de la 1B me dijeron que casi siempre se queda ahí afuera de su salón, justo donde colgaron esa campanita de vidrio.',
    ],
    sensorCompletion: SENSOR_COMPLETION_DATA.shake_bikes,
  },
  mic_whisper: {
    markerId: 'personaje_kaeru',
    speakerName: 'Kaeru',
    speakerRole: 'Estudiante · Pasillo frente a 1B',
    portraitUrl: PORTRAITS.kaeru,
    lines: [
      'No lo puedo creer, ¡en serio se escuchó como si alguien subiera con prisa por las escaleras!',
      'Ahora que lo pienso, los chicos de la 2D siempre dicen que cuando se pierde algo extraño en la escuela, termina enterándose Hanako allá arriba, en los baños que están pasando la 2C y la 2D.',
    ],
    sensorCompletion: SENSOR_COMPLETION_DATA.mic_whisper,
  },
  light_hanako: {
    markerId: 'personaje_hanako',
    speakerName: 'Hanako',
    speakerRole: 'Estudiante · Baños del 2° Piso',
    portraitUrl: PORTRAITS.hanako,
    lines: [
      '¡Ya ves que tenían razón los de la 2C! En cuanto quedó todo oscuro se distinguió claramente lo que escribieron en el vidrio, y mira, hasta habían dejado esta llave pequeña en el borde.',
      'Hace un momento escuché a unas chicas de la 2A comentar que al otro extremo de este piso, en la sala de profesores, hay un docente que guarda bajo llave los registros que no aparecieron en la entrada.',
    ],
    sensorCompletion: SENSOR_COMPLETION_DATA.light_hanako,
  },
  gyro_profesor: {
    markerId: 'personaje_profesor',
    speakerName: 'El Profesor',
    speakerRole: 'Docente · Sala de Profesores',
    portraitUrl: PORTRAITS.profesor,
    lines: [
      '¡Vaya, la abriste al primer intento! Mira aquí dentro: este es tu registro de inscripción, con razón no aparecías abajo; te asignaron al salón 2C, en este mismo piso.',
      'Por cierto, hace un rato escuché a unos chicos comentar que la puerta de la 2C tenía trabado el seguro por fuera, pero decían que alguien dejó una pieza justo frente a la entrada para poder destrabarla.',
    ],
    sensorCompletion: SENSOR_COMPLETION_DATA.gyro_profesor,
  },
};

export function resolveMarkerDialogue(
  markerId: string,
  phase: GamePhase,
  spokenFlags: Record<string, boolean>
): DialoguePayload | null {
  switch (markerId) {
    case 'personaje_tsuki': {
      return {
        markerId,
        speakerName: 'Tsuki',
        speakerRole: 'Estudiante · Entrada Principal',
        portraitUrl: PORTRAITS.tsuki,
        lines:
          phase === 'ESTADO_0'
            ? [
                'Disculpa, ¿tú también eres de nuevo ingreso? Acabo de revisar de arriba abajo las listas de la 1A a la 1D y las de la 2A a la 2D, y parece que a varios no nos anotaron en ninguna.',
                'Aunque hace un momento escuché a unos chicos de la 1C decir que cada vez que se extravía una lista el primer día, casi siempre termina en el cuarto de limpieza del fondo a la izquierda, donde suele estar el conserje.',
              ]
            : phase === 'ESTADO_FINAL'
            ? [
                '¡Oye, qué gusto verte! Por tu expresión me imagino que era cierto aquel rumor de los alumnos de segundo sobre los registros guardados.',
              ]
            : [
                'Qué confusión en este primer día, ¿verdad? Unas chicas de la 2B comentaban hace rato que aquí uno se entera de todo prestando atención a lo que se dice en los pasillos.',
              ],
      };
    }

    case 'objeto_vestibulo': {
      return {
        markerId,
        speakerName: 'Tablero de Avisos',
        speakerRole: 'Listas de Grupos · 1° Piso',
        lines: [
          'Hojas impresas sujetas al tablero: "Primer Piso: 1A, 1B, 1C y 1D. Segundo Piso: 2A, 2B, 2C y 2D."',
          'Abajo falta una esquina arrancada y alguien escribió con lápiz al margen: "Escuché que el conserje recogió las hojas sueltas en el cuarto de limpieza, al fondo a la izquierda".',
        ],
      };
    }

    // ================= PASO 1: CONSERJE & ARMARIO =================
    case 'personaje_conserje': {
      if (phase === 'ESTADO_0') {
        return {
          markerId,
          speakerName: 'El Conserje',
          speakerRole: 'Personal de Mantenimiento',
          portraitUrl: PORTRAITS.conserje,
          lines: [
            '¿Todavía caminando por el pasillo? Mira que de la 1A a la 1D ya entraron todos... Bueno, no importa, seguro eres otro de los alumnos que no aparecieron en las listas de la entrada.',
            'Yo no sé mucho de trámites de secretaría, pero ayer por la tarde escuché a dos chicos de la 1D murmurando aquí en la puerta que alguien había escondido un sobre detrás de las cubetas.',
            'Comentaban en voz baja que ese armario viejo de madera que está ahí a un lado tiene el seguro flojo, y decían que si alguien mete la mano y aparta un poco las escobas, se encuentra enseguida.',
          ],
          advanceToPhase: 'ESTADO_1',
          unlocksNpcTalkFlag: 'conserje',
          unlocksObjectId: 'objeto_armario',
        };
      }
      if (phase === 'ESTADO_1') {
        return {
          markerId,
          speakerName: 'El Conserje',
          speakerRole: 'Personal de Mantenimiento',
          portraitUrl: PORTRAITS.conserje,
          lines: [
            'Solo te repito lo que les oí decir a esos dos alumnos de la 1D: que habían dejado algo guardado entre los paños y las escobas de ese armario viejo de ahí al lado.',
          ],
          unlocksObjectId: 'objeto_armario',
        };
      }
      return {
        markerId,
        speakerName: 'El Conserje',
        speakerRole: 'Personal de Mantenimiento',
        portraitUrl: PORTRAITS.conserje,
        lines: [
          '¿Así que era verdad que habían escondido una nota ahí dentro? Hoy temprano también escuché murmullos que venían del otro extremo de este piso, por el patio donde dejan las bicicletas.',
        ],
      };
    }

    case 'objeto_armario': {
      if (phase !== 'ESTADO_1' || !spokenFlags.conserje) {
        return {
          markerId,
          speakerName: 'Armario de Limpieza',
          speakerRole: 'Cuarto de Mantenimiento',
          lines:
            phase === 'ESTADO_0' || !spokenFlags.conserje
              ? ['Un armario lleno de escobas y cubetas. El conserje está aquí mismo a unos pasos vigilando quién entra.']
              : ['Ya no queda ningún papel escondido entre las escobas; solo olor a limpiador de pino y madera antigua.'],
        };
      }
      return null;
    }

    // ================= PASO 2: HOTARU & BICICLETAS =================
    case 'personaje_hotaru': {
      if (phase === 'ESTADO_0' || phase === 'ESTADO_1') {
        return {
          markerId,
          speakerName: 'Hotaru',
          speakerRole: 'Estudiante · Zona de Bicicletas',
          portraitUrl: PORTRAITS.hotaru,
          lines: [
            'Uf, qué fresco está el aire aquí afuera... Oye, hace un momento pasaron unos compañeros de la 1C diciendo que el conserje se estaba quejando allá en el cuarto de limpieza del otro lado.',
          ],
        };
      }
      if (phase === 'ESTADO_2') {
        if (spokenFlags.hotaru) {
          return {
            markerId,
            speakerName: 'Hotaru',
            speakerRole: 'Estudiante · Zona de Bicicletas',
            portraitUrl: PORTRAITS.hotaru,
            lines: [
              'En serio, eso mismo contaban los chicos de la 2C: que hasta que no hubo una buena sacudida ahí donde están las bicicletas llenas de hojas, no se vio nada.',
            ],
            unlocksObjectId: 'objeto_hotaru',
          };
        }
        return {
          markerId,
          speakerName: 'Hotaru',
          speakerRole: 'Estudiante · Zona de Bicicletas',
          portraitUrl: PORTRAITS.hotaru,
          lines: [
            '¿Esa nota salió del cuarto de limpieza? Es increíble lo rápido que corren los rumores entre los chicos de la 1A.',
            'Mira, te soy sincero: hoy cuando llegué alcancé a ver a alguien salir deprisa de entre las bicicletas, pero el viento llenó todo el suelo de hojas secas y cubrió hacia dónde caminó.',
            'De todos modos, el otro día escuché a unos compañeros de la 2C contar que el año pasado a un alumno se le cayó su credencial en ese mismo rincón, y dicen que solo apareció cuando sacudieron todo con fuerza hasta quitar el montón de hojas.',
          ],
          unlocksNpcTalkFlag: 'hotaru',
          unlocksObjectId: 'objeto_hotaru',
        };
      }
      return {
        markerId,
        speakerName: 'Hotaru',
        speakerRole: 'Estudiante · Zona de Bicicletas',
        portraitUrl: PORTRAITS.hotaru,
        lines: [
          'Por lo que comentaban unos compañeros de la 1B hace un rato, Kaeru lleva toda la mañana en el pasillo principal, justo frente a su salón.',
        ],
      };
    }

    case 'objeto_hotaru': {
      if (phase !== 'ESTADO_2') {
        return {
          markerId,
          speakerName: 'Bicicletas con Hojas',
          speakerRole: 'Patio Exterior',
          lines:
            phase === 'ESTADO_0' || phase === 'ESTADO_1'
              ? ['Una fila de bicicletas estacionadas con bastantes hojas secas acumuladas en el suelo.']
              : ['Las hojas secas quedaron esparcidas y se distinguen las huellas de lodo regresando hacia el pasillo.'],
        };
      }
      if (!spokenFlags.hotaru) {
        return {
          markerId,
          speakerName: 'Bicicletas con Hojas',
          speakerRole: 'Patio Exterior',
          lines: ['Hay un estudiante detenido a unos pasos observando las bicicletas.'],
        };
      }
      return null;
    }

    // ================= PASO 3: KAERU & CAMPANITA FRENTE A 1B =================
    case 'personaje_kaeru': {
      if (phase === 'ESTADO_0' || phase === 'ESTADO_1' || phase === 'ESTADO_2') {
        return {
          markerId,
          speakerName: 'Kaeru',
          speakerRole: 'Estudiante · Pasillo frente a 1B',
          portraitUrl: PORTRAITS.kaeru,
          lines: [
            'Qué silencioso se siente el pasillo con las puertas de la 1A a la 1D cerradas... Escuché que afuera, por el patio de las bicicletas, andaban comentando algo sobre unas hojas extraviadas.',
          ],
        };
      }
      if (phase === 'ESTADO_3') {
        if (spokenFlags.kaeru) {
          return {
            markerId,
            speakerName: 'Kaeru',
            speakerRole: 'Estudiante · Pasillo frente a 1B',
            portraitUrl: PORTRAITS.kaeru,
            lines: [
              'Solo te comparto lo que decían las chicas de la 1B: que como aquí adentro no corre aire, esa campanita de vidrio únicamente suena si alguien se acerca y sopla suavemente.',
            ],
            unlocksObjectId: 'objeto_kaeru',
          };
        }
        return {
          markerId,
          speakerName: 'Kaeru',
          speakerRole: 'Estudiante · Pasillo frente a 1B',
          portraitUrl: PORTRAITS.kaeru,
          lines: [
            'Ah, ¿vienes de conversar con Hotaru allá afuera? Aquí entre la 1A y la 1B no se habla de otro tema más que de los alumnos nuevos que no aparecieron en ninguna lista.',
            'Hace poco vi pasar a alguien con prisa doblando hacia las escaleras, pero iba hablando en voz tan baja que no alcancé a oír a qué parte subía.',
            'Aunque, ¿sabes qué contaban ayer unas compañeras de la 1B? Decían que esa campanita de vidrio colgada aquí al lado guarda un eco muy curioso, y aseguran que si te acercas y soplas suave, parece repetirse el rastro del último que pasó.',
          ],
          unlocksNpcTalkFlag: 'kaeru',
          unlocksObjectId: 'objeto_kaeru',
        };
      }
      return {
        markerId,
        speakerName: 'Kaeru',
        speakerRole: 'Estudiante · Pasillo frente a 1B',
        portraitUrl: PORTRAITS.kaeru,
        lines: [
          'Casi todos los de la 2C y la 2D coinciden en lo mismo: que arriba, en los baños del fondo a la derecha, Hanako siempre termina enterándose de quién guardó cada cosa.',
        ],
      };
    }

    case 'objeto_kaeru': {
      if (phase !== 'ESTADO_3') {
        return {
          markerId,
          speakerName: 'Campanita de Vidrio',
          speakerRole: 'Pasillo · Frente a 1B',
          lines:
            phase === 'ESTADO_4' || phase === 'ESTADO_5' || phase === 'ESTADO_FINAL'
              ? ['La campanita sigue moviéndose levemente, como señalando en dirección a las escaleras.']
              : ['Una campanita de viento colgada junto a la puerta cerrada del salón 1B.'],
        };
      }
      if (!spokenFlags.kaeru) {
        return {
          markerId,
          speakerName: 'Campanita de Vidrio',
          speakerRole: 'Pasillo · Frente a 1B',
          lines: ['Hay un estudiante apoyado en la pared justo al lado de la 1B.'],
        };
      }
      return null;
    }

    // ================= PASO 4: HANAKO & ESPEJO DE LOS BAÑOS =================
    case 'personaje_hanako': {
      if (phase !== 'ESTADO_4' && phase !== 'ESTADO_5' && phase !== 'ESTADO_FINAL') {
        return {
          markerId,
          speakerName: 'Hanako',
          speakerRole: 'Estudiante · Baños del 2° Piso',
          portraitUrl: PORTRAITS.hanako,
          lines: [
            '¿Qué haces aquí arriba tan temprano? Hace un rato escuché a unos compañeros de la 2B comentar que abajo, frente a la 1B, todavía estaban tratando de averiguar hacia dónde habían ido.',
          ],
        };
      }
      if (phase === 'ESTADO_4') {
        if (spokenFlags.hanako) {
          return {
            markerId,
            speakerName: 'Hanako',
            speakerRole: 'Estudiante · Baños del 2° Piso',
            portraitUrl: PORTRAITS.hanako,
            lines: [
              'Recuerda lo que comentaban los chicos de la 2C: con el reflejo tan fuerte que entra aquí, en ese espejo de los lavabos no se alcanza a ver nada a menos que cubran toda la luz.',
            ],
            unlocksObjectId: 'objeto_hanako',
          };
        }
        return {
          markerId,
          speakerName: 'Hanako',
          speakerRole: 'Estudiante · Baños del 2° Piso',
          portraitUrl: PORTRAITS.hanako,
          lines: [
            'Jaja, así que tú eres el estudiante nuevo del que venían comentando las chicas de la 2D por todo el pasillo...',
            '¿Ya te enteraste de lo que cuentan sobre el espejo grande aquí frente a los lavabos? Dicen que ayer alguien escribió con el dedo sobre el vapor hacia dónde llevaron las listas que faltaban.',
            'El detalle es que entra tanta claridad que deslumbra todo el cristal; pero el otro día unos compañeros de la 2C aseguraban que cuando se bloquea la luz y queda bien oscuro, las letras vuelven a notarse solas.',
          ],
          unlocksNpcTalkFlag: 'hanako',
          unlocksObjectId: 'objeto_hanako',
        };
      }
      return {
        markerId,
        speakerName: 'Hanako',
        speakerRole: 'Estudiante · Baños del 2° Piso',
        portraitUrl: PORTRAITS.hanako,
        lines: [
          'Según les escuché decir a las chicas de la 2A, en la sala de profesores del otro extremo de este piso sigue estando el docente que guarda esos registros bajo llave.',
        ],
      };
    }

    case 'objeto_hanako': {
      if (phase !== 'ESTADO_4') {
        return {
          markerId,
          speakerName: 'Espejo de los Lavabos',
          speakerRole: 'Baños · 2° Piso',
          lines:
            phase === 'ESTADO_5' || phase === 'ESTADO_FINAL'
              ? ['En el cristal empañado todavía se alcanza a leer la referencia a la sala de profesores pasando la 2A.']
              : ['El espejo grande frente a los lavabos refleja de lleno la luz del pasillo.'],
        };
      }
      if (!spokenFlags.hanako) {
        return {
          markerId,
          speakerName: 'Espejo de los Lavabos',
          speakerRole: 'Baños · 2° Piso',
          lines: ['Una estudiante te observa con curiosidad desde la entrada de los baños.'],
        };
      }
      return null;
    }

    // ================= PASO 5: PROFESOR & CAJA DEL ESCRITORIO =================
    case 'personaje_profesor': {
      if (phase !== 'ESTADO_5' && phase !== 'ESTADO_FINAL') {
        return {
          markerId,
          speakerName: 'El Profesor',
          speakerRole: 'Docente · Sala de Profesores',
          portraitUrl: PORTRAITS.profesor,
          lines: [
            'Disculpa, todavía estoy ordenando las listas de la 2A a la 2D. Hace poco comentaban en secretaría que alguien había visto una llave pequeña extraviada al otro lado de este piso.',
          ],
        };
      }
      if (phase === 'ESTADO_5') {
        if (spokenFlags.profesor) {
          return {
            markerId,
            speakerName: 'El Profesor',
            speakerRole: 'Docente · Sala de Profesores',
            portraitUrl: PORTRAITS.profesor,
            lines: [
              'Tal como contaba el personal de secretaría: mientras esa caja del escritorio tenga aunque sea una ligera inclinación, el seguro interno no cede.',
            ],
            unlocksObjectId: 'objeto_profesor',
          };
        }
        return {
          markerId,
          speakerName: 'El Profesor',
          speakerRole: 'Docente · Sala de Profesores',
          portraitUrl: PORTRAITS.profesor,
          lines: [
            'Vaya, así que era cierto lo que comentaban en secretaría sobre un estudiante de nuevo ingreso preguntando desde la 1A hasta la 2D... y además apareció la llave pequeña que se había perdido.',
            'Los registros de inscripción que quedaron fuera del tablero están guardados en esa caja antigua sobre el escritorio central, aunque debo advertirte que tiene su historia.',
            'Cuentan los profesores más antiguos que el director anterior la mandó fabricar con unos anillos internos muy delicados, y dicen que a todos se les atascaba hasta que descubrieron que solo se abre si se sostiene completamente recta y nivelada.',
          ],
          unlocksNpcTalkFlag: 'profesor',
          unlocksObjectId: 'objeto_profesor',
        };
      }
      return {
        markerId,
        speakerName: 'El Profesor',
        speakerRole: 'Docente · Sala de Profesores',
        portraitUrl: PORTRAITS.profesor,
        lines: [
          'En tu registro dice claramente que te corresponde el salón 2C, saliendo aquí al pasillo de este segundo piso. Dicen los alumnos que dejaron una pieza justo frente a esa puerta para quitarle el seguro.',
        ],
      };
    }

    case 'objeto_profesor': {
      if (phase !== 'ESTADO_5') {
        return {
          markerId,
          speakerName: 'Caja del Escritorio',
          speakerRole: 'Sala de Profesores · 2° Piso',
          lines:
            phase === 'ESTADO_FINAL'
              ? ['La caja de madera quedó abierta sobre el escritorio después de alinear sus anillos.']
              : ['Una caja cerrada sobre el escritorio central con unos anillos metálicos en la tapa.'],
        };
      }
      if (!spokenFlags.profesor) {
        return {
          markerId,
          speakerName: 'Caja del Escritorio',
          speakerRole: 'Sala de Profesores · 2° Piso',
          lines: ['El profesor está a unos pasos revisando unas carpetas.'],
        };
      }
      return null;
    }

    default:
      return null;
  }
}


