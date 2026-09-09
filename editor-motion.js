let cardExportRunning=false;
function syncMotionControls(){
  const block=selected();
  const angle=block?textAngle(block):0;
  const dial=document.getElementById("rotationDial");
  if(dial){dial.style.setProperty("--angle",`${angle}deg`);dial.setAttribute("aria-valuenow",String(angle));dial.setAttribute("aria-disabled",String(!block));}
  const rotation=document.getElementById("textRotation");if(rotation){rotation.value=angle;rotation.disabled=!block;}
  for(const [id,value] of [["textAnimation",block?.animation||"none"],["textAnimDuration",block?.animDuration??.7],["textAnimDelay",block?.animDelay??0],["bgMotion",bg.motion||"none"],["bgMotionStrength",bg.motionStrength??8]]){
    const control=document.getElementById(id);if(control)control.value=value;
  }
  document.getElementById("textAnimDurationValue").textContent=`${block?.animDuration??.7}s`;
  document.getElementById("textAnimDelayValue").textContent=`${block?.animDelay??0}s`;
  document.getElementById("bgMotionStrengthValue").textContent=`${bg.motionStrength??8}%`;
}
function setTextRotation(value,snap=false){
  const block=selected();if(!block||!Number.isFinite(Number(value)))return;
  block.rotation=snapTextAngle(Number(value),snap);renderBlocks();commitHistory();scheduleSave();
}
const rotationDial=document.getElementById("rotationDial");
let rotationPointer=null;
function rotateFromPointer(event){
  const rect=rotationDial.getBoundingClientRect();
  const angle=Math.atan2(event.clientY-rect.top-rect.height/2,event.clientX-rect.left-rect.width/2)*180/Math.PI+90;
  setTextRotation(angle,!event.altKey);
}
rotationDial.addEventListener("pointerdown",event=>{
  if(event.button!==0||!selected())return;
  event.preventDefault();event.stopPropagation();document.activeElement?.blur?.();
  rotationPointer=event.pointerId;rotationDial.setPointerCapture(event.pointerId);rotateFromPointer(event);
});
rotationDial.addEventListener("pointermove",event=>{if(event.pointerId===rotationPointer)rotateFromPointer(event);});
for(const type of ["pointerup","pointercancel","lostpointercapture"])rotationDial.addEventListener(type,event=>{
  if(event.pointerId!==rotationPointer)return;rotationPointer=null;
  if(rotationDial.hasPointerCapture(event.pointerId))rotationDial.releasePointerCapture(event.pointerId);
});
rotationDial.addEventListener("keydown",event=>{
  if(!selected())return;
  const delta={ArrowRight:1,ArrowUp:1,ArrowLeft:-1,ArrowDown:-1}[event.key];
  if(delta){event.preventDefault();event.stopPropagation();setTextRotation(textAngle(selected())+delta*(event.shiftKey?45:1));}
});
document.getElementById("textRotation").addEventListener("change",event=>setTextRotation(event.target.value));
document.querySelectorAll("[data-angle]").forEach(button=>button.addEventListener("click",()=>setTextRotation(button.dataset.angle)));
for(const [id,key] of [["textAnimation","animation"],["textAnimDuration","animDuration"],["textAnimDelay","animDelay"]]){
  document.getElementById(id).addEventListener("input",event=>{
    const block=selected();if(!block)return;block[key]=key==="animation"?event.target.value:Number(event.target.value);
    syncMotionControls();commitHistory();scheduleSave();
  });
}
for(const [id,key] of [["bgMotion","motion"],["bgMotionStrength","motionStrength"]]){
  document.getElementById(id).addEventListener("input",event=>{bg[key]=key==="motion"?event.target.value:Number(event.target.value);syncMotionControls();commitHistory();scheduleSave();});
}
document.getElementById("exportCardVideoBtn").addEventListener("click",()=>document.getElementById("cardExportDialog").showModal());
document.getElementById("closeCardExportBtn").addEventListener("click",()=>{if(!cardExportRunning)document.getElementById("cardExportDialog").close();});
document.getElementById("cardExportDialog").addEventListener("cancel",event=>{if(cardExportRunning)event.preventDefault();});
document.getElementById("startCardExportBtn").addEventListener("click",exportCardMp4);
async function exportCardMp4(){
  if(cardExportRunning)return;
  const duration=Number(document.getElementById("cardVideoDuration").value);
  const status=document.getElementById("cardExportStatus"),progress=document.getElementById("cardExportProgress");
  if(!Number.isFinite(duration)||duration<1||duration>600){status.textContent="Choose a duration from 1 to 600 seconds.";return;}
  cardExportRunning=true;
  for(const id of ["startCardExportBtn","closeCardExportBtn","cardVideoDuration"])document.getElementById(id).disabled=true;
  let prepared=null,stream=null,recorder=null;
  try{
    const mime=mp4RecorderType();progress.value=0;status.textContent="Preparing animation…";
    await document.fonts.ready;
    prepared=await prepareSceneAnimations(serializeSlide());
    const canvas=await exportCanvas(sceneFrameOptions(prepared,0));
    canvas.getContext("2d").getImageData(0,0,1,1);
    stream=canvas.captureStream(30);
    recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:5000000});
    const chunks=[];let recordingError=null;
    recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data);};
    const stopped=new Promise(resolve=>{recorder.onstop=resolve;recorder.onerror=event=>{recordingError=event.error||new Error("Video recorder failed.");resolve();};});
    recorder.start(250);
    const started=performance.now();
    while(performance.now()-started<duration*1000){
      if(recordingError)throw recordingError;
      const elapsed=(performance.now()-started)/1000;
      await exportCanvas(sceneFrameOptions(prepared,elapsed));
      stream.getVideoTracks()[0]?.requestFrame?.();
      progress.value=Math.min(95,elapsed/duration*95);
      status.textContent=`Recording ${Math.round(elapsed/duration*100)}% · ${Math.ceil(duration-elapsed)}s remaining`;
      await new Promise(resolve=>setTimeout(resolve,1000/30));
    }
    recorder.stop();await stopped;if(recordingError)throw recordingError;
    if(!chunks.length)throw new Error("Chrome did not produce video data.");
    const outputMime=recorder.mimeType||mime;
    if(!outputMime.startsWith("video/mp4"))throw new Error("Chrome did not produce an MP4 recording.");
    const blob=new Blob(chunks,{type:outputMime}),url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download="postcard-animated.mp4";link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
    progress.value=100;status.textContent="MP4 exported.";setStatus("Animated MP4 exported.");
  }catch(error){status.textContent=`Export failed: ${error.message}`;setStatus(status.textContent,false);}
  finally{
    if(recorder?.state!=="inactive")try{recorder?.stop();}catch(_){}
    stream?.getTracks().forEach(track=>track.stop());if(prepared)closeSceneAnimations(prepared);
    cardExportRunning=false;for(const id of ["startCardExportBtn","closeCardExportBtn","cardVideoDuration"])document.getElementById(id).disabled=false;
  }
}
