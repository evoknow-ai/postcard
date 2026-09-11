
const $=id=>document.getElementById(id);
const STATE_KEY="postcardEditorStateV1";
const RETURN_TO_SLIDES_KEY="postcardReturnToSlidesV1";
const formats={landscape:[1280,720],square:[1080,1080],portrait:[1080,1350]};
function fmt(sl){return formats[sl?.format||"landscape"]||formats.landscape;}

function configuredTotalDuration(){
  return slides.reduce((sum,sl)=>sum+Math.max(1,Number(sl.duration)||3),0);
}
function updateDurationUi(){
  const sl=slides[activeSlide];
  const otherTotal=slides.reduce((sum,s,i)=>sum+(i===activeSlide?0:Math.max(1,Number(s.duration)||3)),0);
  const remaining=Math.max(1,presentationLimitSeconds-otherTotal);
  $("duration").max=String(Math.max(1,remaining));
  if(sl){
    const value=Math.min(Math.max(1,Number(sl.duration)||3),Math.max(1,remaining));
    if(value!==Number(sl.duration))sl.duration=value;
    $("duration").value=String(value);
    $("durationValue").textContent=`${value}s`;
  }
  const total=configuredTotalDuration();
  $("totalDuration").textContent=`${fmtTime(total)} / 10:00 max`;
  $("totalDuration").parentElement?.classList.toggle("over",total>presentationLimitSeconds);
}
function ensurePresentationWithinLicense(){
  const total=configuredTotalDuration();
  if(total<=presentationLimitSeconds)return true;
  setStatus(`Maximum slide-video duration is 10 minutes. Current slides total ${fmtTime(total)}.`,false);
  return false;
}


function setStatus(message,isOk=true){
  const el=$("exportStatus");
  if(!el)return;
  el.textContent=message||"";
  el.dataset.ok=isOk?"1":"0";
}
function setExportProgress(percent,message){
  const p=Math.max(0,Math.min(100,Math.round(percent||0)));
  $("exportProgressBar").style.width=`${p}%`;
  $("exportProgressPercent").textContent=`${p}%`;
  if(message)$("exportProgressText").textContent=message;
}

let state=null,slides=[],activeSlide=0,dragIndex=null;
const presentationLimitSeconds=600;
let voiceRecorder=null,voiceChunks=[],voiceStream=null,voiceRecordingSlideId=null;
let previewAudio=null;
let previewAudioKind=null;
let previewAudioBlobKey=null;
let voiceAudioCtx=null,voiceAnalyser=null,voiceMeterRaf=null,recordStartedAt=0,recordTimerHandle=null;
let presentationPreviewing=false,presentationPaused=false,presentationStopRequested=false,previewSources=[];
const AUDIO_DB="postcardSlidesAudioV1", AUDIO_STORE="audio";

function clone(v){return JSON.parse(JSON.stringify(v))}

