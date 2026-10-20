// Offline execution of the exact distributable, including both official SDKs.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const base=__dirname,source=fs.readFileSync(path.join(base,fs.existsSync(path.join(base,'jd-jxzy-tasks.js'))?'jd-jxzy-tasks.js':'../Scripts/jd-jxzy-tasks.js'),'utf8');
const ACCOUNT='JXZY_CHECKIN_ACCOUNT_V1',SIGNLOCK='JXZY_CHECKIN_LOCK_V1',P='JXZY_TASKS_V1.';
const encode=o=>{const normal='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',map='rqponmlkjihgfedcbaZYXWVUTSRQPONMLKJIHGFEDCBA-_9876543210zyxwvuts';return [...Buffer.from(JSON.stringify(o)+'x').toString('base64').replace(/=+$/,'')].map(c=>map[normal.indexOf(c)]).reverse().join('');};
const env=(v='h5_file_v5.3.6')=>({v,fp:'offline-reference',pp:{p1:'offline'},extend:{bu6:33,bu13:'F3'},canvas:'a'.repeat(32),webglFp:'b'.repeat(32),sua:'iPhone',pf:'iPhone',ccn:4});
const shared=(v)=>({pin:'offline',headers:{Cookie:'pt_pin=offline; pt_key=FAKE_PRIVATE_COOKIE;', 'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',Referer:'https://pro.m.jd.com/mall/active/2iqSwv1JiDHxAkHAikfU6XAECFmo/index.html'},
 query:{endpoint:'https://api.m.jd.com/api',params:{appid:'jx_h5_babel',client:'jxh5',channel:'jxh5',clientVersion:'1.2.0',uuid:'OFFLINE_DEVICE',functionId:'jxzy_active_querySign',body:JSON.stringify({source:'jxzy',craftId:'6824629a7c46584759d39b78',sceneval:2,buid:325,appCode:'ms1888ebbf',tttId:'ttt2',canInstall:1,installed:0})}},
 signing:{environment:encode(env(v)),eidToken:'FAKE_PRIVATE_EID',source:'jxzy_active_queryActive'},updatedAt:123});
