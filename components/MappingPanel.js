"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { motionFromBrief } from "../src/image-mapping.js";
function Range({ label, value, min, max, onChange }) {
  return (
    <label className="range-label">
      {label}
      <output>{Math.round(value)}</output>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
export default function MappingPanel({ mapping, onChange, notify }) {
  const imageFile = useRef(null),
    depthFile = useRef(null),
    worker = useRef(null),
    timer = useRef(null),
    latest = useRef(mapping);
  latest.current = mapping;
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(""),
    [brief, setBrief] = useState(mapping.prompt);
  useEffect(
    () => () => {
      worker.current?.terminate();
      clearTimeout(timer.current);
    },
    [],
  );
  function patch(values) {
    onChange({ ...latest.current, ...values });
  }
  function cancel() {
    worker.current?.terminate();
    worker.current = null;
    clearTimeout(timer.current);
    setBusy(false);
    setProgress("");
  }
  async function upload(event, isDepth = false) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
        throw new Error("Use a PNG, JPEG, or WebP image.");
      if (file.size > 10000000)
        throw new Error("Please use an image under 10 MB.");
      const image = await createImageBitmap(file);
      if (image.width * image.height > 40000000) {
        image.close();
        throw new Error("Please resize this image below 40 megapixels.");
      }
      const ratio = Math.min(1, 640 / Math.max(image.width, image.height)),
        c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(image.width * ratio));
      c.height = Math.max(1, Math.round(image.height * ratio));
      c.getContext("2d").drawImage(image, 0, 0, c.width, c.height);
      image.close();
      cancel();
      if (isDepth)
        patch({ depth: c.toDataURL("image/png"), depthSource: "uploaded" });
      else
        patch({
          image: c.toDataURL("image/jpeg", 0.85),
          depth: null,
          depthSource: "luminance",
          filename: file.name,
          offsetX: 0,
          offsetY: 0,
          zoom: 100,
        });
    } catch (error) {
      notify(error.message);
    }
  }
  function demo() {
    cancel();
    const image = document.createElement("canvas"),
      depth = document.createElement("canvas");
    image.width = depth.width = 512;
    image.height = depth.height = 288;
    const a = image.getContext("2d"),
      b = depth.getContext("2d"),
      color = a.createImageData(512, 288),
      relief = b.createImageData(512, 288);
    for (let y = 0; y < 288; y++)
      for (let x = 0; x < 512; x++) {
        const u = x / 512,
          v = y / 288,
          h = Math.max(
            0,
            Math.min(
              1,
              0.5 +
                0.22 * Math.sin(u * 9 + v * 3) +
                0.18 * Math.cos(v * 11 - u * 2) +
                0.08 * Math.sin(u * 23 + v * 9),
            ),
          ),
          i = (y * 512 + x) * 4;
        color.data[i] = 40 + 170 * h;
        color.data[i + 1] = 40 + 150 * (1 - h);
        color.data[i + 2] = 130 + 120 * h;
        color.data[i + 3] = 255;
        relief.data[i] = relief.data[i + 1] = relief.data[i + 2] = h * 255;
        relief.data[i + 3] = 255;
      }
    a.putImageData(color, 0, 0);
    b.putImageData(relief, 0, 0);
    patch({
      image: image.toDataURL("image/png"),
      depth: depth.toDataURL("image/png"),
      depthSource: "demo",
      filename: "Procedural terrain demo",
      offsetX: 0,
      offsetY: 0,
      zoom: 100,
    });
  }
  function estimate() {
    if (!mapping.image || busy) return;
    setBusy(true);
    setProgress("Loading local depth model…");
    const image = mapping.image,
      w = new Worker("/depth-worker.js", { type: "module" });
    worker.current = w;
    const fail = (message) => {
      cancel();
      notify(`${message} Your current relief stays available.`);
    };
    timer.current = setTimeout(
      () => fail("Depth estimation timed out."),
      180000,
    );
    w.onerror = () =>
      fail("The local depth worker could not start. Try Chrome or Edge.");
    w.onmessage = ({ data }) => {
      if (data.type === "progress") {
        setProgress(
          data.status === "progress"
            ? `Downloading model · ${Math.round(data.progress || 0)}%`
            : data.status === "ready"
              ? "Estimating image depth…"
              : "Loading model assets…",
        );
        return;
      }
      if (data.type === "error") {
        fail("AI depth failed: " + data.message);
        return;
      }
      if (data.type === "depth") {
        if (latest.current.image !== image) {
          fail("The source image changed during estimation.");
          return;
        }
        const c = document.createElement("canvas");
        c.width = data.width;
        c.height = data.height;
        const ctx = c.getContext("2d"),
          pixels = ctx.createImageData(c.width, c.height);
        for (let i = 0; i < c.width * c.height; i++) {
          const value = data.data[i * (data.channels || 1)];
          pixels.data[i * 4] =
            pixels.data[i * 4 + 1] =
            pixels.data[i * 4 + 2] =
              value;
          pixels.data[i * 4 + 3] = 255;
        }
        ctx.putImageData(pixels, 0, 0);
        patch({ depth: c.toDataURL("image/png"), depthSource: "ai" });
        cancel();
        notify("AI relative depth is ready. Try orbiting the particles.");
      }
    };
    w.postMessage({ image });
  }
  const source = {
    luminance: "Brightness relief · not inferred depth",
    ai: "AI relative depth",
    uploaded: "Uploaded depth map",
    demo: "Synthetic demo depth",
  }[mapping.depthSource];
  return (
    <div className="mapping-panel">
      <p className="panel-description">
        A photograph becomes a field of light.
      </p>
      <button
        className="mapping-upload"
        onClick={() => imageFile.current.click()}
      >
        <Icon name="image" size={26} />
        <strong>{mapping.image ? "Replace image" : "Upload an image"}</strong>
        <span>PNG, JPEG, WebP · stays on this device</span>
      </button>
      <input
        ref={imageFile}
        hidden
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => upload(e)}
      />
      <button className="text-button" onClick={demo}>
        Try a local terrain demo ↗
      </button>
      {mapping.image && (
        <>
          <div className="mapping-source">
            <img src={mapping.image} alt="Mapping source image" />
            <span>{mapping.filename || "Source image"}</span>
          </div>
          <section className="mapping-section">
            <h3>Depth source</h3>
            <div className="depth-source-badge">{source}</div>
            <p className="hint">
              AI depth estimates near and far from a single image. It is
              relative depth, not a scan of your wall.
            </p>
            <button className="wide" onClick={estimate} disabled={busy}>
              <Icon name="spark" size={14} />
              {busy ? progress : "Estimate AI depth locally"}
            </button>
            {busy && (
              <button className="text-button" onClick={cancel}>
                Cancel depth estimation
              </button>
            )}
            <p className="privacy">
              The first AI run downloads the model from Hugging Face. Processing
              happens in your browser and can take a while.
            </p>
            <div className="mapping-depth-actions">
              <button onClick={() => depthFile.current.click()} disabled={busy}>
                Upload depth map
              </button>
              <button
                onClick={() => patch({ depth: null, depthSource: "luminance" })}
                disabled={busy}
              >
                Use relief
              </button>
            </div>
            <input
              ref={depthFile}
              hidden
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => upload(e, true)}
            />
          </section>
          <section className="mapping-section">
            <h3>Particles</h3>
            <Range
              label="Depth strength"
              value={mapping.strength}
              min={0}
              max={200}
              onChange={(strength) => patch({ strength })}
            />
            <Range
              label="Pixel size"
              value={mapping.pointSize}
              min={1}
              max={7}
              onChange={(pointSize) => patch({ pointSize })}
            />
            <Range
              label="Point density"
              value={mapping.density}
              min={50}
              max={180}
              onChange={(density) => patch({ density })}
            />
            <Range
              label="Image scale"
              value={mapping.zoom}
              min={30}
              max={180}
              onChange={(zoom) => patch({ zoom })}
            />
            <label className="mapping-select">
              Particle colors
              <select
                value={mapping.colorMode}
                onChange={(e) => patch({ colorMode: e.target.value })}
              >
                <option value="original">Original image</option>
                <option value="cyan">Neon cyan</option>
                <option value="white">Monochrome</option>
              </select>
            </label>
          </section>
          <section className="mapping-section">
            <h3>Camera motion</h3>
            <div className="motion-presets">
              {[
                ["orbit", "Orbit"],
                ["push", "Push in"],
                ["drift", "Drift"],
                ["still", "Static"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={mapping.motion === id ? "selected" : ""}
                  onClick={() => patch({ motion: id })}
                >
                  {label}
                </button>
              ))}
            </div>
            <Range
              label="Motion amount"
              value={mapping.amount}
              min={0}
              max={80}
              onChange={(amount) => patch({ amount })}
            />
            <Range
              label="Motion speed"
              value={mapping.motionSpeed}
              min={0}
              max={100}
              onChange={(motionSpeed) => patch({ motionSpeed })}
            />
            <Range
              label="Loop duration (seconds)"
              value={mapping.duration}
              min={4}
              max={60}
              onChange={(duration) => patch({ duration })}
            />
            <button
              className="text-button"
              onClick={() => patch({ offsetX: 0, offsetY: 0, zoom: 100 })}
            >
              Recenter image
            </button>
          </section>
          <section className="mapping-section">
            <h3>Motion brief</h3>
            <textarea
              value={brief}
              maxLength={1200}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Slow orbit around the image, neon particles, continuous 12 second shot…"
              aria-label="Motion brief"
            />
            <button
              className="wide"
              onClick={() => {
                patch(motionFromBrief(brief));
                notify(
                  "Applied supported camera motion, pacing, and color settings.",
                );
              }}
              disabled={!brief.trim()}
            >
              Apply motion brief
            </button>
            <p className="privacy">
              Rule-based controls recognize orbit, push-in, pan, static, speed,
              duration, and color. This animates your image; it does not
              generate new video subjects or audio.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
