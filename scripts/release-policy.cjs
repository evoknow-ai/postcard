const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const excluded=new Set(['.git','node_modules','.qa','REGRESSION-CHECKLIST.md','RELEASE-STATUS.md','evidence.json']);
function sourceFingerprint(root){
 const hash=crypto.createHash('sha256');
 function walk(dir){for(const name of fs.readdirSync(dir).sort()){
  if(excluded.has(name))continue;
  const file=path.join(dir,name),stat=fs.lstatSync(file);
  if(stat.isDirectory())walk(file);
  else if(stat.isFile()){
   const relative=path.relative(root,file).split(path.sep).join('/');
   hash.update(relative+'\0'+stat.size+'\0');hash.update(fs.readFileSync(file));
  }
 }}walk(root);return hash.digest('hex');
}
function compareVersion(a,b){
 const valid=s=>typeof s==='string'&&/^\d+(\.\d+){0,3}$/.test(s)&&s.split('.').every(x=>Number(x)<=65535);
 if(!valid(a)||!valid(b))throw Error('Invalid Chrome version');
 const aa=a.split('.').map(Number),bb=b.split('.').map(Number);
 for(let i=0;i<4;i++){const d=(aa[i]||0)-(bb[i]||0);if(d)return Math.sign(d)}return 0;
}
function validateEvidence(catalog,evidence,fingerprint,version,packageHash){
 const blockers=[];
 if(!evidence)return ['No current-candidate Chrome test evidence.'];
 if(evidence.sourceFingerprint!==fingerprint)blockers.push('Evidence is stale: source fingerprint differs.');
 if(evidence.extensionVersion!==version)blockers.push('Evidence extension version differs.');
 if(!evidence.environment?.os||!evidence.environment?.chrome)blockers.push('Chrome version and OS must be recorded.');
 try{if(compareVersion(version,evidence.publishedStoreVersion)<=0)blockers.push('Candidate version must exceed the published store version.')}catch{blockers.push('Published store version must be recorded and valid.')}
 if(!packageHash||evidence.packageSha256!==packageHash)blockers.push('Exact candidate ZIP hash has not been verified.');
 const results=Array.isArray(evidence.results)?evidence.results:[];
 const known=new Set(catalog.cases.map(c=>c.id));
 for(const r of results)if(!known.has(r.id))blockers.push('Unknown evidence ID: '+r.id);
 for(const c of catalog.cases){
  const found=results.filter(r=>r.id===c.id),r=found[0];
  if(found.length!==1){blockers.push(c.id+': exactly one result is required.');continue}
  if(r.status!=='pass'){blockers.push(c.id+': '+(r.status||'not tested'));continue}
  if(!r.checkedBy?.trim()||!r.evidence?.trim()||!Number.isFinite(Date.parse(r.checkedAt))||Date.parse(r.checkedAt)>Date.now()+300000)
   blockers.push(c.id+': pass requires tester, valid date and concrete evidence.');
 }
 return blockers;
}
module.exports={sourceFingerprint,compareVersion,validateEvidence};
