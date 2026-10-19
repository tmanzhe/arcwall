import { PRESETS } from "./scene.js";
import { renderArtifact } from "./backgrounds.js";
import { objectBounds } from "./manipulation.js";
const TAU = Math.PI * 2;
export class Renderer {
  constructor(canvas, getScene, getInteraction, onFps = () => {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.getScene = getScene;
    this.getInteraction = getInteraction;
    this.onFps = onFps;
    this.time = 0;
    this.last = 0;
    this.frames = 0;
    this.fpsTime = 0;
    this.alive = true;
    this.frame = this.frame.bind(this);
    this.raf = requestAnimationFrame(this.frame);
  }
  stop() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
  }
  frame(now) {
    if (!this.alive) return;
    const s = this.getScene(),
      delta = this.last ? Math.min(now - this.last, 70) : 16;
    this.last = now;
    if (!s.paused) this.time += (delta * 0.001 * s.speed) / 100;
    this.frames++;
    if (now - this.fpsTime > 1000) {
      this.onFps(Math.round((this.frames * 1000) / (now - this.fpsTime)));
      this.frames = 0;
      this.fpsTime = now;
    }
    this.render(s, this.getInteraction(), this.time);
    this.raf = requestAnimationFrame(this.frame);
  }
  render(s, interaction = {}, t = 0) {
    const c = this.ctx,
      W = 1920,
      H = 1080,
      color = PRESETS[s.preset];
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.shadowBlur = 0;
    c.fillStyle = "#000307";
    c.fillRect(0, 0, W, H);
    c.save();
    this.brightness = s.brightness / 100;
    c.globalAlpha = this.brightness;
    c.strokeStyle = color;
    c.fillStyle = color;
    c.lineWidth = 1;
    if (s.grid) this.grid(c, t, color);
    if (s.telemetry && !s.board) this.telemetry(c, t, color, interaction);
    if (s.sphere && !s.board)
      this.sphere(
        c,
        (s.sphereX / 100) * W,
        (s.sphereY / 100) * H,
        (183 * s.scale) / 100,
        t,
        color,
        interaction.pointer,
      );
    if (s.arm && !s.board)
      this.arm(
        c,
        (s.armX / 100) * W,
        (s.armY / 100) * H,
        t,
        color,
        interaction.pointer,
        s.armScale / 100,
      );
    renderArtifact(c, s, t, color, this.brightness);
    this.shapes(c, s.shapes || []);
    this.ink(c, s.strokes);
    if (interaction.activeStroke) this.ink(c, [interaction.activeStroke]);
    if (s.skeleton && interaction.hands)
      this.hands(c, interaction.hands, color);
    const selected = objectBounds(
      s,
      interaction.selected || interaction.hovered,
    );
    if (selected) {
      c.save();
      c.strokeStyle = interaction.grabbing ? "#f1d2ff" : "#c7b2ff";
      c.fillStyle = c.strokeStyle;
      c.globalAlpha = this.brightness * 0.85;
      c.lineWidth = 1.5;
      c.setLineDash(interaction.grabbing ? [] : [7, 5]);
      c.strokeRect(
        selected.x - 12,
        selected.y - 12,
        selected.width + 24,
        selected.height + 24,
      );
      c.setLineDash([]);
      this.text(
        c,
        selected.label.toUpperCase() +
          (interaction.grabbing ? " / MOVING" : " / GRAB TO MOVE"),
        selected.x - 12,
        Math.max(25, selected.y - 24),
        13,
        0.8,
      );
      c.restore();
    }
    if (interaction.pointer) {
      const [x, y] = interaction.pointer;
      c.save();
      c.translate(x * W, y * H);
      c.strokeStyle = interaction.pinching ? "#fff" : color;
      c.shadowColor = color;
      c.shadowBlur = 12;
      c.lineWidth = 2;
      c.beginPath();
      if (interaction.eraser) {
        c.lineWidth = 1.5;
        c.setLineDash([7, 5]);
        c.arc(0, 0, interaction.eraser, 0, TAU);
        c.stroke();
        c.setLineDash([]);
        c.restore();
        c.restore();
        return;
      }
      c.arc(0, 0, interaction.pinching ? 12 : 23, 0, TAU);
      c.stroke();
      for (let i = 0; i < 4; i++) {
        c.rotate(Math.PI / 2);
        c.beginPath();
        c.moveTo(28, 0);
        c.lineTo(40, 0);
        c.stroke();
      }
      c.restore();
    }
    c.restore();
  }
  line(c, pts) {
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
  }
  text(c, txt, x, y, size = 14, alpha = 0.6) {
    c.save();
    c.globalAlpha *= alpha;
    c.font = `${size}px monospace`;
    c.fillText(txt, x, y);
    c.restore();
  }
  grid(c, t, color) {
    c.save();
    c.strokeStyle = color;
    c.lineWidth = 0.8;
    for (let x = 0; x < 1920; x += 60) {
      c.globalAlpha = this.brightness * 0.1;
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, 1080);
      c.stroke();
    }
    for (let y = 0; y < 1080; y += 60) {
      c.globalAlpha = this.brightness * 0.1;
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(1920, y);
      c.stroke();
    }
    c.globalAlpha = this.brightness * 0.4;
    for (let x = 60; x < 1920; x += 180)
      for (let y = 60; y < 1080; y += 180) {
        this.line(c, [
          [x - 5, y],
          [x + 5, y],
        ]);
        this.line(c, [
          [x, y - 5],
          [x, y + 5],
        ]);
      }
    const scan = ((t * 95) % 1200) - 60;
    const g = c.createLinearGradient(0, scan - 60, 0, scan + 5);
    g.addColorStop(0, "transparent");
    g.addColorStop(1, color + "26");
    c.fillStyle = g;
    c.globalAlpha = this.brightness * 0.5;
    c.fillRect(0, scan - 60, 1920, 65);
    c.globalAlpha = this.brightness * 0.35;
    c.strokeRect(38, 38, 1844, 1004);
    for (const [x, y, dx, dy] of [
      [38, 38, 1, 1],
      [1882, 38, -1, 1],
      [38, 1042, 1, -1],
      [1882, 1042, -1, -1],
    ]) {
      c.lineWidth = 3;
      this.line(c, [
        [x, y + dy * 30],
        [x, y],
        [x + dx * 30, y],
      ]);
    }
    c.restore();
  }
  sphere(c, cx, cy, r, t, color, pointer) {
    c.save();
    c.translate(cx, cy);
    const spin = t * 0.22 + (pointer ? (pointer[0] - 0.5) * 0.4 : 0),
      tilt = 0.25 + Math.sin(t * 0.3) * 0.2,
      pulse = 1 + Math.sin(t * 1.2) * 0.045;
    r *= pulse;
    const point = (x, y, z) => {
      const a = x * Math.cos(spin) + z * Math.sin(spin),
        b = -x * Math.sin(spin) + z * Math.cos(spin),
        v = y * Math.cos(tilt) - b * Math.sin(tilt),
        d = y * Math.sin(tilt) + b * Math.cos(tilt),
        pers = 3 / (3 - d * 0.25);
      return [a * r * pers, v * r * pers, d];
    };
    c.strokeStyle = color;
    c.lineWidth = 1.3;
    for (
      let lat = -Math.PI / 2 + 0.15;
      lat < Math.PI / 2;
      lat += Math.PI / 12
    ) {
      const pts = [];
      for (let a = 0; a <= TAU + 0.05; a += 0.04)
        pts.push(
          point(
            Math.cos(lat) * Math.cos(a),
            Math.sin(lat),
            Math.cos(lat) * Math.sin(a),
          ),
        );
      c.globalAlpha = this.brightness * 0.3;
      this.line(c, pts);
    }
    for (let lon = 0; lon < TAU; lon += Math.PI / 12) {
      const pts = [];
      for (let a = 0; a <= TAU + 0.05; a += 0.04)
        pts.push(
          point(
            Math.cos(a) * Math.cos(lon),
            Math.sin(a),
            Math.cos(a) * Math.sin(lon),
          ),
        );
      c.globalAlpha = this.brightness * 0.22;
      this.line(c, pts);
    }
    for (let i = 0; i < 145; i++) {
      const a = i * 2.39996,
        y = 1 - (2 * i) / 144,
        k = Math.sqrt(1 - y * y);
      const p = point(k * Math.cos(a), y, k * Math.sin(a));
      c.globalAlpha = this.brightness * (0.3 + (p[2] + 1) * 0.32);
      c.beginPath();
      c.arc(p[0], p[1], p[2] > 0.2 ? 2.6 : 1.4, 0, TAU);
      c.fill();
    }
    c.shadowColor = color;
    c.shadowBlur = 16;
    c.globalAlpha = this.brightness * 0.85;
    c.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      c.save();
      c.rotate(t * (i % 2 ? -0.15 : 0.12) + i * 1.7);
      c.beginPath();
      c.ellipse(
        0,
        0,
        r * (1.22 + i * 0.12),
        r * (0.35 + i * 0.09),
        i * 0.7,
        0,
        TAU * 0.86,
      );
      c.stroke();
      c.restore();
    }
    c.shadowBlur = 0;
    c.globalAlpha = this.brightness * 0.5;
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * TAU;
      c.beginPath();
      c.moveTo(Math.cos(a) * r * 1.54, Math.sin(a) * r * 1.54);
      c.lineTo(
        Math.cos(a) * r * (i % 5 ? 1.57 : 1.62),
        Math.sin(a) * r * (i % 5 ? 1.57 : 1.62),
      );
      c.stroke();
    }
    const glow = c.createRadialGradient(0, 0, 0, 0, 0, r * 0.75);
    glow.addColorStop(0, color + "38");
    glow.addColorStop(1, color + "00");
    c.fillStyle = glow;
    c.fillRect(-r, -r, r * 2, r * 2);
    c.fillStyle = color;
    this.text(c, "A R C  /  C O R E", -73, r * 1.9, 14, 0.9);
    this.text(c, "NEURAL FIELD · STABLE", -86, r * 1.9 + 25, 11, 0.5);
    c.restore();
  }
  arm(c, x, y, t, color, pointer, scale = 1) {
    c.save();
    c.translate(x, y);
    c.scale(scale, scale);
    c.strokeStyle = color;
    c.fillStyle = color;
    const a =
        -1.25 +
        Math.sin(t * 0.7) * 0.3 +
        (pointer ? (pointer[0] - 0.5) * 0.35 : 0),
      b = a + 0.9 + Math.sin(t * 0.9) * 0.4;
    const p0 = [0, 0],
      p1 = [Math.cos(a) * 175, Math.sin(a) * 175],
      p2 = [p1[0] + Math.cos(b) * 150, p1[1] + Math.sin(b) * 150],
      p3 = [p2[0] + Math.cos(b - 1) * 67, p2[1] + Math.sin(b - 1) * 67];
    c.globalAlpha = this.brightness * 0.45;
    c.beginPath();
    c.ellipse(0, 30, 125, 37, 0, 0, TAU);
    c.stroke();
    c.beginPath();
    c.ellipse(0, 30, 102, 23, 0, 0, TAU);
    c.stroke();
    for (const [u, v, w] of [
      [p0, p1, 26],
      [p1, p2, 20],
      [p2, p3, 12],
    ]) {
      const dx = v[0] - u[0],
        dy = v[1] - u[1],
        l = Math.hypot(dx, dy),
        nx = ((-dy / l) * w) / 2,
        ny = ((dx / l) * w) / 2;
      c.globalAlpha = this.brightness * 0.8;
      c.lineWidth = 2;
      this.line(c, [
        [u[0] + nx, u[1] + ny],
        [v[0] + nx, v[1] + ny],
        [v[0] - nx, v[1] - ny],
        [u[0] - nx, u[1] - ny],
        [u[0] + nx, u[1] + ny],
      ]);
      c.globalAlpha = this.brightness * 0.25;
      this.line(c, [u, v]);
    }
    for (const [i, p] of [p0, p1, p2, p3].entries()) {
      c.globalAlpha = this.brightness * 0.85;
      c.shadowColor = color;
      c.shadowBlur = 8;
      c.beginPath();
      c.arc(...p, i === 3 ? 8 : 17 - i * 3, 0, TAU);
      c.stroke();
      c.shadowBlur = 0;
      c.beginPath();
      c.arc(...p, 4, 0, TAU);
      c.fill();
    }
    c.globalAlpha = this.brightness * 0.75;
    c.save();
    c.translate(...p3);
    c.rotate(b - 1);
    for (const sign of [-1, 1])
      this.line(c, [
        [0, 0],
        [20, sign * 19],
        [43, sign * 19],
        [48, sign * 9],
      ]);
    c.restore();
    c.setLineDash([4, 8]);
    c.globalAlpha = this.brightness * 0.15;
    c.beginPath();
    c.arc(0, 0, 330, Math.PI, TAU);
    c.stroke();
    c.setLineDash([]);
    this.text(c, "D U M – E   /   K I N E M A T I C S", -140, 125, 13, 0.8);
    this.text(
      c,
      `J1 ${((a * 180) / Math.PI).toFixed(1)}°    J2 ${((b * 180) / Math.PI).toFixed(1)}°`,
      -110,
      150,
      11,
      0.5,
    );
    c.restore();
  }
  telemetry(c, t, color, interaction) {
    c.save();
    c.fillStyle = color;
    c.strokeStyle = color;
    this.text(c, "A R C W A L L   /   S P A T I A L   O S", 75, 89, 20, 0.9);
    this.text(c, "EXPERIMENTAL INTERFACE  //  LOCAL SESSION", 75, 117, 12, 0.5);
    this.text(c, "VISION LINK", 75, 198, 12, 0.5);
    this.text(
      c,
      interaction.hands?.length ? "TRACKING ACTIVE" : "AWAITING INPUT",
      75,
      232,
      21,
      0.9,
    );
    for (let i = 0; i < 46; i++) {
      const h =
        8 + Math.abs(Math.sin(i * 0.4 + t * 2) * Math.cos(i * 0.7 - t)) * 50;
      c.globalAlpha = this.brightness * (0.3 + (i % 3) * 0.12);
      c.fillRect(75 + i * 7, 307 - h, 3, h);
    }
    this.text(c, "SIGNAL / 08.24", 75, 332, 10, 0.4);
    const y = 920;
    c.globalAlpha = this.brightness * 0.25;
    this.line(c, [
      [75, y],
      [1845, y],
    ]);
    const labels = ["REACTOR OUTPUT", "FIELD INTEGRITY", "INPUT CHANNEL"];
    const values = [
      `${(98.4 + Math.sin(t) * 0.6).toFixed(1)} %`,
      "NOMINAL",
      interaction.hands?.length ? "VISION / GESTURE" : "POINTER / MANUAL",
    ];
    labels.forEach((label, i) => {
      this.text(c, label, 80 + i * 590, y + 35, 11, 0.5);
      this.text(c, values[i], 80 + i * 590, y + 70, 21, 0.85);
    });
    this.text(c, "PROJECTION ENGINE / V0.1", 75, 1018, 10, 0.35);
    this.text(
      c,
      `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}  /  SESSION`,
      1650,
      1018,
      10,
      0.5,
    );
    c.restore();
  }
  ink(c, strokes) {
    for (const s of strokes) {
      if (!s.points.length) continue;
      c.save();
      c.strokeStyle = s.color;
      c.fillStyle = s.color;
      c.lineWidth = 3;
      c.lineCap = "round";
      c.lineJoin = "round";
      c.shadowColor = s.color;
      c.shadowBlur = 10;
      this.line(
        c,
        s.points.map(([x, y]) => [x * 1920, y * 1080]),
      );
      if (s.points.length === 1) {
        c.beginPath();
        c.arc(s.points[0][0] * 1920, s.points[0][1] * 1080, 2, 0, TAU);
        c.fill();
      }
      c.restore();
    }
  }
  shapes(c, shapes) {
    for (const s of shapes) {
      c.save();
      c.strokeStyle = s.color;
      c.fillStyle = s.color;
      c.shadowColor = s.color;
      c.shadowBlur = 10;
      c.lineWidth = 2;
      const x = s.x * 1920,
        y = s.y * 1080,
        w = s.width * 1920,
        h = s.height * 1080;
      c.beginPath();
      if (s.type === "ellipse") c.ellipse(x, y, w / 2, h / 2, 0, 0, TAU);
      else c.rect(x - w / 2, y - h / 2, w, h);
      c.stroke();
      c.shadowBlur = 0;
      if (s.label) this.text(c, s.label, x - w / 2, y - h / 2 - 12, 13, 0.8);
      c.restore();
    }
  }
  hands(c, hands, color) {
    const edges = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [0, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      [5, 9],
      [9, 10],
      [10, 11],
      [11, 12],
      [9, 13],
      [13, 14],
      [14, 15],
      [15, 16],
      [13, 17],
      [0, 17],
      [17, 18],
      [18, 19],
      [19, 20],
    ];
    c.save();
    c.strokeStyle = color;
    c.fillStyle = color;
    c.globalAlpha = this.brightness * 0.65;
    c.lineWidth = 2;
    for (const hand of hands) {
      for (const [a, b] of edges)
        this.line(c, [
          [hand[a][0] * 1920, hand[a][1] * 1080],
          [hand[b][0] * 1920, hand[b][1] * 1080],
        ]);
      for (const p of hand) {
        c.beginPath();
        c.arc(p[0] * 1920, p[1] * 1080, 3, 0, TAU);
        c.fill();
      }
    }
    c.restore();
  }
}
