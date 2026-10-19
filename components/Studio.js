'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Renderer } from '../src/renderer.js';
import { DEFAULT_SCENE, PRESETS, sanitizeScene } from '../src/scene.js';
import { clamp, cssHomography, homography, IDENTITY_QUAD, project, validQuad } from '../src/geometry.js';

const CHANNEL = 'arcwall-studio-v1';
function Range({ label, value, min, max, unit='%', onChange }) {
  return <label className="range-label">{label}<output>{unit==='×'?(value/100).toFixed(1):Math.round(value)}{unit}</output><input aria-label={label} type="range" min={min} max={max} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>;
}
function Section({ number, title, status, children }) { return <section><div className="section-heading"><h2>{number} <span>{title}</span></h2><span>{status}</span></div>{children}</section>; }
export default function Studio() {
  const [scene, setScene] = useState(DEFAULT_SCENE);
  const sceneRef=useRef(scene);sceneRef.current=scene;
  const [mode,setMode]=useState('draw'),[clean,setClean]=useState(false),[output,setOutput]=useState(false),[fps,setFps]=useState(0),[toast,setToast]=useState(''),[ready,setReady]=useState(false);
  const [cameraState,setCameraState]=useState('off'),[gesture,setGesture]=useState('Looking for hands…'),[stageSize,setStageSize]=useState([1,1]),[outputPrompt,setOutputPrompt]=useState(true);
  const canvas=useRef(null),stage=useRef(null),video=useRef(null),preview=useRef(null),channel=useRef(null),renderer=useRef(null),vision=useRef(null),interaction=useRef({}),stroke=useRef(null),pointerDown=useRef(false),corner=useRef(null),history=useRef([]),importFile=useRef(null),toastTimer=useRef(null),alive=useRef(true);
  const outputRef=useRef(false),modeRef=useRef('draw');modeRef.current=mode;
  const notify=useCallback(message=>{setToast(message);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),5000);},[]);
  const remember=useCallback(()=>{history.current=[...history.current.slice(-29),sceneRef.current];},[]);
  const patch=useCallback(values=>setScene(s=>({...s,...values})),[]);
  const update=useCallback((key,value)=>patch({[key]:value}),[patch]);
  const undo=useCallback(()=>{const last=history.current.pop();if(last)setScene(last);},[]);
  const finishStroke=useCallback(()=>{
    if(stroke.current?.points.length){const completed=stroke.current;remember();setScene(s=>({...s,strokes:[...s.strokes.slice(-299),completed]}));}
    stroke.current=null;interaction.current.activeStroke=null;
  },[remember]);
  const trace=useCallback((point, drawing)=>{
    interaction.current.pointer=point;interaction.current.pinching=drawing;
    if(drawing){if(!stroke.current)stroke.current={color:sceneRef.current.ink,points:[]};const pts=stroke.current.points,last=pts.at(-1);if(pts.length<3000&&(!last||Math.hypot(last[0]-point[0],last[1]-point[1])>.001))pts.push(point);interaction.current.activeStroke=stroke.current;}
    else if(stroke.current)finishStroke();
  },[finishStroke]);
  useEffect(()=>{
    alive.current=true;const isOutput=new URLSearchParams(location.search).has('output');setOutput(isOutput);setClean(isOutput);outputRef.current=isOutput;
    try {const stored=localStorage.getItem('arcwall-scene');if(stored)setScene(sanitizeScene(JSON.parse(stored)));}catch{notify('Saved scene could not be loaded. Starting fresh.');}
    setReady(true);
    const bc=new BroadcastChannel(CHANNEL);channel.current=bc;
    bc.onmessage=({data})=>{
      if(data.type==='request'&&!isOutput)bc.postMessage({type:'scene',scene:sceneRef.current});
      if(data.type==='scene'&&isOutput){try{setScene(sanitizeScene(data.scene));}catch{}}
      if(data.type==='interaction'&&isOutput)interaction.current=data.interaction;
      if(data.type==='hello'&&isOutput)bc.postMessage({type:'request'});
    };
    bc.postMessage({type:isOutput?'request':'hello'});
    const r=new Renderer(canvas.current,()=>sceneRef.current,()=>interaction.current,setFps);renderer.current=r;
    const observer=new ResizeObserver(entries=>{const {width,height}=entries[0].contentRect;setStageSize([width,height]);});observer.observe(stage.current);
    const timer=setInterval(()=>{if(!isOutput)bc.postMessage({type:'interaction',interaction:interaction.current});},50);
    return()=>{alive.current=false;r.stop();observer.disconnect();clearInterval(timer);clearTimeout(toastTimer.current);bc.close();vision.current?.stop();};
  },[notify]);
  useEffect(()=>{
    if(!ready)return;
    if(!output)channel.current?.postMessage({type:'scene',scene});
    if(output)return;
    const timer=setTimeout(()=>{try{localStorage.setItem('arcwall-scene',JSON.stringify(scene));}catch{notify('Browser storage is full. Export your scene to keep it.');}},500);
    return()=>clearTimeout(timer);
  },[scene,ready,output,notify]);
  useEffect(()=>{document.body.classList.toggle('clean',clean);document.body.classList.toggle('output',output);document.body.classList.toggle('mapping',mode==='map'&&!output);return()=>{document.body.classList.remove('clean','output','mapping');};},[clean,output,mode]);
  const fullscreen=useCallback(async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();setOutputPrompt(false);}catch{notify('Use your browser’s fullscreen menu to fill the projector.');}},[notify]);
  useEffect(()=>{
    const onKey=e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.metaKey||e.ctrlKey||e.altKey)return;const key=e.key.toLowerCase();if(key==='h')setClean(v=>!v);if(key==='f')fullscreen();if(key==='m')setMode('map');if(key==='d')setMode('draw');if(key==='z')undo();if(key===' '){e.preventDefault();patch({paused:!sceneRef.current.paused});}};
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[fullscreen,patch,undo]);
  function screenPoint(e){const rect=stage.current.getBoundingClientRect();return [clamp((e.clientX-rect.left)/rect.width,0,1),clamp((e.clientY-rect.top)/rect.height,0,1)];}
  function canvasPoint(e){const p=screenPoint(e);try{return project(homography(sceneRef.current.quad,IDENTITY_QUAD),...p).map(v=>clamp(v,0,1));}catch{return p;}}
  function down(e){if(output||e.button!==0)return;stage.current.setPointerCapture(e.pointerId);if(mode==='map'){const p=screenPoint(e);let index=-1,dist=.05;scene.quad.forEach((q,i)=>{const d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(d<dist){index=i;dist=d;}});if(index>=0){remember();corner.current=index;}}else{pointerDown.current=true;trace(canvasPoint(e),true);}}
  function move(e){if(output)return;if(corner.current!==null){const q=sceneRef.current.quad.map(p=>[...p]);q[corner.current]=screenPoint(e);if(validQuad(q))patch({quad:q});}else if(mode==='draw')trace(canvasPoint(e),pointerDown.current);}
  function up(){corner.current=null;pointerDown.current=false;finishStroke();interaction.current.pinching=false;}
  async function toggleCamera(){
    if(vision.current){vision.current.stop();vision.current=null;setCameraState('off');interaction.current={};finishStroke();return;}
    setCameraState('loading');setGesture('Loading hand model…');
    try{
      const {VisionController}=await import('../src/vision.js');
      const controller=new VisionController(video.current,preview.current,results=>{
        if(!alive.current)return;
        interaction.current.hands=results.hands;setGesture(results.gesture);
        if(results.pointer&&modeRef.current==='draw')trace(results.pointer,results.pinching);
        else {finishStroke();interaction.current.pointer=results.pointer;interaction.current.pinching=false;}
        if(results.scale!==null)patch({scale:results.scale});
      },()=>sceneRef.current,error=>{notify(error);vision.current?.stop();vision.current=null;setCameraState('off');finishStroke();interaction.current={};});
      vision.current=controller;await controller.start();if(alive.current)setCameraState('on');
    }catch(error){vision.current?.stop();vision.current=null;setCameraState('off');notify(error.message||'Camera could not start.');}
  }
  function launch(){const win=window.open('/?output=1','arcwall-output','popup,width=1280,height=720');if(!win)notify('Allow pop-ups for localhost to open the projector window.');else notify('Move the output window to your projector. Press F for fullscreen.');}
  function download(data,name){const url=URL.createObjectURL(data),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function loadFile(e){const file=e.target.files?.[0];if(!file)return;try{if(file.size>5000000)throw new Error('Scene file is too large (maximum 5 MB).');const raw=JSON.parse(await file.text());if(raw.version!==1)throw new Error('Unsupported scene version.');const next=sanitizeScene(raw.scene);remember();setScene(next);notify('Scene imported.');}catch(error){notify(error.message);}e.target.value='';}
  function snapshot(){canvas.current.toBlob(blob=>{if(blob)download(blob,'arcwall-snapshot.png');});}
  return <>
    <header><a className="brand" href="/"><span className="brandmark">A</span> ARCWALL <small>PROJECTION STUDIO</small></a><div className="header-right"><span className="live-dot"/><span>SYSTEM ONLINE</span><button onClick={launch} className="primary">Launch projector ↗</button></div></header>
    <main><aside className="sidebar"><div className="eyebrow">CONTROL DESK <span>01 / LIVE</span></div><h1>Your room.<br/><em>Reimagined.</em></h1><p className="intro">Shape light. Build your own interface.</p>
      <Section number="01" title="Environment" status="LIVE RENDER"><div className="presets">{Object.entries(PRESETS).map(([name,color])=><button key={name} onClick={()=>update('preset',name)} className={scene.preset===name?'selected':''}><i style={{'--swatch':color}}/>{name==='arc'?'Arc blue':name==='ember'?'Ember':'Ghost'}</button>)}</div><Range label="Light intensity" value={scene.brightness} min={20} max={100} onChange={v=>update('brightness',v)}/><Range label="Motion speed" value={scene.speed} min={0} max={200} unit="×" onChange={v=>update('speed',v)}/></Section>
      <Section number="02" title="Holograms" status="COMPOSE"><div className="toggle-row">{[['grid','Spatial grid'],['sphere','Reactor core'],['arm','Robot arm'],['telemetry','Telemetry']].map(([key,label])=><label key={key}><input type="checkbox" checked={scene[key]} onChange={e=>update(key,e.target.checked)}/>{label}</label>)}</div><Range label="Core scale" value={scene.scale} min={40} max={180} onChange={v=>update('scale',v)}/><div className="position-grid">{['X','Y'].map(axis=><label key={axis}>Core {axis}<input type="range" aria-label={`Core ${axis}`} min={axis==='X'?10:15} max={axis==='X'?90:85} value={scene['sphere'+axis]} onChange={e=>update('sphere'+axis,Number(e.target.value))}/></label>)}</div></Section>
      <Section number="03" title="Vision control" status={cameraState==='on'?'TRACKING':cameraState==='loading'?'LOADING':'OFFLINE'}><button onClick={toggleCamera} disabled={cameraState==='loading'} className="wide">{cameraState==='off'?'◎ Enable hand tracking':cameraState==='loading'?'Loading vision model…':'◉ Stop camera'}</button><div id="camera-box" hidden={cameraState==='off'}><video ref={video} autoPlay playsInline muted/><canvas ref={preview}/><span>{gesture}</span></div><p className="hint">Point to aim · Pinch to draw<br/>Two open hands to resize the core</p><label className="switch-label"><input type="checkbox" checked={scene.skeleton} onChange={e=>update('skeleton',e.target.checked)}/>Project hand skeleton</label><Range label="Pinch sensitivity" value={scene.sensitivity} min={15} max={65} unit="" onChange={v=>update('sensitivity',v)}/><p className="privacy">Camera stays on your device. Internet is needed to load the hand model.</p></Section>
    </aside><div className="workspace"><div className="workspace-top"><div><span className="live-dot"/> LIVE CANVAS <span className="subtle">/ 1920 × 1080</span></div><div id="fps">{fps} FPS</div></div><div id="stage-wrap"><div id="stage" ref={stage} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up} onPointerLeave={()=>{if(!pointerDown.current&&cameraState!=='on')interaction.current.pointer=null;}}>
      <canvas ref={canvas} id="scene" width={1920} height={1080} style={{transformOrigin:'0 0',transform:cssHomography(scene.quad,...stageSize)}} aria-label="Interactive holographic projection canvas"/>
      <svg id="mapping" viewBox="0 0 1920 1080"><polygon id="quad-outline" points={scene.quad.map(([x,y])=>`${x*1920},${y*1080}`).join(' ')}/>{scene.quad.map(([x,y],i)=><g key={i}><circle className="map-handle" cx={clamp(x*1920,15,1905)} cy={clamp(y*1080,15,1065)} r={15}/><text x={clamp(x*1920+25,20,1830)} y={clamp(y*1080+35,35,1040)}>0{i+1}</text></g>)}</svg>
      {output&&outputPrompt&&<div id="output-start"><button onClick={fullscreen} className="primary">Enter fullscreen</button><span>Move this window to your projector · press F for fullscreen</span><button onClick={()=>setOutputPrompt(false)}>Dismiss</button></div>}
    </div></div><div className="canvas-footer"><span><i className="live-dot"/> {mode==='map'?'DRAG THE FOUR CORNERS TO ALIGN':'READY TO PROJECT'}</span><span>HOLD & DRAG TO DRAW <kbd>D</kbd> DRAW <kbd>M</kbd> MAP <kbd>H</kbd> HIDE UI</span></div><div className="tools"><div className="tool-group"><button className={mode==='draw'?'selected':''} onClick={()=>{finishStroke();setMode('draw');}}>✎ Draw</button><button className={mode==='map'?'selected':''} onClick={()=>{finishStroke();setMode('map');}}>⌗ Fit to wall</button><button onClick={undo}>↶ Undo</button><button onClick={()=>{remember();patch({strokes:[]});}}>Clear ink</button></div><div className="tool-group"><label className="ink-label">INK <input aria-label="Ink color" type="color" value={scene.ink} onChange={e=>update('ink',e.target.value)}/></label><button onClick={()=>update('paused',!scene.paused)}>{scene.paused?'▷ Play':'Ⅱ Pause'}</button><button onClick={snapshot}>↓ Snapshot</button></div></div>
      <AgentPanel scene={scene} canvas={canvas} onEdit={edit=>{remember();setScene(edit);}} notify={notify}/>
      <div className="bottom-cards"><article><div className="card-number">01 — OUTPUT</div><h3>A wall becomes a workspace.</h3><p>Connect your projector as an extended display. Launch the output, move it across, and go fullscreen.</p></article><article><div className="card-number">02 — ALIGN</div><h3>Make the light fit.</h3><p>Choose Fit to wall and drag the four corner handles. Adjustments appear on the projector instantly.</p><button className="text-button" onClick={()=>{remember();patch({quad:IDENTITY_QUAD});}}>Reset alignment ↗</button></article><article><div className="card-number">03 — KEEP</div><h3>Save your setup.</h3><p>Your scene saves in this browser. Export a file to keep a copy or move to another laptop.</p><button className="text-button" onClick={()=>download(new Blob([JSON.stringify({version:1,scene},null,2)],{type:'application/json'}),'arcwall-scene.json')}>Export scene ↗</button><button className="text-button" onClick={()=>importFile.current.click()}>Import ↗</button><input ref={importFile} type="file" accept="application/json,.json" hidden onChange={loadFile}/></article></div>
    </div></main><div id="toast" className={toast?'show':''} role="status" aria-live="polite">{toast}</div>
  </>;
}

function AgentPanel(){return <div className="agent-placeholder"><span className="live-dot"/> SCENE INTELLIGENCE <span>Drawing-aware agent · coming into focus</span></div>;}
