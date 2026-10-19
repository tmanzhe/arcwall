// Sweep a circular brush through ink and split each stroke at its cuts.
const pixel = ([x, y]) => [x * 1920, y * 1080];
function distanceToSegment(p, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    d = dx * dx + dy * dy,
    t = d
      ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / d))
      : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
export function eraseInk(strokes, from, to, radius) {
  const a = pixel(from),
    b = pixel(to),
    r = Math.max(2, radius);
  let changed = false;
  const result = strokes.flatMap((stroke) => {
    if (!stroke.points.length) return [stroke];
    const samples = [stroke.points[0]];
    for (let i = 1; i < stroke.points.length; i++) {
      const u = stroke.points[i - 1],
        v = stroke.points[i],
        steps = Math.max(
          1,
          Math.ceil(
            Math.hypot((v[0] - u[0]) * 1920, (v[1] - u[1]) * 1080) / (r * 0.5),
          ),
        );
      for (let j = 1; j <= steps; j++)
        samples.push([
          u[0] + ((v[0] - u[0]) * j) / steps,
          u[1] + ((v[1] - u[1]) * j) / steps,
        ]);
    }
    if (!samples.some((p) => distanceToSegment(pixel(p), a, b) <= r))
      return [stroke];
    changed = true;
    const fragments = [];
    let current = [];
    for (const p of samples) {
      if (distanceToSegment(pixel(p), a, b) <= r) {
        if (current.length) fragments.push({ ...stroke, points: current });
        current = [];
      } else current.push(p);
    }
    if (current.length) fragments.push({ ...stroke, points: current });
    return fragments;
  });
  return changed ? result : strokes;
}
