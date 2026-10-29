// Rotating server-session responses, synthetic account and offline HTTP only.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=fs.existsSync(path.join(__dirname,'../Scripts'))?path.join(__dirname,'..'):path.join(__dirname,'发布包'),file=path.join(root,'Scripts/jd-medical-activity.js'),source=fs.readFileSync(file,'utf8'),api=require(file);
const tests=[],test=(n,f)=>tests.push([n,f]);
const TOKEN='OFFLINE_SESSION_000000000001';
test('absent session header retains compatibility',()=>assert.equal(api.mdaResponseSession({}),null));
for(const name of ['x-rp-sdtoken','X-RP-SDTOKEN','X-Rp-Sdtoken'])test('session header case '+name,()=>assert.deepEqual(api.mdaResponseSession({[name]:'set;1800;'+TOKEN}),{token:TOKEN,ttl:1800}));
test('identical repeated headers are accepted',()=>assert.deepEqual(api.mdaResponseSession({'x-rp-sdtoken':['set;1800;'+TOKEN,'set;1800;'+TOKEN]}),{token:TOKEN,ttl:1800}));
for(const value of ['set;0;'+TOKEN,'set;86401;'+TOKEN,'set;1800;short','set;1800;'+TOKEN+'\r\nx: bad','set;1800;'+TOKEN+';extra','delete;1800;'+TOKEN,'set;abc;'+TOKEN,{},['set;1800;'+TOKEN,'set;1800;OTHER_SESSION_VALUE']])test('invalid session format stops without echoing contents '+tests.length,()=>{assert.throws(()=>api.mdaResponseSession({'x-rp-sdtoken':value}),e=>e.message==='医药活动会话参数异常，已停止');});
const COOKIE='pt_key=OFFLINE_KEY;pt_pin=offline;';
const task=()=>({encryptAssignmentId:'OFFLINE_TASK',assignmentName:'天天逛特价2元也包邮',assignmentType:1,assignmentDesc:'浏览5s',timeStatus:1,completionFlag:false,completionCnt:0,assignmentTimesLimit:1,itemId:'123',url:'https://pro.m.jd.com/offline/',rewardsList:[{rewardType:3,rewardValue:1}]});
async function runtime({bundle=source,recheckOnly=false,hideSession=false,normalCookie=false,badHeader=false,failComplete=false,shortTTL=false}={}){
 let clock=Date.now(),count=0,reads=0,doneCount=0,finish,issued='CAPTURED_SESSION_OFFLINE';const requests=[],notes=[],logs=[],state=new Map(),timers=new Set();
 class Clock extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
 const profile={pin:'offline',environment:'FAKE',eidToken:'OFFLINE_EID',headers:{Cookie:COOKIE+'sdtoken='+issued+';page=keep;','User-Agent':'Offline',Referer:api.MDA_PAGE,Origin:'https://pro.m.jd.com'},device:{client:'iOS',uuid:'OFFLINE_UUID'}};
 state.set(api.MDA_KEY,JSON.stringify(profile));state.set('JD_SIGNIN_LOGIN_V1',JSON.stringify({pin:'offline',cookie:COOKIE}));const originalProfile=state.get(api.MDA_KEY),originalLogin=state.get('JD_SIGNIN_LOGIN_V1');
 const completed=new Promise(resolve=>finish=resolve),math=Object.create(Math);math.random=()=>0;
 const ctx=vm.createContext({Date:Clock,Math:math,console:{log:s=>logs.push(String(s))},setTimeout:(f,ms)=>{const id=setTimeout(()=>{timers.delete(id);clock+=ms;f();},0);timers.add(id);return id;},clearTimeout:id=>{timers.delete(id);clearTimeout(id);},$persistentStore:{read:k=>state.get(k)||'',write:(v,k)=>{if(v===undefined)state.delete(k);else state.set(k,v);return true;}},$notification:{post:(...a)=>notes.push(a)},$done:()=>{doneCount++;finish();},$httpClient:{post:(o,cb)=>{
  const f=api.mdaForm(o.body).functionId,cookie=o.headers.Cookie,token=/(?:^|;\s*)sdtoken=([^;]+)/.exec(cookie)?.[1];requests.push({f,cookie,time:clock});
  assert.equal(o['auto-cookie'],false);assert.equal(o['auto-redirect'],false);assert(o.url.startsWith('https://api.m.jd.com/'));
  const checking=!recheckOnly||f==='market_daily_pageIndex'&&reads>0;
  const accepted=(!checking||token===issued)&&!(failComplete&&f==='market_daily_doCompleteTask');
  if(!accepted){cb(null,{status:403,headers:{'X-RP-SDTOKEN':'set;1800;FAILED_RESPONSE_SESSION'}},'{}');return;}
  issued='OFFLINE_SESSION_'+String(++count).padStart(12,'0');
  const responseHeaders=normalCookie?{'Set-Cookie':['qid_uid=OFFLINE_QID; Path=/','sdtoken='+issued+'; Path=/']}:{'X-Rp-Sdtoken':'set;'+(shortTTL?'1':'1800')+';'+issued,'Set-Cookie':'qid_uid=OFFLINE_QID; Path=/'};
  if(hideSession)delete responseHeaders['X-Rp-Sdtoken'];if(badHeader)responseHeaders['X-Rp-Sdtoken']='set;1800;PRIVATE_INVALID_VALUE;extra';
  let data,code='0000';if(f==='market_daily_pageIndex'){const t=task();if(reads++){t.completionFlag=true;t.completionCnt=1;}data={assignmentList:[t]};}else if(f==='jdh_bm_balanceBeans'){data=100;code=0;}else data={};
  cb(null,{status:200,headers:responseHeaders},JSON.stringify({success:true,code,data}));
 }}});
 const cut=bundle.lastIndexOf("if(typeof $persistentStore!==");vm.runInContext(bundle.slice(0,cut),ctx,{timeout:5000});
 vm.runInContext("createSigninCrypto=function(){return {hash:function(x){return 'HASH_'+x;},decodeEnvironment:function(){return {pp:{p1:'offline'}};},signOnline:async function(){return 'a;b;4b818;FRESH;e;5.3;g;FAKE;i;j';}};};",ctx);
 try{vm.runInContext(bundle.slice(cut),ctx,{timeout:5000});await Promise.race([completed,new Promise((_,reject)=>setTimeout(()=>reject(Error('offline runtime timeout')),2000))]);}finally{for(const id of timers)clearTimeout(id);}
 assert.equal(doneCount,1);assert.equal(state.get(api.MDA_KEY),originalProfile);assert.equal(state.get('JD_SIGNIN_LOGIN_V1'),originalLogin);assert(!state.has('JD_ACTIVITY_MANUAL_V1.lock'));
 for(const s of [...logs,...notes.map(x=>JSON.stringify(x))])assert(!/OFFLINE_KEY|OFFLINE_SESSION|OFFLINE_EID|CAPTURED_SESSION|PRIVATE_INVALID_VALUE/.test(s));
 return {requests,logs,notes,state,report:JSON.parse(state.get('JD_MEDICAL_ACTIVITY_MANUAL_V1.last'))};
}
test('actual Loon adapter carries each rotating session to the next business request',async()=>{const r=await runtime();assert.equal(r.report.confirmed,1);assert.equal(r.report.submitted,1);assert.equal(r.report.sessionRefreshes,5);assert.equal(r.report.stopped,false);assert.equal(r.requests.length,5);for(let i=1;i<5;i++)assert(r.requests[i].cookie.includes('sdtoken=OFFLINE_SESSION_'+String(i).padStart(12,'0')));});
test('ordinary Set-Cookie still updates session and page cookies',async()=>{const r=await runtime({normalCookie:true});assert.equal(r.report.confirmed,1);assert.equal(r.report.sessionRefreshes,0);assert(r.requests[1].cookie.includes('qid_uid=OFFLINE_QID;'));assert(r.requests[1].cookie.includes('page=keep;'));});
test('missing rotation reproduces rejection on the first post-submission list refresh',async()=>{const r=await runtime({hideSession:true,recheckOnly:true});assert.equal(r.report.confirmed,0);assert.equal(r.report.submitted,1);assert(r.report.message.includes('查询任务 HTTP 403'));assert.equal(r.requests.filter(x=>x.f==='market_daily_doCompleteTask').length,1);});
test('malformed response session stops before a mutation',async()=>{const r=await runtime({badHeader:true});assert(r.report.stopped);assert(r.report.message.includes('会话参数异常'));assert.equal(r.requests.length,1);});
test('expired response session stops instead of sending it again',async()=>{const r=await runtime({shortTTL:true});assert(r.report.stopped);assert(r.report.message.includes('会话已过期'));assert.equal(r.requests.length,1);});
test('403 does not refresh the session or trigger a retry',async()=>{const r=await runtime({failComplete:true});assert(r.report.stopped);assert.equal(r.report.sessionRefreshes,2);assert.equal(r.requests.length,3);assert.equal(r.report.submitted,0);});
if(process.argv[2])test('previous published adapter reproduces the missing-session regression offline',async()=>{const old=fs.readFileSync(process.argv[2],'utf8'),r=await runtime({bundle:old,recheckOnly:true});assert.equal(r.report.confirmed,0);assert.equal(r.report.submitted,1);assert(r.report.message.includes('查询任务 HTTP 403'));});
(async()=>{for(const [name,fn]of tests){try{await fn();}catch(e){console.error(name);throw e;}}console.log(tests.length+' medical session checks passed; synthetic HTTP only');})().catch(e=>{console.error(e);process.exitCode=1;});
