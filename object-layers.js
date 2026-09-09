// Shared ordering keeps the editor, thumbnails and exports in agreement.
function orderedObjects(scene){
  const entries=[...(scene.images||[]).map(object=>({type:"image",object})),
    ...(scene.blocks||[]).map(object=>({type:"text",object})),
    ...(scene.tables||[]).map(object=>({type:"table",object}))];
  return entries.map((entry,index)=>({...entry,order:Number.isFinite(entry.object.z)?entry.object.z:index}))
    .sort((a,b)=>a.order-b.order);
}
function nextObjectZ(scene){
  const entries=orderedObjects(scene);
  entries.forEach((entry,index)=>entry.object.z=index);
  return entries.length;
}
function reorderObject(scene,type,id,action){
  const entries=orderedObjects(scene),index=entries.findIndex(e=>e.type===type&&e.object.id===id);
  if(index<0)return false;
  const to=action==="front"?entries.length-1:action==="back"?0:action==="forward"?Math.min(entries.length-1,index+1):Math.max(0,index-1);
  if(to===index)return false;
  const [entry]=entries.splice(index,1);entries.splice(to,0,entry);
  entries.forEach((e,i)=>e.object.z=i);return true;
}
async function drawOrderedObjects(ctx,scene,w,h,drawText,drawTable,opts={}){
  for(const {type,object} of orderedObjects(scene)){
    ctx.save();
    try{
      if(type==="image")await drawImageObjects(ctx,[object],w,h,opts);
      else if(type==="text")drawText(object);
      else drawTable(object);
    }finally{ctx.restore();}
  }
}
function selectedObjectEntry(){
  if(selectedImageId!=null)return {type:"image",id:selectedImageId};
  if(selectedId!=null)return {type:"text",id:selectedId};
  if(selectedTableId!=null)return {type:"table",id:selectedTableId};
  return null;
}
function applyObjectLayers(){
  const list=document.getElementById("objectLayers");if(!list)return;
  const entries=orderedObjects({images,blocks,tables}),selection=selectedObjectEntry();
  const old=new Map([...list.children].map(el=>[el.dataset.key,el]));
  entries.forEach(({type,object},index)=>{
    const selector=type==="image"?".imageBlock":type==="text"?".textBlock":".tableBlock";
    // Match dataset values directly so IDs never become CSS selector syntax.
    const el=[...document.querySelectorAll(selector)].find(el=>el.dataset.id===String(object.id));
    if(el)el.style.zIndex=String(index+1);
  });
  for(const {type,object} of [...entries].reverse()){
    const key=`${type}:${object.id}`;let button=old.get(key);
    if(!button){
      button=document.createElement("button");button.type="button";button.dataset.key=key;
      button.addEventListener("click",()=>{
        document.activeElement?.blur?.();
        if(type==="image")selectImage(object.id);
        else if(type==="text")selectBlock(object.id);
        else selectTable(object.id);
      });
    }
    button.textContent=type==="text"?`Text: ${(object.text||"Empty text").replace(/\s+/g," ").slice(0,32)}`:type==="image"?`Image ${images.indexOf(object)+1}`:`Table ${tables.indexOf(object)+1}`;
    button.setAttribute("aria-pressed",String(selection?.type===type&&selection?.id===object.id));
    list.appendChild(button);old.delete(key);
  }
  old.forEach(el=>el.remove());
  const index=entries.findIndex(e=>e.type===selection?.type&&e.object.id===selection?.id);
  for(const id of ["bringFrontBtn","bringForwardBtn"])document.getElementById(id).disabled=index<0||index===entries.length-1;
  for(const id of ["sendBackBtn","sendBackwardBtn"])document.getElementById(id).disabled=index<=0;
  document.getElementById("moveObjectBtn").disabled=!selection;
  document.getElementById("editTextObjectBtn").disabled=selection?.type!=="text";
}
for(const [id,action] of [["bringFrontBtn","front"],["sendBackBtn","back"],["bringForwardBtn","forward"],["sendBackwardBtn","backward"]]){
  document.getElementById(id)?.addEventListener("click",()=>{
    const selection=selectedObjectEntry();if(!selection)return;
    if(reorderObject({images,blocks,tables},selection.type,selection.id,action)){
      renderBlocks();commitHistory();scheduleSave();
    }
  });
}
document.getElementById("moveObjectBtn")?.addEventListener("click",()=>{
  document.activeElement?.blur?.();
  document.querySelectorAll(".textBlock").forEach(el=>el.contentEditable="false");
  setStatus("Drag the selected object to move it.");syncToolbar();
});
document.getElementById("editTextObjectBtn")?.addEventListener("click",()=>{
  const el=[...document.querySelectorAll(".textBlock")].find(el=>el.dataset.id===String(selectedId));
  if(el){el.contentEditable="true";el.focus();setStatus("Edit text. Press Esc when ready to move it.");}
});

document.addEventListener("keydown",e=>{
  if(!document.getElementById("objectLayers") || isEditingField() || e.ctrlKey || e.metaKey || e.altKey)return;
  const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
  const entry=selectedObjectEntry();if(!direction||!entry)return;
  const object=orderedObjects({images,blocks,tables}).find(item=>item.type===entry.type&&item.object.id===entry.id)?.object;
  if(!object)return;
  e.preventDefault();const [w,h]=formats[currentFormat],step=e.shiftKey?10:1;
  object.x=Math.max(0,Math.min(100,object.x+direction[0]*step/w*100));
  object.y=Math.max(0,Math.min(100,object.y+direction[1]*step/h*100));
  renderBlocks();commitHistory();scheduleSave();
});
