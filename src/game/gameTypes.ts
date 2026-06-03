import type { ChordDetection, ChordName } from "../types/chords";

export type GameStatus = "ready" | "running" | "paused" | "gameOver";

export type FruitKind =
  | "apple"
  | "kiwi"
  | "orange"
  | "watermelon"
  | "lemon"
  | "strawberry"
  | "pear"
  | "plum"
  | "banana";

export interface Fruit {
  id: string;
  chord: ChordName;
  kind: FruitKind;
  x: number;
  y: number;
  velocity: number;
  radius: number;
  rotation: number;
  spin: number;
  state: "falling" | "cut";
  cutAge: number;
}

export type GameEvent =
  | { type: "fruitCut"; fruit: Fruit; score: number }
  | { type: "fruitMissed"; fruit: Fruit; lives: number }
  | { type: "scoreChanged"; score: number }
  | { type: "lifeLost"; lives: number }
  | { type: "gameOver"; score: number };

export interface GameSnapshot {
  score: number;
  lives: number;
  maxLives: number;
  status: GameStatus;
  fruits: Fruit[];
  elapsedMs: number;
}

export interface DetectionLike extends Pick<ChordDetection, "name" | "confidence" | "timestamp" | "stable"> {}
