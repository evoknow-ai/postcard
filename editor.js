const $ = id => document.getElementById(id);
const formats={landscape:[1200,675],square:[1080,1080],portrait:[1080,1350]};
const FEATURED_ENDPOINT="https://featured.mypoint.cards";
const solidColors=["#ED213A","#3498db","#2ecc71","#f39c12","#9b59b6","#34495e","#1abc9c","#000000","#e74c3c","#f1c40f","#95a5a6","#ffffff","#e84393","#8B4513"];
const gradients=[["to right","#f12711","#f5af19"],["to right","#8e2de2","#4a00e0"],["to right","#00b09b","#96c93d"],["45deg","#ff9a9e","#fad0c4"],["to right","#4facfe","#00f2fe"],["135deg","#667eea","#764ba2"],["to right","#2c3e50","#4ca1af"],["to right","#f953c6","#b91d73"],["to right","#11998e","#38ef7d"],["45deg","#fc4a1a","#f7b733"],["to right","#43cea2","#185a9d"],["135deg","#ff0844","#ffb199"]];
const emojis="😀 😂 😍 🥰 😎 🤔 😅 😢 😡 🤯 🤩 😴 😇 😬 🤗 🥳 🤡 😄 🙂 😉 😆 🥺 😤 👍 🙏 💪 🙌 👀 🤷‍♂️ 🤦‍♀️ 🧠 👑 🫶 👎 ✌️ 🤝 👏 ❤️ 🎉 ✨ 🔥 💯 🚫 ❌ ⭐ 🌟 💙 💚 💜 🖤 🤍 💖 💡 💥 ☀️ 🌙 ✅ ⚡ 🚀 📈 📱 💻 ⚽ 🏀 🎮 🎵 🎬 📚 🎯 📝 📢 🎙️ 🇦🇺 🇧🇩 🇧🇷 🇨🇦 🇨🇳 🇩🇪 🇫🇷 🇮🇳 🇮🇹 🇯🇵 🇰🇷 🇬🇧 🇺🇸".split(" ");

let bg={type:"solid",color:"#ED213A",gradient:null,image:null,imageObj:null,scale:"contain",darkness:20,posX:50,posY:50};
let blocks=[],selectedId=null,nextId=1,drag=null,currentFormat="landscape";
let dragCandidate=null;
const lastCaretRange=new Map();

function block(id){return blocks.find(b=>b.id===id);}
function selected(){return block(selectedId);}
function setStatus(t,ok=true){$("status").textContent=t;$("status").style.color=ok?"#7bcf9e":"#ff8f8f";}

function makeBlock(text="Type here"){
  return{id:nextId++,text,x:50,y:50,width:70,font:"Arial, sans-serif",size:56,color:"#ffffff",align:"center",lineHeight:1.2,bold:true,italic:false,shadow:true};
}

function displaySize(px){const sw=$("stage").clientWidth||900;const[ew]=formats[currentFormat];return px*(sw/ew);}

function renderBlocks(){
  const layer=$("textLayer");
  const old=new Map([...layer.querySelectorAll(".textBlock")].map(e=>[Number(e.dataset.id),e]));
  for(const b of blocks){
    let el=old.get(b.id);
    if(!el){
      el=document.createElement("div");
      el.className="textBlock";el.dataset.id=b.id;el.contentEditable="true";el.spellcheck=true;
      layer.appendChild(el);wireTextBlock(el);
    }
    if(document.activeElement!==el)el.innerText=b.text;
    Object.assign(el.style,{
      left:`${b.x}%`,top:`${b.y}%`,width:`${b.width}%`,fontFamily:b.font,fontSize:`${displaySize(b.size)}px`,
      color:b.color,textAlign:b.align,lineHeight:b.lineHeight,fontWeight:b.bold?"700":"400",
      fontStyle:b.italic?"italic":"normal",textShadow:b.shadow?"0 2px 4px rgba(0,0,0,.55)":"none"
    });
    el.classList.toggle("selected",b.id===selectedId);old.delete(b.id);
  }
  old.forEach(e=>e.remove());syncToolbar();
}

