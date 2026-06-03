import { Activity } from "lucide-react";
import { useEffect, useRef } from "react";

interface WaveformPanelProps {
  waveform: Float32Array;
  active: boolean;
}

export function WaveformPanel({ waveform, active }: WaveformPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "#fbf4e9";
    ctx.fillRect(0, 0, rect.width, rect.height);

    const centerY = rect.height * 0.55;
    ctx.strokeStyle = active ? "#6fa060" : "#a9baa0";
    ctx.lineWidth = active ? 2.5 : 2;
    ctx.lineCap = "round";
    ctx.beginPath();

    const samples = waveform.length > 0 ? waveform : new Float32Array(2);
    for (let index = 0; index < samples.length; index += 1) {
      const x = (index / Math.max(1, samples.length - 1)) * rect.width;
      const y = centerY + samples[index] * rect.height * 0.38;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.stroke();
  }, [active, waveform]);

  return (
    <section className="waveform-panel sketch-panel" aria-label="Forma de onda del micrófono">
      <div className="panel-label">
        <Activity size={15} strokeWidth={2.2} />
        <span>WAVEFORM</span>
      </div>
      <canvas ref={canvasRef} className="waveform-canvas" />
    </section>
  );
}
