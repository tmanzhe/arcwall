import test from "node:test";
import assert from "node:assert/strict";
import {
  homography,
  project,
  IDENTITY_QUAD,
  validQuad,
  cssHomography,
} from "../src/geometry.js";
import { sanitizeScene, applySceneEdit, DEFAULT_SCENE } from "../src/scene.js";
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} ≉ ${b}`);
test("perspective mapping sends corners exactly to the wall and can be inverted", () => {
  const q = [
      [0.12, 0.08],
      [0.92, 0.2],
      [0.85, 0.88],
      [0.06, 0.95],
    ],
    h = homography(IDENTITY_QUAD, q),
    inv = homography(q, IDENTITY_QUAD);
  IDENTITY_QUAD.forEach((p, i) =>
    project(h, ...p).forEach((v, j) => close(v, q[i][j])),
  );
  for (const p of [
    [0.2, 0.8],
    [0.4, 0.3],
    [0.9, 0.9],
  ])
    project(inv, ...project(h, ...p)).forEach((v, i) => close(v, p[i]));
});
test("reject crossed, collapsed and out of range projection surfaces", () => {
  assert.ok(validQuad(IDENTITY_QUAD));
  assert.ok(
    !validQuad([
      [0, 0],
      [1, 1],
      [1, 0],
      [0, 1],
    ]),
  );
  assert.ok(
    !validQuad([
      [0, 0],
      [0, 0],
      [1, 1],
      [0, 1],
    ]),
  );
  assert.ok(
    !validQuad([
      [0, 0],
      [2, 0],
      [1, 1],
      [0, 1],
    ]),
  );
  assert.throws(() =>
    homography(
      [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
      ],
      IDENTITY_QUAD,
    ),
  );
});
test("identity produces a CSS identity matrix at any viewport", () =>
  assert.equal(
    cssHomography(IDENTITY_QUAD, 960, 540),
    "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)",
  ));
test("import sanitization limits untrusted geometry and preserves valid ink", () => {
  const s = sanitizeScene({
    scale: 900,
    armX: -400,
    armY: 900,
    armScale: 900,
    preset: "__proto__",
    sphere: "yes",
    quad: [[0, 0]],
    ink: "red",
    strokes: [
      {
        color: "#ffffff",
        points: [
          [0.1, 0.2],
          [NaN, 0],
          [2, 0.1],
        ],
      },
    ],
  });
  assert.equal(s.scale, 180);
  assert.equal(s.armX, 5);
  assert.equal(s.armY, 90);
  assert.equal(s.armScale, 120);
  assert.equal(s.preset, "arc");
  assert.equal(s.sphere, true);
  assert.equal(s.ink, DEFAULT_SCENE.ink);
  assert.deepEqual(s.strokes[0].points, [[0.1, 0.2]]);
});
test("agent edits cannot replace ink or wall calibration", () => {
  const before = {
    ...DEFAULT_SCENE,
    strokes: [{ color: "#ffffff", points: [[0.2, 0.3]] }],
  };
  const after = applySceneEdit(before, {
    scale: 60,
    strokes: [],
    quad: [[0, 0]],
    ink: "#000000",
  });
  assert.equal(after.scale, 60);
  assert.deepEqual(after.strokes, before.strokes);
  assert.deepEqual(after.quad, before.quad);
  assert.equal(after.ink, before.ink);
});
