import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Volume2, VolumeX } from 'lucide-react';
import { ClueTickerHud } from './components/ClueTickerHud';
import { DialogueOverlay } from './components/DialogueOverlay';
import { EndingModal } from './components/EndingModal';
import { LocationNotice } from './components/LocationNotice';
import { MinimapHud } from './components/MinimapHud';
import { MobileControlsOverlay } from './components/MobileControlsOverlay';
import { NewClueBanner } from './components/NewClueBanner';
import { SchoolMapModal, SchoolModalTab } from './components/SchoolMapModal';
import { SensorChallengeModal } from './components/SensorChallengeModal';
import { IntroLoreScreen } from './components/IntroLoreScreen';
import { TitleScreen } from './components/TitleScreen';
import {
  getPhaseIndicator,
  INITIAL_CLUES,
  POST_CHALLENGE_DIALOGUES,
  resolveMarkerDialogue,
} from './data/gameContent';
import { resolveAllowedFloorNotice } from './data/locationZones';
import { sensorService } from './services/sensorService';
import { soundEngine } from './services/soundEngine';
import { ejecutarTransicionEscalera } from './services/stairTransitionController';
import { SchoolEngine } from './three/SchoolEngine';
import {
  ClueRecord,
  DialoguePayload,
  FinalSubstate,
  FloorNumber,
  GamePhase,
  SensorChallengeType,
  SensorInteractionData,
  WorldMarker,
} from './types';

