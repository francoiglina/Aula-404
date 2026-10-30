import { ClueRecord, DialoguePayload, GamePhase, WalkableRect, WorldMarker } from '../types';

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
  {
    id: '1f_vestibulo_norte',
    name: 'Vestíbulo Principal (1° Piso)',
    floor: 1,
    minX: -5.2,
    maxX: 5.2,
    minZ: -3.8,
    maxZ: 3.1,
  },
  // 4 Genkan Entrance Aisles around the 3 shoe-locker islands
  {
    id: '1f_genkan_aisle_1',
    name: 'Entrada Genkan (1° Piso)',
    floor: 1,
    minX: -5.0,
    maxX: -3.6,
    minZ: 2.8,
    maxZ: 7.2,
  },
  {
    id: '1f_genkan_aisle_2',
    name: 'Entrada Genkan (1° Piso)',
    floor: 1,
    minX: -2.3,
    maxX: -0.7,
    minZ: 2.8,
    maxZ: 7.2,
  },
  {
    id: '1f_genkan_aisle_3',
    name: 'Entrada Genkan (1° Piso)',
    floor: 1,
    minX: 0.7,
    maxX: 2.3,
    minZ: 2.8,
    maxZ: 7.2,
  },
  {
    id: '1f_genkan_aisle_4',
    name: 'Entrada Genkan (1° Piso)',
    floor: 1,
    minX: 3.6,
    maxX: 5.0,
    minZ: 2.8,
    maxZ: 7.2,
  },
  {
    id: '1f_pasillo_principal',
    name: 'Pasillo Principal (1° Piso)',
    floor: 1,
    minX: -27.8,
    maxX: 27.8,
    minZ: -2.0,
    maxZ: 2.0,
  },
  {
    id: '1f_escalera_oeste',
    name: 'Escaleras Oeste (1° Piso)',
    floor: 1,
    minX: -24.8,
    maxX: -21.8,
    minZ: 1.5,
    maxZ: 3.8,
  },
  {
    id: '1f_escalera_este',
    name: 'Escaleras Este (1° Piso)',
    floor: 1,
    minX: 23.2,
    maxX: 26.2,
    minZ: 1.5,
    maxZ: 3.8,
  },
  {
    id: '1f_pasillo_oeste',
    name: 'Pasillo Ala Izquierda (1° Piso)',
    floor: 1,
    minX: -27.8,
    maxX: -24.2,
    minZ: -18.5,
    maxZ: 2.0,
  },
  {
    id: '1f_armario_limpieza',
    name: 'Armario de Limpieza (1° Piso)',
    floor: 1,
    minX: -29.0,
    maxX: -23.0,
    minZ: -24.2,
    maxZ: -18.0,
  },
  {
    id: '1f_pasillo_este',
    name: 'Pasillo Ala Derecha (1° Piso)',
    floor: 1,
    minX: 24.2,
    maxX: 27.8,
    minZ: -15.5,
    maxZ: 2.0,
  },
  {
    id: '1f_aparcabicicletas',
    name: 'Aparcabicicletas (1° Piso)',
    floor: 1,
    minX: 22.4,
    maxX: 29.6,
    minZ: -24.4,
    maxZ: -15.0,
  },

  // ================= SEGUNDO PISO (2F) =================
  {
    id: '2f_pasillo_principal',
    name: 'Pasillo Principal (2° Piso)',
    floor: 2,
    minX: -27.8,
    maxX: 27.8,
    minZ: -2.0,
    maxZ: 2.0,
  },
  {
    id: '2f_escalera_oeste',
    name: 'Escaleras Oeste (2° Piso)',
    floor: 2,
    minX: -24.8,
    maxX: -21.8,
    minZ: 1.5,
    maxZ: 3.8,
  },
  {
    id: '2f_escalera_este',
    name: 'Escaleras Este (2° Piso)',
    floor: 2,
    minX: 23.2,
    maxX: 26.2,
    minZ: 1.5,
    maxZ: 3.8,
  },
  {
    id: '2f_pasillo_oeste',
    name: 'Pasillo Ala Izquierda (2° Piso)',
    floor: 2,
    minX: -27.8,
    maxX: -24.2,
    minZ: -18.5,
    maxZ: 2.0,
  },
  {
    id: '2f_sala_profesores',
    name: 'Sala de Profesores (2° Piso)',
    floor: 2,
    minX: -29.2,
    maxX: -22.8,
    minZ: -24.4,
    maxZ: -18.0,
  },
  {
    id: '2f_pasillo_este',
    name: 'Pasillo Ala Derecha (2° Piso)',
    floor: 2,
    minX: 24.2,
    maxX: 27.8,
    minZ: -15.5,
    maxZ: 2.0,
  },
  {
    id: '2f_banos',
    name: 'Baños (2° Piso)',
    floor: 2,
    minX: 22.4,
    maxX: 29.6,
    minZ: -23.6,
    maxZ: -15.0,
  },
];

