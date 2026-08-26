const $=id=>document.getElementById(id);
const CONFIG_KEY="postcardAiAutomationV1";
const HISTORY_KEY="postcardAutomationHistoryV1";
const MODEL_OPTIONS={
  openai:[
    ["gpt-5.6-luna","GPT-5.6 Luna — lower cost"],
    ["gpt-5.6-terra","GPT-5.6 Terra — balanced"],
    ["gpt-5.6-sol","GPT-5.6 Sol — highest capability"],
    ["gpt-5.5","GPT-5.5"],
    ["gpt-5.4","GPT-5.4"],
    ["gpt-5.4-mini","GPT-5.4 Mini"],
    ["gpt-5.4-nano","GPT-5.4 Nano"],
    ["__custom__","Custom model ID…"]
  ],
  anthropic:[
    ["claude-sonnet-4-5","Claude Sonnet 4.5"],
    ["claude-opus-4-1","Claude Opus 4.1"],
    ["claude-3-5-haiku-latest","Claude 3.5 Haiku"],
    ["__custom__","Custom model ID…"]
  ]
};
const defaults={enabled:false,provider:"openai",model:"gpt-5.6-luna",apiKey:"",prompt:"",useCurrentDesign:true,platform:"x",scheduleType:"recurring",days:[1,2,3,4,5],hour:9,minute:0,ampm:"AM",onceAt:""};

const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||"Local time";
$("timezoneName").textContent=timezone;
$("timezoneNameOnce").textContent=timezone;

function populateModels(provider,selected){
  const root=$("modelPreset");
  const opts=MODEL_OPTIONS[provider]||MODEL_OPTIONS.openai;
  root.innerHTML=opts.map(([value,label])=>`<option value="${value}">${label}</option>`).join("");
  const known=opts.some(([v])=>v===selected);
  root.value=known?selected:"__custom__";
  $("modelCustom").hidden=root.value!=="__custom__";
  $("modelCustom").value=known?"":(selected||"");
}
function chosenModel(){
  return $("modelPreset").value==="__custom__"?$("modelCustom").value.trim():$("modelPreset").value;
}

