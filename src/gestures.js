import { clamp } from "./geometry.js";
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export class GestureInterpreter {
  constructor() {
    this.pointer = null;
    this.pinching = false;
    this.scaleBaseline = null;
  }
  interpret(rawHands, scene) {
    const hands = rawHands.map((hand) => hand.map((p) => [1 - p.x, p.y]));
    if (!hands.length) {
      this.pointer = null;
      this.pinching = false;
      this.scaleBaseline = null;
      return {
        hands: [],
        pointer: null,
        pinching: false,
        scale: null,
        gesture: "Looking for hands…",
      };
    }
    const hand = hands[0],
      palm = Math.max(distance(hand[0], hand[9]), 0.03),
      ratio = distance(hand[4], hand[8]) / palm,
      threshold = scene.sensitivity / 100;
    this.pinching = ratio < (this.pinching ? threshold + 0.1 : threshold);
    const target = hand[8];
    this.pointer = this.pointer
      ? this.pointer.map((v, i) => v + (target[i] - v) * 0.4)
      : target;
    let scale = null,
      gesture = this.pinching ? "PINCH / DRAW" : "POINT / AIM";
    if (hands.length === 2) {
      const palms = hands.map((h) => Math.max(distance(h[0], h[9]), 0.03));
      const open = hands.every(
        (h, i) =>
          distance(h[4], h[8]) / palms[i] > 0.6 &&
          distance(h[0], h[12]) > palms[i] * 1.35,
      );
      if (open) {
        const span = distance(hands[0][9], hands[1][9]);
        if (!this.scaleBaseline)
          this.scaleBaseline = {
            span: Math.max(span, 0.05),
            scale: scene.scale,
          };
        scale = clamp(
          (this.scaleBaseline.scale * span) / this.scaleBaseline.span,
          40,
          180,
        );
        this.pinching = false;
        gesture = "TWO HANDS / RESIZE";
      } else this.scaleBaseline = null;
    } else this.scaleBaseline = null;
    return {
      hands,
      pointer: this.pointer.map((v) => clamp(v, 0, 1)),
      pinching: this.pinching,
      scale,
      gesture,
    };
  }
}
