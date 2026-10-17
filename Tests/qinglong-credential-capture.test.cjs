// Offline integration tests. No JD/NAS calls; optional HAR stays on disk, never published.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const local=fs.existsSync(path.join(__dirname,'qinglong-credential-capture.js'));
const source=fs.readFileSync(local?path.join(__dirname,'qinglong-credential-capture.js'):path.join(__dirname,'../Scripts/qinglong-credential-capture.js'),'utf8');
const plugin=fs.readFileSync(local?path.join(__dirname,'qinglong-bridge.plugin'):path.join(__dirname,'../Plugins/qinglong-bridge.plugin'),'utf8');
const JD='JD_CHECKIN_TEST_ACCOUNT_V1',JX='JXZY_CHECKIN_ACCOUNT_V1',JR='JD_JR_CHECKIN_ACCOUNT_V1',LAST='QL_BRIDGE_CAPTURE_LAST_V1',LOGIN='QL_BRIDGE_CREDENTIAL_V1';
const today=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
const headers={Cookie:'pt_key=TEST_KEY;pt_pin=TEST_PIN;page_cookie=TEST_PAGE;', 'User-Agent':'offline iPhone',Referer:'https://pro.m.jd.com/'};
const form=p=>Object.entries(p).map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&');
const cashContext={site:'JD_JR_APP',channelSource:'JRAPP6.0',channelLv:'shouyedou',signVersion:12,clientVersion:'8.2.80',clientType:'ios'};
const ok=data=>({resultCode:0,success:true,resultData:{resBusiCode:0,resBusiData:data}});
const task={assignmentType:5,encryptAssignmentId:'TEST_TASK',ext:{taskType:'beanDailySign'}};
const h5=(app,env='TEST_ENV')=>['date','fp',app,'TEST_TOKEN','hash','5.3','time',env,'hash','encoding'].join(';');
function jdRequest(mode){
 const id={daily:'findBeanSceneNew',scratch:'bff_rightsCenter_jdInteractTask',blindbox:'bff_marketing_interaction'}[mode];
 const body=mode==='scratch'?{scene:'jdInteractTask',taskType:'beanDailySign_beanDailyPlus'}:mode==='blindbox'?{scene:'blindBox',touchPoint:'plusIndexHistory'}:{};
 const p={functionId:id,appid:mode==='daily'?'signed_wh5_ihub':'plus_business',body:JSON.stringify(body),h5st:h5({daily:'ed9a2',scratch:'b63ff',blindbox:'35fa0'}[mode])};
 const response=mode==='daily'?{code:'0',data:{signComponentInfoResult:[task]}}:mode==='scratch'?{code:'1711000',msg:'成功',rs:{beanTask:{taskList:[task]}}}:{code:'1711000',msg:'成功',rs:{sendBenefitList:[]}};
 return {request:{method:'POST',url:'https://api.m.jd.com/api?functionId='+id,headers,body:form(p)},response};
}
function cashRequest(endpoint,risk=false){return {request:{method:'POST',url:'https://ms.jr.jd.com/gw2/generic/jrSign/h5/m/'+endpoint,headers,body:form({reqData:JSON.stringify({...cashContext,...risk?{riskDeviceParam:'TEST_RISK'}:{}})})},response:ok(endpoint==='queryWeekSignMain'?{sign:false}:{access:true})};}
function doubleRequest(){return {request:{method:'POST',url:'https://ms.jr.jd.com/gw2/generic/legogw/h5/m/getPageInfoDoubleSignInForH5',headers,body:form({reqData:JSON.stringify({pageId:11046})})},response:{resultCode:0,success:true,resultData:{hasError:false,resultList:[{templateData:{data:{businessCode:'000sq',businessData:{dateTime:today()+' 10:00:00',signInJd:true,signInJr:true,get:false}}}}]}}};}
function jxRequest(kind){
 const page='2iqSwv1JiDHxAkHAikfU6XAECFmo';
 const body=kind==='environment'?{pageId:page,sceneval:2,buid:325,appCode:'offline'}:{source:'jxzy',craftId:'6824629a7c46584759d39b78',sceneval:2,buid:325,appCode:'offline'};
 body.time=Date.now();body.signStr=crypto.createHmac('md5','xtl_sqg_mall-^&*-damai_(789)_@#$').update(Object.keys(body).sort().map(k=>String(body[k])).join('&')).digest('hex');
 const fid=kind==='environment'?'jxzy_active_queryActive':'jxzy_active_querySign';
 const p={appid:'jx_h5_babel',channel:'jxh5',client:'jxh5',functionId:fid,body:JSON.stringify(body)};
 if(kind==='environment'){
  const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',custom='rqponmlkjihgfedcbaZYXWVUTSRQPONMLKJIHGFEDCBA-_9876543210zyxwvuts';
  const env={v:'h5_file_v5.3.6',fp:'TEST_FP',pp:{p1:'TEST_PIN'},extend:{}};
  const encoded=[...Buffer.from(JSON.stringify(env)+'x').toString('base64').replace(/=+$/,'')].map(c=>custom[chars.indexOf(c)]).reverse().join('');p.h5st=h5('832f1',encoded);
 }
 return {request:{method:'POST',url:'https://api.m.jd.com/api?functionId='+fid,headers:{...headers,Referer:'https://pro.m.jd.com/mall/active/'+page+'/index.html'},body:form(p)},response:{code:0,data:kind==='query'?{status:1,itemId:'1',alreadySignDays:0}:{}}};
}
async function run({request,response,config={capture:true,captureActivities:true},store={},status=200,now}={}){
 const logs=[],notices=[],writes=[];let done=0,network=0,resolve;const completed=new Promise(r=>resolve=r);
 const ctx={$argument:config,$persistentStore:{read:k=>store[k]||'',write:(v,k)=>(store[k]=v,writes.push(k),true)},console:{log:x=>logs.push(String(x))},$notification:{post:(...a)=>notices.push(a)},$done:()=>{done++;resolve();},$httpClient:Object.fromEntries(['get','post','put','delete'].map(k=>[k,()=>{network++;throw Error('Unexpected network');}]))};
 if(request){ctx.$request=request;ctx.$response={status,body:typeof response==='string'?response:JSON.stringify(response)};}
 if(now){const OriginalDate=Date;ctx.Date=class extends OriginalDate{constructor(...args){super(...args.length?args:[now]);}static now(){return now;}};}
 vm.runInNewContext(source,ctx,{timeout:3000});await completed;
 assert.equal(done,1);assert.equal(network,0);assert.equal(notices.length,0);
 for(const secret of ['TEST_KEY','TEST_TOKEN','TEST_RISK','TEST_PAGE','TEST_PIN'])assert(!logs.join('\n').includes(secret),'secret in log: '+secret);
 for(const key of writes)assert(!/ATTEMPT|LOCK|LAST_RESULT|JD_COOKIE|LAZING_JD_ACTIVITY/.test(key),'capture touched execution/upload state: '+key);
 return {store,logs,writes,result:JSON.parse(store[LAST]||'null')};
}
(async()=>{
 let checks=0;async function check(name,fn){await fn();checks++;console.log('PASS '+name);}
 await check('no request context cannot sign, upload or modify stores',async()=>{const r=await run();assert.equal(r.writes.length,0);});
 for(const mode of ['daily','scratch','blindbox'])await check('captures '+mode+' with original plugin disabled',async()=>{const r=await run(jdRequest(mode));assert(JSON.parse(r.store[JD]).modes[mode].query);assert(r.store[LOGIN]);assert.equal(r.result.status,'updated');});
 await check('daily-use cookie capture does not create activity profiles',async()=>{const r=await run({request:{method:'POST',url:'https://api.m.jd.com/client.action?functionId=logConfig',headers,body:''},response:{code:0}});assert(r.store[LOGIN]);assert(!r.store[JD]);});
 await check('body-only daily-use identifiers capture login on both JD paths without rewriting live requests',async()=>{
  for(const endpoint of ['api','client.action'])for(const query of ['', '?appid=wh5']){
   const request={method:'POST',url:'https://api.m.jd.com/'+endpoint+query,headers,body:form({functionId:'logConfig',body:'{}'})},before=JSON.stringify(request);
   const r=await run({request,response:{code:0}});
   assert(r.store[LOGIN]);assert(!r.store[JD]);assert.equal(r.result.functionIdSource,'body');assert.equal(r.result.version,'2026-10-17.3');assert.equal(JSON.stringify(request),before);
  }
 });
 await check('body-only activity identifiers capture all JD modes and Jingxi query/environment',async()=>{
  for(const sample of [jdRequest('daily'),jdRequest('scratch'),jdRequest('blindbox'),jxRequest('query'),jxRequest('environment')]){
   const before=sample.request.body;sample.request.url='https://api.m.jd.com/api?appid=wh5';
   const r=await run(sample);assert.equal(r.result.functionIdSource,'body');assert.equal(r.result.status,'updated');assert(r.store[JD]||r.store[JX]);assert.equal(sample.request.body,before);
  }
 });
 await check('URL-only and matching URL/body identifiers retain capture support',async()=>{
  let sample=jdRequest('scratch'),params=Object.fromEntries(new URLSearchParams(sample.request.body));delete params.functionId;sample.request.body=form(params);
  let r=await run(sample);assert(r.store[JD]);assert.equal(r.result.functionIdSource,'url');
  r=await run(jdRequest('scratch'));assert(r.store[JD]);assert.equal(r.result.functionIdSource,'url_and_body');
 });
 await check('conflicting, duplicate or malformed function identifiers cannot replace login or activity records',async()=>{
  for(const update of [
   sample=>{sample.request.url='https://api.m.jd.com/api?functionId=findBeanSceneNew';},
   sample=>{sample.request.body+='&functionId=bff_rightsCenter_jdInteractTask';},
   sample=>{sample.request.url+='&functionId=bff_rightsCenter_jdInteractTask';},
   sample=>{sample.request.body='functionId=%ZZ';}
  ]){
   const sample=jdRequest('scratch');update(sample);const r=await run(sample);
   assert(!r.store[LOGIN]);assert(!r.store[JD]);assert.equal(r.result.status,'ignored');
  }
 });
 await check('broad transport matching still rejects unrelated body interfaces and failed login responses',async()=>{
  for(const sample of [
   {request:{method:'POST',url:'https://api.m.jd.com/client.action',headers,body:form({functionId:'unrelatedPrivateInterface'})},response:{code:0}},
   {request:{method:'POST',url:'https://api.m.jd.com/client.action',headers,body:form({functionId:'logConfig'})},response:{code:1000}},
   {request:{method:'POST',url:'https://evil.example/api',headers,body:form({functionId:'logConfig'})},response:{code:0}}
  ]){const r=await run(sample);assert(!r.store[LOGIN]);assert(!r.store[JD]);}
 });
 await check('capture switches work independently',async()=>{
  let r=await run({...jdRequest('scratch'),config:{capture:false,captureActivities:true}});assert(r.store[JD]);assert(!r.store[LOGIN]);
  r=await run({...jdRequest('scratch'),config:{capture:true,captureActivities:false}});assert(!r.store[JD]);assert(r.store[LOGIN]);
  r=await run({...cashRequest('queryWeekSignMain'),config:{capture:true,captureActivities:false}});assert.equal(r.writes.length,0);
  r=await run({...jdRequest('daily'),config:{capture:false,captureActivities:false}});assert.equal(r.writes.length,0);
 });
 await check('financial query, device context and double page capture without AAR SDK',async()=>{
  const store={};let r=await run({...cashRequest('queryWeekSignMain'),store});assert.equal(JSON.parse(store[JR]).ready,false);
  r=await run({...cashRequest('queryCashSignSub',true),store});assert.equal(JSON.parse(store[JR]).ready,true);assert.equal(r.result.complete,true);
  await run({...doubleRequest(),store});assert(JSON.parse(store[JR]).doubleSign);assert(!store[LOGIN]);
 });
 await check('financial login remains separate from retail login',async()=>{
  const store={[LOGIN]:JSON.stringify({pin:'TEST_PIN',cookie:'pt_key=RETAIL_ONLY;pt_pin=TEST_PIN;',capturedAt:1})};
  await run({...cashRequest('queryWeekSignMain'),store});assert(JSON.parse(store[JR]).headers.Cookie.includes('TEST_KEY'));assert(JSON.parse(store[LOGIN]).cookie.includes('RETAIL_ONLY'));
 });
 await check('financial page scope change drops incompatible old device context',async()=>{
  const store={};await run({...cashRequest('queryWeekSignMain'),store});await run({...cashRequest('queryCashSignSub',true),store});
  const next=cashRequest('queryWeekSignMain');next.request.body=form({reqData:JSON.stringify({...cashContext,channelLv:'other'})});await run({...next,store});assert.equal(JSON.parse(store[JR]).ready,false);assert(!JSON.parse(store[JR]).riskDeviceParam);
 });
 await check('Jingxi first query plus signed environment captures a complete profile',async()=>{const store={};await run({...jxRequest('query'),store});const r=await run({...jxRequest('environment'),store});assert.equal(r.result.complete,true);assert(JSON.parse(store[JX]).signing);});
 await check('bound account mismatch preserves every activity',async()=>{
  for(const sample of [jdRequest('daily'),cashRequest('queryWeekSignMain'),jxRequest('query')]){
   const store={QL_BRIDGE_ACCOUNT_V1:JSON.stringify({pin:'OTHER_PIN'}),[JR]:'{"pin":"OTHER_PIN","ready":true}'};
   const original=store[JR];const r=await run({...sample,store});assert.equal(r.result.status,'account_mismatch');assert.equal(store[JR],original);assert(!store[JD]);assert(!store[JX]);assert(!store[LOGIN]);
  }
 });
 await check('invalid signatures cannot report an activity capture as successful',async()=>{
  const sample=jdRequest('scratch');const p=Object.fromEntries(new URLSearchParams(sample.request.body));p.h5st='invalid';sample.request.body=form(p);
  const r=await run(sample);assert(!r.store[JD]);assert.equal(r.result.status,'partial');assert.equal(r.result.activityStatus,'not_saved');
 });
 await check('failed HTTP, rejected login and unrelated endpoints never replace credentials',async()=>{
  let r=await run({...cashRequest('queryWeekSignMain'),response:{resultCode:3,success:false,resultMsg:'请先登录您的京东账号'}});assert(!r.store[JR]);
  r=await run({...jdRequest('daily'),status:403});assert.equal(r.writes.length,0);
  r=await run({...cashRequest('queryWeekSignMain'),request:{...cashRequest('queryWeekSignMain').request,url:'https://ms.jr.jd.com/other/queryWeekSignMain'}});assert.equal(r.writes.length,0);
 });
 await check('original submission guards and result records are preserved',async()=>{
  const store={JD_JR_CHECKIN_ATTEMPT_V1:'{"date":"2099-01-01"}',JD_JR_CHECKIN_LAST_RESULT_V1:'{"status":"previous"}'};const before={...store};await run({...cashRequest('queryWeekSignMain'),store});for(const k of Object.keys(before))assert.equal(store[k],before[k]);
 });
 await check('plugin routes requests once, adds financial MITM and retains four-hour sync',async()=>{
  assert(plugin.includes('hostname = api.m.jd.com, ms.jr.jd.com'));assert(plugin.includes('cron 0 */4 * * *'));
  const rules=plugin.split('\n').filter(x=>x.startsWith('response if '));assert.equal(rules.length,2);
  for(const sample of [jdRequest('daily'),jxRequest('query'),cashRequest('queryWeekSignMain'),doubleRequest(),
   {request:{url:'https://api.m.jd.com/client.action'}},{request:{url:'https://api.m.jd.com/api?appid=wh5'}}]){
   const matches=rules.filter(rule=>new RegExp(rule.split(' ~= /')[1].split('/ && ')[0]).test(sample.request.url));assert.equal(matches.length,1);
  }
 });
 await check('new capture stores feed existing activity sync without old plugins',async()=>{
  const store={};
  for(const sample of [jdRequest('daily'),jdRequest('scratch'),jdRequest('blindbox'),jxRequest('query'),jxRequest('environment'),cashRequest('queryWeekSignMain'),cashRequest('queryCashSignSub',true),doubleRequest()])await run({...sample,store});
  const bridge=fs.readFileSync(local?path.join(__dirname,'qinglong-bridge.js'):path.join(__dirname,'../Scripts/qinglong-bridge.js'),'utf8');
  const calls=[];let resolve;const done=new Promise(r=>resolve=r);
  const ctx={$argument:{qlUrl:'https://nas.example.test:8443',clientId:'TEST_ID',clientSecret:'TEST_SECRET',action:'同步活动凭据'},console:{log:()=>{}},$notification:{post:()=>{}},$persistentStore:{read:k=>store[k]||'',write:(v,k)=>(store[k]=v,true)},$done:resolve};
  ctx.$httpClient=Object.fromEntries(['get','put','post'].map(method=>[method,(options,cb)=>{
   calls.push({method,...options});assert(options.url.startsWith('https://nas.example.test:8443/open/'));
   cb(null,{status:200},JSON.stringify({code:200,data:options.url.includes('/auth/token')?{token:'TEST_AUTH'}:[]}));
  }]));
  vm.runInNewContext(bridge,ctx,{timeout:3000});await done;
  const uploads=calls.filter(x=>x.method==='post').map(x=>JSON.parse(x.body)[0]);
  assert(uploads.some(x=>x.name==='JD_COOKIE'));const pack=JSON.parse(uploads.find(x=>x.name==='LAZING_JD_ACTIVITY_V1').value);
  assert.deepEqual(Object.keys(pack.activities).sort(),['blindbox','finance','jxzy','scratch']);assert(pack.activities.finance.ready&&pack.activities.finance.doubleSign);assert(!calls.some(x=>x.url.includes('/crons')));
 });
 const arg=process.argv.indexOf('--har');
 if(arg>=0)await check('private HAR replay captures financial context without network or leaking it',async()=>{
  const data=JSON.parse(fs.readFileSync(process.argv[arg+1],'utf8'));const store={};let count=0;
  const decode=p=>p.encoding==='base64'?Buffer.from(p.text||'','base64').toString('utf8'):p.text||'';
  for(const e of data.log.entries.sort((a,b)=>Date.parse(a.startedDateTime)-Date.parse(b.startedDateTime))){
   if(!/\/jrSign\/h5\/m\/(?:queryWeekSignMain|queryCashSignSub)|\/legogw\/h5\/m\/getPageInfoDoubleSignInForH5/.test(e.request.url))continue;
   const headers={};for(const h of e.request.headers){const k=h.name.toLowerCase();headers[k]=k==='cookie'&&headers[k]?headers[k]+'; '+h.value:h.value;}
   const r=await run({store,now:Date.parse(e.startedDateTime),request:{method:e.request.method,url:e.request.url,headers,body:decode(e.request.postData||{})},response:decode(e.response.content),status:e.response.status});
   for(const field of headers.cookie.split(';')){const value=field.trim().split('=').slice(1).join('=');if(value.length>8)assert(!r.logs.join('\n').includes(value));}count++;
  }
  assert(count>0);const profile=JSON.parse(store[JR]);assert(profile.ready&&profile.doubleSign);console.log('Replayed '+count+' private financial requests; only safe summary printed.');
 });
 console.log(checks+' unified capture checks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
