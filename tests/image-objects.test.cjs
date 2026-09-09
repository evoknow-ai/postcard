const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const editor=fs.readFileSync(path.join(root,'editor.js'),'utf8');
function editorFunction(name){
  const start=editor.search(new RegExp(`^(?:async )?function ${name}\\(`,'m'));
  assert(start>=0,name);
  const tail=editor.slice(start),first=tail.split('\n')[0];
  return first.endsWith('}')?first:tail.slice(0,tail.indexOf('\n}')+2);
}
function setup(){
  const elements=new Map();
  const element=id=>{if(!elements.has(id))elements.set(id,{value:3,style:{},checked:false});return elements.get(id)};
  const c=vm.createContext({console,crypto:require('node:crypto').webcrypto,document:{getElementById:()=>null,addEventListener(){},activeElement:null},
    $:element,formats:{landscape:[1200,675]},setFormat(){},applyBackground(){},renderBlocks(){},renderTables(){},renderSlideList(){},syncToolbar(){},scheduleSave(){},commitHistory(){},setStatus(){},updateHistoryButtons(){},
    Image:class{set src(value){this.naturalWidth=200;this.naturalHeight=100;queueMicrotask(()=>this.onload())}},
    bg:{type:'solid',color:'#ED213A'},blocks:[],tables:[],slides:[],activeSlide:0,selectedId:null,selectedTableId:null,nextId:1,nextTableId:1,currentFormat:'landscape',historySuspended:false});
  vm.runInContext(fs.readFileSync(path.join(root,'object-layers.js'),'utf8'),c);
  vm.runInContext(fs.readFileSync(path.join(root,'image-objects.js'),'utf8'),c);
  for(const name of ['cloneForHistory','serializableBg','currentEditorState','historyState','restoreHistoryState','serializeSlide','restoreSlide','clipboardPayload','clipboardPlainText','pasteSelectedObject','deleteSelected'])vm.runInContext(editorFunction(name),c);
  return {c,run:code=>vm.runInContext(code,c)};
}
const sample={id:'one',src:'data:image/png;base64,AAAA',ratio:2,width:40,x:50,y:50};
test('all corner resize directions preserve ratio and opposite anchor across formats',()=>{
 const {run}=setup();
 for(const [w,h] of [[1200,675],[1080,1080],[1080,1350]])for(const corner of ['nw','ne','sw','se']){
   const sx=corner.includes('e')?1:-1,sy=corner.includes('s')?1:-1;
   const out=run(`resizedImage(${JSON.stringify({...sample,corner})},${sx*60},${sy*30},${w},${h})`);
   assert(out.width>sample.width);
   assert(Math.abs((out.x-sx*out.width/2)-(sample.x-sx*sample.width/2))<1e-9);
   assert(Math.abs((out.y-sy*out.width*w/sample.ratio/h/2)-(sample.y-sy*sample.width*w/sample.ratio/h/2))<1e-9);
 }
});
test('copy, duplicate, delete, saved state, history, slide restore and legacy slides',async()=>{
 const {run}=setup();run(`images=[${JSON.stringify(sample)}];selectedImageId='one'`);
 assert.equal(run('clipboardPayload().type'),'image');
 assert.equal(run('pasteSelectedObject(clipboardPayload())'),true);
 assert.equal(run('images.length'),2);assert.notEqual(run('images[0].id'),run('images[1].id'));
 assert.equal(run('deleteSelected()'),true);assert.equal(run('images.length'),1);
 assert.equal(run('currentEditorState().images[0].width'),40);
 run('snapshot=historyState();slide=serializeSlide();images[0].width=85');
 await run('restoreHistoryState(snapshot)');assert.equal(run('images[0].width'),40);
 run('images=[]');await run('restoreSlide(slide)');assert.equal(run('images[0].width'),40);
 await run('restoreSlide({bg:{type:"solid"},blocks:[]})');assert.equal(run('images.length'),0);
 assert.equal(run('pasteImageObject({src:"javascript:alert(1)",width:40,ratio:2})'),false);
});
test('card and slide renderer draw image at exact resized coordinates',async()=>{
 const {c,run}=setup(),calls=[];c.ctx={drawImage:(...args)=>calls.push(args.slice(1))};
 run(`images=[${JSON.stringify(sample)}]`);await run('drawImageObjects(ctx,images,1200,675)');
 assert.deepEqual(calls[0],[360,217.5,480,240]);


});

