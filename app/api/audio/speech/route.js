import {
  sameOrigin,
  readJson,
  providerError,
  NO_STORE,
} from "../../../../src/server/request.js";
export const runtime = "nodejs";
export async function POST(request) {
  if (!sameOrigin(request))
    return Response.json(
      { error: "Only same-origin requests are allowed." },
      { status: 403 },
    );
  if (!process.env.OPENAI_API_KEY)
    return Response.json(
      { error: "Add OPENAI_API_KEY to .env.local to enable spoken replies." },
      { status: 503 },
    );
  let text;
  try {
    const body = await readJson(request);
    if (
      typeof body.text !== "string" ||
      !body.text.trim() ||
      body.text.length > 3000
    )
      throw new Error("Speech text must contain 1–3,000 characters.");
    text = body.text;
  } catch (error) {
    return Response.json(
      { error: error.message || "Invalid speech request." },
      { status: 400 },
    );
  }
  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_SPEECH_MODEL || "gpt-4o-mini-tts",
        voice: process.env.OPENAI_VOICE || "cedar",
        input: text,
        response_format: "mp3",
        instructions:
          "Speak as a calm, warm, concise creative collaborator. Use a natural conversational pace. Do not imitate a real person or a fictional character.",
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok)
      return Response.json(
        { error: providerError(response.status) },
        { status: 502 },
      );
    return new Response(response.body, {
      headers: { ...NO_STORE, "Content-Type": "audio/mpeg" },
    });
  } catch {
    return Response.json(
      {
        error:
          "Speech generation failed or timed out. Your written response is still available.",
      },
      { status: 502 },
    );
  }
}
