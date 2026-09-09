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
  const c=vm.createContext({console,crypto:require('node:crypto').webcrypto,document:{getElementById:()=>null,activeElement:null},
    $:element,formats:{landscape:[1200,675]},setFormat(){},applyBackground(){},renderBlocks(){},renderTables(){},renderSlideList(){},syncToolbar(){},scheduleSave(){},commitHistory(){},setStatus(){},updateHistoryButtons(){},
    Image:class{set src(value){this.naturalWidth=200;this.naturalHeight=100;queueMicrotask(()=>this.onload())}},
    bg:{type:'solid',color:'#ED213A'},blocks:[],tables:[],slides:[],activeSlide:0,selectedId:null,selectedTableId:null,nextId:1,nextTableId:1,currentFormat:'landscape',historySuspended:false});
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
 assert.match(editor,/await drawImageObjects\(ctx,images,w,h\)/);
 assert.match(fs.readFileSync(path.join(root,'slides.js'),'utf8'),/await drawImageObjects\(ctx,sl.images\|\|\[\],w,h\)/);
});
