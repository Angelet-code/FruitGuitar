import { describe, expect, it } from "vitest";
import { chromaForChord, emptyChroma } from "./chordTemplates";
import { classifyChroma, matchChordTemplate } from "./RecognitionEngine";

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

  it("does not emit a chord for empty chroma noise", () => {
    const detection = classifyChroma(emptyChroma(), 0.04, 1000);

    expect(detection.name).toBeNull();
  });
});
