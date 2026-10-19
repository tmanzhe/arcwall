"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Renderer } from "../src/renderer.js";
import {
  DEFAULT_SCENE,
  PRESETS,
  CORNER_LAYOUT,
  sanitizeScene,
} from "../src/scene.js";
import {
  clamp,
  homography,
  IDENTITY_QUAD,
  project,
  validQuad,
} from "../src/geometry.js";
import AgentPanel from "./AgentPanel";
import ShapeEditor from "./ShapeEditor";
import { eraseInk } from "../src/eraser.js";
import Icon from "./Icon";
import ProjectionStage from "./ProjectionStage";
import { BACKGROUNDS, backgroundPatch } from "../src/backgrounds.js";
import {
  pickObject,
  objectBounds,
  transformObject,
  removeObject,
} from "../src/manipulation.js";
import BackgroundPicker from "./BackgroundPicker";
import MappingPanel from "./MappingPanel";

const CHANNEL = "arcwall-studio-v1";
function Range({ label, value, min, max, unit = "%", onChange }) {
  return (
    <label className="range-label">
      {label}
      <output>
        {unit === "×" ? (value / 100).toFixed(1) : Math.round(value)}
        {unit}
      </output>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
function Section({ number, title, status, children }) {
  return (
    <details className="control-section" open>
      <summary className="section-heading">
        <h2>
          {number} <span>{title}</span>
        </h2>
        <span>
          {status}
          <Icon name="chevron" size={12} />
        </span>
      </summary>
      <div className="section-content">{children}</div>
    </details>
  );
}
export default function Studio() {
  const [scene, setScene] = useState(DEFAULT_SCENE);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const [mode, setMode] = useState("draw"),
    [selection, setSelection] = useState(null),
    [panel, setPanel] = useState("scene"),
    [inspectorOpen, setInspectorOpen] = useState(true),
    [voiceOpen, setVoiceOpen] = useState(false),
    [focus, setFocus] = useState(false),
    [eraserSize, setEraserSize] = useState(35),
    [clean, setClean] = useState(false),
    [output, setOutput] = useState(false),
    [fps, setFps] = useState(0),
    [saveStatus, setSaveStatus] = useState("Saved on this device"),
    [toast, setToast] = useState(""),
    [ready, setReady] = useState(false);
  const [cameraState, setCameraState] = useState("off"),
    [gesture, setGesture] = useState("Looking for hands…"),
    [stageSize, setStageSize] = useState([1, 1]),
    [outputPrompt, setOutputPrompt] = useState(true);
  const canvas = useRef(null),
    stage = useRef(null),
    video = useRef(null),
    preview = useRef(null),
    channel = useRef(null),
    renderer = useRef(null),
    vision = useRef(null),
    interaction = useRef({}),
    stroke = useRef(null),
    pointerDown = useRef(false),
    corner = useRef(null),
    history = useRef([]),
    importFile = useRef(null),
    toastTimer = useRef(null),
    alive = useRef(true);
  const help = useRef(null);
  const grab = useRef(null),
    selectionRef = useRef(selection);
  selectionRef.current = selection;
  const erasing = useRef(false),
    lastErase = useRef(null),
    eraserSizeRef = useRef(eraserSize);
  eraserSizeRef.current = eraserSize;
  const outputRef = useRef(false),
    modeRef = useRef("draw");
  modeRef.current = mode;
  const notify = useCallback((message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 5000);
  }, []);
  const remember = useCallback(() => {
    history.current = [...history.current.slice(-29), sceneRef.current];
  }, []);
  const patch = useCallback(
    (values) => setScene((s) => ({ ...s, ...values })),
    [],
  );
  const update = useCallback((key, value) => patch({ [key]: value }), [patch]);
  const undo = useCallback(() => {
    const last = history.current.pop();
    if (last) setScene(last);
  }, []);
  const finishStroke = useCallback(() => {
    if (stroke.current?.points.length) {
      const completed = stroke.current;
      remember();
      setScene((s) => ({
        ...s,
        strokes: [...s.strokes.slice(-299), completed],
      }));
    }
    stroke.current = null;
    interaction.current.activeStroke = null;
  }, [remember]);
  const manipulate = useCallback(
    (point, pressed, span = null) => {
      interaction.current.pointer = point;
      interaction.current.pinching = pressed;
      interaction.current.eraser = null;
      if (!point) {
        grab.current = null;
        interaction.current.grabbing = false;
        interaction.current.hovered = null;
        return;
      }
      const hovered = pickObject(sceneRef.current, point);
      interaction.current.hovered = hovered;
      if (!pressed) {
        grab.current = null;
        interaction.current.grabbing = false;
        return;
      }
      const kind = span !== null ? "resize" : "move";
      if (!grab.current || grab.current.kind !== kind) {
        const target = span !== null ? selectionRef.current : hovered;
        if (!target || !objectBounds(sceneRef.current, target)) return;
        remember();
        grab.current = {
          kind,
          target,
          anchor: point,
          span,
          base: sceneRef.current,
        };
        setSelection(target);
        selectionRef.current = target;
        interaction.current.selected = target;
      }
      const active = grab.current;
      if (!active) return;
      interaction.current.grabbing = true;
      setScene((current) =>
        transformObject(
          current,
          active.base,
          active.target,
          point[0] - active.anchor[0],
          point[1] - active.anchor[1],
          span !== null ? span / Math.max(active.span, 0.03) : 1,
        ),
      );
    },
    [remember],
  );
  const trace = useCallback(
    (point, drawing) => {
      interaction.current.pointer = point;
      interaction.current.pinching = drawing;
      if (modeRef.current === "erase") {
        interaction.current.eraser = eraserSizeRef.current;
        if (drawing) {
          if (!erasing.current) {
            remember();
            erasing.current = true;
          }
          const from = lastErase.current || point;
          setScene((s) => {
            const strokes = eraseInk(
              s.strokes,
              from,
              point,
              eraserSizeRef.current,
            );
            return strokes === s.strokes ? s : { ...s, strokes };
          });
          lastErase.current = point;
        } else {
          erasing.current = false;
          lastErase.current = null;
        }
        return;
      }
      interaction.current.eraser = null;
      if (drawing) {
        if (!stroke.current)
          stroke.current = { color: sceneRef.current.ink, points: [] };
        const pts = stroke.current.points,
          last = pts.at(-1);
        if (
          pts.length < 3000 &&
          (!last || Math.hypot(last[0] - point[0], last[1] - point[1]) > 0.001)
        )
          pts.push(point);
        interaction.current.activeStroke = stroke.current;
      } else if (stroke.current) finishStroke();
    },
    [finishStroke, remember],
  );
  useEffect(() => {
    alive.current = true;
    const isOutput = new URLSearchParams(location.search).has("output");
    setOutput(isOutput);
    setClean(isOutput);
    if (window.matchMedia("(max-width: 900px)").matches)
      setInspectorOpen(false);
    outputRef.current = isOutput;
    try {
      const stored = localStorage.getItem("arcwall-scene");
      if (stored) setScene(sanitizeScene(JSON.parse(stored)));
    } catch {
      notify("Saved scene could not be loaded. Starting fresh.");
    }
    setReady(true);
    const bc = new BroadcastChannel(CHANNEL);
    channel.current = bc;
    bc.onmessage = ({ data }) => {
      if (data.type === "request" && !isOutput)
        bc.postMessage({ type: "scene", scene: sceneRef.current });
      if (data.type === "scene" && isOutput) {
        try {
          setScene(sanitizeScene(data.scene));
        } catch {}
      }
      if (data.type === "interaction" && isOutput)
        interaction.current = data.interaction;
      if (data.type === "hello" && isOutput)
        bc.postMessage({ type: "request" });
    };
    bc.postMessage({ type: isOutput ? "request" : "hello" });
    const r = new Renderer(
      canvas.current,
      () => sceneRef.current,
      () => interaction.current,
      setFps,
    );
    renderer.current = r;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setStageSize([width, height]);
    });
    observer.observe(stage.current);
    const timer = setInterval(() => {
      if (!isOutput)
        bc.postMessage({
          type: "interaction",
          interaction: interaction.current,
        });
    }, 50);
    return () => {
      alive.current = false;
      r.stop();
      observer.disconnect();
      clearInterval(timer);
      clearTimeout(toastTimer.current);
      bc.close();
      vision.current?.stop();
    };
  }, [notify]);
  useEffect(() => {
    if (!ready) return;
    if (!output) channel.current?.postMessage({ type: "scene", scene });
    if (output) return;
    setSaveStatus("Saving…");
    const timer = setTimeout(() => {
      try {
        localStorage.setItem("arcwall-scene", JSON.stringify(scene));
        setSaveStatus("Saved on this device");
      } catch {
        setSaveStatus("Export to save your scene");
        notify("Browser storage is full. Export your scene to keep it.");
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [scene, ready, output, notify]);
  useEffect(() => {
    document.body.classList.toggle("clean", clean);
    document.body.classList.toggle("focus", focus && !output);
    document.body.classList.toggle("output", output);
    document.body.classList.toggle("mapping", mode === "map" && !output);
    return () => {
      document.body.classList.remove("clean", "output", "mapping", "focus");
    };
  }, [clean, output, mode, focus]);
  useEffect(() => {
    interaction.current.eraser = mode === "erase" ? eraserSize : null;
  }, [mode, eraserSize]);
  useEffect(() => {
    interaction.current.selected = mode === "interact" ? selection : null;
    if (mode !== "interact") {
      grab.current = null;
      interaction.current.hovered = null;
      interaction.current.grabbing = false;
    }
  }, [mode, selection]);
  useEffect(() => {
    if (selection && !objectBounds(scene, selection)) {
      setSelection(null);
      interaction.current.selected = null;
      grab.current = null;
    }
  }, [scene, selection]);
  const fullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement)
        await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
      setOutputPrompt(false);
    } catch {
      notify("Use your browser’s fullscreen menu to fill the projector.");
    }
  }, [notify]);
  useEffect(() => {
    const onKey = (e) => {
      if (
        help.current?.open ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;
      const key = e.key.toLowerCase();
      if (key === "h") setClean((v) => !v);
      if (key === "f") fullscreen();
      if (key === "m") {
        finishStroke();
        setMode("map");
      }
      if (key === "d" && sceneRef.current.workspace === "studio") {
        finishStroke();
        setMode("draw");
      }
      if (key === "e" && sceneRef.current.workspace === "studio") {
        finishStroke();
        setMode("erase");
      }
      if (key === "v") {
        finishStroke();
        grab.current = null;
        setMode("interact");
      }
      if ((key === "delete" || key === "backspace") && selectionRef.current) {
        e.preventDefault();
        remember();
        const target = selectionRef.current;
        setScene((s) => removeObject(s, target));
        setSelection(null);
        interaction.current.selected = null;
        grab.current = null;
      }
      if (key === "b" && sceneRef.current.workspace === "studio") {
        setFocus((v) => !v);
        patch({ board: !sceneRef.current.board });
      }
      if (key === "escape") {
        setFocus(false);
        setClean(false);
      }
      if (key === "z") undo();
      if (key === " ") {
        e.preventDefault();
        patch({ paused: !sceneRef.current.paused });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen, patch, undo, finishStroke, remember]);
  function screenPoint(e) {
    const rect = stage.current.getBoundingClientRect();
    return [
      clamp((e.clientX - rect.left) / rect.width, 0, 1),
      clamp((e.clientY - rect.top) / rect.height, 0, 1),
    ];
  }
  function canvasPoint(e) {
    const p = screenPoint(e);
    try {
      return project(
        homography(sceneRef.current.quad, IDENTITY_QUAD),
        ...p,
      ).map((v) => clamp(v, 0, 1));
    } catch {
      return p;
    }
  }
  function down(e) {
    if (output || e.button !== 0) return;
    stage.current.setPointerCapture(e.pointerId);
    if (mode === "map") {
      const p = screenPoint(e);
      let index = -1,
        dist = 0.05;
      scene.quad.forEach((q, i) => {
        const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (d < dist) {
          index = i;
          dist = d;
        }
      });
      if (index >= 0) {
        remember();
        corner.current = index;
      }
    } else {
      pointerDown.current = true;
      if (mode === "interact") manipulate(canvasPoint(e), true);
      else trace(canvasPoint(e), true);
    }
  }
  function move(e) {
    if (output) return;
    if (corner.current !== null) {
      const q = sceneRef.current.quad.map((p) => [...p]);
      q[corner.current] = screenPoint(e);
      if (validQuad(q)) patch({ quad: q });
    } else if (mode === "interact")
      manipulate(canvasPoint(e), pointerDown.current);
    else if (mode === "draw" || mode === "erase")
      trace(canvasPoint(e), pointerDown.current);
  }
  function up() {
    corner.current = null;
    pointerDown.current = false;
    erasing.current = false;
    lastErase.current = null;
    finishStroke();
    grab.current = null;
    interaction.current.grabbing = false;
    interaction.current.pinching = false;
  }
  async function toggleCamera() {
    if (vision.current) {
      vision.current.stop();
      vision.current = null;
      setCameraState("off");
      interaction.current = {};
      finishStroke();
      return;
    }
    setCameraState("loading");
    setGesture("Loading hand model…");
    try {
      const { VisionController } = await import("../src/vision.js");
      const controller = new VisionController(
        video.current,
        preview.current,
        (results) => {
          if (!alive.current) return;
          interaction.current.hands = results.hands;
          if (pointerDown.current) return;
          setGesture(
            modeRef.current === "interact"
              ? results.span !== null && selectionRef.current
                ? "SPREAD / RESIZE"
                : results.pinching
                  ? "PINCH / GRAB"
                  : "POINT AT AN OBJECT"
              : results.gesture,
          );
          if (modeRef.current === "interact") {
            if (results.span !== null && selectionRef.current)
              manipulate(results.center, true, results.span);
            else manipulate(results.pointer, results.pinching);
          } else if (
            results.pointer &&
            ["draw", "erase"].includes(modeRef.current)
          )
            trace(results.pointer, results.pinching);
          else {
            finishStroke();
            erasing.current = false;
            lastErase.current = null;
            interaction.current.pointer = results.pointer;
            interaction.current.pinching = false;
          }
        },
        () => sceneRef.current,
        (error) => {
          notify(error);
          vision.current?.stop();
          vision.current = null;
          setCameraState("off");
          finishStroke();
          interaction.current = {};
        },
      );
      vision.current = controller;
      await controller.start();
      if (alive.current) {
        setCameraState("on");
        finishStroke();
        setMode("interact");
        notify("Point at an object, pinch to grab it, and release to drop.");
      }
    } catch (error) {
      vision.current?.stop();
      vision.current = null;
      setCameraState("off");
      notify(error.message || "Camera could not start.");
    }
  }
  function launch() {
    const win = window.open(
      "/?output=1",
      "arcwall-output",
      "popup,width=1280,height=720",
    );
    if (!win)
      notify("Allow pop-ups for localhost to open the projector window.");
    else
      notify(
        "Move the output window to your projector. Press F for fullscreen.",
      );
  }
  function download(data, name) {
    const url = URL.createObjectURL(data),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function loadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 5000000)
        throw new Error("Scene file is too large (maximum 5 MB).");
      const raw = JSON.parse(await file.text());
      if (raw.version !== 1) throw new Error("Unsupported scene version.");
      const next = sanitizeScene(raw.scene);
      remember();
      setScene(next);
      notify("Scene imported.");
    } catch (error) {
      notify(error.message);
    }
    e.target.value = "";
  }
  function snapshot() {
    canvas.current.toBlob((blob) => {
      if (blob) download(blob, "arcwall-snapshot.png");
    });
  }
  function chooseTool(next) {
    finishStroke();
    erasing.current = false;
    lastErase.current = null;
    setMode(next);
    grab.current = null;
    interaction.current.grabbing = false;
  }
  function cornerLayout() {
    remember();
    patch(CORNER_LAYOUT);
    notify("Holograms tucked into the corners. Your drawings are unchanged.");
  }
  function saveScene() {
    download(
      new Blob([JSON.stringify({ version: 1, scene }, null, 2)], {
        type: "application/json",
      }),
      "arcwall-scene.json",
    );
  }
  function clearBoard() {
    finishStroke();
    remember();
    patch({ strokes: [], shapes: [] });
    notify("Board cleared. Press Z to undo.");
  }
  function switchWorkspace(workspace) {
    finishStroke();
    grab.current = null;
    setSelection(null);
    patch({ workspace });
    setPanel(workspace === "mapping" ? "mapping" : "scene");
    setInspectorOpen(true);
    setVoiceOpen(false);
    setMode("interact");
  }
  return (
    <>
      <header className="app-header">
        <a className="brand" href="/">
          <span className="brandmark">
            <Icon name="spark" size={21} />
          </span>
          arcwall<span className="brand-tag">STUDIO</span>
        </a>
        <div className="session-name">
          <span className="session-divider" />
          Personal workspace
          <span className="session-chip">
            <span className="live-dot" />
            Local
          </span>
        </div>
        <div className="workspace-switch" aria-label="Workspace">
          <button
            className={scene.workspace === "studio" ? "selected" : ""}
            onClick={() => switchWorkspace("studio")}
          >
            <Icon name="layers" size={13} />
            Studio
          </button>
          <button
            className={scene.workspace === "mapping" ? "selected" : ""}
            onClick={() => switchWorkspace("mapping")}
          >
            <Icon name="image" size={13} />
            Mapping
          </button>
        </div>
        <div className="header-right">
          <button className="header-save" onClick={saveScene}>
            <Icon name="download" size={15} />
            Export scene
          </button>
          <button onClick={launch} className="primary">
            <Icon name="projector" size={16} />
            Launch projector
            <Icon name="chevron" size={13} />
          </button>
        </div>
      </header>
      <main
        className={
          (inspectorOpen ? "" : "inspector-closed") +
          (voiceOpen ? " voice-open" : "")
        }
      >
        <nav className="navigation-rail" aria-label="Studio panels">
          <div className="rail-top">
            {[
              ["scene", "layers", "Scene"],
              ["mapping", "image", "Mapping"],
              ["vision", "hand", "Vision"],
              ["objects", "shapes", "Objects"],
              ["setup", "settings", "Setup"],
            ].map(([id, icon, label]) => (
              <button
                key={id}
                className={
                  panel === id && inspectorOpen && !voiceOpen ? "active" : ""
                }
                aria-pressed={panel === id && inspectorOpen && !voiceOpen}
                onClick={() => {
                  setPanel(id);
                  if (id === "mapping") switchWorkspace("mapping");
                  else if (
                    ["scene", "objects"].includes(id) &&
                    scene.workspace === "mapping"
                  )
                    patch({ workspace: "studio" });
                  setVoiceOpen(false);
                  setInspectorOpen(true);
                }}
                title={label}
              >
                <Icon name={icon} size={20} />
                <span>{label}</span>
              </button>
            ))}
            <button
              className={
                voiceOpen
                  ? "active assistant-rail-button"
                  : "assistant-rail-button"
              }
              aria-pressed={voiceOpen}
              title="Talk to Arc assistant"
              onClick={() => setVoiceOpen((v) => !v)}
            >
              <Icon name="mic" size={20} />
              <span>Assistant</span>
            </button>
          </div>
          <div className="rail-bottom">
            <button onClick={launch} title="Launch projector">
              <Icon name="projector" size={20} />
              <span>Output</span>
            </button>
            <button
              onClick={() => help.current.showModal()}
              title="Keyboard shortcuts"
            >
              <Icon name="help" size={19} />
              <span>Help</span>
            </button>
            <div className="profile-avatar" title="Local workspace">
              AW
            </div>
          </div>
        </nav>
        <aside className="sidebar" hidden={!inspectorOpen || voiceOpen}>
          <div className="inspector-title">
            <div>
              <span className="eyebrow">INSPECTOR</span>
              <h2>
                {
                  {
                    scene: "Scene",
                    vision: "Vision controls",
                    objects: "Objects",
                    setup: "Workspace",
                    mapping: "Image mapping",
                  }[panel]
                }
              </h2>
            </div>
            <button
              className="icon-button"
              aria-label="Close inspector"
              onClick={() => setInspectorOpen(false)}
            >
              <Icon name="panel" size={17} />
            </button>
          </div>
          <div className="inspector-scroll">
            <div className="inspector-pane" hidden={panel !== "mapping"}>
              <MappingPanel
                mapping={scene.mapping}
                notify={notify}
                onChange={(mapping) => {
                  remember();
                  patch({ mapping });
                }}
              />
            </div>
            <div className="inspector-pane" hidden={panel !== "scene"}>
              <p className="panel-description">
                A little atmosphere. A lot of possibility.
              </p>
              <Section number="" title="Background scenes" status="6 SCENES">
                <BackgroundPicker
                  value={scene.background}
                  onChange={(id) => {
                    remember();
                    patch(backgroundPatch(id));
                    setSelection(null);
                  }}
                />
              </Section>
              <Section number="" title="Appearance" status="">
                <div className="presets">
                  {Object.entries(PRESETS).map(([name, color]) => (
                    <button
                      key={name}
                      onClick={() => update("preset", name)}
                      className={scene.preset === name ? "selected" : ""}
                    >
                      <i style={{ "--swatch": color }} />
                      {name === "arc"
                        ? "Arc blue"
                        : name === "ember"
                          ? "Ember"
                          : "Ghost"}
                      {scene.preset === name && <Icon name="check" size={11} />}
                    </button>
                  ))}
                </div>
                <Range
                  label="Light intensity"
                  value={scene.brightness}
                  min={20}
                  max={100}
                  onChange={(v) => update("brightness", v)}
                />
                <Range
                  label="Motion speed"
                  value={scene.speed}
                  min={0}
                  max={200}
                  unit="×"
                  onChange={(v) => update("speed", v)}
                />
              </Section>
              <Section number="" title="Scene layers" status="">
                <div className="toggle-row">
                  {[
                    ["grid", "Spatial grid"],
                    ["sphere", "Reactor core"],
                    ["arm", "Robot arm"],
                    ["telemetry", "Telemetry"],
                    ["hologram", "Background model"],
                  ].map(([key, label]) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={scene[key]}
                        onChange={(e) => update(key, e.target.checked)}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </Section>
              {["guardian", "kinetic", "orbital", "constellation"].includes(
                scene.background,
              ) && (
                <Section
                  number=""
                  title="Background model"
                  status="DRAG TO MOVE"
                >
                  <Range
                    label="Model size"
                    value={scene.artifactScale}
                    min={40}
                    max={180}
                    onChange={(v) => update("artifactScale", v)}
                  />
                  <button
                    className="wide"
                    onClick={() => chooseTool("interact")}
                  >
                    <Icon name="cursor" size={15} />
                    Move the model on canvas
                  </button>
                </Section>
              )}
              <div className="layout-callout">
                <Icon name="corners" size={19} />
                <div>
                  <strong>Corner layout</strong>
                  <p>Clear the middle for drawing.</p>
                </div>
                <button
                  className="icon-button"
                  title="Apply corner layout"
                  aria-label="Apply corner layout"
                  onClick={cornerLayout}
                >
                  <Icon name="chevron" size={15} />
                </button>
              </div>
              <Section number="" title="Reactor core" status="">
                <Range
                  label="Core scale"
                  value={scene.scale}
                  min={40}
                  max={180}
                  onChange={(v) => update("scale", v)}
                />
                <div className="position-grid">
                  {["X", "Y"].map((axis) => (
                    <label key={axis}>
                      Position {axis}
                      <input
                        type="range"
                        aria-label={`Core ${axis}`}
                        min={axis === "X" ? 10 : 15}
                        max={axis === "X" ? 90 : 85}
                        value={scene["sphere" + axis]}
                        onChange={(e) =>
                          update("sphere" + axis, Number(e.target.value))
                        }
                      />
                    </label>
                  ))}
                </div>
              </Section>
              <Section number="" title="Robot arm" status="">
                <Range
                  label="Arm scale"
                  value={scene.armScale}
                  min={30}
                  max={120}
                  onChange={(v) => update("armScale", v)}
                />
                <div className="position-grid">
                  {["X", "Y"].map((axis) => (
                    <label key={axis}>
                      Position {axis}
                      <input
                        type="range"
                        aria-label={`Arm ${axis}`}
                        min={axis === "X" ? 5 : 20}
                        max={axis === "X" ? 95 : 90}
                        value={scene["arm" + axis]}
                        onChange={(e) =>
                          update("arm" + axis, Number(e.target.value))
                        }
                      />
                    </label>
                  ))}
                </div>
              </Section>
            </div>
            <div className="inspector-pane" hidden={panel !== "vision"}>
              <p className="panel-description">
                Your hands, part of the interface.
              </p>
              <Section
                number=""
                title="Hand tracking"
                status={
                  cameraState === "on"
                    ? "LIVE"
                    : cameraState === "loading"
                      ? "LOADING"
                      : "OFFLINE"
                }
              >
                <div className="input-mode-switch">
                  <button
                    className={cameraState === "off" ? "selected" : ""}
                    onClick={() => {
                      if (vision.current) toggleCamera();
                    }}
                  >
                    <Icon name="cursor" size={14} />
                    Mouse
                  </button>
                  <button
                    className={cameraState === "on" ? "selected" : ""}
                    disabled={cameraState === "loading"}
                    onClick={() => {
                      if (cameraState === "off") toggleCamera();
                    }}
                  >
                    <Icon name="hand" size={14} />
                    Hands
                  </button>
                </div>
                <button
                  onClick={toggleCamera}
                  disabled={cameraState === "loading"}
                  className="wide camera-button"
                >
                  <Icon name="camera" size={16} />
                  {cameraState === "off"
                    ? "Enable camera"
                    : cameraState === "loading"
                      ? "Loading vision model…"
                      : "Stop camera"}
                </button>
                <div id="camera-box" hidden={cameraState === "off"}>
                  <video ref={video} autoPlay playsInline muted />
                  <canvas id="hand-preview" ref={preview} />
                  <span>{gesture}</span>
                </div>
                <div className="gesture-guide">
                  <div>
                    <span>01</span>
                    <p>
                      <strong>Point to aim</strong>Move the cursor with your
                      index finger.
                    </p>
                  </div>
                  <div>
                    <span>02</span>
                    <p>
                      <strong>Pinch to grab</strong>In Interact mode, hold a
                      pinch and move an object. Release to drop it.
                    </p>
                  </div>
                  <div>
                    <span>03</span>
                    <p>
                      <strong>Spread to resize</strong>Select an object first,
                      then spread two open hands to resize it.
                    </p>
                  </div>
                </div>
                <label className="switch-label">
                  <input
                    type="checkbox"
                    checked={scene.skeleton}
                    onChange={(e) => update("skeleton", e.target.checked)}
                  />
                  Show my hand on the projection
                </label>
                <Range
                  label="Pinch sensitivity"
                  value={scene.sensitivity}
                  min={15}
                  max={65}
                  unit=""
                  onChange={(v) => update("sensitivity", v)}
                />
                <p className="privacy">
                  Camera processing stays on this device. An internet connection
                  loads the hand model.
                </p>
              </Section>
            </div>
            <div className="inspector-pane" hidden={panel !== "objects"}>
              <p className="panel-description">
                Give your space a little structure.
              </p>
              <ShapeEditor
                shapes={scene.shapes}
                color={scene.ink}
                onChange={(shapes) => {
                  remember();
                  patch({ shapes });
                }}
              />
            </div>
            <div className="inspector-pane" hidden={panel !== "setup"}>
              <p className="panel-description">One laptop. A whole new room.</p>
              <Section number="" title="Projector output" status="">
                <p className="hint">
                  Connect your projector as an extended display. Open the output
                  window, move it to that display, and press F.
                </p>
                <button className="wide" onClick={launch}>
                  <Icon name="projector" size={16} />
                  Open projector window
                </button>
              </Section>
              <Section number="" title="Wall alignment" status="">
                <p className="hint">
                  Drag four corners in Fit to wall to match the projection to
                  your surface.
                </p>
                <button className="wide" onClick={() => chooseTool("map")}>
                  <Icon name="map" size={16} />
                  Fit to wall
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    remember();
                    patch({ quad: IDENTITY_QUAD });
                  }}
                >
                  Reset alignment
                </button>
              </Section>
              <Section number="" title="Your scene" status="LOCAL">
                <div className="file-actions">
                  <button onClick={saveScene}>
                    <Icon name="download" size={15} />
                    Export scene
                  </button>
                  <button onClick={() => importFile.current.click()}>
                    <Icon name="upload" size={15} />
                    Import scene
                  </button>
                  <button onClick={snapshot}>
                    <Icon name="camera" size={15} />
                    Save snapshot
                  </button>
                </div>
                <p className="privacy">
                  Your scene autosaves in this browser. Export a copy to keep it
                  or move to another laptop.
                </p>
              </Section>
            </div>
          </div>
          <div className="inspector-footer">
            <span className="live-dot" />
            Everything starts with an idea.
          </div>
        </aside>
        <div className="workspace">
          <div className="workspace-top">
            <div className="workspace-title">
              <div className="eyebrow">YOUR CREATIVE SPACE</div>
              <h1>
                {scene.workspace === "mapping"
                  ? "Image mapping"
                  : scene.board
                    ? "Drawing board"
                    : "Spatial canvas"}
                <span className="title-dot">.</span>
              </h1>
            </div>
            {scene.workspace === "mapping" ? (
              <div className="view-switch" aria-label="Mapping view">
                {[
                  ["particles", "Pixels"],
                  ["depth", "Depth"],
                  ["image", "Image"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    className={scene.mapping.view === id ? "selected" : ""}
                    onClick={() =>
                      patch({ mapping: { ...scene.mapping, view: id } })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="view-switch" aria-label="Canvas view">
                <button
                  className={!scene.board ? "selected" : ""}
                  onClick={() => update("board", false)}
                >
                  <Icon name="layers" size={14} />
                  Studio
                </button>
                <button
                  className={scene.board ? "selected" : ""}
                  onClick={() => update("board", true)}
                >
                  <Icon name="board" size={14} />
                  Drawing board
                </button>
              </div>
            )}
            <div className="workspace-status">
              <span className="render-status">
                <span className="live-dot" />
                Live
                <span className="status-divider" />
                {fps} fps
              </span>
              <button
                className={"icon-button " + (!inspectorOpen ? "selected" : "")}
                title="Toggle inspector"
                aria-label="Toggle inspector"
                onClick={() => setInspectorOpen((v) => !v)}
              >
                <Icon name="panel" size={17} />
              </button>
            </div>
          </div>
          <div className="viewport">
            <ProjectionStage
              scene={scene}
              stageSize={stageSize}
              canvasRef={canvas}
              stageRef={stage}
              onDown={down}
              onMove={move}
              onUp={up}
              onLeave={() => {
                if (!pointerDown.current && cameraState !== "on")
                  interaction.current.pointer = null;
              }}
              output={output}
              outputPrompt={outputPrompt}
              onFullscreen={fullscreen}
              onDismiss={() => setOutputPrompt(false)}
            />
            <div className="canvas-label">
              <span className="canvas-label-dot" />
              {mode === "map"
                ? "ALIGN SURFACE"
                : mode === "interact"
                  ? "POINT · GRAB · MOVE"
                  : mode === "erase"
                    ? "ERASER ACTIVE"
                    : scene.board
                      ? "OPEN CANVAS"
                      : "LIVE PROJECTION"}
              <span>1920 × 1080</span>
            </div>
            <div className="viewport-actions">
              <button
                className="icon-button"
                onClick={() => update("paused", !scene.paused)}
                aria-label={
                  scene.paused ? "Resume animation" : "Pause animation"
                }
                title={scene.paused ? "Resume animation" : "Pause animation"}
              >
                <Icon name={scene.paused ? "play" : "pause"} size={15} />
              </button>
              <button
                className="icon-button"
                aria-label="Save snapshot"
                title="Save snapshot"
                onClick={snapshot}
              >
                <Icon name="camera" size={16} />
              </button>
            </div>
            <div className="tools" role="toolbar" aria-label="Drawing tools">
              <div className="tool-group">
                <button
                  className={mode === "interact" ? "selected" : ""}
                  onClick={() => chooseTool("interact")}
                  title="Interact: drag or pinch to move (V)"
                  aria-pressed={mode === "interact"}
                >
                  <Icon name="cursor" size={16} />
                  <span>Interact</span>
                </button>
                {scene.workspace !== "mapping" && (
                  <>
                    <button
                      className={mode === "draw" ? "selected" : ""}
                      onClick={() => chooseTool("draw")}
                      title="Draw (D)"
                      aria-pressed={mode === "draw"}
                    >
                      <Icon name="pen" size={16} />
                      <span>Draw</span>
                    </button>
                    <button
                      className={mode === "erase" ? "selected" : ""}
                      onClick={() => chooseTool("erase")}
                      title="Erase (E)"
                      aria-pressed={mode === "erase"}
                    >
                      <Icon name="eraser" size={17} />
                      <span>Erase</span>
                    </button>
                  </>
                )}
              </div>
              <span className="tool-divider" />
              {scene.workspace !== "mapping" && (
                <>
                  <label className="ink-label" title="Ink color">
                    <input
                      aria-label="Ink color"
                      type="color"
                      value={scene.ink}
                      onChange={(e) => update("ink", e.target.value)}
                    />
                  </label>
                  {mode === "erase" && (
                    <label className="eraser-size">
                      <span>Size</span>
                      <input
                        aria-label="Eraser size"
                        type="range"
                        min={10}
                        max={100}
                        value={eraserSize}
                        onChange={(e) => setEraserSize(Number(e.target.value))}
                      />
                    </label>
                  )}
                </>
              )}
              <span className="tool-divider" />
              <div className="tool-group">
                <button
                  className="icon-button"
                  onClick={undo}
                  aria-label="Undo"
                  title="Undo (Z)"
                >
                  <Icon name="undo" size={17} />
                </button>
                {scene.workspace !== "mapping" && (
                  <button
                    className="icon-button danger-button"
                    onClick={clearBoard}
                    aria-label="Clear board"
                    title="Clear board"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                )}
              </div>
              <span className="tool-divider" />
              <button
                className={"icon-button " + (mode === "map" ? "selected" : "")}
                onClick={() => chooseTool("map")}
                aria-label="Fit to wall"
                title="Fit to wall (M)"
              >
                <Icon name="map" size={18} />
              </button>
              <button
                className="icon-button"
                aria-label={focus ? "Exit expanded canvas" : "Expand canvas"}
                onClick={() => setFocus((v) => !v)}
                title={focus ? "Exit expanded canvas (Esc)" : "Expand canvas"}
              >
                <Icon name={focus ? "collapse" : "expand"} size={17} />
              </button>
            </div>
            {mode === "interact" && (
              <div className="interaction-tip">
                <Icon name="cursor" size={13} />
                {selection
                  ? `${objectBounds(scene, selection)?.label || "Object"} selected · drag to move · two hands to resize`
                  : cameraState === "on"
                    ? "Point at an object. Pinch, move, release."
                    : "Drag a model, shape, or ink stroke to move it."}
                <button
                  onClick={() => {
                    setPanel("vision");
                    setInspectorOpen(true);
                    setVoiceOpen(false);
                  }}
                >
                  {cameraState === "on" ? "Hand settings" : "Enable hands"}
                </button>
              </div>
            )}
            {mode === "map" && (
              <div className="mapping-tip">
                <Icon name="map" size={15} />
                Drag each corner to fit your wall.
                <button onClick={() => chooseTool("draw")}>Done</button>
              </div>
            )}
          </div>
          <AgentPanel
            voiceOpen={voiceOpen}
            onVoiceOpen={() => setVoiceOpen(true)}
            onVoiceClose={() => setVoiceOpen(false)}
            scene={scene}
            canvas={canvas}
            onEdit={(edit) => {
              remember();
              setScene(edit);
            }}
            notify={notify}
          />
          <div className="workspace-footer">
            <span>
              <Icon name="check" size={12} />
              {saveStatus}
            </span>
            <span>
              <kbd>D</kbd>Draw<kbd>E</kbd>Erase<kbd>Space</kbd>Pause
              <button onClick={() => help.current.showModal()}>
                All shortcuts
                <Icon name="chevron" size={11} />
              </button>
            </span>
          </div>
          <input
            ref={importFile}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={loadFile}
          />
        </div>
      </main>
      <dialog ref={help} className="shortcuts-dialog">
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">MAKE IT SECOND NATURE</span>
            <h2>A few handy shortcuts.</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close shortcuts"
            onClick={() => help.current.close()}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="shortcut-list">
          {[
            ["D", "Draw"],
            ["E", "Erase"],
            ["M", "Fit to wall"],
            ["B", "Drawing board & expand"],
            ["Z", "Undo"],
            ["Space", "Pause animation"],
            ["F", "Fullscreen"],
            ["H", "Hide interface"],
            ["Esc", "Leave expanded canvas"],
          ].map(([key, label]) => (
            <div key={key}>
              <span>{label}</span>
              <kbd>{key}</kbd>
            </div>
          ))}
        </div>
        <p>Point to aim. Pinch to draw. The rest is up to you.</p>
      </dialog>
      <div
        id="toast"
        className={toast ? "show" : ""}
        role="status"
        aria-live="polite"
      >
        {toast && <Icon name="check" size={15} />} {toast}
      </div>
    </>
  );
}
