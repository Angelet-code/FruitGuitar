import { describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine";

function detection(name: "A" | "C" | "G", timestamp = 1000) {
  return {
    name,
    confidence: 0.9,
    stable: true,
    timestamp,
  };
}

describe("GameEngine", () => {
  it("cuts a matching fruit and adds points", () => {
    const engine = new GameEngine({ width: 600, height: 600, rng: () => 0.5 });
    engine.reset();
    engine.spawnFruit("G");

    const didCut = engine.handleDetection(detection("G"));
    const snapshot = engine.getSnapshot();

    expect(didCut).toBe(true);
    expect(snapshot.score).toBe(11);
    expect(snapshot.fruits[0].state).toBe("cut");
  });

  it("ignores unstable detections", () => {
    const engine = new GameEngine({ rng: () => 0.5 });
    engine.reset();
    engine.spawnFruit("C");

    const didCut = engine.handleDetection({
      name: "C",
      confidence: 0.95,
      stable: false,
      timestamp: 1000,
    });

    expect(didCut).toBe(false);
    expect(engine.getSnapshot().score).toBe(0);
  });

  it("loses a life when a fruit falls below the board", () => {
    const engine = new GameEngine({ width: 320, height: 320, rng: () => 0.5 });
    engine.reset();
    const fruit = engine.spawnFruit("A");
    fruit.y = 420;

    engine.step(16);

    expect(engine.getSnapshot().lives).toBe(4);
  });

  it("reaches game over after all lives are missed", () => {
    const engine = new GameEngine({ width: 320, height: 320, maxLives: 1, rng: () => 0.5 });
    engine.reset();
    const fruit = engine.spawnFruit("A");
    fruit.y = 420;

    engine.step(16);

    expect(engine.getSnapshot().status).toBe("gameOver");
  });

  it("prevents accidental double cuts on the same chord", () => {
    const engine = new GameEngine({ rng: () => 0.5 });
    engine.reset();
    engine.spawnFruit("G");
    engine.spawnFruit("G");

    expect(engine.handleDetection(detection("G", 1000))).toBe(true);
    expect(engine.handleDetection(detection("G", 1200))).toBe(false);
    expect(engine.getSnapshot().score).toBe(11);
  });
});
