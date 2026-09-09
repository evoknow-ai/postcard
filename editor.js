const $ = id => document.getElementById(id);
const RETURN_TO_SLIDES_KEY="postcardReturnToSlidesV1";

const formats={landscape:[1200,675],square:[1080,1080],portrait:[1080,1350]};
const FEATURED_ENDPOINT="https://featured.mypoint.cards";
const GIPHY_API_KEY="GlVGYHkr3WSBnllca54iNt0yFbjz7L65";
const solidColors=["#ED213A","#3498db","#2ecc71","#f39c12","#9b59b6","#34495e","#1abc9c","#000000","#e74c3c","#f1c40f","#95a5a6","#ffffff","#e84393","#8B4513"];
const gradients=[["to right","#f12711","#f5af19"],["to right","#8e2de2","#4a00e0"],["to right","#00b09b","#96c93d"],["45deg","#ff9a9e","#fad0c4"],["to right","#4facfe","#00f2fe"],["135deg","#667eea","#764ba2"],["to right","#2c3e50","#4ca1af"],["to right","#f953c6","#b91d73"],["to right","#11998e","#38ef7d"],["45deg","#fc4a1a","#f7b733"],["to right","#43cea2","#185a9d"],["135deg","#ff0844","#ffb199"]];
const emojis="😀 😂 😍 🥰 😎 🤔 😅 😢 😡 🤯 🤩 😴 😇 😬 🤗 🥳 🤡 😄 🙂 😉 😆 🥺 😤 👍 🙏 💪 🙌 👀 🤷‍♂️ 🤦‍♀️ 🧠 👑 🫶 👎 ✌️ 🤝 👏 ❤️ 🎉 ✨ 🔥 💯 🚫 ❌ ⭐ 🌟 💙 💚 💜 🖤 🤍 💖 💡 💥 ☀️ 🌙 ✅ ⚡ 🚀 📈 📱 💻 ⚽ 🏀 🎮 🎵 🎬 📚 🎯 📝 📢 🎙️ 🇦🇺 🇧🇩 🇧🇷 🇨🇦 🇨🇳 🇩🇪 🇫🇷 🇮🇳 🇮🇹 🇯🇵 🇰🇷 🇬🇧 🇺🇸".split(" ");

let defaultFont="Arial, sans-serif";
let bg={type:"solid",color:"#ED213A",gradient:null,image:null,imageObj:null,scale:"contain",darkness:20,posX:50,posY:50};
let blocks=[],selectedId=null,nextId=1,drag=null,currentFormat="landscape";
let tables=[],selectedTableId=null,nextTableId=1;

const tableTemplates={
  clean:{header:"#e5e7eb",body:"#ffffff",text:"#111827",border:"#9ca3af"},
  midnight:{header:"#111827",body:"#1f2937",text:"#f9fafb",border:"#4b5563"},
  ocean:{header:"#075985",body:"#0e7490",text:"#ecfeff",border:"#67e8f9"},
  emerald:{header:"#065f46",body:"#047857",text:"#ecfdf5",border:"#6ee7b7"},
  sunset:{header:"#9a3412",body:"#ea580c",text:"#fff7ed",border:"#fdba74"},
  slate:{header:"#334155",body:"#475569",text:"#f8fafc",border:"#94a3b8"},
  glass:{header:"rgba(255,255,255,.22)",body:"rgba(255,255,255,.10)",text:"#ffffff",border:"rgba(255,255,255,.65)"}
};
function normalizeTable(t){
  t.font=t.font||"Arial, sans-serif";t.size=t.size||28;t.color=t.color||"#ffffff";
  t.align=t.align||"center";t.bold=!!t.bold;t.italic=!!t.italic;
  t.borderSize=(t.borderSize??2);t.template=t.template||"midnight";
  const tpl=tableTemplates[t.template]||tableTemplates.midnight;
  t.header=(t.header??false);t.headerColor=t.headerColor||tpl.header;t.bodyColor=t.bodyColor||tpl.body;t.borderColor=t.borderColor||tpl.border;
  return t;
}
function applyTableTemplate(t,name){
  const x=tableTemplates[name]||tableTemplates.midnight;
  t.template=name;t.headerColor=x.header;t.bodyColor=x.body;t.color=x.text;t.borderColor=x.border;
}

let slides=[],activeSlide=0;
let dragCandidate=null;
const lastCaretRange=new Map();

/* Unlimited session undo/redo. We keep immutable editor snapshots for the
   lifetime of the editor window. Consecutive identical snapshots are ignored. */
let undoStack=[];
let redoStack=[];
let historySuspended=false;
let historyTimer=null;
let objectClipboard=null;

function cloneForHistory(value){
  return JSON.parse(JSON.stringify(value,(k,v)=>{
    if(k==="imageObj"||k==="gifFrames") return undefined;
    return v;
  }));
}
function historyState(){
  return {
    bg:cloneForHistory(bg),
    blocks:cloneForHistory(blocks),
    tables:cloneForHistory(tables),
    slides:cloneForHistory(slides),
    activeSlide,
    selectedId,
    selectedTableId,
    images:cloneForHistory(images),
    selectedImageId,
    nextId,
    nextTableId,
    currentFormat,
    postText:$("postText")?.value||"",
    poweredBy:$("poweredByToggle")?.checked||false
  };
}
function historyKey(s){ return JSON.stringify(s); }

async function restoreHistoryState(st){
  if(!st) return;
  historySuspended=true;
  try{
    bg=cloneForHistory(st.bg);
    blocks=cloneForHistory(st.blocks);
    tables=cloneForHistory(st.tables);
    slides=cloneForHistory(st.slides);
    activeSlide=st.activeSlide||0;
    images=cloneForHistory(st.images||[]);
    selectedImageId=st.selectedImageId??null;
    selectedId=st.selectedId??null;
    selectedTableId=st.selectedTableId??null;
    nextId=st.nextId||1;
    nextTableId=st.nextTableId||1;
    currentFormat=st.currentFormat||"landscape";
    $("postText").value=st.postText||"";
    $("poweredByToggle").checked=!!st.poweredBy;
    $("poweredBy").style.display=st.poweredBy?"block":"none";
    if(bg.image){
      try{ bg.imageObj=await loadImage(bg.image); }catch(_){ bg.imageObj=null; }
    }
    setFormat(currentFormat);
    applyBackground();
    renderBlocks();
    renderTables();
    renderSlideList();
    syncToolbar();
    scheduleSave?.();
  } finally {
    historySuspended=false;
    updateHistoryButtons();
  }
}
function initHistory(){
  undoStack=[historyState()];
  redoStack=[];
  updateHistoryButtons();
}
function commitHistory(){
  if(historySuspended) return;
  clearTimeout(historyTimer);
  historyTimer=setTimeout(()=>{
    const s=historyState();
    const last=undoStack[undoStack.length-1];
    if(!last || historyKey(last)!==historyKey(s)){
      undoStack.push(s);
      redoStack=[];
      updateHistoryButtons();
    }
  },80);
}
async function undo(){
  clearTimeout(historyTimer);
  if(undoStack.length<=1) return;
  const current=undoStack.pop();
  redoStack.push(current);
  await restoreHistoryState(undoStack[undoStack.length-1]);
}
async function redo(){
  clearTimeout(historyTimer);
  if(!redoStack.length) return;
  const next=redoStack.pop();
  undoStack.push(next);
  await restoreHistoryState(next);
}
function updateHistoryButtons(){
  if($("undoBtn")) $("undoBtn").disabled=undoStack.length<=1;
  if($("redoBtn")) $("redoBtn").disabled=redoStack.length===0;
}
function isEditingField(){
  const a=document.activeElement;
  return !!a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
}
function clipboardPayload(){
  const im=selectedImage();
  if(im)return {type:"image",data:cloneForHistory(im)};
  const b=selected();
  const t=selectedTable();
  if(b) return {type:"text",data:cloneForHistory(b)};
  if(t) return {type:"table",data:cloneForHistory(t)};
  return null;
}
function clipboardPlainText(payload){
  if(payload?.type==="image")return payload.data.src;
  if(payload?.type==="text") return payload.data.text||"";
  if(payload?.type==="table") return payload.data.cells.map(row=>row.join("\t")).join("\n");
  return "";
}
function writeObjectClipboard(e,payload){
  objectClipboard=payload;
  e.clipboardData?.setData("text/plain",clipboardPlainText(payload));
  try{e.clipboardData?.setData("application/x-postcard-object",JSON.stringify(payload));}catch(_){}
}
function copySelectedObject(){
  const payload=clipboardPayload();
  if(!payload)return false;
  objectClipboard=payload;
  setStatus(`${payload.type==="text"?"Text":payload.type==="image"?"Image":"Table"} copied.`);
  return true;
}
function pasteSelectedObject(payload=objectClipboard){
  if(!payload) return false;
  if(payload.type==="image"){return pasteImageObject(payload.data);}
  if(payload.type==="text"){
    const src=cloneForHistory(payload.data);
    src.id=nextId++;
    src.x=Math.min(92,(src.x||50)+4);
    src.y=Math.min(92,(src.y||50)+4);
    selectedImageId=null;
    blocks.push(src);
    selectedId=src.id; selectedTableId=null;
    renderBlocks(); renderTables(); commitHistory(); scheduleSave?.();
    setStatus("Text pasted.");
    return true;
  }
  if(payload.type==="table"){
    const src=cloneForHistory(payload.data);
    src.id=nextTableId++;
    src.x=Math.min(92,(src.x||50)+4);
    src.y=Math.min(92,(src.y||50)+4);
    selectedImageId=null;
    tables.push(src);
    selectedTableId=src.id; selectedId=null;
    renderTables(); renderBlocks(); commitHistory(); scheduleSave?.();
    setStatus("Table pasted.");
    return true;
  }
  return false;
}