function saveCaret(el){
  const sel=window.getSelection();
  if(!sel || !sel.rangeCount || !el.contains(sel.anchorNode)) return;
  try { lastCaretRange.set(Number(el.dataset.id), sel.getRangeAt(0).cloneRange()); } catch(_) {}
}

function wireTextBlock(el){
  const id=()=>Number(el.dataset.id);
  el.addEventListener("focus",()=>selectBlock(id()));
  el.addEventListener("click",()=>{ selectBlock(id()); saveCaret(el); });
  el.addEventListener("keyup",()=>saveCaret(el));
  el.addEventListener("input",()=>{const b=block(id());if(b)b.text=el.innerText;saveCaret(el);});

  // Direct manipulation: drag the block to move it. Drag the blue corner handle
  // to scale the text visually, like a small design editor. A normal click edits.
  el.addEventListener("pointerdown",e=>{
    if(e.button!==0) return;
    selectBlock(id());
    const b=selected();
    const rect=el.getBoundingClientRect();
    const onResizeHandle = e.clientX >= rect.right-18 && e.clientY >= rect.bottom-18;
    if(onResizeHandle){
      e.preventDefault();
      const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
      const startDist=Math.max(24,Math.hypot(e.clientX-cx,e.clientY-cy));
      drag={type:"resize",id:b.id,x:e.clientX,y:e.clientY,cx,cy,startDist,startSize:b.size,startWidth:b.width,el};
      el.classList.add("resizing");
      return;
    }
    dragCandidate={type:"text",id:b.id,x:e.clientX,y:e.clientY,bx:b.x,by:b.y,pointerId:e.pointerId,el,moved:false};
  });
}

window.addEventListener("pointermove",e=>{
  if(dragCandidate && !drag){
    const dx=e.clientX-dragCandidate.x, dy=e.clientY-dragCandidate.y;
    if(Math.hypot(dx,dy)>=4){
      drag={...dragCandidate,moved:true};
      dragCandidate=null;
      drag.el.classList.add("dragging");
      drag.el.style.userSelect="none";
      const sel=window.getSelection(); if(sel) sel.removeAllRanges();
    }
  }
  if(!drag)return;
  const r=$("stage").getBoundingClientRect();
  if(drag.type==="text"){
    const b=block(drag.id);if(!b)return;
    b.x=Math.max(5,Math.min(95,drag.bx+(e.clientX-drag.x)/r.width*100));
    b.y=Math.max(5,Math.min(95,drag.by+(e.clientY-drag.y)/r.height*100));
    renderBlocks();
  }else if(drag.type==="resize"){
    const b=block(drag.id);if(!b)return;
    const dist=Math.max(10,Math.hypot(e.clientX-drag.cx,e.clientY-drag.cy));
    const scale=Math.max(.35,Math.min(3,dist/drag.startDist));
    b.size=Math.round(Math.max(16,Math.min(140,drag.startSize*scale)));
    b.width=Math.round(Math.max(20,Math.min(95,drag.startWidth*scale)));
    renderBlocks();
    const live=document.querySelector(`.textBlock[data-id="${b.id}"]`);
    live?.classList.add("resizing");
  }else if(bg.type==="image"){
    bg.posX=Math.max(0,Math.min(100,drag.bx-(e.clientX-drag.x)/r.width*100));
    bg.posY=Math.max(0,Math.min(100,drag.by-(e.clientY-drag.y)/r.height*100));
    applyBackground();
  }
});
window.addEventListener("pointerup",()=>{
  if(drag?.el){drag.el.classList.remove("dragging","resizing");drag.el.style.userSelect="";}
  document.querySelectorAll(".textBlock.resizing").forEach(el=>el.classList.remove("resizing"));
  drag=null;dragCandidate=null;
});

