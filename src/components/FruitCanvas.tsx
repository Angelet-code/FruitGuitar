import { useEffect, useMemo, useRef } from "react";
import { fruitImageUrls } from "../assets/fruits";
import type { ChordDetection } from "../types/chords";
import { GameEngine } from "../game/GameEngine";
import type { Fruit, FruitKind, GameSnapshot } from "../game/gameTypes";

interface FruitCanvasProps {
  engine: GameEngine;
  detection: ChordDetection;
  confidenceThreshold: number;
  onSnapshot: (snapshot: GameSnapshot) => void;
}

type FruitImages = Record<FruitKind, HTMLImageElement>;

export function FruitCanvas({ engine, detection, confidenceThreshold, onSnapshot }: FruitCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const images = useFruitImages();

  useEffect(() => {
    engine.handleDetection(detection, confidenceThreshold);
  }, [confidenceThreshold, detection, engine]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let frame = 0;
    let previous = performance.now();

    const render = (time: number) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const nextWidth = Math.max(1, Math.round(rect.width * dpr));
      const nextHeight = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }

      engine.resize(rect.width, rect.height);
      engine.step(time - previous);
      previous = time;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw(ctx, engine.getSnapshot(), images, rect.width, rect.height);
      }

      if (frame % 3 === 0) {
        onSnapshot(engine.getSnapshot());
      }
      frame += 1;
      requestId = requestAnimationFrame(render);
    };

    let requestId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(requestId);
  }, [engine, images, onSnapshot]);

  return <canvas ref={canvasRef} className="fruit-canvas" aria-label="Tablero de frutas" />;
}

function useFruitImages(): FruitImages {
  return useMemo(() => {
    return Object.entries(fruitImageUrls).reduce((images, [kind, url]) => {
      const image = new Image();
      image.src = url;
      images[kind as FruitKind] = image;
      return images;
    }, {} as FruitImages);
  }, []);
}

function draw(
  ctx: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  images: FruitImages,
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height);

  for (const fruit of snapshot.fruits) {
    drawFruit(ctx, fruit, images[fruit.kind]);
  }

  if (snapshot.status === "ready") {
    drawCenteredHint(ctx, width, height, "Press play");
  }
}

function drawFruit(ctx: CanvasRenderingContext2D, fruit: Fruit, image: HTMLImageElement): void {
  const fade = fruit.state === "cut" ? Math.max(0, 1 - fruit.cutAge / 520) : 1;
  const scale = fruit.state === "cut" ? 1 + fruit.cutAge / 900 : 1;
  const size = fruit.radius * 2.25 * scale;

  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(fruit.x, fruit.y);
  ctx.rotate(fruit.rotation);

  if (image.complete && image.naturalWidth > 0) {
    ctx.drawImage(image, -size / 2, -size / 2, size, size);
  }

  if (fruit.state === "cut") {
    drawSlice(ctx, fruit.radius, fruit.cutAge);
  }

  ctx.restore();

  if (fruit.state === "falling") {
    drawChordTag(ctx, fruit);
  }
}

function drawChordTag(ctx: CanvasRenderingContext2D, fruit: Fruit): void {
  const tagWidth = fruit.chord.length > 1 ? 94 : 78;
  const tagHeight = 54;
  const x = fruit.x - tagWidth / 2;
  const y = fruit.y - fruit.radius - 68;

  ctx.save();
  ctx.fillStyle = "rgba(255, 253, 247, 0.94)";
  ctx.strokeStyle = "#4f4c45";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x, y, tagWidth, tagHeight, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#46443f";
  ctx.font = "700 30px 'Trebuchet MS', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(fruit.chord, fruit.x, y + tagHeight / 2 + 1);
  ctx.restore();
}

function drawSlice(ctx: CanvasRenderingContext2D, radius: number, age: number): void {
  const progress = Math.min(1, age / 360);
  ctx.strokeStyle = `rgba(255, 255, 246, ${0.86 * (1 - progress)})`;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-radius * 0.78, radius * 0.5);
  ctx.lineTo(radius * 0.78, -radius * 0.5);
  ctx.stroke();

  ctx.strokeStyle = `rgba(113, 159, 90, ${0.45 * (1 - progress)})`;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawCenteredHint(ctx: CanvasRenderingContext2D, width: number, height: number, text: string): void {
  ctx.save();
  ctx.fillStyle = "rgba(75, 72, 66, 0.28)";
  ctx.font = "700 44px 'Trebuchet MS', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, height / 2);
  ctx.restore();
}
