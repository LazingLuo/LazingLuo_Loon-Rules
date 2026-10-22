// Exact release bundles; synthetic credentials and simulated HTTP only.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=__dirname,release=fs.existsSync(path.join(root,'jd-farm-tasks.js'));
const mainPath=path.join(root,release?'jd-farm-tasks.js':'../Scripts/jd-farm-tasks.js');
const capturePath=path.join(root,release?'jd-farm-tasks-capture.js':'../Scripts/jd-farm-tasks-capture.js');
const {farmTools,createFarmTaskClient,createFarmCrypto,farmReportText}=require(mainPath);
const {farmCapture,farmDecodeEnvironment}=require(capturePath),T=farmTools(),clone=o=>JSON.parse(JSON.stringify(o));
const encode=o=>{const n='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',m='rqponmlkjihgfedcbaZYXWVUTSRQPONMLKJIHGFEDCBA-_9876543210zyxwvuts';return [...Buffer.from(JSON.stringify(o)+'x').toString('base64').replace(/=+$/,'')].map(c=>m[n.indexOf(c)]).reverse().join('');};
const env=(v='h5_file_v5.3.6')=>({v,fp:'offline-reference',pp:{p1:'offline'},extend:{bu6:33,bu13:'F3'},canvas:'a'.repeat(32),webglFp:'b'.repeat(32),sua:'iPhone',pf:'iPhone',ccn:4});
const fakeSig=(app,v)=>['20261022120000000','offline-reference',app,'FAKE_TOKEN','HASH','5.3','1',encode(env(v)),'HASH','qbkgHGHQ8GlOIyVOF6JQ8G1P5WFW3yVSC61T-bEQGGlQI6ZNHuFT-bVR7qUT'].join(';');
const queryBody=scope=>({linkId:scope==='farm'?T.FARM:T.WHEEL,...scope==='farm'?{queryType:0,channel:4,area:'OFFLINE_AREA'}:{}});
function captureRequest(scope,fn,body,v){
 const ref=scope==='farm'?'https://pro.m.jd.com/mall/active/42HV4J3Q87B2xFQMJk81PCc1mEs3/index.html':'https://lotterydraw-new.jd.com/';
 const p={appid:fn==='farm_home'?'signed_wh5':fn==='apStartTaskTime'?'activity_platform_se':'activities_platform',client:'ios',clientVersion:'16.1.50',functionId:fn,body:JSON.stringify(body),'x-api-eid-token':'FAKE_PRIVATE_EID',uuid:'FAKE_PRIVATE_UUID',t:'123'};
 if(T.APPS[fn])p.h5st=fakeSig(T.APPS[fn],v);
 return {method:'POST',url:'https://api.m.jd.com/'+(fn==='farm_home'||fn==='apTaskListBatch'?'client.action':'api')+'?',headers:{Cookie:'pt_pin=offline; pt_key=FAKE_PRIVATE_COOKIE;','User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',Referer:ref},body:T.encode(p)};
}
function account(v){const store=new Map(),host={read:(k,f)=>store.has(k)?clone(store.get(k)):f,write:(k,o)=>store.set(k,clone(o)),now:()=>100};
 for(const [scope,fn,b,d] of [
  ['farm','farm_home',{version:30,channelParam:'1',babelChannel:'ttt6'},{bizCode:0,result:{bottleWater:900,treeFullStage:4}}],
  ['farm','apTaskList',queryBody('farm'),[]],
  ['farm','apTaskListBatch',{version:30,channelParam:'1',linkId:T.FARM,modules:[{elementId:'offline-module',taskStyle:5}]},{modules:[]}],
  ['wheel','wheelsHome',{linkId:T.WHEEL},{lotteryChances:2}],
  ['wheel','apTaskList',queryBody('wheel'),[]]]){
  farmCapture(host,captureRequest(scope,fn,b,v),{status:200,body:JSON.stringify({code:0,success:true,data:d})},farmDecodeEnvironment);
 }
 return {store,host,profile:store.get(T.ACCOUNT)};
}
function task(id,type='BROWSE_CHANNEL',more={}){return {id:-9999,taskShowTitle:'浏览 '+id,taskType:type,pipeExt:{assignmentId:'assignment-'+id,taskType:type},taskDoTimes:0,taskLimitTimes:1,taskFinished:false,canDrawAwardNum:0,timeLimitSwitch:2,timeLimitPeriod:6,taskItemList:[{itemId:'https://pro.m.jd.com/mall/active/offline/index.html',itemType:'1',pipeExt:{itemId:'offline-item-'+id},taskInsert:false}],...more};}
async function simulate(options={}){
 const store=options.store||new Map(),calls=[],waits=[],notes=[],profile=options.profile===undefined?account(options.sdk).profile:options.profile;
 let current=clone(options.tasks||[task('a'),task('b','CUMULATIVE_TIMES',{taskLimitTimes:20,taskItemList:null}),task('c','ORDER_MARK',{taskItemList:null})]),extra=clone(options.extra||[]),clock=100000,water=900,chances=options.chances??2,timer=null,afterAward=false;
 const host={read:(k,f)=>store.has(k)?clone(store.get(k)):f,write:(k,v)=>{if(options.failWrite?.(k))throw Error('农场本地记录保存失败');store.set(k,clone(v));},now:()=>clock,day:()=>options.crossDay&&waits.length?'2026-10-23':'2026-10-22',guard:()=>{if(options.changed&&waits.length)throw Error('农场凭据已更新，请重新运行');},setTimeout:(...a)=>setTimeout(...a),clearTimeout,progress:s=>notes.push(s),sleep:async ms=>{clock+=ms;waits.push(ms);},
  request:async o=>{
   const p=T.form(o.body),b=JSON.parse(p.body),fn=p.functionId;calls.push({o,p,b});
   assert(T.ALLOWED.has(fn));assert(!fn.includes('water'));assert(!('pay'in b));
   if(T.APPS[fn]){const parts=p.h5st.split(';');assert.equal(parts.length,10);assert.equal(parts[2],T.APPS[fn]);assert.equal(parts[5],'5.3');}
   if(options.onRequest){const response=options.onRequest({fn,b,p,current,extra,calls,store});if(response)return response;}
   let d,code=0;
   if(fn==='apTaskList')d=options.missingAfterAward&&afterAward?[]:current;
   else if(fn==='apTaskListBatch')d={modules:[{code:0,elementId:'offline-module',tasks:extra}]};
   else if(fn==='farm_home')d={bizCode:0,result:{bottleWater:water,treeFullStage:4}};
   else if(fn==='wheelsHome')d={lotteryChances:chances,payLotteryFlag:!!options.paid};
   else if(fn==='apTaskDetail')d={taskItemList:[{itemId:'https://item.jd.com/100000.html',itemType:'3'}]};
   else if(fn==='wheelsLottery'){chances--;d={lotteryChances:chances,prizeName:'5g水滴'};}
   else{
    const t=[...current,...extra].find(t=>b.pipeExt?.assignmentId?t.pipeExt?.assignmentId===b.pipeExt.assignmentId:Number(t.id)===b.taskId);
    if(fn==='apStartTaskTime'){assert(t);timer=t;d={jumpUrl:'openapp.jdmobile://virtual?params='+JSON.stringify({second:6})};}
    if(fn==='apDoLimitTimeTask'){assert(timer);assert(waits.length);if(!options.noProgress){timer.taskDoTimes++;timer.taskFinished=timer.taskDoTimes>=timer.taskLimitTimes;timer.canDrawAwardNum=1;}d={finished:!options.noProgress};timer=null;}
    if(fn==='apsDoTask'){assert(t);if(!options.noProgress){t.taskDoTimes++;t.taskFinished=t.taskDoTimes>=t.taskLimitTimes;if(options.scope!=='wheel')t.canDrawAwardNum=1;}d={finished:true,alreadyGranted:options.scope==='wheel'};}
    if(fn==='apTaskDrawAward'){assert(t);assert(t.canDrawAwardNum>0);if(!options.unconfirmedClaim)t.canDrawAwardNum=0;water+=10;afterAward=true;d=[{awardName:'WATER',awardGivenNumber:'10'}];}
   }
   return {status:200,body:JSON.stringify({code,success:true,data:clone(d)})};
  }};
 const crypto=options.realSDK?createFarmCrypto(host):{hash:s=>require('crypto').createHash('sha256').update(s).digest('hex'),decodeEnvironment:farmDecodeEnvironment,sign:app=>fakeSig(app,options.sdk)};
 const client=createFarmTaskClient(host,crypto,profile,options.login);
 const result=await client.run(options.scope||'farm',options.mode||'all');
 const text=JSON.stringify(result)+JSON.stringify(notes)+farmReportText(result);
 for(const s of ['FAKE_PRIVATE_COOKIE','FAKE_PRIVATE_EID','FAKE_PRIVATE_UUID','OFFLINE_AREA','assignment-'])assert(!text.includes(s),'private data in result');
 return {result,calls,store,notes,waits,current,extra};
}
(async()=>{
 let n=0,r;
 for(const sdk of ['h5_file_v5.3.5','h5_file_v5.3.6']){r=await simulate({realSDK:true,sdk});assert.equal(r.result.stopped,false);assert.equal(r.result.waterConfirmed,10);assert.equal(r.result.rows[1].result,'手动浇水，保留水滴');assert.equal(r.result.waterAfter,910);n++;}
 r=await simulate({mode:'query',tasks:[task('a'),task('b')],extra:[task('b'),task('c','NEW_TYPE')]});assert.equal(r.result.initial.length,3);assert(!r.calls.some(c=>T.MUTATE.has(c.p.functionId)));n++;
 r=await simulate({tasks:[task('a'),task('b')]});assert.equal(r.result.waterConfirmed,20);assert.equal(r.calls.filter(c=>c.p.functionId==='apTaskDrawAward').length,2);n++;
 r=await simulate({tasks:[task('a')],extra:[task('b')]});assert.equal(r.result.waterConfirmed,20);n++;
 r=await simulate({tasks:[task('a','BROWSE_RTB',{taskLimitTimes:3})]});assert.equal(r.result.waterConfirmed,30);assert.equal(r.result.final[0].current,3);assert.equal(r.waits.length,3);n++;
 r=await simulate({tasks:[task('a','NEW_TYPE'),task('b','FOLLOW_CHANNEL'),task('c','SUBSCRIBE'),task('d','ADD_WIDGET'),task('e','WECHAT_SHARE')]});assert.equal(r.result.initial.length,5);assert(!r.calls.some(c=>T.MUTATE.has(c.p.functionId)));n++;
 r=await simulate({mode:'claim',tasks:[task('water','CUMULATIVE_TIMES',{taskDoTimes:20,taskLimitTimes:20,taskFinished:true,canDrawAwardNum:1}),task('a')]});assert.equal(r.result.waterConfirmed,10);assert.equal(r.waits.length,0);n++;
 r=await simulate({tasks:[task('a',{},{})],mode:'query'});assert(r.result.stopped);n++;
 const p=account().profile;delete p.scopes.farm.templates.apTaskListBatch;r=await simulate({profile:p});assert(r.result.stopped);assert.equal(r.calls.length,0);n++;
 r=await simulate({noProgress:true,tasks:[task('a')]});assert.equal(r.result.waterConfirmed,0);assert(r.result.rows[0].result.includes('待App确认'));n++;
 r=await simulate({unconfirmedClaim:true,tasks:[task('a')]});assert.equal(r.result.waterReceived,10);assert.equal(r.result.waterConfirmed,0);n++;
 r=await simulate({missingAfterAward:true,tasks:[task('a')]});assert.equal(r.result.waterConfirmed,0);n++;
 r=await simulate({changed:true,tasks:[task('a')]});assert(r.result.stopped);assert(!r.calls.some(c=>c.p.functionId==='apDoLimitTimeTask'));n++;
 r=await simulate({crossDay:true,tasks:[task('a')]});assert(r.result.stopped);n++;
 r=await simulate({login:{pin:'other',cookie:'pt_key=x;pt_pin=other;'}});assert(r.result.stopped);assert.equal(r.calls.length,0);n++;
 r=await simulate({login:{pin:'offline',cookie:'pt_key=UPDATED_PRIVATE;pt_pin=offline;',capturedAt:999}});assert.equal(T.cookie(r.calls[0].o.headers.Cookie,'pt_key'),'UPDATED_PRIVATE');n++;
 r=await simulate({scope:'wheel',tasks:[task('w','BROWSE_CHANNEL',{id:123,timeLimitSwitch:0,timeLimitPeriod:0,pipeExt:{assignmentId:'wheel-w'},taskItemList:null})],realSDK:true});assert.equal(r.result.stopped,false);assert.equal(r.result.draws.length,2);assert(!r.calls.some(c=>c.p.functionId==='apTaskDrawAward'));assert(!r.calls.find(c=>c.p.functionId==='apsDoTask').b.pipeExt);n++;
 r=await simulate({scope:'wheel',mode:'draw',paid:true});assert(r.result.stopped);assert(!r.calls.some(c=>c.p.functionId==='wheelsLottery'));n++;
 r=await simulate({scope:'wheel',mode:'draw',onRequest:({fn})=>fn==='wheelsHome'?{status:200,body:'{"code":0,"success":true,"data":{"lotteryChances":1}}'}:null});assert(r.result.stopped);assert(!r.calls.some(c=>c.p.functionId==='wheelsLottery'));n++;
 r=await simulate({scope:'wheel',mode:'draw',chances:0});assert.equal(r.result.draws.length,0);assert(!r.calls.some(c=>c.p.functionId==='wheelsLottery'));n++;
 r=await simulate({scope:'wheel',mode:'query'});assert(!r.calls.some(c=>T.MUTATE.has(c.p.functionId)));n++;
 r=await simulate({scope:'wheel',mode:'draw',onRequest:({fn})=>fn==='wheelsLottery'?{status:200,body:'{"code":0,"success":true,"data":{}}'}:null});assert(r.result.stopped);const again=await simulate({scope:'wheel',mode:'draw',store:r.store});assert(again.result.stopped);assert(!again.calls.some(c=>c.p.functionId==='wheelsLottery'));n++;
 r=await simulate({tasks:[task('a')],onRequest:({fn})=>fn==='apStartTaskTime'?{status:502,body:''}:null});assert(r.result.stopped);const retry=await simulate({store:r.store,tasks:[task('a')]});assert(!retry.calls.some(c=>c.p.functionId==='apStartTaskTime'));n++;
 r=await simulate({failWrite:k=>k.startsWith('actions.')});assert(r.result.stopped);assert(!r.calls.some(c=>T.MUTATE.has(c.p.functionId)));n++;
 r=await simulate({tasks:[task('a')],onRequest:({fn})=>fn==='apDoLimitTimeTask'?{status:200,body:'{"code":2031,"success":false,"errMsg":"PRIVATE_TOKEN"}'}:null});assert(!r.result.stopped);assert.equal(r.result.waterConfirmed,0);assert(!JSON.stringify(r.result).includes('PRIVATE_TOKEN'));n++;
 const cap=account();assert(cap.profile.scopes.farm.templates.apTaskListBatch);assert(cap.profile.scopes.wheel.templates.apTaskList);n++;
 const base=JSON.stringify(cap.profile),req=captureRequest('farm','apTaskList',queryBody('farm'));
 for(const mutation of [q=>q.headers.Referer='https://evil.example/',q=>q.headers.Cookie='pt_pin=other;pt_key=x;',q=>q.url='https://evil.example/api',q=>q.headers['X-Lazing-Farm-Run']='1',q=>q.body+='&functionId=apTaskList']){
  const q=clone(req);mutation(q);try{farmCapture(cap.host,q,{status:200,body:'{"code":0,"success":true,"data":[]}'},farmDecodeEnvironment);}catch(_){}assert.equal(JSON.stringify(cap.store.get(T.ACCOUNT)),base);n++;
 }
 const signed=captureRequest('farm','farm_home',{version:30,channelParam:'1'}),params=T.form(signed.body);params.h5st=fakeSig('wrong');signed.body=T.encode(params);assert.equal(farmCapture(cap.host,signed,{status:200,body:'{"code":0,"data":{"result":{"treeFullStage":4}}}'},farmDecodeEnvironment),null);n++;
 const first=new Map(),h={read:(k,f)=>first.get(k)||f,write:(k,v)=>first.set(k,v),now:()=>100};
 farmCapture(h,captureRequest('wheel','wheelsHome',{linkId:T.WHEEL,inviterEncryptPin:'SHOULD_REMOVE'}),{status:200,body:'{"code":0,"data":{"lotteryChances":1}}'},farmDecodeEnvironment);
 const ready=farmCapture(h,captureRequest('wheel','apTaskList',queryBody('wheel')),{status:200,body:'{"code":0,"data":[]}'},farmDecodeEnvironment);assert(ready.firstReady);assert(!JSON.stringify(first.get(T.ACCOUNT)).includes('SHOULD_REMOVE'));n++;
 const plugin=fs.readFileSync(path.join(root,release?'jd-farm-tasks.plugin':'../Plugins/jd-farm-tasks.plugin'),'utf8');assert.equal((plugin.match(/^generic /gm)||[]).length,7);assert(!/^cron /m.test(plugin));assert(!T.ALLOWED.has('farm_water'));assert(!T.ALLOWED.has('farm_one_key_plant_settle'));n++;
 // Loon entry: full exact bundle, no network allowed for status or missing profile.
 for(const mode of ['status','farm-query']){
  let done=false;const notes=[],writes=[];const context={console:{log:()=>{}},$argument:mode,$persistentStore:{read:()=>'',write:(v,k)=>{writes.push(k);return true;}},$notification:{post:(...a)=>notes.push(a)},$httpClient:{post:()=>{throw Error('unexpected network');}},$done:()=>{done=true;},setTimeout,clearTimeout};vm.runInNewContext(fs.readFileSync(mainPath,'utf8'),context,{timeout:15000});await new Promise(r=>setImmediate(r));assert(done);assert(notes.length);assert(writes.every(k=>k.startsWith(T.PREFIX)));n++;
 }
 // Full Loon entry with its real persistent-store lock and transport adapter.
 for(const mode of ['farm-query','farm-all','wheel-query','wheel-draw']){
  const store=new Map([[T.ACCOUNT,JSON.stringify(account().profile)],['QL_BRIDGE_CREDENTIAL_V1','']]),calls=[],timers=[],notes=[];let finish;
  const done=new Promise(r=>finish=r),context={console:{log:()=>{}},$argument:mode,setTimeout:(f,ms)=>{const t=setTimeout(f,ms);timers.push(t);return t;},clearTimeout,
   $persistentStore:{read:k=>store.get(k)||'',write:(v,k)=>{assert(k.startsWith(T.PREFIX));store.set(k,v);return true;}},$notification:{post:(...a)=>notes.push(a)},$done:()=>finish(),
   $httpClient:{post:(o,cb)=>{const p=T.form(o.body);calls.push(p.functionId);assert.equal(o['auto-redirect'],false);assert.equal(o['auto-cookie'],false);assert.equal(o.insecure,false);const d=p.functionId==='apTaskList'?[]:p.functionId==='apTaskListBatch'?{modules:[]}:p.functionId==='farm_home'?{bizCode:0,result:{bottleWater:800}}:{lotteryChances:0,payLotteryFlag:false};cb(null,{status:200},JSON.stringify({code:0,success:true,data:d}));}}};
  vm.runInNewContext(fs.readFileSync(mainPath,'utf8'),context,{timeout:15000});await done;timers.forEach(clearTimeout);
  const result=JSON.parse(store.get(T.PREFIX+'last'));assert.equal(result.stopped,false);assert.equal(store.get(T.PREFIX+'lock'),'');assert(calls.length>=3);assert(notes.length);assert(!JSON.stringify(result).includes('PRIVATE'));n++;
 }
 console.log(n+' offline checks passed: current lists/modules, duplicate -9999 identities, timed tasks, repeat rounds, claims, free draws, no watering/payment, capture and both official SDKs. No live requests.');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
