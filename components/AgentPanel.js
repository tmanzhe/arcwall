"use client";
import { useEffect, useRef, useState } from "react";
import { localCommand } from "../src/agent.js";
import { applySceneEdit } from "../src/scene.js";
export default function AgentPanel({ scene, canvas, onEdit, notify }) {
  const [configured, setConfigured] = useState(false),
    [prompt, setPrompt] = useState(""),
    [attach, setAttach] = useState(false),
    [busy, setBusy] = useState(false),
    [messages, setMessages] = useState([]),
    [pending, setPending] = useState(null);
  const latest = useRef(scene);
  latest.current = scene;
  useEffect(() => {
    fetch("/api/agent")
      .then((r) => r.json())
      .then((data) => setConfigured(Boolean(data.configured)))
      .catch(() => {});
  }, []);
  async function send(e) {
    e.preventDefault();
    if (!prompt.trim() || busy) return;
    const text = prompt.trim();
    setPrompt("");
    setPending(null);
    setMessages((m) => [...m.slice(-11), { role: "user", text }]);
    if (!configured) {
      const result = localCommand(text, latest.current);
      if (result) {
        onEdit(applySceneEdit(latest.current, result.edit));
        setMessages((m) => [...m, { role: "assistant", text: result.message }]);
      } else
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: "Local command mode: try “make the core bigger”, “hide the grid”, “add a circle”, or “turn everything amber”. Drawing interpretation needs an OpenAI API key in .env.local.",
          },
        ]);
      return;
    }
    setBusy(true);
    try {
      let image;
      if (attach) {
        const small = document.createElement("canvas");
        small.width = 960;
        small.height = 540;
        small.getContext("2d").drawImage(canvas.current, 0, 0, 960, 540);
        image = small.toDataURL("image/jpeg", 0.7);
      }
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          scene: latest.current,
          image,
          history: messages.slice(-6),
        }),
        signal: AbortSignal.timeout(55000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Agent request failed.");
      setMessages((m) => [...m, { role: "assistant", text: data.message }]);
      const meaningful = Object.entries(data.edit || {}).some(([key, value]) =>
        key === "addShapes" ? value.length > 0 : true,
      );
      if (meaningful) setPending(data.edit);
    } catch (error) {
      setMessages((m) => [...m, { role: "assistant", text: error.message }]);
      notify(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="agent-panel">
      <div className="agent-heading">
        <div>
          <span className="live-dot" />
          <strong>Scene intelligence</strong>
          <span className="agent-badge">
            {configured ? "AI CONNECTED" : "LOCAL COMMANDS"}
          </span>
        </div>
        <span className="agent-caption">
          {configured
            ? "Canvas-aware collaboration"
            : "No API key needed to experiment"}
        </span>
      </div>
      {messages.length > 0 && (
        <div className="agent-messages" aria-live="polite">
          {messages.slice(-4).map((m, i) => (
            <div key={i} className={m.role}>
              <span>{m.role === "user" ? "YOU" : "ARC"}</span>
              <p>{m.text}</p>
            </div>
          ))}
          {busy && <p className="thinking">Reading the scene…</p>}
        </div>
      )}
      {pending && (
        <div className="agent-proposal">
          <span>
            Proposed changes:{" "}
            {Object.keys(pending)
              .filter((k) => k !== "addShapes" || pending[k].length)
              .join(", ")}
          </span>
          <button
            onClick={() => {
              onEdit(applySceneEdit(latest.current, pending));
              setPending(null);
              notify("Agent changes applied. Undo is available.");
            }}
          >
            Apply changes
          </button>
          <button onClick={() => setPending(null)}>Dismiss</button>
        </div>
      )}
      <form onSubmit={send}>
        <span className="prompt-icon">✧</span>
        <input
          aria-label="Scene command"
          value={prompt}
          maxLength={2000}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            configured
              ? "Ask about your drawing, or describe a scene change…"
              : "Try “make the core bigger and turn it amber”…"
          }
        />
        <button className="primary" disabled={busy || !prompt.trim()}>
          {busy
            ? "Thinking…"
            : configured && attach
              ? "Send + canvas ↗"
              : "Send ↗"}
        </button>
      </form>
      <div className="agent-bottom">
        <label>
          <input
            type="checkbox"
            checked={attach}
            onChange={(e) => setAttach(e.target.checked)}
            disabled={!configured}
          />
          Attach canvas snapshot
        </label>
        <span>
          {configured
            ? "Sending shares your prompt and scene with OpenAI. Webcam video stays local."
            : "Set OPENAI_API_KEY in .env.local for drawing-aware AI. Voice is on the roadmap."}
        </span>
      </div>
    </section>
  );
}
