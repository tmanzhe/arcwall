let pipelinePromise;
self.onmessage = async ({ data }) => {
  try {
    if (!pipelinePromise)
      pipelinePromise = (async () => {
        const { pipeline, env } =
          await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js");
        env.allowLocalModels = false;
        env.backends.onnx.wasm.numThreads = 1;
        return pipeline(
          "depth-estimation",
          "onnx-community/depth-anything-v2-small",
          {
            device: "wasm",
            dtype: "q8",
            progress_callback: (event) =>
              self.postMessage({
                type: "progress",
                status: event.status,
                progress: event.progress,
              }),
          },
        );
      })();
    const estimator = await pipelinePromise;
    const { depth } = await estimator(data.image);
    self.postMessage(
      {
        type: "depth",
        data: depth.data,
        width: depth.width,
        height: depth.height,
        channels: depth.channels,
      },
      [depth.data.buffer],
    );
  } catch (error) {
    pipelinePromise = null;
    self.postMessage({
      type: "error",
      message: error.message || "Depth estimation failed.",
    });
  }
};
