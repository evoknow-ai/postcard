const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=process.env.POSTCARD_TEST_ROOT||path.join(__dirname,'..');
// An API-level startup check. This intentionally does not substitute for browser layout or media tests.
function fixture(page,storage={},hooks={}){
 const registry=new Map(),events={},errors=[];
 const ctx=new Proxy({measureText:text=>({width:String(text).length*10}),createLinearGradient:()=>({addColorStop(){}})}, {get:(target,key)=>key in target?target[key]:()=>{}});
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.style={setProperty(){}};this.dataset={};this.children=[];this.value='';this.checked=false;this.classList={add(){},remove(){},toggle(){}};this.textContent='';this.innerText='';this.listeners={};}
  set id(id){this._id=id;registry.set(id,this)}get id(){return this._id}
  appendChild(el){this.children.push(el);if(el.tagName==='SCRIPT'&&el.src)queueMicrotask(()=>{try{vm.runInContext(fs.readFileSync(path.join(root,el.src),'utf8'),c,{filename:el.src});el.onload?.();}catch(e){errors.push(e.message)}});return el}append(...els){els.forEach(el=>this.appendChild(el))}insertBefore(el){return this.appendChild(el)}
  querySelectorAll(){return []}querySelector(){return new Element()}addEventListener(name,handler){this.listeners[name]=handler}
  setAttribute(name,value){this[name]=value}removeAttribute(name){delete this[name]}contains(){return false}remove(){}blur(){}focus(){}click(){}
  getContext(){return ctx}getBoundingClientRect(){return {left:0,top:0,width:960,height:540}}
 }
 const html=fs.readFileSync(path.join(root,page),'utf8');
 for(const tag of html.matchAll(/<([a-z0-9]+)\b[^>]*\bid="([^"]+)"[^>]*>/gi)){
  const el=new Element(tag[1]);el.id=tag[2];el.hidden=/\bhidden\b/.test(tag[0]);el.value=tag[0].match(/\bvalue="([^"]*)"/)?.[1]||'';
 }
 const document={getElementById:id=>registry.get(id)||null,querySelector:()=>new Element(),querySelectorAll:()=>[],createElement:tag=>new Element(tag),activeElement:null,addEventListener:(name,fn)=>{events[name]=fn},body:new Element('body'),fonts:{ready:Promise.resolve()},createRange:()=>({selectNodeContents(){},collapse(){}})};
 const c=vm.createContext({console:{log(){},warn(){},error:(...args)=>errors.push(args)},document,window:{addEventListener:(name,fn)=>events[name]=fn,getSelection:()=>({removeAllRanges(){},addRange(){}})},
  crypto:require('node:crypto').webcrypto,structuredClone,URL,URLSearchParams,Blob,Date,Math,Promise,Map,Set,performance,
  setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},requestAnimationFrame:()=>0,cancelAnimationFrame(){},
  location:{search:'',href:'',replace(url){this.href=url}},navigator:{mediaDevices:{enumerateDevices:async()=>[]}},
  chrome:{runtime:{getManifest:()=>JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')),getURL:x=>x,sendMessage:async()=>({})},storage:{local:{get:async()=>{await hooks.get?.();return structuredClone(storage)},set:async data=>{await hooks.set?.(data);Object.assign(storage,structuredClone(data))},remove:async keys=>{for(const k of [].concat(keys))delete storage[k]}}},tabs:{query:async()=>[]}},
  fetch:async()=>({ok:true,json:async()=>[],blob:async()=>new Blob()}),Image:class{},indexedDB:{open(){throw new Error('No audio fixture')}},
 });
 return {c,events,errors,registry,storage,
   run:code=>vm.runInContext(code,c),
   start:()=>{for(const match of html.matchAll(/<script src="([^"]+)"/g))vm.runInContext(fs.readFileSync(path.join(root,match[1]),'utf8'),c,{filename:match[1]})}};
}
for(const page of ['editor.html','slides.html'])test(`${page} starts with all restored controls and no missing symbols`,async()=>{
 const f=fixture(page);f.start();
 for(let i=0;i<5;i++)await new Promise(setImmediate);
 assert.deepEqual(f.errors,[]);
 if(page==='editor.html')assert.equal(vm.runInContext('blocks.length',f.c),1);
 else assert.equal(vm.runInContext('slides.length',f.c),1);
});

const STATE='postcardEditorStateV1',MARKER='postcardReturnToSlidesV1';
async function settle(){for(let i=0;i<8;i++)await new Promise(setImmediate)}
function savedDeck(){
 const first={id:'first',bg:{type:'solid',color:'#ED213A'},blocks:[{id:1,text:'First slide',size:56}],tables:[],format:'landscape',duration:7,audioId:'voice-first',voiceVolume:70};
 const second={id:'second',bg:{type:'solid',color:'#123456'},blocks:[],tables:[],images:[],format:'square',duration:120,audioId:'voice-second',voiceVolume:80};
 return {[STATE]:{version:1,bg:first.bg,blocks:first.blocks,tables:[],slides:[first,second],activeSlide:1,selectedId:1,currentFormat:'landscape',lastWriter:'slides',musicName:'Song.mp3',musicVolume:55,fitMusicDuration:true},[MARKER]:{slideId:'second'}};
}
test('new blank slide opens, accepts text, and returns without overwriting its neighbor or audio settings',async()=>{
 const storage=savedDeck(),original=structuredClone(storage[STATE].slides[0]);
 const f=fixture('editor.html',storage);f.start();await settle();
 assert.deepEqual(f.errors,[]);
 assert.equal(f.run('activeSlide'),1);assert.equal(f.run('blocks.length'),0);
 assert.equal(f.registry.get('backToSlidesBtn').hidden,undefined);
 assert.equal(f.run('selectedId'),null);
 assert.equal(f.registry.get('slideDuration').value,120);
 f.registry.get('addTextBtn').onclick();f.run('blocks[0].text="Second slide edited"');
 await f.registry.get('backToSlidesBtn').listeners.click();
 assert.equal(f.run('location.href'),'slides.html');
 assert.deepEqual(storage[STATE].slides[0],original);
 const slide=storage[STATE].slides[1];
 assert.equal(slide.blocks[0].text,'Second slide edited');assert.equal(slide.duration,120);
 assert.equal(slide.id,'second');assert.equal(slide.audioId,'voice-second');assert.equal(slide.voiceVolume,80);
 assert.equal(storage[STATE].musicName,'Song.mp3');assert.equal(storage[STATE].musicVolume,55);assert.equal(storage[STATE].fitMusicDuration,true);
 assert.equal(storage[MARKER],undefined);
 const reopened=fixture('editor.html',storage);reopened.start();await settle();
 assert.equal(reopened.run('blocks[0].text'),'Second slide edited');
 assert.equal(reopened.registry.get('slideDuration').value,120);
});
test('slide ID wins after reordering and Back to editor also keeps the chosen slide duration',async()=>{
 for(const useMarker of [true,false]){
  const storage=savedDeck();storage[STATE].slides.reverse();storage[STATE].activeSlide=0;
  if(useMarker)storage[STATE].activeSlide=1;else delete storage[MARKER];
  const f=fixture('editor.html',storage);f.start();await settle();
  assert.equal(f.run('activeSlide'),0);assert.equal(f.run('blocks.length'),0);
  assert.equal(f.registry.get('slideDuration').value,120);
 }
});
test('return waits for storage completion and reports a failed write without navigating',async()=>{
 let release,fail=false;
 const gate=new Promise(resolve=>release=resolve);
 const f=fixture('editor.html',savedDeck(),{set:async()=>{await gate;if(fail)throw Error('storage full')}});
 f.start();await settle();
 const returning=f.registry.get('backToSlidesBtn').listeners.click();await settle();
 assert.equal(f.run('location.href'),'');assert(f.storage[MARKER]);
 release();await returning;assert.equal(f.run('location.href'),'slides.html');
 fail=true;f.run('editorNavigating=false;location.href=""');
 await f.registry.get('slidesBtn').listeners.click();
 assert.equal(f.run('location.href'),'');assert.match(f.registry.get('status').textContent,/Could not save/);
});
test('add, edit, duplicate and reorder select stable slide IDs through the real Slides handlers',async()=>{
 const f=fixture('slides.html',savedDeck());f.start();await settle();
 await f.registry.get('addBtn').onclick();const newId=f.run('slides[activeSlide].id');
 await f.registry.get('editBtn').onclick();
 assert.equal(f.storage[MARKER].slideId,newId);assert.equal(f.run('location.href'),'editor.html');
 const editor=fixture('editor.html',f.storage);editor.start();await settle();
 assert.equal(editor.run('slides[activeSlide].id'),newId);assert.equal(editor.run('blocks.length'),0);
 editor.registry.get('addTextBtn').onclick();await editor.registry.get('backToSlidesBtn').listeners.click();
 const second=fixture('slides.html',f.storage);second.start();await settle();
 await second.registry.get('duplicateBtn').onclick();const copyId=second.run('slides[activeSlide].id');
 assert.notEqual(copyId,newId);
 await second.registry.get('moveUpBtn').onclick();await second.registry.get('editBtn').onclick();
 assert.equal(second.storage[MARKER].slideId,copyId);
});
test('slow state restoration cannot schedule an empty draft save',async()=>{
 let release;const gate=new Promise(resolve=>release=resolve);
 const storage=savedDeck();const f=fixture('editor.html',storage,{get:()=>gate});f.start();
 f.run('scheduleSave()');assert.equal(f.run('saveTimer'),null);
 release();await settle();assert.equal(f.run('blocks.length'),0);assert.equal(f.run('slides.length'),2);
});
