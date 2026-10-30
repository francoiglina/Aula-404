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
  INITIAL_CLUES,
  PHASE_OBJECTIVES,
  PORTRAITS,
  resolveMarkerDialogue,
} from './data/gameContent';
import { sensorService } from './services/sensorService';
import { soundEngine } from './services/soundEngine';
import { SchoolEngine } from './three/SchoolEngine';
import {
  ClueRecord,
  DialoguePayload,
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
  const [currentFloor, setCurrentFloor] = useState<FloorNumber>(1);
  const [zoneName, setZoneName] = useState('Entrada Genkan (1° Piso)');
  const [nearbyMarker, setNearbyMarker] = useState<WorldMarker | null>(null);
  const [spokenFlags, setSpokenFlags] = useState<Record<string, boolean>>({});
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
  const [gyroLookEnabled, setGyroLookEnabled] = useState(false);
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
  const spokenFlagsRef = useRef<Record<string, boolean>>(spokenFlags);
  const nearbyMarkerRef = useRef<WorldMarker | null>(nearbyMarker);
  const isBusyOverlayRef = useRef(false);

  useEffect(() => {
    phaseRef.current = phase;
    engineRef.current?.setGamePhase(phase);
  }, [phase]);

  useEffect(() => {
    spokenFlagsRef.current = spokenFlags;
  }, [spokenFlags]);

  useEffect(() => {
    nearbyMarkerRef.current = nearbyMarker;
  }, [nearbyMarker]);

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
      nextFloor === 2 ? 'Subiendo al Segundo Piso...' : 'Bajando al Primer Piso...'
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
      const curFlags = spokenFlagsRef.current;

      // 2. Resolve dialogue or direct sensor challenge
      const dialogue = resolveMarkerDialogue(marker.id, curPhase, curFlags);
      if (dialogue) {
        setActiveDialogue(dialogue);
        return;
      }

      // If resolveMarkerDialogue returned null, this object marker opens its sensor challenge directly
      if (marker.challengeType) {
        setActiveChallenge(marker.challengeType);
      }
    },
    [triggerStairTransition]
  );

  // Initialize Three.js SchoolEngine once on mount
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const engine = new SchoolEngine(container, {
      onNearbyMarkerChange: (m) => setNearbyMarker(m),
      onZoneNameChange: (name) => setZoneName(name),
      onMarkerTapped: (m) => interactWithMarker(m),
      onPlayerMove: (coords) => setPlayerCoords(coords),
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [interactWithMarker]);

  // Keyboard shortcuts for desktop testing (E to interact, M for map)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isInitialized) return;
      if (e.code === 'KeyE' && !isBusyOverlayRef.current && nearbyMarkerRef.current) {
        e.preventDefault();
        interactWithMarker(nearbyMarkerRef.current);
      } else if (e.code === 'KeyM' && !activeDialogue && !activeChallenge) {
        e.preventDefault();
        setMapModalTab((prev) => (prev ? null : 'map'));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isInitialized, activeDialogue, activeChallenge, interactWithMarker]);

  const handleStartExperience = async (requestFullSensors: boolean) => {
    soundEngine.init();
    if (requestFullSensors) {
      const perms = await sensorService.requestAllPermissions();
      setCameraAllowed(perms.cameraAllowed);
      if (perms.gyroscopeAllowed) {
        setGyroLookEnabled(true);
        engineRef.current?.setGyroLookEnabled(true);
      }
    }
    setIsInitialized(true);
    showToast('Explora la escuela · Habla con Tsuki o busca el Armario de Limpieza');
  };

  const handleFinishDialogue = (dialogue: DialoguePayload) => {
    setActiveDialogue(null);

    if (dialogue.unlocksNpcTalkFlag) {
      setSpokenFlags((prev) => ({ ...prev, [dialogue.unlocksNpcTalkFlag!]: true }));
    }

    if (dialogue.advanceToPhase === 'ESTADO_1' && phase === 'ESTADO_0') {
      setPhase('ESTADO_1');
      unlockClueByStep(1);
      soundEngine.playClueUnlocked();
      showToast('Pista 1/6 · Inspecciona el Armario de Limpieza junto al Conserje');
    }

    if (dialogue.openChallenge) {
      setActiveChallenge(dialogue.openChallenge);
    }
  };

  const handleChallengeComplete = (completedType: SensorChallengeType) => {
    setActiveChallenge(null);

    if (completedType === 'touch_closet') {
      setPhase('ESTADO_2');
      unlockClueByStep(2);
      setActiveDialogue({
        markerId: 'objeto_armario',
        speakerName: 'Nota del Armario',
        speakerRole: 'Pista 2/6 Descubierta · Sensor Táctil',
        lines: [
          'Entre las escobas encontraste un sobre lacrado con una inscripción apresurada:',
          '"Quien vio quién se llevó la placa del Aula 404 espera junto a las bicicletas del patio exterior. Ve al Aparcabicicletas en el ala derecha del Primer Piso y habla con Hotaru."',
        ],
      });
    } else if (completedType === 'shake_bikes') {
      setPhase('ESTADO_3');
      unlockClueByStep(3);
      setActiveDialogue({
        markerId: 'personaje_hotaru',
        speakerName: 'Hotaru',
        speakerRole: 'Pista 3/6 Descubierta · Acelerómetro',
        portraitUrl: PORTRAITS.hotaru,
        lines: [
          '¡El remolino de hojas se disipó! Mira las huellas de barro que salen del cobertizo...',
          'Ahora lo recuerdo con claridad: fue Kaeru quien corrió hacia el interior. Búscalo en el Pasillo Principal del Primer Piso, justo frente al Aula 1B.',
        ],
      });
    } else if (completedType === 'mic_whisper') {
      setPhase('ESTADO_4');
      unlockClueByStep(4);
      setActiveDialogue({
        markerId: 'personaje_kaeru',
        speakerName: 'Kaeru',
        speakerRole: 'Pista 4/6 Descubierta · Micrófono',
        portraitUrl: PORTRAITS.kaeru,
        lines: [
          '¿Escuchaste ese eco en la campana de cristal? La corriente de aire viene desde arriba.',
          'Usa cualquiera de las Escaleras amarillas para subir al Segundo Piso. Entra a los Baños del ala derecha y pregunta por Hanako.',
        ],
      });
    } else if (completedType === 'light_hanako') {
      setPhase('ESTADO_5');
      unlockClueByStep(5);
      setActiveDialogue({
        markerId: 'personaje_hanako',
        speakerName: 'Hanako',
        speakerRole: 'Pista 5/6 Descubierta · Luz y Cámara',
        portraitUrl: PORTRAITS.hanako,
        lines: [
          'En la penumbra todo se vuelve nítido... Toma esta llave espiritual reflejada en el espejo.',
          'El Profesor custodia el compartimento final en la Sala de Profesores, al otro extremo del Segundo Piso (ala izquierda).',
        ],
      });
    } else if (completedType === 'gyro_profesor') {
      setPhase('ESTADO_FINAL');
      unlockClueByStep(6);
      setShowEndingModal(true);
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

  const handleToggleGyroLook = async () => {
    if (!gyroLookEnabled && !sensorService.permissions.gyroscopeAllowed) {
      const granted = await sensorService.requestMotionAndOrientation();
      if (!granted) {
        showToast('Giroscopio no disponible en este dispositivo · Usa arrastre táctil');
        return;
      }
    }
    const next = !gyroLookEnabled;
    setGyroLookEnabled(next);
    engineRef.current?.setGyroLookEnabled(next);
    showToast(next ? 'Cámara con giroscopio activada' : 'Cámara táctil manual activada');
  };

  const handleRestartStory = () => {
    setShowEndingModal(false);
    setActiveDialogue(null);
    setActiveChallenge(null);
    setPhase('ESTADO_0');
    setSpokenFlags({});
    setClues(INITIAL_CLUES);
    setCurrentFloor(1);
    engineRef.current?.setFloor(1, [-1.5, 0, 6.0], 0);
    showToast('Historia reiniciada · Primer día de clases');
  };

  const unlockedCluesCount = clues.filter((c) => c.unlocked).length;

  return (
    <main className="relative h-full w-full overflow-hidden bg-stone-950 select-none">
      {/* Dedicated Isolated WebGL Canvas Container */}
      <div ref={canvasContainerRef} className="fixed inset-0 z-0 h-full w-full" />

      {/* Top Navigation & Objective HUD */}
      {isInitialized && (
        <TopSensorHud
          floor={currentFloor}
          zoneName={zoneName}
          objectiveText={PHASE_OBJECTIVES[phase]}
          unlockedCluesCount={unlockedCluesCount}
          totalCluesCount={clues.length}
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
          objectiveText={PHASE_OBJECTIVES[phase]}
          gyroLookEnabled={gyroLookEnabled}
          cameraAllowed={cameraAllowed}
          onMoveInput={(x, y) => engineRef.current?.setMoveInput(x, y)}
          onInteract={() => {
            if (nearbyMarker) interactWithMarker(nearbyMarker);
          }}
          onToggleGyroLook={handleToggleGyroLook}
          onResetCamera={() => {
            engineRef.current?.resetCameraView();
            showToast('Vista centrada y giroscopio recalibrado');
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

      {/* Interactive Device Sensor Challenges (Steps 2–6) */}
      {activeChallenge && (
        <SensorChallengeModal
          challengeType={activeChallenge}
          onComplete={handleChallengeComplete}
          onClose={() => setActiveChallenge(null)}
        />
      )}

      {/* Architectural Floor Maps (1F & 2F) + Clues Notebook */}
      {mapModalTab && (
        <SchoolMapModal
          initialTab={mapModalTab}
          currentFloor={currentFloor}
          playerCoords={playerCoords}
          clues={clues}
          objectiveText={PHASE_OBJECTIVES[phase]}
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
          <p className="font-display text-2xl font-bold text-stone-100 tracking-wide">
            {stairTransitionText}
          </p>
          <p className="mt-1.5 text-xs text-amber-400">Escuela Tradicional · Aula 404</p>
        </div>
      )}

      {/* Initial Onboarding & Explicit Sensor Permission Gesture */}
      {!isInitialized && (
        <WelcomePermissionsModal onStartExperience={handleStartExperience} />
      )}
    </main>
  );
}
