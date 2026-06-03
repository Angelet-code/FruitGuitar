import { describe, expect, it } from "vitest";
import { chromaForChord, emptyChroma, normalizeChroma } from "./chordTemplates";
import { classifyChroma, matchChordTemplate, spectrumToChroma } from "./RecognitionEngine";
import type { ChromaVector } from "../types/chords";

describe("matchChordTemplate", () => {
  it("matches a clean open C chroma vector", () => {
    const match = matchChordTemplate(chromaForChord("C"));

    expect(match.name).toBe("C");
    expect(match.confidence).toBeGreaterThan(0.8);
  });

  it("keeps minor chords distinct from nearby majors", () => {
    const match = matchChordTemplate(chromaForChord("Am"));

    expect(match.name).toBe("Am");
    expect(match.confidence).toBeGreaterThan(0.72);
  });

  it("does not emit a chord when the microphone signal is too quiet", () => {
    const detection = classifyChroma(chromaForChord("G"), 0.001, 1000);

    expect(detection.name).toBeNull();
    expect(detection.confidence).toBe(0);
  });

  it("does not emit a full chord from root and fifth only", () => {
    const detection = classifyChroma(chromaWith([[4, 1], [11, 0.9]]), 0.04, 1000);

    expect(detection.name).toBeNull();
  });

  it("keeps weak open Em from collapsing into E major", () => {
    const match = matchChordTemplate(chromaWith([[4, 1], [11, 0.85], [7, 0.18], [8, 0.11]]));

    expect(match.name).toBe("Em");
    expect(match.margin).toBeGreaterThan(0.045);
    expect(match.confidence).toBeGreaterThan(0.68);
  });

  it("discounts the low E fifth harmonic when classifying open Em", () => {
    const chroma = spectrumToChroma(
      spectrumWithPeaks([
        [82.41, -30],
        [123.47, -33],
        [164.81, -30],
        [196, -40],
        [246.94, -33],
        [329.63, -36],
        [412.03, -27],
      ]),
      44100,
      8192,
    );
    const match = matchChordTemplate(chroma);

    expect(match.name).toBe("Em");
  });

  it("does not emit a chord for empty chroma noise", () => {
    const detection = classifyChroma(emptyChroma(), 0.04, 1000);

    expect(detection.name).toBeNull();
  });
});

function chromaWith(entries: Array<[pitchClass: number, energy: number]>): ChromaVector {
  const chroma = emptyChroma();
  entries.forEach(([pitchClass, energy]) => {
    chroma[pitchClass] = energy;
  });
  return normalizeChroma(chroma);
}

function spectrumWithPeaks(peaks: Array<[frequency: number, decibels: number]>): Float32Array {
  const sampleRate = 44100;
  const fftSize = 8192;
  const frequencyData = new Float32Array(fftSize / 2);
  frequencyData.fill(-100);
  const binWidth = sampleRate / fftSize;

  peaks.forEach(([frequency, decibels]) => {
    frequencyData[Math.round(frequency / binWidth)] = decibels;
  });

  return frequencyData;
}