function buildTimes(){
  const root=$("postTime");
  for(let h=0;h<24;h++){
    for(const m of [0,15,30,45]){
      const hour12=h%12||12,ampm=h<12?"AM":"PM";
      const value=`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
      root.insertAdjacentHTML("beforeend",`<option value="${value}">${hour12}:${String(m).padStart(2,"0")} ${ampm}</option>`);
    }
  }
}
buildTimes();

function storedToTime(c){
  let h=Number(c.hour)%12;if(c.ampm==="PM")h+=12;
  return `${String(h).padStart(2,"0")}:${String(Number(c.minute)||0).padStart(2,"0")}`;
}
function timeToStored(value){
  const [h,m]=String(value||"09:00").split(":").map(Number);
  return {hour:h%12||12,minute:m,ampm:h>=12?"PM":"AM"};
}
function readForm(){
  const tm=timeToStored($("postTime").value);
  return {
    enabled:$("enabled").checked,
    provider:$("provider").value,
    model:chosenModel(),
    apiKey:$("apiKey").value.trim(),
    prompt:$("prompt").value.trim(),
    useCurrentDesign:$("useCurrentDesign").checked,
    platform:document.querySelector('input[name="platform"]:checked')?.value||"x",
    scheduleType:document.querySelector('input[name="scheduleType"]:checked')?.value||"recurring",
    days:[...document.querySelectorAll('#days input:checked')].map(x=>Number(x.value)),
    hour:tm.hour,minute:tm.minute,ampm:tm.ampm,
    onceAt:$("onceAt").value
  };
}
function writeForm(c){
  c={...defaults,...c};
  $("enabled").checked=!!c.enabled;
  $("provider").value=c.provider;
  populateModels(c.provider,c.model);
  $("apiKey").value=c.apiKey||"";
  $("prompt").value=c.prompt||"";
  $("useCurrentDesign").checked=c.useCurrentDesign!==false;
  document.querySelector(`input[name="platform"][value="${c.platform}"]`)?.click();
  document.querySelector(`input[name="scheduleType"][value="${c.scheduleType}"]`)?.click();
  document.querySelectorAll('#days input').forEach(x=>x.checked=(c.days||[]).includes(Number(x.value)));
  $("postTime").value=storedToTime(c);
  $("onceAt").value=c.onceAt||"";
  updateScheduleUi();updateNextRun();
}
function updateScheduleUi(){const recurring=document.querySelector('input[name="scheduleType"]:checked')?.value!=="once";$("recurringBox").hidden=!recurring;$("onceBox").hidden=recurring;}
function to24(c){let h=Number(c.hour)%12;if(c.ampm==="PM")h+=12;return h;}
function nextRecurring(c){
  if(!c.days?.length)return null;const now=new Date();const hh=to24(c),mm=Number(c.minute);
  for(let add=0;add<8;add++){const d=new Date(now);d.setDate(now.getDate()+add);d.setHours(hh,mm,0,0);if(c.days.includes(d.getDay())&&d>now)return d;}return null;
}
function dayNames(days){
  const map=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  return (days||[]).map(d=>map[d]).join(", ");
}
function prettyRecurringTime(c){
  const mm=String(Number(c.minute)||0).padStart(2,"0");
  return `${Number(c.hour)||9}:${mm} ${c.ampm||"AM"}`;
}
function updateNextRun(){
  const c=readForm();
  let d=c.scheduleType==="once"&&c.onceAt?new Date(c.onceAt):nextRecurring(c);
  $("nextRun").textContent="Next run: "+(d&&!isNaN(d)?d.toLocaleString():"—");
  if(c.scheduleType==="once"){
    $("scheduleSummary").textContent=c.onceAt?`One-time post at ${new Date(c.onceAt).toLocaleString()} (${timezone})`:"Choose a date and time.";
  }else{
    const days=dayNames(c.days);
    $("scheduleSummary").textContent=days?`Posts ${days} at ${prettyRecurringTime(c)} (${timezone})`:"Choose at least one weekday.";
  }
}
async function save(){const c=readForm();await chrome.storage.local.set({[CONFIG_KEY]:c});await chrome.runtime.sendMessage({type:"POSTCARD_AUTOMATION_CONFIG_CHANGED"});$("saveState").textContent="Saved";$("saveState").style.color="#78c797";updateNextRun();}
async function load(){const d=await chrome.storage.local.get([CONFIG_KEY,HISTORY_KEY]);writeForm(d[CONFIG_KEY]||defaults);renderHistory(d[HISTORY_KEY]||[]);}
function renderHistory(items){const root=$("history");if(!items.length){root.innerHTML='<div class="empty">No runs yet.</div>';return;}root.innerHTML=items.slice(0,30).map(x=>`<div class="historyItem ${x.ok?'ok':'fail'}"><div class="top"><span class="state">${x.ok?'POSTED':'FAILED'} · ${(x.platform||'').toUpperCase()}</span><span>${new Date(x.at).toLocaleString()}</span></div><div class="detail">${escapeHtml(x.detail||'')}</div></div>`).join('');}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

$("toggleKey").onclick=()=>{const p=$("apiKey");p.type=p.type==="password"?"text":"password";$("toggleKey").textContent=p.type==="password"?"Show":"Hide";};
$("provider").onchange=()=>{const provider=$("provider").value;populateModels(provider,provider==="openai"?"gpt-5.6-luna":"claude-sonnet-4-5");$("saveState").textContent="Not saved";};
$("modelPreset").onchange=()=>{$("modelCustom").hidden=$("modelPreset").value!=="__custom__";$("saveState").textContent="Not saved";};
document.querySelectorAll('input[name="scheduleType"]').forEach(x=>x.onchange=()=>{updateScheduleUi();updateNextRun();});
document.querySelectorAll('#days input,#postTime,#onceAt').forEach(x=>x.addEventListener('change',updateNextRun));
$("save").onclick=save;
$("testAi").onclick=async()=>{await save();const b=$("testAi");b.disabled=true;b.textContent="Generating…";try{const r=await chrome.runtime.sendMessage({type:"POSTCARD_AI_TEST"});$("testResult").hidden=false;$("testResult").textContent=r?.ok?`POST TEXT\n${r.postText}\n\nCARD TEXT\n${r.cardText}`:`Error: ${r?.error||'Unknown error'}`;}finally{b.disabled=false;b.textContent="Test AI";}};
$("runNow").onclick=async()=>{await save();if(!confirm("Generate and publish a post now? This will click Post/Share on the selected social network."))return;const b=$("runNow");b.disabled=true;b.textContent="Posting…";const r=await chrome.runtime.sendMessage({type:"POSTCARD_AUTOMATION_RUN",manual:true});b.disabled=false;b.textContent="Run & Post Now";alert(r?.ok?"Post published.":`Posting failed: ${r?.error||'Unknown error'}`);const d=await chrome.storage.local.get(HISTORY_KEY);renderHistory(d[HISTORY_KEY]||[]);};
$("clearHistory").onclick=async()=>{await chrome.storage.local.set({[HISTORY_KEY]:[]});renderHistory([]);};
document.querySelectorAll('input,select,textarea').forEach(x=>x.addEventListener('input',()=>{$("saveState").textContent="Not saved";$("saveState").style.color="";}));
load();
