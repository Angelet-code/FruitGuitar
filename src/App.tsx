import { Heart, Play, RotateCcw, Settings, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChordPanel } from "./components/ChordPanel";
import { CameraPanel } from "./components/CameraPanel";
import { FruitCanvas } from "./components/FruitCanvas";
import { WaveformPanel } from "./components/WaveformPanel";
import { useAudioInput } from "./audio/useAudioInput";
import { GameEngine } from "./game/GameEngine";
import type { GameSnapshot } from "./game/gameTypes";

const INITIAL_SNAPSHOT: GameSnapshot = {
  score: 0,
  lives: 5,
  maxLives: 5,
  status: "ready",
  fruits: [],
  elapsedMs: 0,
};

export function App() {
  const audio = useAudioInput();
  const startAudio = audio.start;
  const resumeAudio = audio.resume;
  const engineRef = useRef<GameEngine>(new GameEngine());
  const autoStartedRef = useRef(false);
  const [snapshot, setSnapshot] = useState<GameSnapshot>(INITIAL_SNAPSHOT);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.68);
  const [hasStarted, setHasStarted] = useState(false);
  const visualCheck = new URLSearchParams(window.location.search).get("check") === "visual";

  const heartSlots = useMemo(
    () => Array.from({ length: snapshot.maxLives }, (_, index) => index < snapshot.lives),
    [snapshot.lives, snapshot.maxLives],
  );

  const startGame = useCallback(async () => {
    const audioStarted = await startAudio();
    if (!audioStarted) return;
    await resumeAudio();
    setHasStarted(true);
    engineRef.current.reset();
    setSnapshot(engineRef.current.getSnapshot());
  }, [resumeAudio, startAudio]);

  useEffect(() => {
    if (!visualCheck || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void startGame();
  }, [startGame, visualCheck]);

  const playAgain = () => {
    engineRef.current.reset();
    setSnapshot(engineRef.current.getSnapshot());
  };

  const togglePause = () => {
    const nextPaused = snapshot.status === "running";
    engineRef.current.setPaused(nextPaused);
    setSnapshot(engineRef.current.getSnapshot());
  };

  return (
    <main className="app-shell">
      <aside className="left-console">
        <CameraPanel stream={audio.stream} permission={audio.permission} />
        <div className="telemetry-grid">
          <WaveformPanel waveform={audio.waveform} active={audio.permission === "granted"} />
          <ChordPanel detection={audio.detection} permission={audio.permission} />
        </div>
      </aside>

      <section className="game-board sketch-panel" aria-label="Fruit Guitar game">
        <div className="score-block">
          <span>SCORE</span>
          <strong>{snapshot.score}</strong>
        </div>

        <div className="lives-row" aria-label={`${snapshot.lives} vidas`}>
          {heartSlots.map((alive, index) => (
            <Heart
              key={index}
              size={38}
              fill={alive ? "#e7332e" : "#bdb9ae"}
              color={alive ? "#b3211d" : "#aaa59a"}
              strokeWidth={2}
            />
          ))}
        </div>

        <div className="top-actions">
          <button className="icon-button" type="button" onClick={() => setSettingsOpen(true)} aria-label="Ajustes">
            <Settings size={25} />
          </button>
          <button className="icon-button" type="button" onClick={togglePause} aria-label="Pausar o reanudar">
            {snapshot.status === "paused" ? <Play size={26} /> : <X size={28} />}
          </button>
        </div>

        <FruitCanvas
          engine={engineRef.current}
          detection={audio.detection}
          confidenceThreshold={confidenceThreshold}
          onSnapshot={setSnapshot}
        />

        {!hasStarted ? (
          <div className="permission-overlay">
            <div className="modal-card">
              <h1>Fruit Guitar</h1>
              <button className="primary-button" type="button" onClick={startGame}>
                <Play size={18} fill="currentColor" />
                Empezar
              </button>
            </div>
          </div>
        ) : null}

        {audio.permission === "denied" || audio.permission === "unsupported" ? (
          <div className="permission-toast" role="status">
            <strong>Audio no disponible</strong>
            <span>{audio.error ?? "Revisa permisos del navegador."}</span>
          </div>
        ) : null}

        {snapshot.status === "paused" ? (
          <div className="soft-overlay">
            <div className="modal-card compact">
              <h2>Pausado</h2>
              <button className="primary-button" type="button" onClick={togglePause}>
                <Play size={18} fill="currentColor" />
                Continuar
              </button>
            </div>
          </div>
        ) : null}

        {snapshot.status === "gameOver" ? (
          <div className="game-over-overlay">
            <div className="game-over-card">
              <h2>Game Over</h2>
              <p>
                Score: <strong>{snapshot.score}</strong>
              </p>
              <button className="primary-button" type="button" onClick={playAgain}>
                <RotateCcw size={18} />
                Play Again
              </button>
            </div>
          </div>
        ) : null}

        {settingsOpen ? (
          <div className="settings-layer" role="dialog" aria-modal="true" aria-label="Ajustes">
            <div className="settings-card">
              <div className="settings-header">
                <h2>Ajustes</h2>
                <button className="icon-button small" type="button" onClick={() => setSettingsOpen(false)} aria-label="Cerrar ajustes">
                  <X size={22} />
                </button>
              </div>
              <label className="range-control">
                <span>Umbral de corte</span>
                <strong>{Math.round(confidenceThreshold * 100)}%</strong>
                <input
                  type="range"
                  min="50"
                  max="86"
                  value={Math.round(confidenceThreshold * 100)}
                  onChange={(event) => setConfidenceThreshold(Number(event.target.value) / 100)}
                />
              </label>
              <p className="settings-note">Mas alto = mas estricto.</p>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
