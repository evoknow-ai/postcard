import { BackgroundProcessor } from "./background-processor.js";
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const sourceTabId=Number(params.get("sourceTabId"))||null;
const sourceWindowId=Number(params.get("sourceWindowId"))||null;
const embedded=params.get("embedded")==="1";
if(embedded)document.body.classList.add("embedded");

const supportedHosts=["x.com","twitter.com","facebook.com","www.facebook.com","instagram.com","www.instagram.com","linkedin.com","www.linkedin.com"];

let stream=null,recorder=null,chunks=[],blob=null,blobUrl=null,raf=null,timer=null,startAt=0;
let overlayX=0.5, overlayY=0.82;
let overlayDragging=false;
let overlayDragPointerId=null;
let segmentationSupported=false;
let nativeBlurSupported=false;
let segmentationReader=null;
let segmentationLoopToken=0;
let latestSegmentationMask=null;
let backgroundImage=null;
let backgroundImageUrl=null;

const fxPersonCanvas=document.createElement("canvas");
const fxBackgroundCanvas=document.createElement("canvas");
const fxSourceCanvas=document.createElement("canvas");

let videoZoom=1;
let videoPanX=0;
let videoPanY=0;
let videoDragging=false;
let videoPointerId=null;
let videoDragStartX=0;
let videoDragStartY=0;
let videoPanStartX=0;
let videoPanStartY=0;
let pointerMode=null;
let activePointerId=null;
let overlayBoundsCache=null,overlayGrabDX=0,overlayGrabDY=0;


async function ensureRecorderFocus(){
  try{
    if(document.visibilityState!=="visible" || !document.hasFocus()){
      window.focus();
      await new Promise(r=>setTimeout(r,120));
    }
  }catch(_){}
}


function status(msg,ok=true){$("status").textContent=msg;$("status").style.color=ok?"#8bd6a8":"#ff8f98";}
function setPermissionHint(){
  status("Recorder runs locally inside PostCard. Camera and microphone stay in your browser.",true);
}
function supportedTab(t){try{return supportedHosts.includes(new URL(t.url||"").hostname)}catch{return false}}

async function targetTab(){
  if(sourceTabId!=null){
    const original=await chrome.tabs.get(sourceTabId).catch(()=>null);
    if(supportedTab(original))return original;
  }
  if(sourceWindowId!=null){
    const [active]=await chrome.tabs.query({active:true,windowId:sourceWindowId});
    if(supportedTab(active))return active;
  }
  return null;
}
async function refreshDevices(){
  try{
    const devices=await navigator.mediaDevices.enumerateDevices();
    const cams=devices.filter(d=>d.kind==="videoinput");
    const mics=devices.filter(d=>d.kind==="audioinput");
    const oldCam=$("cameraSelect").value,oldMic=$("micSelect").value;
    $("cameraSelect").innerHTML='<option value="">Default camera</option>'+cams.map((d,i)=>`<option value="${d.deviceId}">${d.label||`Camera ${i+1}`}</option>`).join("");
    $("micSelect").innerHTML='<option value="">Default microphone</option>'+mics.map((d,i)=>`<option value="${d.deviceId}">${d.label||`Microphone ${i+1}`}</option>`).join("");
    if([...$("cameraSelect").options].some(o=>o.value===oldCam))$("cameraSelect").value=oldCam;
    if([...$("micSelect").options].some(o=>o.value===oldMic))$("micSelect").value=oldMic;
    $("useMic").disabled=!mics.length;if(!mics.length)$("useMic").checked=false;
    return {cams,mics};
  }catch{return {cams:[],mics:[]}}
}



let backgroundProcessor=null;
let processorReady=false;
const processedCanvas=document.createElement('canvas');

async function initBackgroundProcessor(){
  if(backgroundProcessor)return backgroundProcessor;

  backgroundProcessor=new BackgroundProcessor({
    video:$("cameraPreview"),
    canvas:processedCanvas,
    wasmBasePath:chrome.runtime.getURL("vendor/mediapipe/wasm"),
    modelPath:chrome.runtime.getURL("vendor/mediapipe/selfie_multiclass_256x256.tflite")
  });

  status("Loading background processor…");
  await backgroundProcessor.init();
  processorReady=true;

  backgroundProcessor.setMode($("backgroundMode")?.value||"none");
  backgroundProcessor.setBlurAmount(Number($("blurStrength")?.value)||14);
  backgroundProcessor.setColor($("backgroundColor")?.value||"#1f2937");

  return backgroundProcessor;
}

