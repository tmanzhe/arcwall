import test from "node:test";
import assert from "node:assert/strict";
import { localCommand, validateEdit, sceneContext } from "../src/agent.js";
import { DEFAULT_SCENE, applySceneEdit } from "../src/scene.js";
test("canvas context keeps scene objects and stroke counts without uploading raw point arrays", () => {
  const original = {
    ...DEFAULT_SCENE,
    strokes: [
      {
        color: "#abcdef",
        points: Array.from({ length: 100 }, () => [0.2, 0.3]),
      },
    ],
  };
  const context = sceneContext(original);
  assert.deepEqual(context.strokes, [{ color: "#abcdef", points: [] }]);
  assert.equal(context.strokes.length, original.strokes.length);
  assert.equal(original.strokes[0].points.length, 100);
  assert.equal(context.shapes, original.shapes);
});
test("local commands work without claiming to interpret drawings", () => {
  assert.deepEqual(
    localCommand("make the core bigger and turn it amber", DEFAULT_SCENE).edit,
    { preset: "ember", scale: DEFAULT_SCENE.scale + 25 },
  );
  assert.equal(localCommand("what did I draw?", DEFAULT_SCENE), null);
});
test("agent payloads cannot change calibration, strokes, or arbitrary properties", () => {
  const edit = validateEdit({
    scale: Infinity,
    speed: 999,
    quad: [[0, 0]],
    strokes: [],
    preset: "constructor",
    evil: true,
    grid: false,
  });
  assert.deepEqual(edit, { speed: 200, grid: false });
});
test("agent adds validated geometry without replacing existing shapes", () => {
  const edit = validateEdit({
    addShapes: [
      {
        type: "ellipse",
        x: 0.5,
        y: 0.5,
        width: 0.2,
        height: 0.2,
        color: "#aabbcc",
        label: "Core",
      },
      { type: "script", x: 1 },
    ],
  });
  const s = applySceneEdit(DEFAULT_SCENE, edit);
  assert.equal(s.shapes.length, 1);
  assert.equal(s.shapes[0].type, "ellipse");
  assert.equal(s.shapes[0].label, "Core");
});
