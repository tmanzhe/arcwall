"use client";
import { useState } from "react";
export default function ShapeEditor({ shapes, onChange, color }) {
  const [selected, setSelected] = useState("");
  const shape = shapes.find((s) => s.id === selected) || shapes.at(-1);
  function add(type) {
    if (shapes.length >= 40) return;
    const id = crypto.randomUUID();
    onChange([
      ...shapes,
      { id, type, x: 0.5, y: 0.5, width: 0.2, height: 0.2, color, label: "" },
    ]);
    setSelected(id);
  }
  function edit(values) {
    onChange(shapes.map((s) => (s.id === shape.id ? { ...s, ...values } : s)));
  }
  return (
    <section>
      <div className="section-heading">
        <h2>
          <span>Scene shapes</span>
        </h2>
        <span>{shapes.length} / 40</span>
      </div>
      <div className="shape-buttons">
        <button onClick={() => add("rectangle")} disabled={shapes.length >= 40}>
          ＋ Rectangle
        </button>
        <button onClick={() => add("ellipse")} disabled={shapes.length >= 40}>
          ＋ Ellipse
        </button>
      </div>
      {shape && (
        <div className="shape-inspector">
          <select
            aria-label="Selected shape"
            value={shape.id}
            onChange={(e) => setSelected(e.target.value)}
          >
            {shapes.map((s, i) => (
              <option key={s.id} value={s.id}>
                {s.label || `${s.type} ${i + 1}`}
              </option>
            ))}
          </select>
          <input
            aria-label="Shape label"
            placeholder="Label this shape…"
            value={shape.label}
            maxLength={60}
            onChange={(e) => edit({ label: e.target.value })}
          />
          <div className="position-grid">
            {[
              ["x", "Position X"],
              ["y", "Position Y"],
              ["width", "Width"],
              ["height", "Height"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  aria-label={label}
                  type="range"
                  min={key === "x" || key === "y" ? 0 : 1}
                  max={100}
                  value={shape[key] * 100}
                  onChange={(e) =>
                    edit({ [key]: Number(e.target.value) / 100 })
                  }
                />
              </label>
            ))}
          </div>
          <div className="shape-buttons">
            <label className="ink-label">
              COLOR{" "}
              <input
                type="color"
                aria-label="Shape color"
                value={shape.color}
                onChange={(e) => edit({ color: e.target.value })}
              />
            </label>
            <button
              onClick={() => onChange(shapes.filter((s) => s.id !== shape.id))}
            >
              Remove
            </button>
          </div>
        </div>
      )}
      <p className="hint">
        Add outlines and adjust their position and size to frame real objects on
        your wall.
      </p>
    </section>
  );
}
