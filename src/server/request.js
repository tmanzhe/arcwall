export function sameOrigin(request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
export async function readBytes(request, limit) {
  if (!request.body) throw new Error("Missing request body.");
  const reader = request.body.getReader(),
    chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
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
  return bytes;
}
export async function readJson(request, limit = 16000) {
  return JSON.parse(new TextDecoder().decode(await readBytes(request, limit)));
}
export function providerError(status) {
  return status === 401
    ? "The server’s OpenAI API key was rejected."
    : status === 429
      ? "OpenAI has rate-limited this request or the account has no available quota."
      : "The audio provider could not complete the request.";
}
export const NO_STORE = { "Cache-Control": "no-store" };
