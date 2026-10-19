import { PRESETS } from "./scene.js";
// The snapshot carries the ink. Send stroke counts, not thousands of duplicate coordinates.
export function sceneContext(scene) {
  return {
    ...scene,
    mapping: scene.mapping
      ? { ...scene.mapping, image: null, depth: null }
      : undefined,
    strokes: scene.strokes.map(({ color }) => ({ color, points: [] })),
  };
}
export const EDIT_RANGES = {
  brightness: [20, 100],
  speed: [0, 200],
  scale: [40, 180],
  sphereX: [10, 90],
  sphereY: [15, 85],
  armX: [5, 95],
  armY: [20, 90],
  armScale: [30, 120],
};
export function validateEdit(raw) {
  const edit = {};
  if (!raw || typeof raw !== "object") return edit;
  if (Object.hasOwn(PRESETS, raw.preset)) edit.preset = raw.preset;
  for (const [key, [lo, hi]] of Object.entries(EDIT_RANGES))
    if (Number.isFinite(raw[key]))
      edit[key] = Math.max(lo, Math.min(hi, raw[key]));
  for (const key of ["grid", "sphere", "arm", "telemetry"])
    if (typeof raw[key] === "boolean") edit[key] = raw[key];
  if (Array.isArray(raw.addShapes))
    edit.addShapes = raw.addShapes
      .slice(0, 10)
      .filter(
        (s) =>
          s &&
          ["rectangle", "ellipse"].includes(s.type) &&
          ["x", "y", "width", "height"].every((k) => Number.isFinite(s[k])),
      )
      .map((s) => ({
        type: s.type,
        x: Math.max(0, Math.min(1, s.x)),
        y: Math.max(0, Math.min(1, s.y)),
        width: Math.max(0.01, Math.min(1, s.width)),
        height: Math.max(0.01, Math.min(1, s.height)),
        color: /^#[\da-f]{6}$/i.test(s.color) ? s.color : "#8defff",
        label: typeof s.label === "string" ? s.label.slice(0, 60) : "",
      }));
  return edit;
}
export function localCommand(prompt, scene) {
  const p = prompt.toLowerCase(),
    edit = {};
  if (/\b(blue|cyan)\b/.test(p)) edit.preset = "arc";
  if (/\b(orange|amber|ember)\b/.test(p)) edit.preset = "ember";
  if (/\b(green|ghost|mint)\b/.test(p)) edit.preset = "ghost";
  if (/\b(bigger|larger|expand)\b/.test(p))
    edit.scale = Math.min(180, scene.scale + 25);
  if (/\b(smaller|shrink)\b/.test(p))
    edit.scale = Math.max(40, scene.scale - 25);
  if (/\b(slower|slow down)\b/.test(p))
    edit.speed = Math.max(0, scene.speed - 25);
  if (/\b(faster|speed up)\b/.test(p))
    edit.speed = Math.min(200, scene.speed + 25);
  for (const [word, key] of [
    ["grid", "grid"],
    ["sphere", "sphere"],
    ["core", "sphere"],
    ["arm", "arm"],
    ["telemetry", "telemetry"],
  ])
    if (p.includes(word)) {
      if (/\b(hide|remove|disable|off)\b/.test(p)) edit[key] = false;
      else if (/\b(show|enable|on)\b/.test(p)) edit[key] = true;
    }
  if (
    /\b(add|create)\b/.test(p) &&
    /\b(rectangle|box|ellipse|circle)\b/.test(p)
  )
    edit.addShapes = [
      {
        type: /\b(rectangle|box)\b/.test(p) ? "rectangle" : "ellipse",
        x: 0.5,
        y: 0.5,
        width: 0.2,
        height: 0.2,
        color: scene.ink,
        label: "",
      },
    ];
  return Object.keys(edit).length
    ? { message: "Applied your local scene command. Use Undo to revert.", edit }
    : null;
}
export const SCENE_TOOL = {
  type: "function",
  name: "update_scene",
  description:
    "Respond to the user and optionally edit the projection scene. Null fields stay unchanged. Shapes are added without deleting existing ink or objects.",
  strict: true,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      message: { type: "string" },
      preset: {
        type: ["string", "null"],
        enum: ["arc", "ember", "ghost", null],
      },
      ...Object.fromEntries(
        Object.keys(EDIT_RANGES).map((k) => [k, { type: ["number", "null"] }]),
      ),
      ...Object.fromEntries(
        ["grid", "sphere", "arm", "telemetry"].map((k) => [
          k,
          { type: ["boolean", "null"] },
        ]),
      ),
      addShapes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            type: { type: "string", enum: ["rectangle", "ellipse"] },
            x: { type: "number" },
            y: { type: "number" },
            width: { type: "number" },
            height: { type: "number" },
            color: { type: "string" },
            label: { type: "string" },
          },
          required: ["type", "x", "y", "width", "height", "color", "label"],
        },
      },
    },
    required: [
      "message",
      "preset",
      ...Object.keys(EDIT_RANGES),
      "grid",
      "sphere",
      "arm",
      "telemetry",
      "addShapes",
    ],
  },
};