export const WORLD_MARKERS: WorldMarker[] = [
  // --- Vestíbulo Inicial (1F) ---
  {
    id: 'personaje_tsuki',
    kind: 'personaje',
    glbFile: 'dpwii_parcial2_marcadores_personaje.glb',
    label: 'Tsuki',
    sublabel: 'Estudiante Guía · Vestíbulo',
    floor: 1,
    position: [-2.8, 0, -0.8],
    portraitUrl: PORTRAITS.tsuki,
  },
  {
    id: 'objeto_vestibulo',
    kind: 'objeto',
    glbFile: 'dpwii_parcial2_marcadores_objeto.glb',
    label: 'Tablón Escolar',
    sublabel: 'Lista de Aulas · Vestíbulo',
    floor: 1,
    position: [2.2, 0, -1.6],
  },

  // --- PASO 1 & 2: Armario de Limpieza (1F Ala Izquierda) ---
  {
    id: 'personaje_conserje',
    kind: 'personaje',
    glbFile: 'dpwii_parcial2_marcadores_personaje.glb',
    label: 'El Conserje',
    sublabel: 'Armario de Limpieza',
    floor: 1,
    position: [-27.2, 0, -20.8],
    portraitUrl: PORTRAITS.conserje,
  },
  {
    id: 'objeto_armario',
    kind: 'objeto',
    glbFile: 'dpwii_parcial2_marcadores_objeto.glb',
    label: 'Armario de Limpieza',
    sublabel: 'Inspección Táctil 3D',
    floor: 1,
    position: [-24.5, 0, -22.6],
    requiredPhase: 'ESTADO_1',
    challengeType: 'touch_closet',
  },

  // --- PASO 3: Aparcabicicletas (1F Ala Derecha) ---
  {
    id: 'personaje_hotaru',
    kind: 'personaje',
    glbFile: 'dpwii_parcial2_marcadores_personaje.glb',
    label: 'Hotaru',
    sublabel: 'Aparcabicicletas',
    floor: 1,
    position: [24.2, 0, -18.5],
    portraitUrl: PORTRAITS.hotaru,
  },
  {
    id: 'objeto_hotaru',
    kind: 'objeto',
    glbFile: 'dpwii_parcial2_marcadores_objeto.glb',
    label: 'Bicicletas Cubiertas',
    sublabel: 'Sensor de Agitación (Shake)',
    floor: 1,
    position: [27.5, 0, -21.8],
    requiredPhase: 'ESTADO_2',
    challengeType: 'shake_bikes',
  },

  // --- PASO 4: Pasillo cerca de Aula 1B (1F) ---
  {
    id: 'personaje_kaeru',
    kind: 'personaje',
    glbFile: 'dpwii_parcial2_marcadores_personaje.glb',
    label: 'Kaeru',
    sublabel: 'Pasillo · Aula 1B',
    floor: 1,
    position: [-12.0, 0, 0.7],
    portraitUrl: PORTRAITS.kaeru,
  },
  {
    id: 'objeto_kaeru',
    kind: 'objeto',
    glbFile: 'dpwii_parcial2_marcadores_objeto.glb',
    label: 'Campana del Susurro',
    sublabel: 'Sensor de Micrófono (Soplo)',
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
    sublabel: 'Escaleras Ala Izquierda',
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
    sublabel: 'Escaleras Ala Derecha',
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
    sublabel: 'Escaleras Ala Izquierda',
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
    sublabel: 'Escaleras Ala Derecha',
    floor: 2,
    position: [24.7, 0, 2.9],
    targetFloor: 1,
    spawnAfterStairs: [24.7, 0, 1.0],
    spawnYaw: 0,
  },

  // --- PASO 5: Baños (2F Ala Derecha) ---
  {
    id: 'personaje_hanako',
    kind: 'personaje',
    glbFile: 'dpwii_parcial2_marcadores_personaje.glb',
    label: 'Hanako',
    sublabel: 'Baños · Segundo Piso',
    floor: 2,
    position: [24.2, 0, -18.5],
    portraitUrl: PORTRAITS.hanako,
  },
  {
    id: 'objeto_hanako',
    kind: 'objeto',
    glbFile: 'dpwii_parcial2_marcadores_objeto.glb',
    label: 'Espejo de las Sombras',
    sublabel: 'Sensor de Luz / Cámara',
    floor: 2,
    position: [27.6, 0, -21.2],
    requiredPhase: 'ESTADO_4',
    challengeType: 'light_hanako',
  },

  // --- PASO 6: Sala de Profesores (2F Ala Izquierda) ---
  {
    id: 'personaje_profesor',
    kind: 'personaje',
    glbFile: 'dpwii_parcial2_marcadores_personaje.glb',
    label: 'El Profesor',
    sublabel: 'Sala de Profesores · Segundo Piso',
    floor: 2,
    position: [-27.2, 0, -20.8],
    portraitUrl: PORTRAITS.profesor,
  },
  {
    id: 'objeto_profesor',
    kind: 'objeto',
    glbFile: 'dpwii_parcial2_marcadores_objeto.glb',
    label: 'Compartimento Sellado',
    sublabel: 'Giroscopio / Nivelación',
    floor: 2,
    position: [-24.5, 0, -22.6],
    requiredPhase: 'ESTADO_5',
    challengeType: 'gyro_profesor',
  },
];

