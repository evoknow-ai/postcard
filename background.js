const CONFIG_KEY="postcardAiAutomationV1";
const HISTORY_KEY="postcardAutomationHistoryV1";
const EDITOR_STATE_KEY="postcardEditorStateV1";
const ALARM_NAME="postcard-ai-scheduler";

async function centeredWindow(url,width=980,height=820){
  const displays=await chrome.system.display.getInfo().catch(()=>[]);
  const primary=displays.find(d=>d.isPrimary)||displays[0];
  const area=primary?.workArea||primary?.bounds||{left:0,top:0,width:1440,height:900};
  width=Math.min(width,Math.max(760,area.width-80));height=Math.min(height,Math.max(640,area.height-80));
  return chrome.windows.create({url:chrome.runtime.getURL(url),type:"popup",width,height,left:Math.round(area.left+(area.width-width)/2),top:Math.round(area.top+(area.height-height)/2),focused:true});
}
// One pending launch per workspace prevents rapid clicks from racing the lookup.
// Query Chrome each time so reuse still works after service-worker suspension.
const pendingWorkspaceOpens=new Map();
function openWorkspace(key,pages,url,width,height){
  if(pendingWorkspaceOpens.has(key))return pendingWorkspaceOpens.get(key);
  const opening=(async()=>{
    const urls=pages.map(page=>chrome.runtime.getURL(page));
    const matches=(await chrome.tabs.query({})).filter(tab=>{
      const target=tab.pendingUrl||tab.url||"";
      return urls.some(base=>target===base||target.startsWith(base+"?")||target.startsWith(base+"#"));
    });
    for(const tab of matches){
      try{
        await chrome.tabs.update(tab.id,{active:true});
        const win=await chrome.windows.get(tab.windowId);
        return await chrome.windows.update(tab.windowId,{focused:true,...(win.state==="minimized"?{state:"normal"}:{})});
      }catch(error){
        // A tab may have closed after the query. Only create a replacement if it is gone.
        if(await chrome.tabs.get(tab.id).catch(()=>null))throw error;
      }
    }
    return centeredWindow(url,width,height);
  })();
  pendingWorkspaceOpens.set(key,opening);
  const clear=()=>{if(pendingWorkspaceOpens.get(key)===opening)pendingWorkspaceOpens.delete(key);};
  opening.then(clear,clear);
  return opening;
}
async function openEditor(sourceTab){
  const params=new URLSearchParams();
  if(sourceTab?.id!=null)params.set("sourceTabId",String(sourceTab.id));
  if(sourceTab?.windowId!=null)params.set("sourceWindowId",String(sourceTab.windowId));
  const url="editor.html"+(params.toString()?`?${params}`:"");
  // Preserve the existing draft and its originating social tab; do not reload it.
  return openWorkspace("editor",["editor.html","slides.html"],url,1180,820);
}
async function openSettings(){return openWorkspace("settings",["settings.html"],"settings.html",940,860);}

chrome.action.onClicked.addListener(tab=>openEditor(tab));

async function ensureScheduler(){
  const alarm=await chrome.alarms.get(ALARM_NAME);
  if(!alarm)await chrome.alarms.create(ALARM_NAME,{periodInMinutes:1});
}

chrome.runtime.onInstalled.addListener(async()=>{
  chrome.contextMenus.create({id:"postcard-selection",title:"Create PostCard from selection",contexts:["selection"]});
  await ensureScheduler();
});
chrome.runtime.onStartup.addListener(ensureScheduler);

chrome.contextMenus.onClicked.addListener(async (info,tab)=>{
  if(info.menuItemId!=="postcard-selection")return;
  await chrome.storage.local.set({postcardSelectedText:info.selectionText||"",postcardSelectedAt:Date.now()});
  openEditor(tab);
});

