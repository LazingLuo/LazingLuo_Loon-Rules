// Offline account and response fixtures only. No real JD requests.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm'),crypto=require('crypto');
const root=path.join(__dirname,'../Scripts'),api=require(path.join(root,'jd-signin.js')),cap=require(path.join(root,'jd-signin-capture.js'));
const {TJ_KEY:KEY,TJ_QUERY:QUERY,TJ_DO:DO,TJ_PAGE:PAGE,TJ_ENCODING:ENC,JS_KEYS:K}=api;
const day=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
const env=()=>({v:'h5_file_v5.3.6',fp:'offline-fixture',pp:{p1:'offline'},extend:{bu6:33,bu13:'F3'},canvas:'a'.repeat(32),webglFp:'b'.repeat(32)});
const encode=e=>{const a='rqponmlkjihgfedcbaZYXWVUTSRQPONMLKJIHGFEDCBA-_9876543210zyxwvuts',b='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';return [...Buffer.from(JSON.stringify(e)+'x').toString('base64').replace(/=+$/,'')].map(c=>a[b.indexOf(c)]).reverse().join('');};
const sig=(e=env(),app='35fa0',encoding=ENC)=>['date','1234567890123456',app,'tk03_fixture','hash','5.3','time',encode(e),'hash',encoding].join(';');
const headers=()=>({Cookie:'pt_pin=offline;pt_key=OLD;page=kept;','User-Agent':'jdapp;iPhone;16.1.81;27.0;network/wifi;',Referer:PAGE,'x-referer-page':PAGE});
const params=()=>({appid:'newtry',client:'apple',clientVersion:'16.1.81',loginType:'2','x-api-eid-token':'FAKE_DEVICE'});
const form=p=>Object.entries(p).map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&');
const response=j=>({status:200,body:JSON.stringify(j)});
const list=tasks=>({code:0,data:{bizCode:0,result:{taskInfo:{taskList:tasks}}}});
const action=(subCode='0',n)=>({code:0,data:{bizCode:0,result:{assignmentResult:{subCode,rewardsInfo:n===undefined?{}:{successRewards:{3:[{rewardType:3,quantity:n}]}}}}}});
const signTask=done=>({encryptAssignmentId:'sign_id',assignmentName:'特价天天签到',assignmentType:5,completionFlag:done,completionCnt:done?1:0,assignmentTimesLimit:1,canReceiveTimes:0,canParticipation:true,timeStatus:1,rewards:[{rewardType:3}],ext:{extraType:'sign',outerTaskType:13,sign1:{status:done?2:1,itemId:'1',signList:done?[day()+'_2.0']:[]}}});
const visit=(extra={})=>({encryptAssignmentId:'visit_id',assignmentName:'逛活动页面领5京豆',assignmentDesc:'每个页面浏览10秒',assignmentType:1,completionCnt:0,assignmentTimesLimit:2,completionFlag:false,canReceiveTimes:0,canParticipation:true,timeStatus:1,appJumpType:'',appType:'',rewards:[{rewardType:3}],ext:{extraType:'shoppingActivity',outerTaskType:9,waitDuration:10,shoppingActivity:[{itemId:'item_A',status:1,url:'https://pro.m.jd.com/mall/active/offlineA/index.html'},{itemId:'item_B',status:1,url:'https://pro.m.jd.com/mall/active/offlineB/index.html'}]},...extra});
function host(){
 const map=new Map(),calls=[],waits=[],signs=[];let currentDay=day();
 const h={map,calls,waits,signs,pin:'offline',now:()=>Date.now(),random:()=>0.5,day:()=>currentDay,changeDay:d=>currentDay=d,guard:()=>{},setTimeout,clearTimeout,log:()=>{},read:(k,f)=>map.get(k)||f,write:(k,v)=>map.set(k,v),sleep:async ms=>waits.push(ms),request:async(t,o)=>{calls.push(o);return h.reply(o);}};
 h.write(K.bound,{pin:'offline'});h.write(K.login,{pin:'offline',cookie:'pt_pin=offline;pt_key=NEW;',headers:headers(),capturedAt:Date.now()});
 h.write(KEY,{pin:'offline',headers:headers(),params:params(),query:{ext:{queryReceiveTimes:1},extMap:{sceneType:2},channelId:'16'},environment:encode(env()),capturedAt:Date.now()});
 h.crypto={hash:s=>crypto.createHash('sha256').update(s).digest('hex'),decodeEnvironment:cap.farmDecodeEnvironment,signOnline:async(a,p,e,i)=>{signs.push({a,p,e,i});return sig();}};
 return h;
}
const client=h=>api.createSpecialClient(h,h.crypto);
const req=()=>({method:'POST',url:'https://api.m.jd.com/',headers:headers(),body:form({...params(),functionId:QUERY,t:'123',body:JSON.stringify({ext:{queryReceiveTimes:1},extMap:{sceneType:2},channelId:'16'}),h5st:sig()})});
const capture=(h,r,j)=>cap.jsCapture(h,r,response(j),{},cap.farmDecodeEnvironment);
let count=0;async function test(n,f){await f();count++;console.log('OK '+n);}
(async()=>{
 await test('all four Faker-derived entries and dormant API implementations removed',()=>{
  for(const name of ['jd-signin.js','jd-signin-capture.js','jd-activity-capture.js','jd-splash.js','jd-signin-shortcut.js','jd-coupon-activity.js']){
   const s=fs.readFileSync(path.join(root,name),'utf8');assert(!/jdh_bm_getKitTask|jdh_msoa_doTaskGw|bean_deliverySign_|const JS_HEALTH|const JS_GAME/.test(s),name);
  }
  assert.equal(api.JS_TASKS.length,9);assert(!api.JS_TASKS.some(x=>['hs','ys','delivery','game','plant'].includes(x[0])));
  const bridge=require(path.join(root,'jd-signin-shortcut.js'));assert.equal(bridge.JS_TASKS.length,6);
 });
 await test('retired routes cannot be dispatched through the runner or request gate',async()=>{const h=host();for(const t of ['hs','ys','delivery','game']){assert.throws(()=>api.createExtraSignins({...h,login:()=>h.read(K.login)},h.crypto).run(t));assert.throws(()=>api.jsTarget(t,{url:'https://api.m.jd.com/api',body:form({functionId:'jdh_bm_getKitTask',body:'{}'})}));}assert.equal(h.calls.length,0);});
 await test('already-signed state selects only bean sign, excluding separate cash sign',async()=>{const h=host();h.reply=()=>response(list([{...signTask(false),encryptAssignmentId:'cash_id',assignmentName:'特价天天签到0.3',rewards:[{rewardType:4}]},signTask(true)]));assert.equal((await client(h).sign()).status,'already_done');assert.equal(h.calls.length,1);});
 await test('sign follows public CHECK_TASK strategy and confirms today record with explicit quantity',async()=>{
  const h=host();let done=false;h.reply=o=>{const p=api.jsParams(o),b=JSON.parse(p.body);assert(o.headers.Cookie.includes('NEW'));assert(!o.headers.Cookie.includes('OLD'));if(p.functionId===QUERY)return response(list([signTask(done)]));assert.equal(p.functionId,DO);assert.deepEqual(b,{channelId:'16',itemId:'1',assignmentId:'sign_id',ext:{doReceiveRewards:null}});done=true;return response(action('0',2));};
  const r=await client(h).sign();assert.equal(r.status,'signed_confirmed');assert.equal(r.beanQuantity,2);assert.equal(h.calls.length,3);
 });
 await test('unconfirmed sign cannot submit again and does not invent a reward',async()=>{const h=host();h.reply=o=>response(api.jsParams(o).functionId===QUERY?list([signTask(false)]):action());assert.equal((await client(h).sign()).status,'pending');assert.equal((await client(h).sign()).status,'pending');assert.equal(h.calls.filter(o=>api.jsParams(o).functionId===DO).length,1);});
 await test('sign dates that disagree with flags cannot initiate a claim',async()=>{const h=host(),t=signTask(true);t.ext.sign1.signList=[];h.reply=()=>response(list([t]));await assert.rejects(()=>client(h).sign());assert.equal(h.calls.length,1);});
 await test('query list missing the sign-in does not guess another task',async()=>{const h=host();h.reply=()=>response(list([visit()]));await assert.rejects(()=>client(h).sign());assert.equal(h.calls.length,1);});
 await test('a corrupt journal stops before any task mutation',async()=>{const h=host();h.write('JD_SPECIAL_CHANNEL_ATTEMPTS_V1',[]);h.reply=()=>response(list([signTask(false)]));await assert.rejects(()=>client(h).sign());assert.equal(h.calls.length,1);});
 await test('two ordinary items each receive, count down, complete, claim and verify',async()=>{
  const h=host(),t=visit();let phase='',current;
  h.reply=o=>{const p=api.jsParams(o),b=JSON.parse(p.body);if(p.functionId===QUERY)return response(list([t]));assert.equal(b.channelId,'16');assert.equal(b.assignmentId,t.encryptAssignmentId);current=t.ext.shoppingActivity.find(i=>i.itemId===b.itemId);assert(current);
   if(b.actionType===1){assert.equal(b.ext.jumpUrl,current.url);assert.equal(current.status,1);phase='started';return response(action('1'));}
   if(b.ext.doReceiveRewards===null){assert.equal(phase,'started');assert.equal(h.waits.at(-1),11000);current.status=2;t.completionCnt++;t.canReceiveTimes=1;t.completionFlag=t.completionCnt===2;phase='complete';return response(action());}
   assert.equal(b.actionType,0);assert.equal(b.ext.doReceiveRewards,1);assert.equal(phase,'complete');t.canReceiveTimes=0;phase='claimed';return response(action('0',1));};
  const r=await client(h).browse();assert(!r.stopped,r.message);assert.equal(r.confirmed,2);assert.equal(r.beanQuantity,2);assert.equal(r.submissions,2);assert.deepEqual(h.waits,[11000,11000]);assert.equal(h.calls.filter(o=>api.jsParams(o).functionId===DO).length,6);
  for(const s of h.signs){assert.equal(s.a,'35fa0');assert.deepEqual(Object.keys(s.i).sort(),['appid','body','client','clientVersion','functionId','t']);}
 });
 await test('server must show both counter growth and matching completed item',async()=>{const h=host();h.reply=o=>response(api.jsParams(o).functionId===QUERY?list([visit()]):action(JSON.parse(api.jsParams(o).body).actionType===1?'1':'0'));const r=await client(h).browse();assert.equal(r.confirmed,0);assert.equal(r.beanQuantity,0);assert(r.rows[0].result.includes('待App确认'));assert.equal(h.calls.filter(o=>JSON.parse(api.jsParams(o).body).ext?.doReceiveRewards===1).length,0);});
 await test('business rejection stops the run without retry or other task submission',async()=>{const h=host();h.reply=o=>response(api.jsParams(o).functionId===QUERY?list([visit(),{...visit(),encryptAssignmentId:'later'}]):{code:0,data:{bizCode:403,result:{}}});const r=await client(h).browse();assert(r.stopped);assert.equal(r.confirmed,0);assert.equal(h.calls.length,2);await client(h).browse();assert.equal(h.calls.filter(o=>api.jsParams(o).functionId===DO&&JSON.parse(api.jsParams(o).body).assignmentId==='visit_id').length,1);});
 await test('a started but interrupted item is not replayed',async()=>{const h=host();h.reply=o=>{if(api.jsParams(o).functionId===QUERY)return response(list([visit()]));throw Error('network');};assert((await client(h).browse()).stopped);assert(!(await client(h).browse()).stopped);assert.equal(h.calls.filter(o=>api.jsParams(o).functionId===DO).length,1);});
 await test('existing completed reward can be claimed without repeating the visit',async()=>{const h=host(),t=visit();t.ext.shoppingActivity[0].status=2;t.canReceiveTimes=1;t.completionCnt=1;t.completionFlag=true;h.reply=o=>{if(api.jsParams(o).functionId===QUERY)return response(list([t]));const b=JSON.parse(api.jsParams(o).body);assert.equal(b.actionType,0);assert.equal(b.ext.doReceiveRewards,1);t.canReceiveTimes=0;return response(action('0',4));};const r=await client(h).browse();assert.equal(r.beanQuantity,4);assert.equal(r.submissions,0);assert.equal(h.waits.length,0);});
 for(const [name,change] of [
  ['video',t=>t.assignmentName='看视频领1京豆'],['product clicks',t=>t.ext.subTaskType=112],['novel ad',t=>t.assignmentDesc='浏览十秒并点击小说内广告'],['external app',t=>t.appJumpType='app'],['follow',t=>t.assignmentType=3],['unknown reward type',t=>t.rewards=[{rewardType:99}]],['unknown destination',t=>t.ext.shoppingActivity.forEach(i=>i.url='https://outside.example/task')]
 ])await test(name+' is read-only with no task submission or extra wait',async()=>{const h=host(),t=visit();change(t);h.reply=()=>response(list([t]));const r=await client(h).browse();assert(!r.stopped);assert.equal(h.calls.length,1);assert.equal(h.waits.length,0);});
 await test('list success alone is not counted as a reward',()=>{assert.equal(api.tjBeans({rewardsInfo:{successRewards:{4:[{quantity:100}]}}}),null);assert.equal(api.tjBeans({rewardsInfo:{successRewards:{3:[{rewardType:3,quantity:'1'}]}}}),null);assert.equal(api.tjBeans(action('0',1).data.result.assignmentResult),1);});
 await test('duplicate assignment IDs stop list processing',()=>{assert.throws(()=>api.tjList(list([visit(),visit()])));});
 await test('cross-date change after signing prevents even the journal mutation',async()=>{const h=host();h.crypto.signOnline=async()=>{h.changeDay('2099-01-01');return sig();};await assert.rejects(()=>client(h).sign());assert.equal(h.calls.length,0);assert(!h.read('JD_SPECIAL_CHANNEL_ATTEMPTS_V1'));});
 await test('passive query capture saves no task IDs or one-time signatures',async()=>{const h=host();h.map.delete(KEY);const r=await capture(h,req(),list([signTask(true),visit()]));assert(r.updated.includes(KEY));const stored=JSON.stringify(h.read(KEY));assert(!stored.includes('visit_id'));assert(!stored.includes('item_A'));assert(!stored.includes('tk03_fixture'));assert(h.read(KEY).environment);assert.equal(h.calls.length,0);});
 await test('Cookie-less native page borrows canonical login only with matching signature account',async()=>{const h=host();h.map.delete(KEY);const r=req();r.headers.Cookie='page=kept;';assert((await capture(h,r,list([signTask(true)]))).updated.includes(KEY));assert(h.read(KEY).headers.Cookie.includes('NEW'));});
 await test('wrong channel, app, page and signature cannot create a profile',async()=>{
  for(const change of [r=>{const p=api.jsParams(r);p.body=JSON.stringify({channelId:'99'});r.body=form(p);},r=>{r.headers.Referer='https://outside.example/';delete r.headers['x-referer-page'];},r=>{const p=api.jsParams(r);p.h5st=sig(env(),'wrong');r.body=form(p);},r=>{const p=api.jsParams(r);p.h5st=sig({...env(),pp:{p1:'other'}});r.body=form(p);}]){const h=host();h.map.delete(KEY);const r=req();change(r);assert.equal(await capture(h,r,list([signTask(true)])),null);assert(!h.read(KEY));}
 });
 for(const name of ['jd-signin-capture.js','jd-activity-capture.js','jd-splash.js'])await test('first matching plugin stores special profile, preserving response: '+name,async()=>{
  const h=host();h.map.delete(KEY);let result,notes=[];
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('capture timeout')),1000);const ctx={$request:req(),$response:response(list([signTask(true)])),$persistentStore:{read:k=>h.map.has(k)?JSON.stringify(h.map.get(k)):'',write:(v,k)=>{if(v)h.map.set(k,JSON.parse(v));else h.map.delete(k);return true;}},$script:{startTime:new Date().toISOString()},$notification:{post:(...x)=>notes.push(x)},$done:r=>{result=r;clearTimeout(timer);resolve();},console:{log:()=>{}},setTimeout,clearTimeout};try{vm.runInNewContext(fs.readFileSync(path.join(root,name),'utf8'),ctx,{timeout:5000});}catch(e){clearTimeout(timer);reject(e);}});
  assert(h.read(KEY));assert(!result?.body);assert(!JSON.stringify(notes).includes('FAKE_DEVICE'));
 });
 await test('existing SDK produces exactly the captured native signature field set',async()=>{
  const h=host(),cache=new Map();let boots=0;
  const c=api.createSigninCrypto({read:(k,f)=>cache.get(k)||f,write:(k,v)=>cache.set(k,v),setTimeout:()=>0,clearTimeout:()=>{},progress:()=>{},requestAlgo:async o=>{boots++;assert(!o.headers.Cookie);const b=JSON.parse(o.body);return response({status:200,data:{ts:Date.now(),result:{fp:b.fp,tk:'tk03'+'a'.repeat(88),algo:'function test(tk,fp,ts,ai,algo){return algo.HmacSHA256(tk+fp+ts+ai,"offline");}'}}});}});
  const p={...params(),body:c.hash('{}'),functionId:QUERY,t:String(Date.now())};const input=Object.fromEntries(['appid','body','client','clientVersion','functionId','t'].map(k=>[k,p[k]]));const signed=await c.signOnline('35fa0',{pin:'offline',headers:headers()},env(),input);assert.equal(signed.split(';')[9],ENC);assert.equal(boots,1);
 });
 await test('standalone activity and combined signer use the same scoped client',()=>{const activity=require(path.join(root,'jd-special-activity.js'));assert.equal(activity.createSpecialClient.toString(),api.createSpecialClient.toString());});
 await test('all three subscribed plugins match the real root-path endpoint',()=>{
  for(const name of ['jd-signin.plugin','jd-activities.plugin','jd_open.plugin']){
   const s=fs.readFileSync(path.join(__dirname,'../Plugins',name),'utf8'),line=s.split('\n').find(l=>l.startsWith('response if')&&l.includes('api\\.m\\.jd\\.com'));
   assert(line,name);const expression=line.split('~= ')[1].split(' then')[0].split(' &&')[0],pattern=vm.runInNewContext(expression);
   assert(pattern.test('https://api.m.jd.com/'),name);assert(!pattern.test('https://other.example/'),name);
  }
 });
 await test('Loon activity entry finishes, notifies and releases its lock with synthetic HTTP',async()=>{
  const h=host(),notes=[],calls=[];let done=0;
  await new Promise((resolve,reject)=>{const watchdog=setTimeout(()=>reject(Error('runtime stalled')),2000);const context={$persistentStore:{read:k=>h.map.has(k)?JSON.stringify(h.map.get(k)):'',write:(v,k)=>{if(v)h.map.set(k,JSON.parse(v));else h.map.delete(k);return true;}},$httpClient:{post:(o,cb)=>{
   calls.push(o);let j;if(o.url==='https://cactus.jd.com/request_algo'){assert(!o.headers.Cookie);const b=JSON.parse(o.body);j={status:200,data:{ts:Date.now(),result:{fp:b.fp,tk:'tk03'+'a'.repeat(88),algo:'function test(tk,fp,ts,ai,algo){return algo.HmacSHA256(tk+fp+ts+ai,"offline");}'}}};}
   else{const p=api.jsParams(o);assert.equal(p.functionId,QUERY);assert.equal(p.h5st.split(';')[9],ENC);assert.equal(o['auto-cookie'],false);assert.equal(o['auto-redirect'],false);j=list([signTask(true)]);}
   cb(null,{status:200},JSON.stringify(j));}},$notification:{post:(...x)=>notes.push(x)},$done:()=>{done++;clearTimeout(watchdog);resolve();},console:{log:()=>{}},setTimeout,clearTimeout};
   try{vm.runInNewContext(fs.readFileSync(path.join(root,'jd-special-activity.js'),'utf8'),context,{timeout:5000});}catch(e){clearTimeout(watchdog);reject(e);}
  });assert.equal(done,1);assert.equal(notes.length,1);assert.equal(calls.length,0);assert(notes.flat().some(s=>s.includes('已暂停')));assert(!h.read('JD_ACTIVITY_MANUAL_V1.lock'));assert(!h.read('JD_SPECIAL_CHANNEL_LAST_V1'));
 });
 console.log(count+' special-channel checks passed; no live account requests.');
})().catch(e=>{console.error(e);process.exitCode=1;});