function block(id){return blocks.find(b=>b.id===id);}
function selected(){return block(selectedId);}
function selectedTable(){return tables.find(t=>t.id===selectedTableId);}
function setStatus(t,ok=true){$("status").textContent=t;$("status").style.color=ok?"#7bcf9e":"#ff8f8f";}

function makeBlock(text="Type here"){
  return{id:nextId++,text,x:50,y:50,width:70,font:defaultFont,size:56,color:"#ffffff",align:"center",lineHeight:1.2,bold:true,italic:false,shadow:true};
}

function displaySize(px){const sw=$("stage").clientWidth||900;const[ew]=formats[currentFormat];return px*(sw/ew);}

function renderTables(){
  let layer=$("tableLayer");
  if(!layer){
    layer=document.createElement("div");
    layer.id="tableLayer";layer.style.position="absolute";layer.style.inset="0";
    $("stage").insertBefore(layer,$("textLayer"));
  }
  const old=new Map([...layer.querySelectorAll(".tableBlock")].map(e=>[Number(e.dataset.id),e]));
  for(const raw of tables){
    const t=normalizeTable(raw);
    let el=old.get(t.id);
    if(!el){
      el=document.createElement("div");el.className="tableBlock";el.dataset.id=t.id;
      el.innerHTML='<div class="tableMoveHandle" title="Drag table">✥</div><table><tbody></tbody></table><div class="tableResizeHandle" title="Resize table"></div>';
      layer.appendChild(el);wireTable(el);
    }
    el.style.left=`${t.x}%`;el.style.top=`${t.y}%`;el.style.width=`${t.width}%`;el.style.height=`${t.height||Math.max(16,t.rows*9)}%`;
    el.classList.toggle("selected",t.id===selectedTableId);
    const tbody=el.querySelector("tbody");
    const focused=el.contains(document.activeElement);
    if(!focused){
      tbody.innerHTML=t.cells.map((row,r)=>`<tr>${row.map((cell,c)=>`<td contenteditable="true" spellcheck="true" data-r="${r}" data-c="${c}">${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
    }
    el.querySelectorAll("td").forEach(td=>{
      const r=Number(td.dataset.r);
      td.style.textAlign=t.align||"center";
      td.style.fontFamily=t.font;
      td.style.fontSize=`${displaySize(t.size)}px`;
      td.style.color=t.color;
      td.style.fontWeight=(t.header&&r===0)?"700":(t.bold?"700":"400");
      td.style.fontStyle=t.italic?"italic":"normal";
      td.style.border=`${t.borderSize}px solid ${t.borderColor}`;
      td.style.background=(t.header&&r===0)?t.headerColor:t.bodyColor;
    });
    old.delete(t.id);
  }
  old.forEach(e=>e.remove());
  syncToolbar();
}
function escapeHtml(value){
  return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"','&quot;');
}
function selectTable(id,{render=true}={}){
  selectedImageId=null;renderImages();
  selectedTableId=id;
  selectedId=null;
  if(render){ renderBlocks(); renderTables(); }
  else {
    document.querySelectorAll(".textBlock.selected").forEach(e=>e.classList.remove("selected"));
    document.querySelectorAll(".tableBlock").forEach(e=>e.classList.toggle("selected",Number(e.dataset.id)===id));
    syncToolbar();
  }
}
function wireTable(el){
  el.addEventListener("click",e=>{
    selectTable(Number(el.dataset.id),{render:false});
    e.stopPropagation();
  });
  el.addEventListener("focusin",e=>{
    if(e.target.closest("td")){selectTable(Number(el.dataset.id),{render:false});e.stopPropagation();}
  });
  el.addEventListener("input",e=>{
    const td=e.target.closest("td");if(!td)return;
    const t=tables.find(x=>x.id===Number(el.dataset.id));
    if(t)t.cells[Number(td.dataset.r)][Number(td.dataset.c)]=td.innerText;
    scheduleSave?.();e.stopPropagation();
  });
  el.addEventListener("keydown",e=>e.stopPropagation());
  el.addEventListener("pointerdown",e=>{
    if(e.button!==0)return;
    const t=tables.find(x=>x.id===Number(el.dataset.id));if(!t)return;
    selectTable(t.id,{render:false});
    if(e.target.closest(".tableResizeHandle")){e.preventDefault();e.stopPropagation();drag={type:"table-resize",id:t.id,x:e.clientX,y:e.clientY,startWidth:t.width,startHeight:t.height||Math.max(16,t.rows*9)};return;}
    if(e.target.closest(".tableMoveHandle")){e.preventDefault();e.stopPropagation();drag={type:"table",id:t.id,x:e.clientX,y:e.clientY,bx:t.x,by:t.y};return;}
    if(e.target.closest("td")){e.stopPropagation();return;}
    e.preventDefault();drag={type:"table",id:t.id,x:e.clientX,y:e.clientY,bx:t.x,by:t.y};
  });
}
function addTable(rows,cols){
  const t=normalizeTable({
    id:nextTableId++,rows,cols,x:50,y:58,
    width:Math.min(76,Math.max(34,cols*16)),
    height:Math.min(62,Math.max(18,rows*10)),
    font:"Arial, sans-serif",size:28,color:"#ffffff",align:"center",bold:false,italic:false,
    borderSize:2,header:false,template:"midnight",
    cells:Array.from({length:rows},()=>Array.from({length:cols},()=>""))
  });
  applyTableTemplate(t,"midnight");
  selectedImageId=null;renderImages();
  tables.push(t);selectedTableId=t.id;selectedId=null;renderTables();closeMenus();scheduleSave?.();
  setTimeout(()=>document.querySelector(`.tableBlock[data-id="${t.id}"] td`)?.focus(),0);
}
function renderBlocks(){
  renderImages();
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
  old.forEach(e=>e.remove());syncToolbar();renderTables();
}

function saveCaret(el){
  const sel=window.getSelection();
  if(!sel || !sel.rangeCount || !el.contains(sel.anchorNode)) return;
  try { lastCaretRange.set(Number(el.dataset.id), sel.getRangeAt(0).cloneRange()); } catch(_) {}
}

function placeCaretFromPoint(el,x,y){
  try{
    let range=null;
    if(document.caretPositionFromPoint){
      const pos=document.caretPositionFromPoint(x,y);
      if(pos){range=document.createRange();range.setStart(pos.offsetNode,pos.offset);range.collapse(true);}
    }else if(document.caretRangeFromPoint){
      range=document.caretRangeFromPoint(x,y);
    }
    if(range && el.contains(range.startContainer)){
      const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);
    }else{
      const range2=document.createRange();range2.selectNodeContents(el);range2.collapse(false);
      const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range2);
    }
  }catch(_){}
}
function wireTextBlock(el){
  const id=()=>Number(el.dataset.id);
  el.addEventListener("focus",()=>selectBlock(id(),{render:false}));
  el.addEventListener("click",()=>{ selectBlock(id(),{render:false}); saveCaret(el); });
  el.addEventListener("keyup",()=>saveCaret(el));
  el.addEventListener("input",()=>{const b=block(id());if(b)b.text=el.innerText;saveCaret(el);commitHistory?.();});

  // Robust direct manipulation:
  // pointer down captures the pointer so contenteditable selection cannot steal
  // the drag. A short click still enters text editing at the clicked location.
  el.addEventListener("pointerdown",e=>{
    if(e.button!==0) return;
    const bid=id();
    const active=document.activeElement;
    if(active?.isContentEditable && active!==el)active.blur();
    const wasSelected=selectedId===bid;
    selectBlock(bid,{render:false});
    const b=block(bid); if(!b)return;
    const rect=el.getBoundingClientRect();
    const onResizeHandle=e.clientX>=rect.right-20 && e.clientY>=rect.bottom-20;

    e.stopPropagation();

    if(onResizeHandle){
      e.preventDefault();
      try{el.setPointerCapture(e.pointerId);}catch(_){}
      const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
      drag={
        type:"resize",id:bid,x:e.clientX,y:e.clientY,cx,cy,
        startDist:Math.max(24,Math.hypot(e.clientX-cx,e.clientY-cy)),
        startSize:b.size,startWidth:b.width,el,pointerId:e.pointerId,moved:true
      };
      el.classList.add("resizing");
      return;
    }

    // In text-edit mode, pointer gestures stay native so dragging highlights
    // characters and double-clicking selects words.
    if(document.activeElement===el)return;

    e.preventDefault();
    try{el.setPointerCapture(e.pointerId);}catch(_){}

    drag={
      type:"text",id:bid,x:e.clientX,y:e.clientY,bx:b.x,by:b.y,
      el,pointerId:e.pointerId,moved:false,downX:e.clientX,downY:e.clientY,wasSelected
    };
  });

  el.addEventListener("pointerup",e=>{
    if(!drag || drag.id!==id() || drag.pointerId!==e.pointerId)return;
    const wasClick=drag.type==="text" && !drag.moved;
    try{el.releasePointerCapture(e.pointerId);}catch(_){}
    if(wasClick && drag.wasSelected){
      const x=e.clientX,y=e.clientY;
      setTimeout(()=>{
        el.focus();
        placeCaretFromPoint(el,x,y);
        saveCaret(el);
      },0);
    }
  });
}

