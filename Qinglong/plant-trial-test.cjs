'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const core=require('./function/plant-trial'),sdk=require('./function/plant-signer');
const pin='offline-account',cookie='pt_key=OFFLINE_KEY;pt_pin='+pin+';';
function encode(env){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',map='rqponmlkjihgfedcbaZYXWVUTSRQPONMLKJIHGFEDCBA-_9876543210zyxwvuts';return [...Buffer.from(JSON.stringify(env)+'x').toString('base64').replace(/=+$/,'')].map(c=>map[alphabet.indexOf(c)]).reverse().join('');}
function profile(version='h5_file_v5.3.6'){
 const env={v:version,fp:'offline-old-fp',ai:'b63ff',pp:{p1:pin},extend:{bu6:33,bu13:'F3'},canvas:'a'.repeat(32),webglFp:'b'.repeat(32)};
 return {capturedAt:Date.now(),headers:{Cookie:cookie+'device=OFFLINE_DEVICE;','User-Agent':'jdapp;iPhone;16.0.70;;;M/5.0;appBuild/170070;Mozilla/5.0 (iPhone; CPU iPhone OS 27_0_1 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',Referer:'https://pro.m.jd.com/'},query:{capturedAt:Date.now(),referenceEnvironmentEncoded:encode(env),params:{client:'ios',clientVersion:'16.0.70','x-api-eid-token':'OFFLINE_EID'}}};
}
const fakeSign=()=>({h5st:'offline-signature',version:'h5_file_v5.3.6'});
function config(p=profile()){return {LAZING_JD_ACTIVITY_V1:JSON.stringify({version:1,pin,activities:{scratch:p}})};}
const parent=fs.mkdtempSync(path.join(os.tmpdir(),'plant-trial-tests-'));let count=0;
async function check(name,fn){process.exitCode=0;try{await fn();count++;console.log('OK '+name);}finally{process.exitCode=0;}}
function rig(responder,extra={}){const calls=[],logs=[],dir=fs.mkdtempSync(path.join(parent,'case-'));const a=core.create({env:config(),dataDir:dir,noExitHook:true,sign:fakeSign,log:s=>logs.push(s),transport:async o=>{calls.push(o);return responder?responder(o,calls.length):{status:200,body:'{"success":true,"data":[]}'};},...extra});return {a,calls,logs,dir};}
const context={cookie,linkId:'offline-link'};
(async()=>{
 await check('Both audited SDK revisions sign all four task appIds with the captured phone context',async()=>{

  for(const version of ['h5_file_v5.3.5','h5_file_v5.3.6'])for(const [functionId,appId]of Object.entries({apStartTaskTime:'acb1e',apDoLimitTimeTask:'ebecc',apsDoTask:'54ed7',apTaskDrawAward:'f0f3f'})){
   const params={appid:functionId==='apStartTaskTime'?'activity_platform_se':'activities_platform',functionId,body:'{"linkId":"offline-link"}',t:String(Date.now()),client:'ios',clientVersion:'16.0.70'};
   const signed=sdk.sign(params,appId,profile(version),pin),parts=signed.h5st.split(';'),env=sdk.environment({...profile(version),query:{referenceEnvironmentEncoded:parts[7]}},pin);
   assert.equal(parts[2],appId);assert.equal(parts[5],'5.3');assert.equal(env.v,version);assert.equal(env.pp.p1,pin);assert.equal(env.ai,appId);assert.equal(env.fp,parts[1]);assert.equal(env.canvas,'a'.repeat(32));
  }
 });
 await check('Fresh signature changes with the request body, rather than replaying an old h5st',async()=>{const p={appid:'activities_platform',functionId:'apStartTaskTime',body:'{"itemId":"A"}',t:String(Date.now()),client:'ios',clientVersion:'16.0.70'};assert.notEqual(sdk.sign(p,'acb1e',profile(),pin).h5st,sdk.sign({...p,body:'{"itemId":"B"}'},'acb1e',profile(),pin).h5st);});
 await check('Query precedes task submission, then start and completion use HTTPS and matching phone headers',async()=>{
  const r=rig();try{
   assert(await r.a.request('apTaskList',[0],context));assert(await r.a.request('apStartTaskTime',['task','item',{}],context));assert(await r.a.request('apDoLimitTimeTask',[],context));
   assert.equal(r.calls.length,3);const o=r.calls[1],p=new URLSearchParams(o.body);
   assert.equal(o.url,'https://api.m.jd.com/api?functionId=apStartTaskTime');assert.equal(p.get('h5st'),'offline-signature');assert.equal(p.get('x-api-eid-token'),'OFFLINE_EID');assert.equal(p.get('client'),'ios');assert.equal(o.headers['User-Agent'],profile().headers['User-Agent']);assert(o.headers.Cookie.includes('OFFLINE_DEVICE'));assert.equal(p.get('appid'),'activity_platform_se');assert.equal(new URLSearchParams(r.calls[0].body).get('appid'),'activities_platform');assert.equal(new URLSearchParams(r.calls[2].body).get('appid'),'activities_platform');
   const state=JSON.parse(fs.readFileSync(path.join(r.dir,fs.readdirSync(r.dir)[0],'plant-trial/state.json')));assert.equal(state.pending,undefined);
   const logs=r.logs.join('\n');for(const secret of ['OFFLINE_KEY','OFFLINE_DEVICE','OFFLINE_EID',pin,'offline-signature'])assert(!logs.includes(secret));
  }finally{r.a.close();}
 });
 await check('Start routing appid is signed before submission and does not leak into other task interfaces',async()=>{
  const signed=[];const r=rig(null,{sign:(params,appId)=>{signed.push({functionId:params.functionId,appid:params.appid,appId});return fakeSign();}});
  try{
   await r.a.request('apTaskList',[],context);
   await r.a.request('apStartTaskTime',['t','i',{}],context);
   await r.a.request('apDoLimitTimeTask',[],context);
   await r.a.request('apsDoTask',['BROWSE_CHANNEL','t',{}],context);
   await r.a.request('apTaskDrawAward',['BROWSE_CHANNEL','t',{}],context);
   assert.deepEqual(signed,[{functionId:'apStartTaskTime',appid:'activity_platform_se',appId:'acb1e'},{functionId:'apDoLimitTimeTask',appid:'activities_platform',appId:'ebecc'},{functionId:'apsDoTask',appid:'activities_platform',appId:'54ed7'},{functionId:'apTaskDrawAward',appid:'activities_platform',appId:'f0f3f'}]);
   assert(r.logs.some(s=>s.includes('\"requestAppid\":\"activity_platform_se\"')));
  }finally{r.a.close();}
 });
 await check('Task mutations cannot precede the task list query',async()=>{const r=rig();try{await r.a.request('apStartTaskTime',['t','i',{}],context);assert.equal(r.calls.length,0);}finally{r.a.close();}});
 await check('A completed timer cannot be claimed without a successful start',async()=>{const r=rig();try{await r.a.request('apTaskList',[],context);await r.a.request('apDoLimitTimeTask',[],context);assert.equal(r.calls.length,1);}finally{r.a.close();}});
 await check('HTTP403 stops all subsequent task requests without changing signature paths or retrying',async()=>{const r=rig((o,n)=>n===1?{status:200,body:'{"success":true,"data":[]}'}:{status:403,body:'<html>denied</html>'});try{await r.a.request('apTaskList',[],context);await r.a.request('apStartTaskTime',['t','i',{}],context);await r.a.request('apTaskDrawAward',['BROWSE_CHANNEL','t',{}],context);assert.equal(r.calls.length,2);assert(r.logs.some(s=>s.includes('http_rejected')));assert(r.logs.some(s=>s.includes('apStartTaskTime')));}finally{r.a.close();}});
 await check('Network ambiguity is persisted across process runs and blocks another submission',async()=>{const r=rig((o,n)=>{if(n===2)throw Error('OFFLINE_KEY');return {status:200,body:'{"success":true,"data":[]}'};});await r.a.request('apTaskList',[],context);await r.a.request('apStartTaskTime',['t','i',{}],context);r.a.close();let sent=0;const second=core.create({env:config(),dataDir:r.dir,noExitHook:true,sign:fakeSign,log:()=>{},transport:async()=>{sent++;}});try{await second.request('apTaskList',[],context);assert.equal(sent,0);assert(!r.logs.join('').includes('OFFLINE_KEY'));}finally{second.close();}});
 await check('HTTP500 and non-JSON responses retain pending submissions',async()=>{for(const response of [{status:500,body:''},{status:200,body:'bad'}]){const r=rig((o,n)=>n===1?{status:200,body:'{"success":true,"data":[]}'}:response);try{await r.a.request('apTaskList',[],context);await r.a.request('apStartTaskTime',['t','i',{}],context);const state=JSON.parse(fs.readFileSync(path.join(r.dir,fs.readdirSync(r.dir)[0],'plant-trial/state.json')));assert.equal(state.pending.functionId,'apStartTaskTime');}finally{r.a.close();}}});
 await check('Same account cannot run two trial processes concurrently',async()=>{const r=rig();await r.a.request('apTaskList',[],context);const other=core.create({env:config(),dataDir:r.dir,noExitHook:true,sign:fakeSign,log:()=>{},transport:async()=>{throw Error('must not send');}});try{assert.equal(await other.request('apTaskList',[],context),undefined);}finally{other.close();r.a.close();}});
 await check('Mismatched and missing phone environments stop before any task request',async()=>{assert.throws(()=>core.create({env:{},noExitHook:true}));const p=profile();p.headers.Cookie='pt_key=OTHER;pt_pin=other;';assert.throws(()=>core.create({env:config(p),noExitHook:true}));});
 await check('HTTP business rejection stops later task submissions',async()=>{const r=rig(()=>({status:200,body:'{"success":false,"errCode":"F10002","errMsg":"OFFLINE_KEY"}'}));try{await r.a.request('apTaskList',[],context);await r.a.request('apStartTaskTime',['t','i',{}],context);assert.equal(r.calls.length,1);assert(!r.logs.join('').includes('OFFLINE_KEY'));}finally{r.a.close();}});
 await check('Unrelated签到 interfaces are excluded from the adapter',async()=>{const r=rig();try{for(const id of ['weGameHome','weGameLottery','plantBeanIndex','bff_marketing_interaction'])assert.equal(r.a.handles(id),false);}finally{r.a.close();}});
 await check('Unknown upstream versions cannot be patched silently',async()=>{assert.throws(()=>core.patch('unknown source','adapter-path'),/版本/);});
 await check('Native transport blocks credential forwarding outside the exact task API',async()=>{await assert.rejects(core.transport({url:'https://example.com/api',body:'',headers:{Cookie:cookie}}));await assert.rejects(core.transport({url:'http://api.m.jd.com/api',body:'',headers:{Cookie:cookie}}));});
 if(process.env.FAKER_PLANT_SOURCE){await check('Pinned upstream injection is parseable, affects one dispatcher and preserves the complete original file on disk',async()=>{const file=process.env.FAKER_PLANT_SOURCE,source=fs.readFileSync(file,'utf8'),patched=core.patch(source,path.join(__dirname,'function/plant-trial.js'));assert.equal(fs.readFileSync(file,'utf8'),source);assert.equal(patched.split('if(__lazingPlantAdapter.handles').length,2);assert(patched.includes('process.exit(process.exitCode||0)'));assert(!patched.includes('$["outFlag"]=true;return;}return await _kerw_'));new vm.Script('(function(require,module,exports,__filename,__dirname){'+patched+'\n})');});}
 if(process.env.FAKER_PLANT_SOURCE){
  const source=fs.readFileSync(process.env.FAKER_PLANT_SOURCE,'utf8');
  const exact=source.replace(/\n+$/,'')+'\n';
  await check('Byte-exact official Git blob is accepted, including the previous false-rejection regression',async()=>{
   const crypto=require('node:crypto'),b=Buffer.from(exact);
   assert.equal(crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex'),'bf4ca209095e54bdffa22ec8774e943022f4632c');
   assert(core.patch(exact,'adapter-path').includes('if(__lazingPlantAdapter.handles'));
  });
  await check('BOM, CRLF, missing final newline and extra file-end whitespace produce the same patched code',async()=>{
   const expected=core.patch(exact,'adapter-path');
   for(const variant of [exact.replace(/\n/g,'\r\n'),'\uFEFF'+exact,exact+'\n\n \t\r\n',exact.replace(/\n+$/,'')]){
    assert.equal(core.patch(variant,'adapter-path'),expected);
   }
  });
  await check('Real source changes are still rejected after whitespace normalization',async()=>{
   assert.throws(()=>core.patch(exact.replace('种豆得豆任务','种豆得豆任务已更改'),'adapter-path'),/校验摘要/);
   assert.throws(()=>core.patch(exact+'\n// changed implementation','adapter-path'),/版本/);
  });
 }
 console.log('Passed '+count+' offline checks. No upstream code was executed; no account requests were sent.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>fs.rmSync(parent,{recursive:true,force:true}));
