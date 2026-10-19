import { GestureInterpreter } from './gestures.js';
// Inference runs in a worker so model detection cannot block projector animation.
export class VisionController {
  constructor(video,canvas,onResult,getScene,onError){Object.assign(this,{video,canvas,onResult,getScene,onError});this.gestures=new GestureInterpreter();this.stopped=false;this.busy=false;this.timer=null;}
  async start(){
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera requires localhost or HTTPS in a modern browser.');
    this.stream=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480,facingMode:'user'},audio:false});
    if(this.stopped){this.stream.getTracks().forEach(t=>t.stop());return;}
    this.video.srcObject=this.stream;await this.video.play();
    this.worker=new Worker('/vision-worker.js',{type:'module'});
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('Hand model timed out. Check your internet connection and retry.')),60000);
      this.worker.onerror=()=>{clearTimeout(timeout);reject(new Error('Vision worker could not start. Try Chrome or Edge.'));};
      this.worker.onmessage=({data})=>{if(data.type==='ready'){clearTimeout(timeout);resolve();}else if(data.type==='error'){clearTimeout(timeout);reject(new Error(data.message));}};
      this.worker.postMessage({type:'init'});
    });
    if(this.stopped)return;
    this.worker.onmessage=({data})=>{
      this.busy=false;if(this.stopped)return;
      if(data.type==='error'){this.onError(data.message);return;}
      if(data.type==='result'){const result=this.gestures.interpret(data.hands,this.getScene());this.drawPreview(result);this.onResult(result);}
    };
    this.worker.onerror=()=>this.onError('Hand tracking stopped unexpectedly. You can restart the camera.');
    this.timer=setInterval(()=>this.frame(),50);
    this.stream.getVideoTracks()[0].addEventListener('ended',()=>{if(!this.stopped)this.onError('The camera disconnected. Reconnect it and enable tracking again.');});
  }
  async frame(){
    if(this.stopped||this.busy||this.video.readyState<2)return;
    this.busy=true;
    try{const bitmap=await createImageBitmap(this.video);if(this.stopped){bitmap.close();return;}this.worker.postMessage({type:'frame',bitmap,timestamp:performance.now()},[bitmap]);}catch{this.busy=false;this.onError('Could not read camera frames. Try Chrome or Edge.');}
  }
  drawPreview(result){
    const c=this.canvas.getContext('2d');this.canvas.width=640;this.canvas.height=480;c.clearRect(0,0,640,480);c.strokeStyle='#91ffda';c.fillStyle='#91ffda';c.lineWidth=2;
    const edges=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
    for(const hand of result.hands){for(const [a,b]of edges){c.beginPath();c.moveTo(hand[a][0]*640,hand[a][1]*480);c.lineTo(hand[b][0]*640,hand[b][1]*480);c.stroke();}for(const p of hand){c.beginPath();c.arc(p[0]*640,p[1]*480,3,0,Math.PI*2);c.fill();}}
  }
  stop(){this.stopped=true;clearInterval(this.timer);this.worker?.terminate();this.stream?.getTracks().forEach(t=>t.stop());if(this.video)this.video.srcObject=null;}
}