window.addEventListener("pointermove",e=>{
  if(!drag)return;
  const r=$("stage").getBoundingClientRect();
  if(drag.type==="table"){
    const t=tables.find(x=>x.id===drag.id); if(!t)return;
    t.x=Math.max(4,Math.min(96,drag.bx+(e.clientX-drag.x)/r.width*100));
    t.y=Math.max(4,Math.min(96,drag.by+(e.clientY-drag.y)/r.height*100));
    renderTables();
  }else if(drag.type==="table-resize"){
    const t=tables.find(x=>x.id===drag.id); if(!t)return;
    t.width=Math.max(18,Math.min(94,drag.startWidth+(e.clientX-drag.x)/r.width*100));
    t.height=Math.max(12,Math.min(88,drag.startHeight+(e.clientY-drag.y)/r.height*100));
    renderTables();
  }else if(drag.type==="text"){
    const b=block(drag.id);if(!b)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(!drag.moved && Math.hypot(e.clientX-drag.downX,e.clientY-drag.downY)>=3){
      drag.moved=true;
      drag.el?.classList.add("dragging");
      if(drag.el)drag.el.style.userSelect="none";
      const sel=window.getSelection();if(sel)sel.removeAllRanges();
    }
    if(!drag.moved)return;
    b.x=Math.max(5,Math.min(95,drag.bx+dx/r.width*100));
    b.y=Math.max(5,Math.min(95,drag.by+dy/r.height*100));
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
window.addEventListener("pointerup",e=>{
  const finished=drag;
  setTimeout(()=>{
    if(finished?.el){finished.el.classList.remove("dragging","resizing");finished.el.style.userSelect="";}
    document.querySelectorAll(".textBlock.resizing").forEach(el=>el.classList.remove("resizing"));
    if(drag===finished)drag=null;
    dragCandidate=null;
    if(finished?.moved){commitHistory?.();scheduleSave?.();}
  },0);
});

$("stage").addEventListener("pointerdown",e=>{
  if(e.target.closest(".textBlock,.tableBlock,.imageBlock"))return;
  document.activeElement?.blur?.();
  selectedTableId=null;selectBlock(null);
  if(bg.type==="image")drag={type:"bg",x:e.clientX,y:e.clientY,bx:bg.posX,by:bg.posY};
  else { selectedTableId=null; selectBlock(null); }
});

function selectBlock(id,{render=true}={}){
  selectedImageId=null;renderImages();
  selectedId=id;if(id!=null)selectedTableId=null;
  if(render){renderBlocks();return;}
  document.querySelectorAll(".textBlock").forEach(e=>e.classList.toggle("selected",Number(e.dataset.id)===id));
  document.querySelectorAll(".tableBlock.selected").forEach(e=>e.classList.remove("selected"));
  syncToolbar();
}
function addText(text="New text"){
  selectedImageId=null;
  const b=makeBlock(text);
  if(blocks.length)b.y=Math.min(85,40+blocks.length*11);
  blocks.push(b);selectedId=b.id;renderBlocks();
  setTimeout(()=>{const el=document.querySelector(`.textBlock[data-id="${b.id}"]`);if(el){el.focus();const r=document.createRange(),s=window.getSelection();r.selectNodeContents(el);s.removeAllRanges();s.addRange(r);}},0);
}
function duplicateSelected(){if(selectedImage())return pasteImageObject(selectedImage());const b=selected();if(b){const n={...b,id:nextId++,x:Math.min(90,b.x+5),y:Math.min(90,b.y+5)};blocks.push(n);selectedId=n.id;renderBlocks();return;}if(selectedTableId){const t=tables.find(x=>x.id===selectedTableId);if(!t)return;const n=JSON.parse(JSON.stringify(t));n.id=nextTableId++;n.x=Math.min(90,n.x+4);n.y=Math.min(90,n.y+4);tables.push(n);selectedTableId=n.id;renderTables();}}
function deleteSelected(){
  if(selectedImage()){images=images.filter(im=>im.id!==selectedImageId);selectedImageId=null;renderBlocks();commitHistory();scheduleSave();setStatus("Image deleted.");return true;}
  if(selectedId!=null){
    const id=selectedId;blocks=blocks.filter(b=>b.id!==id);selectedId=null;lastCaretRange.delete(id);renderBlocks();
    setStatus("Text deleted.");commitHistory();scheduleSave?.();return true;
  }
  if(selectedTableId!=null){
    tables=tables.filter(t=>t.id!==selectedTableId);selectedTableId=null;renderTables();
    setStatus("Table deleted.");commitHistory();scheduleSave?.();return true;
  }
  return false;
}
function changeSelected(fn){
  const b=selected();
  if(b){ fn(b); renderBlocks(); scheduleSave?.(); return; }
  const t=selectedTable();
  if(t){ fn(t); renderTables(); scheduleSave?.(); }
}

document.addEventListener("keydown",e=>{
  if((e.key==="Delete"||e.key==="Backspace") && (selectedId||selectedTableId||selectedImageId) && !isEditingField()){
    e.preventDefault();deleteSelected();
  }
  if(e.key==="Escape" && document.activeElement?.isContentEditable){
    e.preventDefault();document.activeElement.blur();syncToolbar();
  }
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="d"){e.preventDefault();duplicateSelected();}
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="b"){e.preventDefault();changeSelected(b=>b.bold=!b.bold);}
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="i"){e.preventDefault();changeSelected(b=>b.italic=!b.italic);}
});

