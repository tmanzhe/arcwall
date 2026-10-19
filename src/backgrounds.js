export const BACKGROUNDS = {
  arc: {
    name: "Arc lab",
    description: "Reactor, robotics, and a spatial grid",
    icon: "layers",
    values: {
      sphere: true,
      arm: true,
      telemetry: true,
      grid: true,
      hologram: false,
    },
  },
  guardian: {
    name: "Guardian hand",
    description: "A celestial palm suspended in light",
    icon: "hand",
    values: {
      sphere: false,
      arm: false,
      telemetry: false,
      grid: false,
      hologram: true,
    },
  },
  kinetic: {
    name: "Kinetic hand",
    description: "Articulated fingers, always in motion",
    icon: "hand",
    values: {
      sphere: false,
      arm: false,
      telemetry: false,
      grid: true,
      hologram: true,
    },
  },
  orbital: {
    name: "Orbital",
    description: "Interlocking rings in a weightless field",
    icon: "spark",
    values: {
      sphere: false,
      arm: false,
      telemetry: false,
      grid: false,
      hologram: true,
    },
  },
  constellation: {
    name: "Constellation",
    description: "A slow-turning cloud of connected stars",
    icon: "spark",
    values: {
      sphere: false,
      arm: false,
      telemetry: false,
      grid: false,
      hologram: true,
    },
  },
  grid: {
    name: "Quiet grid",
    description: "An open surface for your ideas",
    icon: "board",
    values: {
      sphere: false,
      arm: false,
      telemetry: false,
      grid: true,
      hologram: false,
    },
  },
};
export function backgroundPatch(id) {
  if (!Object.hasOwn(BACKGROUNDS, id)) return {};
  return { background: id, board: false, ...BACKGROUNDS[id].values };
}
const TAU = Math.PI * 2;
export function renderArtifact(c, s, t, color, brightness) {
  if (
    !s.hologram ||
    s.board ||
    !["guardian", "kinetic", "orbital", "constellation"].includes(s.background)
  )
    return;
  const scale = s.artifactScale / 100;
  c.save();
  c.translate((s.artifactX / 100) * 1920, (s.artifactY / 100) * 1080);
  c.scale(scale, scale);
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 1.2;
  const angle = t * 0.23,
    tilt = 0.18 + Math.sin(t * 0.19) * 0.12;
  const project = ([x, y, z]) => {
    const a = x * Math.cos(angle) + z * Math.sin(angle),
      b = -x * Math.sin(angle) + z * Math.cos(angle),
      v = y * Math.cos(tilt) - b * Math.sin(tilt),
      d = y * Math.sin(tilt) + b * Math.cos(tilt),
      p = 750 / (750 - d);
    return [a * p, v * p, d];
  };
  const line = (points, alpha = 0.45) => {
    c.globalAlpha = brightness * alpha;
    c.beginPath();
    points
      .map(project)
      .forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
  };
  if (s.background === "guardian" || s.background === "kinetic") {
    // Volumetric palm: front/back contours joined by a triangulated wireframe.
    const palm = [
      [-62, 80, 0],
      [-75, -38, 0],
      [-51, -75, 0],
      [54, -75, 0],
      [78, -32, 0],
      [59, 85, 0],
      [27, 126, 0],
      [-29, 126, 0],
    ];
    for (const z of [-20, 20])
      line(
        [...palm, palm[0]].map(([x, y]) => [x, y, z]),
        0.75,
      );
    for (let i = 0; i < palm.length; i++) {
      const p = palm[i],
        q = palm[(i + 1) % palm.length];
      line(
        [
          [p[0], p[1], -20],
          [p[0], p[1], 20],
          [q[0], q[1], -20],
        ],
        0.2,
      );
    }
    for (let y = -45; y <= 100; y += 24)
      line(
        [
          [-60, y, 20],
          [60, y, 20],
        ],
        0.14,
      );
    const bases = [
        [-58, -54],
        [-25, -69],
        [10, -73],
        [44, -60],
      ],
      lengths = [
        [54, 43, 35],
        [68, 49, 37],
        [64, 46, 34],
        [49, 35, 28],
      ];
    bases.forEach(([x, y], finger) => {
      let last = [x, y, 0];
      const flex =
        s.background === "kinetic"
          ? (Math.sin(t * 1.15 + finger * 0.6) + 1) * 0.55
          : 0.1 + Math.sin(t * 0.5 + finger) * 0.055;
      for (let joint = 0; joint < 3; joint++) {
        const bend = flex * (joint + 1),
          length = lengths[finger][joint],
          next = [
            last[0] + (finger - 1.5) * length * 0.035,
            last[1] - Math.cos(bend) * length,
            last[2] + Math.sin(bend) * length,
          ];
        bone(last, next, 11 - joint * 2);
        last = next;
      }
    });
    let thumb = [-62, 29, 0];
    for (let i = 0; i < 3; i++) {
      const next = [
        thumb[0] - 26,
        thumb[1] - 24,
        thumb[2] + 12 + (s.background === "kinetic" ? Math.sin(t) * 7 : 0),
      ];
      bone(thumb, next, 12 - i * 2);
      thumb = next;
    }
    for (const x of [-29, 29])
      line(
        [
          [x, 126, -16],
          [x * 0.8, 180, -16],
          [x * 0.8, 180, 16],
          [x, 126, 16],
        ],
        0.5,
      );
    if (s.background === "guardian") {
      for (let i = 0; i < 3; i++) {
        const pts = [];
        for (let a = 0; a <= TAU + 0.03; a += 0.04)
          pts.push([
            Math.cos(a) * (240 + i * 27),
            Math.sin(a) * (240 + i * 27),
            -65 - i * 10,
          ]);
        line(pts, i === 1 ? 0.13 : 0.3);
      }
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * TAU + t * 0.08,
          r = i % 6 === 0 ? 326 : 316;
        line(
          [
            [Math.cos(a) * 306, Math.sin(a) * 306, -90],
            [Math.cos(a) * r, Math.sin(a) * r, -90],
          ],
          0.45,
        );
      }
    } else {
      const pts = [];
      for (let a = 0; a <= TAU + 0.03; a += 0.04)
        pts.push([Math.cos(a) * 230, 165, Math.sin(a) * 100]);
      line(pts, 0.22);
    }
    label(
      s.background === "guardian"
        ? "G U A R D I A N  /  H A N D"
        : "K I N E T I C  /  S T U D Y",
      s.background === "guardian" ? 355 : 250,
    );
  } else if (s.background === "orbital") {
    for (let ring = 0; ring < 7; ring++) {
      const points = [];
      for (let a = 0; a <= TAU + 0.03; a += 0.035) {
        const r = 160 + ring * 15,
          twist = ring * 0.39 + t * 0.12;
        points.push([
          Math.cos(a) * r,
          Math.sin(a) * r * Math.cos(twist),
          Math.sin(a) * r * Math.sin(twist),
        ]);
      }
      line(points, 0.25 + ring * 0.05);
    }
    for (let i = 0; i < 90; i++) {
      const a = i * 2.39996,
        r = 280 + Math.sin(i) * 26,
        p = project([
          Math.cos(a) * r,
          Math.sin(a) * r,
          Math.sin(i * 0.9) * 110,
        ]);
      c.globalAlpha = brightness * 0.6;
      c.beginPath();
      c.arc(p[0], p[1], i % 7 ? 1 : 2.5, 0, TAU);
      c.fill();
    }
    label("O R B I T A L  /  F I E L D", 350);
  } else {
    const stars = Array.from({ length: 105 }, (_, i) => {
      const a = i * 2.39996,
        y = 1 - (2 * i) / 104,
        r = Math.sqrt(1 - y * y);
      return [Math.cos(a) * r * 300, y * 270, Math.sin(a) * r * 230];
    });
    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++)
        if (Math.hypot(...stars[i].map((v, k) => v - stars[j][k])) < 99)
          line([stars[i], stars[j]], 0.14);
      const p = project(stars[i]);
      c.globalAlpha = brightness * (0.3 + (p[2] + 230) / 600);
      c.beginPath();
      c.arc(p[0], p[1], i % 9 ? 1.6 : 3, 0, TAU);
      c.fill();
    }
    label("C O N S T E L L A T I O N", 340);
  }
  c.restore();
  function bone(a, b, r) {
    const offsets = [
      [r, 0, 0],
      [0, 0, r],
      [-r, 0, 0],
      [0, 0, -r],
    ];
    for (let i = 0; i < 4; i++) {
      const u = offsets[i],
        v = offsets[(i + 1) % 4];
      line(
        [
          a.map((n, k) => n + u[k]),
          b.map((n, k) => n + u[k] * 0.68),
          b.map((n, k) => n + v[k] * 0.68),
          a.map((n, k) => n + v[k]),
          a.map((n, k) => n + u[k]),
        ],
        0.5,
      );
    }
    const p = project(a);
    c.globalAlpha = brightness * 0.8;
    c.beginPath();
    c.arc(p[0], p[1], 3.2, 0, TAU);
    c.fill();
  }
  function label(text, y) {
    c.globalAlpha = brightness * 0.4;
    c.font = "11px monospace";
    c.textAlign = "center";
    c.fillText(text, 0, y);
  }
}
