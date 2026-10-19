import { clamp } from "./geometry.js";
export function objectBounds(s, target) {
  if (!target) return null;
  if (target.kind === "cloud") {
    if (s.workspace !== "mapping" || !s.mapping.image) return null;
    return {
      x: 140 + s.mapping.offsetX * 1920,
      y: 100 + s.mapping.offsetY * 1080,
      width: 1640,
      height: 880,
      label: "Image point cloud",
    };
  }
  let cx, cy, w, h, label;
  if (target.kind === "shape") {
    const p = s.shapes.find((p) => p.id === target.id);
    if (!p) return null;
    cx = p.x * 1920;
    cy = p.y * 1080;
    w = p.width * 1920;
    h = p.height * 1080;
    label = p.label || p.type;
  } else if (target.kind === "stroke") {
    const p = s.strokes[target.index];
    if (!p?.points.length) return null;
    const xs = p.points.map((p) => p[0] * 1920),
      ys = p.points.map((p) => p[1] * 1080),
      x = Math.min(...xs),
      y = Math.min(...ys);
    w = Math.max(12, Math.max(...xs) - x);
    h = Math.max(12, Math.max(...ys) - y);
    cx = x + w / 2;
    cy = y + h / 2;
    label = "Ink stroke";
  } else if (target.kind === "sphere") {
    if (!s.sphere || s.board) return null;
    cx = (s.sphereX / 100) * 1920;
    cy = (s.sphereY / 100) * 1080;
    w = h = ((183 * s.scale) / 100) * 3.3;
    label = "Reactor core";
  } else if (target.kind === "arm") {
    if (!s.arm || s.board) return null;
    const k = s.armScale / 100;
    cx = (s.armX / 100) * 1920 + 70 * k;
    cy = (s.armY / 100) * 1080 - 125 * k;
    w = 470 * k;
    h = 530 * k;
    label = "Robot arm";
  } else if (target.kind === "artifact") {
    if (
      !s.hologram ||
      s.board ||
      !["guardian", "kinetic", "orbital", "constellation"].includes(
        s.background,
      )
    )
      return null;
    cx = (s.artifactX / 100) * 1920;
    cy = (s.artifactY / 100) * 1080;
    w = h = ((s.background === "kinetic" ? 510 : 660) * s.artifactScale) / 100;
    label = {
      guardian: "Guardian hand",
      kinetic: "Kinetic hand",
      orbital: "Orbital rings",
      constellation: "Constellation",
    }[s.background];
  } else return null;
  return { x: cx - w / 2, y: cy - h / 2, width: w, height: h, label };
}
function distance(p, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    len = dx * dx + dy * dy,
    t = len ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len, 0, 1) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
export function pickObject(s, point) {
  if (s.workspace === "mapping")
    return s.mapping.image ? { kind: "cloud" } : null;
  const [x, y] = [point[0] * 1920, point[1] * 1080];
  for (let i = s.strokes.length - 1; i >= 0; i--) {
    const pts = s.strokes[i].points.map(([x, y]) => [x * 1920, y * 1080]);
    if (pts.some((p, j) => distance([x, y], pts[Math.max(0, j - 1)], p) < 16))
      return { kind: "stroke", index: i };
  }
  for (const shape of [...s.shapes].reverse()) {
    const dx = (x / 1920 - shape.x) / (shape.width / 2),
      dy = (y / 1080 - shape.y) / (shape.height / 2);
    if (
      shape.type === "ellipse"
        ? dx * dx + dy * dy <= 1
        : Math.abs(dx) <= 1 && Math.abs(dy) <= 1
    )
      return { kind: "shape", id: shape.id };
  }
  for (const kind of ["sphere", "arm", "artifact"]) {
    const b = objectBounds(s, { kind });
    if (b && x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height)
      return { kind };
  }
  return null;
}
export function transformObject(current, base, target, dx, dy, factor = 1) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(factor))
    return current;
  factor = clamp(factor, 0.15, 5);
  if (target.kind === "cloud")
    return {
      ...current,
      mapping: {
        ...current.mapping,
        offsetX: clamp(base.mapping.offsetX + dx, -0.45, 0.45),
        offsetY: clamp(base.mapping.offsetY + dy, -0.45, 0.45),
        zoom: clamp(base.mapping.zoom * factor, 30, 180),
      },
    };
  if (target.kind === "shape") {
    const p = base.shapes.find((p) => p.id === target.id);
    if (!p) return current;
    const f = Math.min(factor, 0.98 / p.width, 0.98 / p.height),
      width = Math.max(0.015, p.width * f),
      height = Math.max(0.015, p.height * f);
    return {
      ...current,
      shapes: current.shapes.map((v) =>
        v.id === target.id
          ? {
              ...v,
              width,
              height,
              x: clamp(p.x + dx, width / 2, 1 - width / 2),
              y: clamp(p.y + dy, height / 2, 1 - height / 2),
            }
          : v,
      ),
    };
  }
  if (target.kind === "stroke") {
    const p = base.strokes[target.index];
    if (!p?.points.length || !current.strokes[target.index]) return current;
    const xs = p.points.map((p) => p[0]),
      ys = p.points.map((p) => p[1]),
      minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minY = Math.min(...ys),
      maxY = Math.max(...ys),
      cx = (minX + maxX) / 2,
      cy = (minY + maxY) / 2,
      f = Math.min(
        factor,
        0.98 / Math.max(maxX - minX, 0.001),
        0.98 / Math.max(maxY - minY, 0.001),
      );
    dx = clamp(dx, -cx + (cx - minX) * f, 1 - cx - (maxX - cx) * f);
    dy = clamp(dy, -cy + (cy - minY) * f, 1 - cy - (maxY - cy) * f);
    return {
      ...current,
      strokes: current.strokes.map((v, i) =>
        i === target.index
          ? {
              ...v,
              points: p.points.map(([x, y]) => [
                cx + (x - cx) * f + dx,
                cy + (y - cy) * f + dy,
              ]),
            }
          : v,
      ),
    };
  }
  const keys = {
    sphere: ["sphereX", "sphereY", "scale", 10, 90, 15, 85, 40, 180],
    arm: ["armX", "armY", "armScale", 5, 95, 20, 90, 30, 120],
    artifact: [
      "artifactX",
      "artifactY",
      "artifactScale",
      10,
      90,
      15,
      85,
      40,
      180,
    ],
  }[target.kind];
  if (!keys) return current;
  const [x, y, scale, x0, x1, y0, y1, s0, s1] = keys;
  return {
    ...current,
    [x]: clamp(base[x] + dx * 100, x0, x1),
    [y]: clamp(base[y] + dy * 100, y0, y1),
    [scale]: clamp(base[scale] * factor, s0, s1),
  };
}
export function removeObject(s, target) {
  if (target.kind === "shape")
    return { ...s, shapes: s.shapes.filter((v) => v.id !== target.id) };
  if (target.kind === "stroke")
    return { ...s, strokes: s.strokes.filter((_, i) => i !== target.index) };
  const key = { sphere: "sphere", arm: "arm", artifact: "hologram" }[
    target.kind
  ];
  return key ? { ...s, [key]: false } : s;
}
