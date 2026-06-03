import { Music2 } from "lucide-react";
import type { ChordDetection } from "../types/chords";
import type { AudioPermissionState } from "../audio/useAudioInput";

interface ChordPanelProps {
  detection: ChordDetection;
  permission: AudioPermissionState;
}

export function ChordPanel({ detection, permission }: ChordPanelProps) {
  const percent = Math.round(detection.confidence * 100);
  const micStatus = getMicStatus(detection, permission);

  return (
    <section className="chord-panel sketch-panel" aria-label="Acorde detectado">
      <div className="panel-label">
        <Music2 size={15} strokeWidth={2.2} />
        <span>CHORD</span>
      </div>
      <div className="chord-readout">
        <span className="chord-name">{detection.name ?? "--"}</span>
        <span className="chord-match">
          <strong>{percent}%</strong> match
        </span>
        <div className={`mic-health ${micStatus.tone}`} aria-label={`Nivel de micro ${micStatus.level}%`}>
          <span className="mic-meter">
            <span style={{ width: `${micStatus.level}%` }} />
          </span>
          <span className="mic-state">{micStatus.label}</span>
        </div>
        <span className="chord-state">{detection.stable ? "locked" : "listening..."}</span>
      </div>
    </section>
  );
}

function getMicStatus(
  detection: ChordDetection,
  permission: AudioPermissionState,
): { label: string; level: number; tone: "off" | "quiet" | "live" | "ready" } {
  if (permission === "idle") return { label: "sin micro", level: 0, tone: "off" };
  if (permission === "requesting") return { label: "abriendo", level: 0, tone: "quiet" };
  if (permission === "denied") return { label: "bloqueado", level: 0, tone: "off" };
  if (permission === "unsupported") return { label: "sin soporte", level: 0, tone: "off" };

  const level = Math.min(100, Math.round((detection.rms / 0.055) * 100));
  if (detection.rawRms < 0.0025) return { label: "sin senal", level, tone: "off" };
  if (detection.trimGain > 1.25 && !detection.stable) {
    return { label: `trim x${detection.trimGain.toFixed(1)}`, level, tone: "quiet" };
  }
  if (detection.name && detection.stable) return { label: "acorde ok", level, tone: "ready" };
  return { label: detection.name ? "analizando" : "senal ok", level, tone: "live" };
}