function updateBackgroundUi(){
  const mode=$("backgroundMode").value;
  $("blurControls").hidden=mode!=="blur";
  $("backgroundColorControls").hidden=mode!=="color";
  $("backgroundImageControls").hidden=mode!=="image";
  document.querySelectorAll(".bgModes [data-bg]").forEach(btn=>{
    btn.classList.toggle("active",btn.dataset.bg===mode);
  });
  $("backgroundBtn").classList.toggle("active",mode!=="none");
  if(backgroundProcessor)backgroundProcessor.setMode(mode);
}
async function startCamera(){
  stopStream();
  await ensureRecorderFocus();
  status("Requesting camera permission…");
  try{
    const camId=$("cameraSelect").value;
    const videoStream=await navigator.mediaDevices.getUserMedia({
      video:camId?{deviceId:{exact:camId},width:{ideal:1280},height:{ideal:720}}:{width:{ideal:1280},height:{ideal:720}},
      audio:false
    });
    let audioTracks=[];
    if($("useMic").checked){
      try{
        const micId=$("micSelect").value;
        const a=await navigator.mediaDevices.getUserMedia({audio:micId?{deviceId:{exact:micId}}:true,video:false});
        audioTracks=a.getAudioTracks();
      }catch(e){$("useMic").checked=false;status("Camera ready; microphone unavailable, recording will be video-only.");}
    }
    stream=new MediaStream([...videoStream.getVideoTracks(),...audioTracks]);
    $("cameraPreview").srcObject=stream;
    await $("cameraPreview").play();
    try{
      const bp=await initBackgroundProcessor();
      bp.start();
      processorReady=true;
    }catch(e){
      console.error("MediaPipe background processor failed:",e);
      status("Camera ready. Background processor failed to load.",false);
    }
    $("cameraHint").hidden=true;
    $("cameraHint").style.display="none";
    resetVideoFraming();
    $("startCamera").textContent="Stop camera";
    $("startCamera").classList.add("cameraOn");
    $("record").disabled=false;
    await refreshDevices();
    cancelAnimationFrame(raf);render();
    if(audioTracks.length)status("Camera and microphone ready.");else if(!$("status").textContent.includes("microphone"))status("Camera ready.");
  }catch(e){
    if(e.name==="NotAllowedError")status("Camera permission was denied. Allow camera access for PostCard/Chrome and try again.",false);
    else if(e.name==="NotFoundError")status("Chrome cannot see a camera. Check the webcam connection and Chrome/macOS Camera permission.",false);
    else if(e.name==="NotReadableError")status("The camera is busy in another application.",false);
    else status(`Camera unavailable: ${e.message}`,false);
    await refreshDevices();
  }
}
function stopStream(){
  try{backgroundProcessor?.stop();}catch(_){}
  processorReady=false;
  if(stream){
    stream.getTracks().forEach(t=>t.stop());
    stream=null;
  }
  $("cameraPreview").srcObject=null;
  $("startCamera").textContent="Start camera";
  $("record").disabled=true;
  $("stop").disabled=true;
  $("cameraHint").hidden=false;
  $("cameraHint").style.display="";
  $("cameraHint").textContent="Choose a camera and click Start camera.";
  cancelAnimationFrame(raf);
  raf=null;
  const c=$("recordCanvas"),ctx=c.getContext("2d");
  if(!processorReady)ctx.clearRect(0,0,c.width,c.height);
  ctx.fillStyle="#050506";
  ctx.fillRect(0,0,c.width,c.height);
}

function currentVideoRect(c,v){
  const fit=$("videoFit")?.value||"cover";
  const zoom=Math.max(1,Number(videoZoom)||1);
  const vw=v.videoWidth,vh=v.videoHeight;
  const cr=c.width/c.height,ir=vw/vh;
  let dw,dh;

  if(fit==="contain"){
    if(ir>cr){
      dw=c.width;
      dh=c.width/ir;
    }else{
      dh=c.height;
      dw=c.height*ir;
    }
  }else if(fit==="actual"){
    dw=vw;
    dh=vh;
  }else{
    if(ir>cr){
      dh=c.height;
      dw=c.height*ir;
    }else{
      dw=c.width;
      dh=c.width/ir;
    }
  }

  dw*=zoom;
  dh*=zoom;

  const maxPanX=Math.max(0,(dw-c.width)/2);
  const maxPanY=Math.max(0,(dh-c.height)/2);
  videoPanX=Math.max(-maxPanX,Math.min(maxPanX,videoPanX));
  videoPanY=Math.max(-maxPanY,Math.min(maxPanY,videoPanY));

  return {
    x:(c.width-dw)/2+videoPanX,
    y:(c.height-dh)/2+videoPanY,
    w:dw,
    h:dh
  };
}

