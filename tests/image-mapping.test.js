import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeMapping, motionFromBrief } from "../src/image-mapping.js";
import { sceneContext } from "../src/agent.js";
import { DEFAULT_SCENE } from "../src/scene.js";
test("image mapping rejects remote URLs and scripts while bounding render settings", () => {
  const m = sanitizeMapping({
    image: "https://example.com/private.jpg",
    depth: "data:image/svg+xml;base64,AAAA",
    density: 500,
    strength: -10,
    zoom: 999,
    motion: "execute",
  });
  assert.equal(m.image, null);
  assert.equal(m.depth, null);
  assert.equal(m.density, 180);
  assert.equal(m.strength, 0);
  assert.equal(m.zoom, 180);
  assert.equal(m.motion, "orbit");
});
test("motion briefs map camera movement and pacing without claiming video generation", () => {
  const m = motionFromBrief(
    "A slow orbit, neon colors, continuous 18 second shot",
  );
  assert.equal(m.motion, "orbit");
  assert.equal(m.motionSpeed, 20);
  assert.equal(m.duration, 18);
  assert.equal(m.colorMode, "cyan");
  assert.equal(motionFromBrief("Static hold, white particles").motion, "still");
});
test("agent context never embeds uploaded image assets when canvas sharing is off", () => {
  const context = sceneContext({
    ...DEFAULT_SCENE,
    mapping: {
      ...DEFAULT_SCENE.mapping,
      image: "private pixels",
      depth: "private depth",
    },
  });
  assert.equal(context.mapping.image, null);
  assert.equal(context.mapping.depth, null);
});
