const PostCardAdapters = {
  x: {
    matches: () => /(^|\.)x\.com$|(^|\.)twitter\.com$/.test(location.hostname),
    inputs: ['input[data-testid="fileInput"]','input[type="file"][accept*="image"]','input[type="file"]'],
    composers: ['[data-testid="tweetTextarea_0"]','[role="textbox"][contenteditable="true"]']
  },
  linkedin: {
    matches: () => location.hostname === "www.linkedin.com",
    inputs: ['input[type="file"][accept*="image"]','input[type="file"]'],
    composers: ['[role="textbox"][contenteditable="true"]','.ql-editor[contenteditable="true"]']
  },
  facebook: {
    matches: () => /(^|\.)facebook\.com$/.test(location.hostname),
    inputs: ['input[type="file"][accept*="image"]','input[type="file"]'],
    composers: ['[role="dialog"] [role="textbox"][contenteditable="true"]','[role="textbox"][contenteditable="true"]']
  },
  instagram: {
    matches: () => /(^|\.)instagram\.com$/.test(location.hostname),
    inputs: ['input[type="file"][accept*="image"]','input[type="file"]'],
    composers: ['[role="dialog"] textarea','[role="dialog"] [contenteditable="true"]','textarea[aria-label*="caption" i]','textarea']
  },
  reddit: {
    matches: () => /(^|\.)reddit\.com$/.test(location.hostname),
    inputs: ['input[type="file"][accept*="image"]','input[type="file"]'],
    composers: ['shreddit-composer [contenteditable="true"]','[role="textbox"][contenteditable="true"]','textarea']
  },
  bluesky: {
    matches: () => location.hostname === "bsky.app",
    inputs: ['input[type="file"][accept*="image"]','input[type="file"]'],
    composers: ['[contenteditable="true"][role="textbox"]','textarea']
  }
};

function currentAdapter() { return Object.values(PostCardAdapters).find(a => a.matches()) || null; }
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function dataUrlToFile(dataUrl, filename = "postcard.png") {
  const [meta, data] = dataUrl.split(",");
  const mime = (meta.match(/data:(.*?);base64/) || [])[1] || "application/octet-stream";
  const binary = atob(data); const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}
function visible(el){if(!el)return false;const r=el.getBoundingClientRect();const s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=="hidden"&&s.display!=="none";}
function findVisible(selectors,root=document) {
  for (const selector of selectors) {
    const nodes = [...root.querySelectorAll(selector)];
    const v = nodes.find(visible); if (v) return v; if (nodes[0]) return nodes[0];
  }
  return null;
}
async function waitFor(fn,timeout=12000,interval=250){const start=Date.now();while(Date.now()-start<timeout){const v=fn();if(v)return v;await sleep(interval);}return null;}
function textOf(el){return (el?.innerText||el?.textContent||el?.getAttribute?.("aria-label")||"").trim();}
function findButtonByText(words,root=document){
  const wanted=(Array.isArray(words)?words:[words]).map(x=>x.toLowerCase());
  const candidates=[...root.querySelectorAll('button,[role="button"],div[role="button"]')].filter(visible);
  return candidates.find(el=>wanted.some(w=>textOf(el).toLowerCase()===w)) || candidates.find(el=>wanted.some(w=>textOf(el).toLowerCase().includes(w)));
}
function click(el){if(!el)return false;el.scrollIntoView?.({block:"center",inline:"center"});el.dispatchEvent(new MouseEvent("mousedown",{bubbles:true}));el.click();el.dispatchEvent(new MouseEvent("mouseup",{bubbles:true}));return true;}
function setComposerText(adapter, text) {
  if (!text) return { ok: true };
  const el = findVisible(adapter.composers);
  if (!el) return { ok: false, error: "Could not find the active post composer." };
  el.focus();
  if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
    const setter = Object.getOwnPropertyDescriptor(el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,"value")?.set;
    setter ? setter.call(el, text) : (el.value = text);
    el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    const sel=window.getSelection(),range=document.createRange();range.selectNodeContents(el);sel.removeAllRanges();sel.addRange(range);
    document.execCommand("insertText", false, text);
    el.dispatchEvent(new InputEvent("input", { bubbles: true,inputType:"insertText",data:text }));
  }
  return { ok: true };
}
async function attachMedia(adapter, file) {
  const input = await waitFor(()=>findVisible(adapter.inputs),9000);
  if (!input) return { ok:false,error:"Could not find the site's media uploader." };
  try {
    const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;
    input.dispatchEvent(new Event("input",{bubbles:true}));
    input.dispatchEvent(new Event("change",{bubbles:true}));
    return{ok:true};
  } catch(error){return{ok:false,error:"The site's uploader rejected the media: "+error.message};}
}
async function attachImage(adapter,file){ return attachMedia(adapter,file); }
async function attachVideo(adapter,file){ return attachMedia(adapter,file); }

