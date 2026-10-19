import {
  sameOrigin,
  readBytes,
  providerError,
  NO_STORE,
} from "../../../../src/server/request.js";
export const runtime = "nodejs";
const formats = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/mpeg": "mp3",
};
export async function POST(request) {
  if (!sameOrigin(request))
    return Response.json(
      { error: "Only same-origin requests are allowed." },
      { status: 403 },
    );
  if (!process.env.OPENAI_API_KEY)
    return Response.json(
      {
        error:
          "Add OPENAI_API_KEY to .env.local to enable voice conversations.",
      },
      { status: 503 },
    );
  const mime = (request.headers.get("content-type") || "").split(";")[0].trim();
  if (!Object.hasOwn(formats, mime))
    return Response.json(
      {
        error:
          "Unsupported recording format. Use a modern Chrome, Edge, or Safari browser.",
      },
      { status: 415 },
    );
  let bytes;
  try {
    bytes = await readBytes(request, 4000000);
    if (bytes.length < 100)
      throw new Error("Recording is empty or too short. Please try again.");
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  try {
    const data = new FormData();
    data.append(
      "file",
      new Blob([bytes], { type: mime }),
      `question.${formats[mime]}`,
    );
    data.append(
      "model",
      process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
    );
    data.append("response_format", "json");
    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: data,
        signal: AbortSignal.timeout(45000),
      },
    );
    if (!response.ok)
      return Response.json(
        { error: providerError(response.status) },
        { status: 502 },
      );
    const result = await response.json(),
      text = typeof result.text === "string" ? result.text.trim() : "";
    if (!text)
      return Response.json(
        {
          error:
            "No speech was detected. Move closer to your microphone and try again.",
        },
        { status: 422 },
      );
    return Response.json({ text: text.slice(0, 2000) }, { headers: NO_STORE });
  } catch {
    return Response.json(
      {
        error:
          "Transcription failed or timed out. You can still type your question.",
      },
      { status: 502 },
    );
  }
}
