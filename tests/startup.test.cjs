const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
// An API-level startup check. This intentionally does not substitute for browser layout or media tests.
function fixture(page){
 const registry=new Map(),events={},errors=[];
 const ctx=new Proxy({measureText:text=>({width:String(text).length*10}),createLinearGradient:()=>({addColorStop(){}})}, {get:(target,key)=>key in target?target[key]:()=>{}});
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.style={setProperty(){}};this.dataset={};this.children=[];this.value='';this.checked=false;this.classList={add(){},remove(){},toggle(){}};this.textContent='';this.innerText='';this.listeners={};}
  set id(id){this._id=id;registry.set(id,this)}get id(){return this._id}
  appendChild(el){this.children.push(el);return el}append(...els){els.forEach(el=>this.appendChild(el))}insertBefore(el){return this.appendChild(el)}
  querySelectorAll(){return []}querySelector(){return new Element()}addEventListener(name,handler){this.listeners[name]=handler}
  setAttribute(){}removeAttribute(){}contains(){return false}remove(){}blur(){}focus(){}click(){}
  getContext(){return ctx}getBoundingClientRect(){return {left:0,top:0,width:960,height:540}}
 }
 const html=fs.readFileSync(path.join(root,page),'utf8');
 for(const tag of html.matchAll(/<([a-z0-9]+)\b[^>]*\bid="([^"]+)"[^>]*>/gi)){
  const el=new Element(tag[1]);el.id=tag[2];el.value=tag[0].match(/\bvalue="([^"]*)"/)?.[1]||'';
 }
 const document={getElementById:id=>registry.get(id)||null,querySelector:()=>new Element(),querySelectorAll:()=>[],createElement:tag=>new Element(tag),activeElement:null,addEventListener:(name,fn)=>{events[name]=fn},body:new Element('body'),fonts:{ready:Promise.resolve()},createRange:()=>({selectNodeContents(){},collapse(){}})};
 const storage={};
 const c=vm.createContext({console:{log(){},warn(){},error:(...args)=>errors.push(args)},document,window:{addEventListener:(name,fn)=>events[name]=fn,getSelection:()=>({removeAllRanges(){},addRange(){}})},
  crypto:require('node:crypto').webcrypto,structuredClone,URL,URLSearchParams,Blob,Date,Math,Promise,Map,Set,performance,
  setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},requestAnimationFrame:()=>0,cancelAnimationFrame(){},
  location:{search:'',href:'',replace(){}},navigator:{mediaDevices:{enumerateDevices:async()=>[]}},
  chrome:{runtime:{getManifest:()=>({version:'0.9.5'}),getURL:x=>x,sendMessage:async()=>({})},storage:{local:{get:async()=>structuredClone(storage),set:async data=>Object.assign(storage,structuredClone(data)),remove:async()=>{}}},tabs:{query:async()=>[]}},
  fetch:async()=>({ok:true,json:async()=>[],blob:async()=>new Blob()}),Image:class{},indexedDB:{open(){throw new Error('No audio fixture')}},
 });
 return {c,events,errors,registry};
}
for(const page of ['editor.html','slides.html'])test(`${page} starts with all restored controls and no missing symbols`,async()=>{
 const f=fixture(page),scripts=['motion-tools.js','object-layers.js','image-objects.js',...(page==='editor.html'?['editor-motion.js','editor.js']:['slides.js'])];
 for(const file of scripts)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),f.c,{filename:file});
 for(let i=0;i<5;i++)await new Promise(setImmediate);
 assert.deepEqual(f.errors,[]);
 if(page==='editor.html')assert.equal(vm.runInContext('blocks.length',f.c),1);
 else assert.equal(vm.runInContext('slides.length',f.c),1);
});
