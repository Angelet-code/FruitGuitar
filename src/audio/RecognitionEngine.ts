import { CHORD_NAMES, type ChordDetection, type ChordName, type ChromaVector } from "../types/chords";
import { CHORD_TEMPLATES, emptyChroma, normalizeChroma } from "./chordTemplates";

export interface RecognitionEngine {
  analyze(timestamp?: number): ChordDetection;
  getWaveform(): Float32Array;
  dispose(): void;
}

interface MatchResult {
  name: ChordName;
  confidence: number;
  score: number;
  margin: number;
}

const MIN_FREQUENCY = 65;
const MAX_FREQUENCY = 1600;
const DB_FLOOR = -92;
const HISTORY_SIZE = 4;

export function matchChordTemplate(chromaInput: ChromaVector): MatchResult {
  const chroma = normalizeChroma(chromaInput);
  const scores = CHORD_NAMES.map((name) => {
    const template = CHORD_TEMPLATES[name];
    const vector = emptyChroma();
    template.pitchClasses.forEach((pitchClass) => {
      vector[pitchClass] = template.weights[pitchClass] ?? 1;
    });
    const normalizedTemplate = normalizeChroma(vector);
    const score = normalizedTemplate.reduce((total, weight, index) => total + weight * chroma[index], 0);
    return { name, score };
  }).sort((a, b) => b.score - a.score);

  const best = scores[0];
  const second = scores[1];
  const margin = best.score - second.score;
  const confidence = clamp(best.score * 0.82 + margin * 0.55, 0, 1);

  return {
    name: best.name,
    confidence,
    score: best.score,
    margin,
  };
}

export function classifyChroma(
  chroma: ChromaVector,
  rms: number,
  timestamp: number,
  options: { rmsFloor?: number; confidenceFloor?: number } = {},
): ChordDetection {
  const rmsFloor = options.rmsFloor ?? 0.012;
  const confidenceFloor = options.confidenceFloor ?? 0.56;
  const match = matchChordTemplate(chroma);
  const hasSignal = rms >= rmsFloor && match.confidence >= confidenceFloor;

  return {
    name: hasSignal ? match.name : null,
    confidence: hasSignal ? match.confidence : 0,
    rms,
    chroma: normalizeChroma(chroma),
    timestamp,
    stable: false,
  };
}

export class WebAudioChordRecognizer implements RecognitionEngine {
  private readonly analyser: AnalyserNode;
  private readonly sampleRate: number;
  private readonly frequencyData: Float32Array<ArrayBuffer>;
  private readonly waveformData: Float32Array<ArrayBuffer>;
  private readonly history: Array<ChordName | null> = [];

  constructor(analyser: AnalyserNode, sampleRate: number) {
    this.analyser = analyser;
    this.sampleRate = sampleRate;
    this.frequencyData = new Float32Array(this.analyser.frequencyBinCount);
    this.waveformData = new Float32Array(this.analyser.fftSize);
  }

  analyze(timestamp = performance.now()): ChordDetection {
    this.analyser.getFloatFrequencyData(this.frequencyData);
    this.analyser.getFloatTimeDomainData(this.waveformData);

    const rms = computeRms(this.waveformData);
    const chroma = spectrumToChroma(this.frequencyData, this.sampleRate, this.analyser.fftSize);
    const detection = classifyChroma(chroma, rms, timestamp);

    this.history.push(detection.name);
    if (this.history.length > HISTORY_SIZE) {
      this.history.shift();
    }

    detection.stable = Boolean(detection.name) && this.history.filter((name) => name === detection.name).length >= 3;
    if (!detection.stable) {
      detection.confidence = detection.confidence * 0.72;
    }

    return detection;
  }

  getWaveform(): Float32Array {
    return this.waveformData.slice(0, 768);
  }

  dispose(): void {
    this.history.length = 0;
  }
}

export function spectrumToChroma(
  frequencyData: Float32Array,
  sampleRate: number,
  fftSize: number,
): ChromaVector {
  const chroma = emptyChroma();
  const binWidth = sampleRate / fftSize;

  for (let bin = 1; bin < frequencyData.length; bin += 1) {
    const frequency = bin * binWidth;
    if (frequency < MIN_FREQUENCY || frequency > MAX_FREQUENCY) continue;

    const decibels = frequencyData[bin];
    if (decibels < DB_FLOOR) continue;

    const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
    const pitchClass = ((midi % 12) + 12) % 12;
    const amplitude = Math.pow(10, decibels / 20);
    const harmonicWeight = frequency < 500 ? 1 : 0.72;
    chroma[pitchClass] += amplitude * harmonicWeight;
  }

  return normalizeChroma(chroma);
}

export function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  const total = samples.reduce((sum, value) => sum + value * value, 0);
  return Math.sqrt(total / samples.length);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
