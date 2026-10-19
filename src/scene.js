import { validQuad, IDENTITY_QUAD } from "./geometry.js";
export const PRESETS = { arc: "#70e4ff", ember: "#ffb964", ghost: "#9dffd4" };
export const CORNER_LAYOUT = {
  scale: 68,
  sphereX: 85,
  sphereY: 24,
  armX: 13,
  armY: 74,
  armScale: 65,
};
export const DEFAULT_SCENE = {
  preset: "arc",
  brightness: 85,
  speed: 100,
  grid: true,
  sphere: true,
  arm: true,
  telemetry: true,
  ...CORNER_LAYOUT,
  skeleton: true,
  sensitivity: 35,
  ink: "#8defff",
  paused: false,
  board: false,
  quad: IDENTITY_QUAD,
  strokes: [],
  shapes: [],
};
const ranges = {
  brightness: [20, 100],
  speed: [0, 200],
  scale: [40, 180],
  sphereX: [10, 90],
  sphereY: [15, 85],
  armX: [5, 95],
  armY: [20, 90],
  armScale: [30, 120],
  sensitivity: [15, 65],
};
export function sanitizeScene(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Invalid scene file.");
  const s = { ...DEFAULT_SCENE };
  if (Object.hasOwn(PRESETS, raw.preset)) s.preset = raw.preset;
  for (const [k, [lo, hi]] of Object.entries(ranges))
    if (Number.isFinite(raw[k])) s[k] = Math.max(lo, Math.min(hi, raw[k]));
  for (const k of [
    "grid",
    "sphere",
    "arm",
    "telemetry",
    "skeleton",
    "paused",
    "board",
  ])
    if (typeof raw[k] === "boolean") s[k] = raw[k];
  if (/^#[\da-f]{6}$/i.test(raw.ink)) s.ink = raw.ink;
  if (validQuad(raw.quad)) s.quad = raw.quad.map((p) => [...p]);
  if (Array.isArray(raw.strokes))
    s.strokes = raw.strokes
      .slice(-300)
      .filter(
        (stroke) =>
          stroke &&
          /^#[\da-f]{6}$/i.test(stroke.color) &&
          Array.isArray(stroke.points),
      )
      .map((stroke) => ({
        color: stroke.color,
        points: stroke.points
          .slice(0, 3000)
          .filter(
            (p) =>
              Array.isArray(p) &&
              p.length === 2 &&
              p.every((v) => Number.isFinite(v) && v >= 0 && v <= 1),
          ),
      }));
  if (Array.isArray(raw.shapes))
    s.shapes = raw.shapes
      .slice(0, 40)
      .filter(
        (shape) =>
          shape &&
          ["rectangle", "ellipse"].includes(shape.type) &&
          ["x", "y", "width", "height"].every((k) => Number.isFinite(shape[k])),
      )
      .map((shape, i) => ({
        id: typeof shape.id === "string" ? shape.id.slice(0, 80) : `shape-${i}`,
        type: shape.type,
        x: Math.max(0, Math.min(1, shape.x)),
        y: Math.max(0, Math.min(1, shape.y)),
        width: Math.max(0.01, Math.min(1, shape.width)),
        height: Math.max(0.01, Math.min(1, shape.height)),
        color: /^#[\da-f]{6}$/i.test(shape.color) ? shape.color : "#8defff",
        label: typeof shape.label === "string" ? shape.label.slice(0, 60) : "",
      }));
  return s;
}
export function applySceneEdit(scene, edit) {
  const allowed = [
    "preset",
    "brightness",
    "speed",
    "grid",
    "sphere",
    "arm",
    "telemetry",
    "scale",
    "sphereX",
    "sphereY",
  ];
  const patch = Object.fromEntries(
    Object.entries(edit || {}).filter(([k]) => allowed.includes(k)),
  );
  if (Array.isArray(edit?.addShapes))
    patch.shapes = [
      ...(scene.shapes || []),
      ...edit.addShapes.map((shape, i) => ({
        ...shape,
        id: `agent-${Date.now()}-${i}`,
      })),
    ];
  return sanitizeScene({ ...scene, ...patch });
}