$("stage").addEventListener("pointerdown",e=>{
  if(e.target.closest(".textBlock"))return;
  if(bg.type==="image")drag={type:"bg",x:e.clientX,y:e.clientY,bx:bg.posX,by:bg.posY};
  else selectBlock(null);
});

function selectBlock(id){selectedId=id;renderBlocks();}
function addText(text="New text"){
  const b=makeBlock(text);
  if(blocks.length)b.y=Math.min(85,40+blocks.length*11);
  blocks.push(b);selectedId=b.id;renderBlocks();
  setTimeout(()=>{const el=document.querySelector(`.textBlock[data-id="${b.id}"]`);if(el){el.focus();const r=document.createRange(),s=window.getSelection();r.selectNodeContents(el);s.removeAllRanges();s.addRange(r);}},0);
}
function duplicateSelected(){const b=selected();if(!b)return;const n={...b,id:nextId++,x:Math.min(90,b.x+5),y:Math.min(90,b.y+5)};blocks.push(n);selectedId=n.id;renderBlocks();}
function deleteSelected(){if(selectedId==null)return;blocks=blocks.filter(b=>b.id!==selectedId);selectedId=blocks.at(-1)?.id??null;renderBlocks();}
function changeSelected(fn){const b=selected();if(!b)return;fn(b);renderBlocks();}

document.addEventListener("keydown",e=>{
  if((e.key==="Delete"||e.key==="Backspace") && selectedId && document.activeElement?.contentEditable!=="true"){
    e.preventDefault();deleteSelected();
  }
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="d"){e.preventDefault();duplicateSelected();}
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="b"){e.preventDefault();changeSelected(b=>b.bold=!b.bold);}
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="i"){e.preventDefault();changeSelected(b=>b.italic=!b.italic);}
});