function syncToolbar(){
  const b=selected(),t=selectedTable(),obj=b||t;
  const im=selectedImage();
  $("selectionActions")?.classList.toggle("hidden",!obj&&!im);
  $("imageInspector").classList.toggle("hidden",!im);
  $("textInspector").classList.toggle("hidden",!!im);
  if(im){$("imageWidth").value=Math.round(im.width);$("imageWidthValue").textContent=`${Math.round(im.width)}%`;}
  $("tableInspector")?.classList.toggle("hidden",!t);
  $("selectionStatus").textContent=b?`Text ${blocks.indexOf(b)+1} selected — click again to edit • drag to move • Delete to remove`:(t?"Table selected — edit cells directly • drag ✥ to move • Delete to remove":"Click a text block or table to select it");
  if(im)$("selectionStatus").textContent="Image selected — drag to move • drag a corner to resize • Delete to remove";
  const panelTitle=document.querySelector(".panelHeader strong");if(panelTitle)panelTitle.textContent=im?"Image":t?"Table":b?"Text":"Properties";
  $("sizeBtn").textContent=obj?`${obj.size||28}px ▾`:"Size ▾";
  $("boldBtn").classList.toggle("active",!!obj?.bold);$("italicBtn").classList.toggle("active",!!obj?.italic);
  if(t){
    $("tableFontFamily").value=t.font;$("tableFontSize").value=t.size;$("tableTextColor").value=t.color;
    $("tableBorderSize").value=t.borderSize;$("tableBorderSizeValue").textContent=`${t.borderSize}px`;
    if(/^#/.test(t.bodyColor))$("tableBgColor").value=t.bodyColor;
    $("tableHeaderToggle").checked=!!t.header;$("tableTemplate").value=t.template||"midnight";
  }
  if(obj){
    $("fontFamily").value=obj.font||"Arial, sans-serif";$("fontSize").value=obj.size||28;$("fontSizeValue").textContent=`${obj.size||28}px`;
    $("textColor").value=obj.color||"#ffffff";$("textColorDot").style.background=obj.color||"#ffffff";
    if(b){$("textWidth").value=b.width;$("widthValue").textContent=`${b.width}%`;$("lineHeight").value=b.lineHeight;$("lineHeightValue").textContent=b.lineHeight;$("shadowToggle").checked=b.shadow;}
    document.querySelectorAll("[data-align]").forEach(x=>x.classList.toggle("active",x.dataset.align===(obj.align||"center")));
  }
}
function setFormat(f){
  currentFormat=f;
  const stage=$("stage");
  const[w,h]=formats[f];
  stage.dataset.format=f;
  stage.style.aspectRatio=`${w}/${h}`;
  $("formatBtn").textContent=(f==="landscape"?"Landscape 16:9":f==="portrait"?"Portrait 4:5":"Square 1:1")+" ▾";
  renderBlocks();
  renderTables?.();
  closeMenus();
}
function applyBackground(){
  const el=$("backgroundLayer");
  if(bg.type==="solid"){el.style.background=bg.color;el.style.backgroundImage="none";}
  else if(bg.type==="gradient"){el.style.background=`linear-gradient(${bg.gradient.join(",")})`;}
  else if(bg.type==="image"&&bg.image){const size=bg.scale==="actual"?"auto":bg.scale;el.style.backgroundColor="#000";el.style.backgroundImage=`linear-gradient(rgba(0,0,0,${bg.darkness/100}),rgba(0,0,0,${bg.darkness/100})),url("${bg.image}")`;el.style.backgroundSize=`cover, ${size}`;el.style.backgroundRepeat="no-repeat,no-repeat";el.style.backgroundPosition=`center, ${bg.posX}% ${bg.posY}%`;}
}
async function loadImage(src){return new Promise((res,rej)=>{const i=new Image();i.crossOrigin="anonymous";i.onload=()=>res(i);i.onerror=rej;i.src=src;});}
async function useImage(src){try{bg={...bg,type:"image",image:src,imageObj:await loadImage(src),posX:50,posY:50};applyBackground();closeMenus();}catch{setStatus("Could not load image.",false);}}

function renderMenus(){
  const solidWrap=$("solidColors");
  solidWrap.innerHTML="";
  solidColors.forEach((color,i)=>{
    const btn=document.createElement("button");
    btn.className="swatch"+(i===0?" active":"");
    btn.dataset.solid=color;
    btn.title=color;
    btn.style.setProperty("background-color",color,"important");
    btn.style.setProperty("background-image","none","important");
    solidWrap.appendChild(btn);
  });

  const gradientWrap=$("gradients");
  gradientWrap.innerHTML="";
  gradients.forEach(g=>{
    const btn=document.createElement("button");
    btn.className="swatch";
    btn.dataset.gradient=JSON.stringify(g);
    btn.title=g.join(" → ");
    btn.style.setProperty("background-color","transparent","important");
    btn.style.setProperty("background-image",`linear-gradient(${g.join(",")})`,"important");
    gradientWrap.appendChild(btn);
  });

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
  const tp=e.target.closest("[data-table]");if(tp){const [r,c]=tp.dataset.table.split("x").map(Number);addTable(r,c);return;}
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


async function newSession(){
  if(!confirm("Start a new PostCard? Unsaved design changes will be cleared.")) return;
  await clearSavedState();
  bg={type:"solid",color:"#ED213A",gradient:null,image:null,imageObj:null,scale:"contain",darkness:20,posX:50,posY:50};
  images=[];selectedImageId=null;
  blocks=[];tables=[];slides=[];activeSlide=0;selectedId=null;selectedTableId=null;nextId=1;nextTableId=1;currentFormat="landscape";
  $("postText").value=""; $("poweredByToggle").checked=false; $("poweredBy").style.display="none";
  setFormat("landscape"); applyBackground(); renderTables(); addText("What's on your mind?");
  slides=[serializeSlide()]; renderSlideList(); setStatus("New session.");
}
$("settingsBtn")?.addEventListener("click",()=>chrome.runtime.sendMessage({type:"POSTCARD_OPEN_SETTINGS"}));
$("newSessionBtn").onclick=newSession;
$("sizeMinus").onclick=()=>changeSelected(b=>b.size=Math.max(16,b.size-2));
$("sizePlus").onclick=()=>changeSelected(b=>b.size=Math.min(140,b.size+2));
$("shadowQuick").onclick=()=>changeSelected(b=>b.shadow=!b.shadow);

$("undoBtn")?.addEventListener("click",undo);
$("redoBtn")?.addEventListener("click",redo);
$("addTextBtn").onclick=()=>addText("New text");
$("duplicateBtn").onclick=duplicateSelected;
$("deleteBtn").onclick=deleteSelected;
$("fontFamily").onchange=async()=>{
  defaultFont=$("fontFamily").value;
  await saveLastFontPreference(defaultFont);
  changeSelected(b=>b.font=defaultFont);
};
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

$("deleteTableBtn")?.addEventListener("click",()=>{if(selectedTableId!=null)deleteSelected();});
$("tableFontFamily")?.addEventListener("change",async()=>{
  defaultFont=$("tableFontFamily").value;
  await saveLastFontPreference(defaultFont);
  changeSelected(t=>t.font=defaultFont);
});
$("tableFontSize")?.addEventListener("input",()=>changeSelected(t=>t.size=Math.max(8,Math.min(96,Number($("tableFontSize").value)||28))));
$("tableTextColor")?.addEventListener("input",()=>changeSelected(t=>t.color=$("tableTextColor").value));
$("tableBorderSize")?.addEventListener("input",()=>changeSelected(t=>{t.borderSize=Number($("tableBorderSize").value);$("tableBorderSizeValue").textContent=`${t.borderSize}px`;}));
$("tableBgColor")?.addEventListener("input",()=>changeSelected(t=>{t.bodyColor=$("tableBgColor").value;t.template="custom";}));
$("tableHeaderToggle")?.addEventListener("change",()=>changeSelected(t=>t.header=$("tableHeaderToggle").checked));
$("tableTemplate")?.addEventListener("change",()=>changeSelected(t=>applyTableTemplate(t,$("tableTemplate").value)));

$("featuredBtn").onclick=()=>loadFeatured($("featuredSearch").value);
async function loadFeatured(q=""){
  $("featuredResults").textContent="Loading…";
  try{
    const r=await fetch(FEATURED_ENDPOINT,{cache:"no-store"}),j=await r.json(),items=Object.values(j.featured||{}),s=q.trim().toLowerCase(),f=s?items.filter(x=>`${x.category||""} ${x.tags||""}`.toLowerCase().includes(s)):items;
    $("featuredResults").innerHTML=f.slice(0,60).map(x=>`<img class="imageChoice" loading="lazy" decoding="async" data-image="${x["image-url"]}" src="${x["image-url"]}">`).join("")||"No matches.";
  }catch{$("featuredResults").textContent="Featured images unavailable.";}
}

async function searchGiphy(){
  const q=$("giphySearch").value.trim(); if(!q)return;
  $("giphyResults").textContent="Searching…";
  try{ const r=await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(q)}&limit=12&rating=g`),j=await r.json();
    $("giphyResults").innerHTML=(j.data||[]).map(g=>`<img class="imageChoice" loading="lazy" decoding="async" data-gif="${g.images.original.url}" src="${g.images.fixed_height_small.url}">`).join("")||"No results.";
  }catch{$("giphyResults").textContent="Giphy search failed.";}
}
function serializeSlide(){ return {images:cloneForHistory(images),bg:JSON.parse(JSON.stringify({...bg,imageObj:null,gifFrames:null})),blocks:JSON.parse(JSON.stringify(blocks)),tables:JSON.parse(JSON.stringify(tables)),format:currentFormat,duration:Number($("slideDuration")?.value||3)}; }
async function restoreSlide(sl){
  if(!sl)return; images=cloneForHistory(sl.images||[]);selectedImageId=null; bg=JSON.parse(JSON.stringify(sl.bg)); blocks=JSON.parse(JSON.stringify(sl.blocks)); tables=JSON.parse(JSON.stringify(sl.tables||[])); currentFormat=sl.format||"landscape";
  if(bg.image){try{bg.imageObj=await loadImage(bg.image);}catch{bg.imageObj=null;}}
  $("slideDuration").value=sl.duration||3;$("slideDurationValue").textContent=`${sl.duration||3}s`;setFormat(currentFormat);applyBackground();renderBlocks();renderTables();
}
function saveActiveSlide(){ if(slides[activeSlide]) slides[activeSlide]=serializeSlide(); }
function renderSlideList(){ $("slideList").innerHTML=slides.map((_,i)=>`<button class="slideChip ${i===activeSlide?"active":""}" data-slide="${i}">${i+1}</button>`).join(""); }
async function switchSlide(i){ saveActiveSlide(); activeSlide=i; await restoreSlide(slides[i]); renderSlideList(); }
function addSlide(){ saveActiveSlide(); slides.push({bg:{type:"solid",color:"#ED213A",gradient:null,image:null,imageObj:null,scale:"contain",darkness:20,posX:50,posY:50},blocks:[],tables:[],format:currentFormat,duration:3}); activeSlide=slides.length-1; restoreSlide(slides[activeSlide]); renderSlideList(); }
function duplicateSlide(){ saveActiveSlide(); slides.splice(activeSlide+1,0,JSON.parse(JSON.stringify(slides[activeSlide]))); activeSlide++; restoreSlide(slides[activeSlide]); renderSlideList(); }
function deleteSlide(){ if(slides.length<=1)return; slides.splice(activeSlide,1); activeSlide=Math.max(0,activeSlide-1); restoreSlide(slides[activeSlide]); renderSlideList(); }

async function prepareGifFrames(url){
  if(!url || !("ImageDecoder" in window)) return null;
  try{
    const res=await fetch(url);
    const data=await res.arrayBuffer();
    const decoder=new ImageDecoder({data,type:"image/gif"});
    await decoder.tracks.ready;
    const track=decoder.tracks.selectedTrack;
    const count=Math.min(track.frameCount||1,240);
    const frames=[],durations=[];
    for(let i=0;i<count;i++){
      const decoded=await decoder.decode({frameIndex:i});
      const vf=decoded.image;
      const bmp=await createImageBitmap(vf);
      const dur=Math.max(20,Math.round((vf.duration||100000)/1000));
      frames.push(bmp); durations.push(dur);
      vf.close();
    }
    decoder.close();
    const total=durations.reduce((a,b)=>a+b,0)||1000;
    return {frames,durations,total};
  }catch(err){ console.warn("GIF decode failed",err); return null; }
}
function gifFrameAt(anim,elapsedMs){
  if(!anim||!anim.frames.length)return null;
  let t=((elapsedMs%anim.total)+anim.total)%anim.total;
  for(let i=0;i<anim.frames.length;i++){ if(t<anim.durations[i])return anim.frames[i]; t-=anim.durations[i]; }
  return anim.frames[0];
}
function closeGifAnim(anim){ if(anim?.frames) anim.frames.forEach(f=>{try{f.close()}catch(_){}}); }

async function exportVideo(){
  saveActiveSlide(); if(!slides.length)return;
  const originalIndex=activeSlide;
  const c=$("exportCanvas"),stream=c.captureStream(30);
  let mime="video/webm;codecs=vp9";
  if(MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")) mime="video/mp4;codecs=avc1";
  const chunks=[],rec=new MediaRecorder(stream,{mimeType:mime});
  rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  rec.onstop=()=>{const blob=new Blob(chunks,{type:mime}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=mime.startsWith("video/mp4")?"postcard-slides.mp4":"postcard-slides.webm";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);};
  rec.start(); setStatus("Rendering video…");

  for(const sl of slides){
    await restoreSlide(sl);
    const gifUrl=sl.bg?.isGif ? (sl.bg.gifUrl||sl.bg.image) : null;
    const anim=gifUrl ? await prepareGifFrames(gifUrl) : null;
    const start=performance.now(), duration=(sl.duration||3)*1000;
    while(performance.now()-start<duration){
      const elapsed=performance.now()-start;
      await exportCanvas({gifFrame:gifFrameAt(anim,elapsed)});
      await new Promise(r=>setTimeout(r,33));
    }
    closeGifAnim(anim);
  }
  rec.stop();
  setStatus(mime.startsWith("video/mp4")?"MP4 exported with GIF animation.":"Video exported with GIF animation.");
  activeSlide=Math.min(originalIndex,slides.length-1);
  await restoreSlide(slides[activeSlide]); renderSlideList();
}
function wrap(ctx,text,maxWidth){const lines=[];for(const para of text.split("\n")){if(!para){lines.push("");continue;}let line="";for(const word of para.split(/\s+/)){const test=line?`${line} ${word}`:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word;}else line=test;}lines.push(line);}return lines;}
function makeGradient(ctx,w,h,g){const[d,...colors]=g;let gr;if(d==="to left")gr=ctx.createLinearGradient(w,0,0,0);else if(d==="to bottom")gr=ctx.createLinearGradient(0,0,0,h);else if(d==="to top")gr=ctx.createLinearGradient(0,h,0,0);else if(d==="45deg")gr=ctx.createLinearGradient(0,0,w,h);else if(d==="135deg")gr=ctx.createLinearGradient(0,h,w,0);else gr=ctx.createLinearGradient(0,0,w,0);colors.forEach((c,i)=>gr.addColorStop(colors.length===1?0:i/(colors.length-1),c));return gr;}
function drawImageBg(ctx,img,w,h){ctx.fillStyle="#000";ctx.fillRect(0,0,w,h);const ir=img.naturalWidth/img.naturalHeight,cr=w/h;let dw,dh;if(bg.scale==="actual"){dw=img.naturalWidth;dh=img.naturalHeight;}else if((bg.scale==="cover"&&ir>cr)||(bg.scale==="contain"&&ir<cr)){dh=h;dw=h*ir;}else{dw=w;dh=w/ir;}const x=(w-dw)/2-((bg.posX-50)/50)*(Math.max(0,dw-w)/2),y=(h-dh)/2-((bg.posY-50)/50)*(Math.max(0,dh-h)/2);ctx.drawImage(img,x,y,dw,dh);if(bg.darkness){ctx.fillStyle=`rgba(0,0,0,${bg.darkness/100})`;ctx.fillRect(0,0,w,h);}}

async function exportCanvas(opts={}){
  const c=$("exportCanvas"),ctx=c.getContext("2d"),[w,h]=formats[currentFormat];c.width=w;c.height=h;
  if(bg.type==="solid"){ctx.fillStyle=bg.color;ctx.fillRect(0,0,w,h);}
  else if(bg.type==="gradient"){ctx.fillStyle=makeGradient(ctx,w,h,bg.gradient);ctx.fillRect(0,0,w,h);}
  else if(bg.type==="image"&&(opts.gifFrame||bg.imageObj))drawImageBg(ctx,opts.gifFrame||bg.imageObj,w,h);

  await drawImageObjects(ctx,images,w,h);

  // Export every text block before drawing tables.
  for(const b of blocks){
    if(!b.text || !b.text.trim()) continue;
    ctx.font=`${b.italic?"italic ":""}${b.bold?"700":"400"} ${b.size}px ${b.font}`;
    ctx.fillStyle=b.color;
    ctx.textBaseline="middle";
    ctx.textAlign=b.align;
    ctx.shadowColor=b.shadow?"rgba(0,0,0,.55)":"transparent";
    ctx.shadowBlur=b.shadow?8:0;
    ctx.shadowOffsetY=b.shadow?3:0;

    const maxWidth=w*(b.width/100);
    const lines=wrap(ctx,b.text,maxWidth);
    const lineHeight=b.size*b.lineHeight;
    const centerX=w*(b.x/100);
    const x=b.align==="left"?centerX-maxWidth/2:b.align==="right"?centerX+maxWidth/2:centerX;
    const y0=h*(b.y/100)-((lines.length-1)*lineHeight)/2;

    lines.forEach((line,i)=>ctx.fillText(line,x,y0+i*lineHeight,maxWidth));
  }

  // Tables are rendered after text blocks, matching the visible canvas layer order.
  for(const raw of tables){
    const t=normalizeTable(raw);
    const x=w*t.x/100,y=h*t.y/100,tw=w*t.width/100,th=h*(t.height||Math.max(16,t.rows*9))/100;
    const cw=tw/t.cols,ch=th/t.rows;
    ctx.textAlign="center";ctx.textBaseline="middle";
    for(let rr=0;rr<t.rows;rr++){
      for(let cc=0;cc<t.cols;cc++){
        const left=x-tw/2+cc*cw,top=y-th/2+rr*ch;
        ctx.fillStyle=(t.header&&rr===0)?t.headerColor:t.bodyColor;ctx.fillRect(left,top,cw,ch);
        if(t.borderSize>0){ctx.strokeStyle=t.borderColor;ctx.lineWidth=t.borderSize;ctx.strokeRect(left,top,cw,ch);}
        ctx.fillStyle=t.color;ctx.font=`${(t.header&&rr===0)||t.bold?"700 ":""}${t.italic?"italic ":""}${t.size}px ${t.font}`;
        ctx.fillText(t.cells[rr]?.[cc]||"",left+cw/2,top+ch/2,cw-12);
      }
    }
  }
  ctx.shadowColor="transparent";
  if($("poweredByToggle").checked){ctx.font="500 18px Arial";ctx.fillStyle="rgba(255,255,255,.72)";ctx.textAlign="right";ctx.fillText("Powered by MyPoint.Cards",w-20,h-20);}
  return c;
}
$("downloadBtn").onclick=async()=>{const c=await exportCanvas(),a=document.createElement("a");a.href=c.toDataURL("image/png");a.download="postcard.png";a.click();};

const SUPPORTED_SOCIAL_HOSTS=[
  "x.com","twitter.com",
  "facebook.com","www.facebook.com",
  "instagram.com","www.instagram.com",
  "linkedin.com","www.linkedin.com"
];
const editorParams=new URLSearchParams(location.search);
const sourceTabId=Number(editorParams.get("sourceTabId"))||null;
const sourceWindowId=Number(editorParams.get("sourceWindowId"))||null;

function supportedSocialTab(t){
  try{return !!t && SUPPORTED_SOCIAL_HOSTS.includes(new URL(t.url||"").hostname);}
  catch(_){return false;}
}
async function findSocialTab(){
  // The editor is a popup window, so currentWindow points to the editor itself.
  // Always inspect the browser window the editor was launched from.
  if(sourceWindowId!=null){
    const [active]=await chrome.tabs.query({active:true,windowId:sourceWindowId});
    if(supportedSocialTab(active))return active;
  }
  // If the original tab is still the intended target, allow it as a fallback.
  if(sourceTabId!=null){
    const original=await chrome.tabs.get(sourceTabId).catch(()=>null);
    if(supportedSocialTab(original))return original;
  }
  return null;
}
async function ensurePostCardContentScript(tabId){
  try{
    const ping=await chrome.tabs.sendMessage(tabId,{type:"POSTCARD_SITE_INFO"});
    if(ping)return true;
  }catch(_){}
  // Development extension reloads do not retroactively inject content scripts
  // into already-open pages. Inject it explicitly so Insert works immediately.
  await chrome.scripting.executeScript({target:{tabId},files:["content.js"]});
  await new Promise(r=>setTimeout(r,120));
  return true;
}
async function siteInfo(){
  try{
    const social=await findSocialTab();
    $("insertBtn").disabled=!social;
    $("insertBtn").title=social
      ? `Insert into ${new URL(social.url).hostname}`
      : "Switch the originating browser window to X, Facebook, Instagram, or LinkedIn.";
    if($("siteBadge")){$("siteBadge").textContent="";$("siteBadge").hidden=true;}
  }catch{
    $("insertBtn").disabled=true;
    $("insertBtn").title="Switch the originating browser window to X, Facebook, Instagram, or LinkedIn.";
  }
}
$("insertBtn").onclick=async()=>{
  try{
    const social=await findSocialTab();
    if(!social){
      setStatus("Switch to X, Facebook, Instagram, or LinkedIn in the browser window where PostCard was opened.",false);
      siteInfo();return;
    }
    await ensurePostCardContentScript(social.id);
    const c=await exportCanvas();
    const res=await chrome.tabs.sendMessage(social.id,{
      type:"POSTCARD_INSERT",
      imageDataUrl:c.toDataURL("image/png"),
      postText:$("postText").value
    });
    if(res?.ok){
      setStatus("Inserted. Returning to your post…");
      await chrome.tabs.update(social.id,{active:true});
      await chrome.windows.update(social.windowId,{focused:true}).catch(()=>{});
      setTimeout(()=>window.close(),180);
    }else{
      setStatus(res?.error||"Could not insert into the open post composer.",false);
    }
  }catch(e){
    setStatus(`Could not insert: ${e?.message||"unknown error"}`,false);
  }
};

// Refresh availability if the underlying browser window changes tabs while
// the editor is open.
setInterval(siteInfo,1000);

$("giphyBtn").onclick=searchGiphy;
$("giphySearch").onkeydown=e=>{if(e.key==="Enter")searchGiphy();};
$("removeGifBtn").onclick=()=>{bg={...bg,type:"solid",color:"#ED213A",image:null,imageObj:null};applyBackground();closeMenus();};
$("giphyResults").onclick=async e=>{
  const im=e.target.closest("[data-gif]"); if(!im)return;
  await useImage(im.dataset.gif);
  bg.isGif=true; bg.gifUrl=im.dataset.gif;
  applyBackground(); closeMenus();
};
$("addSlideBtn")?.addEventListener("click",addSlide);$("dupSlideBtn")?.addEventListener("click",duplicateSlide);$("delSlideBtn")?.addEventListener("click",deleteSlide);
$("slideDuration").oninput=()=>{$("slideDurationValue").textContent=`${$("slideDuration").value}s`;if(slides[activeSlide])slides[activeSlide].duration=Number($("slideDuration").value);};




const FONT_PREF_KEY="postcardLastFont";
async function loadLastFontPreference(){
  try{
    const data=await chrome.storage.local.get(FONT_PREF_KEY);
    return data?.[FONT_PREF_KEY]||null;
  }catch(_){ return null; }
}
async function saveLastFontPreference(font){
  try{ await chrome.storage.local.set({[FONT_PREF_KEY]:font}); }catch(_){}
}

const STATE_KEY="postcardEditorStateV1";
let saveTimer=null;

function serializableBg(){
  return JSON.parse(JSON.stringify({...bg,imageObj:null,gifFrames:null}));
}
function currentEditorState(){
  return {
    version:1,
    bg:serializableBg(),
    blocks,
    tables,
    slides,
    activeSlide,
    selectedId,
    selectedTableId,
    images:cloneForHistory(images),
    selectedImageId,
    nextId,
    nextTableId,
    currentFormat,
    postText:$("postText")?.value||"",
    poweredBy:$("poweredByToggle")?.checked||false,
    savedAt:Date.now()
  };
}


function scheduleSave(){
  clearTimeout(saveTimer);
  saveTimer=setTimeout(async()=>{
    try{
      await chrome.storage.local.set({[STATE_KEY]:currentEditorState()});
    }catch(e){
      console.warn("State save failed",e);
    }
  },120);
}
async function restoreEditorState(){
  try{
    const data=await chrome.storage.local.get(STATE_KEY);
    const st=data?.[STATE_KEY];
    if(!st||st.version!==1)return false;
    bg={...bg,...(st.bg||{})};
    blocks=Array.isArray(st.blocks)?st.blocks:[];
    tables=Array.isArray(st.tables)?st.tables.map(t=>({font:"Arial, sans-serif",size:28,color:"#ffffff",align:"center",bold:false,italic:false,...t})):[];
    slides=Array.isArray(st.slides)?st.slides:[];
    activeSlide=Number.isInteger(st.activeSlide)?st.activeSlide:0;
    images=cloneForHistory(st.images||[]);
    selectedImageId=st.selectedImageId??null;
    selectedId=st.selectedId??null;
    selectedTableId=st.selectedTableId??null;
    nextId=st.nextId||1;
    nextTableId=st.nextTableId||1;
    currentFormat=st.currentFormat||"landscape";
    $("postText").value=st.postText||"";
    $("poweredByToggle").checked=!!st.poweredBy;
    $("poweredBy").style.display=st.poweredBy?"block":"none";
    if(bg.image){
      try{bg.imageObj=await loadImage(bg.image);}catch(_){bg.imageObj=null;}
    }
    setFormat(currentFormat);
    applyBackground();
    renderBlocks();
    renderTables();
    renderSlideList();
    return true;
  }catch(e){
    console.warn("State restore failed",e);
    return false;
  }
}
async function clearSavedState(){
  try{await chrome.storage.local.remove(STATE_KEY);}catch(_){}
}

setTimeout(()=>{ if(!slides.length){ slides=[serializeSlide()]; activeSlide=0; renderSlideList(); } },100);

document.addEventListener("input",scheduleSave,true);
document.addEventListener("change",scheduleSave,true);
document.addEventListener("click",e=>{
  if(e.target.closest("#stage,.popover,.rightPanel,.leftRail,.topbar,.canvasToolbar")) scheduleSave();
},true);
window.addEventListener("pointerup",scheduleSave,true);
window.addEventListener("pagehide",scheduleSave);
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="hidden") scheduleSave(); });

$("creditsBtn")?.addEventListener("click",()=>$("creditsDialog")?.showModal());
$("closeCreditsBtn")?.addEventListener("click",()=>$("creditsDialog")?.close());
$("creditsDialog")?.addEventListener("click",e=>{ if(e.target===$("creditsDialog")) $("creditsDialog").close(); });

(async()=>{
  renderMenus();
  applyBackground();
  setFormat("landscape");
  siteInfo();
  loadFeatured();

  const restored=await restoreEditorState();
  if(restored){
    setStatus("Restored previous PostCard session.");
    return;
  }

  const s=await chrome.storage.local.get(["postcardSelectedText","postcardSelectedAt"]);
  if(s.postcardSelectedText&&Date.now()-(s.postcardSelectedAt||0)<600000){
    addText(s.postcardSelectedText);
    await chrome.storage.local.remove(["postcardSelectedText","postcardSelectedAt"]);
  }else{
    addText("What's on your mind?");
  }
  slides=[serializeSlide()];
  activeSlide=0;
  renderSlideList();
  scheduleSave();
})();


document.addEventListener("copy",e=>{
  if(isEditingField())return;
  const payload=clipboardPayload();if(!payload)return;
  e.preventDefault();writeObjectClipboard(e,payload);
  setStatus(`${payload.type==="text"?"Text":payload.type==="image"?"Image":"Table"} copied.`);
},true);

document.addEventListener("cut",e=>{
  if(isEditingField())return;
  const payload=clipboardPayload();if(!payload)return;
  e.preventDefault();writeObjectClipboard(e,payload);deleteSelected();
  setStatus(`${payload.type==="text"?"Text":payload.type==="image"?"Image":"Table"} cut.`);
},true);

document.addEventListener("paste",async e=>{
  const data=e.clipboardData;if(!data)return;
  // Keep native paste in form fields; image paste on the card creates an object,
  // including when the caret is currently inside a text block or table cell.
  const active=document.activeElement;
  if(active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))return;
  const imageItems=[...data.items].filter(item=>item.kind==="file"&&item.type.startsWith("image/"));
  const encoded=data.getData("application/x-postcard-object");
  if(encoded && !isEditingField()){
    try{if(pasteSelectedObject(JSON.parse(encoded))){e.preventDefault();return;}}catch(_){}
  }
  if(imageItems.length){
    e.preventDefault();
    try{for(const item of imageItems){const file=item.getAsFile();if(file)await addImageFile(file);}}
    catch(error){setStatus("Could not paste image. Try copying the image again.",false);}
    return;
  }
  if(isEditingField())return;
  const text=data.getData("text/plain");
  if(text && objectClipboard && text===clipboardPlainText(objectClipboard)){
    e.preventDefault();pasteSelectedObject(objectClipboard);return;
  }
  if(text){e.preventDefault();addText(text);commitHistory();scheduleSave();setStatus("Text pasted.");}
},true);

document.addEventListener("selectionchange",()=>{
  const el=document.activeElement;
  if(el?.classList?.contains("textBlock"))saveCaret(el);
});

document.addEventListener("keydown",async e=>{
  const mod=e.metaKey||e.ctrlKey;
  if(!mod) return;
  const key=e.key.toLowerCase();

  // While directly editing text/cells/caption, preserve native copy/paste.
  // Undo/redo remain editor-level so design changes can always be reversed.
  if(key==="z"){
    e.preventDefault();
    if(e.shiftKey) await redo(); else await undo();
    return;
  }
  if(key==="y" && e.ctrlKey){
    e.preventDefault(); await redo(); return;
  }
  if(key==="s"){
    e.preventDefault();
    await $("downloadBtn")?.click();
    return;
  }
},true);


document.addEventListener("input",e=>{
  if(e.target.closest("#stage,.rightPanel,.popover,.statusbar")) commitHistory();
},true);
document.addEventListener("change",e=>{
  if(e.target.closest("#stage,.rightPanel,.popover,.statusbar")) commitHistory();
},true);
document.addEventListener("click",e=>{
  if(e.target.closest(".leftRail,.rightPanel,.popover,.canvasToolbar,.topActions") &&
     !e.target.closest("#undoBtn,#redoBtn,#creditsBtn,#closeCreditsBtn")){
    commitHistory();
  }
},true);
window.addEventListener("pointerup",()=>commitHistory(),true);

window.addEventListener("load",async()=>{
  const rememberedFont=await loadLastFontPreference();
  if(rememberedFont){
    defaultFont=rememberedFont;
    if($("fontFamily")) $("fontFamily").value=rememberedFont;
    if($("tableFontFamily")) $("tableFontFamily").value=rememberedFont;
  }
  setTimeout(()=>{ if(!undoStack.length) initHistory(); else updateHistoryButtons(); },350);
});


/* Webcam recorder --------------------------------------------------------- */
let webcamStream=null;
let webcamRecorder=null;
let webcamChunks=[];
let webcamRecordedBlob=null;
let webcamRecordedUrl=null;
let webcamAnimationFrame=null;
let webcamRecordStartedAt=0;
let webcamTimer=null;
let webcamVideoEl=null;

function webcamSetStatus(message,ok=true){
  const el=$("webcamStatus");
  if(!el)return;
  el.textContent=message||"";
  el.style.color=ok?"#8dd6a8":"#ff8f98";
}

async function refreshWebcamDevices(){
  try{
    const devices=await navigator.mediaDevices.enumerateDevices();
    const cams=devices.filter(d=>d.kind==="videoinput");
    const mics=devices.filter(d=>d.kind==="audioinput");
    const camSel=$("webcamCameraSelect"),micSel=$("webcamMicSelect");
    const oldCam=camSel?.value||"",oldMic=micSel?.value||"";
    if(camSel){
      camSel.innerHTML='<option value="">Default camera</option>'+
        cams.map((d,i)=>`<option value="${d.deviceId}">${d.label||`Camera ${i+1}`}</option>`).join("");
      if([...camSel.options].some(o=>o.value===oldCam))camSel.value=oldCam;
    }
    if(micSel){
      micSel.innerHTML='<option value="">Default microphone</option>'+
        mics.map((d,i)=>`<option value="${d.deviceId}">${d.label||`Microphone ${i+1}`}</option>`).join("");
      if([...micSel.options].some(o=>o.value===oldMic))micSel.value=oldMic;
      $("webcamAudio").disabled=mics.length===0;
      if(mics.length===0)$("webcamAudio").checked=false;
    }
    return {cams,mics};
  }catch(_){return {cams:[],mics:[]};}
}
function cameraConstraint(){
  const id=$("webcamCameraSelect")?.value;
  return id?{deviceId:{exact:id},width:{ideal:1280},height:{ideal:720}}:
    {width:{ideal:1280},height:{ideal:720}};
}
function micConstraint(){
  const id=$("webcamMicSelect")?.value;
  return id?{deviceId:{exact:id}}:true;
}

function ensureWebcamVideo(){
  if(webcamVideoEl)return webcamVideoEl;
  webcamVideoEl=document.createElement("video");
  webcamVideoEl.autoplay=true;
  webcamVideoEl.muted=true;
  webcamVideoEl.playsInline=true;
  return webcamVideoEl;
}
function wrapWebcamText(ctx,text,maxWidth){
  const result=[];
  for(const para of String(text||"").split("\n")){
    if(!para){result.push("");continue;}
    let line="";
    for(const word of para.split(/\s+/)){
      const test=line?`${line} ${word}`:word;
      if(line&&ctx.measureText(test).width>maxWidth){result.push(line);line=word;}
      else line=test;
    }
    result.push(line);
  }
  return result;
}
function renderWebcamFrame(){
  const canvas=$("webcamCanvas");
  if(!canvas)return;
  const ctx=canvas.getContext("2d");
  const video=ensureWebcamVideo();
  ctx.clearRect(0,0,canvas.width,canvas.height);

  if(video.readyState>=2 && video.videoWidth){
    // Cover the 16:9 canvas.
    const ir=video.videoWidth/video.videoHeight,cr=canvas.width/canvas.height;
    let sw=video.videoWidth,sh=video.videoHeight,sx=0,sy=0;
    if(ir>cr){sw=video.videoHeight*cr;sx=(video.videoWidth-sw)/2;}
    else{sh=video.videoWidth/cr;sy=(video.videoHeight-sh)/2;}
    ctx.drawImage(video,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
  }else{
    ctx.fillStyle="#050506";ctx.fillRect(0,0,canvas.width,canvas.height);
  }

  const text=$("webcamOverlayText")?.value?.trim();
  if(text){
    const size=Number($("webcamFontSize")?.value||52);
    ctx.font=`700 ${size}px ${defaultFont||"Arial, sans-serif"}`;
    ctx.textAlign="center";ctx.textBaseline="middle";
    const lines=wrapWebcamText(ctx,text,canvas.width*.86);
    const lh=size*1.2;
    const pos=$("webcamTextPosition")?.value||"bottom";
    let centerY=canvas.height*.82;
    if(pos==="center")centerY=canvas.height*.5;
    if(pos==="top")centerY=canvas.height*.18;
    const y0=centerY-((lines.length-1)*lh)/2;

    ctx.shadowColor="rgba(0,0,0,.82)";
    ctx.shadowBlur=10;ctx.shadowOffsetY=4;
    ctx.lineJoin="round";ctx.lineWidth=Math.max(4,size*.10);
    ctx.strokeStyle="rgba(0,0,0,.60)";
    ctx.fillStyle=$("webcamTextColor")?.value||"#ffffff";
    lines.forEach((line,i)=>{
      ctx.strokeText(line,canvas.width/2,y0+i*lh,canvas.width*.9);
      ctx.fillText(line,canvas.width/2,y0+i*lh,canvas.width*.9);
    });
    ctx.shadowColor="transparent";
  }
  webcamAnimationFrame=requestAnimationFrame(renderWebcamFrame);
}
async function startWebcam(){
  try{
    stopWebcamStream();
    webcamSetStatus("Requesting camera permission…");

    // Request video independently so a missing microphone never prevents
    // the webcam from opening.
    const videoStream=await navigator.mediaDevices.getUserMedia({
      video:cameraConstraint(),
      audio:false
    });

    let audioTracks=[];
    if($("webcamAudio").checked){
      try{
        const audioStream=await navigator.mediaDevices.getUserMedia({
          video:false,
          audio:micConstraint()
        });
        audioTracks=audioStream.getAudioTracks();
      }catch(audioErr){
        $("webcamAudio").checked=false;
        webcamSetStatus("Camera ready. Microphone was not available, so recording will be video-only.");
      }
    }

    webcamStream=new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioTracks
    ]);

    const video=ensureWebcamVideo();
    video.srcObject=webcamStream;
    await video.play();

    await refreshWebcamDevices();
    $("cameraHint").hidden=true;
    $("startCameraBtn").textContent="Restart camera";
    $("startRecordingBtn").disabled=false;
    cancelAnimationFrame(webcamAnimationFrame);
    renderWebcamFrame();

    if(!audioTracks.length && $("webcamStatus").textContent.includes("Microphone")) return;
    webcamSetStatus(audioTracks.length?"Camera and microphone ready.":"Camera ready.");
  }catch(err){
    const name=err?.name||"";
    if(name==="NotAllowedError"||name==="PermissionDeniedError"){
      webcamSetStatus("Camera permission was denied. Allow camera access for PostCard in Chrome and try again.",false);
    }else if(name==="NotFoundError"||name==="DevicesNotFoundError"){
      webcamSetStatus("Chrome could not find an available camera. Try choosing another camera from the Camera menu.",false);
      await refreshWebcamDevices();
    }else if(name==="NotReadableError"||name==="TrackStartError"){
      webcamSetStatus("The camera is busy in another app or tab. Close the other camera user and try again.",false);
    }else{
      webcamSetStatus(`Camera unavailable: ${err?.message||name||"unknown error"}`,false);
    }
  }
}
function stopWebcamStream(){
  if(webcamStream){
    webcamStream.getTracks().forEach(t=>t.stop());
    webcamStream=null;
  }
  if(webcamVideoEl)webcamVideoEl.srcObject=null;
}
function bestRecorderMime(){
  const choices=[
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=avc1",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];
  return choices.find(x=>MediaRecorder.isTypeSupported(x))||"";
}
async function startWebcamRecording(){
  if(!webcamStream){await startWebcam();if(!webcamStream)return;}
  webcamRecordedBlob=null;
  if(webcamRecordedUrl){URL.revokeObjectURL(webcamRecordedUrl);webcamRecordedUrl=null;}
  $("recordedActions").hidden=true;
  webcamChunks=[];

  const canvas=$("webcamCanvas");
  const composite=canvas.captureStream(30);
  const audio=webcamStream.getAudioTracks()[0];
  if(audio)composite.addTrack(audio);

  const mime=bestRecorderMime();
  webcamRecorder=new MediaRecorder(composite,mime?{mimeType:mime,videoBitsPerSecond:2500000}:undefined);
  webcamRecorder.ondataavailable=e=>{if(e.data?.size)webcamChunks.push(e.data);};
  webcamRecorder.onstop=()=>{
    webcamRecordedBlob=new Blob(webcamChunks,{type:webcamRecorder.mimeType||"video/webm"});
    webcamRecordedUrl=URL.createObjectURL(webcamRecordedBlob);
    $("recordedActions").hidden=false;
    $("retakeVideoBtn").disabled=false;
    webcamSetStatus(`Video ready — ${(webcamRecordedBlob.size/1024/1024).toFixed(1)} MB.`);
  };
  webcamRecorder.start(500);
  webcamRecordStartedAt=Date.now();
  $("recordingBadge").hidden=false;
  $("startRecordingBtn").disabled=true;
  $("stopRecordingBtn").disabled=false;
  $("retakeVideoBtn").disabled=true;
  webcamTimer=setInterval(()=>{
    const seconds=Math.floor((Date.now()-webcamRecordStartedAt)/1000);
    $("recordingTime").textContent=`${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
    if(seconds>=60)stopWebcamRecording();
  },250);
  webcamSetStatus("Recording…");
}
function stopWebcamRecording(){
  clearInterval(webcamTimer);webcamTimer=null;
  if(webcamRecorder&&webcamRecorder.state!=="inactive")webcamRecorder.stop();
  $("recordingBadge").hidden=true;
  $("stopRecordingBtn").disabled=true;
  $("startRecordingBtn").disabled=false;
}
function resetRecordedVideo(){
  if(webcamRecorder&&webcamRecorder.state!=="inactive")stopWebcamRecording();
  webcamRecordedBlob=null;
  webcamChunks=[];
  if(webcamRecordedUrl){URL.revokeObjectURL(webcamRecordedUrl);webcamRecordedUrl=null;}
  $("recordedActions").hidden=true;
  $("retakeVideoBtn").disabled=true;
  webcamSetStatus("Ready to record again.");
}
function blobToDataUrl(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=reject;
    reader.readAsDataURL(blob);
  });
}
async function downloadRecordedVideo(){
  if(!webcamRecordedBlob)return;
  const mime=webcamRecordedBlob.type||"video/webm";
  const ext=mime.includes("mp4")?"mp4":"webm";
  const a=document.createElement("a");
  a.href=webcamRecordedUrl||URL.createObjectURL(webcamRecordedBlob);
  a.download=`postcard-webcam-${Date.now()}.${ext}`;
  a.click();
}
async function insertRecordedVideo(){
  if(!webcamRecordedBlob){webcamSetStatus("Record a video first.",false);return;}
  const social=await findSocialTab();
  if(!social){webcamSetStatus("Open X, Facebook, Instagram, or LinkedIn in the originating browser window.",false);return;}
  try{
    await ensurePostCardContentScript(social.id);
    webcamSetStatus("Preparing video for upload…");
    const dataUrl=await blobToDataUrl(webcamRecordedBlob);
    const mime=webcamRecordedBlob.type||"video/webm";
    const ext=mime.includes("mp4")?"mp4":"webm";
    const res=await chrome.tabs.sendMessage(social.id,{
      type:"POSTCARD_INSERT_VIDEO",
      videoDataUrl:dataUrl,
      filename:`postcard-video.${ext}`,
      postText:$("postText")?.value||""
    });
    if(res?.ok){
      webcamSetStatus("Video inserted into post.");
      await chrome.tabs.update(social.id,{active:true});
      await chrome.windows.update(social.windowId,{focused:true}).catch(()=>{});
    }else webcamSetStatus(res?.error||"Could not insert video.",false);
  }catch(err){
    webcamSetStatus(`Could not insert video: ${err.message}`,false);
  }
}

