export const CHORD_NAMES = ["A", "C", "D", "E", "F", "G", "Am", "Dm", "Em"] as const;

export type ChordName = (typeof CHORD_NAMES)[number];

export type ChromaVector = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export interface ChordDetection {
  name: ChordName | null;
  confidence: number;
  rms: number;
  rawRms: number;
  trimGain: number;
  chroma: ChromaVector;
  timestamp: number;
  stable: boolean;
}

export interface ChordTemplate {
  name: ChordName;
  pitchClasses: number[];
  weights: Partial<Record<number, number>>;
}
