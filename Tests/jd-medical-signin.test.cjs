// Synthetic fixtures. No account traffic or copied HAR identities.
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const root=path.join(__dirname,'../Scripts'),api=require(path.join(root,'jd-signin.js')),cap=require(path.join(root,'jd-signin-capture.js'));
const {JSM_KEY:KEY,JSM_PAGE:PAGE,JSM_QUERY:QUERY,JSM_CLAIM:CLAIM,JS_KEYS:K}=api;
const day=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
const env=()=>({v:'h5_file_v5.3.6',fp:'offline-fixture',pp:{p1:'offline'},extend:{bu6:33,bu13:'F3'},canvas:'a'.repeat(32),webglFp:'b'.repeat(32)});
const encode=e=>{const a='rqponmlkjihgfedcbaZYXWVUTSRQPONMLKJIHGFEDCBA-_9876543210zyxwvuts',b='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';return [...Buffer.from(JSON.stringify(e)+'x').toString('base64').replace(/=+$/,'')].map(c=>a[b.indexOf(c)]).reverse().join('');};
const sig=(app='4b818',e=env())=>['date','1234567890123456',app,'tk03_fixture','hash','5.3','time',encode(e),'hash','fields'].join(';');
const headers=()=>({Cookie:'pt_pin=offline;pt_key=FAKE_SECRET;page=kept;','User-Agent':'offline-ios-webview',Referer:PAGE,'x-referer-page':PAGE});
const form=o=>Object.entries(o).map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&');
const reply=j=>({status:200,body:JSON.stringify(j)});
const task=(done=false)=>({assignmentType:5,assignmentDesc:'每日签到',encryptAssignmentId:'fresh_sign_id',completionFlag:done,completionCnt:done?1:0,assignmentTimesLimit:1,timeStatus:1,signDetail:{status:done?2:1,continueSignDay:done?5:4,signList:done?[day()+'_1.0']:[]}});
const page=(done=false)=>({code:'0000',success:true,data:{assignmentList:[{assignmentType:1,assignmentDesc:'浏览5秒',encryptAssignmentId:'browse_id'},task(done)]}});
const claim=q=>({code:'0000',success:true,data:{successRewards:[{rewardType:3,rewardName:'京豆',quantity:q}]}});
const req=(f=QUERY,b={taskVersion:1,channel:'daily'})=>({method:'POST',url:'https://api.m.jd.com/api?functionId='+f,headers:headers(),body:form({functionId:f,appid:'jdh-middle',body:JSON.stringify(b),h5st:sig(),'x-api-eid-token':'FAKE_DEVICE'})});
function host(){
 const map=new Map(),calls=[],signs=[];
 const h={map,calls,signs,pin:'offline',day,guard:()=>{},log:()=>{},read:(k,f)=>map.has(k)?JSON.parse(map.get(k)):f,write:(k,v)=>{map.set(k,JSON.stringify(v));},rawRead:k=>map.get(k)||'',rawWrite:(v,k)=>{map.set(k,v);return true;},observedAt:Date.now()};
 h.write(K.bound,{pin:'offline'});h.write(K.login,{pin:'offline',cookie:'pt_pin=offline;pt_key=FRESH;',headers:headers(),capturedAt:Date.now()});
 h.write(KEY,{pin:'offline',headers:headers(),environment:encode(env()),eidToken:'FAKE_DEVICE',capturedAt:Date.now()});
 h.login=()=>api.jsLogin(h.read).login;
 h.request=async(t,o)=>{api.jsTarget(t,o);calls.push(o);return h.reply(o);};
 h.crypto={hash:s=>crypto.createHash('sha256').update(s).digest('hex'),decodeEnvironment:cap.farmDecodeEnvironment,signOnline:async(a,p,e,i)=>{signs.push({a,p,e,i});return sig(a);}};
 return h;
}
const run=h=>api.createExtraSignins(h,h.crypto).run('medical');
const capture=(h,r,j)=>cap.jsCapture(h,r,reply(j),{},cap.farmDecodeEnvironment);
let total=0;async function test(name,f){await f();total++;console.log('OK '+name);}
(async()=>{
 await test('first medical sign-in can omit history; signed status still requires it',async()=>{
  const h=host(),pending=page(false),signed=page(true);
  delete pending.data.assignmentList[1].signDetail.signList;
  assert.equal(api.jsMedicalState(pending,day()).done,false);
  let calls=0;
  h.reply=()=>reply(++calls===1?pending:calls===2?claim(1):signed);
  assert.equal((await run(h)).status,'signed_confirmed');
  delete signed.data.assignmentList[1].signDetail.signList;
  assert.throws(()=>api.jsMedicalState(signed,day()));
 });
 await test('medical is separate from both existing kit sign-ins',()=>{assert.deepEqual(api.JS_TASKS.slice(7,8),[['medical','看病买药签到']]);assert.equal(api.JS_TASKS.length,17);assert(!api.JS_TASKS.some(x=>['hs','ys','delivery','game'].includes(x[0])));assert(!api.JS_TASKS.some(x=>x[0]==='plant'));});
 await test('already signed today makes one query and no claim',async()=>{const h=host();h.reply=()=>reply(page(true));const r=await run(h);assert.equal(r.status,'already_done');assert.equal(r.beanQuantity,undefined);assert.equal(h.calls.length,1);});
 await test('fresh ID, exact claim scope, fresh Cookie and explicit one-bean reward',async()=>{
  const h=host();let done=false;h.reply=o=>{const p=api.jsParams(o),b=JSON.parse(p.body);assert.equal(p.appid,'jdh-middle');assert.equal(p.h5st.split(';')[2],'4b818');assert(o.headers.Cookie.includes('FRESH'));assert(o.headers.Cookie.includes('page=kept'));assert(!o.headers.Cookie.includes('FAKE_SECRET'));
   if(p.functionId===QUERY){assert.deepEqual(b,{taskVersion:1,channel:'daily'});return reply(page(done));}
   assert.equal(p.functionId,CLAIM);assert.deepEqual(b,{assignmentType:5,encryptAssignmentId:'fresh_sign_id',actionType:0,channel:'daily'});done=true;return reply(claim(1));};
  const r=await run(h);assert.equal(r.status,'signed_confirmed');assert.equal(r.beanQuantity,1);assert.equal(h.calls.length,3);assert(api.jsLine({task:'medical',...r}).includes('1 京豆'));
  for(const s of h.signs){assert.equal(s.a,'4b818');assert.deepEqual(Object.keys(s.i).sort(),['appid','body','functionId']);assert.equal(s.p.pin,'offline');}
 });
 await test('no profile never invents device material or sends requests',async()=>{const h=host();h.map.delete(KEY);await assert.rejects(()=>run(h),/缺少/);assert.equal(h.calls.length,0);});
 await test('existing retired medical profile is usable for sign-in only',async()=>{const h=host();h.write('JD_MEDICAL_ACTIVITY_ACCOUNT_V1',h.read(KEY));h.map.delete(KEY);h.reply=()=>reply(page(true));assert.equal((await run(h)).status,'already_done');assert.equal(h.calls.length,1);});
 await test('wrong-account profile sends no traffic',async()=>{const h=host();h.write(KEY,{...h.read(KEY),pin:'other'});await assert.rejects(()=>run(h),/账号/);assert.equal(h.calls.length,0);});
 await test('signature account mismatch sends no traffic',async()=>{const h=host();h.write(KEY,{...h.read(KEY),environment:encode({...env(),pp:{p1:'other'}})});await assert.rejects(()=>run(h),/账号/);assert.equal(h.calls.length,0);});
 await test('HTTP 200 business rejection is not success',async()=>{const h=host();h.reply=o=>reply(api.jsParams(o).functionId===QUERY?page(false):{code:'DENIED',success:false,data:{}});assert.equal((await run(h)).status,'rejected');assert.equal(h.calls.length,2);});
 await test('network failure after claim is journaled and cannot duplicate',async()=>{const h=host();h.reply=o=>{if(api.jsParams(o).functionId===QUERY)return reply(page(false));throw Error('network');};await assert.rejects(()=>run(h));assert.equal((await run(h)).status,'pending');assert.equal(h.calls.filter(o=>api.jsParams(o).functionId===CLAIM).length,1);});
 await test('known reward survives failed state verification without a success claim',async()=>{const h=host();let n=0;h.reply=()=>++n===1?reply(page(false)):n===2?reply(claim(1)):{status:403,body:'{}'};const r=await run(h);assert.equal(r.status,'pending');assert.equal(r.beanQuantity,1);h.reply=()=>reply(page(false));assert.equal((await run(h)).beanQuantity,1);assert.equal(h.calls.filter(o=>api.jsParams(o).functionId===CLAIM).length,1);});
 await test('pending state can be resolved by a later query without resubmission',async()=>{const h=host();let n=0;h.reply=()=>reply(++n===1?page(false):n===2?claim(1):page(false));assert.equal((await run(h)).status,'pending');h.reply=()=>reply(page(true));const r=await run(h);assert.equal(r.status,'already_done');assert.equal(r.beanQuantity,1);assert.equal(h.calls.filter(o=>api.jsParams(o).functionId===CLAIM).length,1);});
 for(const [name,change] of [
  ['yesterday status',t=>{t.signDetail.status=2;t.completionCnt=1;t.completionFlag=true;}],
  ['conflicting today record',t=>{t.signDetail.signList=[day()+'_1.0'];}],
  ['inactive task',t=>{t.timeStatus=0;}],
  ['malformed sign dates',t=>{t.signDetail.signList=null;}]
 ])await test(name+' prevents a claim',async()=>{const h=host(),j=page(false);change(j.data.assignmentList[1]);h.reply=()=>reply(j);await assert.rejects(()=>run(h));assert.equal(h.calls.length,1);});
 await test('multiple sign-in tasks stop rather than guessing',async()=>{const h=host(),j=page(false);j.data.assignmentList.push({...task(),encryptAssignmentId:'other'});h.reply=()=>reply(j);await assert.rejects(()=>run(h));assert.equal(h.calls.length,1);});
 await test('rotated task ID does not confirm a different task',async()=>{const h=host();let n=0;h.reply=()=>{const j=++n===1?page(false):n===2?claim(1):page(true);if(n===3)j.data.assignmentList[1].encryptAssignmentId='changed';return reply(j);};const r=await run(h);assert.equal(r.status,'pending');assert.equal(r.beanQuantity,1);});
 await test('missing or malformed quantity never assumes one or uses planned rewards',()=>{for(const q of [undefined,null,'1',true,-1,1.5,10001])assert.deepEqual(api.jsMedicalReward(claim(q)),{});assert.deepEqual(api.jsMedicalReward({code:'0000',success:true,data:{successRewards:[{rewardType:3,rewardValue:1}]}}),{});assert.deepEqual(api.jsMedicalReward(claim(0)),{beanQuantity:0});});
 await test('request gate rejects browse action and wrong protocol scope',()=>{
  for(const b of [{assignmentType:1,actionType:1,encryptAssignmentId:'browse',channel:'daily'},{assignmentType:5,actionType:1,encryptAssignmentId:'sign',channel:'daily'},{assignmentType:5,actionType:0,encryptAssignmentId:'sign',channel:'other'}])assert.throws(()=>api.jsTarget('medical',req(CLAIM,b)));
  const r=req();r.body=r.body.replace('jdh-middle','OTHER');assert.throws(()=>api.jsTarget('medical',r));assert.throws(()=>api.jsTarget('medical',req('jdh_bm_balanceBeans',{})));
 });
 await test('successful passive capture saves minimal material and no one-time task IDs',async()=>{const h=host();h.map.delete(KEY);const r=await capture(h,req(),page());assert(r.updated.includes(KEY));const saved=h.rawRead(KEY);assert(!saved.includes('fresh_sign_id'));assert(!saved.includes('tk03_fixture'));assert(!saved.includes('assignmentList'));assert.equal(h.read(KEY).eidToken,'FAKE_DEVICE');assert.equal(h.calls.length,0);});
 await test('sign-in response also supplies credentials',async()=>{const h=host();h.map.delete(KEY);assert((await capture(h,req(CLAIM,{assignmentType:5,actionType:0,encryptAssignmentId:'fresh',channel:'daily'}),claim(1))).updated.includes(KEY));});
 await test('medical browse claim cannot refresh credentials',async()=>{const h=host();h.map.delete(KEY);assert.equal(await capture(h,req(CLAIM,{assignmentType:1,actionType:1,encryptAssignmentId:'browse',channel:'daily'}),claim(1)),null);assert(!h.read(KEY));});
 await test('partial Cookie capture reuses only the verified same-account login',async()=>{const h=host();h.map.delete(KEY);const r=req();r.headers.Cookie='page=kept;';assert((await capture(h,r,page())).updated.includes(KEY));assert(h.read(KEY).headers.Cookie.includes('FRESH'));});
 await test('conflicting partial Cookie cannot borrow canonical login',async()=>{const h=host();h.map.delete(KEY);const r=req();r.headers.Cookie='pt_pin=other;';assert.equal(await capture(h,r,page()),null);assert(!h.read(KEY));});
 await test('capture rejects wrong signature app, account, page and rejected response',async()=>{
  for(const change of [r=>{r.headers.Referer='https://example.com/';delete r.headers['x-referer-page'];},r=>{const p=api.jsParams(r);p.h5st=sig('wrong');r.body=form(p);},r=>{const p=api.jsParams(r);p.h5st=sig('4b818',{...env(),pp:{p1:'other'}});r.body=form(p);}]){const h=host();h.map.delete(KEY);const r=req();change(r);assert.equal(await capture(h,r,page()),null);assert(!h.read(KEY));}
  const h=host();h.map.delete(KEY);await assert.rejects(()=>capture(h,req(),{success:false,code:'403'}));assert(!h.read(KEY));
 });
 await test('late capture does not replace newer device material',async()=>{const h=host();h.write(KEY,{...h.read(KEY),capturedAt:h.observedAt+1000,eidToken:'NEWER'});assert.equal(await capture(h,req(),page()),null);assert.equal(h.read(KEY).eidToken,'NEWER');});
 for(const name of ['jd-signin-capture.js','jd-activity-capture.js'])await test('first-match runtime captures sign-in without changing response: '+name,async()=>{
  const h=host();h.map.delete(KEY);let result,notes=[];
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('capture timeout')),1000);const context={$request:req(),$response:reply(page()),$persistentStore:{read:h.rawRead,write:h.rawWrite},$script:{startTime:new Date().toISOString()},$notification:{post:(...x)=>notes.push(x)},$done:x=>{result=x;clearTimeout(timer);resolve();},console:{log:()=>{}},setTimeout,clearTimeout};try{vm.runInNewContext(fs.readFileSync(path.join(root,name),'utf8'),context,{timeout:5000});}catch(e){clearTimeout(timer);reject(e);}});
  assert(h.read(KEY));assert(!result?.body);assert(!JSON.stringify(notes).includes('FAKE_SECRET'));assert(!JSON.stringify(notes).includes('FAKE_DEVICE'));
 });
 await test('activity plugin keeps retired medical and finance entries removed',()=>{const p=fs.readFileSync(path.join(__dirname,'../Plugins/jd-activities.plugin'),'utf8');assert(!/jd-(?:medical-activity|jr-beans)/.test(p));assert.equal((p.match(/^generic /gm)||[]).length,6);});
 await test('combined runner executes the new task inside its existing timeout and lock scope',async()=>{
  const h=host();Object.assign(h,{now:()=>Date.now(),random:()=>0.5,sleep:async()=>{},setTimeout,clearTimeout});let done=false;
  h.reply=o=>{const p=api.jsParams(o);if(p.functionId==='jdh_bm_getKitTask')return reply({code:0,result:{status:4}});if(p.functionId===QUERY)return reply(page(done));assert.equal(p.functionId,CLAIM);done=true;return reply(claim(1));};
  const r=await api.createSignins(h,{},h.crypto).run({gapSeconds:0}),row=r.results.find(x=>x.task==='medical');assert(r.finished);assert.equal(row.status,'signed_confirmed');assert.equal(row.beanQuantity,1);assert(!h.rawRead(K.lock));
 });
 for(const version of ['h5_file_v5.3.5','h5_file_v5.3.6'])await test('embedded SDK signs medical query and claim using offline algorithm: '+version,async()=>{
  const cache=new Map();let count=0;
  const c=api.createSigninCrypto({read:(k,f)=>cache.get(k)||f,write:(k,v)=>cache.set(k,v),setTimeout:()=>0,clearTimeout:()=>{},progress:()=>{},requestAlgo:async o=>{count++;assert(!Object.keys(o.headers).some(k=>/cookie|authorization/i.test(k)));assert.equal(o.url,'https://cactus.jd.com/request_algo');const b=JSON.parse(o.body);assert.equal(b.appId,'4b818');return reply({status:200,data:{ts:Date.now(),result:{fp:b.fp,tk:'tk03'+'a'.repeat(88),algo:'function test(tk,fp,ts,ai,algo){return algo.HmacSHA256(tk+fp+ts+ai,"offline");}'}}});}});
  for(const [f,b] of [[QUERY,{taskVersion:1,channel:'daily'}],[CLAIM,{assignmentType:5,encryptAssignmentId:'fresh',actionType:0,channel:'daily'}]]){
   const signature=await c.signOnline('4b818',{pin:'offline',headers:headers()},{...env(),v:version},{appid:'jdh-middle',body:c.hash(JSON.stringify(b)),functionId:f});assert.equal(signature.split(';')[2],'4b818');assert.equal(signature.split(';')[3],'tk03'+'a'.repeat(88));
  }
  assert.equal(count,1);
 });
 console.log(total+' medical sign-in checks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
