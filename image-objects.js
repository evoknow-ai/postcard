// Image objects use card-relative centers and widths, with intrinsic proportions.
let images=[],selectedImageId=null;
const imageObjectCache=new Map();
function selectedImage(){return images.find(im=>im.id===selectedImageId);}
function imageObjectSource(src){
  return typeof src==="string" && /^data:image\//i.test(src);
}
async function getImageObject(src){
  if(!imageObjectSource(src))throw new Error("Invalid image source");
  if(!imageObjectCache.has(src)){
    const pending=new Promise((resolve,reject)=>{
      const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("Could not load image"));img.src=src;
    });
    imageObjectCache.set(src,pending);
    pending.catch(()=>imageObjectCache.delete(src));
  }
  return imageObjectCache.get(src);
}
async function drawImageObjects(ctx,objects,w,h){
  for(const im of objects){
    const img=await getImageObject(im.src);
    const width=w*im.width/100,height=width/im.ratio;
    ctx.drawImage(img,w*im.x/100-width/2,h*im.y/100-height/2,width,height);
  }
}
function selectImage(id){
  document.activeElement?.blur?.();
  selectedId=null;selectedTableId=null;selectedImageId=id;
  renderBlocks();
}
async function addImageFile(file){
  const src=await new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);
  });
  const img=await getImageObject(src),[w,h]=formats[currentFormat];
  const ratio=img.naturalWidth/img.naturalHeight;
  const width=Math.min(60,60*h*ratio/w);
  images.push({id:crypto.randomUUID(),src,ratio,width,x:50,y:50,z:nextObjectZ({images,blocks,tables})});
  selectImage(images[images.length-1].id);
  commitHistory();scheduleSave();setStatus("Image added. Drag a corner to resize.");
}
function pasteImageObject(data){
  if(!data || !imageObjectSource(data.src) || !Number.isFinite(data.ratio) || data.ratio<=0 ||
     !Number.isFinite(data.width) || data.width<=0)return false;
  const im={id:crypto.randomUUID(),z:nextObjectZ({images,blocks,tables}),src:data.src,ratio:data.ratio,width:Math.min(150,data.width),
    x:Math.min(95,(Number(data.x)||50)+4),y:Math.min(95,(Number(data.y)||50)+4)};
  images.push(im);selectImage(im.id);commitHistory();scheduleSave();setStatus("Image pasted.");return true;
}
function renderImages(){
  const layer=document.getElementById("imageLayer");if(!layer)return;
  const old=new Map([...layer.children].map(el=>[el.dataset.id,el]));
  for(const im of images){
    let el=old.get(im.id);
    if(!el){
      el=document.createElement("div");el.className="imageBlock";el.dataset.id=im.id;
      const img=document.createElement("img");img.src=im.src;img.alt="Card image";img.draggable=false;el.appendChild(img);
      for(const corner of ["nw","ne","sw","se"]){
        const handle=document.createElement("span");handle.className=`imageResizeHandle ${corner}`;handle.dataset.corner=corner;handle.title="Resize image";el.appendChild(handle);
      }
      wireImageObject(el);layer.appendChild(el);
    }
    Object.assign(el.style,{left:`${im.x}%`,top:`${im.y}%`,width:`${im.width}%`,aspectRatio:String(im.ratio)});
    el.classList.toggle("selected",im.id===selectedImageId);old.delete(im.id);
  }
  old.forEach(el=>el.remove());
}
function resizedImage(start,dx,dy,stageWidth,stageHeight){
  const sx=start.corner.includes("e")?1:-1,sy=start.corner.includes("s")?1:-1;
  const width=stageWidth*start.width/100,height=width/start.ratio;
  const scale=Math.max(0.02*stageWidth/width,Math.min(1.5*stageWidth/width,
    1+(sx*dx*width+sy*dy*height)/(width*width+height*height)));
  return {width:start.width*scale,x:start.x+sx*width*(scale-1)/2/stageWidth*100,
    y:start.y+sy*height*(scale-1)/2/stageHeight*100};
}
function wireImageObject(el){
  let gesture=null;
  el.addEventListener("pointerdown",e=>{
    if(e.button!==0)return;
    e.preventDefault();e.stopPropagation();selectImage(el.dataset.id);
    const im=selectedImage();if(!im)return;
    gesture={...im,corner:e.target.dataset.corner,clientX:e.clientX,clientY:e.clientY,pointerId:e.pointerId};
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener("pointermove",e=>{
    if(!gesture || gesture.pointerId!==e.pointerId)return;
    const im=images.find(im=>im.id===gesture.id);if(!im)return;
    const rect=document.getElementById("stage").getBoundingClientRect();
    const dx=e.clientX-gesture.clientX,dy=e.clientY-gesture.clientY;
    if(gesture.corner)Object.assign(im,resizedImage(gesture,dx,dy,rect.width,rect.height));
    else{im.x=Math.max(0,Math.min(100,gesture.x+dx/rect.width*100));im.y=Math.max(0,Math.min(100,gesture.y+dy/rect.height*100));}
    renderImages();syncToolbar();
  });
  const finish=e=>{
    if(!gesture || gesture.pointerId!==e.pointerId)return;
    gesture=null;if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);
    commitHistory();scheduleSave();
  };
  el.addEventListener("pointerup",finish);el.addEventListener("pointercancel",finish);el.addEventListener("lostpointercapture",finish);
}
// This file is also shared by the slideshow renderer, where controls are absent.
document.getElementById("objectImageUpload")?.addEventListener("change",async e=>{
  try{for(const file of e.target.files)await addImageFile(file);closeMenus();}
  catch(error){setStatus("Could not add image. Please choose another file.",false);}
  e.target.value="";
});
document.getElementById("imageWidth")?.addEventListener("input",e=>{
  const im=selectedImage();if(!im)return;im.width=Number(e.target.value);renderImages();syncToolbar();commitHistory();scheduleSave();
});
