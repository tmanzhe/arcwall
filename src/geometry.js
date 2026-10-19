// Homography: map a rectangular canvas onto any convex wall quadrilateral.
export const IDENTITY_QUAD = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export function solve(matrix, vector) {
  const rows = matrix.map((row, i) => [...row, vector[i]]);
  const n = rows.length;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let i = col + 1; i < n; i++)
      if (Math.abs(rows[i][col]) > Math.abs(rows[pivot][col])) pivot = i;
    if (Math.abs(rows[pivot][col]) < 1e-10)
      throw new Error(
        "Projection corners overlap or form a degenerate surface.",
      );
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const divisor = rows[col][col];
    rows[col] = rows[col].map((v) => v / divisor);
    for (let i = 0; i < n; i++) {
      if (i === col) continue;
      const factor = rows[i][col];
      rows[i] = rows[i].map((v, j) => v - factor * rows[col][j]);
    }
  }
  return rows.map((row) => row[n]);
}
export function homography(from, to) {
  const A = [],
    b = [];
  from.forEach(([x, y], i) => {
    const [u, v] = to[i];
    A.push(
      [x, y, 1, 0, 0, 0, -u * x, -u * y],
      [0, 0, 0, x, y, 1, -v * x, -v * y],
    );
    b.push(u, v);
  });
  return [...solve(A, b), 1];
}
export function project(h, x, y) {
  const d = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d];
}
export function validQuad(q) {
  if (
    !Array.isArray(q) ||
    q.length !== 4 ||
    !q.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        p.every((v) => Number.isFinite(v) && v >= 0 && v <= 1),
    )
  )
    return false;
  // Consistent positive winding prevents crossed corners and collapsed planes.
  return q.every((p, i) => {
    const a = q[(i + 1) % 4],
      b = q[(i + 2) % 4];
    return (
      (a[0] - p[0]) * (b[1] - a[1]) - (a[1] - p[1]) * (b[0] - a[0]) > 0.004
    );
  });
}
export function cssHomography(q, width, height) {
  const h = homography(
    [
      [0, 0],
      [width, 0],
      [width, height],
      [0, height],
    ],
    q.map(([x, y]) => [x * width, y * height]),
  );
  return `matrix3d(${[h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, 1].join(",")})`;
}
