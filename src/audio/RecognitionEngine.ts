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
  coverage: number;
}

const MIN_FREQUENCY = 70;
const MAX_FREQUENCY = 1200;
const DB_FLOOR = -92;
const HISTORY_SIZE = 4;
const THIRD_CONTRAST_WEIGHT = 0.34;
const OUT_OF_CHORD_PENALTY = 0.045;
const COVERAGE_WEIGHT = 0.035;
const HARMONIC_LEAKS = [
  { multiple: 5, keep: 0.18 },
  { multiple: 7, keep: 0.34 },
  { multiple: 10, keep: 0.22 },
  { multiple: 14, keep: 0.38 },
] as const;

export function matchChordTemplate(chromaInput: ChromaVector): MatchResult {
  const chroma = normalizeChroma(chromaInput);
  const scores = CHORD_NAMES.map((name) => {
    const template = CHORD_TEMPLATES[name];
    const vector = emptyChroma();
    template.pitchClasses.forEach((pitchClass) => {
      vector[pitchClass] = template.weights[pitchClass] ?? 1;
    });
    const normalizedTemplate = normalizeChroma(vector);
    const rawScore = normalizedTemplate.reduce((total, weight, index) => total + weight * chroma[index], 0);
    const thirdContrast = getThirdContrast(name, chroma);
    const coverage = getChordCoverage(name, chroma);
    const outOfChordEnergy = getOutOfChordEnergy(name, chroma);
    const score = rawScore + thirdContrast * THIRD_CONTRAST_WEIGHT + coverage * COVERAGE_WEIGHT - outOfChordEnergy * OUT_OF_CHORD_PENALTY;
    return { name, score, coverage };
  }).sort((a, b) => b.score - a.score);

  const best = scores[0];
  const second = scores[1];
  const margin = best.score - second.score;
  const confidence = clamp(best.score * 0.78 + margin * 0.72 + best.coverage * 0.08, 0, 1);

  return {
    name: best.name,
    confidence,
    score: best.score,
    margin,
    coverage: best.coverage,
  };
}

export function classifyChroma(
  chroma: ChromaVector,
  rms: number,
  timestamp: number,
  options: { rmsFloor?: number; confidenceFloor?: number; marginFloor?: number; scoreFloor?: number; coverageFloor?: number } = {},
): ChordDetection {
  const rmsFloor = options.rmsFloor ?? 0.012;
  const confidenceFloor = options.confidenceFloor ?? 0.62;
  const marginFloor = options.marginFloor ?? 0.045;
  const scoreFloor = options.scoreFloor ?? 0.72;
  const coverageFloor = options.coverageFloor ?? 0.5;
  const match = matchChordTemplate(chroma);
  const hasSignal =
    rms >= rmsFloor &&
    match.confidence >= confidenceFloor &&
    match.margin >= marginFloor &&
    match.score >= scoreFloor &&
    match.coverage >= coverageFloor;

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

    const midi = 69 + 12 * Math.log2(frequency / 440);
    const amplitude = Math.pow(10, decibels / 20);
    const harmonicWeight = getFrequencyReliabilityWeight(frequency);
    const leakageWeight = getHarmonicLeakageWeight(frequencyData, frequency, binWidth, amplitude);
    addFrequencyEnergy(chroma, midi, amplitude * harmonicWeight * leakageWeight);
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

function getThirdContrast(name: ChordName, chroma: ChromaVector): number {
  const template = CHORD_TEMPLATES[name];
  const [root, third] = template.pitchClasses;
  const isMinor = ((third - root + 12) % 12) === 3;
  const oppositeThird = (root + (isMinor ? 4 : 3)) % 12;

  return chroma[third] - chroma[oppositeThird];
}

function getChordCoverage(name: ChordName, chroma: ChromaVector): number {
  const template = CHORD_TEMPLATES[name];
  const [root, third, fifth] = template.pitchClasses;
  const rootCoverage = clamp(chroma[root] / 0.32, 0, 1);
  const thirdCoverage = clamp(chroma[third] / 0.18, 0, 1);
  const fifthCoverage = clamp(chroma[fifth] / 0.28, 0, 1);

  return (rootCoverage + thirdCoverage + fifthCoverage) / 3;
}

function getOutOfChordEnergy(name: ChordName, chroma: ChromaVector): number {
  const chordPitchClasses = new Set<number>(CHORD_TEMPLATES[name].pitchClasses);
  return chroma.reduce((total, energy, pitchClass) => (chordPitchClasses.has(pitchClass) ? total : total + energy), 0);
}

function getFrequencyReliabilityWeight(frequency: number): number {
  if (frequency < 520) return 1;
  if (frequency < 900) return 0.42;
  return 0.22;
}

function getHarmonicLeakageWeight(
  frequencyData: Float32Array,
  frequency: number,
  binWidth: number,
  amplitude: number,
): number {
  let weight = 1;

  HARMONIC_LEAKS.forEach(({ multiple, keep }) => {
    const possibleFundamental = frequency / multiple;
    if (possibleFundamental < MIN_FREQUENCY) return;

    const support = getAmplitudeAtFrequency(frequencyData, possibleFundamental, binWidth);
    if (support > amplitude * 0.12) {
      weight = Math.min(weight, keep);
    }
  });

  return weight;
}

function getAmplitudeAtFrequency(frequencyData: Float32Array, frequency: number, binWidth: number): number {
  const exactBin = frequency / binWidth;
  const lowerBin = Math.floor(exactBin);
  const upperBin = Math.ceil(exactBin);
  const lowerAmplitude = getAmplitudeAtBin(frequencyData, lowerBin);
  const upperAmplitude = getAmplitudeAtBin(frequencyData, upperBin);

  return Math.max(lowerAmplitude, upperAmplitude);
}

function getAmplitudeAtBin(frequencyData: Float32Array, bin: number): number {
  if (bin < 0 || bin >= frequencyData.length) return 0;
  const decibels = frequencyData[bin];
  if (decibels < DB_FLOOR) return 0;
  return Math.pow(10, decibels / 20);
}

function addFrequencyEnergy(chroma: ChromaVector, midi: number, energy: number): void {
  const lowerMidi = Math.floor(midi);
  const upperMidi = lowerMidi + 1;
  const upperDistance = midi - lowerMidi;
  const lowerWeight = Math.pow(1 - upperDistance, 2);
  const upperWeight = Math.pow(upperDistance, 2);
  const totalWeight = lowerWeight + upperWeight;

  chroma[getPitchClass(lowerMidi)] += energy * (lowerWeight / totalWeight);
  chroma[getPitchClass(upperMidi)] += energy * (upperWeight / totalWeight);
}

function getPitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}
