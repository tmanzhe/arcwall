"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { localCommand, sceneContext } from "../src/agent.js";
import { applySceneEdit } from "../src/scene.js";
import { MicrophoneRecorder } from "../src/microphone.js";
import Icon from "./Icon";
const LABELS = {
  idle: "Ready when you are",
  starting: "Opening microphone…",
  listening: "Listening to you",
  transcribing: "Turning speech into text…",
  thinking: "Thinking it through…",
  preparing: "Preparing a spoken reply…",
  speaking: "Arc is speaking",
};
export default function AgentPanel({
  scene,
  canvas,
  onEdit,
  notify,
  voiceOpen = false,
  onVoiceOpen = () => {},
  onVoiceClose = () => {},
}) {
  const [configured, setConfigured] = useState(false),
    [checking, setChecking] = useState(true),
    [prompt, setPrompt] = useState(""),
    [attach, setAttach] = useState(true),
    [busy, setBusy] = useState(false),
    [messages, setMessages] = useState([]),
    [pending, setPending] = useState(null),
    [expanded, setExpanded] = useState(false),
    [phase, setPhase] = useState("idle"),
    [error, setError] = useState(""),
    [snapshot, setSnapshot] = useState(null),
    [speakReplies, setSpeakReplies] = useState(true),
    [level, setLevel] = useState(0),
    [seconds, setSeconds] = useState(0),
    [hasAudio, setHasAudio] = useState(false);
  const latest = useRef(scene),
    messageRef = useRef(messages),
    attachRef = useRef(attach),
    speakRef = useRef(speakReplies),
    recorder = useRef(null),
    request = useRef(null),
    epoch = useRef(0),
    audio = useRef(null),
    audioUrl = useRef(null),
    chat = useRef(null),
    alive = useRef(true);
  latest.current = scene;
  messageRef.current = messages;
  attachRef.current = attach;
  speakRef.current = speakReplies;
  const checkConnection = useCallback(async () => {
    setChecking(true);
    try {
      const r = await fetch("/api/agent", { cache: "no-store" });
      if (!r.ok) throw new Error("Could not reach the local agent server.");
      const data = await r.json();
      if (alive.current) {
        setConfigured(Boolean(data.configured));
        setError("");
      }
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setChecking(false);
    }
  }, []);
  const takeSnapshot = useCallback(() => {
    if (!canvas.current) return;
    const small = document.createElement("canvas");
    small.width = 1280;
    small.height = 720;
    small.getContext("2d").drawImage(canvas.current, 0, 0, 1280, 720);
    const image = small.toDataURL("image/jpeg", 0.78);
    setSnapshot({
      image,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    });
    return image;
  }, [canvas]);
  const cancelTurn = useCallback(() => {
    epoch.current++;
    request.current?.abort();
    request.current = null;
    recorder.current?.cancel();
    recorder.current = null;
    audio.current?.pause();
    if (audio.current) audio.current.currentTime = 0;
    setPhase("idle");
    setBusy(false);
    setLevel(0);
  }, []);
  useEffect(() => {
    alive.current = true;
    checkConnection();
    return () => {
      alive.current = false;
      epoch.current++;
      request.current?.abort();
      recorder.current?.cancel();
      audio.current?.pause();
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    };
  }, [checkConnection]);
  useEffect(() => {
    if (voiceOpen) {
      takeSnapshot();
      checkConnection();
    } else cancelTurn();
  }, [voiceOpen, takeSnapshot, checkConnection, cancelTurn]);
  useEffect(() => {
    if (phase !== "listening") return;
    const start = Date.now();
    setSeconds(0);
    const timer = setInterval(
      () => setSeconds(Math.min(30, Math.floor((Date.now() - start) / 1000))),
      250,
    );
    return () => clearInterval(timer);
  }, [phase]);
  useEffect(() => {
    if (chat.current) chat.current.scrollTop = chat.current.scrollHeight;
  }, [messages, busy, voiceOpen]);
  async function jsonRequest(path, options, signal) {
    const r = await fetch(path, {
      ...options,
      signal: AbortSignal.any([signal, AbortSignal.timeout(55000)]),
    });
    const data = await r.json().catch(() => ({
      error: "The local server returned an unreadable response.",
    }));
    if (!r.ok) throw new Error(data.error || "The request failed.");
    return data;
  }
  function current(id) {
    return alive.current && epoch.current === id;
  }
  async function speak(text, id, controller) {
    if (!speakRef.current || !current(id)) return;
    setPhase("preparing");
    setBusy(true);
    try {
      const r = await fetch("/api/audio/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 3000) }),
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(55000),
        ]),
      });
      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.error || "Could not generate a spoken reply.");
      }
      const blob = await r.blob();
      if (!current(id)) return;
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
      const url = URL.createObjectURL(blob);
      audioUrl.current = url;
      const player = new Audio(url);
      audio.current = player;
      setHasAudio(true);
      player.onended = () => {
        if (current(id)) setPhase("idle");
      };
      player.onerror = () => {
        if (current(id)) {
          setPhase("idle");
          setError("Audio playback failed. The written response is available.");
        }
      };
      setBusy(false);
      try {
        await player.play();
        if (current(id)) setPhase("speaking");
      } catch {
        if (current(id)) {
          setPhase("idle");
          setError(
            "Your browser paused playback. Press Play reply to hear the answer.",
          );
        }
      }
    } catch (e) {
      if (current(id) && !controller.signal.aborted) {
        setError(e.message);
        setPhase("idle");
        setBusy(false);
      }
    }
  }
  async function runTurn(
    text,
    { id, controller, spoken = false, image, contextScene },
  ) {
    if (!current(id)) return;
    setExpanded(true);
    setPending(null);
    setError("");
    setHasAudio(false);
    setBusy(true);
    setPhase("thinking");
    const history = messageRef.current
      .slice(-6)
      .map((m) => ({ role: m.role, text: m.text }));
    setMessages((m) => [
      ...m.slice(-15),
      { role: "user", text, image, spoken },
    ]);
    if (!configured) {
      const local = localCommand(text, latest.current);
      if (local) {
        onEdit(applySceneEdit(latest.current, local.edit));
        setMessages((m) => [...m, { role: "assistant", text: local.message }]);
      } else
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: "I can run simple local scene commands, but discussing your drawing needs an OpenAI API key. Add it in .env.local and use Recheck connection.",
          },
        ]);
      setPhase("idle");
      setBusy(false);
      return;
    }
    try {
      const data = await jsonRequest(
        "/api/agent",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: text,
            scene: sceneContext(contextScene || latest.current),
            image,
            history,
          }),
        },
        controller.signal,
      );
      if (!current(id)) return;
      setMessages((m) => [...m, { role: "assistant", text: data.message }]);
      const meaningful = Object.entries(data.edit || {}).some(([key, value]) =>
        key === "addShapes" ? value.length > 0 : true,
      );
      if (meaningful) setPending(data.edit);
      setBusy(false);
      setPhase("idle");
      if (spoken && speakRef.current) await speak(data.message, id, controller);
    } catch (e) {
      if (current(id) && !controller.signal.aborted) {
        setError(e.message);
        setPhase("idle");
        setBusy(false);
      }
    }
  }
  function send(e) {
    e.preventDefault();
    const text = prompt.trim();
    if (!text || busy) return;
    cancelTurn();
    const id = epoch.current,
      controller = new AbortController();
    request.current = controller;
    setPrompt("");
    runTurn(text, {
      id,
      controller,
      image: attachRef.current && configured ? takeSnapshot() : undefined,
      spoken: voiceOpen,
      contextScene: latest.current,
    });
  }
  async function recorded(blob, id) {
    recorder.current = null;
    if (!current(id)) return;
    const controller = new AbortController();
    request.current = controller;
    const image = attachRef.current ? takeSnapshot() : undefined;
    const contextScene = latest.current;
    setPhase("transcribing");
    setBusy(true);
    try {
      const result = await jsonRequest(
        "/api/audio/transcribe",
        {
          method: "POST",
          headers: { "Content-Type": blob.type || "audio/webm" },
          body: blob,
        },
        controller.signal,
      );
      if (current(id))
        await runTurn(result.text, {
          id,
          controller,
          spoken: true,
          image,
          contextScene,
        });
    } catch (e) {
      if (current(id) && !controller.signal.aborted) {
        setError(e.message);
        setPhase("idle");
        setBusy(false);
      }
    }
  }
  async function toggleMic() {
    if (phase === "listening") {
      recorder.current?.stop();
      return;
    }
    if (!configured) {
      setError(
        "Add OPENAI_API_KEY to .env.local, then recheck the connection.",
      );
      return;
    }
    cancelTurn();
    setError("");
    setHasAudio(false);
    const id = epoch.current;
    setPhase("starting");
    const mic = new MicrophoneRecorder({
      onComplete: (blob) => recorded(blob, id),
      onLevel: (value) => {
        if (current(id)) setLevel(value);
      },
      onError: (e) => {
        if (current(id)) {
          setError(e.message);
          setPhase("idle");
          setBusy(false);
        }
      },
    });
    recorder.current = mic;
    try {
      await mic.start();
      if (current(id)) setPhase("listening");
    } catch (e) {
      if (current(id)) {
        setPhase("idle");
        setError(
          e.name === "NotAllowedError"
            ? "Microphone permission was denied. Allow microphone access for this local app and try again."
            : e.name === "NotFoundError"
              ? "No microphone was found. Connect one, or type your question."
              : e.message,
        );
        recorder.current = null;
      }
    }
  }
  async function replay() {
    if (!audio.current) return;
    const id = epoch.current;
    audio.current.onended = () => {
      if (current(id)) setPhase("idle");
    };
    audio.current.currentTime = 0;
    setError("");
    try {
      await audio.current.play();
      if (current(id)) setPhase("speaking");
    } catch {
      setError("Audio playback is unavailable. The written reply is below.");
    }
  }
  function apply() {
    onEdit(applySceneEdit(latest.current, pending));
    setPending(null);
    notify("Agent changes applied. Undo is available.");
  }
  function proposal() {
    return (
      pending && (
        <div className="agent-proposal">
          <span>
            Suggested changes:{" "}
            {Object.keys(pending)
              .filter((k) => k !== "addShapes" || pending[k].length)
              .join(", ")}
          </span>
          <button onClick={apply}>Apply changes</button>
          <button onClick={() => setPending(null)}>Dismiss</button>
        </div>
      )
    );
  }
  function conversation(drawer = false) {
    return messages.length > 0 ? (
      <div
        ref={drawer ? chat : undefined}
        className={drawer ? "voice-messages" : "agent-messages"}
        aria-live="polite"
      >
        {messages.slice(-12).map((m, i) => (
          <div key={i} className={m.role}>
            <span>
              {m.role === "user" ? "YOU" : "ARC"}
              {m.spoken ? " · VOICE" : ""}
              {m.image ? " · CANVAS" : ""}
            </span>
            <p>{m.text}</p>
          </div>
        ))}
        {busy && <p className="thinking">{LABELS[phase]}</p>}
      </div>
    ) : drawer ? (
      <div className="voice-empty">
        <Icon name="spark" size={23} />
        <h3>Think out loud.</h3>
        <p>
          Draw something, then ask me about it. I can look at the canvas, talk
          through ideas, and suggest scene changes.
        </p>
        <button onClick={() => setPrompt("What do you see in my drawing?")}>
          “What do you see in my drawing?”
        </button>
        <button onClick={() => setPrompt("How could I improve this sketch?")}>
          “How could I improve this sketch?”
        </button>
      </div>
    ) : null;
  }
  function composer(drawer = false) {
    return (
      <form onSubmit={send} className={drawer ? "voice-composer" : ""}>
        <input
          aria-label={drawer ? "Message Arc assistant" : "Scene command"}
          value={prompt}
          maxLength={2000}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            drawer
              ? "Or type your question…"
              : configured
                ? "Ask about your canvas…"
                : "Try “make the core bigger and turn it amber”…"
          }
        />
        {!drawer && (
          <button
            type="button"
            className="icon-button"
            aria-label="Open voice assistant"
            onClick={onVoiceOpen}
          >
            <Icon name="mic" size={15} />
          </button>
        )}
        <button className="primary" disabled={busy || !prompt.trim()}>
          {busy ? "Thinking…" : configured && attach ? "Send + canvas" : "Send"}
          <Icon name="chevron" size={12} />
        </button>
      </form>
    );
  }
  return (
    <>
      {!voiceOpen && (
        <section
          className={"agent-panel " + (expanded ? "expanded" : "compact")}
        >
          <div className="agent-heading">
            <div>
              <Icon name="spark" size={18} />
              <strong>Arc assistant</strong>
              <span className="agent-badge">
                {configured ? "AI CONNECTED" : "LOCAL COMMANDS"}
              </span>
            </div>
            <button
              className="icon-button agent-toggle"
              aria-label={expanded ? "Collapse assistant" : "Expand assistant"}
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
            >
              <Icon name="chevron" size={14} />
            </button>
          </div>
          {expanded && conversation()}
          {expanded && proposal()}
          {composer()}
          <div className="agent-bottom" hidden={!expanded && !configured}>
            <label>
              <input
                type="checkbox"
                checked={attach}
                onChange={(e) => setAttach(e.target.checked)}
                disabled={!configured}
              />
              Include canvas
            </label>
            <span>
              {configured
                ? "Your prompt and selected canvas go to OpenAI. Webcam video stays local."
                : "Open Assistant on the left to set up voice and canvas conversations."}
            </span>
          </div>
          {error && (
            <p className="voice-error" role="alert">
              {error}
            </p>
          )}
        </section>
      )}
      {voiceOpen && (
        <aside className="voice-drawer" aria-label="Arc voice assistant">
          <div className="voice-drawer-header">
            <div>
              <span className="eyebrow">YOUR CREATIVE COLLABORATOR</span>
              <h2>
                <Icon name="spark" size={19} />
                Arc assistant
                <span
                  className={
                    "connection-dot " + (configured ? "connected" : "")
                  }
                />
              </h2>
            </div>
            <button
              className="icon-button"
              aria-label="Close voice assistant"
              onClick={() => {
                cancelTurn();
                onVoiceClose();
              }}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          <div className="voice-orb-area" data-phase={phase}>
            <div className="voice-orb" style={{ "--level": level }}>
              <div />
              <div />
              <Icon name={phase === "listening" ? "mic" : "spark"} size={25} />
            </div>
            <div className="voice-phase" role="status">
              {checking
                ? "Checking connection…"
                : !configured
                  ? "Connect your AI to begin"
                  : LABELS[phase]}
            </div>
            <div className="voice-substatus">
              {phase === "listening"
                ? `${seconds}s / 30s · click again to send`
                : configured
                  ? "Ask, sketch, explore. One question at a time."
                  : "Text commands still work without an API key."}
            </div>
            <div className="voice-buttons">
              <button
                className={
                  "talk-button " + (phase === "listening" ? "recording" : "")
                }
                onClick={toggleMic}
                disabled={!configured || checking || phase === "starting"}
                aria-label={
                  phase === "listening"
                    ? "Stop recording and send question"
                    : "Start voice question"
                }
              >
                <Icon name={phase === "listening" ? "stop" : "mic"} size={18} />
                {phase === "listening"
                  ? "Finish question"
                  : phase === "speaking"
                    ? "Interrupt & talk"
                    : "Talk to Arc"}
              </button>
              {phase !== "idle" && (
                <button className="voice-cancel" onClick={cancelTurn}>
                  <Icon name="close" size={14} />
                  Cancel
                </button>
              )}
              {hasAudio && phase === "idle" && (
                <button className="voice-cancel" onClick={replay}>
                  <Icon name="play" size={14} />
                  Play reply
                </button>
              )}
            </div>
          </div>
          {!configured && (
            <div className="voice-setup">
              <strong>One small setup step.</strong>
              <p>
                Add <code>OPENAI_API_KEY</code> to <code>.env.local</code> in
                the Arcwall project. Your key stays on the server.
              </p>
              <button disabled={checking} onClick={checkConnection}>
                <Icon name="refresh" size={13} />
                {checking ? "Checking…" : "Recheck connection"}
              </button>
            </div>
          )}
          <div className="voice-context">
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={attach}
                  onChange={(e) => setAttach(e.target.checked)}
                />
                Include canvas with each question
              </label>
              <button
                className="icon-button"
                aria-label="Refresh canvas preview"
                title="Refresh canvas preview"
                onClick={takeSnapshot}
              >
                <Icon name="refresh" size={14} />
              </button>
            </div>
            {attach && snapshot && (
              <div className="voice-snapshot">
                <img
                  src={snapshot.image}
                  alt="Canvas snapshot preview for the next question"
                />
                <span>
                  <Icon name="camera" size={11} />
                  Preview · {snapshot.time}
                </span>
              </div>
            )}
            <p>
              {attach
                ? "A fresh snapshot is taken when you finish each question."
                : "Only your words and scene settings will be shared."}
            </p>
          </div>
          {error && (
            <p className="voice-error" role="alert">
              {error}
            </p>
          )}
          <div className="voice-conversation">
            {conversation(true)}
            {proposal()}
          </div>
          <div className="voice-bottom">
            {composer(true)}
            <div className="voice-preferences">
              <label>
                <input
                  type="checkbox"
                  checked={speakReplies}
                  onChange={(e) => {
                    setSpeakReplies(e.target.checked);
                    if (
                      !e.target.checked &&
                      ["preparing", "speaking"].includes(phase)
                    )
                      cancelTurn();
                  }}
                />
                <Icon name={speakReplies ? "volume" : "muted"} size={13} />
                Spoken replies
              </label>
              <span>AI-generated voice</span>
            </div>
            <p className="voice-disclosure">
              When you finish a recording, audio goes to OpenAI for
              transcription. Questions, conversation, scene settings, and
              included canvas snapshots also go to OpenAI. Webcam video is never
              attached.
            </p>
          </div>
        </aside>
      )}
    </>
  );
}
