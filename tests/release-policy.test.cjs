const test=require('node:test');
const assert=require('node:assert/strict');
const {validateEvidence,compareVersion}=require('../scripts/release-policy.cjs');
const catalog={cases:[{id:'WIN-01'},{id:'SLD-01'}]};
function complete(){return {sourceFingerprint:'current',extensionVersion:'0.9.12',publishedStoreVersion:'0.9.11',packageSha256:'package',environment:{os:'macOS',chrome:'test version'},results:catalog.cases.map(c=>({id:c.id,status:'pass',checkedBy:'Test fixture',checkedAt:new Date().toISOString(),evidence:'Synthetic evidence for policy test only.'}))}}
const check=e=>validateEvidence(catalog,e,'current','0.9.12','package');
test('release gate rejects missing, blocked, failed and untested cases',()=>{
 assert(check(null).length);for(const status of ['blocked','fail','not-tested','']){const e=complete();e.results[0].status=status;assert(check(e).length)}
 const missing=complete();missing.results.pop();assert(check(missing).length);
});
test('release gate rejects stale source, wrong version, missing evidence, duplicates and unverified ZIP',()=>{
 for(const mutate of [e=>e.sourceFingerprint='old',e=>e.extensionVersion='0.9.10',e=>e.results[0].evidence='',e=>e.results[0].checkedBy='',e=>e.results.push(e.results[0]),e=>e.packageSha256='',e=>e.publishedStoreVersion='0.9.12',e=>e.environment.chrome='']){
  const e=complete();mutate(e);assert(check(e).length);
 }
 assert.deepEqual(check(complete()),[]);
});
test('release version comparisons use Chrome numeric components',()=>{
 assert.equal(compareVersion('0.9.10','0.9.9'),1);assert.equal(compareVersion('0.9.11','0.9.11'),0);assert.throws(()=>compareVersion('0.9.beta','0.9.11'));
});

test('changing source invalidates its fingerprint while recording QA results does not',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const {sourceFingerprint}=require('../scripts/release-policy.cjs');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'postcard-gate-'));
 try{
  fs.writeFileSync(path.join(root,'background.js'),'original');const original=sourceFingerprint(root);
  fs.mkdirSync(path.join(root,'.qa'));fs.writeFileSync(path.join(root,'.qa/status.json'),'report');
  assert.equal(sourceFingerprint(root),original);
  fs.writeFileSync(path.join(root,'background.js'),'changed');assert.notEqual(sourceFingerprint(root),original);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
