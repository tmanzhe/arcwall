import { clamp, cssHomography } from "../src/geometry.js";
export default function ProjectionStage({
  scene,
  stageSize,
  canvasRef,
  stageRef,
  onDown,
  onMove,
  onUp,
  onLeave,
  output,
  outputPrompt,
  onFullscreen,
  onDismiss,
}) {
  return (
    <div id="stage-wrap">
      <div
        id="stage"
        ref={stageRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onLostPointerCapture={onUp}
        onPointerLeave={onLeave}
      >
        <canvas
          ref={canvasRef}
          id="scene"
          width={1920}
          height={1080}
          style={{
            transformOrigin: "0 0",
            transform: cssHomography(scene.quad, ...stageSize),
          }}
          aria-label="Interactive holographic projection canvas"
        />
        <svg id="mapping" viewBox="0 0 1920 1080">
          <polygon
            id="quad-outline"
            points={scene.quad
              .map(([x, y]) => `${x * 1920},${y * 1080}`)
              .join(" ")}
          />
          {scene.quad.map(([x, y], i) => (
            <g key={i}>
              <circle
                className="map-handle"
                cx={clamp(x * 1920, 15, 1905)}
                cy={clamp(y * 1080, 15, 1065)}
                r={15}
              />
              <text
                x={clamp(x * 1920 + 25, 20, 1830)}
                y={clamp(y * 1080 + 35, 35, 1040)}
              >
                0{i + 1}
              </text>
            </g>
          ))}
        </svg>
        {output && outputPrompt && (
          <div id="output-start">
            <button onClick={onFullscreen} className="primary">
              Enter fullscreen
            </button>
            <span>
              Move this window to your projector · press F for fullscreen
            </span>
            <button onClick={onDismiss}>Dismiss</button>
          </div>
        )}
      </div>
    </div>
  );
}