function syncToolbar(){
  const b=selected();
  $("selectionStatus").textContent=b?`Text ${blocks.indexOf(b)+1} selected — click to edit • drag to move • drag blue corner to resize`:"Click a text block to edit it";
  $("fontBtn").textContent=b?(b.font.split(",")[0].replace(/['"]/g,"")):"Font";
  $("sizeBtn").textContent=b?`${b.size}px ▾`:"Size ▾";
  $("boldBtn").classList.toggle("active",!!b?.bold);
  $("italicBtn").classList.toggle("active",!!b?.italic);
  if(b){
    $("fontFamily").value=b.font;$("fontSize").value=b.size;$("fontSizeValue").textContent=`${b.size}px`;
    $("textColor").value=b.color;$("textColorDot").style.background=b.color;$("textWidth").value=b.width;$("widthValue").textContent=`${b.width}%`;
    $("lineHeight").value=b.lineHeight;$("lineHeightValue").textContent=b.lineHeight;$("shadowToggle").checked=b.shadow;
  }
}

function setFormat(f){currentFormat=f;const[w,h]=formats[f];$("stage").style.aspectRatio=`${w}/${h}`;$("formatBtn").textContent=f[0].toUpperCase()+f.slice(1)+" ▾";renderBlocks();closeMenus();}
function applyBackground(){
  const el=$("backgroundLayer");
  if(bg.type==="solid"){el.style.background=bg.color;el.style.backgroundImage="none";}
  else if(bg.type==="gradient"){el.style.background=`linear-gradient(${bg.gradient.join(",")})`;}
  else if(bg.type==="image"&&bg.image){const size=bg.scale==="actual"?"auto":bg.scale;el.style.backgroundColor="#000";el.style.backgroundImage=`linear-gradient(rgba(0,0,0,${bg.darkness/100}),rgba(0,0,0,${bg.darkness/100})),url("${bg.image}")`;el.style.backgroundSize=`cover, ${size}`;el.style.backgroundRepeat="no-repeat,no-repeat";el.style.backgroundPosition=`center, ${bg.posX}% ${bg.posY}%`;}
}
async function loadImage(src){return new Promise((res,rej)=>{const i=new Image();i.crossOrigin="anonymous";i.onload=()=>res(i);i.onerror=rej;i.src=src;});}
async function useImage(src){try{bg={...bg,type:"image",image:src,imageObj:await loadImage(src),posX:50,posY:50};applyBackground();closeMenus();}catch{setStatus("Could not load image.",false);}}

function renderMenus(){
  $("solidColors").innerHTML=solidColors.map((c,i)=>`<button class="swatch ${i===0?"active":""}" data-solid="${c}" style="background:${c}"></button>`).join("");
  $("gradients").innerHTML=gradients.map(g=>`<button class="swatch" data-gradient='${JSON.stringify(g)}' style="background:linear-gradient(${g.join(",")})"></button>`).join("");
  $("emojiGrid").innerHTML=emojis.map(e=>`<button class="emojiBtn" data-emoji="${e}">${e}</button>`).join("");
}

function closeMenus(){document.querySelectorAll(".popover.open").forEach(p=>p.classList.remove("open"));}
function openMenu(id,anchor){
  closeMenus();
  const m=$(id);m.classList.add("open");
  const r=anchor.getBoundingClientRect(),mw=m.offsetWidth,mh=m.offsetHeight;
  let left=Math.min(window.innerWidth-mw-10,Math.max(10,r.left));
  let top=r.bottom+7;
  if(top+mh>window.innerHeight-55)top=Math.max(65,r.top-mh-7);
  m.style.left=`${left}px`;m.style.top=`${top}px`;
}
document.addEventListener("click",e=>{
  const trigger=e.target.closest("[data-menu]");
  if(trigger){e.stopPropagation();const id=trigger.dataset.menu;const already=$(id).classList.contains("open");closeMenus();if(!already)openMenu(id,trigger);return;}
  if(!e.target.closest(".popover"))closeMenus();

  const solid=e.target.closest("[data-solid]");if(solid){bg={...bg,type:"solid",color:solid.dataset.solid,image:null,imageObj:null};applyBackground();closeMenus();return;}
  const grad=e.target.closest("[data-gradient]");if(grad){bg={...bg,type:"gradient",gradient:JSON.parse(grad.dataset.gradient),image:null,imageObj:null};applyBackground();closeMenus();return;}
  const al=e.target.closest("[data-align]");if(al){changeSelected(b=>b.align=al.dataset.align);closeMenus();return;}
  const fm=e.target.closest("[data-format]");if(fm){setFormat(fm.dataset.format);return;}
  const sc=e.target.closest("[data-scale]");if(sc){document.querySelectorAll("[data-scale]").forEach(x=>x.classList.remove("active"));sc.classList.add("active");bg.scale=sc.dataset.scale;applyBackground();return;}
  const em=e.target.closest("[data-emoji]");if(em){insertEmoji(em.dataset.emoji);return;}
  const im=e.target.closest("[data-image]");if(im){useImage(im.dataset.image);return;}
});


function insertEmoji(emoji){
  let b=selected();
  if(!b){ addText(emoji); return; }
  const el=document.querySelector(`.textBlock[data-id="${b.id}"]`);
  if(!el){ b.text+=emoji; renderBlocks(); return; }

  el.focus();
  const saved=lastCaretRange.get(b.id);
  const sel=window.getSelection();
  if(saved && sel){
    try{
      sel.removeAllRanges(); sel.addRange(saved);
      const range=sel.getRangeAt(0);
      range.deleteContents();
      const node=document.createTextNode(emoji);
      range.insertNode(node);
      range.setStartAfter(node); range.collapse(true);
      sel.removeAllRanges(); sel.addRange(range);
      lastCaretRange.set(b.id,range.cloneRange());
      b.text=el.innerText;
      renderBlocks();
      return;
    }catch(_){}
  }

  b.text += emoji;
  renderBlocks();
  const updated=document.querySelector(`.textBlock[data-id="${b.id}"]`);
  updated?.focus();
}

$("addTextBtn").onclick=()=>addText("New text");
$("duplicateBtn").onclick=duplicateSelected;
$("deleteBtn").onclick=deleteSelected;
$("fontFamily").onchange=()=>changeSelected(b=>b.font=$("fontFamily").value);
$("fontSize").oninput=()=>changeSelected(b=>b.size=Number($("fontSize").value));
$("boldBtn").onclick=()=>changeSelected(b=>b.bold=!b.bold);
$("italicBtn").onclick=()=>changeSelected(b=>b.italic=!b.italic);
$("textColor").oninput=()=>changeSelected(b=>b.color=$("textColor").value);
$("textWidth").oninput=()=>changeSelected(b=>b.width=Number($("textWidth").value));
$("lineHeight").oninput=()=>changeSelected(b=>b.lineHeight=Number($("lineHeight").value));
$("shadowToggle").onchange=()=>changeSelected(b=>b.shadow=$("shadowToggle").checked);
$("poweredByToggle").onchange=()=>{$("poweredBy").style.display=$("poweredByToggle").checked?"block":"none";};
$("applyBgColor").onclick=()=>{bg={...bg,type:"solid",color:$("bgColor").value,image:null,imageObj:null};applyBackground();closeMenus();};
$("imageUpload").onchange=e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>useImage(r.result);r.readAsDataURL(f);};
$("darkness").oninput=()=>{bg.darkness=Number($("darkness").value);$("darknessValue").textContent=`${bg.darkness}%`;applyBackground();};

$("featuredBtn").onclick=()=>loadFeatured($("featuredSearch").value);
async function loadFeatured(q=""){
  $("featuredResults").textContent="Loading…";
  try{
    const r=await fetch(FEATURED_ENDPOINT,{cache:"no-store"}),j=await r.json(),items=Object.values(j.featured||{}),s=q.trim().toLowerCase(),f=s?items.filter(x=>`${x.category||""} ${x.tags||""}`.toLowerCase().includes(s)):items;
    $("featuredResults").innerHTML=f.slice(0,18).map(x=>`<img class="imageChoice" data-image="${x["image-url"]}" src="${x["image-url"]}">`).join("")||"No matches.";
  }catch{$("featuredResults").textContent="Featured images unavailable.";}
}

function wrap(ctx,text,maxWidth){const lines=[];for(const para of text.split("\n")){if(!para){lines.push("");continue;}let line="";for(const word of para.split(/\s+/)){const test=line?`${line} ${word}`:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word;}else line=test;}lines.push(line);}return lines;}
function makeGradient(ctx,w,h,g){const[d,...colors]=g;let gr;if(d==="to left")gr=ctx.createLinearGradient(w,0,0,0);else if(d==="to bottom")gr=ctx.createLinearGradient(0,0,0,h);else if(d==="to top")gr=ctx.createLinearGradient(0,h,0,0);else if(d==="45deg")gr=ctx.createLinearGradient(0,0,w,h);else if(d==="135deg")gr=ctx.createLinearGradient(0,h,w,0);else gr=ctx.createLinearGradient(0,0,w,0);colors.forEach((c,i)=>gr.addColorStop(colors.length===1?0:i/(colors.length-1),c));return gr;}
function drawImageBg(ctx,img,w,h){ctx.fillStyle="#000";ctx.fillRect(0,0,w,h);const ir=img.naturalWidth/img.naturalHeight,cr=w/h;let dw,dh;if(bg.scale==="actual"){dw=img.naturalWidth;dh=img.naturalHeight;}else if((bg.scale==="cover"&&ir>cr)||(bg.scale==="contain"&&ir<cr)){dh=h;dw=h*ir;}else{dw=w;dh=w/ir;}const x=(w-dw)/2-((bg.posX-50)/50)*(Math.max(0,dw-w)/2),y=(h-dh)/2-((bg.posY-50)/50)*(Math.max(0,dh-h)/2);ctx.drawImage(img,x,y,dw,dh);if(bg.darkness){ctx.fillStyle=`rgba(0,0,0,${bg.darkness/100})`;ctx.fillRect(0,0,w,h);}}

async function exportCanvas(){
  const c=$("exportCanvas"),ctx=c.getContext("2d"),[w,h]=formats[currentFormat];c.width=w;c.height=h;
  if(bg.type==="solid"){ctx.fillStyle=bg.color;ctx.fillRect(0,0,w,h);}
  else if(bg.type==="gradient"){ctx.fillStyle=makeGradient(ctx,w,h,bg.gradient);ctx.fillRect(0,0,w,h);}
  else if(bg.type==="image"&&bg.imageObj)drawImageBg(ctx,bg.imageObj,w,h);
  for(const b of blocks){
    if(!b.text.trim())continue;
    ctx.font=`${b.italic?"italic ":""}${b.bold?"700":"400"} ${b.size}px ${b.font}`;
    ctx.fillStyle=b.color;ctx.textBaseline="middle";ctx.textAlign=b.align;ctx.shadowColor=b.shadow?"rgba(0,0,0,.55)":"transparent";ctx.shadowBlur=b.shadow?8:0;ctx.shadowOffsetY=b.shadow?3:0;
    const mw=w*b.width/100,lines=wrap(ctx,b.text,mw),lh=b.size*b.lineHeight,cx=w*b.x/100,x=b.align==="left"?cx-mw/2:b.align==="right"?cx+mw/2:cx,y0=h*b.y/100-((lines.length-1)*lh)/2;
    lines.forEach((line,i)=>ctx.fillText(line,x,y0+i*lh,mw));
  }
  ctx.shadowColor="transparent";
  if($("poweredByToggle").checked){ctx.font="500 18px Arial";ctx.fillStyle="rgba(255,255,255,.72)";ctx.textAlign="right";ctx.fillText("Powered by MyPoint.Cards",w-20,h-20);}
  return c;
}
$("downloadBtn").onclick=async()=>{const c=await exportCanvas(),a=document.createElement("a");a.href=c.toDataURL("image/png");a.download="postcard.png";a.click();};

async function findSocialTab(){
  const tabs=await chrome.tabs.query({currentWindow:false});
  return tabs.find(t=>/^https:\/\/(x\.com|twitter\.com|www\.linkedin\.com|www\.facebook\.com|(?:www\.)?reddit\.com|bsky\.app)\//.test(t.url||""));
}
async function siteInfo(){
  try{
    const tabs=await chrome.tabs.query({});
    const social=tabs.find(t=>/^https:\/\/(x\.com|twitter\.com|www\.linkedin\.com|www\.facebook\.com|(?:www\.)?reddit\.com|bsky\.app)\//.test(t.url||""));
    $("siteBadge").textContent=social?`Ready: ${new URL(social.url).hostname}`:"Open a supported social site";
    $("insertBtn").disabled=!social;
  }catch{$("siteBadge").textContent="Open a supported social site";$("insertBtn").disabled=true;}
}
$("insertBtn").onclick=async()=>{
  try{
    const social=await findSocialTab();if(!social){setStatus("Open a supported social site first.",false);return;}
    const c=await exportCanvas();
    const res=await chrome.tabs.sendMessage(social.id,{type:"POSTCARD_INSERT",imageDataUrl:c.toDataURL("image/png"),postText:$("postText").value});
    if(res?.ok){setStatus("Inserted. Returning to your post…");await chrome.tabs.update(social.id,{active:true});setTimeout(()=>window.close(),180);}
    else setStatus(res?.error||"Could not insert.",false);
  }catch{setStatus("Could not insert into the social page. Reload it and try again.",false);}
};

renderMenus();
applyBackground();
setFormat("landscape");
siteInfo();
loadFeatured();

(async()=>{
  const s=await chrome.storage.local.get(["postcardSelectedText","postcardSelectedAt"]);
  if(s.postcardSelectedText&&Date.now()-(s.postcardSelectedAt||0)<600000){
    addText(s.postcardSelectedText);
    await chrome.storage.local.remove(["postcardSelectedText","postcardSelectedAt"]);
  }else addText("What's on your mind?");
})();
