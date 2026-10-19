let landmarker;
self.onmessage=async({data})=>{
  try{
    if(data.type==='init'){
      const {FilesetResolver,HandLandmarker}=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/vision_bundle.mjs');
      const files=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm');
      landmarker=await HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.6,minTrackingConfidence:.5});
      self.postMessage({type:'ready'});
    }else if(data.type==='frame'){
      try{const result=landmarker.detectForVideo(data.bitmap,data.timestamp);self.postMessage({type:'result',hands:result.landmarks});}finally{data.bitmap.close();}
    }
  }catch(error){self.postMessage({type:'error',message:`Hand tracking: ${error.message||'model failed to load'}`});}
};