$("webcamBtn")?.addEventListener("click",async()=>{
  try{
    const params=new URLSearchParams();
    if(sourceTabId!=null)params.set("sourceTabId",String(sourceTabId));
    if(sourceWindowId!=null)params.set("sourceWindowId",String(sourceWindowId));
    const recorderBase=chrome.runtime.getURL("recorder.html");
    const recorderUrl=recorderBase+"?"+params.toString();

    const existing=(await chrome.tabs.query({url:recorderBase+"*"}))[0];
    let tab;
    if(existing){
      tab=await chrome.tabs.update(existing.id,{url:recorderUrl,active:true});
    }else{
      tab=await chrome.tabs.create({
        windowId:sourceWindowId||undefined,
        url:recorderUrl,
        active:true
      });
    }
    if(tab?.windowId!=null){
      await chrome.windows.update(tab.windowId,{focused:true}).catch(()=>{});
    }
    setTimeout(()=>window.close(),80);
  }catch(e){
    setStatus(`Could not open video recorder: ${e?.message||"unknown error"}`,false);
  }
});
$("webcamCloseBtn")?.addEventListener("click",()=>{
  if(webcamRecorder&&webcamRecorder.state!=="inactive")stopWebcamRecording();
  stopWebcamStream();
  cancelAnimationFrame(webcamAnimationFrame);
  $("webcamDialog").close();
});
$("webcamDialog")?.addEventListener("cancel",()=>{
  if(webcamRecorder&&webcamRecorder.state!=="inactive")stopWebcamRecording();
  stopWebcamStream();
  cancelAnimationFrame(webcamAnimationFrame);
});
$("startCameraBtn")?.addEventListener("click",startWebcam);
$("startRecordingBtn")?.addEventListener("click",startWebcamRecording);
$("stopRecordingBtn")?.addEventListener("click",stopWebcamRecording);
$("retakeVideoBtn")?.addEventListener("click",resetRecordedVideo);
$("downloadRecordedVideoBtn")?.addEventListener("click",downloadRecordedVideo);
$("insertRecordedVideoBtn")?.addEventListener("click",insertRecordedVideo);



