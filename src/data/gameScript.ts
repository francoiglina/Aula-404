import portraitConserje from '../assets/images/portrait_conserje_1793021094931.jpg';
import portraitHotaru from '../assets/images/portrait_hotaru_1793021098131.jpg';
import portraitKaeru from '../assets/images/portrait_kaeru_1793021099722.jpg';
import portraitHanako from '../assets/images/portrait_hanako_1793021101433.jpg';
import portraitProfesor from '../assets/images/portrait_profesor_1793021101407.jpg';
import { ClueRecord, EntityId, GamePhase, InteractableEntityDef } from '../types';

export const CLUE_DATABASE: ClueRecord[] = [
  {
    step: 1,
    id: 'pista_conserje',
    title: 'Reglas del Instituto y Registro Perdido',
    source: 'El Conserje',
    location: 'Armario de limpieza · Primer Piso (Ala izquierda)',
    summary:
      'El acta de asignación del Aula 404 desapareció esta mañana. El Conserje autorizó revisar el armario metálico de limpieza junto a él.',
    unlockedAtPhase: GamePhase.ESTADO_1,
  },
  {
    step: 2,
    id: 'pista_armario',
    title: 'Nota Misteriosa del Armario',
    source: 'Armario de limpieza (Objeto 3D)',
    location: 'Armario de limpieza · Primer Piso (Ala izquierda)',
    summary:
      'Una nota doblada entre los utensilios dice: «Hotaru vio quién se llevó el pase del Aula 404. Búscala afuera, en el Aparcabicicletas del ala derecha».',
    unlockedAtPhase: GamePhase.ESTADO_2,
  },
  {
    step: 3,
    id: 'pista_hotaru',
    title: 'Testigo cerca del Aula 1B',
    source: 'Hotaru (Sensor de Agitación)',
    location: 'Aparcabicicletas · Primer Piso (Ala derecha)',
    summary:
      'Tras ayudar a despejar las hojas secas del patio, Hotaru recordó haber visto a Kaeru escuchando ecos extraños en el pasillo frente al Aula 1B.',
    unlockedAtPhase: GamePhase.ESTADO_3,
  },
  {
    step: 4,
    id: 'pista_kaeru',
    title: 'Susurro hacia la Zona Oscura',
    source: 'Kaeru (Sensor de Micrófono)',
    location: 'Cercanía a Aula 1B · Primer Piso',
    summary:
      'Al activar la resonancia acústica del pasillo, Kaeru reveló que Hanako aguarda en los Baños del Segundo Piso (ala derecha). Usa las escaleras para subir.',
    unlockedAtPhase: GamePhase.ESTADO_4,
  },
  {
    step: 5,
    id: 'pista_hanako',
    title: 'Llave de Penumbra y el Profesor',
    source: 'Hanako (Sensor de Luz / Cámara)',
    location: 'Baños · Segundo Piso (Ala derecha)',
    summary:
      'En la penumbra de los baños, Hanako entregó la llave de latón y señaló el destino final: el Profesor resguarda el compartimento en la Sala de Profesores (Segundo Piso, ala izquierda).',
    unlockedAtPhase: GamePhase.ESTADO_5,
  },
  {
    step: 6,
    id: 'pista_profesor',
    title: 'Emblema del Aula 404 Recuperado',
    source: 'Profesor (Sensor de Giroscopio)',
    location: 'Sala de Profesores · Segundo Piso (Ala izquierda)',
    summary:
      'Nivelaste el cofre de madera con precisión giroscópica y recuperaste tu credencial oficial. La puerta corrediza del Aula 404 en el Segundo Piso se ha abierto.',
    unlockedAtPhase: GamePhase.ESTADO_FINAL,
  },
];

