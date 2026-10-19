# Arcwall roadmap

The project grows in independently usable stages. Finish and demonstrate each stage before expanding the agent's capabilities.

## 1. Projection playground — implemented, hardware validation pending

- [x] Laptop control desk and separate projector output.
- [x] Animated grid, wireframe reactor, and articulated arm.
- [x] Layer, color, speed, size, and position controls.
- [x] Four-corner perspective mapping and inverse pointer coordinates.
- [x] Autosave, scene export/import, snapshots, and incremental Git history.
- [ ] Record a short demo with the real projector.

**Acceptance:** move the output onto the projector, fit it to a wall, and change the scene from the laptop without showing controls on the wall.

## 2. Drawing workspace — implemented

- [x] Mouse and touch ink with color selection.
- [x] Adjustable eraser that splits strokes at the erased section.
- [x] Undoable clear board, including drawing shapes.
- [x] Expanded drawing board with accessible tools and hidden decorative holograms.
- [x] Editable rectangle and ellipse objects.
- [ ] Object picking, direct dragging, and resize handles.
- [ ] Multi-surface layouts and per-surface masking.

**Acceptance:** draw, erase part of a line, undo the cut, clear the board, restore it, and save/reload the layout.

## 3. Vision control — implemented, real-camera validation pending

- [x] Worker-based hand landmark inference.
- [x] Mirrored, smoothed pointer and hand skeleton.
- [x] Pinch to draw or erase with hysteresis.
- [x] Two open hands resize the reactor.
- [x] Tracking-loss behavior and camera teardown.
- [ ] Measure tracking stability and latency with the actual webcam.
- [ ] Calibrate four camera points to corresponding projection points.
- [ ] Pinch to grab scene objects; two-hand object transforms.

**Acceptance:** draw several separate strokes by pinching, release without unwanted connecting lines, and lose/reacquire the hand without drawing a jump. Then validate camera-to-wall calibration independently.

## 4. Drawing-aware AI — foundation implemented, live API validation pending

- [x] Optional server-side OpenAI configuration.
- [x] Explicit canvas snapshot attachment and current scene summary.
- [x] Strict scene-edit function schema and bounded client/server validation.
- [x] Review proposed changes before applying; undo after application.
- [x] Local deterministic scene commands for experimenting without an AI key.
- [ ] Validate a live image-aware conversation with the chosen model.
- [ ] Expand tools to select and edit existing objects by stable ID.
- [ ] Add object-linked annotations and geometric sketch interpretation.

**Acceptance:** sketch a layout, ask the agent to interpret it, request a supported object change, apply it, and undo it without losing any newer drawing.

## 5. Voice collaborator — recorded turns implemented, live API validation pending

- [x] Click-to-talk recording with transcript, written response, and spoken reply.
- [x] Side-panel entry point, canvas preview, and explicit snapshot controls.
- [x] Recording cap, cancellation, playback interruption, replay, and microphone cleanup.
- [x] Reuse the same validated scene tools for voice edits.
- [x] Controlled canvas snapshots rather than continuous webcam uploads.
- [ ] Validate a real recorded question and spoken response with the configured API key.
- [ ] Realtime audio transport and interruption handling.
- [ ] Resolve “this,” “that,” and “over here” using selection and pointing context.
- [ ] Per-session API usage and cost visibility.

**Current acceptance:** ask a recorded question about a drawing, inspect its transcript and snapshot, hear the reply, cancel or interrupt it, and apply an undoable scene proposal. Validate microphone cleanup on close and denied-permission behavior.

**Future acceptance:** point at an object and say “move this to the left”; the agent identifies the selected object and handles continuous, interruptible conversation.

## Portfolio demonstration

Show a working vertical slice: a laptop controls a mapped wall; a hand draws on it; an eraser removes part of a stroke; an AI request makes a supported scene change. Document the rendering math, worker pipeline, latency measurements, and limitations alongside the demo. Avoid presenting roadmap features as finished capabilities.
