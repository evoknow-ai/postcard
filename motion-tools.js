function clamp01(v){return Math.max(0,Math.min(1,v))}
function easeOutCubic(t){return 1-Math.pow(1-clamp01(t),3)}
function blockMotion(b,timeSec){
  const type=b.animation||"none";
  if(type==="none")return {alpha:1,dx:0,dy:0,scale:1};
  const delay=Number(b.animDelay||0),dur=Math.max(.05,Number(b.animDuration||.7)),raw=(timeSec-delay)/dur;
  if(raw<=0)return {alpha:0,dx:0,dy:0,scale:1};
  const t=easeOutCubic(raw);
  if(type==="fade")return {alpha:t,dx:0,dy:0,scale:1};
  if(type==="slide-up")return {alpha:t,dx:0,dy:(1-t)*70,scale:1};
  if(type==="slide-left")return {alpha:t,dx:(1-t)*-110,dy:0,scale:1};
  if(type==="slide-right")return {alpha:t,dx:(1-t)*110,dy:0,scale:1};
  if(type==="zoom")return {alpha:t,dx:0,dy:0,scale:.72+.28*t};
  if(type==="pop")return {alpha:clamp01(raw*2),dx:0,dy:0,scale:raw<1?1+.12*Math.sin(Math.min(1,raw)*Math.PI):1};
  return {alpha:1,dx:0,dy:0,scale:1};
}
function backgroundMotion(bg,timeSec,duration){
  const type=bg.motion||"none",strength=Math.max(0,Number(bg.motionStrength||8))/100,p=clamp01(timeSec/Math.max(.1,duration||3));
  if(type==="none")return {zoom:1,px:0,py:0};
  if(type==="zoom-in")return {zoom:1+strength*p,px:0,py:0};
  if(type==="zoom-out")return {zoom:1+strength*(1-p),px:0,py:0};
  const zoom=1+strength;
  if(type==="pan-left")return {zoom,px:strength*(.5-p),py:0};
  if(type==="pan-right")return {zoom,px:strength*(p-.5),py:0};
  if(type==="pan-up")return {zoom,px:0,py:strength*(.5-p)};
  if(type==="pan-down")return {zoom,px:0,py:strength*(p-.5)};
  return {zoom:1,px:0,py:0};
}

function textAngle(block){
  const value=Number(block.rotation??block.angle??0);
  return Number.isFinite(value)?((value%360)+360)%360:0;
}
function snapTextAngle(value,snap=true){
  const normalized=((value%360)+360)%360,nearest=Math.round(normalized/45)*45;
  return Math.round(snap && Math.abs(normalized-nearest)<=6?nearest:normalized)%360;
}
function pointInRotatedText(x,y,cx,cy,degrees){
  const angle=degrees*Math.PI/180,dx=x-cx,dy=y-cy;
  return {x:dx*Math.cos(angle)+dy*Math.sin(angle),y:-dx*Math.sin(angle)+dy*Math.cos(angle)};
}
function mp4RecorderType(){
  for(const type of ["video/mp4;codecs=avc1.42E01E,mp4a.40.2","video/mp4;codecs=avc1","video/mp4"]){
    if(MediaRecorder.isTypeSupported(type))return type;
  }
  throw new Error("This Chrome build cannot encode MP4. Please update Chrome and try again.");
}
function isGifSource(src){return /^data:image\/gif[;,]/i.test(src||"") || /\.gif(?:[?#]|$)/i.test(src||"");}
async function decodeGifAnimation(url){
  if(!("ImageDecoder" in window))throw new Error("Animated GIF export requires Chrome ImageDecoder support.");
  const response=await fetch(url);
  if(!response.ok)throw new Error(`GIF download failed (${response.status}).`);
  const decoder=new ImageDecoder({data:await response.arrayBuffer(),type:"image/gif"});
  const frames=[],durations=[];
  try{
    await decoder.tracks.ready;
    const count=decoder.tracks.selectedTrack?.frameCount||1;
    for(let index=0;index<count;index++){
      const {image}=await decoder.decode({frameIndex:index});
      try{frames.push(await createImageBitmap(image));durations.push(Math.max(20,(image.duration||100000)/1000));}
      finally{image.close();}
    }
    return {frames,durations,total:durations.reduce((a,b)=>a+b,0)};
  }catch(error){frames.forEach(frame=>frame.close());throw error;}
  finally{decoder.close();}
}
async function prepareSceneAnimations(scene){
  const prepared={background:null,images:new Map(),animated:false};
  try{
    const background=scene.bg;
    if(background?.type==="image" && (background.isGif||isGifSource(background.image)))prepared.background=await decodeGifAnimation(background.gifUrl||background.image);
    for(const image of scene.images||[]){
      if(isGifSource(image.src) && !prepared.images.has(image.src))prepared.images.set(image.src,await decodeGifAnimation(image.src));
      else await getImageObject(image.src);
    }
    prepared.animated=!!prepared.background||prepared.images.size>0;
    return prepared;
  }catch(error){closeSceneAnimations(prepared);throw error;}
}
function sceneFrameOptions(prepared,timeSec){
  return {timeSec,gifFrame:gifFrameAt(prepared.background,timeSec*1000),
    imageFrames:new Map([...prepared.images].map(([src,animation])=>[src,gifFrameAt(animation,timeSec*1000)]))};
}
function closeSceneAnimations(prepared){
  closeGifAnim(prepared.background);prepared.images.forEach(closeGifAnim);
}
function extendTimelineForMusic(timeline,musicDuration){
  const total=timeline.reduce((sum,item)=>sum+item.duration,0);
  if(timeline.length && musicDuration>total)timeline[timeline.length-1].duration+=musicDuration-total;
  return Math.max(total,musicDuration);
}