export const INITIAL_CLUES: ClueRecord[] = [
  {
    id: 'clue_1',
    stepNumber: 1,
    title: 'Reglas del Conserje',
    location: 'Armario de Limpieza (1° Piso · Izq.)',
    sensorUsed: 'Diálogo Inicial',
    summary:
      'El registro del Aula 404 desapareció. El Conserje autorizó revisar el viejo armario de madera junto a él.',
    unlocked: false,
  },
  {
    id: 'clue_2',
    stepNumber: 2,
    title: 'Nota Misteriosa del Armario',
    location: 'Armario de Limpieza (1° Piso · Izq.)',
    sensorUsed: 'Táctil + Vibración Háptica',
    summary:
      'Entre escobas hallaste una nota sellada: "Quien vio llevarse la placa descansa junto a las bicicletas del ala derecha: busca a Hotaru."',
    unlocked: false,
  },
  {
    id: 'clue_3',
    stepNumber: 3,
    title: 'Testimonio en el Patio Exterior',
    location: 'Aparcabicicletas (1° Piso · Der.)',
    sensorUsed: 'Acelerómetro / Agitación (Shake)',
    summary:
      'Al sacudir los remolinos de hojas, Hotaru recordó a Kaeru merodeando en el pasillo principal cerca del Aula 1B.',
    unlocked: false,
  },
  {
    id: 'clue_4',
    stepNumber: 4,
    title: 'El Eco hacia el Segundo Piso',
    location: 'Pasillo Aula 1B (1° Piso)',
    sensorUsed: 'Micrófono (Web Audio API)',
    summary:
      'Tu soplo hizo vibrar la campana espiritual. Kaeru reveló que Hanako aguarda en la penumbra de los Baños del Segundo Piso.',
    unlocked: false,
  },
  {
    id: 'clue_5',
    stepNumber: 5,
    title: 'La Llave de la Penumbra',
    location: 'Baños (2° Piso · Der.)',
    sensorUsed: 'Sensor de Luz / Cámara WebRTC',
    summary:
      'Al cubrir la luz, el espejo reveló la llave grabada y dónde aguarda el Profesor: en la Sala de Profesores (Segundo Piso, ala izquierda).',
    unlocked: false,
  },
  {
    id: 'clue_6',
    stepNumber: 6,
    title: 'Registro del Aula 404',
    location: 'Sala de Profesores (2° Piso · Izq.)',
    sensorUsed: 'Giroscopio / Inclinación Precisa',
    summary:
      'Nivelaste el compartimento sellado con precisión y recuperaste el pase oficial al Aula 404.',
    unlocked: false,
  },
];