async function prepareFacebookComposer(){
  if(findVisible(PostCardAdapters.facebook.composers))return true;
  const trigger=[...document.querySelectorAll('[role="button"],button')].find(el=>visible(el)&&/what'?s on your mind|create post/i.test(textOf(el)));
  if(trigger)click(trigger);
  return !!await waitFor(()=>findVisible(PostCardAdapters.facebook.composers),10000);
}
async function prepareInstagramComposer(file){
  // Open Create if needed.
  let input=findVisible(PostCardAdapters.instagram.inputs);
  if(!input){
    const create=[...document.querySelectorAll('a,[role="link"],[role="button"],button')].find(el=>visible(el)&&/^create$|new post/i.test(textOf(el)));
    if(create)click(create);
    input=await waitFor(()=>findVisible(PostCardAdapters.instagram.inputs),10000);
  }
  if(!input)throw new Error("Could not open Instagram's Create post dialog.");
  const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));
  // Instagram normally requires two Next steps before caption.
  for(let i=0;i<2;i++){
    const next=await waitFor(()=>findButtonByText(["next"]),10000);
    if(next){click(next);await sleep(900);}else break;
  }
  return true;
}
async function autoPostX(text,file){
  const a=PostCardAdapters.x;
  const composer=await waitFor(()=>findVisible(a.composers),12000);if(!composer)throw new Error("X composer did not open.");
  const tr=setComposerText(a,text);if(!tr.ok)throw new Error(tr.error);
  const ir=await attachImage(a,file);if(!ir.ok)throw new Error(ir.error);
  await sleep(1800);
  const post=await waitFor(()=>findVisible(['[data-testid="tweetButton"]','[data-testid="tweetButtonInline"]']),10000);
  if(!post)throw new Error("Could not find X Post button.");
  click(post);await sleep(1200);return true;
}
async function autoPostFacebook(text,file){
  const a=PostCardAdapters.facebook;
  if(!await prepareFacebookComposer())throw new Error("Could not open Facebook post composer.");
  const tr=setComposerText(a,text);if(!tr.ok)throw new Error(tr.error);
  const ir=await attachImage(a,file);if(!ir.ok)throw new Error(ir.error);
  await sleep(1800);
  const dialog=document.querySelector('[role="dialog"]')||document;
  const post=await waitFor(()=>findButtonByText(["post"],dialog),10000);
  if(!post)throw new Error("Could not find Facebook Post button.");
  click(post);await sleep(1500);return true;
}
async function autoPostInstagram(text,file){
  const a=PostCardAdapters.instagram;
  await prepareInstagramComposer(file);
  const composer=await waitFor(()=>findVisible(a.composers),12000);if(!composer)throw new Error("Could not find Instagram caption field.");
  const tr=setComposerText(a,text);if(!tr.ok)throw new Error(tr.error);
  await sleep(700);
  const share=await waitFor(()=>findButtonByText(["share"]),10000);if(!share)throw new Error("Could not find Instagram Share button.");
  click(share);await sleep(1600);return true;
}
async function autoPost(message){
  const adapter=currentAdapter();if(!adapter)throw new Error("This social site is not supported.");
  const file=dataUrlToFile(message.imageDataUrl,"postcard.png");
  if(message.platform==="facebook")return autoPostFacebook(message.postText||"",file);
  if(message.platform==="instagram")return autoPostInstagram(message.postText||"",file);
  return autoPostX(message.postText||"",file);
}


