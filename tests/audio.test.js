import test from "node:test";
import assert from "node:assert/strict";
import { POST as transcribe } from "../app/api/audio/transcribe/route.js";
import { POST as speech } from "../app/api/audio/speech/route.js";
import { readBytes } from "../src/server/request.js";
function key(t, value = "test-only") {
  const old = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = value;
  t.after(() => {
    if (old === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = old;
  });
}
const audioRequest = (origin = "http://localhost:8787", mime = "audio/webm") =>
  new Request("http://localhost:8787/api/audio/transcribe", {
    method: "POST",
    headers: { origin, "Content-Type": mime },
    body: new Uint8Array(200),
  });
test("audio routes fail clearly without a key and reject cross-origin calls", async (t) => {
  key(t, "");
  assert.equal((await transcribe(audioRequest())).status, 503);
  assert.equal(
    (
      await speech(
        new Request("http://localhost/api/audio/speech", { method: "POST" }),
      )
    ).status,
    503,
  );
  assert.equal(
    (await transcribe(audioRequest("https://example.com"))).status,
    403,
  );
});
test("transcription forwards bounded audio with server-side auth", async (t) => {
  key(t);
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/audio/transcriptions");
    assert.equal(options.headers.Authorization, "Bearer test-only");
    assert.equal(options.body.get("file").size, 200);
    assert.equal(options.body.get("model"), "gpt-4o-mini-transcribe");
    return Response.json({ text: "What do you think of this sketch?" });
  });
  const response = await transcribe(audioRequest());
  assert.equal(response.status, 200);
  assert.equal(
    (await response.json()).text,
    "What do you think of this sketch?",
  );
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("bad recording formats and empty speech are rejected before provider calls", async (t) => {
  key(t);
  assert.equal(
    (await transcribe(audioRequest(undefined, "text/html"))).status,
    415,
  );
  assert.equal(
    (
      await speech(
        new Request("http://localhost/api/audio/speech", {
          method: "POST",
          body: JSON.stringify({ text: "" }),
        }),
      )
    ).status,
    400,
  );
});
test("spoken replies return audio without exposing the API key", async (t) => {
  key(t);
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/audio/speech");
    const body = JSON.parse(options.body);
    assert.equal(body.input, "Your drawing looks like a small rocket.");
    assert.equal(body.response_format, "mp3");
    return new Response(new Uint8Array([1, 2, 3]));
  });
  const response = await speech(
    new Request("http://localhost/api/audio/speech", {
      method: "POST",
      body: JSON.stringify({ text: "Your drawing looks like a small rocket." }),
    }),
  );
  assert.equal(response.headers.get("content-type"), "audio/mpeg");
  assert.equal((await response.arrayBuffer()).byteLength, 3);
});
test("audio body limit applies even without Content-Length", async () => {
  const request = new Request("http://localhost", {
    method: "POST",
    body: new Uint8Array(101),
  });
  await assert.rejects(() => readBytes(request, 100), /too large/);
});