export default function App() {
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SchoolEngine | null>(null);

  const [entryStage, setEntryStage] = useState<'title' | 'intro' | 'black_hold' | 'ready'>('title');
  const [isInitialized, setIsInitialized] = useState(false);
  const [phase, setPhase] = useState<GamePhase>('ESTADO_0');
  const [finalSubstate, setFinalSubstate] = useState<FinalSubstate>('pendiente');
  const [currentFloor, setCurrentFloor] = useState<FloorNumber>(1);
  const [, setZoneName] = useState('Entrada Genkan (1° Piso)');
  const [nearbyMarker, setNearbyMarker] = useState<WorldMarker | null>(null);
  const [spokenFlags, setSpokenFlags] = useState<Record<string, boolean>>({});
  const [unlockedObjects, setUnlockedObjects] = useState<Record<string, boolean>>({});
  const [clues, setClues] = useState<ClueRecord[]>(INITIAL_CLUES);

  // Overlays & Modals
  const [activeDialogue, setActiveDialogue] = useState<DialoguePayload | null>(null);
  const [activeChallenge, setActiveChallenge] = useState<SensorChallengeType | null>(null);
  const [mapModalTab, setMapModalTab] = useState<SchoolModalTab | null>(null);
  const [showEndingModal, setShowEndingModal] = useState(false);

  // Estado de transición cinemática whip-pan en escaleras
  const [isStairTransitioning, setIsStairTransitioning] = useState(false);

  // Controls & Sensors UI state
  const [isMuted, setIsMuted] = useState(false);
  const [playerCoords, setPlayerCoords] = useState<{
    x: number;
    z: number;
    yaw: number;
    floor: FloorNumber;
  }>({ x: -1.5, z: 6.0, yaw: 0, floor: 1 });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [clueBanner, setClueBanner] = useState<{ id: number; text: string } | null>(null);
  const [locationNotice, setLocationNotice] = useState<{
    id: number;
    floor: FloorNumber;
    floorTitle: string;
  } | null>(null);

  // Mutable refs so Three.js callbacks never read stale React state
  const isInitializedRef = useRef(isInitialized);
  const lastNotifiedFloorRef = useRef<FloorNumber | null>(null);
  const locationNoticeTimerRef = useRef<number | null>(null);
  const phaseRef = useRef<GamePhase>(phase);
  const finalSubstateRef = useRef<FinalSubstate>(finalSubstate);
  const spokenFlagsRef = useRef<Record<string, boolean>>(spokenFlags);
  const unlockedObjectsRef = useRef<Record<string, boolean>>(unlockedObjects);
  const isBusyOverlayRef = useRef(false);

  useEffect(() => {
    isInitializedRef.current = isInitialized;
  }, [isInitialized]);

  useEffect(() => {
    phaseRef.current = phase;
    engineRef.current?.setGamePhase(phase);
  }, [phase]);

  useEffect(() => {
    finalSubstateRef.current = finalSubstate;
    engineRef.current?.setFinalSubstate(finalSubstate);
  }, [finalSubstate]);

  useEffect(() => {
    spokenFlagsRef.current = spokenFlags;
  }, [spokenFlags]);

  useEffect(() => {
    unlockedObjectsRef.current = unlockedObjects;
    const enabledIds = Object.keys(unlockedObjects).filter((id) => unlockedObjects[id]);
    engineRef.current?.setUnlockedObjects(enabledIds);
  }, [unlockedObjects]);

  useEffect(() => {
    isBusyOverlayRef.current = Boolean(
      !isInitialized ||
        activeDialogue ||
        activeChallenge ||
        mapModalTab ||
        showEndingModal ||
        isStairTransitioning
    );
    engineRef.current?.setMovementLocked(isBusyOverlayRef.current);
    engineRef.current?.setExternalPause(mapModalTab === 'markers');
  }, [
    isInitialized,
    activeDialogue,
    activeChallenge,
    mapModalTab,
    showEndingModal,
    isStairTransitioning,
  ]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 3600);
    return () => clearTimeout(t);
  }, [toastMessage]);

  useEffect(() => {
    if (!clueBanner) return;
    const t = window.setTimeout(() => setClueBanner(null), 3650);
    return () => clearTimeout(t);
  }, [clueBanner]);

  const unlockClueByStep = useCallback((stepNumber: number) => {
    setClues((prev) =>
      prev.map((c) => (c.stepNumber === stepNumber ? { ...c, unlocked: true } : c))
    );
  }, []);

  /**
   * Dispara la notificación central de 3 niveles únicamente al entrar o cambiar entre Piso 1 y Piso 2.
   * Ignora cualquier habitación individual, aula o pasillo secundario y evita repetir en el mismo piso.
   */
  const showLocationNotice = useCallback((zoneOrFloor: FloorNumber | string) => {
    const resolved = resolveAllowedFloorNotice(zoneOrFloor);
    if (!resolved) return;

    if (lastNotifiedFloorRef.current === resolved.floor) return;
    lastNotifiedFloorRef.current = resolved.floor;

    if (locationNoticeTimerRef.current !== null) {
      clearTimeout(locationNoticeTimerRef.current);
    }

    const noticeId = Date.now();
    setLocationNotice({
      id: noticeId,
      floor: resolved.floor,
      floorTitle: resolved.floorTitle,
    });

    locationNoticeTimerRef.current = window.setTimeout(() => {
      setLocationNotice((prev) => (prev?.id === noticeId ? null : prev));
      locationNoticeTimerRef.current = null;
    }, 3320);
  }, []);

  useEffect(() => {
    return () => {
      if (locationNoticeTimerRef.current !== null) {
        clearTimeout(locationNoticeTimerRef.current);
      }
    };
  }, []);

  const triggerStairTransition = useCallback(
    (marker: WorldMarker) => {
      if (!marker.targetFloor || !marker.spawnAfterStairs) return;
      const nextFloor = marker.targetFloor;
      const spawn = marker.spawnAfterStairs;
      const yaw = marker.spawnYaw ?? 0;
      const direccion = nextFloor === 2 ? 'subir' : 'bajar';

      setIsStairTransitioning(true);
      soundEngine.playStairsTransition();
      soundEngine.fadeOutBgm(0.35, { targetVolume: 0.24 });

      void ejecutarTransicionEscalera(direccion, () => {
        // Cambio de piso y reposicionamiento de cámara 3D ejecutado con pantalla 100% en negro
        engineRef.current?.setFloor(nextFloor, spawn, yaw, { silentFloorNotice: true });
        setCurrentFloor(nextFloor);
        setPlayerCoords({ x: spawn[0], z: spawn[2], yaw, floor: nextFloor });
      }).finally(() => {
        setIsStairTransitioning(false);
        soundEngine.fadeInBgm(0.7);
        showLocationNotice(nextFloor);
      });
    },
    [showLocationNotice]
  );

  const interactWithMarker = useCallback(
    (marker: WorldMarker) => {
      if (isBusyOverlayRef.current) return;

      // 1. Staircase transition marker
      if (marker.kind === 'escalera') {
        triggerStairTransition(marker);
        return;
      }

      const curPhase = phaseRef.current;
      const curFinalSub = finalSubstateRef.current;
      const curFlags = spokenFlagsRef.current;
      const curUnlocked = unlockedObjectsRef.current;

      // 2A. ESTADO_FINAL - Paso A: Interactuar con el marcador (.glb) frente a la puerta del aula destino
      if (
        marker.id === 'objeto_puerta_destino' &&
        curPhase === 'ESTADO_FINAL' &&
        curFinalSub === 'pendiente'
      ) {
        finalSubstateRef.current = 'puerta_desbloqueada';
        setFinalSubstate('puerta_desbloqueada');
        engineRef.current?.setFinalSubstate('puerta_desbloqueada');
        soundEngine.playSensorSuccess();
        setClueBanner({
          id: Date.now(),
          text: 'Quitaste el seguro exterior; la puerta del salón 2C ya puede abrirse...',
        });
        return;
      }

      // 2B. ESTADO_FINAL - Paso B: Interactuar directamente con la puerta desbloqueada -> Mensaje final
      if (
        marker.id === 'puerta_aula_destino' &&
        marker.kind === 'puerta' &&
        curPhase === 'ESTADO_FINAL' &&
        (curFinalSub === 'puerta_desbloqueada' || curFinalSub === 'completada')
      ) {
        finalSubstateRef.current = 'completada';
        setFinalSubstate('completada');
        engineRef.current?.setFinalSubstate('completada');
        soundEngine.playSensorSuccess();
        soundEngine.fadeOutBgm(2.2, { pauseAfterFade: true });
        setShowEndingModal(true);
        return;
      }

      soundEngine.playInteractTap();

      // 3. Resolve character/object dialogue
      const dialogue = resolveMarkerDialogue(marker.id, curPhase, curFlags);
      if (dialogue) {
        setActiveDialogue(dialogue);
        return;
      }

      // 4. Sensor challenge activates ONLY when interacting with an enabled .glb object marker in range
      if (
        marker.kind === 'objeto' &&
        marker.challengeType &&
        marker.requiredPhase === curPhase &&
        curUnlocked[marker.id]
      ) {
        if (marker.challengeType === 'gyro_profesor') {
          void sensorService.enableGyroscope();
        }
        soundEngine.fadeOutBgm(0.5, { targetVolume: 0.24 });
        setActiveChallenge(marker.challengeType);
      }
    },
    [triggerStairTransition, showToast]
  );

  // Controlador exclusivo del botón derecho de interacción del overlay (valida Raycast + Distancia en vivo)
  const handleOverlayInteract = useCallback(() => {
    if (isBusyOverlayRef.current) return;
    const engine = engineRef.current;
    if (!engine) return;

    const validatedMarker = engine.validateActiveMarkerInteraction();
    if (!validatedMarker) return;

    soundEngine.vibrate(30);
    interactWithMarker(validatedMarker);
  }, [interactWithMarker]);

  // Initialize Three.js SchoolEngine once on mount
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const engine = new SchoolEngine(container, {
      onNearbyMarkerChange: (m) => setNearbyMarker(m),
      onZoneNameChange: (name) => setZoneName(name),
      onFloorChangeNotice: (nextFloor) => {
        if (isInitializedRef.current) {
          showLocationNotice(nextFloor);
        }
      },
      onPlayerMove: (coords) => setPlayerCoords(coords),
    });
    engine.setMovementLocked(isBusyOverlayRef.current);
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [showLocationNotice]);

  // Global delegated UI confirmation SFX (menu_confirm.mp3) for all interactive buttons & modal options
  useEffect(() => {
    const onDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const interactiveEl = target.closest(
        'button:not(:disabled):not([data-no-confirm-sfx]), [data-ui-confirm="true"]'
      );
      if (interactiveEl) {
        soundEngine.playConfirm();
      }
    };
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, []);

  // Keyboard shortcuts for desktop testing (E triggers the same validated overlay action, M toggles map)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isInitialized) return;
      if (e.code === 'KeyE' && !isBusyOverlayRef.current) {
        e.preventDefault();
        handleOverlayInteract();
      } else if (e.code === 'KeyM' && !activeDialogue && !activeChallenge) {
        e.preventDefault();
        soundEngine.playConfirm();
        setMapModalTab((prev) => (prev ? null : 'map'));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isInitialized, activeDialogue, activeChallenge, handleOverlayInteract]);

  const handlePrepareMainScene = useCallback(() => {
    soundEngine.init();
    void sensorService.requestMotionOnly();
  }, []);

  const handleCompleteIntroLore = useCallback(() => {
    // Tras el fade-out de la intro a negro, entra en pausa atmosférica de 4s con el 3D y HUD ya montados
    setEntryStage('black_hold');
  }, []);

  // Pausa exacta de 4 segundos en #000000 antes del fade-in unificado de Escena 3D + HUD
  useEffect(() => {
    if (entryStage !== 'black_hold') return;
    const holdTimer = window.setTimeout(() => {
      setEntryStage('ready');
      setIsInitialized(true);
      soundEngine.startBgm(1.8);
      lastNotifiedFloorRef.current = null;
      showLocationNotice(1);
    }, 4000);

    return () => window.clearTimeout(holdTimer);
  }, [entryStage, showLocationNotice]);

  /**
   * Se ejecuta en el instante exacto en que el usuario cierra el texto final del modal de diálogo/sensor:
   * 1. Reproduce el audio de éxito reseteando currentTime = 0.
   * 2. Despliega la notificación central "NUEVA PISTA: ..." con animación minimalista J-Horror.
   * 3. Avanza dinámicamente la etapa y la indicación hacia la siguiente zona.
   */
  const onFinishSensorInteraction = useCallback(
    (sensorData: SensorInteractionData) => {
      // 1. Reproducir audio de éxito desde currentTime = 0 con prioridad sobre pasos y UI secundaria
      soundEngine.playSensorSuccess();

      // 2. Mostrar animación central "NUEVA PISTA: [Texto dinámico]"
      setClueBanner({
        id: Date.now(),
        text: sensorData.nextZoneHint,
      });

      // 3. Actualizar etapa e indicación hacia la siguiente zona del juego
      if (sensorData.nextPhase === 'ESTADO_FINAL') {
        finalSubstateRef.current = 'pendiente';
        setFinalSubstate('pendiente');
      }
      phaseRef.current = sensorData.nextPhase;
      setPhase(sensorData.nextPhase);
      unlockClueByStep(sensorData.clueStep);
    },
    [unlockClueByStep]
  );

  // Gestor de fin de diálogo: cierra la conversación, devuelve el control 3D y procesa pistas/sensores
  const handleFinishDialogue = (dialogue: DialoguePayload) => {
    setActiveDialogue(null);

    if (dialogue.sensorCompletion) {
      onFinishSensorInteraction(dialogue.sensorCompletion);
      return;
    }

    if (dialogue.unlocksNpcTalkFlag) {
      setSpokenFlags((prev) => ({ ...prev, [dialogue.unlocksNpcTalkFlag!]: true }));
    }

    if (dialogue.advanceToPhase === 'ESTADO_1' && phase === 'ESTADO_0') {
      setPhase('ESTADO_1');
      unlockClueByStep(1);
    }

    if (dialogue.unlocksObjectId) {
      const objectId = dialogue.unlocksObjectId;
      const alreadyUnlocked = unlockedObjectsRef.current[objectId];
      setUnlockedObjects((prev) => ({ ...prev, [objectId]: true }));

      if (!alreadyUnlocked) {
        showToast('Nuevo rumor anotado · Algo llamó tu atención aquí cerca');
      }
    }
  };

  const handleChallengeComplete = (completedType: SensorChallengeType) => {
    if (completedType === 'gyro_profesor') {
      sensorService.disableGyroscope();
    }
    setActiveChallenge(null);
    soundEngine.fadeInBgm(0.75);
    // Abre la lectura final del hallazgo del sensor; al cerrarla se ejecutará onFinishSensorInteraction
    setActiveDialogue(POST_CHALLENGE_DIALOGUES[completedType]);
  };

  const handleCapturePhoto = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    try {
      const dataUrl = engine.captureScreenshot();
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `aula-404-piso-${currentFloor}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      soundEngine.playInteractTap();
      showToast('Fotografía 3D descargada en tu dispositivo');
    } catch {
      showToast('No se pudo exportar la captura en este navegador');
    }
  }, [currentFloor, showToast]);

  const handleRestartStory = () => {
    sensorService.disableGyroscope();
    setShowEndingModal(false);
    setActiveDialogue(null);
    setActiveChallenge(null);
    setClueBanner(null);
    finalSubstateRef.current = 'pendiente';
    setFinalSubstate('pendiente');
    setPhase('ESTADO_0');
    setSpokenFlags({});
    setUnlockedObjects({});
    setClues(INITIAL_CLUES);
    setCurrentFloor(1);
    engineRef.current?.setFinalSubstate('pendiente');
    engineRef.current?.setFloor(1, [-1.5, 0, 6.0], 0, { silentFloorNotice: true });
    soundEngine.fadeInBgm(1.2);
    lastNotifiedFloorRef.current = null;
    showLocationNotice(1);
    showToast('Historia reiniciada · Primer día de clases');
  };

  const activePhaseIndicator = getPhaseIndicator(phase, unlockedObjects, finalSubstate);

  const isSceneHudMounted = entryStage === 'black_hold' || entryStage === 'ready';

  return (
    <main className="font-sans relative h-full w-full overflow-hidden bg-black select-none">
      {/* Contenedor padre unificado: Canvas 3D + todo el HUD comparten la misma capa de opacidad */}
      <div
        id="main-experience-stage"
        className={entryStage === 'ready' ? 'is-revealed' : ''}
      >
        {/* Dedicated Isolated WebGL Canvas Container */}
        <div ref={canvasContainerRef} className="fixed inset-0 z-0 h-full w-full" />

        {/* Viñeta radial cinemática sutil de costo cero sobre la escena 3D */}
        <div className="scene-cinematic-vignette pointer-events-none fixed inset-0 z-[1]" aria-hidden="true" />

        {/* Botón discreto de silencio en esquina superior izquierda (misma estética Title Screen) */}
        {isSceneHudMounted &&
          !activeDialogue &&
          !activeChallenge &&
          !mapModalTab &&
          !showEndingModal && (
            <div className="pointer-events-auto fixed top-3.5 left-3.5 sm:top-4 sm:left-5 z-20">
              <button
                type="button"
                data-no-confirm-sfx="true"
                onClick={() => {
                  const nextMuted = !isMuted;
                  setIsMuted(nextMuted);
                  soundEngine.setMuted(nextMuted);
                  if (!nextMuted) {
                    soundEngine.playConfirm();
                  }
                }}
                aria-label={isMuted ? 'Activar audio' : 'Silenciar audio'}
                title={isMuted ? 'Activar audio' : 'Silenciar audio'}
                className="title-audio-toggle"
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4 stroke-[1.75]" />
                ) : (
                  <Volume2 className="h-4 w-4 stroke-[1.75]" />
                )}
              </button>
            </div>
          )}

        {/* Bloque superior derecho unificado: Minimapa flotante + Pista desplazable sin recuadro */}
        {isSceneHudMounted &&
          !activeDialogue &&
          !activeChallenge &&
          !mapModalTab &&
          !showEndingModal && (
            <div className="pointer-events-auto fixed top-3 right-3 sm:top-4 sm:right-5 z-20 w-[176px] sm:w-[228px] flex flex-col gap-1">
              <MinimapHud
                engineRef={engineRef}
                floor={currentFloor}
                phase={phase}
                unlockedObjects={unlockedObjects}
                finalSubstate={finalSubstate}
                onOpenFullMap={() => setMapModalTab('map')}
              />
              <ClueTickerHud clueText={activePhaseIndicator.whisper} />
            </div>
          )}

        {/* Minimalist J-Horror 3-Level Floor Notice (1F & 2F Only, Frameless) */}
        {locationNotice &&
          isInitialized &&
          !clueBanner &&
          !activeDialogue &&
          !activeChallenge &&
          !mapModalTab &&
          !showEndingModal &&
          !isStairTransitioning && (
            <LocationNotice
              key={locationNotice.id}
              floorTitle={locationNotice.floorTitle}
            />
          )}

        {/* Notificación etérea "NUEVA PISTA" */}
        {clueBanner && isInitialized && (
          <NewClueBanner key={clueBanner.id} clueText={clueBanner.text} />
        )}

        {/* Notificación discreta estilo nocturno */}
        {toastMessage && isInitialized && (
          <div className="pointer-events-none fixed top-6 left-1/2 -translate-x-1/2 z-30 px-4 w-full max-w-md flex justify-center">
            <div className="hud-text-contrast rounded-lg border border-[#7dd3fc]/45 bg-[#080c16]/92 px-4 py-2 text-xs font-medium text-white shadow-[0_8px_28px_rgba(0,0,0,0.88)] flex items-center gap-2 backdrop-blur-md">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#7dd3fc] shrink-0" />
              <span className="truncate">{toastMessage}</span>
            </div>
          </div>
        )}

        {/* Controles minimalistas inferiores: Joystick izquierdo y Botón de Acción derecho */}
        {isSceneHudMounted && !activeDialogue && !activeChallenge && !showEndingModal && (
          <MobileControlsOverlay
            nearbyMarker={nearbyMarker}
            onMoveInput={(x, y) => engineRef.current?.setMoveInput(x, y)}
            onInteract={handleOverlayInteract}
          />
        )}
      </div>

      {/* Character Portrait & Dialogue Box */}
      {activeDialogue && (
        <DialogueOverlay
          dialogue={activeDialogue}
          onFinishDialogue={handleFinishDialogue}
          onClose={() => setActiveDialogue(null)}
        />
      )}

      {/* Interactive Device Sensor Challenges (Rastros II–VI) */}
      {activeChallenge && (
        <SensorChallengeModal
          challengeType={activeChallenge}
          onComplete={handleChallengeComplete}
          onClose={() => {
            if (activeChallenge === 'gyro_profesor') {
              sensorService.disableGyroscope();
            }
            setActiveChallenge(null);
            soundEngine.fadeInBgm(0.65);
          }}
        />
      )}

      {/* Architectural Floor Maps (1F & 2F) + Rumors Archive + 3D GLB Markers Viewer */}
      {mapModalTab && (
        <SchoolMapModal
          initialTab={mapModalTab}
          engineRef={engineRef}
          currentFloor={currentFloor}
          phase={phase}
          unlockedObjects={unlockedObjects}
          finalSubstate={finalSubstate}
          playerCoords={playerCoords}
          clues={clues}
          phaseIndicator={activePhaseIndicator}
          onTabChange={(tab) => setMapModalTab(tab)}
          onClose={() => setMapModalTab(null)}
        />
      )}

      {/* Final Resolution Modal (ESTADO_FINAL) */}
      {showEndingModal && (
        <EndingModal
          clues={clues}
          onKeepExploring={() => {
            setShowEndingModal(false);
            soundEngine.fadeInBgm(1.0);
          }}
          onCaptureMemento={handleCapturePhoto}
          onRestart={handleRestartStory}
        />
      )}

      {/* Secuencia Narrativa Intermedia (#intro-lore-screen) antes de revelar la escena 3D */}
      {entryStage === 'intro' && (
        <IntroLoreScreen
          isMuted={isMuted}
          onToggleMute={(next) => {
            setIsMuted(next);
            soundEngine.setMuted(next);
          }}
          onPrepareMainScene={handlePrepareMainScene}
          onComplete={handleCompleteIntroLore}
        />
      )}

      {/* Pantalla de Inicio (Title Screen) */}
      {entryStage === 'title' && (
        <TitleScreen
          isMuted={isMuted}
          onToggleMute={(next) => {
            setIsMuted(next);
            soundEngine.setMuted(next);
          }}
          onComplete={() => setEntryStage('intro')}
        />
      )}
    </main>
  );
}
