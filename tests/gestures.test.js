import test from "node:test";
import assert from "node:assert/strict";
import { GestureInterpreter } from "../src/gestures.js";
import { DEFAULT_SCENE } from "../src/scene.js";
function hand(x = 0.3) {
  const h = Array.from({ length: 21 }, () => ({ x, y: 0.5 }));
  h[0] = { x, y: 0.8 };
  h[9] = { x, y: 0.5 };
  h[8] = { x: x + 0.12, y: 0.3 };
  h[4] = { x: x - 0.12, y: 0.5 };
  h[12] = { x, y: 0.2 };
  return h;
}
test("mirrors camera coordinates and detects pinch with release hysteresis", () => {
  const g = new GestureInterpreter(),
    h = hand();
  let r = g.interpret([h], DEFAULT_SCENE);
  assert.equal(r.pinching, false);
  assert.ok(Math.abs(r.pointer[0] - 0.58) < 1e-9);
  h[4] = { ...h[8] };
  r = g.interpret([h], DEFAULT_SCENE);
  assert.equal(r.pinching, true);
  h[4] = { x: h[8].x + 0.12, y: h[8].y };
  assert.equal(g.interpret([h], DEFAULT_SCENE).pinching, true);
  h[4] = { x: h[8].x + 0.2, y: h[8].y };
  assert.equal(g.interpret([h], DEFAULT_SCENE).pinching, false);
});
test("tracking loss ends a stroke and resets the pointer", () => {
  const g = new GestureInterpreter();
  g.interpret([hand()], DEFAULT_SCENE);
  assert.deepEqual(g.interpret([], DEFAULT_SCENE), {
    hands: [],
    pointer: null,
    pinching: false,
    scale: null,
    gesture: "Looking for hands…",
  });
});
test("two open hands resize relative to the initial span and clamp scale", () => {
  const g = new GestureInterpreter();
  const a = hand(0.2),
    b = hand(0.6);
  assert.equal(g.interpret([a, b], DEFAULT_SCENE).scale, 100);
  const r = g.interpret([a, hand(0.8)], DEFAULT_SCENE);
  assert.ok(Math.abs(r.scale - 150) < 1e-7);
  assert.equal(r.pinching, false);
  assert.equal(g.interpret([hand(0), hand(1)], DEFAULT_SCENE).scale, 180);
});