export const PHASE_OBJECTIVES: Record<GamePhase, { stepLabel: string; hint: string; targetFloor: 1 | 2 }> = {
  [GamePhase.ESTADO_0]: {
    stepLabel: 'Paso 1 de 6 · El Conserje',
    hint: 'Dirígete al Armario de limpieza (Primer Piso, ala izquierda) y habla con el Conserje.',
    targetFloor: 1,
  },
  [GamePhase.ESTADO_1]: {
    stepLabel: 'Paso 2 de 6 · Armario de Limpieza',
    hint: 'Inspecciona el objeto Armario de limpieza justo al lado del Conserje.',
    targetFloor: 1,
  },
  [GamePhase.ESTADO_2]: {
    stepLabel: 'Paso 3 de 6 · Hotaru',
    hint: 'Sal al Aparcabicicletas en el patio exterior (Primer Piso, ala derecha) y habla con Hotaru.',
    targetFloor: 1,
  },
  [GamePhase.ESTADO_3]: {
    stepLabel: 'Paso 4 de 6 · Kaeru',
    hint: 'Vuelve al pasillo interior cerca del Aula 1B (Primer Piso) y conversa con Kaeru.',
    targetFloor: 1,
  },
  [GamePhase.ESTADO_4]: {
    stepLabel: 'Paso 5 de 6 · Hanako',
    hint: 'Sube por las Escaleras al Segundo Piso y busca a Hanako en los Baños (ala derecha).',
    targetFloor: 2,
  },
  [GamePhase.ESTADO_5]: {
    stepLabel: 'Paso 6 de 6 · El Profesor',
    hint: 'Cruza el Segundo Piso hacia la Sala de Profesores (ala izquierda) y habla con el Profesor.',
    targetFloor: 2,
  },
  [GamePhase.ESTADO_FINAL]: {
    stepLabel: 'Objetivo Completado · Aula 404',
    hint: 'Has recuperado el objeto resguardado. Puedes visitar el Aula 404 abierta en el Segundo Piso.',
    targetFloor: 2,
  },
};