function audioId(){
  if(globalThis.crypto?.randomUUID)return crypto.randomUUID();
  return `aud-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function slideId(){return audioId();}
function ensureSlideIds(){const seen=new Set();slides.forEach(sl=>{if(!sl.id||seen.has(sl.id))sl.id=slideId();seen.add(sl.id);});}
function ensureSlideAudioIds(){
  slides.forEach(sl=>{ if(!sl.audioId) sl.audioId=audioId(); if(sl.voiceVolume==null) sl.voiceVolume=100; });
}
function openAudioDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(AUDIO_DB,1);
    req.onupgradeneeded=()=>{ if(!req.result.objectStoreNames.contains(AUDIO_STORE))req.result.createObjectStore(AUDIO_STORE); };
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
  });
}
async function audioPut(key,blob){
  const db=await openAudioDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(AUDIO_STORE,"readwrite");
    tx.objectStore(AUDIO_STORE).put(blob,key);
    tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};
  });
}
async function audioGet(key){
  const db=await openAudioDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(AUDIO_STORE,"readonly");
    const req=tx.objectStore(AUDIO_STORE).get(key);
    req.onsuccess=()=>{db.close();resolve(req.result||null);};req.onerror=()=>{db.close();reject(req.error);};
  });
}
async function audioDelete(key){
  const db=await openAudioDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(AUDIO_STORE,"readwrite");
    tx.objectStore(AUDIO_STORE).delete(key);
    tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};
  });
}
function stopPreviewAudio(){
  if(previewAudio){
    try{
      previewAudio.pause();
      previewAudio.currentTime=0;
      if(previewAudio.src)URL.revokeObjectURL(previewAudio.src);
    }catch(_){}
  }
  previewAudio=null;
  previewAudioKind=null;
  previewAudioBlobKey=null;
  if($("playMusicBtn")){$("playMusicBtn").textContent="▶";$("playMusicBtn").title="Play music";}
  if($("playVoiceBtn") && !(voiceRecorder&&voiceRecorder.state!=="inactive")){
    $("playVoiceBtn").textContent="▶";$("playVoiceBtn").title="Play voice";
  }
}
async function toggleBlobPlayback(blob,volume=1,kind="audio",blobKey=""){
  if(!blob)return;

  // Same preview: toggle play/pause.
  if(previewAudio && previewAudioKind===kind && previewAudioBlobKey===blobKey){
    if(previewAudio.paused){
      await previewAudio.play();
      if(kind==="music"){$("playMusicBtn").textContent="Ⅱ";$("playMusicBtn").title="Pause music";}
      else {$("playVoiceBtn").textContent="Ⅱ";$("playVoiceBtn").title="Pause voice";}
    }else{
      previewAudio.pause();
      if(kind==="music"){$("playMusicBtn").textContent="▶";$("playMusicBtn").title="Resume music";}
      else {$("playVoiceBtn").textContent="▶";$("playVoiceBtn").title="Resume voice";}
    }
    return;
  }

  stopPreviewAudio();
  const url=URL.createObjectURL(blob);
  previewAudio=new Audio(url);
  previewAudio.volume=Math.max(0,Math.min(1,volume));
  previewAudioKind=kind;
  previewAudioBlobKey=blobKey;
  previewAudio.onended=()=>stopPreviewAudio();
  await previewAudio.play();

  if(kind==="music"){
    $("playMusicBtn").textContent="Ⅱ";$("playMusicBtn").title="Pause music";
  }else{
    $("playVoiceBtn").textContent="Ⅱ";$("playVoiceBtn").title="Pause voice";
  }
}

async function loadState(){
  const data=await chrome.storage.local.get(STATE_KEY);
  state=data?.[STATE_KEY]||{version:1,slides:[],activeSlide:0};
  slides=Array.isArray(state.slides)?clone(state.slides):[];
  activeSlide=Math.max(0,Math.min(Number(state.activeSlide)||0,Math.max(0,slides.length-1)));

  ensureSlideIds();
  ensureSlideAudioIds();
  if(state.musicVolume==null)state.musicVolume=40;
}
async function saveState(){
  state.slides=slides;
  state.activeSlide=activeSlide;
  state.musicVolume=Number($("musicVolume")?.value ?? state.musicVolume ?? 40);
  state.musicName=state.musicName||"";
  state.fitMusicDuration=!!$("fitMusicDuration")?.checked;
  state.lastWriter="slides";
  state.savedAt=Date.now();
  await chrome.storage.local.set({[STATE_KEY]:state});
}
function emptySlide(){
  return {id:slideId(),bg:{type:"solid",color:"#ED213A",gradient:null,image:null,scale:"cover",darkness:20,posX:50,posY:50,motion:"none",motionStrength:8},blocks:[],tables:[],format:"landscape",duration:3,audioId:audioId(),voiceVolume:100};
}
function makeGradient(ctx,w,h,g){
  if(!g||g.length<2)return "#ED213A";
  const[d,...colors]=g;let gr;
  if(d==="to left")gr=ctx.createLinearGradient(w,0,0,0);
  else if(d==="to bottom")gr=ctx.createLinearGradient(0,0,0,h);
  else if(d==="to top")gr=ctx.createLinearGradient(0,h,0,0);
  else if(d==="45deg")gr=ctx.createLinearGradient(0,0,w,h);
  else if(d==="135deg")gr=ctx.createLinearGradient(0,h,w,0);
  else gr=ctx.createLinearGradient(0,0,w,0);
  colors.forEach((c,i)=>gr.addColorStop(colors.length===1?0:i/(colors.length-1),c));
  return gr;
}
const slideImageCache=new Map();
const slideObjectUrls=new Set();

async function loadImage(src){
  if(slideImageCache.has(src))return slideImageCache.get(src);

  const promise=(async()=>{
    let imageSrc=src;

    // Remote images drawn directly onto canvas can taint it and make
    // captureStream() fail. Fetch them as Blobs first so the actual image
    // decoded by the canvas comes from an extension-owned blob: URL.
    if(/^https?:/i.test(src)){
      const response=await fetch(src,{cache:"force-cache",credentials:"omit"});
      if(!response.ok)throw new Error(`Image fetch failed (${response.status})`);
      const blob=await response.blob();
      imageSrc=URL.createObjectURL(blob);
      slideObjectUrls.add(imageSrc);
    }

    return await new Promise((res,rej)=>{
      const i=new Image();
      i.onload=()=>res(i);
      i.onerror=()=>rej(new Error("Image decode failed"));
      // For any URL that remains remote, request anonymous CORS as a final safeguard.
      if(/^https?:/i.test(imageSrc))i.crossOrigin="anonymous";
      i.src=imageSrc;
    });
  })().catch(err=>{
    slideImageCache.delete(src);
    throw err;
  });

  slideImageCache.set(src,promise);
  return promise;
}

async function prepareGifFrames(url){return url?decodeGifAnimation(url):null;}
function gifFrameAt(anim,ms){
  if(!anim?.frames?.length)return null;
  let t=((ms%anim.total)+anim.total)%anim.total;
  for(let i=0;i<anim.frames.length;i++){if(t<anim.durations[i])return anim.frames[i];t-=anim.durations[i]}
  return anim.frames[0];
}
function closeGifAnim(anim){anim?.frames?.forEach(f=>{try{f.close()}catch(_){}})}

function wrap(ctx,text,maxWidth){const lines=[];for(const para of String(text||"").split("\n")){if(!para){lines.push("");continue}let line="";for(const word of para.split(/\s+/)){const test=line?`${line} ${word}`:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word}else line=test}lines.push(line)}return lines}

function slideHasMotion(sl){return !!((sl?.bg?.motion&&sl.bg.motion!=="none")||(sl?.blocks||[]).some(b=>b.animation&&b.animation!=="none"))}

async function drawSlide(canvas,sl,opts={}){
  const [w,h]=fmt(sl);if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;const ctx=canvas.getContext("2d");const bg=sl.bg||{};
  const timeSec=Number(opts.timeSec||0),slideDuration=Number(sl.duration||3);
  ctx.clearRect(0,0,w,h);
  if(bg.type==="gradient"){ctx.fillStyle=makeGradient(ctx,w,h,bg.gradient);ctx.fillRect(0,0,w,h)}
  else if(bg.type==="image"&&bg.image){
    try{
      const img=opts.gifFrame||await loadImage(bg.image);
      const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;
      const ir=iw/ih,cr=w/h;let dw,dh;
      if(bg.scale==="actual"){dw=iw;dh=ih}
      else if((bg.scale==="cover"&&ir>cr)||(bg.scale==="contain"&&ir<cr)){dh=h;dw=h*ir}
      else{dw=w;dh=w/ir}
      const bm=backgroundMotion(bg,timeSec,slideDuration);dw*=bm.zoom;dh*=bm.zoom;
      const x=(w-dw)/2-(((bg.posX??50)-50)/50)*(Math.max(0,dw-w)/2)+bm.px*w;
      const y=(h-dh)/2-(((bg.posY??50)-50)/50)*(Math.max(0,dh-h)/2)+bm.py*h;
      ctx.fillStyle="#000";ctx.fillRect(0,0,w,h);ctx.drawImage(img,x,y,dw,dh);
      if(bg.darkness){ctx.fillStyle=`rgba(0,0,0,${bg.darkness/100})`;ctx.fillRect(0,0,w,h)}
    }catch{ctx.fillStyle="#222";ctx.fillRect(0,0,w,h)}
  }else{ctx.fillStyle=bg.color||"#ED213A";ctx.fillRect(0,0,w,h)}

  await drawOrderedObjects(ctx,sl,w,h,b=>{
    if(!b.text?.trim())return;
    ctx.font=`${b.italic?"italic ":""}${b.bold?"700":"400"} ${b.size||56}px ${b.font||"Arial"}`;
    ctx.fillStyle=b.color||"#fff";ctx.textBaseline="middle";ctx.textAlign=b.align||"center";
    ctx.shadowColor=b.shadow?"rgba(0,0,0,.55)":"transparent";ctx.shadowBlur=b.shadow?8:0;ctx.shadowOffsetY=b.shadow?3:0;
    const maxWidth=w*((b.width||70)/100),lines=wrap(ctx,b.text,maxWidth),lh=(b.size||56)*(b.lineHeight||1.2);
    const cx=w*((b.x??50)/100),x=(b.align==="left"?cx-maxWidth/2:b.align==="right"?cx+maxWidth/2:cx),y0=h*((b.y??50)/100)-((lines.length-1)*lh)/2;
    const tm=opts.timeSec==null?{alpha:1,dx:0,dy:0,scale:1}:blockMotion(b,timeSec),cy=h*((b.y??50)/100);
    ctx.save();ctx.globalAlpha=tm.alpha;ctx.translate(cx+tm.dx,cy+tm.dy);ctx.scale(tm.scale,tm.scale);ctx.rotate(textAngle(b)*Math.PI/180);ctx.translate(-cx,-cy);
    lines.forEach((line,i)=>ctx.fillText(line,x,y0+i*lh,maxWidth));ctx.restore();
  },t=>{
    const tw=w*((t.width||60)/100),th=h*((t.height||35)/100),x=w*((t.x??50)/100)-tw/2,y=h*((t.y??55)/100)-th/2;
    const rows=t.rows||2,cols=t.cols||2,cw=tw/cols,ch=th/rows;
    ctx.lineWidth=t.borderSize??2;ctx.strokeStyle=t.borderColor||"#fff";ctx.textAlign="center";ctx.textBaseline="middle";
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const xx=x+c*cw,yy=y+r*ch,isHead=t.header&&r===0;
      ctx.fillStyle=isHead?(t.headerColor||"#334155"):(t.bodyColor||t.bgColor||"#1f2937");ctx.fillRect(xx,yy,cw,ch);
      if(ctx.lineWidth)ctx.strokeRect(xx,yy,cw,ch);
      ctx.font=`${t.italic?"italic ":""}${t.bold||isHead?"700":"400"} ${t.size||28}px ${t.font||"Arial"}`;
      ctx.fillStyle=t.color||"#fff";const val=t.cells?.[r]?.[c]??"";ctx.fillText(val,xx+cw/2,yy+ch/2,cw-12);
    }
  },opts);
}
async function renderMain(){
  if(!slides.length){slides=[emptySlide()];activeSlide=0}
  const sl=slides[activeSlide];
  await drawSlide($("previewCanvas"),sl);
  $("slideCounter").textContent=`Slide ${activeSlide+1} of ${slides.length}`;
  updateDurationUi();
  $("prevBtn").disabled=activeSlide===0;$("nextBtn").disabled=activeSlide===slides.length-1;
  $("deleteBtn").disabled=slides.length<=1;
  $("voiceVolume").value=sl.voiceVolume??100;
  $("voiceVolumeValue").textContent=`${sl.voiceVolume??100}%`;
  $("fitMusicDuration").checked=!!state.fitMusicDuration;
  $("musicVolume").value=state.musicVolume??40;
  $("musicVolumeValue").textContent=`${state.musicVolume??40}%`;
  $("musicName").textContent=state.musicName||"None";
  const voiceBlob=await audioGet(`voice:${sl.audioId}`).catch(()=>null);
  $("voiceState").textContent=voiceBlob?"Recorded":"None";
  $("playVoiceBtn").disabled=!voiceBlob;
  $("deleteVoiceBtn").disabled=!voiceBlob;
  const musicBlob=await audioGet("music").catch(()=>null);
  $("playMusicBtn").disabled=!musicBlob;
  $("stopMusicBtn").disabled=!musicBlob;
  $("removeMusicBtn").disabled=!musicBlob;
}
async function renderThumbs(){
  const list=$("thumbList");list.innerHTML="";
  for(let i=0;i<slides.length;i++){
    const item=document.createElement("div");item.className=`thumb ${i===activeSlide?"active":""}`;item.draggable=true;item.dataset.index=i;
    const c=document.createElement("canvas");const meta=document.createElement("div");meta.className="thumbMeta";meta.innerHTML=`<span>${i+1}</span><span>${slides[i].duration||3}s</span>`;
    item.append(c,meta);list.appendChild(item);await drawSlide(c,slides[i]);
  }
}
async function select(i){activeSlide=Math.max(0,Math.min(i,slides.length-1));await saveState();await renderMain();await renderThumbs()}
async function refresh(){await renderMain();await renderThumbs()}

let openingEditor=false;
async function openSlideEditor(editSlide=true){
  if(openingEditor)return;
  openingEditor=true;
  try{
    await saveState();
    if(editSlide)await chrome.storage.local.set({[RETURN_TO_SLIDES_KEY]:{slideId:slides[activeSlide]?.id}});
    else await chrome.storage.local.remove(RETURN_TO_SLIDES_KEY);
    location.replace("editor.html"+location.search);
  }catch(error){
    openingEditor=false;
    console.error("Could not open slide editor:",error);
    setStatus("Could not open this slide for editing. Please try again.",false);
  }
}
$("backBtn").onclick=()=>openSlideEditor(false);
$("editBtn").onclick=()=>openSlideEditor(true);
$("prevBtn").onclick=()=>select(activeSlide-1);$("nextBtn").onclick=()=>select(activeSlide+1);
$("addBtn").onclick=async()=>{slides.splice(activeSlide+1,0,emptySlide());activeSlide++;await saveState();await refresh()};
$("duplicateBtn").onclick=async()=>{const copy=clone(slides[activeSlide]);copy.id=slideId();copy.audioId=audioId();slides.splice(activeSlide+1,0,copy);activeSlide++;await saveState();await refresh()};
$("deleteBtn").onclick=async()=>{if(slides.length<=1)return;const removed=slides[activeSlide];slides.splice(activeSlide,1);if(removed?.audioId)await audioDelete(`voice:${removed.audioId}`).catch(()=>{});activeSlide=Math.min(activeSlide,slides.length-1);await saveState();await refresh()};
$("moveUpBtn").onclick=async()=>{if(activeSlide<=0)return;[slides[activeSlide-1],slides[activeSlide]]=[slides[activeSlide],slides[activeSlide-1]];activeSlide--;await saveState();await refresh()};
$("moveDownBtn").onclick=async()=>{if(activeSlide>=slides.length-1)return;[slides[activeSlide+1],slides[activeSlide]]=[slides[activeSlide],slides[activeSlide+1]];activeSlide++;await saveState();await refresh()};
async function applySlideDuration(){
  const otherTotal=slides.reduce((sum,s,i)=>sum+(i===activeSlide?0:Math.max(1,Number(s.duration)||3)),0);
  const allowed=Math.max(1,presentationLimitSeconds-otherTotal);
  const requested=Math.max(1,Number($("duration").value)||1);
  const value=Math.min(requested,allowed);
  slides[activeSlide].duration=value;
  $("duration").value=String(value);
  $("durationValue").textContent=`${value}s`;
  updateDurationUi();
  await saveState();
  await renderThumbs();
}
$("duration").oninput=applySlideDuration;
$("duration").onchange=applySlideDuration;
$("thumbList").onclick=e=>{const item=e.target.closest(".thumb");if(item)select(Number(item.dataset.index))};
$("thumbList").addEventListener("dragstart",e=>{const item=e.target.closest(".thumb");if(!item)return;dragIndex=Number(item.dataset.index);item.classList.add("dragging")});
$("thumbList").addEventListener("dragend",e=>e.target.closest(".thumb")?.classList.remove("dragging"));
$("thumbList").addEventListener("dragover",e=>e.preventDefault());
$("thumbList").addEventListener("drop",async e=>{e.preventDefault();const item=e.target.closest(".thumb");if(!item||dragIndex===null)return;const to=Number(item.dataset.index);const [moved]=slides.splice(dragIndex,1);slides.splice(to,0,moved);activeSlide=to;dragIndex=null;await saveState();await refresh()});


$("voiceVolume").oninput=async()=>{
  const v=Number($("voiceVolume").value);
  slides[activeSlide].voiceVolume=v;
  $("voiceVolumeValue").textContent=`${v}%`;
  await saveState();
};
$("musicVolume").oninput=async()=>{
  const v=Number($("musicVolume").value);
  state.musicVolume=v;
  $("musicVolumeValue").textContent=`${v}%`;
  await saveState();
};
$("musicFile").onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  await audioPut("music",file);
  state.musicName=file.name;
  await saveState();
  $("musicName").textContent=file.name;
  $("playMusicBtn").disabled=false;$("stopMusicBtn").disabled=false;$("removeMusicBtn").disabled=false;
  setStatus("MP3 loaded.");
};
$("playMusicBtn").onclick=async()=>{
  const b=await audioGet("music");
  if(b)await toggleBlobPlayback(b,(state.musicVolume??40)/100,"music","music");
};
$("stopMusicBtn").onclick=()=>stopPreviewAudio();
$("removeMusicBtn").onclick=async()=>{
  stopPreviewAudio();
  await audioDelete("music");
  state.musicName="";
  await saveState();
  $("musicName").textContent="None";
  $("playMusicBtn").disabled=true;
  $("stopMusicBtn").disabled=true;
  $("removeMusicBtn").disabled=true;
  $("musicFile").value="";
};
$("playVoiceBtn").onclick=async()=>{
  // During recording this button is Pause / Resume for the recorder.
  if(voiceRecorder && voiceRecorder.state==="recording"){
    voiceRecorder.pause();
    $("playVoiceBtn").textContent="▶";
    $("playVoiceBtn").title="Resume recording";
    $("playVoiceBtn").classList.add("paused");
    $("voiceState").textContent="Paused";
    return;
  }
  if(voiceRecorder && voiceRecorder.state==="paused"){
    voiceRecorder.resume();
    $("playVoiceBtn").textContent="Ⅱ";
    $("playVoiceBtn").title="Pause recording";
    $("playVoiceBtn").classList.remove("paused");
    $("voiceState").textContent="Recording…";
    return;
  }
  const sl=slides[activeSlide],b=await audioGet(`voice:${sl.audioId}`);
  if(b)await toggleBlobPlayback(b,(sl.voiceVolume??100)/100,"voice",`voice:${sl.audioId}`);
};
$("deleteVoiceBtn").onclick=async()=>{stopPreviewAudio();const sl=slides[activeSlide];await audioDelete(`voice:${sl.audioId}`);$("voiceState").textContent="None";$("playVoiceBtn").disabled=true;$("deleteVoiceBtn").disabled=true};


function fmtTime(sec){sec=Math.max(0,Math.floor(sec||0));return `${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`}
function stopVoiceMeter(){
  cancelAnimationFrame(voiceMeterRaf);voiceMeterRaf=null;
  if(voiceAudioCtx){voiceAudioCtx.close().catch(()=>{});voiceAudioCtx=null}
  clearInterval(recordTimerHandle);recordTimerHandle=null;
}
function startVoiceMeter(stream){
  const canvas=$("voiceMeter"),ctx=canvas.getContext("2d");
  voiceAudioCtx=new AudioContext();const src=voiceAudioCtx.createMediaStreamSource(stream);
  voiceAnalyser=voiceAudioCtx.createAnalyser();voiceAnalyser.fftSize=256;src.connect(voiceAnalyser);
  const data=new Uint8Array(voiceAnalyser.frequencyBinCount);
  const draw=()=>{voiceAnalyser.getByteFrequencyData(data);const avg=data.reduce((a,b)=>a+b,0)/data.length/255;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle="#8aa4c7";ctx.fillRect(0,9,Math.max(2,canvas.width*avg*2.1),10);voiceMeterRaf=requestAnimationFrame(draw)};draw();
  recordStartedAt=performance.now();$("recordTimer").textContent="00:00";
  recordTimerHandle=setInterval(()=>$("recordTimer").textContent=fmtTime((performance.now()-recordStartedAt)/1000),250);
}
async function moveWhileRecording(delta){
  if(!voiceRecorder||!["recording","paused"].includes(voiceRecorder.state))return;
  const target=Math.max(0,Math.min(activeSlide+delta,slides.length-1));if(target===activeSlide)return;
  voiceRecorder.addEventListener("stop",async()=>{await select(target);setTimeout(()=>$("recordVoiceBtn").click(),100)},{once:true});
  voiceRecorder.stop();
}

$("recordVoiceBtn").onclick=async()=>{
  const btn=$("recordVoiceBtn");
  if(voiceRecorder && voiceRecorder.state==="recording"){
    voiceRecorder.stop();
    return;
  }
  try{
    stopPreviewAudio();
    voiceStream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
    voiceChunks=[];
    voiceRecordingSlideId=slides[activeSlide].audioId;
    const opts=MediaRecorder.isTypeSupported("audio/webm;codecs=opus")?{mimeType:"audio/webm;codecs=opus"}:{};
    voiceRecorder=new MediaRecorder(voiceStream,opts);
    voiceRecorder.ondataavailable=e=>{if(e.data.size)voiceChunks.push(e.data)};
    voiceRecorder.onstop=async()=>{
      voiceStream?.getTracks().forEach(t=>t.stop());voiceStream=null;
      const blob=new Blob(voiceChunks,{type:voiceRecorder.mimeType||"audio/webm"});
      await audioPut(`voice:${voiceRecordingSlideId}`,blob);
      stopVoiceMeter();$("recordStrip").hidden=true;
      btn.classList.remove("recording");btn.textContent="●";btn.title="Record voice";
      $("playVoiceBtn").classList.remove("paused");
      $("playVoiceBtn").textContent="▶";
      $("playVoiceBtn").title="Play voice";
      if(slides[activeSlide].audioId===voiceRecordingSlideId){
        $("voiceState").textContent="Recorded";$("playVoiceBtn").disabled=false;$("deleteVoiceBtn").disabled=false;
      }
      setStatus("Voice recorded for slide.");
      voiceRecorder=null;voiceRecordingSlideId=null;
    };
    voiceRecorder.start();
    startVoiceMeter(voiceStream);$("recordStrip").hidden=false;$("recordSlideLabel").textContent=`Slide ${activeSlide+1}`;
    btn.classList.add("recording");btn.textContent="■";btn.title="Stop recording";
    $("playVoiceBtn").disabled=false;
    $("playVoiceBtn").textContent="Ⅱ";
    $("playVoiceBtn").title="Pause recording";
    $("playVoiceBtn").classList.remove("paused");
    $("voiceState").textContent="Recording…";
  }catch(e){
    setStatus(`Microphone unavailable: ${e?.message||"unknown error"}`);
  }
};


$("recordStopBtn").onclick=()=>{if(voiceRecorder&&["recording","paused"].includes(voiceRecorder.state))voiceRecorder.stop()};
$("recordPrevBtn").onclick=()=>moveWhileRecording(-1);
$("recordNextBtn").onclick=()=>moveWhileRecording(1);

async function decodeBlob(ctx,blob){return blob?ctx.decodeAudioData(await blob.arrayBuffer()):null}
async function previewPresentation(){
  if(!presentationPreviewing && !ensurePresentationWithinLicense())return;
  if(presentationPreviewing){
    presentationPaused=!presentationPaused;
    $("previewPlayPauseBtn").textContent=presentationPaused?"▶":"Ⅱ";
    return;
  }

  presentationPreviewing=true;
  presentationPaused=false;
  presentationStopRequested=false;
  $("previewStrip").hidden=false;
  $("previewPlayPauseBtn").textContent="Ⅱ";

  const ctx=new AudioContext();
  const musicBlob=await audioGet("music").catch(()=>null);
  const musicBuf=await decodeBlob(ctx,musicBlob).catch(()=>null);

  // A slide's preview duration is at least its configured duration, but if its
  // narration is longer, keep the slide visible until narration finishes.
  const timeline=[];
  let total=0;

  for(let i=0;i<slides.length;i++){
    const sl=slides[i];
    const voiceBlob=await audioGet(`voice:${sl.audioId}`).catch(()=>null);
    let voiceBuf=null;
    if(voiceBlob){
      try{voiceBuf=await decodeBlob(ctx,voiceBlob)}catch(e){console.warn("Voice decode failed",e)}
    }
    const configured=Math.max(.25,Number(sl.duration)||3);
    const effective=Math.max(configured,voiceBuf?.duration||0);
    timeline.push({sl,voiceBuf,duration:effective});
    total+=effective;
  }

  if(state.fitMusicDuration && musicBuf)total=extendTimelineForMusic(timeline,musicBuf.duration);
  if(total>presentationLimitSeconds){
    setStatus(
      `Maximum slide-video duration is 10 minutes. Narration makes this preview ${fmtTime(total)}.`,
      false
    );
    presentationPreviewing=false;
    $("previewStrip").hidden=true;
    await ctx.close().catch(()=>{});
    return;
  }

  try{
    for(const item of timeline)item.animations=await prepareSceneAnimations(item.sl);
  }catch(error){
    timeline.forEach(item=>{if(item.animations)closeSceneAnimations(item.animations);});
    await ctx.close().catch(()=>{});presentationPreviewing=false;$("previewStrip").hidden=true;
    setStatus(`Preview failed: ${error.message}`,false);return;
  }
  let musicSrc=null;
  if(musicBuf){
    musicSrc=ctx.createBufferSource();
    musicSrc.buffer=musicBuf;
    musicSrc.loop=true;
    const g=ctx.createGain();
    g.gain.value=Math.max(0,Math.min(1,(state.musicVolume??40)/100));
    musicSrc.connect(g);
    g.connect(ctx.destination);
    musicSrc.start();
  }

  let elapsedTotal=0;

  try{
    for(let i=0;i<timeline.length&&!presentationStopRequested;i++){
      const item=timeline[i];
      await select(i);

      let voiceSrc=null;
      if(item.voiceBuf){
        voiceSrc=ctx.createBufferSource();
        voiceSrc.buffer=item.voiceBuf;
        const g=ctx.createGain();
        g.gain.value=Math.max(0,Math.min(1.5,(item.sl.voiceVolume??100)/100));
        voiceSrc.connect(g);
        g.connect(ctx.destination);
        voiceSrc.start();
        previewSources.push(voiceSrc);
      }

      // Use AudioContext time rather than performance.now so pause/resume does
      // not consume the slide while audio is suspended.
      const slideStart=ctx.currentTime;
      let pausedAt=null;
      let pausedAccum=0;

      const animations=item.animations;
      const gifAnim=animations.background;
      while(!presentationStopRequested){
        if(presentationPaused){
          if(pausedAt==null)pausedAt=performance.now();
          if(ctx.state!=="suspended")await ctx.suspend();
          await new Promise(r=>setTimeout(r,100));
          continue;
        }

        if(ctx.state==="suspended")await ctx.resume();

        if(pausedAt!=null){
          pausedAccum+=(performance.now()-pausedAt)/1000;
          pausedAt=null;
        }

        const local=Math.max(0,ctx.currentTime-slideStart);
        $("previewTime").textContent=`${fmtTime(elapsedTotal+local)} / ${fmtTime(total)}`;
        if(animations.animated||slideHasMotion(item.sl))await drawSlide($("previewCanvas"),item.sl,sceneFrameOptions(animations,local));

        if(local>=item.duration)break;
        await new Promise(r=>setTimeout(r,(animations.animated||slideHasMotion(item.sl))?33:80));
      }

      try{voiceSrc?.stop()}catch(_){}
      elapsedTotal+=item.duration;
    }
  }finally{
    timeline.forEach(item=>closeSceneAnimations(item.animations));
    try{musicSrc?.stop()}catch(_){}
    previewSources.forEach(s=>{try{s.stop()}catch(_){}});
    previewSources=[];
    await ctx.close().catch(()=>{});
    presentationPreviewing=false;
    presentationPaused=false;
    $("previewStrip").hidden=true;
    $("previewTime").textContent="00:00 / 00:00";
  }
}
$("previewBtn").onclick=previewPresentation;
$("previewPlayPauseBtn").onclick=previewPresentation;
$("previewStopBtn").onclick=()=>{presentationStopRequested=true;presentationPaused=false};
$("previewPrevBtn").onclick=()=>{presentationStopRequested=true;setTimeout(()=>select(Math.max(0,activeSlide-1)),120)};
$("previewNextBtn").onclick=()=>{presentationStopRequested=true;setTimeout(()=>select(Math.min(slides.length-1,activeSlide+1)),120)};

async function exportVideo(){
  if(!slides.length)return;
  if(!ensurePresentationWithinLicense())return;

  $("exportOverlay").hidden=false;
  $("exportBtn").disabled=true;
  setExportProgress(0,"Preparing slides and audio");
  setStatus("Rendering MP4 with audio…");

  let audioCtx=null;
  let rec=null;
  let objectUrl=null;
  let outputStream=null;const preparedAnimations=[];

  try{
    const c=$("exportCanvas");
    const fps=30;

    // Build narration timeline first.
    audioCtx=new AudioContext();
    const dest=audioCtx.createMediaStreamDestination();

    try{
      if(audioCtx.state==="suspended")await audioCtx.resume();
    }catch(_){}

    const timeline=[];
    let totalDuration=0;
    let hasAnyAudio=false;

    for(const sl of slides){
      const vb=await audioGet(`voice:${sl.audioId}`).catch(()=>null);
      let vbuf=null;
      if(vb){
        try{
          vbuf=await audioCtx.decodeAudioData(await vb.arrayBuffer());
          hasAnyAudio=true;
        }catch(e){
          console.warn("Voice decode failed",e);
        }
      }

      const configured=Math.max(.25,Number(sl.duration)||3);
      const effective=Math.max(configured,vbuf?.duration||0);
      timeline.push({sl,vbuf,duration:effective});
      totalDuration+=effective;
    }

    if(totalDuration>presentationLimitSeconds){
      throw new Error(
        `Maximum slide-video duration is 10 minutes. Narration makes this video ${fmtTime(totalDuration)}.`
      );
    }

    const musicBlob=await audioGet("music").catch(()=>null);
    let musicBuffer=null;
    if(musicBlob){
      try{
        musicBuffer=await audioCtx.decodeAudioData(await musicBlob.arrayBuffer());
        hasAnyAudio=true;
      }catch(e){
        console.warn("Music decode failed",e);
      }
    }

    if(state.fitMusicDuration && musicBuffer){
      totalDuration=extendTimelineForMusic(timeline,musicBuffer.duration);
      if(totalDuration>presentationLimitSeconds)throw new Error("Music exceeds the 10-minute video limit.");
    }
    // Decode before audio starts so image preparation cannot desynchronize narration.
    for(const item of timeline){
      item.animations=await prepareSceneAnimations(item.sl);preparedAnimations.push(item.animations);
    }
    setExportProgress(4,"Preparing images and video canvas");

    // Prime the export canvas before captureStream.
    await drawSlide(c,timeline[0].sl);
    await new Promise(r=>setTimeout(r,20));
    await drawSlide(c,timeline[0].sl);

    // Verify the composed canvas is exportable before starting the recorder.
    // getImageData throws SecurityError if any source tainted the canvas.
    try{
      c.getContext("2d").getImageData(0,0,1,1);
    }catch(e){
      throw new Error("A slide contains an external image that Chrome could not safely load for video export.");
    }

    const videoStream=c.captureStream(fps);
    const videoTrack=videoStream.getVideoTracks()[0];
    if(!videoTrack)throw new Error("Chrome did not create a canvas video track.");

    outputStream=new MediaStream();
    outputStream.addTrack(videoTrack);

    // Only add WebAudio track when presentation actually contains audio.
    // This avoids Chrome MediaRecorder startup issues with a silent destination track.
    if(hasAnyAudio){
      const audioTrack=dest.stream.getAudioTracks()[0];
      if(audioTrack)outputStream.addTrack(audioTrack);
    }

    setExportProgress(5,"Starting recorder");

    const recorderMime=mp4RecorderType();
    rec=new MediaRecorder(outputStream,{mimeType:recorderMime,videoBitsPerSecond:5000000,audioBitsPerSecond:160000});

    const chunks=[];
    rec.ondataavailable=e=>{
      if(e.data && e.data.size>0)chunks.push(e.data);
    };
    let recorderError=null,finishRecording;
    const recordingStopped=new Promise(resolve=>finishRecording=resolve);
    rec.onstop=()=>finishRecording();
    rec.onerror=e=>{recorderError=e.error||new Error("Video recording failed.");finishRecording();};

    // Do not wait on the `start` event: some Chrome extension popup builds fail
    // to dispatch it reliably even though recorder.state becomes "recording".
    rec.start(500);

    await new Promise(r=>setTimeout(r,180));
    if(rec.state!=="recording"){
      throw new Error(`MediaRecorder did not enter recording state (${rec.state}).`);
    }

    setExportProgress(7,"Recorder ready");

    // Schedule audio only after recorder is definitely recording.
    const startAt=audioCtx.currentTime+0.20;

    if(musicBuffer){
      const src=audioCtx.createBufferSource();
      const gain=audioCtx.createGain();
      src.buffer=musicBuffer;
      src.loop=true;
      gain.gain.value=Math.max(0,Math.min(1,(state.musicVolume??40)/100));
      src.connect(gain);
      gain.connect(dest);
      src.start(startAt);
      src.stop(startAt+totalDuration+0.35);
    }

    let offset=0;
    for(const item of timeline){
      if(item.vbuf){
        const src=audioCtx.createBufferSource();
        const gain=audioCtx.createGain();
        src.buffer=item.vbuf;
        gain.gain.value=Math.max(0,Math.min(1.5,(item.sl.voiceVolume??100)/100));
        src.connect(gain);
        gain.connect(dest);
        src.start(startAt+offset);
        src.stop(startAt+offset+item.vbuf.duration);
      }
      offset+=item.duration;
    }

    const waitMs=Math.max(0,(startAt-audioCtx.currentTime)*1000);
    if(waitMs)await new Promise(r=>setTimeout(r,waitMs));

    let renderedBefore=0;
    for(let slideIndex=0;slideIndex<timeline.length;slideIndex++){
      const item=timeline[slideIndex];
      const animations=item.animations;
      const gifAnim=animations.background;

      await drawSlide(c,item.sl,sceneFrameOptions(animations,0));
      try{videoTrack.requestFrame?.()}catch(_){}

      const slideStart=performance.now();
      let lastFrame=null;
      while(performance.now()-slideStart<item.duration*1000){
        if(recorderError)throw recorderError;
        const local=Math.min(item.duration,(performance.now()-slideStart)/1000);
        if(animations.animated||slideHasMotion(item.sl)){
          const frame=gifFrameAt(gifAnim,local*1000);
          if(animations.images.size||slideHasMotion(item.sl)||frame!==lastFrame){
            await drawSlide(c,item.sl,sceneFrameOptions(animations,local));
            try{videoTrack.requestFrame?.()}catch(_){}
            lastFrame=frame;
          }
        }
        const completed=renderedBefore+local;
        const pct=10+(completed/Math.max(.01,totalDuration))*80;
        setExportProgress(pct,`Slide ${slideIndex+1} of ${timeline.length} · ${fmtTime(Math.max(0,totalDuration-completed))} remaining`);
        await new Promise(r=>setTimeout(r,(animations.animated||slideHasMotion(item.sl))?30:100));
      }
      renderedBefore+=item.duration;
    }

    const last=timeline[timeline.length-1];
    await drawSlide(c,last.sl,sceneFrameOptions(last.animations,last.duration));
    try{videoTrack.requestFrame?.()}catch(_){}
    setExportProgress(92,"Finalizing video and audio");
    await new Promise(r=>setTimeout(r,300));

    // Flush then stop.
    if(rec.state==="recording"){
      try{rec.requestData()}catch(_){}
      await new Promise(r=>setTimeout(r,220));
      rec.stop();
    }

    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error("Chrome did not finish writing the MP4. Please retry.")),10000);
      recordingStopped.then(()=>{clearTimeout(timer);resolve();});
    });
    if(recorderError)throw recorderError;

    const totalBytes=chunks.reduce((n,b)=>n+b.size,0);
    if(totalBytes<1024){
      throw new Error(`Chrome recorder produced no usable media data (${totalBytes} bytes).`);
    }

    setExportProgress(97,"Saving video");

    const mime=rec.mimeType||chunks[0]?.type||recorderMime||"video/webm";
    const isMp4=/^video\/mp4/i.test(mime);
    const blob=new Blob(chunks,{type:mime});
    objectUrl=URL.createObjectURL(blob);

    const link=document.createElement("a");link.href=objectUrl;link.download="postcard-slides.mp4";link.click();

    setExportProgress(100,isMp4?"MP4 ready":"Video ready");
    setStatus(
      isMp4
        ?"MP4 exported with slides, narration and music."
        :"This Chrome build does not support MP4 MediaRecorder; exported WebM instead."
    );
    await new Promise(r=>setTimeout(r,450));

  }catch(e){
    console.error("Slide video export failed",e);
    setStatus(`Export failed: ${e?.message||"unknown error"}`,false);
    setExportProgress(0,"Export failed");
    await new Promise(r=>setTimeout(r,900));
  }finally{
    try{
      if(rec && rec.state==="recording")rec.stop();
    }catch(_){}
    outputStream?.getTracks().forEach(track=>track.stop());
    preparedAnimations.forEach(closeSceneAnimations);
    try{await audioCtx?.close()}catch(_){}
    if(objectUrl)setTimeout(()=>URL.revokeObjectURL(objectUrl),30000);
    $("exportOverlay").hidden=true;
    $("exportBtn").disabled=false;
  }
}
$("exportBtn").onclick=exportVideo;

(async()=>{
  await loadState();
  if(!slides.length)slides=[emptySlide()];
  ensureSlideIds();ensureSlideAudioIds();
  $("fitMusicDuration").checked=!!state.fitMusicDuration;
  $("musicVolume").value=state.musicVolume??40;
  $("musicVolumeValue").textContent=`${state.musicVolume??40}%`;
  await refresh();
  updateDurationUi();
})();

$("fitMusicDuration").addEventListener("change",saveState);
