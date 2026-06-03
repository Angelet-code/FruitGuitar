import { Music2 } from "lucide-react";
import type { ChordDetection } from "../types/chords";

interface ChordPanelProps {
  detection: ChordDetection;
}

export function ChordPanel({ detection }: ChordPanelProps) {
  const percent = Math.round(detection.confidence * 100);

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
        <span className="chord-state">{detection.stable ? "locked" : "listening..."}</span>
      </div>
    </section>
  );
}
