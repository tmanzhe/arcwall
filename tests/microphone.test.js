import test from "node:test";
import assert from "node:assert/strict";
import { MicrophoneRecorder } from "../src/microphone.js";
function fixture(getMedia) {
  let stopped = 0;
  const stream = { getTracks: () => [{ stop: () => stopped++ }] };
  class Recorder {
    static isTypeSupported(t) {
      return t.startsWith("audio/webm");
    }
    constructor() {
      this.mimeType = "audio/webm";
      this.state = "inactive";
    }
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      this.ondataavailable({ data: new Blob([new Uint8Array(200)]) });
      this.onstop();
    }
  }
  return {
    platform: {
      navigator: {
        mediaDevices: { getUserMedia: getMedia || (async () => stream) },
      },
      MediaRecorder: Recorder,
    },
    stream,
    stopped: () => stopped,
  };
}
test("stopping a recording releases the microphone and produces audio", async () => {
  const f = fixture();
  let blob;
  const recorder = new MicrophoneRecorder({
    platform: f.platform,
    onComplete: (value) => (blob = value),
    onError: () => {},
  });
  await recorder.start();
  recorder.stop();
  assert.equal(blob.size, 200);
  assert.equal(blob.type, "audio/webm");
  assert.ok(f.stopped() > 0);
});
test("cancel discards recorded audio and releases tracks", async () => {
  const f = fixture();
  let sent = false;
  const recorder = new MicrophoneRecorder({
    platform: f.platform,
    onComplete: () => (sent = true),
    onError: () => {},
  });
  await recorder.start();
  recorder.cancel();
  assert.equal(sent, false);
  assert.ok(f.stopped() > 0);
});
test("cancelling while permission is pending releases a late stream", async () => {
  let resolve;
  const f = fixture(() => new Promise((r) => (resolve = r)));
  const recorder = new MicrophoneRecorder({
    platform: f.platform,
    onComplete: () => assert.fail("must not send"),
    onError: () => {},
  });
  const starting = recorder.start();
  recorder.cancel();
  resolve(f.stream);
  await assert.rejects(starting, { name: "AbortError" });
  assert.ok(f.stopped() > 0);
});
