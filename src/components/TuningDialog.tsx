import { Play, RefreshCw } from "lucide-react";
import type { CSSProperties } from "react";
import type { AudioPermissionState } from "../audio/useAudioInput";
import type { ChordDetection } from "../types/chords";

interface TuningDialogProps {
  detection: ChordDetection;
  error: string | null;
  permission: AudioPermissionState;
  onRequestAccess: () => void;
  onStart: () => void;
}

export function TuningDialog({ detection, error, permission, onRequestAccess, onStart }: TuningDialogProps) {
  const note = detection.note;
  const status = getTuningStatus(detection, permission);
  const cents = note ? Math.max(-50, Math.min(50, note.cents)) : 0;
  const tunerProgress = permission === "granted" && note ? 50 + cents : permission === "requesting" ? 28 : 0;
  const canStart = permission === "granted";
  const canRequestAccess = permission !== "requesting" && permission !== "granted";

  return (
    <div className="tuning-card" role="dialog" aria-modal="true" aria-labelledby="tuning-title">
      <div className="tuning-heading">
        <span className="tuning-kicker">Fruit Guitar</span>
        <h1 id="tuning-title">Primero afina!</h1>
      </div>

      <div
        className={`tuner-face ${status.tone}`}
        style={{ "--tuner-progress": `${tunerProgress}%` } as CSSProperties}
        aria-label={`Afinador: ${status.label}`}
      >
        <span className="tuner-face-label">Afinador</span>
        <strong>{note?.name ?? "--"}</strong>
        <span>{status.label}</span>
      </div>

      <div className={`tuning-meter ${note ? "active" : ""}`} aria-label={note ? `Desviacion ${Math.round(note.cents)} cents` : "Sin nota detectada"}>
        <span style={{ left: `${tunerProgress}%` }} />
      </div>

      {permission === "denied" || permission === "unsupported" ? (
        <p className="tuning-error">{error ?? "Revisa permisos del navegador."}</p>
      ) : null}

      <div className="tuning-actions">
        {permission !== "granted" ? (
          <button className="secondary-button" type="button" onClick={onRequestAccess} disabled={!canRequestAccess}>
            <RefreshCw size={18} />
            {permission === "requesting" ? "Abriendo..." : "Permitir"}
          </button>
        ) : null}
        <button className="primary-button" type="button" onClick={onStart} disabled={!canStart}>
          <Play size={18} fill="currentColor" />
          Empezar
        </button>
      </div>
    </div>
  );
}

function getTuningStatus(
  detection: ChordDetection,
  permission: AudioPermissionState,
): { label: string; tone: "off" | "listening" | "close" | "ready" } {
  if (permission === "idle") return { label: "Preparando permisos", tone: "off" };
  if (permission === "requesting") return { label: "Preparando afinador", tone: "listening" };
  if (permission === "denied") return { label: "Permisos bloqueados", tone: "off" };
  if (permission === "unsupported") return { label: "Sin soporte", tone: "off" };
  if (detection.rawRms < 0.0025) return { label: "Toca una cuerda", tone: "listening" };
  if (!detection.note) return { label: "Buscando nota", tone: "listening" };
  const cents = Math.round(detection.note.cents);
  if (Math.abs(cents) <= 5 && detection.note.stable) return { label: "Afinada", tone: "ready" };
  if (Math.abs(cents) <= 12) return { label: "Casi afinada", tone: "close" };
  return { label: cents < 0 ? `Sube ${Math.abs(cents)}` : `Baja ${cents}`, tone: "close" };
}
