import { CHORD_NAMES, type ChordName } from "../types/chords";
import type { DetectionLike, Fruit, FruitKind, GameEvent, GameSnapshot, GameStatus } from "./gameTypes";

interface GameEngineOptions {
  width?: number;
  height?: number;
  maxLives?: number;
  spawnIntervalMs?: number;
  spawnRateDoubleTimeMs?: number;
  rng?: () => number;
}

const FRUIT_KINDS: FruitKind[] = [
  "apple",
  "kiwi",
  "orange",
  "watermelon",
  "lemon",
  "strawberry",
  "pear",
  "plum",
  "banana",
];

export function spawnRateMultiplierAt(elapsedMs: number, doubleTimeMs = 30000): number {
  return 1 + Math.max(0, elapsedMs) / doubleTimeMs;
}

export function spawnIntervalAt(baseIntervalMs: number, elapsedMs: number, doubleTimeMs = 30000): number {
  return baseIntervalMs / spawnRateMultiplierAt(elapsedMs, doubleTimeMs);
}

export class GameEngine {
  private width: number;
  private height: number;
  private readonly maxLives: number;
  private readonly rng: () => number;
  private readonly events: GameEvent[] = [];
  private fruitCounter = 0;
  private spawnClock = 0;
  private elapsedMs = 0;
  private lastCutAt = -Infinity;
  private lastCutChord: ChordName | null = null;
  private readonly baseSpawnIntervalMs: number;
  private readonly spawnRateDoubleTimeMs: number;
  private fruits: Fruit[] = [];
  private score = 0;
  private lives: number;
  private status: GameStatus = "ready";

  constructor(options: GameEngineOptions = {}) {
    this.width = options.width ?? 900;
    this.height = options.height ?? 900;
    this.maxLives = options.maxLives ?? 5;
    this.lives = this.maxLives;
    this.baseSpawnIntervalMs = options.spawnIntervalMs ?? 1950;
    this.spawnRateDoubleTimeMs = options.spawnRateDoubleTimeMs ?? 30000;
    this.rng = options.rng ?? Math.random;
  }

  resize(width: number, height: number): void {
    this.width = Math.max(320, width);
    this.height = Math.max(320, height);
  }

  start(): void {
    if (this.status === "ready" || this.status === "paused") {
      this.status = "running";
    }
  }

  pause(): void {
    if (this.status === "running") {
      this.status = "paused";
    }
  }

  reset(): void {
    this.fruits = [];
    this.events.length = 0;
    this.score = 0;
    this.lives = this.maxLives;
    this.status = "running";
    this.elapsedMs = 0;
    this.spawnClock = this.baseSpawnIntervalMs * 0.7;
    this.lastCutAt = -Infinity;
    this.lastCutChord = null;
  }

  step(deltaMs: number): void {
    if (this.status !== "running") return;

    const safeDelta = Math.min(80, Math.max(0, deltaMs));
    this.elapsedMs += safeDelta;
    this.spawnClock += safeDelta;

    let currentSpawnInterval = this.getCurrentSpawnIntervalMs();
    while (this.spawnClock >= currentSpawnInterval) {
      this.spawnClock -= currentSpawnInterval;
      this.spawnFruit();
      currentSpawnInterval = this.getCurrentSpawnIntervalMs();
    }

    const deltaSeconds = safeDelta / 1000;
    const survivors: Fruit[] = [];

    for (const fruit of this.fruits) {
      if (fruit.state === "falling") {
        fruit.y += fruit.velocity * deltaSeconds;
        fruit.velocity += 17 * deltaSeconds;
        fruit.rotation += fruit.spin * deltaSeconds;

        if (fruit.y - fruit.radius > this.height + 18) {
          this.lives = Math.max(0, this.lives - 1);
          this.events.push({ type: "fruitMissed", fruit, lives: this.lives });
          this.events.push({ type: "lifeLost", lives: this.lives });
          if (this.lives === 0) {
            this.status = "gameOver";
            this.events.push({ type: "gameOver", score: this.score });
          }
          continue;
        }
      } else {
        fruit.cutAge += safeDelta;
        fruit.y -= 18 * deltaSeconds;
        fruit.rotation += fruit.spin * deltaSeconds * 1.5;
        if (fruit.cutAge > 520) continue;
      }

      survivors.push(fruit);
    }

    this.fruits = survivors;
  }

  spawnFruit(chord?: ChordName): Fruit {
    const radius = 48 + this.rng() * 18;
    const fruit: Fruit = {
      id: `fruit-${this.fruitCounter++}`,
      chord: chord ?? this.pickChord(),
      kind: FRUIT_KINDS[this.fruitCounter % FRUIT_KINDS.length],
      x: radius + this.rng() * Math.max(1, this.width - radius * 2),
      y: -radius - this.rng() * 90,
      velocity: 74 + this.rng() * 54 + Math.min(38, this.elapsedMs / 32000),
      radius,
      rotation: (this.rng() - 0.5) * 0.35,
      spin: (this.rng() - 0.5) * 0.72,
      state: "falling",
      cutAge: 0,
    };

    this.fruits.push(fruit);
    return fruit;
  }

  handleDetection(detection: DetectionLike, confidenceThreshold = 0.68): boolean {
    if (this.status !== "running") return false;
    if (!detection.name || detection.confidence < confidenceThreshold || !detection.stable) return false;

    const now = detection.timestamp;
    if (this.lastCutChord === detection.name && now - this.lastCutAt < 520) return false;

    const target = this.fruits
      .filter((fruit) => fruit.state === "falling" && fruit.chord === detection.name)
      .sort((a, b) => b.y - a.y)[0];

    if (!target) return false;

    target.state = "cut";
    target.cutAge = 0;
    target.velocity = -28;
    target.spin = target.spin >= 0 ? 1.4 : -1.4;
    this.score += 11;
    this.lastCutAt = now;
    this.lastCutChord = detection.name;
    this.events.push({ type: "fruitCut", fruit: target, score: this.score });
    this.events.push({ type: "scoreChanged", score: this.score });
    return true;
  }

  setPaused(paused: boolean): void {
    if (paused) {
      this.pause();
    } else {
      this.start();
    }
  }

  consumeEvents(): GameEvent[] {
    return this.events.splice(0, this.events.length);
  }

  getSnapshot(): GameSnapshot {
    return {
      score: this.score,
      lives: this.lives,
      maxLives: this.maxLives,
      status: this.status,
      fruits: this.fruits.map((fruit) => ({ ...fruit })),
      elapsedMs: this.elapsedMs,
    };
  }

  private pickChord(): ChordName {
    return CHORD_NAMES[Math.floor(this.rng() * CHORD_NAMES.length)];
  }

  private getCurrentSpawnIntervalMs(): number {
    return spawnIntervalAt(this.baseSpawnIntervalMs, this.elapsedMs, this.spawnRateDoubleTimeMs);
  }
}
