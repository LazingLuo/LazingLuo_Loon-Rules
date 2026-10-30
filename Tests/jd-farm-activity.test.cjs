// Virtual wall time: keep real production waits out of offline tests.
function virtualClock(){let now=Date.now();class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}return {Date:Clock,setTimeout:(f,ms,...args)=>setTimeout(()=>{now+=ms;f(...args);},0),clearTimeout};}
// Current activity bundles; synthetic credentials and simulated HTTP only.
// Shared wheel-core regression cases do not expose or restore a wheel entry in the plugin.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=__dirname,release=fs.existsSync(path.join(root,'jd-farm-activity.js'));
const mainPath=path.join(root,release?'jd-farm-activity.js':'../Scripts/jd-farm-activity.js');
const capturePath=path.join(root,release?'jd-activity-capture.js':'../Scripts/jd-activity-capture.js');
const {farmTools,createFarmTaskClient,createFarmCrypto,farmReportText,farmResponseDiagnostic,farmDiagnosticText}=require(mainPath);
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
 const store=options.store||new Map(),calls=[],algoCalls=[],waits=[],pauses=[],notes=[],profile=options.profile===undefined?account(options.sdk).profile:options.profile;
 let current=clone(options.tasks||[task('a'),task('b','CUMULATIVE_TIMES',{taskLimitTimes:20,taskItemList:null}),task('c','ORDER_MARK',{taskItemList:null})]),extra=clone(options.extra||[]),clock=100000,water=900,chances=options.chances??2,timer=null,afterAward=false,signClaimed=options.sign?.state===3;
 const host={read:(k,f)=>store.has(k)?clone(store.get(k)):f,write:(k,v)=>{if(options.failWrite?.(k))throw Error('农场本地记录保存失败');store.set(k,clone(v));},random:()=>0.5,random:()=>0.5,random:()=>0.5,now:()=>clock,day:()=>options.crossDay&&waits.length?'2026-10-23':'2026-10-22',guard:()=>{if(options.changed&&waits.length)throw Error('农场凭据已更新，请重新运行');},setTimeout:(...a)=>setTimeout(...a),clearTimeout,progress:s=>notes.push(s),pause:async ms=>{clock+=ms;pauses.push(ms);},sleep:async ms=>{clock+=ms;(ms<=5000?pauses:waits).push(ms);},
  requestAlgo:async o=>{
   assert.equal(o.url,'https://cactus.jd.com/request_algo');assert(!Object.keys(o.headers).some(k=>k.toLowerCase()==='cookie'));assert(!JSON.stringify(o).includes('FAKE_PRIVATE_COOKIE'));assert(!JSON.stringify(o).includes('FAKE_PRIVATE_EID'));
   const b=JSON.parse(o.body);assert.equal(b.fp.length,16);assert(T.APPS&&Object.values(T.APPS).includes(b.appId));algoCalls.push(b.appId);
   if(options.failAlgo)return {status:403,body:'PRIVATE_ALGORITHM_ERROR'};
   return {status:200,body:JSON.stringify({status:200,data:{ts:Date.now(),result:{fp:b.fp,tk:'tk03'+'a'.repeat(88),algo:'function test(tk,fp,ts,ai,algo){return algo.HmacSHA256(tk+fp+ts+ai,"offline");}'}}})};
  },
  request:async o=>{
   const p=T.form(o.body),b=JSON.parse(p.body),fn=p.functionId;calls.push({o,p,b,time:clock});
   assert(T.ALLOWED.has(fn));assert(!fn.includes('water'));assert(!('pay'in b));
   if(T.APPS[fn]){const parts=p.h5st.split(';');assert.equal(parts.length,10);assert.equal(parts[2],T.APPS[fn]);assert.equal(parts[5],'5.3');if(options.realSDK&&T.MUTATE.has(fn))assert.equal(parts[3],'tk03'+'a'.repeat(88));}
   if(options.onRequest){const response=options.onRequest({fn,b,p,current,extra,calls,store});if(response)return response;}
   let d,code=0;
   if(fn==='apTaskList')d=options.missingAfterAward&&afterAward?[]:current;
   else if(fn==='apTaskListBatch')d={modules:[{code:0,elementId:'offline-module',tasks:extra}]};
   else if(fn==='farm_home')d={bizCode:0,result:{bottleWater:water,treeFullStage:4,...options.sign?{onlineGiftPackageLinkId:'offline-sign-entrance'}:{}}};
   else if(fn==='weGameHome'){
    const state=signClaimed&&!options.sign?.unconfirmed?3:options.sign?.state??2;
    d={signMainVo:{buttonStatus:state,signDays:5,todaySign:1},signInVoList:[{signInDate:options.sign?.date||'20261022',currentDay:5,status:state===3?3:2,awardName:options.sign?.reward||'10京豆'}]};
   }
   else if(fn==='weGameLottery'){
    const name=options.sign?.reward||'10京豆',amount=Number(name.match(/^\d+/)?.[0]||10);signClaimed=true;
    d={awardResultVO:{sendResult:true,amount:String(amount),prizeDesc:name},signInfoVo:{status:1,currentSignDay:5}};
    if(name.endsWith('水滴'))water+=amount;
   }
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
   return {status:200,headers:options.responseHeaders?.({fn,calls})||{},body:JSON.stringify({code,success:true,data:clone(d)})};
  }};
 const crypto=options.realSDK?createFarmCrypto(host):{hash:s=>require('crypto').createHash('sha256').update(s).digest('hex'),decodeEnvironment:farmDecodeEnvironment,sign:app=>fakeSig(app,options.sdk),signOnline:async app=>fakeSig(app,options.sdk)};
 const client=createFarmTaskClient(host,crypto,profile,options.login);
 const result=await client.run(options.scope||'farm',options.mode||'all');
 const text=JSON.stringify(result)+JSON.stringify(notes)+farmReportText(result);
 for(const s of ['FAKE_PRIVATE_COOKIE','FAKE_PRIVATE_EID','FAKE_PRIVATE_UUID','OFFLINE_AREA','assignment-'])assert(!text.includes(s),'private data in result');
 return {result,calls,algoCalls,store,notes,waits,pauses,current,extra};
}
(async()=>{
 let n=0,r;
 r=await simulate({tasks:[],sign:{},realSDK:true});assert(!r.result.stopped,r.result.message);assert.equal(r.result.signIn.confirmed,10);assert.equal(r.result.signIn.unit,'京豆');assert.equal(r.result.waterConfirmed,0);assert(r.algoCalls.includes('730a6'));assert(farmReportText(r.result).includes('签到：已领取 10 京豆'));
 {const a=r.calls.find(c=>c.p.functionId==='weGameLottery'),q=r.calls.find(c=>c.p.functionId==='weGameHome');assert.deepEqual(a.b,{version:30,channelParam:'1',linkId:'offline-sign-entrance'});assert.equal(a.p.appid,'wegame-hub');assert.equal(new URL(a.o.url).pathname,'/client.action');assert.deepEqual(q.b,{version:30,channelParam:'1',linkId:'offline-sign-entrance',openPush:false,supportPushFlag:1});}n++;
 r=await simulate({tasks:[],sign:{reward:'1000水滴'},realSDK:true});assert(!r.result.stopped);assert.equal(r.result.signIn.confirmed,1000);assert.equal(r.result.waterReceived,1000);assert.equal(r.result.waterConfirmed,1000);assert.equal(r.result.waterAfter,1900);n++;
 r=await simulate({tasks:[],sign:{state:3}});assert(!r.result.stopped);assert.equal(r.result.signIn.result,'今日已领取');assert(!r.calls.some(c=>c.p.functionId==='weGameLottery'));n++;
 r=await simulate({tasks:[],sign:{state:1}});assert(!r.result.stopped);assert(r.result.signIn.result.includes('App'));assert(!r.calls.some(c=>T.MUTATE.has(c.p.functionId)));n++;
 r=await simulate({tasks:[],sign:{date:'20261021'}});assert(r.result.stopped);assert(!r.calls.some(c=>T.MUTATE.has(c.p.functionId)));n++;
 r=await simulate({tasks:[],sign:{reward:'10元优惠券'}});assert(!r.result.stopped);assert(r.result.signIn.result.includes('App'));assert(!r.calls.some(c=>c.p.functionId==='weGameLottery'));n++;
 r=await simulate({tasks:[],sign:{unconfirmed:true}});assert(r.result.stopped);assert.equal(r.result.signIn.received,10);assert(!r.result.signIn.confirmed);const repeatedSign=await simulate({tasks:[],sign:{},store:r.store});assert(!repeatedSign.calls.some(c=>c.p.functionId==='weGameLottery'));n++;
 r=await simulate({tasks:[],sign:{},onRequest:({fn})=>fn==='weGameLottery'?{status:403,body:''}:null});assert(r.result.stopped);assert.equal(r.result.waterConfirmed,0);const signRetry=await simulate({tasks:[],sign:{},store:r.store});assert(!signRetry.calls.some(c=>c.p.functionId==='weGameLottery'));n++;
 for(const mode of ['query','claim']){r=await simulate({tasks:[],sign:{},mode});assert(!r.calls.some(c=>c.p.functionId.startsWith('weGame')));}n++;
 r=await simulate({sign:{},tasks:[task('browse')]});assert(!r.result.stopped);assert(r.calls.findIndex(c=>c.p.functionId==='weGameLottery')>r.calls.findIndex(c=>c.p.functionId==='apTaskDrawAward'));assert.equal(r.result.waterConfirmed,10);assert.equal(r.result.signIn.confirmed,10);n++;
 r=await simulate({tasks:[],sign:{reward:'1000水滴',unconfirmed:true}});assert(r.result.stopped);assert.equal(r.result.waterReceived,1000);assert.equal(r.result.waterConfirmed,0);n++;
 r=await simulate({tasks:[],sign:{},failWrite:k=>k.startsWith('actions.')});assert(r.result.stopped);assert(!r.calls.some(c=>c.p.functionId==='weGameLottery'));n++;
 r=await simulate({tasks:[],sign:{},realSDK:true});assert.equal(r.algoCalls.filter(a=>a==='101aa').length,1);assert.equal(r.algoCalls.filter(a=>a==='730a6').length,1);assert(r.calls.filter(c=>c.p.functionId.startsWith('weGame')).every(c=>c.p.h5st.split(';')[3].startsWith('tk03')));n++;
 for(const sdk of ['h5_file_v5.3.5','h5_file_v5.3.6']){r=await simulate({realSDK:true,sdk});assert.equal(r.result.stopped,false);assert.equal(r.result.waterConfirmed,10);assert.equal(r.result.rows[1].result,'手动浇水，保留水滴');assert.equal(r.result.waterAfter,910);n++;}
 r=await simulate({realSDK:true,failAlgo:true});assert(r.result.stopped);assert(r.result.message.includes('服务端签名初始化失败'));assert(!r.calls.some(c=>T.MUTATE.has(c.p.functionId)));assert(r.algoCalls.length===1);n++;
 r=await simulate({realSDK:true,tasks:[task('a'),task('b')]});assert(!r.result.stopped);assert.equal(r.algoCalls.filter(a=>a==='acb1e').length,1);assert.equal(r.algoCalls.filter(a=>a==='ebecc').length,1);assert.equal(r.algoCalls.filter(a=>a==='f0f3f').length,1);n++;
 // 409/410: forward the latest server sdtoken across query/action templates.
 {
  const p=account().profile,original=JSON.stringify(p),req=captureRequest('farm','apStartTaskTime',{}),params=T.form(req.body);
  p.scopes.farm.templates.apStartTaskTime={endpoint:'https://api.m.jd.com/api',params,headers:{...req.headers,Cookie:req.headers.Cookie+' sdtoken=PRIVATE_STALE_SESSION;'},body:{},signing:p.scopes.farm.signing,at:100};
  const snapshot=JSON.stringify(p);
  r=await simulate({profile:p,realSDK:true,tasks:[task('a'),task('b')],responseHeaders:({calls})=>({'X-Rp-Sdtoken':'set;1800;PRIVATE_CURRENT_SESSION_'+calls.length})});
  assert(!r.result.stopped,r.result.message);assert.equal(r.result.waterConfirmed,20);
  for(let i=1;i<r.calls.length;i++)assert.equal(T.cookie(r.calls[i].o.headers.Cookie,'sdtoken'),'PRIVATE_CURRENT_SESSION_'+i);
  for(const c of r.calls){assert.equal(T.cookie(c.o.headers.Cookie,'pt_key'),'FAKE_PRIVATE_COOKIE');assert.equal(T.cookie(c.o.headers.Cookie,'pt_pin'),'offline');}
  assert.equal(JSON.stringify(p),snapshot);assert.equal(r.result.sessionRefreshes,r.calls.length);assert(r.result.lastRequest.currentSession);
  assert(!JSON.stringify(r.result).includes('PRIVATE_CURRENT_SESSION'));assert(!r.notes.join('').includes('PRIVATE_CURRENT_SESSION'));assert(!JSON.stringify([...r.store]).includes('PRIVATE_CURRENT_SESSION'));
  assert.equal(r.algoCalls.filter(a=>a==='acb1e').length,1);assert.equal(r.algoCalls.filter(a=>a==='ebecc').length,1);assert.equal(r.algoCalls.filter(a=>a==='f0f3f').length,1);n++;
 }
 for(const value of ['set;0;PRIVATE_REJECTED_SESSION','set;99999;PRIVATE_REJECTED_SESSION','set;1800;bad;cookie=inject','set;1800;short','set;1800;PRIVATE_REJECTED_SESSION\r\nX:1']){
  r=await simulate({mode:'query',responseHeaders:()=>({'x-rp-sdtoken':value})});assert(!r.result.stopped);assert(!r.result.sessionRefreshes);assert(!r.calls.some(c=>T.cookie(c.o.headers.Cookie,'sdtoken')));
 }n++;
 r=await simulate({tasks:[task('a')],responseHeaders:()=>({'x-rp-sdtoken':'set;1;PRIVATE_SHORT_SESSION'})});assert(r.result.stopped);assert(r.result.message.includes('会话已过期'));assert(!r.calls.some(c=>c.p.functionId==='apDoLimitTimeTask'||c.p.functionId==='apTaskDrawAward'));n++;
 r=await simulate({responseHeaders:()=>({'x-rp-sdtoken':'set;1800;PRIVATE_CURRENT_SESSION'}),onRequest:({fn})=>fn==='apStartTaskTime'?{status:403,headers:{'x-rp-sdtoken':'set;1800;PRIVATE_REJECTED_SESSION'},body:''}:null});assert(r.result.stopped);assert(r.result.lastRequest.currentSession);assert.equal(r.result.sessionRefreshes,r.calls.length-1);assert(!farmReportText(r.result).includes('PRIVATE_CURRENT_SESSION'));assert(farmReportText(r.result).includes('本请求使用本轮会话'));n++;
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
 r=await simulate({scope:'wheel',mode:'draw',tasks:[],chances:2});assert(!r.result.stopped);assert.equal(r.result.drawsConfirmed,2);assert.equal(r.result.chancesAfter,0);assert.equal(r.calls.filter(c=>c.p.functionId==='wheelsHome').length,3);assert.equal(r.calls.filter(c=>c.p.functionId==='apTaskList').length,1);assert.equal(r.calls.at(-1).p.functionId,'wheelsHome');n++;
 {
  let verifiedFinal=false;
  r=await simulate({scope:'wheel',mode:'all',tasks:[],chances:2,onRequest:({fn,calls})=>{
   if(fn==='wheelsHome'&&calls.filter(c=>c.p.functionId==='wheelsLottery').length===2){if(verifiedFinal)return {status:403,body:''};verifiedFinal=true;}
   return null;
  }});
  assert(verifiedFinal);assert(!r.result.stopped,r.result.message);assert.equal(r.result.drawsConfirmed,2);assert.equal(r.result.chancesAfter,0);assert.equal(r.calls.filter(c=>c.p.functionId==='wheelsHome').length,4);assert.equal(r.calls.filter(c=>c.p.functionId==='apTaskList').length,1);assert(farmReportText(r.result).includes('复查确认 2 次'));n++;
 }
 r=await simulate({scope:'wheel',mode:'draw',tasks:[],chances:2,onRequest:({fn,calls})=>fn==='wheelsHome'&&calls.filter(c=>c.p.functionId==='wheelsLottery').length===2?{status:403,body:''}:null});assert(r.result.stopped);assert.equal(r.result.draws.length,2);assert.equal(r.result.drawsConfirmed,1);const uncertainRetry=await simulate({scope:'wheel',mode:'draw',store:r.store});assert(uncertainRetry.result.stopped);assert(!uncertainRetry.calls.some(c=>c.p.functionId==='wheelsLottery'));n++;
 r=await simulate({scope:'wheel',mode:'draw',tasks:[],chances:0});assert(!r.result.stopped);assert.equal(r.result.chancesAfter,0);assert.equal(r.calls.filter(c=>c.p.functionId==='wheelsHome').length,1);assert.equal(r.calls.length,2);n++;
 r=await simulate({scope:'wheel',mode:'draw',tasks:[],chances:50});assert(!r.result.stopped,r.result.message);assert.equal(r.result.drawsConfirmed,50);assert.equal(r.result.chancesAfter,0);assert.equal(r.calls.filter(c=>c.p.functionId==='wheelsHome').length,51);n++;
 r=await simulate({scope:'wheel',tasks:[task('verified','BROWSE_CHANNEL',{id:123,timeLimitSwitch:0,timeLimitPeriod:0,pipeExt:{assignmentId:'wheel-verified'},taskItemList:null})]});assert(!r.result.stopped);assert.equal(r.result.final[0].current,1);assert.equal(r.result.drawsConfirmed,2);n++;
 r=await simulate({scope:'wheel',mode:'draw',onRequest:({fn})=>fn==='wheelsLottery'?{status:200,body:'{"code":0,"success":true,"data":{}}'}:null});assert(r.result.stopped);const again=await simulate({scope:'wheel',mode:'draw',store:r.store});assert(again.result.stopped);assert(!again.calls.some(c=>c.p.functionId==='wheelsLottery'));n++;
 r=await simulate({tasks:[task('a')],onRequest:({fn})=>fn==='apStartTaskTime'?{status:502,body:''}:null});assert(r.result.stopped);const retry=await simulate({store:r.store,tasks:[task('a')]});assert(!retry.calls.some(c=>c.p.functionId==='apStartTaskTime'));n++;
 assert(r.result.message.includes('HTTP 502'));assert(r.result.message.includes('apStartTaskTime'));assert.equal(r.result.lastRequest.status,502);assert.equal(r.result.lastRequest.stage,'开始计时');n++;
 r=await simulate({tasks:[task('a')],onRequest:({fn})=>fn==='apStartTaskTime'?{status:403,body:'PRIVATE_ERROR_BODY_TOKEN'}:null});assert(r.result.message.includes('HTTP 403'));assert(!JSON.stringify(r.result).includes('PRIVATE_ERROR_BODY_TOKEN'));assert(!r.calls.some(c=>c.p.functionId==='apDoLimitTimeTask'));n++;
 // Diagnostic output retains fixed clues/codes, not raw headers or server messages.
 r=await simulate({tasks:[task('a')],onRequest:({fn})=>fn==='apStartTaskTime'?{status:403,headers:{'Content-Type':'application/json; charset=utf-8','Set-Cookie':'SECRET_RESPONSE_COOKIE','Server':'PRIVATE_SERVER_VALUE'},body:JSON.stringify({code:403,subCode:'1001',errMsg:'h5st signature invalid SECRET_RESPONSE_COOKIE',data:{pt_key:'SECRET_NESTED_TOKEN'},traceId:'SECRET_TRACE'})}:null});
 assert.deepEqual(r.result.lastRequest.response.codes,{code:'403',subCode:'1001'});assert.deepEqual(r.result.lastRequest.response.clues,['签名']);assert.equal(r.result.lastRequest.response.kind,'json');assert.equal(r.result.lastRequest.response.mime,'application/json');assert.equal(r.result.lastRequest.template,'list');
 for(const secret of ['SECRET_RESPONSE_COOKIE','SECRET_NESTED_TOKEN','SECRET_TRACE','PRIVATE_SERVER_VALUE'])assert(!JSON.stringify(r.result).includes(secret)&&!r.notes.join('').includes(secret));assert(farmReportText(r.result).includes('code=403'));assert(!r.calls.some(c=>c.p.functionId==='apDoLimitTimeTask'));n++;
 r=await simulate({tasks:[task('a')],onRequest:({fn})=>fn==='apStartTaskTime'?{status:403,headers:{'content-type':'text/html','retry-after':'30'},body:'<!DOCTYPE html><html><title>Access Denied PRIVATE_TOKEN</title><p>pt_key=SECRET_COOKIE</p></html>'}:null});
 assert.equal(r.result.lastRequest.response.kind,'html');assert.deepEqual(r.result.lastRequest.response.clues,['访问限制']);assert.equal(r.result.lastRequest.response.retryAfterSeconds,30);assert(!farmReportText(r.result).includes('SECRET_COOKIE'));n++;
 r=await simulate({tasks:[task('a')],onRequest:({fn})=>fn==='apStartTaskTime'?{status:403,headers:{'content-type':'text/plain'},body:''}:null});assert.equal(r.result.lastRequest.response.kind,'empty');assert(farmReportText(r.result).includes('空响应'));n++;
 {
  const d=farmResponseDiagnostic({headers:{'content-type':'SECRET_MIME','retry-after':'SECRET_RETRY'},body:JSON.stringify({code:'SECRET_CODE',errorCode:[],errCode:{},subCode:'SIGNATURE_TOKEN',message:'private unrecognized text',data:{code:999}})});
  assert.deepEqual(d,{kind:'json',length:JSON.stringify({code:'SECRET_CODE',errorCode:[],errCode:{},subCode:'SIGNATURE_TOKEN',message:'private unrecognized text',data:{code:999}}).length});assert(!farmDiagnosticText({response:d}).includes('SECRET'));n++;
 }
 r=await simulate({tasks:[task('a')],onRequest:({fn})=>fn==='apStartTaskTime'?{status:200,body:'<html><body>Bad Gateway SECRET_BODY</body></html>'}:null});assert(r.result.stopped);assert.equal(r.result.lastRequest.response.kind,'html');assert.deepEqual(r.result.lastRequest.response.clues,['网关错误']);assert(!farmReportText(r.result).includes('SECRET_BODY'));n++;
 r=await simulate({tasks:[task('a')],onRequest:({fn})=>fn==='apStartTaskTime'?{status:200,body:'{"code":1002,"success":false,"errMsg":"login required SECRET_BODY"}'}:null});assert.equal(r.result.lastRequest.response.codes.code,'1002');assert.deepEqual(r.result.lastRequest.response.clues,['登录']);assert(!farmReportText(r.result).includes('SECRET_BODY'));n++;
 const diagRetry=await simulate({store:r.store,tasks:[task('a')]});assert(!diagRetry.calls.some(c=>c.p.functionId==='apStartTaskTime'));n++;
 r=await simulate({tasks:[task('a')]});assert.deepEqual(r.pauses,[]);assert(r.waits.length>0);n++;
 r=await simulate({tasks:[task('a','ORDER_MARK'),task('b','CUMULATIVE_TIMES')]});assert.equal(r.calls.filter(c=>c.p.functionId==='apTaskList').length,2);assert.equal(r.result.rows.length,2);n++;
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
 const plugin=fs.readFileSync(path.join(root,release?'jd-activities.plugin':'../Plugins/jd-activities.plugin'),'utf8');assert.equal((plugin.match(/^generic /gm)||[]).length,5);assert(!/^cron /m.test(plugin));assert(!T.ALLOWED.has('farm_water'));assert(!T.ALLOWED.has('farm_one_key_plant_settle'));n++;
 // Loon entry: full exact bundle, no network allowed for status or missing profile.
 for(const mode of ['status','farm-query']){
  let done=false;const notes=[],writes=[];const context={console:{log:()=>{}},$argument:mode,$persistentStore:{read:()=>'',write:(v,k)=>{writes.push(k);return true;}},$notification:{post:(...a)=>notes.push(a)},$httpClient:{post:()=>{throw Error('unexpected network');}},$done:()=>{done=true;},setTimeout,clearTimeout};Object.assign(context,virtualClock());vm.runInNewContext(fs.readFileSync(mainPath,'utf8'),context,{timeout:15000});await new Promise(r=>setImmediate(r));assert(done);assert(notes.length);assert(writes.every(k=>k.startsWith(T.PREFIX)));n++;
 }
 // Full Loon entry with its real persistent-store lock and transport adapter.
 for(const mode of ['farm-query','farm-all','wheel-query','wheel-draw']){
  const store=new Map([[T.ACCOUNT,JSON.stringify(account().profile)],['QL_BRIDGE_CREDENTIAL_V1','']]),calls=[],timers=[],notes=[];let finish;
  const done=new Promise(r=>finish=r),context={console:{log:()=>{}},$argument:mode,setTimeout:(f,ms)=>{const t=setTimeout(f,ms);timers.push(t);return t;},clearTimeout,
   $persistentStore:{read:k=>store.get(k)||'',write:(v,k)=>{assert(k.startsWith(T.PREFIX));store.set(k,v);return true;}},$notification:{post:(...a)=>notes.push(a)},$done:()=>finish(),
   $httpClient:{post:(o,cb)=>{const p=T.form(o.body);calls.push(p.functionId);assert.equal(o['auto-redirect'],false);assert.equal(o['auto-cookie'],false);assert.equal(o.insecure,false);assert.equal(o.alpn,'h2');const d=p.functionId==='apTaskList'?[]:p.functionId==='apTaskListBatch'?{modules:[]}:p.functionId==='farm_home'?{bizCode:0,result:{bottleWater:800}}:{lotteryChances:0,payLotteryFlag:false};cb(null,{status:200},JSON.stringify({code:0,success:true,data:d}));}}};
  Object.assign(context,virtualClock());vm.runInNewContext(fs.readFileSync(mainPath,'utf8'),context,{timeout:15000});await done;timers.forEach(clearTimeout);
  const result=JSON.parse(store.get(T.PREFIX+'last'));assert.equal(result.stopped,false);assert.equal(store.get(T.PREFIX+'lock'),'');assert(calls.length>=(mode==='wheel-draw'?2:3));assert(notes.length);assert(!JSON.stringify(result).includes('PRIVATE'));n++;
 }
 // Full Loon request_algo adapter followed by a real-SDK task and reward.
 // The actual Loon adapter must also pass headers to the response sanitizer.
 {
  const store=new Map([[T.ACCOUNT,JSON.stringify(account().profile)]]),notes=[];let finish;
  const done=new Promise(r=>finish=r),context={console:{log:s=>notes.push(s)},$argument:'farm-query',setTimeout,clearTimeout,
   $persistentStore:{read:k=>store.get(k)||'',write:(v,k)=>{store.set(k,v);return true;}},$notification:{post:(...s)=>notes.push(s.join(' '))},$done:()=>finish(),
   $httpClient:{post:(o,cb)=>cb(null,{status:403,headers:{'CONTENT-TYPE':'text/html; charset=utf-8','set-cookie':'PRIVATE_SET_COOKIE'}},'<html><body>Access Denied PRIVATE_HTML_VALUE</body></html>')}};
  Object.assign(context,virtualClock());vm.runInNewContext(fs.readFileSync(mainPath,'utf8'),context,{timeout:15000});await done;
  const r=JSON.parse(store.get(T.PREFIX+'last'));assert(r.stopped);assert.equal(r.lastRequest.response.mime,'text/html');assert.equal(r.lastRequest.response.kind,'html');assert(notes.join('').includes('响应诊断'));assert(!notes.join('').includes('PRIVATE_'));assert(!store.get(T.PREFIX+'last').includes('PRIVATE_'));n++;
 }
 {
  const store=new Map([[T.ACCOUNT,JSON.stringify(account().profile)],['QL_BRIDGE_CREDENTIAL_V1','']]),timers=[],algoCalls=[];let finish;
  const done=new Promise(r=>finish=r),t=task('live-adapter','BROWSE_CHANNEL',{timeLimitSwitch:0,timeLimitPeriod:0});
  const context={console:{log:()=>{}},$argument:'farm-all',setTimeout:(f,ms)=>{const id=setTimeout(f,ms);timers.push(id);return id;},clearTimeout,
   $persistentStore:{read:k=>store.get(k)||'',write:(v,k)=>{assert(k.startsWith(T.PREFIX));store.set(k,v);return true;}},$notification:{post:()=>{}},$done:()=>finish(),
   $httpClient:{post:(o,cb)=>{
    assert.equal(o['auto-redirect'],false);assert.equal(o['auto-cookie'],false);assert.equal(o.insecure,false);
    if(o.url==='https://cactus.jd.com/request_algo'){
     assert.equal(o.alpn,undefined); // Keep algorithm-service transport unchanged.
     assert(!Object.keys(o.headers).some(k=>k.toLowerCase()==='cookie'));const b=JSON.parse(o.body);algoCalls.push(b.appId);
     cb(null,{status:200},JSON.stringify({status:200,data:{ts:Date.now(),result:{fp:b.fp,tk:'tk03'+'a'.repeat(88),algo:'function test(tk,fp,ts,ai,algo){return algo.HmacSHA256(tk+fp+ts+ai,"offline");}'}}}));return;
    }
    assert.equal(o.alpn,'h2');const p=T.form(o.body);let data;
    if(p.functionId==='apTaskList')data=[t];
    else if(p.functionId==='apTaskListBatch')data={modules:[]};
    else if(p.functionId==='farm_home')data={bizCode:0,result:{bottleWater:900}};
    else if(p.functionId==='apsDoTask'){assert.equal(p.h5st.split(';')[3],'tk03'+'a'.repeat(88));t.taskDoTimes=1;t.taskFinished=true;t.canDrawAwardNum=1;data={finished:true};}
    else if(p.functionId==='apTaskDrawAward'){assert.equal(p.h5st.split(';')[3],'tk03'+'a'.repeat(88));t.canDrawAwardNum=0;data=[{awardName:'WATER',awardGivenNumber:'10'}];}
    else throw Error('unexpected integration request');
    cb(null,{status:200},JSON.stringify({code:0,success:true,data}));
   }}};
  Object.assign(context,virtualClock());vm.runInNewContext(fs.readFileSync(mainPath,'utf8'),context,{timeout:15000});await done;timers.forEach(clearTimeout);const r=JSON.parse(store.get(T.PREFIX+'last'));assert(!r.stopped,r.message);assert.equal(r.waterConfirmed,10);assert.deepEqual(algoCalls,['54ed7','f0f3f']);n++;
 }
 console.log(n+' offline checks passed: current lists/modules, duplicate -9999 identities, timed tasks, repeat rounds, claims, daily sign rewards, free draws, no watering/payment, capture and both official SDKs. No live requests.');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
