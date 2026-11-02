import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { DialogueOverlay } from './components/DialogueOverlay';
import { EndingModal } from './components/EndingModal';
import { LocationNotice } from './components/LocationNotice';
import { MinimapHud } from './components/MinimapHud';
import { MobileControlsOverlay } from './components/MobileControlsOverlay';
import { NewClueBanner } from './components/NewClueBanner';
import { SchoolMapModal, SchoolModalTab } from './components/SchoolMapModal';
import { SensorChallengeModal } from './components/SensorChallengeModal';
import { TopSensorHud } from './components/TopSensorHud';
import { WelcomePermissionsModal } from './components/WelcomePermissionsModal';
import {
  getPhaseIndicator,
  INITIAL_CLUES,
  POST_CHALLENGE_DIALOGUES,
  resolveMarkerDialogue,
} from './data/gameContent';
import {
  resolveAllowedFloorNotice,
  SCHOOL_KANJI_TITLE,
  SCHOOL_SUBTITLE,
} from './data/locationZones';
import { sensorService } from './services/sensorService';
import { soundEngine } from './services/soundEngine';
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

  const [isInitialized, setIsInitialized] = useState(false);
  const [phase, setPhase] = useState<GamePhase>('ESTADO_0');
  const [finalSubstate, setFinalSubstate] = useState<FinalSubstate>('pendiente');
  const [currentFloor, setCurrentFloor] = useState<FloorNumber>(1);
  const [zoneName, setZoneName] = useState('Entrada Genkan (1° Piso)');
  const [nearbyMarker, setNearbyMarker] = useState<WorldMarker | null>(null);
  const [spokenFlags, setSpokenFlags] = useState<Record<string, boolean>>({});
  const [unlockedObjects, setUnlockedObjects] = useState<Record<string, boolean>>({});
  const [clues, setClues] = useState<ClueRecord[]>(INITIAL_CLUES);

  // Overlays & Modals
  const [activeDialogue, setActiveDialogue] = useState<DialoguePayload | null>(null);
  const [activeChallenge, setActiveChallenge] = useState<SensorChallengeType | null>(null);
  const [mapModalTab, setMapModalTab] = useState<SchoolModalTab | null>(null);
  const [showEndingModal, setShowEndingModal] = useState(false);

  // Staircase fade-to-black transition state
  const [stairTransitionText, setStairTransitionText] = useState<string | null>(null);
  const [stairFadeOpaque, setStairFadeOpaque] = useState(false);

  // Controls & Sensors UI state
  const [isMuted, setIsMuted] = useState(false);
  const [cameraAllowed, setCameraAllowed] = useState(false);
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
        stairTransitionText
    );
    engineRef.current?.setMovementLocked(isBusyOverlayRef.current);
    engineRef.current?.setExternalPause(mapModalTab === 'markers');
  }, [
    isInitialized,
    activeDialogue,
    activeChallenge,
    mapModalTab,
    showEndingModal,
    stairTransitionText,
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

      soundEngine.playStairsTransition();
      soundEngine.fadeOutBgm(0.35, { targetVolume: 0.14 });
      setStairTransitionText(
        nextFloor === 2 ? 'Subiendo al segundo piso...' : 'Bajando al primer piso...'
      );
      setStairFadeOpaque(true);

      window.setTimeout(() => {
        engineRef.current?.setFloor(nextFloor, spawn, yaw, { silentFloorNotice: true });
        setCurrentFloor(nextFloor);
        setPlayerCoords({ x: spawn[0], z: spawn[2], yaw, floor: nextFloor });
      }, 380);

      window.setTimeout(() => {
        setStairFadeOpaque(false);
        soundEngine.fadeInBgm(0.7, 0.32);
        showLocationNotice(nextFloor);
      }, 820);

      window.setTimeout(() => {
        setStairTransitionText(null);
      }, 1150);
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
        soundEngine.fadeOutBgm(0.5, { targetVolume: 0.14 });
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

  const handleStartExperience = async (requestFullSensors: boolean) => {
    soundEngine.init();
    soundEngine.startBgm(1.3);
    soundEngine.playConfirm();
    if (requestFullSensors) {
      const perms = await sensorService.requestAllPermissions();
      setCameraAllowed(perms.cameraAllowed);
    }
    setIsInitialized(true);
    lastNotifiedFloorRef.current = null;
    showLocationNotice(1);
  };

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
    soundEngine.fadeInBgm(0.75, 0.32);
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
    soundEngine.fadeInBgm(1.2, 0.32);
    lastNotifiedFloorRef.current = null;
    showLocationNotice(1);
    showToast('Historia reiniciada · Primer día de clases');
  };

  const unlockedCluesCount = clues.filter((c) => c.unlocked).length;
  const activePhaseIndicator = getPhaseIndicator(phase, unlockedObjects, finalSubstate);

  return (
    <main className="font-sans relative h-full w-full overflow-hidden bg-stone-950 select-none">
      {/* Dedicated Isolated WebGL Canvas Container */}
      <div ref={canvasContainerRef} className="fixed inset-0 z-0 h-full w-full" />

      {/* Top Navigation & Enigmatic Phase HUD */}
      {isInitialized && (
        <TopSensorHud
          floor={currentFloor}
          zoneName={zoneName}
          phaseIndicator={activePhaseIndicator}
          unlockedCluesCount={unlockedCluesCount}
          isMuted={isMuted}
          onOpenMap={() => setMapModalTab('map')}
          onOpenClues={() => setMapModalTab('clues')}
          onOpenMarkers={() => setMapModalTab('markers')}
          onToggleMute={() => {
            const next = !isMuted;
            setIsMuted(next);
            soundEngine.setMuted(next);
            if (!next) {
              soundEngine.playConfirm();
            }
          }}
        />
      )}

      {/* Dynamic Real-Time 2D Minimap (Top-Right Non-Obstructive Overlay) */}
      {isInitialized &&
        !activeDialogue &&
        !activeChallenge &&
        !mapModalTab &&
        !showEndingModal && (
          <MinimapHud
            engineRef={engineRef}
            floor={currentFloor}
            phase={phase}
            unlockedObjects={unlockedObjects}
            finalSubstate={finalSubstate}
            onOpenFullMap={() => setMapModalTab('map')}
          />
        )}

      {/* Minimalist J-Horror 3-Level Floor Notice (1F & 2F Only, Frameless) */}
      {locationNotice &&
        isInitialized &&
        !clueBanner &&
        !activeDialogue &&
        !activeChallenge &&
        !mapModalTab &&
        !showEndingModal &&
        !stairFadeOpaque && (
          <LocationNotice
            key={locationNotice.id}
            floorTitle={locationNotice.floorTitle}
          />
        )}

      {/* Minimalist J-Horror "NUEVA PISTA" Center Overlay */}
      {clueBanner && isInitialized && (
        <NewClueBanner key={clueBanner.id} clueText={clueBanner.text} />
      )}

      {/* Subtle Toast Notification */}
      {toastMessage && isInitialized && (
        <div className="pointer-events-none fixed top-16 left-1/2 -translate-x-1/2 z-30 px-4 w-full max-w-md flex justify-center">
          <div className="rounded-xl border border-amber-500/40 bg-stone-950/94 px-3.5 py-2 text-xs font-medium text-stone-100 shadow-lg flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="truncate">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Mobile Virtual Analog Stick (Left) & Single Interact Button (Right) */}
      {isInitialized && !activeDialogue && !activeChallenge && !showEndingModal && (
        <MobileControlsOverlay
          nearbyMarker={nearbyMarker}
          phaseIndicator={activePhaseIndicator}
          cameraAllowed={cameraAllowed}
          onMoveInput={(x, y) => engineRef.current?.setMoveInput(x, y)}
          onInteract={handleOverlayInteract}
          onResetCamera={() => {
            engineRef.current?.resetCameraView();
            showToast('Vista táctil centrada horizontalmente');
          }}
          onCapturePhoto={handleCapturePhoto}
          onSwitchCamera={async () => {
            const mode = await sensorService.toggleCameraFacing();
            showToast(mode === 'user' ? 'Cámara frontal activa' : 'Cámara trasera activa');
          }}
        />
      )}

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
            soundEngine.fadeInBgm(0.65, 0.32);
          }}
        />
      )}

      {/* Architectural Floor Maps (1F & 2F) + Rumors Archive + 3D GLB Markers Viewer */}
      {mapModalTab && (
        <SchoolMapModal
          initialTab={mapModalTab}
          currentFloor={currentFloor}
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
            soundEngine.fadeInBgm(1.0, 0.32);
          }}
          onCaptureMemento={handleCapturePhoto}
          onRestart={handleRestartStory}
        />
      )}

      {/* Staircase Fade-to-Black Transition Screen */}
      {stairTransitionText && (
        <div
          className={`pointer-events-auto fixed inset-0 z-50 flex flex-col items-center justify-center bg-black transition-opacity duration-300 ${
            stairFadeOpaque ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <p className="font-display text-2xl font-bold tracking-tight text-stone-100">
            {stairTransitionText}
          </p>
          <p className="mt-1.5 text-xs font-medium text-amber-400">
            {SCHOOL_KANJI_TITLE} · {SCHOOL_SUBTITLE}
          </p>
        </div>
      )}

      {/* Initial Onboarding & Explicit Sensor Permission Gesture */}
      {!isInitialized && (
        <WelcomePermissionsModal onStartExperience={handleStartExperience} />
      )}
    </main>
  );
}
