import { describe, expect, it } from "vitest";
import { chromaForChord, emptyChroma, normalizeChroma } from "./chordTemplates";
import { classifyChroma, computeRms, detectNoteFromWaveform, matchChordTemplate, spectrumToChroma } from "./RecognitionEngine";
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

  it("keeps the untrimmed RMS gate strict for quiet input", () => {
    const detection = classifyChroma(chromaForChord("C"), 0.008, 1000);

    expect(detection.name).toBeNull();
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

  it("uses trim gain to recover a quiet but clear spectrum", () => {
    const fftSize = 32768;
    const quietSpectrum = spectrumWithPeaks([
      [130.81, -98],
      [164.81, -97],
      [196, -98],
      [261.63, -99],
    ], fftSize);
    const untrimmed = spectrumToChroma(quietSpectrum, 44100, fftSize);
    const trimmed = spectrumToChroma(quietSpectrum, 44100, fftSize, 8);

    expect(untrimmed.every((energy) => energy === 0)).toBe(true);
    expect(matchChordTemplate(trimmed).name).toBe("C");
  });

  it("does not emit a chord for empty chroma noise", () => {
    const detection = classifyChroma(emptyChroma(), 0.04, 1000);

    expect(detection.name).toBeNull();
  });

  it("keeps chroma chord classification separate from note tuning", () => {
    const detection = classifyChroma(chromaForChord("E"), 0.04, 1000);

    expect(detection.name).toBe("E");
    expect(detection.note).toBeNull();
  });
});

describe("detectNoteFromWaveform", () => {
  it("detects a clean A guitar string as an individual note", () => {
    const samples = sineWave(110);
    const note = detectNoteFromWaveform(samples, 44100, computeRms(samples), 1000);

    expect(note?.name).toBe("A");
    expect(note?.octave).toBe(2);
    expect(note?.cents).toBeCloseTo(0, 0);
  });

  it("detects sharps for alternate tunings", () => {
    const notes = [
      [277.18, "C#"],
      [369.99, "F#"],
      [466.16, "A#"],
    ] as const;

    notes.forEach(([frequency, expected]) => {
      const samples = sineWave(frequency);
      const note = detectNoteFromWaveform(samples, 44100, computeRms(samples), 1000);

      expect(note?.name).toBe(expected);
      expect(Math.abs(note?.cents ?? 99)).toBeLessThan(2);
    });
  });

  it("covers low alternate guitar tunings", () => {
    const samples = sineWave(61.74);
    const note = detectNoteFromWaveform(samples, 44100, computeRms(samples), 1000);

    expect(note?.name).toBe("B");
    expect(note?.octave).toBe(1);
    expect(Math.abs(note?.cents ?? 99)).toBeLessThan(2);
  });

  it("stays silent for a signal below tuner floor", () => {
    const samples = sineWave(440, 0.001);

    expect(detectNoteFromWaveform(samples, 44100, computeRms(samples), 1000)).toBeNull();
  });
});

function chromaWith(entries: Array<[pitchClass: number, energy: number]>): ChromaVector {
  const chroma = emptyChroma();
  entries.forEach(([pitchClass, energy]) => {
    chroma[pitchClass] = energy;
  });
  return normalizeChroma(chroma);
}

function spectrumWithPeaks(peaks: Array<[frequency: number, decibels: number]>, fftSize = 8192): Float32Array {
  const sampleRate = 44100;
  const frequencyData = new Float32Array(fftSize / 2);
  frequencyData.fill(-100);
  const binWidth = sampleRate / fftSize;

  peaks.forEach(([frequency, decibels]) => {
    frequencyData[Math.round(frequency / binWidth)] = decibels;
  });

  return frequencyData;
}

function sineWave(frequency: number, amplitude = 0.45, sampleRate = 44100, length = 8192): Float32Array {
  const samples = new Float32Array(length);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.sin((index / sampleRate) * Math.PI * 2 * frequency) * amplitude;
  }
  return samples;
}
