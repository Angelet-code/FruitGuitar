import { useCallback, useEffect, useRef, useState } from "react";
import type { ChordDetection } from "../types/chords";
import { emptyChroma } from "./chordTemplates";
import { WebAudioChordRecognizer } from "./RecognitionEngine";

export type AudioPermissionState = "idle" | "requesting" | "granted" | "denied" | "unsupported";

interface AudioInputState {
  permission: AudioPermissionState;
  stream: MediaStream | null;
  detection: ChordDetection;
  waveform: Float32Array;
  error: string | null;
  start: () => Promise<boolean>;
  resume: () => Promise<void>;
  stop: () => void;
}

const EMPTY_DETECTION: ChordDetection = {
  name: null,
  note: null,
  confidence: 0,
  rms: 0,
  rawRms: 0,
  trimGain: 1,
  noiseFloorRms: 0,
  chroma: emptyChroma(),
  timestamp: 0,
  stable: false,
};

export function useAudioInput(): AudioInputState {
  const [permission, setPermission] = useState<AudioPermissionState>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [detection, setDetection] = useState<ChordDetection>(EMPTY_DETECTION);
  const [waveform, setWaveform] = useState<Float32Array>(new Float32Array(128));
  const [error, setError] = useState<string | null>(null);

  const contextRef = useRef<AudioContext | null>(null);
  const recognizerRef = useRef<WebAudioChordRecognizer | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastUiUpdateRef = useRef(0);

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    recognizerRef.current?.dispose();
    recognizerRef.current = null;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);

    void contextRef.current?.close();
    contextRef.current = null;
  }, []);

  const startLoop = useCallback(() => {
    const tick = (time: number) => {
      const recognizer = recognizerRef.current;
      if (recognizer) {
        const nextDetection = recognizer.analyze(time);
        if (time - lastUiUpdateRef.current > 34) {
          setDetection(nextDetection);
          setWaveform(recognizer.getWaveform());
          lastUiUpdateRef.current = time;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const resume = useCallback(async () => {
    if (contextRef.current?.state === "suspended") {
      await contextRef.current.resume();
    }
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermission("unsupported");
      setError("Este navegador no expone camara/microfono por WebRTC.");
      return false;
    }

    setPermission("requesting");
    setError(null);

    try {
      stop();
      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: false },
          noiseSuppression: { ideal: false },
          autoGainControl: { ideal: false },
          channelCount: { ideal: 1 },
        },
        video: {
          width: { ideal: 960 },
          height: { ideal: 720 },
          facingMode: { ideal: "user" },
        },
      });

      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContextCtor();
      const source = context.createMediaStreamSource(nextStream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 8192;
      analyser.minDecibels = -100;
      analyser.maxDecibels = -18;
      analyser.smoothingTimeConstant = 0.42;
      source.connect(analyser);

      contextRef.current = context;
      recognizerRef.current = new WebAudioChordRecognizer(analyser, context.sampleRate);
      streamRef.current = nextStream;

      if (context.state === "suspended") {
        await context.resume();
      }

      setStream(nextStream);
      setPermission("granted");
      startLoop();
      return true;
    } catch (caught) {
      stop();
      setPermission("denied");
      setError(caught instanceof Error ? caught.message : "No se pudieron abrir camara y microfono.");
      return false;
    }
  }, [startLoop, stop]);

  useEffect(() => stop, [stop]);

  return {
    permission,
    stream,
    detection,
    waveform,
    error,
    start,
    resume,
    stop,
  };
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
