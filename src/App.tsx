import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { DialogueOverlay } from './components/DialogueOverlay';
import { EndingModal } from './components/EndingModal';
import { MobileControlsOverlay } from './components/MobileControlsOverlay';
import { SchoolMapModal } from './components/SchoolMapModal';
import { SensorChallengeModal } from './components/SensorChallengeModal';
import { TopSensorHud } from './components/TopSensorHud';
import { WelcomePermissionsModal } from './components/WelcomePermissionsModal';
import {
  getPhaseIndicator,
  INITIAL_CLUES,
  POST_CHALLENGE_DIALOGUES,
  resolveMarkerDialogue,
} from './data/gameContent';
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
  const [mapModalTab, setMapModalTab] = useState<'map' | 'clues' | null>(null);
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

  // Mutable refs so Three.js callbacks never read stale React state
  const phaseRef = useRef<GamePhase>(phase);
  const finalSubstateRef = useRef<FinalSubstate>(finalSubstate);
  const spokenFlagsRef = useRef<Record<string, boolean>>(spokenFlags);
  const unlockedObjectsRef = useRef<Record<string, boolean>>(unlockedObjects);
  const isBusyOverlayRef = useRef(false);

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
    if (isBusyOverlayRef.current) {
      engineRef.current?.setMoveInput(0, 0);
    }
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

  const unlockClueByStep = useCallback((stepNumber: number) => {
    setClues((prev) =>
      prev.map((c) => (c.stepNumber === stepNumber ? { ...c, unlocked: true } : c))
    );
  }, []);

  const triggerStairTransition = useCallback((marker: WorldMarker) => {
    if (!marker.targetFloor || !marker.spawnAfterStairs) return;
    const nextFloor = marker.targetFloor;
    const spawn = marker.spawnAfterStairs;
    const yaw = marker.spawnYaw ?? 0;

    soundEngine.playStairsTransition();
    setStairTransitionText(
      nextFloor === 2 ? 'Subiendo al segundo piso...' : 'Bajando al primer piso...'
    );
    setStairFadeOpaque(true);

    window.setTimeout(() => {
      engineRef.current?.setFloor(nextFloor, spawn, yaw);
      setCurrentFloor(nextFloor);
      setPlayerCoords({ x: spawn[0], z: spawn[2], yaw, floor: nextFloor });
    }, 380);

    window.setTimeout(() => {
      setStairFadeOpaque(false);
    }, 780);

    window.setTimeout(() => {
      setStairTransitionText(null);
    }, 1150);
  }, []);

  const interactWithMarker = useCallback(
    (marker: WorldMarker) => {
      if (isBusyOverlayRef.current) return;

      // 1. Staircase transition marker
      if (marker.kind === 'escalera') {
        triggerStairTransition(marker);
        return;
      }

      soundEngine.playInteractTap();
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
        soundEngine.playClueUnlocked();
        soundEngine.vibrate(45);
        showToast('Seguro destrabado · La puerta del salón 2C está desbloqueada');
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
        soundEngine.playClueUnlocked();
        soundEngine.vibrate(60);
        setShowEndingModal(true);
        return;
      }

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
      onPlayerMove: (coords) => setPlayerCoords(coords),
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
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
        setMapModalTab((prev) => (prev ? null : 'map'));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isInitialized, activeDialogue, activeChallenge, handleOverlayInteract]);

  const handleStartExperience = async (requestFullSensors: boolean) => {
    soundEngine.init();
    if (requestFullSensors) {
      const perms = await sensorService.requestAllPermissions();
      setCameraAllowed(perms.cameraAllowed);
    }
    setIsInitialized(true);
    showToast('Ya sonó el timbre y en los pasillos quedaron solo murmullos...');
  };

  // Gestor de fin de diálogo: cierra la conversación, devuelve el control 3D y habilita el marcador del objeto
  const handleFinishDialogue = (dialogue: DialoguePayload) => {
    setActiveDialogue(null);

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
        soundEngine.playClueUnlocked();
        showToast('Nuevo rumor anotado · Algo llamó tu atención aquí cerca');
      }
    }
  };

  const handleChallengeComplete = (completedType: SensorChallengeType) => {
    if (completedType === 'gyro_profesor') {
      sensorService.disableGyroscope();
    }
    setActiveChallenge(null);

    if (completedType === 'touch_closet') {
      setPhase('ESTADO_2');
      unlockClueByStep(2);
      setActiveDialogue(POST_CHALLENGE_DIALOGUES.touch_closet);
    } else if (completedType === 'shake_bikes') {
      setPhase('ESTADO_3');
      unlockClueByStep(3);
      setActiveDialogue(POST_CHALLENGE_DIALOGUES.shake_bikes);
    } else if (completedType === 'mic_whisper') {
      setPhase('ESTADO_4');
      unlockClueByStep(4);
      setActiveDialogue(POST_CHALLENGE_DIALOGUES.mic_whisper);
    } else if (completedType === 'light_hanako') {
      setPhase('ESTADO_5');
      unlockClueByStep(5);
      setActiveDialogue(POST_CHALLENGE_DIALOGUES.light_hanako);
    } else if (completedType === 'gyro_profesor') {
      // No dispara la pantalla final aún: habilita el marcador .glb frente al salón destino (2C)
      finalSubstateRef.current = 'pendiente';
      setFinalSubstate('pendiente');
      setPhase('ESTADO_FINAL');
      unlockClueByStep(6);
      setActiveDialogue(POST_CHALLENGE_DIALOGUES.gyro_profesor);
    }
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
    finalSubstateRef.current = 'pendiente';
    setFinalSubstate('pendiente');
    setPhase('ESTADO_0');
    setSpokenFlags({});
    setUnlockedObjects({});
    setClues(INITIAL_CLUES);
    setCurrentFloor(1);
    engineRef.current?.setFinalSubstate('pendiente');
    engineRef.current?.setFloor(1, [-1.5, 0, 6.0], 0);
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
          onToggleMute={() => {
            const next = !isMuted;
            setIsMuted(next);
            soundEngine.setMuted(next);
          }}
        />
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
          }}
        />
      )}

      {/* Architectural Floor Maps (1F & 2F) + Rumors Archive */}
      {mapModalTab && (
        <SchoolMapModal
          initialTab={mapModalTab}
          currentFloor={currentFloor}
          playerCoords={playerCoords}
          clues={clues}
          phaseIndicator={activePhaseIndicator}
          onClose={() => setMapModalTab(null)}
        />
      )}

      {/* Final Resolution Modal (ESTADO_FINAL) */}
      {showEndingModal && (
        <EndingModal
          clues={clues}
          onKeepExploring={() => setShowEndingModal(false)}
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
            Escuela Tradicional · Aula 404
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
