import test from "node:test";
import assert from "node:assert/strict";
import { eraseInk } from "../src/eraser.js";
const line = {
  color: "#ffffff",
  points: [
    [0.1, 0.5],
    [0.9, 0.5],
  ],
};
test("eraser splits a sparse line without reconnecting the gap", () => {
  const result = eraseInk([line], [0.5, 0.5], [0.5, 0.5], 40);
  assert.equal(result.length, 2);
  assert.ok(result[0].points.at(-1)[0] < 0.48);
  assert.ok(result[1].points[0][0] > 0.52);
  assert.deepEqual(line.points, [
    [0.1, 0.5],
    [0.9, 0.5],
  ]);
});
test("fast eraser sweeps remove ink between pointer samples", () => {
  const result = eraseInk([line], [0.3, 0.5], [0.7, 0.5], 25);
  assert.equal(result.length, 2);
  assert.ok(result[0].points.at(-1)[0] < 0.3);
  assert.ok(result[1].points[0][0] > 0.7);
});
test("eraser preserves untouched strokes and can remove dots completely", () => {
  const input = [line];
  assert.equal(eraseInk(input, [0.5, 0.1], [0.6, 0.1], 20), input);
  assert.deepEqual(
    eraseInk(
      [{ color: "#fff", points: [[0.5, 0.5]] }],
      [0.5, 0.5],
      [0.5, 0.5],
      10,
    ),
    [],
  );
});
