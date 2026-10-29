const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=fs.existsSync(path.join(__dirname,'../Scripts/jd-jr-beans.js'))?path.join(__dirname,'..'):path.join(__dirname,'发布包');
const script=fs.readFileSync(path.join(root,'Scripts/jd-jr-beans.js'),'utf8');
const api=require(path.join(root,'Scripts/jd-jr-beans.js'));
const {JRB_API,JRB_KEY,jrbCapture,jrbClassify,jrbProgress,createJrBeansClient,jrbForm}=api;
const tests=[];const test=(n,f)=>tests.push([n,f]);
const TITLE='逛超值爆款好物',UID='a'.repeat(32),COOKIE='pt_key=TEST_KEY;pt_pin=test_user;',ENV='TEST_ENV';
const task=(extra={})=>({missionId:'47029',channelCode:'CH202503192',missionType:3,receivingStatus:1,status:-1,title:{text:TITLE},subTitle:{text:'完成任务可得1京豆'},button:{text:'去完成',jumpData:{jumpUrl:'https://show.jd.com/static-page/mission/forever/jumpmission-v2/index.html?juid='+UID}},...extra});
const page=(tasks=[task()])=>({success:true,resultCode:0,resultData:{pageId:11189,resultList:[{templateData:{taskList:tasks}}]}});
const ok=()=>({success:true,resultCode:0,resultData:{success:true,code:'0000',data:{jumpUrl:'https://item.jd.com/123.html'}}});
const params=()=>({clientVersion:'8.2.80',clientType:'ios',pageType:11189,pageId:11189,ctp:11189,pageNum:-1,buildCodes:['common','topData','float','tag'],extParams:{sdkToken:'TEST_SDK',signData:{sdkToken:'TEST_SDK'},deviceInfos:'{"sdkToken":"TEST_SDK"}',nonce:'OLD_NONCE',signature:'OLD_SIGNATURE'}});
const cco=()=>({client:'ios',clientVersion:'',_stk:'clientType,clientVersion,ctp,pageId,pageNum,pageType',_ste:1,h5st:'a;b;73fdb;d;e;5.3;g;'+ENV+';i;j',t:123});
const headers=()=>({Cookie:'qid_uid=TEST_QID;','User-Agent':'TEST_UA',Origin:'https://member.jr.jd.com',Referer:'https://member.jr.jd.com/','x-referer-page':'https://member.jr.jd.com/member/coinQuest/coin/','x-rp-client':'h5_2.6.0'});
const req=()=>({url:JRB_API.page+'?pageType=11189',method:'POST',headers:headers(),body:api.jrbEncode({reqData:JSON.stringify(params()),cco:JSON.stringify(cco()),eid:'TEST_EID'})});
const res=()=>({status:200,body:JSON.stringify(page())});
const decode=()=>({pp:{p1:'test_user'}});
function store(){const s={'JD_SIGNIN_LOGIN_V1':{pin:'test_user',cookie:COOKIE,capturedAt:1},'JD_SIGNIN_ACCOUNT_V1':{pin:'test_user'}};return {s,read:(k,f)=>s[k]??f,write:(k,v)=>{s[k]=v;},observedAt:100};}
function profile(){const h=store();jrbCapture(h,req(),res(),decode);return h.s[JRB_KEY];}
function client({pages=[page(),page([])],failAt,day='2026-10-29',storage={},receiveResponse=ok(),jumpResponse=ok(),onSleep}={}){
 let pageIndex=0,signInputs=[],signHashInputs=[],requests=[],sleeps=[],events=[],time=1000,uuids=0;
 const host={read:(k,f)=>storage[k]??f,write:(k,v)=>storage[k]=JSON.parse(JSON.stringify(v)),day:()=>day,now:()=>time,guard:()=>{},log:x=>events.push(x),error:e=>e.message,uuid:()=> '00000000-0000-4000-8000-'+String(++uuids).padStart(12,'0'),aar:async()=>({nonce:()=> '1'.repeat(20),sign:(s,n)=>{signInputs.push(JSON.parse(s));return 'a'.repeat(66);}}),sleep:async ms=>{sleeps.push(ms);time+=ms;if(onSleep)onSleep(ms);},json:r=>r.body,
  request:async o=>{requests.push(o);const op=o.url.split('?')[0];if(failAt===op)throw Error('TEST_FAILURE');if(op===JRB_API.page)return {body:pages[Math.min(pageIndex++,pages.length-1)]};return {body:op===JRB_API.receive?receiveResponse:jumpResponse};}};
 const crypto={hash:x=>'hash_'+x,decodeEnvironment:decode,signOnline:async(app,p,env,input)=>{signHashInputs.push({app,input});return 'FRESH_H5ST';}};
 return {client:createJrBeansClient(host,crypto,profile()),requests,signInputs,signHashInputs,sleeps,events,storage};
}
test('native page captures with canonical login',()=>{const h=store();assert(jrbCapture(h,req(),res(),decode));assert.equal(h.s[JRB_KEY].pin,'test_user');assert(h.s[JRB_KEY].headers.Cookie.includes('TEST_KEY'));assert(h.s[JRB_KEY].headers.Cookie.includes('TEST_QID'));});
test('capture does not keep expiring signatures',()=>{const h=store();jrbCapture(h,req(),res(),decode);const s=JSON.stringify(h.s[JRB_KEY]);for(const k of ['OLD_NONCE','OLD_SIGNATURE','a;b;73fdb'])assert(!s.includes(k));assert.equal(h.s[JRB_KEY].signing.environment,ENV);});
test('independent storage leaves signins unchanged',()=>{const h=store(),old=JSON.stringify(h.s);jrbCapture(h,req(),res(),decode);const { [JRB_KEY]:_,...rest}=h.s;assert.equal(JSON.stringify(rest),old);});
test('no identity means no capture',()=>{const h=store();delete h.s.JD_SIGNIN_LOGIN_V1;assert.equal(jrbCapture(h,req(),res(),decode),null);});
test('signed account mismatch ignored',()=>{const h=store();assert.equal(jrbCapture(h,req(),res(),()=>({pp:{p1:'another'}})),null);assert(!h.s[JRB_KEY]);});
test('existing activity account mismatch ignored',()=>{const h=store();h.s[JRB_KEY]={pin:'another'};assert.equal(jrbCapture(h,req(),res(),decode),null);});
test('own script traffic ignored',()=>{const r=req();r.headers['X-Lazing-Activity-Run']='1';assert.equal(jrbCapture(store(),r,res(),decode),null);});
test('wrong page ignored',()=>{const r=req(),q=params();q.pageId=123;r.body=api.jrbEncode({reqData:JSON.stringify(q),cco:JSON.stringify(cco())});assert.equal(jrbCapture(store(),r,res(),decode),null);});
test('wrong source ignored',()=>{const r=req();r.headers['x-referer-page']='https://evil.example/';assert.equal(jrbCapture(store(),r,res(),decode),null);});
test('wrong signature app ignored',()=>{const r=req(),c=cco();c.h5st=c.h5st.replace('73fdb','wrong');r.body=api.jrbEncode({reqData:JSON.stringify(params()),cco:JSON.stringify(c)});assert.equal(jrbCapture(store(),r,res(),decode),null);});
test('ambiguous signing fields ignored',()=>{const r=req(),c=cco();c._stk='clientType,clientType,ctp,pageId,pageNum,pageType';r.body=api.jrbEncode({reqData:JSON.stringify(params()),cco:JSON.stringify(c)});assert.equal(jrbCapture(store(),r,res(),decode),null);});
test('query needs POST',()=>{const r=req();r.method='GET';assert.equal(jrbCapture(store(),r,res(),decode),null);});
test('HTTP error ignored',()=>{assert.equal(jrbCapture(store(),req(),{status:403,body:'{}'},decode),null);});
test('duplicate input rejected',()=>assert.throws(()=>api.jrbForm('id=1&id=2')));
test('cross-location conflict rejected',()=>assert.throws(()=>api.jrbParams({url:'https://example.invalid/?id=1',body:'id=2'})));
test('receive material captured without old nonce',()=>{const h=store(),r=req();r.url=JRB_API.receive;r.body=api.jrbEncode({reqData:JSON.stringify({missionId:'47029',deviceInfo1:{sdkToken:'TEST_SDK',token:'TEST_SDK',fp:'TEST_FP'},nonce:'OLD_NONCE',signature:'OLD_SIGNATURE',environment:'2',clientVersion:'8.2.80',clientType:'h5'})});jrbCapture(h,r,{status:200,body:JSON.stringify(ok())},decode);assert.equal(h.s[JRB_KEY].deviceInfo.fp,'TEST_FP');assert(!JSON.stringify(h.s[JRB_KEY]).includes('OLD_'));});
test('jump GET metadata only',()=>{const h=store();jrbCapture(h,req(),res(),decode);const r={url:JRB_API.jump+'?'+api.jrbEncode({juid:UID,source:'missionJumpPage',finishFlag:'1',jrAppVersion:'8.2.80',systemEnv:'IOS',nonce:'OLD_NONCE',signature:'OLD_SIGNATURE',jumpSignId:'OLD_JUMP'}),method:'GET',headers:headers()};jrbCapture(h,r,{status:200,body:JSON.stringify(ok())},decode);const v=h.s[JRB_KEY];assert.equal(v.jumpMeta.systemEnv,'IOS');assert(!JSON.stringify(v).includes('OLD_'));});
test('per-component freshness permits out-of-order page',()=>{const h=store();h.s[JRB_KEY]={version:1,pin:'test_user',deviceAt:200,updatedAt:200,headers:{Cookie:COOKIE}};jrbCapture(h,req(),res(),decode);assert(h.s[JRB_KEY].query);assert.equal(h.s[JRB_KEY].updatedAt,200);});
test('older page cannot overwrite page',()=>{const h=store();jrbCapture(h,req(),res(),decode);h.observedAt=90;assert.equal(jrbCapture(h,req(),res(),decode),null);});
test('task list identifies concrete page',()=>{const p=page();p.resultData.pageId=123;assert.throws(()=>api.jrbList(p));});
test('duplicate tasks rejected',()=>assert.throws(()=>api.jrbList(page([task(),task()]))));
test('main browse recognized',()=>assert.equal(jrbClassify(task()),'jump'));
for(const title of ['购买理财得豆','话费充值','逛视频得豆','添加小组件','邀请好友','开启消息通知','浏览并关注店铺','消耗能量捕鱼'])test('interactive task skipped '+title,()=>assert.equal(jrbClassify(task({title:{text:title}})),'app'));
test('non-jump protocol left to app',()=>{const t=task();t.button.jumpData.jumpUrl='https://u.jr.jd.com/mission/?missionId=1';assert.equal(jrbClassify(t),'app');});
test('malicious lookalike domain passes no request',()=>{const t=task();t.button.jumpData.jumpUrl=t.button.jumpData.jumpUrl.replace('show.jd.com/','show.jd.com.evil.example/');assert.equal(jrbClassify(t),'app');});
test('explicit progress extracted',()=>assert.deepEqual(jrbProgress(task({button:{text:'去浏览（3/29）'}})),{done:3,limit:29}));
test('explicit numeric fields extracted',()=>assert.deepEqual(jrbProgress(task({finishNum:2,finishLimitNum:29})),{done:2,limit:29}));
test('completed counter skipped',()=>assert.equal(jrbClassify(task({finishNum:29,finishLimitNum:29})),'done'));
test('V3 signature covers object and fresh jump ID',async()=>{const r=client();await r.client.run();const jump=r.requests.find(x=>x.url.startsWith(JRB_API.jump)),q=jrbForm(jump.url.split('?')[1]);assert(r.signInputs.some(x=>x.juid===UID&&x.aksSignId===q.aksSignId));assert.equal(q.source,'missionJumpPage');assert.equal(q.token,'cxilwAoZKI');assert.equal(q.finishFlag,'1');assert(q.jumpSignId.startsWith(UID+'_'));assert(!q.jumpSignId.endsWith(q.aksSignId));});
test('receive signature uses numeric ID in correct order',async()=>{const r=client();await r.client.run();const p=r.signInputs.find(x=>x.missionId!==undefined);assert.equal(typeof p.missionId,'number');assert.equal(p.missionId,47029);assert.equal(JSON.stringify(p),'{"channelCode":"CH202503192","PIN":"test_user","missionId":47029}');});
test('page signing uses actual client fields',async()=>{const r=client();await r.client.run();const s=r.signHashInputs[0];assert.equal(s.app,'73fdb');assert.equal(s.input.clientVersion,'8.2.80');assert.equal(s.input.clientType,'ios');const p=jrbForm(r.requests[0].body);assert.equal(JSON.parse(p.cco).h5st,'FRESH_H5ST');assert(!p.reqData.includes('OLD_SIGNATURE'));});
test('confirmed disappearance counts task not beans',async()=>{const r=client(),v=await r.client.run();assert.equal(v.confirmed,1);assert.equal(v.submitted,1);assert.equal(v.beans,undefined);});
test('200 response alone never counts reward',async()=>{const r=client({pages:[page(),page()]}),v=await r.client.run();assert.equal(v.confirmed,0);assert.equal(v.submitted,1);assert(v.rows[0].result.includes('待App确认'));});
test('changed juid alone is not completion',async()=>{const t=task();t.button.jumpData.jumpUrl=t.button.jumpData.jumpUrl.replace(UID,'b'.repeat(32));const r=client({pages:[page(),page([t])]}),v=await r.client.run();assert.equal(v.confirmed,0);});
test('repeated task follows real counter to limit',async()=>{const pages=Array.from({length:4},(_,n)=>page([task({finishNum:n,finishLimitNum:3})]));const r=client({pages}),v=await r.client.run();assert.equal(v.confirmed,3);assert.equal(v.submitted,3);assert.equal(r.requests.filter(x=>x.url.startsWith(JRB_API.jump)).length,3);});
test('blast task has 29-iteration cap',async()=>{const pages=Array.from({length:40},(_,n)=>page([task({finishNum:n,finishLimitNum:50})]));const r=client({pages}),v=await r.client.run();assert.equal(v.submitted,29);});
test('other browse task runs once',async()=>{const t=n=>task({missionId:'39898',title:{text:'逛品质低价好物'},finishNum:n,finishLimitNum:3}),r=client({pages:[page([t(0)]),page([t(1)]),page([t(2)])]}),v=await r.client.run();assert.equal(v.submitted,1);});
test('primary blast task executes before other rows',async()=>{const a=task({missionId:'39898',title:{text:'逛品质低价好物'}}),b=task(),r=client({pages:[page([a,b]),page([a]),page([])]}),v=await r.client.run();assert.equal(v.rows[0].title,TITLE);assert.equal(v.confirmed,2);});
test('mutation timeout leaves pending and prevents resubmit',async()=>{const storage={},a=client({storage,failAt:JRB_API.jump});assert((await a.client.run()).stopped);const b=client({storage});const v=await b.client.run();assert.equal(b.requests.filter(x=>!x.url.startsWith(JRB_API.page)).length,0);assert(v.rows[0].result.includes('上次已提交'));});
test('business rejection stops immediately',async()=>{const r=client({jumpResponse:{success:true,resultCode:0,resultData:{success:false,code:'20001400'}}}),v=await r.client.run();assert(v.stopped);assert(v.message.includes('20001400'));assert.equal(v.confirmed,0);assert.equal(r.requests.filter(x=>x.url.startsWith(JRB_API.jump)).length,1);});
test('previously confirmed task is not resubmitted',async()=>{const storage={},a=client({storage});await a.client.run();const b=client({storage}),v=await b.client.run();assert.equal(v.submitted,0);assert.equal(b.requests.filter(x=>x.url.startsWith(JRB_API.jump)).length,0);});
test('pending journal resets on next Beijing day',async()=>{const storage={},a=client({storage,failAt:JRB_API.jump});await a.client.run();const b=client({storage,day:'2026-10-30'});assert.equal((await b.client.run()).confirmed,1);});
test('interactive-only page does no mutations',async()=>{const r=client({pages:[page([task({missionType:6})])]}),v=await r.client.run();assert.equal(v.submitted,0);assert.equal(r.requests.length,1);});
function coinPage(amount,tasks=[task()]){const p=page(tasks);p.resultData.topData={part256570004:{coinNumber:{text:String(amount)}}};return p;}
test('activity bean field accepted only at exact location',()=>{assert.equal(api.jrbCoins(coinPage(10)),10);const p=page();p.resultData.someBalance=10;assert.equal(api.jrbCoins(p),null);});
test('ambiguous bean fields ignored',()=>{const p=coinPage(10);p.resultData.topData.second={coinNumber:{text:'20'}};assert.equal(api.jrbCoins(p),null);});
test('exact page bean increase confirms a repeated task',async()=>{const r=client({pages:[coinPage(10),coinPage(11),coinPage(12),coinPage(13,[])]}),v=await r.client.run();assert.equal(v.confirmed,3);assert.equal(v.pageBeansDelta,3);assert.equal(v.submitted,3);});
test('page balance unchanged never confirms repeated task',async()=>{const r=client({pages:[coinPage(10),coinPage(10)]}),v=await r.client.run();assert.equal(v.confirmed,0);assert.equal(v.pageBeansDelta,0);assert.equal(v.submitted,1);});
test('unexpected larger balance increase is not assigned to task',async()=>{const r=client({pages:[coinPage(10),coinPage(17)]}),v=await r.client.run();assert.equal(v.confirmed,0);assert.equal(v.pageBeansDelta,7);assert.equal(v.submitted,1);});
test('delayed award gets one read-only recheck',async()=>{const r=client({pages:[coinPage(10),coinPage(10),coinPage(11,[])]}),v=await r.client.run();assert.equal(v.confirmed,1);assert.equal(r.requests.filter(x=>x.url.startsWith(JRB_API.jump)).length,1);});
test('unresolved task is not retried after another balance change',async()=>{const storage={},a=client({pages:[coinPage(10),coinPage(10)],storage});await a.client.run();const b=client({pages:[coinPage(20)],storage}),v=await b.client.run();assert.equal(v.submitted,0);});
test('page balance decrease does not preserve stale positive sum',async()=>{const r=client({pages:[coinPage(10),coinPage(11),coinPage(5)]}),v=await r.client.run();assert.equal(v.confirmed,1);assert.equal(v.pageBeansDelta,null);});
test('no returned media or ad tracking is requested',async()=>{const r=client();await r.client.run();for(const q of r.requests)assert(Object.values(JRB_API).includes(q.url.split('?')[0]));});
test('plugin only adds manual entry and scoped capture',()=>{const p=fs.readFileSync(path.join(root,'Plugins/jd-activities.plugin'),'utf8');assert.equal((p.match(/^generic /gm)||[]).length,5);assert(!/^cron |^network-changed /m.test(p));assert(p.includes('tag="金融赚京豆"'));assert(p.includes('getJumpInfoV3'));assert(p.includes('receiveMissionForNa'));});
test('shared dispatcher handles page capture',async()=>{const c=require(path.join(root,'Scripts/jd-activity-capture.js')),h=store();h.rawRead=k=>h.s[k]?JSON.stringify(h.s[k]):null;h.rawWrite=(v,k)=>{h.s[k]=JSON.parse(v);return true;};const r=await c.jsCapture(h,req(),res(),{},decode);assert(r.updated.includes(JRB_KEY));});
test('runtime contains one completion and no schedule',()=>{const runtime=script.slice(script.lastIndexOf("if(typeof $persistentStore!=="));assert.equal((runtime.match(/\$done\(/g)||[]).length,1);assert(!/cron|network-changed/.test(runtime));});
async function runtime({missing=false,status=200,busy=false,changeLogin=false}={}){
 const cut=script.lastIndexOf("if(typeof $persistentStore!=="),state=new Map(),requests=[],notes=[],logs=[];let calls=0,reads=0,finish;
 if(!missing){state.set(JRB_KEY,JSON.stringify(profile()));state.set('JD_SIGNIN_LOGIN_V1',JSON.stringify({pin:'test_user',cookie:COOKIE}));}
 if(busy)state.set('JD_ACTIVITY_MANUAL_V1.lock',JSON.stringify({runId:'OTHER',until:Date.now()+999999}));
 const complete=new Promise(resolve=>finish=resolve),env={setTimeout:(f,ms)=>setTimeout(f,Math.min(ms,5)),clearTimeout,console:{log:x=>logs.push(x)},$persistentStore:{read:k=>state.get(k)||'',write:(v,k)=>{state.set(k,v);return true;}},$done:()=>{calls++;finish();},$notification:{post:(...x)=>notes.push(x)}};
 const request=(method,o,callback)=>{
  requests.push({method,...o});if(o.url.startsWith('https://aks.jdpay.com/aar2/getJS')){assert(!o.headers.Cookie);callback(null,{status:200},'eyJTEST');return;}
  assert(o.url.startsWith('https://ms.jr.jd.com/'));assert(o.headers.Cookie.includes('TEST_KEY'));assert.equal(o.headers['X-Lazing-Activity-Run'],'1');
  const base=o.url.split('?')[0];if(base===JRB_API.receive&&changeLogin)state.set('JD_SIGNIN_LOGIN_V1','{"pin":"test_user","cookie":"CHANGED"}');
  callback(null,{status:base===JRB_API.jump?status:200,headers:{}},JSON.stringify(base===JRB_API.page?(reads++?coinPage(11,[]):coinPage(10)):ok()));
 };
 env.$httpClient={get:(o,c)=>request('get',o,c),post:(o,c)=>request('post',o,c)};
 const ctx=vm.createContext(env);vm.runInContext(script.slice(0,cut),ctx,{timeout:5000});
 vm.runInContext("createSigninCrypto=function(){return {hash:function(x){return 'hash_'+x;},decodeEnvironment:function(){return {pp:{p1:'test_user'}};},signOnline:async function(){return 'FRESH_H5ST';}};};createAar=function(){function A(){}A.init=function(o){o.callback(true);};A.prototype.nonce=function(){return '11111111111111111111';};A.prototype.sign=function(){return 'a'.repeat(66);};return A;};",ctx);
 vm.runInContext(script.slice(cut),ctx,{timeout:5000});await Promise.race([complete,new Promise((_,reject)=>setTimeout(()=>reject(Error('runtime timeout')),2000))]);assert.equal(calls,1);
 for(const text of [...logs,...notes.map(x=>JSON.stringify(x))])for(const secret of ['TEST_KEY','TEST_QID','TEST_SDK','TEST_EID'])assert(!text.includes(secret));
 return {state,requests,notes,logs};
}
test('full runtime confirms progress and releases lock',async()=>{const r=await runtime();assert.equal(r.state.get('JD_ACTIVITY_MANUAL_V1.lock'),'');const report=JSON.parse(r.state.get('JD_JR_BEANS_MANUAL_V1.last'));assert.equal(report.confirmed,1);assert.equal(report.pageBeansDelta,1);assert(r.notes[0][2].includes('京豆增加 1'));});
test('full runtime missing credentials makes no requests',async()=>{const r=await runtime({missing:true});assert.equal(r.requests.length,0);assert.equal(r.notes[0][1],'未继续');});
test('full runtime HTTP failure stops without mutation retry',async()=>{const r=await runtime({status:403});assert.equal(r.state.get('JD_ACTIVITY_MANUAL_V1.lock'),'');assert.equal(r.requests.filter(x=>x.url.startsWith(JRB_API.jump)).length,1);assert(r.notes[0][2].includes('HTTP 403'));});
test('full runtime honors another run lock',async()=>{const r=await runtime({busy:true});assert.equal(r.requests.length,0);assert(JSON.parse(r.state.get('JD_ACTIVITY_MANUAL_V1.lock')).runId==='OTHER');});
test('full runtime stops when credentials change',async()=>{const r=await runtime({changeLogin:true});assert.equal(r.requests.filter(x=>x.url.startsWith(JRB_API.jump)).length,0);assert.equal(r.state.get('JD_ACTIVITY_MANUAL_V1.lock'),'');});
(async()=>{for(const [name,f]of tests){await f();}console.log(tests.length+' offline checks passed');})().catch(e=>{console.error(e);process.exitCode=1;});
