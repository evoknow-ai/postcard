const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(process.env.POSTCARD_BACKGROUND_SOURCE||path.join(__dirname,'../background.js'),'utf8');
function fixture(initial=[]){
 const tabs=initial.map(t=>({...t})),created=[],focused=[],updates=[],listeners=[];
 const event=()=>({addListener(){}});
 const chrome={runtime:{getURL:p=>'chrome-extension://postcard/'+p,onInstalled:event(),onStartup:event(),onMessage:{addListener:fn=>listeners.push(fn)}},
 action:{onClicked:event()},contextMenus:{create(){},onClicked:event()},alarms:{get:async()=>({}),create:async()=>{},onAlarm:event()},
 system:{display:{getInfo:async()=>[]}},
 tabs:{query:async({url})=>url?tabs.filter(t=>url.some(prefix=>(t.url||'').startsWith(prefix.slice(0,-1)))):tabs,
 update:async(id,patch)=>{const t=tabs.find(t=>t.id===id);if(!t)throw Error('tab closed');updates.push({id,...patch});return Object.assign(t,patch)},
 get:async id=>{const t=tabs.find(t=>t.id===id);if(!t)throw Error('tab closed');return t}},
 windows:{get:async id=>({id,state:'normal'}),update:async(id,patch)=>{focused.push({id,...patch});return {id,...patch}},
 create:async spec=>{await new Promise(setImmediate);const id=100+created.length;created.push(spec);tabs.push({id,windowId:id,url:spec.url});return {id}}},storage:{local:{set:async()=>{}}}};
 const context=()=>{const c=vm.createContext({chrome,URLSearchParams,console,Map});vm.runInContext(source,c);return c};
 let c=context();return {tabs,created,focused,updates,chrome,listeners,run:s=>vm.runInContext(s,c),restart:()=>{c=context()}};
}
test('WIN-01 repeated and concurrent editor launches create exactly one fully addressed window',async()=>{
 const f=fixture();await Promise.all(Array.from({length:20},()=>f.run('openEditor({id:4,windowId:5})')));
 await f.run('openEditor({id:4,windowId:5})');assert.equal(f.created.length,1);
 assert.match(f.created[0].url,/editor.html\?sourceTabId=4&sourceWindowId=5$/);
 assert.equal(f.tabs.length,1);assert.equal(f.updates[0].url,undefined);
});
test('WIN-02 existing editor or Slides workspace is focused without losing its unsaved draft',async()=>{
 for(const page of ['editor.html','slides.html']){
  const url='chrome-extension://postcard/'+page+'?sourceTabId=4&sourceWindowId=5';
  const f=fixture([{id:7,windowId:8,url}]);await f.run('openEditor({id:99,windowId:100})');
  assert.equal(f.created.length,0);assert.equal(f.tabs[0].url,url);assert.equal(f.focused[0].id,8);
  assert.deepEqual(f.updates,[{id:7,active:true}]);
 }
});
test('WIN-03 service-worker restart discovers the existing workspace and restores a minimized window',async()=>{
 const f=fixture();await f.run('openEditor({id:4,windowId:5})');f.restart();
 f.chrome.windows.get=async id=>({id,state:'minimized'});await f.run('openEditor()');
 assert.equal(f.created.length,1);assert.equal(f.focused.at(-1).state,'normal');
});
test('WIN-04 closed windows reopen once; failed creates can be retried; lookup errors do not spawn extras',async()=>{
 const f=fixture();await f.run('openEditor()');f.tabs.length=0;await f.run('openEditor()');assert.equal(f.created.length,2);
 const original=f.chrome.windows.create;f.tabs.length=0;f.chrome.windows.create=async()=>{throw Error('failed create')};
 await assert.rejects(f.run('openEditor()'),/failed create/);f.chrome.windows.create=original;await f.run('openEditor()');assert.equal(f.created.length,3);
 f.chrome.tabs.query=async()=>{throw Error('failed query')};await assert.rejects(f.run('openEditor()'),/failed query/);assert.equal(f.created.length,3);
});
test('WIN-05 repeated Settings requests reuse a separate settings window',async()=>{
 const f=fixture();await f.run('openEditor()');await Promise.all([f.run('openSettings()'),f.run('openSettings()')]);await f.run('openSettings()');
 assert.equal(f.created.length,2);assert.match(f.created[1].url,/settings.html$/);
});
test('WIN-06 recorder return acknowledges editor focus before success, and reports failures',async()=>{
 const f=fixture();const handler=f.listeners.at(-1);let response;
 assert.equal(handler({type:'POSTCARD_OPEN_EDITOR',sourceTabId:4,sourceWindowId:5},{},r=>response=r),true);
 assert.equal(response,undefined);await new Promise(setImmediate);await new Promise(setImmediate);
 assert.equal(response.ok,true);assert.equal(f.created.length,1);
 f.chrome.tabs.query=async()=>{throw Error('cannot query')};
 await new Promise(resolve=>handler({type:'POSTCARD_OPEN_EDITOR'},{},r=>{assert.equal(r.ok,false);resolve()}));
});

test('WIN-01 pending New Tab navigation is reused instead of creating another window',async()=>{
 const f=fixture([{id:7,windowId:8,url:'about:blank',pendingUrl:'chrome-extension://postcard/editor.html?sourceTabId=4'}]);
 await f.run('openEditor()');assert.equal(f.created.length,0);assert.equal(f.focused[0].id,8);
});
