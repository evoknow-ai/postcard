#!/usr/bin/env node
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {sourceFingerprint,validateEvidence}=require('./release-policy.cjs');
const root=path.join(__dirname,'..');
const args=process.argv.slice(2);
const value=flag=>{const i=args.indexOf(flag);return i<0?null:args[i+1]};
const automatedOnly=args.includes('--automated');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'docs/qa/catalog.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const fingerprint=sourceFingerprint(root);
const evidencePath=path.resolve(root,value('--evidence')||'docs/qa/evidence.json');
if(args.includes('--init-evidence')){
 if(fs.existsSync(evidencePath))throw Error('Evidence already exists; preserve previous results instead of overwriting them.');
 fs.writeFileSync(evidencePath,JSON.stringify({sourceFingerprint:fingerprint,extensionVersion:manifest.version,publishedStoreVersion:'',packageSha256:'',environment:{os:'',chrome:''},results:catalog.cases.map(c=>({id:c.id,status:'not-tested',checkedBy:'',checkedAt:'',evidence:''}))},null,2)+'\n');
 console.log('Created unverified evidence template: '+evidencePath);process.exit(0);
}
const failures=[];
const tests=fs.readdirSync(path.join(root,'tests')).filter(n=>n.endsWith('.test.cjs')).sort().map(n=>'tests/'+n);
const run=spawnSync(process.execPath,['--test',...tests],{cwd:root,encoding:'utf8'});
process.stdout.write(run.stdout||'');process.stderr.write(run.stderr||'');
if(run.status!==0)failures.push('Automated regression tests failed.');
for(const file of fs.readdirSync(root).filter(n=>n.endsWith('.js'))){
 const check=spawnSync(process.execPath,['--check',file],{cwd:root,encoding:'utf8'});
 if(check.status!==0)failures.push('Syntax check: '+file+' '+check.stderr);
}
for(const file of ['editor.html','popup.html','settings.html']){
 const html=fs.readFileSync(path.join(root,file),'utf8');
 const versions=[...html.matchAll(/(?:PostCard v|Version |<span>v)(\d+\.\d+\.\d+)/g)].map(m=>m[1]);
 if(!versions.length||versions.some(v=>v!==manifest.version))failures.push(file+': static version differs from manifest.');
}
const ids=new Set();
for(const c of catalog.cases){
 if(ids.has(c.id)||!c.title||!c.procedure||!c.expected)failures.push('Invalid/duplicate checklist case: '+c.id);
 ids.add(c.id);
 for(const testFile of c.automatedTests)if(!tests.includes(testFile))failures.push(c.id+': missing mapped test '+testFile);
}
// These controls/assets represent recovered features; check their shipped entry points too.
for(const file of ['editor.html','slides.html','recorder.html','settings.html']){
 const html=fs.readFileSync(path.join(root,file),'utf8');
 for(const m of html.matchAll(/<script[^>]*src="([^"]+)"/g))if(!fs.existsSync(path.join(root,m[1])))failures.push('Missing script: '+m[1]);
}
for(const file of ['motion-tools.js','editor-motion.js','image-objects.js','object-layers.js','background-processor.js','vendor/mediapipe/selfie_multiclass_256x256.tflite','vendor/mediapipe/wasm/vision_wasm_internal.wasm']){
 if(!fs.existsSync(path.join(root,file))||fs.statSync(path.join(root,file)).size===0)failures.push('Missing/empty preserved asset: '+file);
}
let evidence=null;
if(fs.existsSync(evidencePath))try{evidence=JSON.parse(fs.readFileSync(evidencePath,'utf8'))}catch{failures.push('Evidence JSON is invalid.')}
const packagePath=value('--package');
const packageHash=packagePath&&fs.existsSync(path.resolve(root,packagePath))?crypto.createHash('sha256').update(fs.readFileSync(path.resolve(root,packagePath))).digest('hex'):null;
if(packagePath){
 const zipCheck=spawnSync('python3',[path.join(root,'scripts/verify-package.py'),path.resolve(root,packagePath)],{encoding:'utf8'});
 if(zipCheck.status!==0)failures.push('Candidate ZIP verification failed: '+(zipCheck.stdout||zipCheck.error?.message||zipCheck.stderr));
}
const blockers=validateEvidence(catalog,evidence,fingerprint,manifest.version,packageHash);
const status=failures.length?'FAILED':blockers.length?'BLOCKED':'READY';
const coverage=catalog.cases.filter(c=>c.automatedTests.length).length;
const summary={status,version:manifest.version,sourceFingerprint:fingerprint,automatedChecks:failures.length?'failed':'passed',caseCount:catalog.cases.length,partialAutomationCount:coverage,manualEvidence:!!evidence,failures,blockers,checkedAt:new Date().toISOString()};
if(args.includes('--report')){
 const dir=path.join(root,'.qa');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'status.json'),JSON.stringify(summary,null,2)+'\n');
 fs.writeFileSync(path.join(root,'docs/RELEASE-STATUS.md'),`# PostCard release status\n\n**${status}${status==='READY'?' — recorded release checks passed.':' — no new release approved.'}**\n\n- Source fingerprint: \`${fingerprint}\`\n- Source manifest version: ${manifest.version} (development changes; no new ZIP issued).\n- Automated checks: ${summary.automatedChecks}.\n- Checklist: ${catalog.cases.length} cases; ${coverage} have partial automated coverage.\n- Chrome/UI/media verification: ${evidence?'see evidence results':'not tested on this candidate'}.\n\n## Blocking findings\n\n${[...failures,...blockers].map(x=>'- '+x).join('\n')||'None.'}\n\n## Current defect work\n\nDuplicate editor window creation is repaired in source with API-level regression tests. This is not yet a verified Chrome fix. Existing extra windows are not automatically closed, to preserve drafts. No claim is made that this repairs every blank-window path. Recorder round trips and context-menu behavior require the explicit browser checks in the checklist.\n\nLive browser access previously rejected the local preview with ERR_BLOCKED_BY_CLIENT. No rendered Chrome, microphone, camera or MP4 playback evidence is available for this candidate.\n`);
}
const escape=s=>s.replaceAll('|','\\|').replaceAll('\n',' ');
const rows=catalog.cases.map(c=>`| ${c.id} | ${escape(c.title)} | ${escape(c.procedure)} | ${escape(c.expected)} | ${c.automatedTests.length?'Partial: '+c.automatedTests.map(f=>'`'+f+'`').join(', '):'None yet'} | ${escape(evidence?.sourceFingerprint===fingerprint?(evidence.results?.find(r=>r.id===c.id)?.status||'not-tested').toUpperCase():'NOT TESTED')} |`);
fs.writeFileSync(path.join(root,'docs/REGRESSION-CHECKLIST.md'),`# PostCard feature and regression checklist\n\nEvery row is required before distributing a new version. A passing unit/API test is partial coverage, not a verified browser feature. Results must be PASS, FAIL, BLOCKED or NOT TESTED; the last three block release.\n\nThere are **${catalog.cases.length} cases**, including previous regressions. The canonical editable inventory is [catalog.json](qa/catalog.json). Run \`node scripts/release-check.cjs --report\` to regenerate this list and the status report.\n\n## Test setup\n\nUse a disposable Chrome profile with the candidate extension. Record OS, Chrome version, extension version, source fingerprint and candidate ZIP SHA-256. Use two slides with distinct text, a pasted screenshot, a table, a multi-frame GIF, rotated text, two narration recordings and an MP3 longer than the slide. Keep one editor and one supported social draft open. Test both a clean profile and an upgrade with existing saved content.\n\nRecord each result with tester, date and specific evidence (screenshot, video playback/duration result, console log, or precise observed steps). Use mocked providers/social adapters for posting tests; do not send real posts or incur API charges without explicit authorization.\n\n## Feature checks\n\n| ID | Feature | Repeatable check | Required result | Automated coverage | Chrome result |\n|---|---|---|---|---|---|\n${rows.join('\n')}\n\n## Permanent bug register\n\n${catalog.cases.filter(c=>c.regression).map(c=>'- **'+c.id+'** — '+c.regression).join('\n')}\n\n## Release commands\n\n1. Run \`node scripts/release-check.cjs --automated\` during development. This never means a release is approved.\n2. Run \`node scripts/release-check.cjs --init-evidence\` once for a new candidate. Preserve old evidence when creating a new candidate.\n3. Complete every case against that source and the exact candidate ZIP; fill \`docs/qa/evidence.json\`. An agent must never invent browser results.\n4. Run \`node scripts/release-check.cjs --release --evidence docs/qa/evidence.json --package /absolute/path/candidate.zip --report\`. Exit 0 means all recorded gates passed; exit 1 means automatic checks failed; exit 2 means evidence/release checks are incomplete.\n5. Only after READY may the exact tested ZIP be presented as a new release. Any code change invalidates old evidence.\n\nSee [RELEASE-STATUS.md](RELEASE-STATUS.md) for the current candidate.\n`);
console.log('\n'+status+': '+catalog.cases.length+' feature cases; '+coverage+' with partial automated coverage.');
for(const message of [...failures,...blockers])console.log('- '+message);
console.log('Source fingerprint: '+fingerprint);
process.exit(failures.length?1:automatedOnly?0:blockers.length?2:0);