const task=(id,status=1)=>({showTask:1,taskType:3,taskId:id,taskName:'浏览 '+id,taskStatus:status,taskAmount:1,taskProgress:{itemId:'item-'+id,current:status===1?0:1,total:1},extInfo:{browseTask:{browseTime:10,completionFlag:status!==1}}});
async function run({mode='all',profile=shared(),tasks=[task('a'),task('b',10),task('c',20)],store,onWait,onRequest,onWrite,external=false}={}){
 const saved=store||new Map([[ACCOUNT,JSON.stringify(profile)],['JD_CHECKIN_TEST_ACCOUNT_V1','retail untouched'],['QL_BRIDGE_CREDENTIAL_V1','login untouched'],['JXZY_CHECKIN_LAST_RESULT_V1','sign-in result untouched']]);
 const original=saved.get(ACCOUNT),calls=[],logs=[],notes=[],waits=[],timers=[],writes=[];let current=structuredClone(tasks),clock=Date.parse('2026-10-20T01:00:00Z'),finish;
 const done=new Promise(resolve=>finish=resolve);
 function FakeDate(...args){if(new.target)return new Date(...(args.length?args:[clock]));return new Date(clock).toString();}
 Object.setPrototypeOf(FakeDate,Date);FakeDate.prototype=Date.prototype;FakeDate.now=()=>clock;
 const context={Date:FakeDate,console:{log:s=>logs.push(String(s))},$argument:mode,
  $persistentStore:{read:k=>saved.get(k)||'',write:(v,k)=>{assert(k===SIGNLOCK||k.startsWith(P),'unexpected storage write');writes.push(k);if(onWrite&&onWrite({saved,k,v})===false)return false;saved.set(k,v);return true;}},
  $notification:{post:(...a)=>notes.push(a)},$done:()=>finish(),
  setTimeout:(f,ms,...a)=>{const t=setTimeout(()=>{if(ms>=1000){clock+=ms;waits.push(ms);if(onWait)onWait({saved,context,clock,setClock:n=>clock=n});}f(...a);},0);timers.push(t);return t;},clearTimeout,
  $httpClient:{post:(o,cb)=>{
   const params=Object.fromEntries(new URLSearchParams(o.body)),body=JSON.parse(params.body);calls.push({o,params,body});
   assert.equal(o['auto-redirect'],false);assert.equal(o['auto-cookie'],false);assert.equal(o.insecure,false);
   assert.match(o.url,/^https:\/\/api\.m\.jd\.com\/api\?functionId=jxzy_active_task_(queryTaskList|completeTask|rewardTask)$/);
   assert.equal(body.signStr,vm.runInContext('createJxTaskCrypto({setTimeout,clearTimeout,read:(_k,f)=>f,write:()=>{}}).bodySign',context)(body));
   if(onRequest&&onRequest({o,params,body,cb,saved,current,calls}))return;
   let data;
   if(params.functionId.endsWith('queryTaskList'))data={code:0,data:{taskInfoList:current}};
   else {
    assert.equal(params['x-api-eid-token'],'FAKE_PRIVATE_EID');
    const id=current.findIndex(t=>t.taskId===body.taskId);assert(id>=0);assert.equal(current[id].taskProgress.itemId,body.itemId);assert.equal(body.taskType,3);
    const parts=params.h5st.split(';');assert.equal(parts[2],params.functionId.endsWith('completeTask')?'cec1e':'573fe');assert.equal(parts[5],'5.3');
    if(params.functionId.endsWith('completeTask')){assert(waits.length);current[id]=task(body.taskId,10);data={code:0,data:{}};}
    else{assert.equal(current[id].taskStatus,10);current[id]=task(body.taskId,20);data={code:0,data:{prizeInfos:[{prizeType:2,discount:1}]}};}
   }
   cb(null,{status:200},JSON.stringify(data));
  }}
 };
 if(external)context.$request={};
 vm.createContext(context);
 try{vm.runInContext(source,context,{timeout:15000});await Promise.race([done,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('offline test timeout')),20000);timers.push(t);})]);}finally{timers.forEach(clearTimeout);}
 assert.equal(writes.filter(k=>k===ACCOUNT).length,0);
 if(!onWait)assert.equal(saved.get(ACCOUNT),original);
 const output=logs.join('\n')+JSON.stringify(notes)+String(saved.get(P+'last'))+String(saved.get(P+'progress'));
 for(const secret of ['FAKE_PRIVATE_COOKIE','FAKE_PRIVATE_EID','OFFLINE_DEVICE'])assert(!output.includes(secret),'credential in diagnostics');
 for(const [k,v] of [['JD_CHECKIN_TEST_ACCOUNT_V1','retail untouched'],['QL_BRIDGE_CREDENTIAL_V1','login untouched'],['JXZY_CHECKIN_LAST_RESULT_V1','sign-in result untouched']])if(saved.has(k))assert.equal(saved.get(k),v);
 return {saved,calls,logs,notes,waits,result:JSON.parse(saved.get(P+'last')||'null')};
}
(async()=>{
 let n=0,r;
 for(const version of ['h5_file_v5.3.5','h5_file_v5.3.6']){
  r=await run({profile:shared(version)});assert.equal(r.result.confirmedBeans,2);assert.equal(r.result.stopped,false);assert.equal(r.waits.reduce((a,b)=>a+b,0),11000);assert(r.logs.some(s=>s.includes('1/3')));assert.equal(r.saved.get(SIGNLOCK),'');n++;
 }
 r=await run({mode:'query'});assert.equal(r.calls.length,1);assert.equal(r.result.initial.length,3);assert.equal(r.waits.length,0);n++;
 r=await run({mode:'claim'});assert.equal(r.result.confirmedBeans,1);assert(!r.calls.some(x=>x.params.functionId.endsWith('completeTask')));assert.equal(r.waits.length,0);n++;
 r=await run({tasks:[{taskType:1,showTask:1},{taskType:4,showTask:1},task('a',20)]});assert.equal(r.result.skipped,1);assert(!r.calls.some(x=>x.params.h5st));n++;
 r=await run({mode:'status'});assert.equal(r.calls.length,0);assert(r.notes[0][2].includes('暂无'));n++;
 r=await run({profile:null});assert.equal(r.calls.length,0);assert(r.notes[0][2].includes('共享凭据'));n++;
 for(const edit of [p=>p.headers.Cookie='pt_pin=other; pt_key=x;',p=>p.query.endpoint='https://evil.example/',p=>p.signing.environment=encode({...env(),pp:{p1:'other'}}),p=>p.signing.eidToken='',p=>p.query.params.functionId='somethingElse']){
  const p=shared();edit(p);r=await run({profile:p});assert.equal(r.calls.length,0);assert(r.result.stopped);n++;
 }
 const locked=new Map([[ACCOUNT,JSON.stringify(shared())],[SIGNLOCK,JSON.stringify(Date.now()+600000)],[P+'last','{"mode":"query","date":"previous"}']]);
 r=await run({store:locked});assert.equal(r.calls.length,0);assert.equal(r.result.date,'previous');assert(locked.get(SIGNLOCK));n++;
 r=await run({tasks:[task('a')],onWait:({saved})=>saved.set(ACCOUNT,JSON.stringify({...shared(),updatedAt:999}))});assert(r.result.stopped);assert(r.result.message.includes('凭据已更新'));assert(!r.calls.some(x=>x.params.h5st));n++;
 r=await run({tasks:[task('a')],onWait:({setClock,clock})=>setClock(clock+86400000)});assert(r.result.stopped);assert(!r.calls.some(x=>x.params.h5st));n++;
 r=await run({tasks:[task('a',10)],onRequest:({params,cb})=>{if(params.functionId.endsWith('rewardTask')){cb('offline');return true;}}});assert(r.result.stopped);const first=r.calls.length;
 const again=await run({mode:'claim',store:r.saved,tasks:[task('a',10)]});assert(!again.calls.some(x=>x.params.functionId.endsWith('rewardTask')));assert(first>1);n++;
 r=await run({tasks:[task('a',10)],onRequest:({params,cb})=>{if(params.functionId.endsWith('rewardTask')){cb(null,{status:200},'{"code":0,"data":{"prizeInfos":[{"prizeType":2,"discount":1}]}}');return true;}}});assert(r.result.stopped);assert.equal(r.result.claimedBeans,1);assert.equal(r.result.confirmedBeans,0);n++;
 r=await run({onWrite:({k})=>k===SIGNLOCK?false:undefined});assert(r.result.stopped);assert.equal(r.calls.length,0);assert.equal(r.saved.get(P+'lock'),'');n++;
 r=await run({tasks:[task('a',10)],onWrite:({k})=>k.startsWith(P+'attempts.')?false:undefined});assert(r.result.stopped);assert(!r.calls.some(x=>x.params.functionId.endsWith('rewardTask')));n++;
 r=await run({tasks:[task('a',10)],onRequest:({params,cb})=>{if(params.functionId.endsWith('rewardTask')){cb(null,{status:302},'');return true;}}});assert(r.result.stopped);assert.equal(r.calls.filter(x=>x.params.h5st).length,1);n++;
 r=await run({external:true});assert(r.result.stopped);assert.equal(r.calls.length,0);n++;
 const running=new Map([[P+'lock','{"runId":"active","until":9999999999999}'],[P+'progress','{"runId":"active","index":2,"total":8,"title":"浏览测试","phase":"等待 5 秒"}']]);
 r=await run({mode:'status',store:running});assert(r.notes[0][2].includes('2/8'));assert.equal(r.calls.length,0);n++;
 const plugin=fs.readFileSync(path.join(base,fs.existsSync(path.join(base,'jd-jxzy-tasks.plugin'))?'jd-jxzy-tasks.plugin':'../Plugins/jd-jxzy-tasks.plugin'),'utf8');
 assert.equal((plugin.match(/^generic /gm)||[]).length,4);assert(!/^cron |^response |^request |\[Mitm\]/m.test(plugin));n++;
 console.log(n+' offline Loon checks passed: shared credentials, both SDKs, query/wait/complete/claim/verify, progress, locks, credential change, uncertainty and redaction. No live requests.');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