export const PHASE_OBJECTIVES: Record<GamePhase, string> = {
  ESTADO_0: 'Paso 1/6 · Ve al Armario de Limpieza (1° Piso, ala izquierda) y habla con el Conserje.',
  ESTADO_1: 'Paso 2/6 · Inspecciona el Objeto del Armario de Limpieza junto al Conserje.',
  ESTADO_2: 'Paso 3/6 · Ve al Aparcabicicletas (1° Piso, ala derecha) y ayuda a Hotaru.',
  ESTADO_3: 'Paso 4/6 · Busca a Kaeru en el Pasillo frente al Aula 1B (1° Piso).',
  ESTADO_4: 'Paso 5/6 · Sube por las Escaleras al 2° Piso y busca a Hanako en los Baños (ala derecha).',
  ESTADO_5: 'Paso 6/6 · Ve a la Sala de Profesores (2° Piso, ala izquierda) y habla con el Profesor.',
  ESTADO_FINAL: 'Completado · Has recuperado el pase al Aula 404.',
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
        speakerRole: 'Compañera de Primer Año · Vestíbulo',
        portraitUrl: PORTRAITS.tsuki,
        lines:
          phase === 'ESTADO_0'
            ? [
                '¡Shhh! ¿Tú también eres nuevo y buscas el Aula 404? Miré todo el tablón del vestíbulo y esa aula fue arrancada del mapa.',
                'Los alumnos mayores dicen que el Conserje custodia los objetos perdidos en el Armario de Limpieza.',
                'Camina por el pasillo hacia la izquierda y cruza la puerta abierta al fondo del ala oeste.',
              ]
            : phase === 'ESTADO_FINAL'
            ? [
                '¡Increíble, encontraste el sello del Aula 404! Sabía que tenías el sexto sentido necesario para esta escuela.',
              ]
            : [
                `Sigue las pistas con calma. Revisa el mapa arriba si te pierdes entre el Primer y Segundo Piso.`,
              ],
      };
    }

    case 'objeto_vestibulo': {
      return {
        markerId,
        speakerName: 'Tablón Escolar',
        speakerRole: 'Registro de Aulas · Primer Piso',
        lines: [
          'Aulas del Primer Piso: 1A, 1B, 1C, 1D (Puertas cerradas durante la ceremonia).',
          'Al final de la hoja hay una marca rasgada donde decía "Aula 404 — Consultar en el Armario de Limpieza (Ala Izquierda) o en Sala de Profesores (2° Piso)".',
        ],
      };
    }

    case 'personaje_conserje': {
      if (phase === 'ESTADO_0') {
        return {
          markerId,
          speakerName: 'El Conserje',
          speakerRole: 'Guardián de Llaves y Pasillos',
          portraitUrl: PORTRAITS.conserje,
          lines: [
            '¿Otro estudiante perdido en su primer día buscando el Aula 404? Je... esta escuela no entrega sus secretos a quien solo camina mirando el suelo.',
            'Escucha bien la regla: cada rincón guarda un rastro que solo responde a tus sentidos — el tacto, el movimiento, el aliento, la sombra y el equilibrio.',
            'Anoche alguien escondió una nota sobre el objeto perdido dentro de ese Armario de Limpieza a mi derecha. Acércate al marcador del armario e inspecciónalo.',
          ],
          advanceToPhase: 'ESTADO_1',
        };
      }
      if (phase === 'ESTADO_1') {
        return {
          markerId,
          speakerName: 'El Conserje',
          speakerRole: 'Guardián de Llaves y Pasillos',
          portraitUrl: PORTRAITS.conserje,
          lines: [
            'No te quedes mirándonos... Acércate al marcador rojo del Armario de Limpieza aquí mismo y revísalo con cuidado.',
          ],
        };
      }
      return {
        markerId,
        speakerName: 'El Conserje',
        speakerRole: 'Guardián de Llaves y Pasillos',
        portraitUrl: PORTRAITS.conserje,
        lines: [
          '¿Encontraste la nota de Hotaru? El Aparcabicicletas está en el extremo opuesto del Primer Piso, cruzando todo el pasillo hacia el ala derecha.',
        ],
      };
    }

    case 'objeto_armario': {
      if (phase !== 'ESTADO_1') {
        return {
          markerId,
          speakerName: 'Armario de Limpieza',
          speakerRole: 'Objeto en el Escenario',
          lines:
            phase === 'ESTADO_0'
              ? ['El armario está cerrado con pestillo. Deberías hablar primero con el Conserje que está justo al lado.']
              : ['Ya inspeccionaste el armario y recuperaste la nota que apunta hacia Hotaru en el Aparcabicicletas.'],
        };
      }
      return null; // Handled directly by touch_closet challenge modal!
    }

    case 'personaje_hotaru': {
      if (phase === 'ESTADO_0' || phase === 'ESTADO_1') {
        return {
          markerId,
          speakerName: 'Hotaru',
          speakerRole: 'Estudiante del Patio Exterior',
          portraitUrl: PORTRAITS.hotaru,
          lines: [
            'Las sombras están demasiado inquietas hoy... Aún no sé si puedo confiar en ti. Ve primero al Armario de Limpieza en el ala izquierda.',
          ],
        };
      }
      if (phase === 'ESTADO_2') {
        return {
          markerId,
          speakerName: 'Hotaru',
          speakerRole: 'Estudiante del Patio Exterior',
          portraitUrl: PORTRAITS.hotaru,
          lines: [
            '¿Traes la nota del armario? Entonces tú también buscas el objeto perdido del Aula 404...',
            'Mira las bicicletas del cobertizo: un remolino de hojas pesadas y sellos bloquea el paso exterior.',
            'Ayúdame a despejar el área sacudiendo tu dispositivo con fuerza junto a las bicicletas, y te diré a quién vi correr hacia los pasillos.',
          ],
          unlocksNpcTalkFlag: 'hotaru',
          openChallenge: 'shake_bikes',
        };
      }
      return {
        markerId,
        speakerName: 'Hotaru',
        speakerRole: 'Estudiante del Patio Exterior',
        portraitUrl: PORTRAITS.hotaru,
        lines: [
          'Gracias por despejar el cobertizo. Busca a Kaeru en el pasillo principal del Primer Piso, justo frente al Aula 1B.',
        ],
      };
    }

    case 'objeto_hotaru': {
      if (phase !== 'ESTADO_2') {
        return {
          markerId,
          speakerName: 'Aparcabicicletas',
          speakerRole: 'Zona Exterior',
          lines:
            phase === 'ESTADO_0' || phase === 'ESTADO_1'
              ? ['Varias bicicletas escolares cubiertas de hojas secas. Todavía no sabes qué buscas aquí.']
              : ['Las bicicletas ya están despejadas. Kaeru te espera cerca del Aula 1B.'],
        };
      }
      if (!spokenFlags.hotaru) {
        return {
          markerId,
          speakerName: 'Aparcabicicletas',
          speakerRole: 'Zona Exterior',
          lines: ['Hotaru está justo a unos pasos observando las bicicletas. Habla con él primero.'],
        };
      }
      return null; // Opens shake_bikes sensor modal
    }

    case 'personaje_kaeru': {
      if (phase === 'ESTADO_0' || phase === 'ESTADO_1' || phase === 'ESTADO_2') {
        return {
          markerId,
          speakerName: 'Kaeru',
          speakerRole: 'Vigía del Pasillo 1B',
          portraitUrl: PORTRAITS.kaeru,
          lines: [
            'El pasillo guarda silencio para quienes no traen pruebas... Resuelve primero el encargo de Hotaru en el Aparcabicicletas.',
          ],
        };
      }
      if (phase === 'ESTADO_3') {
        return {
          markerId,
          speakerName: 'Kaeru',
          speakerRole: 'Vigía del Pasillo 1B',
          portraitUrl: PORTRAITS.kaeru,
          lines: [
            'Así que Hotaru te envió... Sí, escuché pasos subir hacia la planta alta llevando el cofre del Aula 404.',
            'Pero las paredes de madera solo devuelven el eco a quien sabe hacerse oír.',
            'Sopla o emite un sonido claro frente al micrófono para hacer resonar la campana del pasillo y escuchar el susurro.',
          ],
          unlocksNpcTalkFlag: 'kaeru',
          openChallenge: 'mic_whisper',
        };
      }
      return {
        markerId,
        speakerName: 'Kaeru',
        speakerRole: 'Vigía del Pasillo 1B',
        portraitUrl: PORTRAITS.kaeru,
        lines: [
          'El susurro fue claro: usa cualquiera de las Escaleras amarillas para subir al Segundo Piso y ve a los Baños del ala derecha para hablar con Hanako.',
        ],
      };
    }

    case 'objeto_kaeru': {
      if (phase !== 'ESTADO_3') {
        return {
          markerId,
          speakerName: 'Campana del Susurro',
          speakerRole: 'Objeto Acústico · Aula 1B',
          lines:
            phase === 'ESTADO_4' || phase === 'ESTADO_5' || phase === 'ESTADO_FINAL'
              ? ['La campana sigue vibrando suavemente señalando hacia las escaleras del Segundo Piso.']
              : ['Una antigua campana de viento cuelga junto al Aula 1B.'],
        };
      }
      if (!spokenFlags.kaeru) {
        return {
          markerId,
          speakerName: 'Campana del Susurro',
          speakerRole: 'Objeto Acústico · Aula 1B',
          lines: ['Kaeru custodia este tramo del pasillo junto al Aula 1B. Habla con él primero.'],
        };
      }
      return null; // Opens mic_whisper modal
    }

    case 'personaje_hanako': {
      if (phase !== 'ESTADO_4' && phase !== 'ESTADO_5' && phase !== 'ESTADO_FINAL') {
        return {
          markerId,
          speakerName: 'Hanako',
          speakerRole: 'Espíritu de los Baños · 2° Piso',
          portraitUrl: PORTRAITS.hanako,
          lines: [
            'Jijiji... ¿Subiste tan pronto sin escuchar el susurro de Kaeru en el Primer Piso? Regresa abajo primero.',
          ],
        };
      }
      if (phase === 'ESTADO_4') {
        return {
          markerId,
          speakerName: 'Hanako',
          speakerRole: 'Espíritu de los Baños · 2° Piso',
          portraitUrl: PORTRAITS.hanako,
          lines: [
            'Bienvenido a los baños del Segundo Piso... Sé exactamente dónde ocultaron la llave y el registro del Aula 404.',
            'Pero este resplandor de las ventanas me ciega; mi reflejo solo puede escribir el secreto cuando reina la penumbra.',
            'Cubre la cámara o la pantalla de tu celular, o busca un rincón oscuro para apagar la luz del espejo.',
          ],
          unlocksNpcTalkFlag: 'hanako',
          openChallenge: 'light_hanako',
        };
      }
      return {
        markerId,
        speakerName: 'Hanako',
        speakerRole: 'Espíritu de los Baños · 2° Piso',
        portraitUrl: PORTRAITS.hanako,
        lines: [
          'Ya tienes mi llave espiritual. Cruza todo el Segundo Piso hasta la Sala de Profesores en el ala izquierda.',
        ],
      };
    }

    case 'objeto_hanako': {
      if (phase !== 'ESTADO_4') {
        return {
          markerId,
          speakerName: 'Espejo de los Baños',
          speakerRole: 'Objeto Sensible a la Luz · 2° Piso',
          lines:
            phase === 'ESTADO_5' || phase === 'ESTADO_FINAL'
              ? ['En el vaho del espejo aún se lee: "Sala de Profesores — Segundo Piso, Ala Izquierda".']
              : ['Un espejo antiguo empañado frente a los lavabos.'],
        };
      }
      if (!spokenFlags.hanako) {
        return {
          markerId,
          speakerName: 'Espejo de los Baños',
          speakerRole: 'Objeto Sensible a la Luz · 2° Piso',
          lines: ['Hanako te observa junto a la entrada de los baños. Habla con ella antes de tocar el espejo.'],
        };
      }
      return null; // Opens light_hanako modal
    }

    case 'personaje_profesor': {
      if (phase !== 'ESTADO_5' && phase !== 'ESTADO_FINAL') {
        return {
          markerId,
          speakerName: 'El Profesor',
          speakerRole: 'Sala de Profesores · 2° Piso',
          portraitUrl: PORTRAITS.profesor,
          lines: [
            '¿Buscas tu asignación de aula sin haber reunido todas las pistas de la escuela? Vuelve cuando tengas la llave de Hanako.',
          ],
        };
      }
      if (phase === 'ESTADO_5') {
        return {
          markerId,
          speakerName: 'El Profesor',
          speakerRole: 'Docente Titular · Sala de Profesores',
          portraitUrl: PORTRAITS.profesor,
          lines: [
            'Has recorrido cada pasillo, escuchado susurros y atravesado la penumbra. Veo que traes la llave de Hanako.',
            'El registro maestro del Aula 404 descansa dentro del Compartimento Sellado sobre el escritorio central.',
            'Su mecanismo interno es un astrolabio de equilibrio: inclina tu celular con precisión usando el giroscopio hasta nivelar el sello y abrirlo.',
          ],
          unlocksNpcTalkFlag: 'profesor',
          openChallenge: 'gyro_profesor',
        };
      }
      return {
        markerId,
        speakerName: 'El Profesor',
        speakerRole: 'Docente Titular · Sala de Profesores',
        portraitUrl: PORTRAITS.profesor,
        lines: [
          'Excelente trabajo. El compartimento está abierto y el emblema del Aula 404 te pertenece. ¡Bienvenido a tu primer día de clases!',
        ],
      };
    }

    case 'objeto_profesor': {
      if (phase !== 'ESTADO_5') {
        return {
          markerId,
          speakerName: 'Compartimento Sellado',
          speakerRole: 'Resolución Final · Sala de Profesores',
          lines:
            phase === 'ESTADO_FINAL'
              ? ['El compartimento de madera lacada permanece abierto tras recuperar el pase del Aula 404.']
              : ['Una caja lacada con nivel de equilibrio. Está bloqueada hasta reunir las cinco pistas previas.'],
        };
      }
      if (!spokenFlags.profesor) {
        return {
          markerId,
          speakerName: 'Compartimento Sellado',
          speakerRole: 'Resolución Final · Sala de Profesores',
          lines: ['El Profesor aguarda junto al escritorio. Habla con él antes de manipular el compartimento.'],
        };
      }
      return null; // Opens gyro_profesor modal
    }

    default:
      return null;
  }
}
