import { Camera } from "lucide-react";
import { useEffect, useRef } from "react";

interface CameraPanelProps {
  stream: MediaStream | null;
  permission: string;
}

export function CameraPanel({ stream, permission }: CameraPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <section className="camera-panel sketch-panel" aria-label="Vista de camara frontal">
      <div className="panel-label">
        <Camera size={15} strokeWidth={2.2} />
        <span>CAMARA</span>
      </div>
      <video ref={videoRef} autoPlay muted playsInline className="camera-video" />
      {permission !== "granted" ? (
        <div className="camera-empty">
          <Camera size={40} strokeWidth={1.8} />
          <span>{permission === "requesting" ? "abriendo camara..." : "permitir camara"}</span>
        </div>
      ) : null}
    </section>
  );
}