export const INTERACTABLE_ENTITIES: Record<EntityId, InteractableEntityDef> = {
  personaje_conserje: {
    id: 'personaje_conserje',
    markerType: 'personaje',
    glbFile: '/dpwii_parcial2_marcadores_personaje.glb',
    name: 'Sr. Takeda · Conserje',
    roleOrSubtitle: 'Encargado de mantenimiento escolar',
    locationLabel: 'Armario de limpieza (1.er Piso · Ala izquierda)',
    floor: 1,
    position: [-13.4, 0, -4.4],
    interactRadius: 2.7,
    requiredPhase: GamePhase.ESTADO_0,
    portraitUrl: portraitConserje,
    accentColor: '#f59e0b',
    challengeType: 'none',
    questDialogue: [
      'Bienvenido a tu primer día en la preparatoria. ¿Dices que en tu horario figura el «Aula 404» y no aparece en ningún cartel del pasillo?',
      'En este edificio antiguo cada salón especial exige seguir las normas de observación. Esta mañana alguien dejó olvidado el pase de acceso y una pista clave por aquí.',
      'Revisa tú mismo el armario de limpieza que está aquí a mi derecha. Toca el marcador de objeto para abrirlo e inspeccionar su interior.',
    ],
    afterQuestDialogue: [
      'Revisa bien el interior del armario de limpieza aquí al lado; seguro dejaron alguna nota entre los estantes.',
    ],
    targetPhaseOnComplete: GamePhase.ESTADO_1,
  },

  objeto_armario: {
    id: 'objeto_armario',
    markerType: 'objeto',
    glbFile: '/dpwii_parcial2_marcadores_objeto.glb',
    name: 'Armario de Limpieza',
    roleOrSubtitle: 'Objeto interactivo 3D',
    locationLabel: 'Armario de limpieza (1.er Piso · Ala izquierda)',
    floor: 1,
    position: [-11.3, 0, -4.8],
    interactRadius: 2.6,
    requiredPhase: GamePhase.ESTADO_1,
    accentColor: '#10b981',
    challengeType: 'armario_touch',
    preQuestDialogue: [
      'Es un armario metálico de suministros cerrado con pestillo. Deberías hablar primero con el Conserje antes de registrar sus cosas.',
    ],
    questDialogue: [
      'La puerta metálica del armario de limpieza está entreabierta. En el estante central brilla un sobre doblado entre cubetas y llaves.',
    ],
    challengeInstruction:
      'Toca las puertas del armario 3D para abrirlo y pulsa sobre la nota misteriosa para recogerla.',
    postSuccessDialogue: [
      'Has encontrado una nota manuscrita: «Si buscas el registro del Aula 404, ve al patio del ala derecha. Hotaru está en el Aparcabicicletas tratando de despejar el viento de otoño».',
    ],
    afterQuestDialogue: [
      'Ya recogiste la nota misteriosa del armario. Hotaru te espera en el Aparcabicicletas del ala derecha.',
    ],
    targetPhaseOnComplete: GamePhase.ESTADO_2,
  },

  personaje_hotaru: {
    id: 'personaje_hotaru',
    markerType: 'personaje',
    glbFile: '/dpwii_parcial2_marcadores_personaje.glb',
    name: 'Hotaru',
    roleOrSubtitle: 'Delegada del patio exterior',
    locationLabel: 'Aparcabicicletas (1.er Piso · Ala derecha)',
    floor: 1,
    position: [15.4, 0, -1.6],
    interactRadius: 2.8,
    requiredPhase: GamePhase.ESTADO_2,
    portraitUrl: portraitHotaru,
    accentColor: '#f97316',
    challengeType: 'hotaru_shake',
    preQuestDialogue: [
      '¡Hola! Qué montón de hojas de ginkgo cayeron hoy sobre las bicicletas... Primero deberías reportarte en el ala izquierda con el Conserje.',
    ],
    questDialogue: [
      '¡Ah, vienes por la nota del armario! Sí, vi quién llevaba el expediente del Aula 404 hace unos minutos.',
      'Pero antes necesito tu ayuda urgente: una ráfaga llenó de hojas secas y ramas todo el techo del aparcabicicletas.',
      'Sacude tu teléfono con energía para agitar las ramas y despejar el área exterior.',
    ],
    challengeInstruction:
      'Agita físicamente tu celular (sensor acelerómetro) hasta completar el 100 % y despejar las hojas del aparcabicicletas.',
    postSuccessDialogue: [
      '¡Increíble, el aparcabicicletas quedó impecable! Muchas gracias por ayudarme.',
      'Escucha bien: el chico que sabe cómo escuchar los pasillos se llama Kaeru. Está adentro, en el pasillo principal justo frente al Aula 1B.',
    ],
    afterQuestDialogue: [
      'Busca a Kaeru en el pasillo del Primer Piso, muy cerca de la puerta del Aula 1B.',
    ],
    targetPhaseOnComplete: GamePhase.ESTADO_3,
  },

  personaje_kaeru: {
    id: 'personaje_kaeru',
    markerType: 'personaje',
    glbFile: '/dpwii_parcial2_marcadores_personaje.glb',
    name: 'Kaeru',
    roleOrSubtitle: 'Club de Acústica · 1.er Año',
    locationLabel: 'Pasillo junto a Aula 1B (1.er Piso)',
    floor: 1,
    position: [2.5, 0, -1.15],
    interactRadius: 2.6,
    requiredPhase: GamePhase.ESTADO_3,
    portraitUrl: portraitKaeru,
    accentColor: '#14b8a6',
    challengeType: 'kaeru_mic',
    preQuestDialogue: [
      'Shh... Estoy midiendo la reverberación de la madera frente al Aula 1B. Aún no tienes la pista para entender este sonido.',
    ],
    questDialogue: [
      'Así que Hotaru te envió conmigo. Los muros de madera de esta escuela guardan ecos que solo responden al aire y la voz.',
      'Te reto a despertar el carillón acústico del pasillo: sopla suavemente o emite un sonido claro frente al micrófono de tu dispositivo.',
    ],
    challengeInstruction:
      'Sopla o emite un sonido continuo frente al micrófono para hacer vibrar el cristal acústico en 3D hasta alcanzar la resonancia.',
    postSuccessDialogue: [
      '¿Oíste esa armónica? El eco viene desde arriba... desde la zona más sombría del Segundo Piso.',
      'Sube por las escaleras y entra a los Baños del ala derecha. Allí está Hanako; ella custodia la llave hacia el último secreto.',
    ],
    afterQuestDialogue: [
      'Usa el marcador azul de las escaleras para subir al Segundo Piso. Hanako está en los Baños del ala derecha.',
    ],
    targetPhaseOnComplete: GamePhase.ESTADO_4,
  },

  personaje_hanako: {
    id: 'personaje_hanako',
    markerType: 'personaje',
    glbFile: '/dpwii_parcial2_marcadores_personaje.glb',
    name: 'Hanako',
    roleOrSubtitle: 'Guardiana de la penumbra',
    locationLabel: 'Baños (2.º Piso · Ala derecha)',
    floor: 2,
    position: [13.2, 0, -4.8],
    interactRadius: 2.7,
    requiredPhase: GamePhase.ESTADO_4,
    portraitUrl: portraitHanako,
    accentColor: '#60a5fa',
    challengeType: 'hanako_light',
    preQuestDialogue: [
      'Todavía hay demasiado ruido allá abajo... Vuelve cuando el eco del Primer Piso te guíe hasta mí.',
    ],
    questDialogue: [
      'Has llegado hasta el rincón más silencioso del Segundo Piso...',
      'Tengo la llave que abre el registro del Aula 404, pero el resplandor de las ventanas me impide mostrarla.',
      'Cubre la cámara o la parte superior de tu teléfono con la mano —o busca un entorno oscuro— para que la penumbra revele el sello.',
    ],
    challengeInstruction:
      'Cubre el sensor/cámara de tu móvil o reduce la iluminación ambiental por debajo del umbral de oscuridad para revelar la llave.',
    postSuccessDialogue: [
      'En la oscuridad todo se vuelve nítido... Toma esta llave de latón antiguo.',
      'El objeto resguardado que confirma tu ingreso al Aula 404 lo tiene el Profesor en la Sala de Profesores, al otro extremo de este Segundo Piso, en el ala izquierda.',
    ],
    afterQuestDialogue: [
      'Ve a la Sala de Profesores en el ala izquierda del Segundo Piso y entrégale la llave al Profesor.',
    ],
    targetPhaseOnComplete: GamePhase.ESTADO_5,
  },

  personaje_profesor: {
    id: 'personaje_profesor',
    markerType: 'personaje',
    glbFile: '/dpwii_parcial2_marcadores_personaje.glb',
    name: 'Profesor Sato',
    roleOrSubtitle: 'Tutor de Aula 404 · Sala de Profesores',
    locationLabel: 'Sala de Profesores (2.º Piso · Ala izquierda)',
    floor: 2,
    position: [-13.0, 0, -4.9],
    interactRadius: 2.8,
    requiredPhase: GamePhase.ESTADO_5,
    portraitUrl: portraitProfesor,
    accentColor: '#eab308',
    challengeType: 'profesor_gyro',
    preQuestDialogue: [
      'Bienvenido a la Sala de Profesores. Aún te faltan pistas por reunir en la escuela antes de abrir el estuche de registro.',
    ],
    questDialogue: [
      'Veo que traes la llave de latón y seguiste cada pista con paciencia. Bien hecho.',
      'Sobre mi escritorio descansa el estuche de equilibrio donde se resguarda la insignia oficial del Aula 404.',
      'Inclina tu celular con pulso firme usando el giroscopio hasta alinear el nivel en el ángulo exacto y destrabar el compartimento final.',
    ],
    challengeInstruction:
      'Inclina suavemente tu dispositivo (giroscopio pitch y roll) para mantener la esfera dentro del círculo central durante 1.5 segundos.',
    postSuccessDialogue: [
      '¡Clic perfecto! El compartimento de cedro se ha abierto y has recuperado la Insignia del Aula 404.',
      'La puerta corrediza del Aula 404 aquí mismo en el pasillo del Segundo Piso acaba de desbloquearse. ¡Bienvenido oficialmente a clases!',
    ],
    afterQuestDialogue: [
      '¡Felicitaciones! Ya eres alumno oficial del Aula 404. Puedes entrar al salón en el pasillo central de este Segundo Piso.',
    ],
    targetPhaseOnComplete: GamePhase.ESTADO_FINAL,
  },

  escalera_piso1: {
    id: 'escalera_piso1',
    markerType: 'escalera',
    glbFile: '/dpwii_parcial2_marcadores_escalera.glb',
    name: 'Escaleras al Segundo Piso',
    roleOrSubtitle: 'Subir · 1.er Piso → 2.º Piso',
    locationLabel: 'Tramo de escaleras principal (1.er Piso)',
    floor: 1,
    position: [8.8, 0, -2.5],
    interactRadius: 2.5,
    accentColor: '#38bdf8',
    challengeType: 'none',
    questDialogue: [],
  },

  escalera_piso2: {
    id: 'escalera_piso2',
    markerType: 'escalera',
    glbFile: '/dpwii_parcial2_marcadores_escalera.glb',
    name: 'Escaleras al Primer Piso',
    roleOrSubtitle: 'Bajar · 2.º Piso → 1.er Piso',
    locationLabel: 'Rellano de escaleras (2.º Piso)',
    floor: 2,
    position: [8.8, 0, -2.5],
    interactRadius: 2.5,
    accentColor: '#38bdf8',
    challengeType: 'none',
    questDialogue: [],
  },

  puerta_aula404: {
    id: 'puerta_aula404',
    markerType: 'objeto',
    glbFile: '/dpwii_parcial2_marcadores_objeto.glb',
    name: 'Placa del Aula 404',
    roleOrSubtitle: 'Salón Especial · Segundo Piso',
    locationLabel: 'Pasillo central (2.º Piso)',
    floor: 2,
    position: [-5.8, 0, -1.5],
    interactRadius: 2.3,
    accentColor: '#f59e0b',
    challengeType: 'none',
    preQuestDialogue: [
      'La puerta corrediza lleva una placa grabada: «AULA 404». Está cerrada con un mecanismo magnético; primero debes reunir todas las pistas y hablar con el Profesor.',
    ],
    questDialogue: [
      'La puerta del Aula 404 está abierta de par en par bañada por la luz dorada de la tarde. Tus compañeros y tu pupitre te esperan adentro.',
    ],
  },
};
