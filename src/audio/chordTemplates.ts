import type { ChordName, ChordTemplate, ChromaVector } from "../types/chords";

const NOTE_COUNT = 12;

export const CHORD_TEMPLATES: Record<ChordName, ChordTemplate> = {
  A: { name: "A", pitchClasses: [9, 1, 4], weights: { 9: 1.25, 1: 1, 4: 1.15 } },
  C: { name: "C", pitchClasses: [0, 4, 7], weights: { 0: 1.25, 4: 1, 7: 1.15 } },
  D: { name: "D", pitchClasses: [2, 6, 9], weights: { 2: 1.25, 6: 1, 9: 1.15 } },
  E: { name: "E", pitchClasses: [4, 8, 11], weights: { 4: 1.3, 8: 1, 11: 1.1 } },
  F: { name: "F", pitchClasses: [5, 9, 0], weights: { 5: 1.25, 9: 1, 0: 1.15 } },
  G: { name: "G", pitchClasses: [7, 11, 2], weights: { 7: 1.3, 11: 1, 2: 1.1 } },
  Am: { name: "Am", pitchClasses: [9, 0, 4], weights: { 9: 1.25, 0: 1, 4: 1.15 } },
  Dm: { name: "Dm", pitchClasses: [2, 5, 9], weights: { 2: 1.25, 5: 1, 9: 1.15 } },
  Em: { name: "Em", pitchClasses: [4, 7, 11], weights: { 4: 1.3, 7: 1, 11: 1.1 } },
};

export function emptyChroma(): ChromaVector {
  return Array.from({ length: NOTE_COUNT }, () => 0) as ChromaVector;
}

export function chromaForChord(name: ChordName, value = 1): ChromaVector {
  const chroma = emptyChroma();
  const template = CHORD_TEMPLATES[name];
  template.pitchClasses.forEach((pitchClass) => {
    chroma[pitchClass] = value * (template.weights[pitchClass] ?? 1);
  });
  return normalizeChroma(chroma);
}

export function normalizeChroma(chroma: ChromaVector): ChromaVector {
  const magnitude = Math.sqrt(chroma.reduce((total, value) => total + value * value, 0));
  if (magnitude === 0) return emptyChroma();
  return chroma.map((value) => value / magnitude) as ChromaVector;
}