function drawCameraSource(ctx,source,c,rect){
  const mirror=$("mirrorVideo")?.checked!==false;
  ctx.save();
  if(mirror){
    ctx.translate(c.width,0);
    ctx.scale(-1,1);
    ctx.drawImage(source,c.width-(rect.x+rect.w),rect.y,rect.w,rect.h);
  }else{
    ctx.drawImage(source,rect.x,rect.y,rect.w,rect.h);
  }
  ctx.restore();
}

function wrap(ctx,text,max){const out=[];for(const p of String(text||"").split("\n")){let line="";for(const w of p.split(/\s+/)){const t=line?`${line} ${w}`:w;if(line&&ctx.measureText(t).width>max){out.push(line);line=w}else line=t}out.push(line)}return out}
function render(){
  const c=$("recordCanvas"),ctx=c.getContext("2d"),v=$("cameraPreview");

  if(v.readyState>=2&&v.videoWidth){
    const rect=currentVideoRect(c,v);
    ctx.clearRect(0,0,c.width,c.height);

    const source=(processorReady && processedCanvas.width && processedCanvas.height)
      ? processedCanvas
      : v;

    drawCameraSource(ctx,source,c,rect);
  }else{
    ctx.clearRect(0,0,c.width,c.height);
    ctx.fillStyle="#050506";
    ctx.fillRect(0,0,c.width,c.height);
  }

  const text=$("overlayText").value.trim();
  overlayBoundsCache=null;
  if(text){
    const size=Number($("fontSize").value);
    ctx.font=`700 ${size}px Arial, sans-serif`;
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    ctx.fillStyle=$("textColor").value;
    ctx.shadowColor="#000";
    ctx.shadowBlur=10;
    ctx.lineJoin="round";
    ctx.lineWidth=5;
    ctx.strokeStyle="#000b";

    const lines=wrap(ctx,text,c.width*.86),lh=size*1.2;
    const cx=c.width*overlayX,cy=c.height*overlayY;
    const y0=cy-(lines.length-1)*lh/2;

    const textWidth=Math.min(c.width*.9,Math.max(...lines.map(l=>ctx.measureText(l).width),20));
    const textHeight=Math.max(lh,lines.length*lh);

    overlayBoundsCache={
      left:cx-textWidth/2-36,
      right:cx+textWidth/2+36,
      top:cy-textHeight/2-28,
      bottom:cy+textHeight/2+28
    };

    lines.forEach((l,i)=>{
      ctx.strokeText(l,cx,y0+i*lh,c.width*.9);
      ctx.fillText(l,cx,y0+i*lh,c.width*.9);
    });
    ctx.shadowColor="transparent";
  }

  raf=requestAnimationFrame(render);
}

