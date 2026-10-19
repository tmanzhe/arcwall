import { clamp } from "./geometry.js";
export const DEFAULT_MAPPING = {
  image: null,
  depth: null,
  filename: "",
  depthSource: "luminance",
  strength: 80,
  pointSize: 2,
  density: 120,
  motion: "orbit",
  amount: 25,
  motionSpeed: 35,
  view: "particles",
  duration: 12,
  offsetX: 0,
  offsetY: 0,
  zoom: 100,
  prompt: "",
  colorMode: "original",
};
export function sanitizeMapping(raw) {
  const s = { ...DEFAULT_MAPPING };
  if (!raw || typeof raw !== "object") return s;
  for (const key of ["image", "depth"])
    if (
      typeof raw[key] === "string" &&
      raw[key].length <= 1200000 &&
      /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(raw[key])
    )
      s[key] = raw[key];
  for (const [k, lo, hi] of [
    ["strength", 0, 200],
    ["pointSize", 1, 7],
    ["density", 50, 180],
    ["amount", 0, 80],
    ["motionSpeed", 0, 100],
    ["duration", 4, 60],
    ["offsetX", -0.45, 0.45],
    ["offsetY", -0.45, 0.45],
    ["zoom", 30, 180],
  ])
    if (Number.isFinite(raw[k])) s[k] = clamp(raw[k], lo, hi);
  for (const [k, values] of [
    ["depthSource", ["luminance", "ai", "uploaded", "demo"]],
    ["motion", ["orbit", "push", "drift", "still"]],
    ["view", ["particles", "image", "depth"]],
    ["colorMode", ["original", "cyan", "white"]],
  ])
    if (values.includes(raw[k])) s[k] = raw[k];
  for (const [key, max] of [
    ["filename", 100],
    ["prompt", 1200],
  ])
    if (typeof raw[key] === "string") s[key] = raw[key].slice(0, max);
  return s;
}
export function motionFromBrief(text) {
  const p = text.toLowerCase(),
    patch = { prompt: text.slice(0, 1200) };
  if (/orbit|rotat/.test(p)) patch.motion = "orbit";
  else if (/push|zoom|close.?up/.test(p)) patch.motion = "push";
  else if (/pan|drift|tracking/.test(p)) patch.motion = "drift";
  else if (/static|still|hold/.test(p)) patch.motion = "still";
  if (/slow|gentle|calm/.test(p)) patch.motionSpeed = 20;
  if (/fast|high.energy|dynamic/.test(p)) patch.motionSpeed = 70;
  const duration = p.match(/\b(\d+)\s*(?:s\b|sec|second)/);
  if (duration) patch.duration = clamp(Number(duration[1]), 4, 60);
  if (/monochrome|white/.test(p)) patch.colorMode = "white";
  if (/neon|cyan/.test(p)) patch.colorMode = "cyan";
  return patch;
}
export class ImageMappingRenderer {
  constructor() {
    this.key = "";
    this.points = [];
    this.image = null;
    this.depth = null;
    this.generation = 0;
  }
  async load(m) {
    if (
      m.image === this.sourceImage &&
      m.depth === this.sourceDepth &&
      m.density === this.sourceDensity
    )
      return;
    this.sourceImage = m.image;
    this.sourceDepth = m.depth;
    this.sourceDensity = m.density;
    const generation = ++this.generation;
    if (!m.image) {
      this.image = null;
      this.depth = null;
      this.points = [];
      return;
    }
    try {
      const decode = (src) =>
        new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = src;
        });
      const [image, depth] = await Promise.all([
        decode(m.image),
        m.depth ? decode(m.depth) : null,
      ]);
      if (generation !== this.generation) return;
      const w = Math.round(m.density),
        h = Math.max(
          20,
          Math.min(180, Math.round((w * image.height) / image.width)),
        ),
        surface = document.createElement("canvas");
      surface.width = w;
      surface.height = h;
      const c = surface.getContext("2d", { willReadFrequently: true });
      c.drawImage(image, 0, 0, w, h);
      const color = c.getImageData(0, 0, w, h).data;
      let depths;
      if (depth) {
        c.drawImage(depth, 0, 0, w, h);
        depths = c.getImageData(0, 0, w, h).data;
      }
      const points = [];
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4,
            r = color[i],
            g = color[i + 1],
            b = color[i + 2];
          if (color[i + 3] < 20) continue;
          points.push({
            x: x / (w - 1) - 0.5,
            y: y / (h - 1) - 0.5,
            z: depths
              ? depths[i] / 255
              : (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255,
            color: `rgb(${r},${g},${b})`,
            light: (r + g + b) / 765,
          });
        }
      this.image = image;
      this.depth = depth;
      this.points = points;
      this.aspect = image.width / image.height;
    } catch {
      if (generation === this.generation) {
        this.image = null;
        this.depth = null;
        this.points = [];
      }
    }
  }
  render(c, s, interaction, t) {
    const m = s.mapping;
    this.load(m);
    if (!this.image) {
      c.save();
      c.fillStyle = "#a7a2b9";
      c.textAlign = "center";
      c.font = "27px sans-serif";
      c.fillText("Turn an image into a space.", 960, 490);
      c.font = "16px sans-serif";
      c.fillStyle = "#676379";
      c.fillText("Upload a photo or try the local demo in Mapping.", 960, 535);
      c.restore();
      return;
    }
    const fitW = Math.min(1640, 850 * this.aspect),
      fitH = fitW / this.aspect,
      phase = (t * (m.motionSpeed / 35) * Math.PI * 2) / m.duration,
      zoom =
        (m.zoom / 100) *
        (m.motion === "push" ? 1 + Math.sin(phase) * m.amount * 0.005 : 1),
      dx = m.motion === "drift" ? Math.sin(phase) * m.amount * 2 : 0,
      dy = m.motion === "drift" ? Math.cos(phase * 0.7) * m.amount : 0,
      cx = 960 + m.offsetX * 1920 + dx,
      cy = 540 + m.offsetY * 1080 + dy;
    c.save();
    if (m.view === "image" || m.view === "depth") {
      const image = m.view === "depth" ? this.depth || this.image : this.image;
      c.drawImage(
        image,
        cx - (fitW * zoom) / 2,
        cy - (fitH * zoom) / 2,
        fitW * zoom,
        fitH * zoom,
      );
      if (m.view === "depth" && !this.depth) {
        c.globalCompositeOperation = "saturation";
        c.fillStyle = "#808080";
        c.fillRect(
          cx - (fitW * zoom) / 2,
          cy - (fitH * zoom) / 2,
          fitW * zoom,
          fitH * zoom,
        );
      }
      c.restore();
      return;
    }
    const yaw = m.motion === "orbit" ? Math.sin(phase) * m.amount * 0.012 : 0,
      pitch =
        m.motion === "orbit" ? Math.cos(phase * 0.7) * m.amount * 0.004 : 0,
      cos = Math.cos(yaw),
      sin = Math.sin(yaw),
      cp = Math.cos(pitch),
      sp = Math.sin(pitch),
      size = m.pointSize * 1.6;
    for (const p of this.points) {
      const x = p.x * fitW,
        y = p.y * fitH,
        z = (p.z - 0.5) * m.strength * 5,
        a = x * cos + z * sin,
        d = -x * sin + z * cos,
        v = y * cp - d * sp,
        q = y * sp + d * cp,
        pers = 1600 / Math.max(650, 1600 - q);
      c.fillStyle =
        m.colorMode === "cyan"
          ? `rgba(100,220,255,${0.25 + p.light * 0.75})`
          : m.colorMode === "white"
            ? `rgba(230,240,255,${0.2 + p.light * 0.8})`
            : p.color;
      const ps = size * pers * zoom;
      c.fillRect(cx + a * pers * zoom, cy + v * pers * zoom, ps, ps);
    }
    if (
      interaction.selected?.kind === "cloud" ||
      interaction.hovered?.kind === "cloud"
    ) {
      c.strokeStyle = "#ccb5ff";
      c.lineWidth = 1.5;
      c.setLineDash([9, 6]);
      c.strokeRect(
        cx - (fitW * zoom) / 2 - 10,
        cy - (fitH * zoom) / 2 - 10,
        fitW * zoom + 20,
        fitH * zoom + 20,
      );
      c.setLineDash([]);
    }
    c.restore();
  }
}
