import apple from "./apple.png";
import banana from "./banana.png";
import kiwi from "./kiwi.png";
import lemon from "./lemon.png";
import orange from "./orange.png";
import pear from "./pear.png";
import plum from "./plum.png";
import strawberry from "./strawberry.png";
import watermelon from "./watermelon.png";
import type { FruitKind } from "../../game/gameTypes";

export const fruitImageUrls: Record<FruitKind, string> = {
  apple,
  kiwi,
  orange,
  watermelon,
  lemon,
  strawberry,
  pear,
  plum,
  banana,
};