function mime(){return["video/mp4;codecs=avc1.42E01E,mp4a.40.2","video/mp4;codecs=avc1","video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm"].find(MediaRecorder.isTypeSupported)||""}
async function record(){
  if(!stream){await startCamera();if(!stream)return}
  chunks=[];blob=null;if(blobUrl){URL.revokeObjectURL(blobUrl);blobUrl=null}$("afterRecord").hidden=true;
  const out=$("recordCanvas").captureStream(30),audio=stream.getAudioTracks()[0];if(audio)out.addTrack(audio);
  const type=mime();recorder=new MediaRecorder(out,type?{mimeType:type,videoBitsPerSecond:2500000}:undefined);
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  recorder.onstop=()=>{blob=new Blob(chunks,{type:recorder.mimeType||"video/webm"});blobUrl=URL.createObjectURL(blob);$("afterRecord").hidden=false;$("retake").disabled=false;status(`Video ready — ${(blob.size/1048576).toFixed(1)} MB.`)};
  recorder.start(500);startAt=Date.now();$("recordingBadge").hidden=false;$("record").disabled=true;$("stop").disabled=false;
  timer=setInterval(()=>{const s=Math.floor((Date.now()-startAt)/1000);$("recordingTime").textContent=`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;if(s>=60)stop()},250);status("Recording…");
}
function stop(){clearInterval(timer);if(recorder&&recorder.state!=="inactive")recorder.stop();$("recordingBadge").hidden=true;$("stop").disabled=true;$("record").disabled=false}
function retake(){blob=null;chunks=[];if(blobUrl){URL.revokeObjectURL(blobUrl);blobUrl=null}$("afterRecord").hidden=true;$("retake").disabled=true;status("Ready to record again.")}
function toDataUrl(b){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(b)})}
async function ensureScript(tabId){try{await chrome.tabs.sendMessage(tabId,{type:"POSTCARD_SITE_INFO"});return}catch{}await chrome.scripting.executeScript({target:{tabId},files:["content.js"]});await new Promise(r=>setTimeout(r,120))}
async function insert(){
  if(!blob){status("Record a video first.",false);return}
  const t=await targetTab();if(!t){status("Open X, Facebook, Instagram, or LinkedIn in the originating browser window.",false);return}
  try{await ensureScript(t.id);const data=await toDataUrl(blob),ext=(blob.type||"").includes("mp4")?"mp4":"webm";const res=await chrome.tabs.sendMessage(t.id,{type:"POSTCARD_INSERT_VIDEO",videoDataUrl:data,filename:`postcard-video.${ext}`,postText:""});if(res?.ok){status("Video inserted.");if(embedded)parent.postMessage({type:"POSTCARD_CLOSE_RECORDER"},"*");await chrome.tabs.update(t.id,{active:true});await chrome.windows.update(t.windowId,{focused:true})}else status(res?.error||"Could not insert video.",false)}catch(e){status(e.message,false)}
}

function canvasPoint(e){
  const c=$("recordCanvas");
  const r=c.getBoundingClientRect();
  return {
    x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),
    y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))
  };
}
function overlayBounds(){
  const c=$("recordCanvas"),ctx=c.getContext("2d");
  const text=$("overlayText").value.trim();
  if(!text)return null;
  const size=Number($("fontSize").value);
  ctx.font=`700 ${size}px Arial, sans-serif`;
  const lines=wrap(ctx,text,c.width*.86);
  const lh=size*1.2;
  const width=Math.min(c.width*.9,Math.max(...lines.map(l=>ctx.measureText(l).width),20));
  const height=Math.max(lh,lines.length*lh);
  return {
    left:c.width*overlayX-width/2-24,
    right:c.width*overlayX+width/2+24,
    top:c.height*overlayY-height/2-20,
    bottom:c.height*overlayY+height/2+20
  };
}
function pointerHitsOverlay(e){
  const c=$("recordCanvas"),r=c.getBoundingClientRect(),b=overlayBounds();
  if(!b)return false;
  const x=(e.clientX-r.left)*(c.width/r.width);
  const y=(e.clientY-r.top)*(c.height/r.height);
  return x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom;
}




function resetVideoFraming(){
  videoZoom=1;
  videoPanX=0;
  videoPanY=0;
  $("videoZoom").value="1";
  $("videoZoomValue").textContent="1.00×";
}
function syncZoomFromControl(){
  videoZoom=Math.max(1,Math.min(3,Number($("videoZoom").value)||1));
  $("videoZoomValue").textContent=videoZoom.toFixed(2)+"×";
}
function pointerHitsText(e){
  return overlayHitTest(e);
}
$("videoZoom").addEventListener("input",syncZoomFromControl);
$("videoFit").addEventListener("change",resetVideoFraming);
$("resetFraming").addEventListener("click",resetVideoFraming);

$("recordCanvas").addEventListener("wheel",e=>{
  if(!stream)return;
  e.preventDefault();
  videoZoom=Math.max(1,Math.min(3,videoZoom+(e.deltaY<0?.1:-.1)));
  $("videoZoom").value=String(videoZoom);
  $("videoZoomValue").textContent=videoZoom.toFixed(2)+"×";
},{passive:false});



function canvasCoords(e){
  const c=$("recordCanvas"),r=c.getBoundingClientRect();
  return {
    x:(e.clientX-r.left)*(c.width/r.width),
    y:(e.clientY-r.top)*(c.height/r.height),
    nx:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),
    ny:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))
  };
}
function overlayHitTest(e){
  if(!overlayBoundsCache)return false;
  const p=canvasCoords(e);
  return p.x>=overlayBoundsCache.left&&p.x<=overlayBoundsCache.right&&p.y>=overlayBoundsCache.top&&p.y<=overlayBoundsCache.bottom;
}




function updateCanvasCursor(e=null){
  const c=$("recordCanvas");
  if(pointerMode==="overlay"){c.className=c.className.replace(/\s*cursor-\S+|\s*dragging-\S+/g,"");c.classList.add("dragging-overlay");return;}
  if(pointerMode==="video"){c.className=c.className.replace(/\s*cursor-\S+|\s*dragging-\S+/g,"");c.classList.add("dragging-video");return;}
  c.classList.remove("dragging-overlay","dragging-video","cursor-text-drag","cursor-video-drag");
  if(e && overlayHitTest(e))c.classList.add("cursor-text-drag");
  else if(stream)c.classList.add("cursor-video-drag");
}
function endCanvasPointer(e){
  if(activePointerId!==e.pointerId)return;
  const c=$("recordCanvas");
  c.releasePointerCapture?.(e.pointerId);
  overlayDragging=false;
  videoDragging=false;
  overlayDragPointerId=null;
  videoPointerId=null;
  activePointerId=null;
  pointerMode=null;
  updateCanvasCursor(e);
}
$("recordCanvas").addEventListener("pointerup",endCanvasPointer);
$("recordCanvas").addEventListener("pointercancel",endCanvasPointer);
$("overlayText").addEventListener("input",()=>updateCanvasCursor(null));
$("fontSize")?.addEventListener("input",()=>{$("fontSizeValue").textContent=`${$("fontSize").value} px`;});


const interactionCanvas=$("recordCanvas");
interactionCanvas.onpointerdown=e=>{
  if(e.button!==0)return;
  const p=canvasCoords(e);
  activePointerId=e.pointerId;
  if(overlayHitTest(e)){
    pointerMode="overlay";
    overlayDragging=true;
    overlayGrabDX=p.nx-overlayX;
    overlayGrabDY=p.ny-overlayY;
    interactionCanvas.classList.add("dragging-overlay");
  }else if(stream){
    pointerMode="video";
    videoDragging=true;
    videoDragStartX=e.clientX;
    videoDragStartY=e.clientY;
    videoPanStartX=videoPanX;
    videoPanStartY=videoPanY;
    interactionCanvas.classList.add("dragging-video");
  }else{
    activePointerId=null;
    pointerMode=null;
    return;
  }
  e.preventDefault();
  e.stopPropagation();
  interactionCanvas.setPointerCapture?.(e.pointerId);
};
interactionCanvas.onpointermove=e=>{
  if(activePointerId===e.pointerId){
    if(pointerMode==="overlay"){
      const p=canvasCoords(e);
      overlayX=Math.max(0,Math.min(1,p.nx-overlayGrabDX));
      overlayY=Math.max(0,Math.min(1,p.ny-overlayGrabDY));
    }else if(pointerMode==="video"){
      const r=interactionCanvas.getBoundingClientRect();
      videoPanX=videoPanStartX+(e.clientX-videoDragStartX)*(interactionCanvas.width/r.width);
      videoPanY=videoPanStartY+(e.clientY-videoDragStartY)*(interactionCanvas.height/r.height);
    }
    e.preventDefault();
    return;
  }
  interactionCanvas.classList.remove("cursor-text-drag","cursor-video-drag");
  if(overlayHitTest(e))interactionCanvas.classList.add("cursor-text-drag");
  else if(stream)interactionCanvas.classList.add("cursor-video-drag");
};
function finishInteraction(e){
  if(activePointerId!==e.pointerId)return;
  interactionCanvas.releasePointerCapture?.(e.pointerId);
  activePointerId=null;
  pointerMode=null;
  overlayDragging=false;
  videoDragging=false;
  interactionCanvas.classList.remove("dragging-overlay","dragging-video");
}
interactionCanvas.onpointerup=finishInteraction;
interactionCanvas.onpointercancel=finishInteraction;
interactionCanvas.onlostpointercapture=()=>{
  activePointerId=null;
  pointerMode=null;
  overlayDragging=false;
  videoDragging=false;
  interactionCanvas.classList.remove("dragging-overlay","dragging-video");
};


$("backgroundMode")?.addEventListener("change",updateBackgroundUi);

document.querySelectorAll(".bgModes [data-bg]").forEach(btn=>{
  btn.addEventListener("click",()=>{
    $("backgroundMode").value=btn.dataset.bg;
    updateBackgroundUi();
    backgroundProcessor?.setMode(btn.dataset.bg);
    if(backgroundProcessor)backgroundProcessor.setMode(btn.dataset.bg);
  });
});
$("backgroundColor")?.addEventListener("input",()=>{
  const color=$("backgroundColor").value;
  if($("backgroundMode").value!=="color"){
    $("backgroundMode").value="color";
    updateBackgroundUi();
  }
  backgroundProcessor?.setColor(color);
});


function closeVideoPopovers(){
  $("zoomPopover").hidden=true;
  $("backgroundPopover").hidden=true;
}
$("fitBtn")?.addEventListener("click",()=>{
  const order=["cover","contain","actual"];
  const current=$("videoFit").value;
  const next=order[(order.indexOf(current)+1)%order.length];
  $("videoFit").value=next;
  $("fitLabel").textContent=next[0].toUpperCase()+next.slice(1);
  resetVideoFraming();
});
$("zoomBtn")?.addEventListener("click",e=>{
  e.stopPropagation();
  const was=$("zoomPopover").hidden;
  closeVideoPopovers();
  $("zoomPopover").hidden=!was;
});
$("backgroundBtn")?.addEventListener("click",e=>{
  e.stopPropagation();
  const was=$("backgroundPopover").hidden;
  closeVideoPopovers();
  $("backgroundPopover").hidden=!was;
});
$("mirrorBtn")?.addEventListener("click",()=>{
  $("mirrorVideo").checked=!$("mirrorVideo").checked;
  $("mirrorBtn").classList.toggle("active",$("mirrorVideo").checked);
});
document.addEventListener("click",e=>{
  if(!e.target.closest(".toolPopover") && !e.target.closest("#zoomBtn") && !e.target.closest("#backgroundBtn")){
    closeVideoPopovers();
  }
});
$("videoZoom")?.addEventListener("input",()=>{
  $("zoomLabel").textContent=(Number($("videoZoom").value)||1).toFixed(2)+"×";
});
$("backgroundMode")?.addEventListener("change",()=>{
  const mode=$("backgroundMode").value;
  $("backgroundBtn").classList.toggle("active",mode!=="none");
});

$("blurStrength")?.addEventListener("input",()=>{
  const value=Math.min(24,Number($("blurStrength").value)||14);
  $("blurStrengthValue").textContent=`${value} px`;
  backgroundProcessor?.setBlurAmount(value);
});
$("backgroundImageFile")?.addEventListener("change",async e=>{
  const file=e.target.files?.[0];
  if(!file)return;
  try{
    const bp=await initBackgroundProcessor();
    await bp.setImage(file);
    $("removeBackgroundImage").disabled=false;
    $("backgroundMode").value="image";
    updateBackgroundUi();
    bp.setMode("image");
  }catch(err){
    status("Could not load background image.",false);
    console.error(err);
  }
});
$("removeBackgroundImage")?.addEventListener("click",()=>{
  if(backgroundProcessor)backgroundProcessor.bgImage=null;
  $("backgroundImageFile").value="";
  $("removeBackgroundImage").disabled=true;
  $("backgroundMode").value="none";
  updateBackgroundUi();
  backgroundProcessor?.setMode("none");
});

$("startCamera").onclick=async()=>{
  if(stream){
    if(recorder&&recorder.state!=="inactive")stop();
    stopStream();
    status("Camera off.");
  }else{
    await startCamera();
  }
};
$("record").onclick=record;$("stop").onclick=stop;$("retake").onclick=retake;
$("download").onclick=()=>{if(!blob)return;const a=document.createElement("a"),ext=(blob.type||"").includes("mp4")?"mp4":"webm";a.href=blobUrl;a.download=`postcard-video.${ext}`;a.click()};
$("insert").onclick=insert;$("cameraSelect").onchange=()=>{if(stream)startCamera()};$("micSelect").onchange=()=>{if(stream&&$("useMic").checked)startCamera()};$("useMic").onchange=()=>{if(stream)startCamera()};
window.addEventListener("pagehide",()=>{stopStream();cancelAnimationFrame(raf)});
setPermissionHint();refreshDevices();
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible")refreshDevices();
});
window.addEventListener("focus",refreshDevices);

$("backToEditor")?.addEventListener("click",async()=>{
  try{
    if(embedded)parent.postMessage({type:"POSTCARD_CLOSE_RECORDER"},"*");
    const result=await chrome.runtime.sendMessage({
      type:"POSTCARD_OPEN_EDITOR",
      sourceTabId,
      sourceWindowId
    });
    if(!result?.ok)throw new Error(result?.error||"Editor did not open.");
    if(!embedded)window.close();
  }catch(e){
    status("Could not reopen editor: "+e.message,false);
  }
});
