import { describe, expect, it } from "vitest";
import { GameEngine, spawnIntervalAt, spawnRateMultiplierAt } from "./GameEngine";

function detection(name: "A" | "C" | "G", timestamp = 1000) {
  return {
    name,
    confidence: 0.9,
    stable: true,
    timestamp,
  };
}

function sequenceRng(values: number[]) {
  let index = 0;
  return () => values[index++] ?? 0.5;
}

describe("GameEngine", () => {
  it("ramps spawn rate linearly and doubles it at 30 seconds", () => {
    expect(spawnRateMultiplierAt(0)).toBe(1);
    expect(spawnRateMultiplierAt(30000)).toBe(2);
    expect(spawnRateMultiplierAt(60000)).toBe(3);
    expect(spawnIntervalAt(2000, 30000)).toBe(1000);
    expect(spawnIntervalAt(2000, 60000)).toBeCloseTo(666.67, 2);
  });

  it("spawns fruit faster in each linear 30 second window", () => {
    const engine = new GameEngine({
      width: 600,
      height: 100000,
      spawnIntervalMs: 1000,
      rng: () => 0.5,
    });
    engine.reset();

    for (let time = 0; time < 30000; time += 80) {
      engine.step(80);
    }
    const firstThirtySeconds = engine.getSnapshot().fruits.length;

    for (let time = 0; time < 30000; time += 80) {
      engine.step(80);
    }
    const secondThirtySeconds = engine.getSnapshot().fruits.length - firstThirtySeconds;

    expect(firstThirtySeconds).toBeGreaterThanOrEqual(44);
    expect(firstThirtySeconds).toBeLessThanOrEqual(47);
    expect(secondThirtySeconds).toBeGreaterThanOrEqual(74);
    expect(secondThirtySeconds).toBeLessThanOrEqual(77);
  });

  it("adds a random +/-5% variation to spawned fruit velocity", () => {
    const baseVelocity = 74 + 0.5 * 54;
    const sharedSpawnValues = [0.5, 0.5, 0.5, 0.5];

    const slowEngine = new GameEngine({ rng: sequenceRng([...sharedSpawnValues, 0]) });
    const slowFruit = slowEngine.spawnFruit("A");

    const fastEngine = new GameEngine({ rng: sequenceRng([...sharedSpawnValues, 1]) });
    const fastFruit = fastEngine.spawnFruit("A");

    expect(slowFruit.velocity).toBeCloseTo(baseVelocity * 0.95, 4);
    expect(fastFruit.velocity).toBeCloseTo(baseVelocity * 1.05, 4);
  });

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