$("webcamCameraSelect")?.addEventListener("change",()=>{if(webcamStream)startWebcam();});
$("webcamMicSelect")?.addEventListener("change",()=>{if(webcamStream&&$("webcamAudio").checked)startWebcam();});
$("webcamAudio")?.addEventListener("change",()=>{if(webcamStream)startWebcam();});

async function saveNowBeforeNavigation(){
  try{
    document.activeElement?.blur?.();
    scheduleSave();
    await new Promise(r=>setTimeout(r,250));
  }catch(e){
    console.error("Immediate save before navigation failed:",e);
  }
}

$("slidesBtn")?.addEventListener("click",async()=>{
  await saveNowBeforeNavigation();
  try{ await chrome.storage.local.remove(RETURN_TO_SLIDES_KEY); }catch(_){}
  location.href="slides.html";
});
$("backToSlidesBtn")?.addEventListener("click",async()=>{
  await saveNowBeforeNavigation();
  try{ await chrome.storage.local.remove(RETURN_TO_SLIDES_KEY); }catch(_){}
  location.href="slides.html";
});

$("webcamBtn")?.addEventListener("click",()=>{setTimeout(refreshWebcamDevices,0);});

document.addEventListener("DOMContentLoaded",async()=>{
  try{
    const marker=await chrome.storage.local.get(RETURN_TO_SLIDES_KEY);
    if(marker?.[RETURN_TO_SLIDES_KEY]) $("backToSlidesBtn")?.removeAttribute("hidden");
  }catch(_){}
});
