import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SCENE } from "../src/scene.js";
import {
  pickObject,
  transformObject,
  removeObject,
} from "../src/manipulation.js";
import { backgroundPatch } from "../src/backgrounds.js";
const scene = () => ({
  ...DEFAULT_SCENE,
  shapes: [
    {
      id: "box",
      type: "rectangle",
      x: 0.5,
      y: 0.5,
      width: 0.2,
      height: 0.2,
      color: "#ffffff",
      label: "",
    },
  ],
  strokes: [],
});
test("selects user objects before decorative models", () => {
  assert.deepEqual(pickObject(scene(), [0.5, 0.5]), {
    kind: "shape",
    id: "box",
  });
  assert.deepEqual(pickObject(scene(), [0.85, 0.24]), { kind: "sphere" });
  assert.equal(
    pickObject({ ...scene(), sphere: false, arm: false }, [0.01, 0.01]),
    null,
  );
});
test("dragging keeps the original grab offset and preserves newer unrelated edits", () => {
  const base = scene(),
    current = { ...base, ink: "#abcabc", speed: 150 };
  const moved = transformObject(
    current,
    base,
    { kind: "shape", id: "box" },
    0.1,
    0.2,
  );
  assert.ok(Math.abs(moved.shapes[0].x - 0.6) < 1e-9);
  assert.ok(Math.abs(moved.shapes[0].y - 0.7) < 1e-9);
  assert.equal(moved.ink, current.ink);
  assert.equal(moved.speed, 150);
  assert.equal(base.shapes[0].x, 0.5);
});
test("two-hand scaling retains object aspect ratio and keeps geometry on the board", () => {
  const s = scene(),
    r = transformObject(s, s, { kind: "shape", id: "box" }, 0.8, 0.8, 2);
  assert.equal(r.shapes[0].width, 0.4);
  assert.equal(r.shapes[0].height, 0.4);
  assert.equal(r.shapes[0].x, 0.8);
  assert.equal(r.shapes[0].y, 0.8);
});
test("ink can be picked and moved as an intact stroke", () => {
  const s = {
    ...scene(),
    strokes: [
      {
        color: "#ffffff",
        points: [
          [0.1, 0.2],
          [0.3, 0.2],
        ],
      },
    ],
  };
  assert.deepEqual(pickObject(s, [0.2, 0.2]), { kind: "stroke", index: 0 });
  const r = transformObject(s, s, { kind: "stroke", index: 0 }, 0.2, 0.2);
  assert.ok(Math.abs(r.strokes[0].points[0][0] - 0.3) < 1e-9);
  assert.ok(Math.abs(r.strokes[0].points[1][1] - 0.4) < 1e-9);
});
test("background changes preserve ink, objects, and wall mapping", () => {
  const s = scene(),
    next = { ...s, ...backgroundPatch("guardian") };
  assert.equal(next.sphere, false);
  assert.equal(next.background, "guardian");
  assert.equal(next.shapes, s.shapes);
  assert.equal(next.quad, s.quad);
  assert.equal(next.strokes, s.strokes);
  assert.deepEqual(pickObject(next, [0.5, 0.44]), { kind: "shape", id: "box" });
});
test("remove only affects the selected object", () => {
  const s = scene();
  assert.equal(removeObject(s, { kind: "shape", id: "box" }).shapes.length, 0);
  assert.equal(removeObject(s, { kind: "sphere" }).sphere, false);
  assert.equal(removeObject(s, { kind: "sphere" }).arm, true);
});
