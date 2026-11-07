// Synthetic evidence for daily sign-ins only; no real account traffic.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.join(__dirname,'../Scripts'),api=require(path.join(root,'jd-signin.js')),cap=require(path.join(root,'jd-signin-capture.js'));
const {JB_CONFIG:C,JS_KEYS:K}=api,day=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
const env=()=>({v:'h5_file_v5.3.6',fp:'offline-fixture',pp:{p1:'offline'},extend:{bu6:33,bu13:'F3'},canvas:'a'.repeat(32),webglFp:'b'.repeat(32)});
const encode=e=>{const a='rqponmlkjihgfedcbaZYXWVUTSRQPONMLKJIHGFEDCBA-_9876543210zyxwvuts',b='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';return [...Buffer.from(JSON.stringify(e)+'x').toString('base64').replace(/=+$/,'')].map(c=>a[b.indexOf(c)]).reverse().join('');};
const sig=(app,e=env())=>['date','1234567890123456',app,'tk03_fixture','hash','5.3','time',encode(e),'hash','fields'].join(';');
const reply=j=>({status:200,body:JSON.stringify(j)}),form=p=>new URLSearchParams(p).toString();
const header=task=>({Cookie:'pt_pin=offline;pt_key=OLD;page=kept;','User-Agent':'offline-ios-webview',Referer:C[task].page,'x-referer-page':C[task].page,Origin:new URL(C[task].page).origin});
const hardwareMeta=()=>({client:'apple',clientVersion:'16.1.81',extParam:{forceBot:'1',businessData:{},signStr:'-1',sceneid:'babel_'+C.hardware.activity},activity_id:C.hardware.activity,template_id:'00043621',floor_id:'133505424',enc:'OFFLINE_PAGE_MATERIAL'});
function params(task,claim=false){const c=C[task],p={functionId:claim?c.claim:c.query,appid:c.appid};
 if(task==='gameDaily')Object.assign(p,{client:'ios',clientVersion:'16.1.81',t:String(Date.now())});
 if(!!C[task].craft)Object.assign(p,{client:'jxh5',clientVersion:'1.2.5',channel:'jxh5',t:String(Date.now())});
 if(task==='wallet')Object.assign(p,{client:'m',clientVersion:'6.0.0'});
 if(task==='hardware'&&claim)Object.assign(p,{client:'pc',clientVersion:'1.0.0'});
 if(task==='hardware'&&!claim)Object.assign(p,{sign:'11',t:String(Date.now())});
 let b;if(task==='gameDaily')b=claim?{envType:1,linkId:c.link,status:1,markStr:'FRESH_MARK'}:{envType:1,linkId:c.link,babelChannel:'ttt10'};
 if(!!C[task].craft){b={source:'jxzy',craftId:c.craft,sceneval:2,buid:325,appCode:'ms1888ebbf',time:Date.now()};if(claim)b.itemId='1';else b.tttId='ttt137';b.signStr=api.jbBodySign(b);}
 if(task==='wallet'){b={t:Date.now()};b.encStr=api.jbMd5(String(b.t)+'e9c398ffcb2d4824b4d0a703e38yffdd');}
 if(task==='hardware')b=claim?{appid:c.appid,body:JSON.stringify({encryptAssignmentId:'FRESH_SIGN_ID',taskType:0,...hardwareMeta()}),sign:11,t:Date.now()}:{client:'apple',clientVersion:'16.1.81'};
 p.body=JSON.stringify(b);if(c.apps[p.functionId])p.h5st=sig(c.apps[p.functionId]);return p;
}
function request(task,claim=false){const p=params(task,claim),get=task==='hardware'&&claim;return {method:get?'GET':'POST',url:'https://api.m.jd.com/'+(task==='hardware'&&!claim?'client.action':'api')+'?'+(get?form(p):'functionId='+p.functionId),body:get?'':form(p),headers:header(task)};}
function page(task,done=false){
 if(task==='gameDaily')return {code:0,success:true,data:{signMainVo:{currentStatus:done?3:1,markStr:'FRESH_MARK',beforeTaskVo:null},signListVo:[done?{todayFlag:1,status:3,signDate:day()}:{signableTodayFlag:1,status:1}]}};
 if(!!C[task].craft)return {code:0,data:{status:done?2:1,itemId:'1',alreadySignDays:done?1:0,signList:done?[day()+'_1.0']:[]}};
 if(task==='wallet')return {code:200,data:{totalNum:done?0.1:0,signInfo:{signStatus:done?1:0,continueDay:done?1:0,signNum:0.1}}};
 return {success:true,resultCode:0,data:{hasRisk:false,login:true,subCode:'0',assignmentList:[{assignmentType:5,assignmentTypeEnum:0,assignmentName:'签到领京豆',assignmentTimesLimit:1,encryptAssignmentId:'FRESH_SIGN_ID',rewards:[{rewardType:3,rewardName:'五金城每日签到领京豆',quantity:999}],completionFlag:done,completionCnt:done?1:0,canParticipation:true,reachUpperLimit:false,status:done?2:1}]}};
}
function award(task){
 if(task==='gameDaily')return {code:0,success:true,data:{awardVo:{awardName:'BEAN',awardGivenNumber:'2'},awardResultVO:{amount:'2',prizeType:3,sendResult:true}}};
 if(!!C[task].craft)return {code:0,data:{alreadySignDays:1,signList:[day()+'_1.0'],prizeInfos:[{prizeType:2,discount:1}]}};
 if(task==='wallet')return page(task,true);
 return {success:true,resultCode:0,data:{subCode:'0',successReward:{'五金城每日签到领京豆':1},failRewards:[]}};
}
function host(){const map=new Map(),calls=[],signs=[];const h={map,calls,signs,pin:'offline',day,guard:()=>{},log:()=>{},read:(k,f)=>map.has(k)?JSON.parse(map.get(k)):f,write:(k,v)=>map.set(k,JSON.stringify(v)),rawRead:k=>map.get(k)||'',rawWrite:(v,k)=>{map.set(k,v);return true;},observedAt:Date.now()};
 h.write(K.bound,{pin:'offline'});h.write(K.login,{pin:'offline',cookie:'pt_pin=offline;pt_key=FRESH;',headers:header('gameDaily'),capturedAt:Date.now()+1000});h.login=()=>api.jsLogin(h.read).login;
 h.request=async(t,o)=>{api.jsTarget(t,o);calls.push(o);return h.reply(o);};h.crypto={hash:s=>crypto.createHash('sha256').update(s).digest('hex'),decodeEnvironment:cap.farmDecodeEnvironment,signOnline:async(a,p,e,i)=>{signs.push({a,p,e,i});return sig(a);}};return h;
}
async function capture(h,task,claim=false,req=request(task,claim),j=claim?award(task):page(task)){return cap.jsCapture(h,req,reply(j),{},cap.farmDecodeEnvironment);}
async function ready(task){const h=host();await capture(h,task);if(!!C[task].craft&&!h.read(C[task].key)?.signing)h.write('JD_HOME_CHECKIN_ACCOUNT_V1',{pin:'offline',signing:{environment:encode(env()),eidToken:'OFFLINE_DEVICE'}});await capture(h,task,true);return h;}
const run=(h,t)=>api.createExtraSignins(h,h.crypto).run(t);let total=0;
const legacyTasks=['gameDaily','used','gear','wallet','hardware'];
const ai={craft:'6a66f5511177f59203da3347',page:'https://pro.m.jd.com/mall/active/3skw64E2o8zoGcqm41gsewXHgdvR/index.html'};
function aiRequest(claim=false){const r=request('gear',claim),p=api.jsParams(r),b=JSON.parse(p.body);b.craftId=ai.craft;b.signStr=api.jbBodySign(b);p.body=JSON.stringify(b);r.body=form(p);r.headers.Referer=ai.page;r.headers['x-referer-page']=ai.page;return r;}
async function test(name,f){await f();total++;console.log('OK '+name);}
(async()=>{
 await test('seventeen unique tasks; no retired Faker or special-channel entry',()=>{assert.equal(api.JS_TASKS.length,17);assert.equal(new Set(api.JS_TASKS.map(x=>x[0])).size,17);assert(!api.JS_TASKS.some(x=>['hs','ys','delivery','game','plant','special'].includes(x[0])));for(const t of Object.keys(C))assert(api.JS_TASKS.some(x=>x[0]===t));});
 await test('public frontend MD5 and HMAC vectors',()=>{for(const s of ['','abc','1793637327031'])assert.equal(api.jbMd5(s),crypto.createHash('md5').update(s).digest('hex'));const b={z:0,source:'jxzy',a:false,empty:'',object:{a:1},missing:null,signStr:'ignored'};assert.equal(api.jbBodySign(b),crypto.createHmac('md5','xtl_sqg_mall-^&*-damai_(789)_@#$').update('false&'+JSON.stringify({a:1})+'&jxzy&0').digest('hex'));});
 for(const task of legacyTasks){
  await test(task+': capture minimal material without one-time signatures or IDs',async()=>{const h=await ready(task),s=h.rawRead(C[task].key);assert(s);for(const secret of ['FRESH_MARK','FRESH_SIGN_ID','tk03_fixture','assignmentList','awardResultVO'])assert(!s.includes(secret));assert(!h.calls.length);});
  await test(task+': already signed sends only a query; planned rewards are ignored',async()=>{const h=await ready(task);h.reply=()=>reply(page(task,true));const r=await run(h,task);assert.equal(r.status,'already_done');assert.equal(r.beanQuantity,undefined);assert.equal(h.calls.length,1);});
  await test(task+': query, one claim, verification, actual reward',async()=>{const h=await ready(task);let done=false;h.reply=o=>{const p=api.jsParams(o),b=JSON.parse(p.body);assert(o.headers.Cookie.includes('FRESH'));assert(!o.headers.Cookie.includes('OLD'));assert(o.headers.Cookie.includes('page=kept'));assert.equal(o.headers['X-Lazing-Signin-Run'],'1');if(p.functionId===C[task].query)return reply(page(task,done));assert.equal(p.functionId,C[task].claim);if(task==='gameDaily')assert.equal(b.markStr,'FRESH_MARK');if(task==='hardware'){assert.equal(o.method,'get');assert.equal(JSON.parse(b.body).encryptAssignmentId,'FRESH_SIGN_ID');assert.equal(JSON.parse(b.body).taskType,0);}done=true;return reply(award(task));};
   const r=await run(h,task);assert.equal(r.status,'signed_confirmed');assert.equal(h.calls.length,3);if(task==='wallet'){assert.equal(r.creditQuantity,0.1);assert.equal(r.beanQuantity,undefined);assert(api.jsLine(api.jsResult(task,r)).includes('0.1 充值金'));assert(!api.jsLine(api.jsResult(task,r)).includes('现金'));}else assert.equal(r.beanQuantity,task==='gameDaily'?2:1);
   for(const s of h.signs){assert.equal(s.a,C[task].apps[s.i.functionId]);assert(h.calls.some(o=>{const p=api.jsParams(o);return p.functionId===s.i.functionId&&s.i.body===h.crypto.hash(p.body);}));assert.deepEqual(Object.keys(s.i).sort(),(task==='gameDaily'||!!C[task].craft?['appid','body','client','clientVersion','functionId','t']:['appid','body','client','clientVersion','functionId']).sort());}
  });
  await test(task+': failed claim is journaled and never repeated',async()=>{const h=await ready(task);h.reply=o=>{if(api.jsParams(o).functionId===C[task].query)return reply(page(task));throw Error('network');};await assert.rejects(()=>run(h,task));assert.equal((await run(h,task)).status,'pending');assert.equal(h.calls.filter(o=>api.jsParams(o).functionId===C[task].claim).length,1);});
  await test(task+': failed verification cannot claim completion or repeat mutation',async()=>{const h=await ready(task);let n=0;h.reply=()=>++n===1?reply(page(task)):n===2?reply(award(task)):{status:403,body:'{}'};const r=await run(h,task);assert.equal(r.status,'pending');h.reply=()=>reply(page(task));assert.equal((await run(h,task)).status,'pending');assert.equal(h.calls.filter(o=>api.jsParams(o).functionId===C[task].claim).length,1);});
  await test(task+': wrong account and missing profile send no requests',async()=>{const h=await ready(task);h.write(C[task].key,{...h.read(C[task].key),pin:'other'});await assert.rejects(()=>run(h,task),/账号/);assert(!h.calls.length);h.map.delete(C[task].key);await assert.rejects(()=>run(h,task),/缺少/);assert(!h.calls.length);});
  await test(task+': capture validates page, signature identity, protocol and observation order',async()=>{
   for(const change of [r=>{r.headers.Referer='https://example.com/';r.headers['x-referer-page']='https://example.com/';},r=>{r.headers.Cookie='pt_pin=other;pt_key=OTHER;';},r=>{const p=api.jsParams(r);p.appid='wrong';r.url='https://api.m.jd.com/api?functionId='+p.functionId;r.body=form(p);r.method='POST';}]){const h=host(),r=request(task);change(r);assert.equal(await capture(h,task,false,r),null);assert(!h.read(C[task].key));}
   const h=await ready(task),s=h.rawRead(C[task].key);h.observedAt-=1000;assert.equal(await capture(h,task),null);assert.equal(h.rawRead(C[task].key),s);
   const h2=host(),r=request(task,true),p=api.jsParams(r);p.h5st=sig(C[task].apps[C[task].claim],{...env(),pp:{p1:'other'}});r.url='https://api.m.jd.com/api?'+(task==='hardware'?form(p):'functionId='+p.functionId);r.body=task==='hardware'?'':form(p);assert.equal(await capture(h2,task,true,r),null);assert(!h2.read(C[task].key));
  });
  await test(task+': partial Cookie uses same-account canonical login only',async()=>{const h=host(),r=request(task);r.headers.Cookie='page=kept;';assert((await capture(h,task,false,r))?.updated.includes(C[task].key));assert(h.read(C[task].key).headers.Cookie.includes('FRESH'));const h2=host();r.headers.Cookie='pt_pin=other;';assert.equal(await capture(h2,task,false,r),null);});
  await test(task+': account change during query prevents claim',async()=>{const h=await ready(task);h.reply=()=>{h.write(K.login,{pin:'other',cookie:'pt_pin=other;pt_key=OTHER;',headers:header(task),capturedAt:Date.now()+1000});return reply(page(task));};await assert.rejects(()=>run(h,task),/账号/);assert.equal(h.calls.length,1);});
  await test(task+': POST/GET and endpoint gates are exact',()=>{const r=request(task,true);if(task==='hardware')r.method='get';assert.doesNotThrow(()=>api.jsTarget(task,r));r.method=task==='hardware'?'post':'get';assert.throws(()=>api.jsTarget(task,r));const q=request(task);q.url=q.url.replace('api.m.jd.com','example.com');assert.throws(()=>api.jsTarget(task,q));});
 }
 await test('gear unsigned query reuses only a same-account native sign-in environment',async()=>{const h=host();h.write('JD_HOME_CHECKIN_ACCOUNT_V1',{pin:'offline',signing:{environment:encode(env()),eidToken:'OFFLINE_DEVICE'}});await capture(h,'gear');assert(h.read(C.gear.key).signing);assert(!h.read('JXZY_CHECKIN_ACCOUNT_V1'));const bad=host();bad.write('JD_HOME_CHECKIN_ACCOUNT_V1',{pin:'other',signing:{environment:encode(env())}});await capture(bad,'gear');assert(!bad.read(C.gear.key).signing);});
 await test('game prior-task requirements and conflicting day records prevent mutations',async()=>{for(const change of [j=>j.data.signMainVo.beforeTaskVo={task:1},j=>j.data.signMainVo.currentStatus=2,j=>j.data.signListVo.push({todayFlag:1,status:3,signDate:day()})]){const h=await ready('gameDaily'),j=page('gameDaily');change(j);h.reply=()=>reply(j);await assert.rejects(()=>run(h,'gameDaily'));assert.equal(h.calls.length,1);}});
 for(const task of ['gear','hardware','used'])await test(task+': unsigned query confirms a completed check-in without claim material',async()=>{
  const h=host();
  await capture(h,task);
  assert.equal(h.read(C[task].key).signing,undefined);
  h.reply=()=>reply(page(task,true));
  assert.equal((await run(h,task)).status,'already_done');
  assert.equal(h.calls.length,1);
  h.reply=()=>reply(page(task,false));
  h.map.delete(K.attempts);
  await assert.rejects(()=>run(h,task),/缺少/);
  assert.equal(h.calls.length,2);
 });
 for(const name of ['jd-signin-capture.js','jd-activity-capture.js'])await test(name+': saves hardware claim with current page signing ID',async()=>{
  const h=host(),r=request('hardware',true),p=api.jsParams(r);
  await capture(h,'hardware');
  p.h5st=sig('b4c9d');
  r.url='https://api.m.jd.com/api?'+form(p);
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('capture timeout')),1500);
   vm.runInNewContext(fs.readFileSync(path.join(root,name),'utf8'),{
    $request:r,$response:reply(award('hardware')),$script:{startTime:new Date().toISOString()},
    $persistentStore:{read:h.rawRead,write:h.rawWrite},$notification:{post:()=>{}},
    console:{log:()=>{}},$done:()=>{clearTimeout(timer);resolve();}
   });
  });
  assert.equal(h.read(C.hardware.key).signing.appId,'b4c9d');
  let n=0;
  h.reply=()=>reply(++n===1?page('hardware'):n===2?award('hardware'):page('hardware',true));
  assert.equal((await run(h,'hardware')).status,'signed_confirmed');
  assert.deepEqual(h.signs.map(x=>x.a),['b4c9d']);
 });
 await test('hardware no sign row never asserts already signed or confirms disappearance',async()=>{const h=await ready('hardware'),empty=page('hardware');empty.data.assignmentList=[];h.reply=()=>reply(empty);assert.equal((await run(h,'hardware')).status,'no_chance');let n=0;h.reply=()=>reply(++n===1?page('hardware'):n===2?award('hardware'):empty);assert.equal((await run(h,'hardware')).status,'pending');});
 await test('hardware server risk or changed template prevents a mutation',async()=>{const h=await ready('hardware'),j=page('hardware');j.data.hasRisk=true;h.reply=()=>reply(j);await assert.rejects(()=>run(h,'hardware'));assert.equal(h.calls.length,1);const r=request('hardware',true),p=api.jsParams(r),b=JSON.parse(p.body),inner=JSON.parse(b.body);inner.taskType=8;b.body=JSON.stringify(inner);p.body=JSON.stringify(b);r.method='get';r.url='https://api.m.jd.com/api?'+form(p);assert.throws(()=>api.jsTarget('hardware',r));});
 await test('reward parsing never uses offered prizes or assigns non-beans to beans',()=>{const g=award('gameDaily');g.data.awardResultVO.prizeType=2;assert.deepEqual(api.jbReward('gameDaily',g),{});const q=award('gear');q.data.prizeInfos=[{prizeType:1,discount:100}];assert.deepEqual(api.jbReward('gear',q),{});const h=award('hardware');h.data.successReward={'浏览任务奖励':100};assert.deepEqual(api.jbReward('hardware',h),{});assert.deepEqual(api.jbReward('wallet',award('wallet')),{});});
 for(const name of ['jd-signin-capture.js','jd-activity-capture.js'])for(const task of ['gameDaily','hardware'])await test(name+': first-match passive capture for '+task,async()=>{const h=host();let result;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('capture timeout')),1500);const context={$request:request(task,true),$response:reply(award(task)),$persistentStore:{read:h.rawRead,write:h.rawWrite},$script:{startTime:new Date().toISOString()},$notification:{post:(...x)=>assert(!JSON.stringify(x).includes('FRESH_SIGN_ID'))},$done:x=>{result=x;clearTimeout(timer);resolve();},console:{log:()=>{}},setTimeout,clearTimeout};try{vm.runInNewContext(fs.readFileSync(path.join(root,name),'utf8'),context,{timeout:5000});}catch(e){clearTimeout(timer);reject(e);}});assert(h.read(C[task].key));assert(!result?.body);});
 for(const task of legacyTasks)await test(task+': first verified capture can initialize shared login and late capture cannot replace it',async()=>{const h=host();h.map.clear();await capture(h,task,true);assert.equal(api.jsLogin(h.read).pin,'offline');assert.equal(api.jsLogin(h.read).login.cookie,'pt_key=OLD;pt_pin=offline;');assert(h.read(K.login));h.write(K.login,{pin:'offline',cookie:'pt_key=NEWER;pt_pin=offline;',headers:{...header(task),Cookie:'pt_key=NEWER;pt_pin=offline;'},capturedAt:h.observedAt+5000});await capture(h,task,true);assert.equal(api.jsLogin(h.read).login.cookie,'pt_key=NEWER;pt_pin=offline;');});
 await test('combined runner executes all batch additions within its lock and clears the lock',async()=>{const h=host();Object.assign(h,{now:()=>Date.now(),random:()=>0.5,sleep:async()=>{},setTimeout,clearTimeout});for(const task of legacyTasks){await capture(h,task);await capture(h,task,true);}const done=new Set();h.reply=o=>{const p=api.jsParams(o),task=Object.keys(C).find(t=>[C[t].query,C[t].claim].includes(p.functionId)&&(!C[t].craft||JSON.parse(p.body).craftId===C[t].craft));assert(task,'unexpected request outside new daily scopes');if(p.functionId===C[task].query)return reply(page(task,done.has(task)));done.add(task);return reply(award(task));};const r=await api.createSignins(h,{},h.crypto).run({gapSeconds:0});assert(r.finished);assert.equal(r.results.length,17);for(const task of legacyTasks)assert.equal(r.results.find(x=>x.task===task).status,'signed_confirmed');assert(!h.rawRead(K.lock));});
 for(const task of legacyTasks)await test('embedded SDK supports exact signed field set: '+task,async()=>{const cache=new Map(),c=api.createSigninCrypto({read:(k,f)=>cache.get(k)||f,write:(k,v)=>cache.set(k,v),setTimeout:()=>0,clearTimeout:()=>{},progress:()=>{},requestAlgo:async o=>{assert(!Object.keys(o.headers).some(k=>/cookie|authorization/i.test(k)));const b=JSON.parse(o.body);return reply({status:200,data:{ts:Date.now(),result:{fp:b.fp,tk:'tk03'+'a'.repeat(88),algo:'function test(tk,fp,ts,ai,algo){return algo.HmacSHA256(tk+fp+ts+ai,"offline");}'}}});}});
  for(const claim of [false,true]){const p=params(task,claim),app=C[task].apps[p.functionId];if(!app)continue;const input={};for(const k of ['functionId','appid','client','body','clientVersion','sign','t','jsonp'])if(p[k])input[k]=k==='body'?c.hash(p.body):p[k];const s=(await c.signOnline(app,{pin:'offline',headers:header(task)},env(),input)).split(';');assert.equal(s.length,10);assert.equal(s[2],app);assert.equal(s[5],'5.3');assert.equal(s[3],'tk03'+'a'.repeat(88));assert(s[9]);}
 });
 await test('AI gear query has an exact page/craft scope; arbitrary crafts are rejected',async()=>{
  const r=aiRequest(),p=api.jsParams(r);assert(api.jbScope('gearAI',p,JSON.parse(p.body)));
  const b=JSON.parse(p.body);b.craftId='unobserved';assert(!api.jbScope('gearAI',p,b));
  const h=host();r.headers.Referer=C.gear.page;r.headers['x-referer-page']=C.gear.page;assert.equal(await capture(h,'gear',false,r),null);assert(!h.read(C.gearAI.key));
 });
 await test('AI unsigned query saves profile and confirms today without borrowing claim material',async()=>{
  const h=host();h.write('JD_HOME_CHECKIN_ACCOUNT_V1',{pin:'offline',signing:{environment:encode(env())}});
  assert((await capture(h,'gear',false,aiRequest(),page('gear',true))).updated.includes(C.gearAI.key));
  const p=h.read(C.gearAI.key);assert(p.templates.query);assert(!p.templates.claim);assert(!p.signing);assert.equal(p.captureVersion,'2026-11-06.1');
  h.reply=o=>{assert.equal(o.headers.Referer,ai.page);assert.equal(JSON.parse(api.jsParams(o).body).craftId,ai.craft);return reply(page('gear',true));};
  assert.equal((await run(h,'gearAI')).status,'already_done');assert.equal(h.calls.length,1);assert(!h.signs.length);
  h.map.delete(K.attempts);h.reply=()=>reply(page('gear',false));await assert.rejects(()=>run(h,'gearAI'),/缺少本入口签到提交凭据/);assert.equal(h.calls.length,2);assert(!h.signs.length);
 });
 await test('observed AI claim enables only the same AI page flow',async()=>{
  const h=host();await capture(h,'gear',false,aiRequest(),page('gear'));await capture(h,'gear',true,aiRequest(true),award('gear'));
  let done=false;h.reply=o=>{const p=api.jsParams(o);assert.equal(JSON.parse(p.body).craftId,ai.craft);assert.equal(o.headers.Referer,ai.page);if(p.functionId===C.gear.query)return reply(page('gear',done));done=true;return reply(award('gear'));};
  assert.equal((await run(h,'gearAI')).status,'signed_confirmed');assert.equal(h.calls.length,3);assert.equal(h.signs[0].a,'c50cc');
 });
 await test('gear captures remain independent in both page orders and migrate an AI profile from the old key',async()=>{
  const h=await ready('gear'),old=h.rawRead(C.gear.key);
  await capture(h,'gear',false,aiRequest(),page('gear',true));
  assert.equal(h.rawRead(C.gear.key),old);
  const aiProfile=h.read(C.gearAI.key);
  assert.equal(aiProfile.templates.query.body.craftId,ai.craft);assert(!aiProfile.templates.claim);assert(!aiProfile.signing);
  const migrated=host();migrated.write(C.gear.key,aiProfile);
  migrated.reply=()=>reply(page('gear',true));
  assert.equal((await run(migrated,'gearAI')).status,'already_done');
  await capture(migrated,'gear');
  assert.equal(migrated.read(C.gear.key).templates.query.body.craftId,C.gear.craft);
  assert.deepEqual(migrated.read(C.gearAI.key),aiProfile);
 });
 await test('old gear pending journal cannot block the separately captured AI scope',async()=>{
  const h=host();h.write(K.attempts,{[day()+':'+h.crypto.hash('offline').slice(0,24)+':gear']:{state:'pending',time:Date.now()}});
  await capture(h,'gear',false,aiRequest(),page('gear'));await capture(h,'gear',true,aiRequest(true),award('gear'));
  let n=0;h.reply=()=>reply(++n===1?page('gear'):n===2?award('gear'):page('gear',true));assert.equal((await run(h,'gearAI')).status,'signed_confirmed');assert.equal(h.calls.length,3);
 });
 for(const name of ['jd-signin-capture.js','jd-activity-capture.js'])await test(name+': real wrapper saves AI query and reports exact partial fields',async()=>{
  const h=host(),logs=[];let out;await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('capture timeout')),1500);vm.runInNewContext(fs.readFileSync(path.join(root,name),'utf8'),{$request:aiRequest(),$response:reply(page('gear',true)),$script:{startTime:new Date().toISOString()},$persistentStore:{read:h.rawRead,write:h.rawWrite},$notification:{post:()=>{}},console:{log:x=>logs.push(x)},$done:r=>{out=r;clearTimeout(t);resolve();}},{timeout:3000});});
  assert(h.read(C.gearAI.key).templates.query);assert(!out.body);assert(logs.some(x=>x.includes('AI装备馆签到：查询已保存，签到参数待获取，签名待获取')));assert(logs.some(x=>x.includes('2026-11-06.1')));
 });
 console.log(total+' batch sign-in checks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