let postcardRecorderHost=null;

function closePostCardRecorder(){
  if(postcardRecorderHost){
    postcardRecorderHost.remove();
    postcardRecorderHost=null;
  }
}
function openPostCardRecorder(message){
  closePostCardRecorder();

  const host=document.createElement("div");
  host.id="postcard-recorder-host";
  Object.assign(host.style,{
    position:"fixed",
    inset:"0",
    zIndex:"2147483647",
    background:"rgba(0,0,0,.72)"
  });

  const frame=document.createElement("iframe");
  const params=new URLSearchParams({
    embedded:"1",
    sourceTabId:String(message.sourceTabId||""),
    sourceWindowId:String(message.sourceWindowId||"")
  });
  frame.src=chrome.runtime.getURL("recorder.html")+"?"+params.toString();
  frame.allow="camera; microphone";
  frame.setAttribute("allow","camera; microphone");
  frame.setAttribute("title","PostCard Video Recorder");
  Object.assign(frame.style,{
    position:"absolute",
    inset:"18px",
    width:"calc(100% - 36px)",
    height:"calc(100% - 36px)",
    border:"1px solid #383b42",
    borderRadius:"14px",
    background:"#0f1012",
    boxShadow:"0 24px 80px rgba(0,0,0,.7)"
  });

  host.appendChild(frame);
  document.documentElement.appendChild(host);
  postcardRecorderHost=host;

  const listener=e=>{
    if(e.source!==frame.contentWindow)return;
    if(e.data?.type==="POSTCARD_CLOSE_RECORDER"){
      window.removeEventListener("message",listener);
      closePostCardRecorder();
    }
  };
  window.addEventListener("message",listener);

  return {ok:true};
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "POSTCARD_SITE_INFO") { const adapter=currentAdapter();sendResponse({supported:!!adapter,host:location.hostname});return; }
  if (message?.type === "POSTCARD_OPEN_RECORDER") {
    try{sendResponse(openPostCardRecorder(message));}
    catch(e){sendResponse({ok:false,error:e?.message||"Could not open recorder."});}
    return;
  }
  if (message?.type === "POSTCARD_INSERT_VIDEO") {
    (async()=>{
      const adapter=currentAdapter();
      if(!adapter){sendResponse({ok:false,error:"This site is not supported."});return;}
      try{
        const textResult=setComposerText(adapter,message.postText||"");
        if(!textResult.ok){sendResponse(textResult);return;}
        const file=dataUrlToFile(message.videoDataUrl,message.filename||"postcard-video.webm");
        const mediaResult=await attachVideo(adapter,file);
        if(!mediaResult.ok){sendResponse(mediaResult);return;}
        sendResponse({ok:true});
      }catch(error){
        sendResponse({ok:false,error:error?.message||"Could not insert video."});
      }
    })();
    return true;
  }

  if (message?.type === "POSTCARD_INSERT") {
    (async()=>{const adapter=currentAdapter();if(!adapter){sendResponse({ok:false,error:"PostCard does not support this site yet."});return;}const textResult=setComposerText(adapter,message.postText||"");if(!textResult.ok&&message.postText){sendResponse(textResult);return;}const file=dataUrlToFile(message.imageDataUrl,"postcard.png");const imageResult=await attachImage(adapter,file);sendResponse(imageResult);})();return true;
  }
  if(message?.type==="POSTCARD_AUTO_POST"){
    (async()=>{try{await autoPost(message);sendResponse({ok:true});}catch(e){sendResponse({ok:false,error:e.message||String(e)});}})();return true;
  }
});
