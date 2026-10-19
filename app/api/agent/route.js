import { SCENE_TOOL, validateEdit } from "../../../src/agent.js";
import { sanitizeScene } from "../../../src/scene.js";
export const runtime = "nodejs";
export async function GET() {
  return Response.json(
    { configured: Boolean(process.env.OPENAI_API_KEY), provider: "OpenAI" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
async function limitedJson(request) {
  if (!request.body) throw new Error("Missing request body.");
  const reader = request.body.getReader(),
    chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1500000) {
        await reader.cancel();
        throw new Error("Request too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function POST(request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json(
      { error: "Only same-origin requests are allowed." },
      { status: 403 },
    );
  if (!process.env.OPENAI_API_KEY)
    return Response.json(
      {
        error:
          "Add OPENAI_API_KEY to .env.local and restart the server to enable the drawing-aware agent. Local scene commands work without a key.",
      },
      { status: 503 },
    );
  let body, scene;
  try {
    body = await limitedJson(request);
    if (
      typeof body.prompt !== "string" ||
      !body.prompt.trim() ||
      body.prompt.length > 2000
    )
      throw new Error("Enter a prompt under 2,000 characters.");
    scene = sanitizeScene(body.scene);
    if (
      body.image &&
      (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(body.image) ||
        body.image.length > 900000)
    )
      throw new Error("Invalid canvas snapshot.");
  } catch (error) {
    return Response.json(
      { error: error.message || "Invalid request." },
      { status: 400 },
    );
  }
  try {
    const { strokes, ...summary } = scene;
    const input = [
      {
        role: "developer",
        content: `You are Arcwall, a concise creative collaborator for a holographic projection studio. The user may be talking with you by voice about their drawing. Answer naturally and briefly, usually in 1–4 sentences. Use update_scene to respond and propose changes only when requested. Changes are proposals until the user clicks Apply; never claim you already changed the scene. You see only the attached current canvas snapshot; never claim continuous vision, access to the webcam, or knowledge of the physical room. Focus on the user's freehand strokes and objects, distinguishing them from decorative grid, reactor, and arm graphics. Coordinates are normalized with top-left origin; shape x/y is its center. Keep changes within the scene tool; never claim to generate arbitrary 3D models or edit strokes. Null means unchanged. If asked to interpret a drawing without an image, ask the user to include the canvas. Be candid about what is visible. Current scene: ${JSON.stringify({ ...summary, strokeCount: strokes.length })}`,
      },
    ];
    for (const item of Array.isArray(body.history)
      ? body.history.slice(-6)
      : [])
      if (
        item &&
        ["user", "assistant"].includes(item.role) &&
        typeof item.text === "string"
      )
        input.push({ role: item.role, content: item.text.slice(0, 2000) });
    input.push({
      role: "user",
      content: [
        { type: "input_text", text: body.prompt },
        ...(body.image
          ? [{ type: "input_image", image_url: body.image, detail: "high" }]
          : []),
      ],
    });
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        store: false,
        input,
        tools: [SCENE_TOOL],
        tool_choice: { type: "function", name: "update_scene" },
        parallel_tool_calls: false,
        max_output_tokens: 1400,
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok)
      return Response.json(
        {
          error:
            response.status === 401
              ? "The server’s OpenAI API key was rejected."
              : response.status === 429
                ? "The AI provider is rate-limiting requests or has no available quota."
                : "The AI provider could not complete the request.",
        },
        { status: 502 },
      );
    const result = await response.json();
    const call = result.output?.find(
      (item) => item.type === "function_call" && item.name === "update_scene",
    );
    if (!call)
      return Response.json(
        { error: "The agent returned no scene response. Try rephrasing." },
        { status: 502 },
      );
    const action = JSON.parse(call.arguments);
    return Response.json({
      message:
        typeof action.message === "string"
          ? action.message.slice(0, 3000)
          : "Scene updated.",
      edit: validateEdit(action),
    });
  } catch {
    return Response.json(
      {
        error:
          "The agent connection failed or timed out. Your scene has been preserved.",
      },
      { status: 502 },
    );
  }
}