test('layer changes cross object types and survive history and slide restore',async()=>{
 const {run}=setup();
 run(`images=[${JSON.stringify(sample)}];blocks=[{id:1,text:'Text'}];tables=[{id:1}];scene={images,blocks,tables}`);
 const order=()=>run('orderedObjects(scene).map(e=>e.type).join(",")');
 assert.equal(order(),'image,text,table');
 assert(run('reorderObject(scene,"image","one","front")'));assert.equal(order(),'text,table,image');
 assert(run('reorderObject(scene,"image","one","backward")'));assert.equal(order(),'text,image,table');
 assert(run('reorderObject(scene,"table",1,"back")'));assert.equal(order(),'table,text,image');
 assert(run('reorderObject(scene,"text",1,"forward")'));assert.equal(order(),'table,image,text');
 assert.equal(run('reorderObject(scene,"text",1,"front")'),false);
 run('snapshot=historyState();slide=serializeSlide();reorderObject(scene,"image","one","front")');
 await run('restoreHistoryState(snapshot)');run('scene={images,blocks,tables}');assert.equal(order(),'table,image,text');
 await run('restoreSlide(slide)');run('scene={images,blocks,tables}');assert.equal(order(),'table,image,text');
});
test('editor and slideshow exports follow object ordering in both directions',async()=>{
 for(const renderer of ['editor','slides']){
  const {c,run}=setup(),calls=[];
  const ctx={save(){},restore(){},clearRect(){},fillRect(){},drawImage(){calls.push('image')},fillText(){calls.push('text')},measureText:s=>({width:s.length*10})};
  const canvas={width:0,height:0,getContext:()=>ctx};c.canvas=canvas;
  const oldDollar=c.$;c.$=id=>id==='exportCanvas'?canvas:oldDollar(id);
  c.wrap=(ctx,text)=>[text];
  run(`images=[${JSON.stringify(sample)}];blocks=[{id:1,text:'Text',x:50,y:50,width:70,size:56,lineHeight:1.2}];scene={images,blocks,tables,bg:{type:'solid'},format:'landscape'}`);
  if(renderer==='editor')vm.runInContext(editorFunction('exportCanvas'),c);
  else{
   c.fmt=()=>[1200,675];
   const source=fs.readFileSync(path.join(root,'slides.js'),'utf8');
   vm.runInContext(source.slice(source.indexOf('async function drawSlide('),source.indexOf('async function renderMain(')),c);
  }
  const draw=()=>run(renderer==='editor'?'exportCanvas()':'drawSlide(canvas,scene)');
  await draw();assert.deepEqual(calls,['image','text']);calls.length=0;
  run('reorderObject(scene,"image","one","front")');await draw();assert.deepEqual(calls,['text','image']);
 }
});
test('text pointer drag works when selected or focused; double click alone enables editing',()=>{
 const {c,run}=setup(),events={},windowEvents={};
 const el={dataset:{id:'1'},isContentEditable:false,style:{},innerText:'Text',
  classList:{add(){},remove(){}},addEventListener:(type,fn)=>events[type]=fn,
  getBoundingClientRect:()=>({left:100,top:100,right:300,bottom:150,width:200,height:50}),
  setPointerCapture(){},releasePointerCapture(){},focus(){c.document.activeElement=el},blur(){c.document.activeElement=null;events.blur()},
  set contentEditable(value){this.isContentEditable=value==='true'}};
 c.el=el;c.document.activeElement=el;
 c.selectBlock=id=>{c.selectedId=id};c.saveCaret=()=>{};c.placeCaretFromPoint=()=>{};c.block=()=>c.blocks[0];
 c.window={addEventListener:(type,fn)=>windowEvents[type]=fn,getSelection:()=>({removeAllRanges(){}})};
 const dollar=c.$;c.$=id=>id==='stage'?{getBoundingClientRect:()=>({width:1000,height:500})}:dollar(id);
 run('blocks=[{id:1,x:50,y:50}];selectedId=1;drag=null');
 vm.runInContext(editorFunction('wireTextBlock'),c);run('wireTextBlock(el)');
 const start=editor.indexOf('window.addEventListener("pointermove",e=>{');
 vm.runInContext(editor.slice(start,editor.indexOf('window.addEventListener("pointerup",e=>{',start)),c);
 const event={button:0,clientX:150,clientY:120,pointerId:1,preventDefault(){},stopPropagation(){}};
 events.pointerdown(event);windowEvents.pointermove({...event,clientX:250,clientY:170});
 assert.equal(c.blocks[0].x,60);assert.equal(c.blocks[0].y,60);assert.equal(el.isContentEditable,false);
 events.dblclick(event);assert.equal(el.isContentEditable,true);assert.equal(c.drag,null);
 events.pointerdown(event);assert.equal(c.drag,null); // Native text selection remains available.
 el.blur();assert.equal(el.isContentEditable,false);
 events.pointerdown(event);assert.equal(c.drag.type,'text');
});

test('new objects stay above legacy objects when collection indices shift',()=>{
 const {run}=setup();run('images=[{id:"legacy"}];blocks=[{id:1}];scene={images,blocks,tables}');
 run('z=nextObjectZ(scene);images.push({id:"new",z})');
 assert.equal(run('orderedObjects(scene).map(e=>String(e.object.id)).join(",")'),'legacy,1,new');
});
test('image body drags independently of text editing and commits on pointer release',()=>{
 const {c,run}=setup(),events={};let saved=0;
 c.scheduleSave=()=>saved++;
 const el={dataset:{id:'one'},addEventListener:(type,fn)=>events[type]=fn,setPointerCapture(){},hasPointerCapture:()=>true,releasePointerCapture(){}};
 run(`images=[${JSON.stringify(sample)}]`);
 c.el=el;run('wireImageObject(el)');
 c.document.getElementById=id=>id==='stage'?{getBoundingClientRect:()=>({width:1000,height:500})}:null;
 const e={button:0,clientX:100,clientY:100,pointerId:1,target:{dataset:{}},preventDefault(){},stopPropagation(){}};
 events.pointerdown(e);events.pointermove({...e,clientX:200,clientY:150});events.pointerup(e);
 assert.equal(run('images[0].x'),60);assert.equal(run('images[0].y'),60);assert.equal(saved,1);
});
