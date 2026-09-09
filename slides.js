
const $=id=>document.getElementById(id);
const STATE_KEY="postcardEditorStateV1";
const RETURN_TO_SLIDES_KEY="postcardReturnToSlidesV1";
const formats={landscape:[1280,720],square:[1080,1080],portrait:[1080,1350]};
let state=null,slides=[],activeSlide=0,dragIndex=null;

function clone(v){return JSON.parse(JSON.stringify(v))}
function fmt(sl){return formats[sl?.format||"landscape"]||formats.landscape}
function setStatus(s){$("exportStatus").textContent=s||""}

async function loadState(){
  const data=await chrome.storage.local.get(STATE_KEY);
  state=data?.[STATE_KEY]||{version:1,slides:[],activeSlide:0};
  slides=Array.isArray(state.slides)?clone(state.slides):[];
  activeSlide=Math.max(0,Math.min(Number(state.activeSlide)||0,Math.max(0,slides.length-1)));
}
async function saveState(){
  state.slides=slides;
  state.activeSlide=activeSlide;
  state.savedAt=Date.now();
  await chrome.storage.local.set({[STATE_KEY]:state});
}
function emptySlide(){
  return {bg:{type:"solid",color:"#ED213A",gradient:null,image:null,scale:"contain",darkness:20,posX:50,posY:50},blocks:[],tables:[],format:"landscape",duration:3};
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
function loadImage(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src})}
function wrap(ctx,text,maxWidth){const lines=[];for(const para of String(text||"").split("\n")){if(!para){lines.push("");continue}let line="";for(const word of para.split(/\s+/)){const test=line?`${line} ${word}`:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word}else line=test}lines.push(line)}return lines}
async function drawSlide(canvas,sl){
  const [w,h]=fmt(sl);canvas.width=w;canvas.height=h;const ctx=canvas.getContext("2d");const bg=sl.bg||{};
  ctx.clearRect(0,0,w,h);
  if(bg.type==="gradient"){ctx.fillStyle=makeGradient(ctx,w,h,bg.gradient);ctx.fillRect(0,0,w,h)}
  else if(bg.type==="image"&&bg.image){
    try{
      const img=await loadImage(bg.image),ir=img.naturalWidth/img.naturalHeight,cr=w/h;let dw,dh;
      if(bg.scale==="actual"){dw=img.naturalWidth;dh=img.naturalHeight}
      else if((bg.scale==="cover"&&ir>cr)||(bg.scale==="contain"&&ir<cr)){dh=h;dw=h*ir}
      else{dw=w;dh=w/ir}
      const x=(w-dw)/2-(((bg.posX??50)-50)/50)*(Math.max(0,dw-w)/2);
      const y=(h-dh)/2-(((bg.posY??50)-50)/50)*(Math.max(0,dh-h)/2);
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
    lines.forEach((line,i)=>ctx.fillText(line,x,y0+i*lh,maxWidth));
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
  });
}
async function renderMain(){
  if(!slides.length){slides=[emptySlide()];activeSlide=0}
  const sl=slides[activeSlide];
  await drawSlide($("previewCanvas"),sl);
  $("slideCounter").textContent=`Slide ${activeSlide+1} of ${slides.length}`;
  $("duration").value=sl.duration||3;$("durationValue").textContent=`${sl.duration||3}s`;
  $("prevBtn").disabled=activeSlide===0;$("nextBtn").disabled=activeSlide===slides.length-1;
  $("deleteBtn").disabled=slides.length<=1;
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

$("backBtn").onclick=async()=>{
  await saveState();
  await chrome.storage.local.remove(RETURN_TO_SLIDES_KEY);
  location.href="editor.html";
};
$("editBtn").onclick=async()=>{
  await saveState();
  await chrome.storage.local.set({[RETURN_TO_SLIDES_KEY]:true});
  location.href="editor.html";
};
$("prevBtn").onclick=()=>select(activeSlide-1);$("nextBtn").onclick=()=>select(activeSlide+1);
$("addBtn").onclick=async()=>{slides.splice(activeSlide+1,0,emptySlide());activeSlide++;await saveState();await refresh()};
$("duplicateBtn").onclick=async()=>{slides.splice(activeSlide+1,0,clone(slides[activeSlide]));activeSlide++;await saveState();await refresh()};
$("deleteBtn").onclick=async()=>{if(slides.length<=1)return;slides.splice(activeSlide,1);activeSlide=Math.min(activeSlide,slides.length-1);await saveState();await refresh()};
$("moveUpBtn").onclick=async()=>{if(activeSlide<=0)return;[slides[activeSlide-1],slides[activeSlide]]=[slides[activeSlide],slides[activeSlide-1]];activeSlide--;await saveState();await refresh()};
$("moveDownBtn").onclick=async()=>{if(activeSlide>=slides.length-1)return;[slides[activeSlide+1],slides[activeSlide]]=[slides[activeSlide],slides[activeSlide+1]];activeSlide++;await saveState();await refresh()};
$("duration").oninput=async()=>{slides[activeSlide].duration=Number($("duration").value);$("durationValue").textContent=`${$("duration").value}s`;await saveState();renderThumbs()};
$("thumbList").onclick=e=>{const item=e.target.closest(".thumb");if(item)select(Number(item.dataset.index))};
$("thumbList").addEventListener("dragstart",e=>{const item=e.target.closest(".thumb");if(!item)return;dragIndex=Number(item.dataset.index);item.classList.add("dragging")});
$("thumbList").addEventListener("dragend",e=>e.target.closest(".thumb")?.classList.remove("dragging"));
$("thumbList").addEventListener("dragover",e=>e.preventDefault());
$("thumbList").addEventListener("drop",async e=>{e.preventDefault();const item=e.target.closest(".thumb");if(!item||dragIndex===null)return;const to=Number(item.dataset.index);const [moved]=slides.splice(dragIndex,1);slides.splice(to,0,moved);activeSlide=to;dragIndex=null;await saveState();await refresh()});

async function exportVideo(){
  if(!slides.length)return;
  setStatus("Rendering video…");
  const c=$("exportCanvas"),stream=c.captureStream(30);
  let mime="video/webm;codecs=vp9";if(MediaRecorder.isTypeSupported("video/mp4;codecs=avc1"))mime="video/mp4;codecs=avc1";
  const chunks=[],rec=new MediaRecorder(stream,{mimeType:mime});
  rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  const done=new Promise(resolve=>rec.onstop=resolve);rec.start();
  for(const sl of slides){
    const end=performance.now()+(sl.duration||3)*1000;
    while(performance.now()<end){await drawSlide(c,sl);await new Promise(r=>setTimeout(r,33))}
  }
  rec.stop();await done;
  const blob=new Blob(chunks,{type:mime}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=mime.startsWith("video/mp4")?"postcard-slides.mp4":"postcard-slides.webm";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  setStatus("Video exported.");
}
$("exportBtn").onclick=exportVideo;

(async()=>{await loadState();if(!slides.length)slides=[emptySlide()];await refresh()})();