function extractJson(text){
  text=String(text||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"");
  try{return JSON.parse(text);}catch(_){}
  const a=text.indexOf("{"),b=text.lastIndexOf("}");
  if(a>=0&&b>a){try{return JSON.parse(text.slice(a,b+1));}catch(_){}}
  throw new Error("AI response was not valid JSON.");
}
function normalizeGenerated(obj,platform){
  let postText=String(obj?.postText||obj?.post||"").trim();
  let cardText=String(obj?.cardText||obj?.card||obj?.headline||"").trim();
  if(!postText&&cardText)postText=cardText;
  if(!cardText&&postText)cardText=postText.slice(0,120);
  if(platform==="x"&&postText.length>280)postText=postText.slice(0,277)+"…";
  cardText=cardText.slice(0,220);
  return{postText,cardText};
}
function aiInstruction(c){
  const platformName={x:"X (Twitter)",facebook:"Facebook",instagram:"Instagram"}[c.platform]||c.platform;
  return `You create scheduled social media content for ${platformName}. Follow the user's topic/instructions below. Return ONLY JSON with exactly two string fields: "postText" and "cardText". postText is the complete social post caption. cardText is a concise, visually strong headline or short statement for an image card. Do not use markdown fences. For X keep postText at or under 280 characters. Avoid inventing facts that require current verification unless the prompt supplies them.\n\nUSER INSTRUCTIONS:\n${c.prompt}`;
}
async function callOpenAI(c){
  const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${c.apiKey}`},body:JSON.stringify({model:c.model||"gpt-5.6-luna",input:aiInstruction(c)})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j?.error?.message||`OpenAI API error ${r.status}`);
  let text=j.output_text;
  if(!text&&Array.isArray(j.output))for(const o of j.output)for(const part of (o.content||[]))if(part.text)text=(text||"")+part.text;
  return normalizeGenerated(extractJson(text),c.platform);
}
async function callAnthropic(c){
  const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":c.apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:c.model||"claude-sonnet-4-5",max_tokens:900,messages:[{role:"user",content:aiInstruction(c)}]})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j?.error?.message||`Anthropic API error ${r.status}`);
  const text=(j.content||[]).filter(x=>x.type==="text").map(x=>x.text).join("\n");
  return normalizeGenerated(extractJson(text),c.platform);
}
async function generateAI(c){
  if(!c.apiKey)throw new Error("API key is missing.");
  if(!c.prompt)throw new Error("Prompt is empty.");
  return c.provider==="anthropic"?callAnthropic(c):callOpenAI(c);
}

function gradientFor(ctx,w,h,g){
  const[d,...colors]=g||[];let gr;
  if(d==="to left")gr=ctx.createLinearGradient(w,0,0,0);else if(d==="to bottom")gr=ctx.createLinearGradient(0,0,0,h);else if(d==="to top")gr=ctx.createLinearGradient(0,h,0,0);else if(d==="45deg")gr=ctx.createLinearGradient(0,0,w,h);else if(d==="135deg")gr=ctx.createLinearGradient(0,h,w,0);else gr=ctx.createLinearGradient(0,0,w,0);
  colors.forEach((c,i)=>gr.addColorStop(colors.length===1?0:i/(colors.length-1),c));return gr;
}
function wrapText(ctx,text,maxWidth){
  const lines=[];for(const para of String(text).split("\n")){if(!para){lines.push("");continue;}let line="";for(const word of para.split(/\s+/)){const test=line?`${line} ${word}`:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word;}else line=test;}lines.push(line);}return lines;
}
async function blobDataUrl(blob){const bytes=new Uint8Array(await blob.arrayBuffer());let s="";for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return `data:${blob.type};base64,${btoa(s)}`;}
async function renderAutomationCard(cardText,useCurrentDesign){
  const stored=await chrome.storage.local.get(EDITOR_STATE_KEY);const st=useCurrentDesign?stored[EDITOR_STATE_KEY]:null;
  const format=st?.currentFormat||"landscape";const dims={landscape:[1200,675],square:[1080,1080],portrait:[1080,1350]};const[w,h]=dims[format]||dims.landscape;
  const canvas=new OffscreenCanvas(w,h),ctx=canvas.getContext("2d");const bg=st?.bg||{type:"solid",color:"#ED213A"};
  if(bg.type==="gradient"&&bg.gradient){ctx.fillStyle=gradientFor(ctx,w,h,bg.gradient);ctx.fillRect(0,0,w,h);}else if(bg.type==="image"&&bg.image){
    try{const r=await fetch(bg.image);const bmp=await createImageBitmap(await r.blob());ctx.drawImage(bmp,0,0,w,h);bmp.close();if(bg.darkness){ctx.fillStyle=`rgba(0,0,0,${bg.darkness/100})`;ctx.fillRect(0,0,w,h);}}catch(_){ctx.fillStyle="#ED213A";ctx.fillRect(0,0,w,h);}
  }else{ctx.fillStyle=bg.color||"#ED213A";ctx.fillRect(0,0,w,h);}
  const style=st?.blocks?.[0]||{};const size=Math.max(34,Math.min(100,Number(style.size)||58));ctx.font=`${style.italic?"italic ":""}${style.bold===false?"400":"700"} ${size}px Arial, sans-serif`;ctx.fillStyle=style.color||"#ffffff";ctx.textAlign=style.align||"center";ctx.textBaseline="middle";ctx.shadowColor=style.shadow===false?"transparent":"rgba(0,0,0,.55)";ctx.shadowBlur=8;ctx.shadowOffsetY=3;
  const maxW=w*.78,lines=wrapText(ctx,cardText,maxW),lh=size*1.2,y0=h/2-((lines.length-1)*lh)/2;const x=ctx.textAlign==="left"?w*.11:ctx.textAlign==="right"?w*.89:w/2;lines.forEach((line,i)=>ctx.fillText(line,x,y0+i*lh,maxW));
  return blobDataUrl(await canvas.convertToBlob({type:"image/png"}));
}

function platformUrl(p){return p==="facebook"?"https://www.facebook.com/":p==="instagram"?"https://www.instagram.com/":"https://x.com/compose/post";}
async function waitTab(tabId,timeout=25000){
  const tab=await chrome.tabs.get(tabId).catch(()=>null);if(tab?.status==="complete")return;
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{chrome.tabs.onUpdated.removeListener(fn);reject(new Error("Timed out loading social site."));},timeout);const fn=(id,info)=>{if(id===tabId&&info.status==="complete"){clearTimeout(timer);chrome.tabs.onUpdated.removeListener(fn);resolve();}};chrome.tabs.onUpdated.addListener(fn);});
}
async function sendWithRetry(tabId,msg,attempts=10){
  let last;for(let i=0;i<attempts;i++){try{return await chrome.tabs.sendMessage(tabId,msg);}catch(e){last=e;await new Promise(r=>setTimeout(r,700));}}throw last||new Error("Could not connect to social page.");
}
async function publish(platform,postText,imageDataUrl){
  const tab=await chrome.tabs.create({url:platformUrl(platform),active:true});await waitTab(tab.id);await new Promise(r=>setTimeout(r,1300));
  const res=await sendWithRetry(tab.id,{type:"POSTCARD_AUTO_POST",platform,postText,imageDataUrl});
  if(!res?.ok)throw new Error(res?.error||"Social site did not confirm posting.");
  return res;
}
async function addHistory(entry){const d=await chrome.storage.local.get(HISTORY_KEY);const arr=d[HISTORY_KEY]||[];arr.unshift(entry);await chrome.storage.local.set({[HISTORY_KEY]:arr.slice(0,100)});}
async function getConfig(){const d=await chrome.storage.local.get(CONFIG_KEY);return d[CONFIG_KEY]||null;}
async function runAutomation(trigger="manual"){
  const c=await getConfig();if(!c)throw new Error("AI automation is not configured.");
  const generated=await generateAI(c);const imageDataUrl=await renderAutomationCard(generated.cardText,c.useCurrentDesign!==false);await publish(c.platform,generated.postText,imageDataUrl);
  await addHistory({at:Date.now(),ok:true,platform:c.platform,trigger,detail:generated.postText});return generated;
}
function localRunKey(c,now){return c.scheduleType==="once"?`once:${c.onceAt}`:`${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}-${now.getHours()}:${String(now.getMinutes()).padStart(2,"0")}`;}
function dueNow(c,now=new Date()){
  if(!c?.enabled)return false;
  if(c.scheduleType==="once"){
    if(!c.onceAt)return false;const t=new Date(c.onceAt);return !isNaN(t)&&Math.abs(now.getTime()-t.getTime())<65000;
  }
  if(!(c.days||[]).includes(now.getDay()))return false;let h=Number(c.hour)%12;if(c.ampm==="PM")h+=12;return now.getHours()===h&&now.getMinutes()===Number(c.minute);
}
async function schedulerTick(){
  const c=await getConfig();if(!dueNow(c))return;const now=new Date(),key=localRunKey(c,now);if(c.lastRunKey===key)return;c.lastRunKey=key;if(c.scheduleType==="once")c.enabled=false;await chrome.storage.local.set({[CONFIG_KEY]:c});
  try{await runAutomation("schedule");}catch(e){await addHistory({at:Date.now(),ok:false,platform:c.platform,trigger:"schedule",detail:e.message||String(e)});}
}
chrome.alarms.onAlarm.addListener(a=>{if(a.name===ALARM_NAME)schedulerTick();});

chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
  if(msg?.type==="POSTCARD_OPEN_SETTINGS"){openSettings();sendResponse({ok:true});return;}
  if(msg?.type==="POSTCARD_AUTOMATION_CONFIG_CHANGED"){ensureScheduler();sendResponse({ok:true});return;}
  if(msg?.type==="POSTCARD_AI_TEST"){
    (async()=>{try{const c=await getConfig();const g=await generateAI(c);sendResponse({ok:true,...g});}catch(e){sendResponse({ok:false,error:e.message||String(e)});}})();return true;
  }
  if(msg?.type==="POSTCARD_AUTOMATION_RUN"){
    (async()=>{try{const g=await runAutomation("manual");sendResponse({ok:true,...g});}catch(e){const c=await getConfig();await addHistory({at:Date.now(),ok:false,platform:c?.platform||"",trigger:"manual",detail:e.message||String(e)});sendResponse({ok:false,error:e.message||String(e)});}})();return true;
  }
});

ensureScheduler();

chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  if(message?.type==="POSTCARD_OPEN_EDITOR"){
    const source={id:message.sourceTabId??sender.tab?.id,windowId:message.sourceWindowId??sender.tab?.windowId};
    openEditor(source).then(()=>sendResponse({ok:true}),error=>sendResponse({ok:false,error:error.message}));
    return true;
  }
});
