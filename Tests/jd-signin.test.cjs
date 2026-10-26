// Synthetic identities and responses only. No real account requests.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const find=(name,dir)=>[path.join(__dirname,name),path.join(__dirname,'..',dir,name)].find(fs.existsSync);
const mainPath=find('jd-signin.js','Scripts'),capturePath=find('jd-signin-capture.js','Scripts'),pluginPath=find('jd-signin.plugin','Plugins');
const api=require(mainPath),cap=require(capturePath),{JS_KEYS:K}=api;
const day=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
const encodeEnv=env=>{const a='rqponmlkjihgfedcbaZYXWVUTSRQPONMLKJIHGFEDCBA-_9876543210zyxwvuts',b='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';return [...Buffer.from(JSON.stringify(env)+'x').toString('base64').replace(/=+$/,'')].map(c=>a[b.indexOf(c)]).reverse().join('');};
const env=()=>({v:'h5_file_v5.3.6',fp:'reference-fixture',pp:{p1:'offline'},extend:{bu6:33,bu13:'F3'},canvas:'a'.repeat(32),webglFp:'b'.repeat(32)});
const headers=()=>({Cookie:'pt_pin=offline;pt_key=FAKE_SECRET;page=kept;','User-Agent':'jdapp;iPhone;15.0.0;27.0;network/wifi;',Referer:'https://pro.m.jd.com/'});
const sig=(app,e=encodeEnv(env()))=>['date','1234567890123456',app,'tk03_fixture','hash','5.3','time',e,'hash','fields'].join(';');
const form=p=>Object.entries(p).map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&');
const response=j=>({status:200,body:JSON.stringify(j)});
function host(){
 const map=new Map(),logs=[],calls=[],waits=[];let currentDay=day();
 const h={map,logs,calls,waits,now:()=>Date.now(),day:()=>currentDay,changeDay:d=>{currentDay=d;},random:()=>0.5,setTimeout,clearTimeout,
  read:(k,f)=>map.has(k)?JSON.parse(map.get(k)):f,write:(k,v)=>map.set(k,JSON.stringify(v)),rawRead:k=>map.get(k)||'',rawWrite:(v,k)=>{map.set(k,v||'');return true;},
  log:s=>logs.push(s),sleep:async ms=>{waits.push(ms);},guard:()=>{},pin:'offline',
  request:async(t,o)=>{calls.push({task:t,...o});if(!h.reply)throw Error('Unexpected request');return h.reply(t,o);}
 };
 h.write(K.bound,{pin:'offline'});h.write(K.login,{pin:'offline',cookie:'pt_pin=offline;pt_key=FAKE_SECRET;',headers:headers(),capturedAt:Date.now()});
 h.login=()=>api.jsLogin(h.read).login;
 h.write(K.extra,{pin:'offline',game:{headers:headers(),params:{clientVersion:'15.0.0','x-api-eid-token':'FAKE_DEVICE'},environment:encodeEnv(env())},delivery:{headers:headers(),params:{clientVersion:'15.0.0','x-api-eid-token':'FAKE_DEVICE'},environment:encodeEnv(env())}});
 return h;
}
const fakeCrypto={hash:s=>crypto.createHash('sha256').update(s).digest('hex'),decodeEnvironment:cap.farmDecodeEnvironment,signOnline:async app=>sig(app)};
const extra=h=>api.createExtraSignins(h,fakeCrypto);
let total=0;
async function test(name,fn){await fn();total++;console.log('OK '+name);}
function parsers(){return {retail:cap.runRetailCapture,jxzy:cap.runJxCapture,home:cap.runHomeCapture,finance:cap.runFinanceCapture,plant:cap.runPlantCapture,farm:cap.farmCapture};}
function request(f,b,params={}){return {method:'POST',url:'https://api.m.jd.com/api?functionId='+f,headers:headers(),body:form({functionId:f,body:JSON.stringify(b),...params})};}
const capture=(h,req,j)=>cap.jsCapture(h,req,response(j),parsers(),cap.farmDecodeEnvironment);
function basicLegacy(h){
 const write=(c,k,extra={})=>{c.$persistentStore.write(JSON.stringify({time:Date.now(),date:day(),status:'already_done',...extra}),k);c.$done({});};
 return {retail:c=>write(c,'JD_CHECKIN_TEST_LAST_RESULT_V1'),plant:c=>write(c,'JD_PLANT_CHECKIN_LAST_RESULT_V1'),jxzy:c=>write(c,'JXZY_CHECKIN_LAST_RESULT_V1'),home:c=>write(c,'JD_HOME_CHECKIN_LAST_RESULT_V1'),finance:c=>write(c,'JD_JR_CHECKIN_LAST_RESULT_V1',{doubleSign:{status:'already_done'}})};
}
function seedLegacy(h){
 h.write('JD_CHECKIN_TEST_ACCOUNT_V1',{pin:'offline',modes:{daily:{headers:headers()},scratch:{headers:headers()},blindbox:{headers:headers()}}});
 h.write('JXZY_CHECKIN_ACCOUNT_V1',{pin:'offline',headers:headers()});h.write('JD_HOME_CHECKIN_ACCOUNT_V1',{pin:'offline',headers:headers()});h.write('JD_PLANT_CHECKIN_ACCOUNT_V1',{pin:'offline',query:{headers:headers()}});
 h.write('JD_JR_CHECKIN_ACCOUNT_V1',{pin:'offline',headers:{...headers(),Cookie:'pt_pin=offline;pt_key=FINANCE_SECRET;'}});
 h.reply=async(t,o)=>{const p=api.jsParams(o);if(['hs','ys'].includes(t))return response({code:0,result:{status:4}});if(t==='game')return response({success:true,data:{signMainVo:{currentStatus:3}}});if(t==='delivery')return response({code:0,data:{bizCode:0,result:{value:1}}});throw Error('Unexpected task');};
}
(async()=>{
 await test('empty local store can select login without dereferencing a missing record',()=>{assert.equal(api.jsLogin((k,f)=>f).login,null);});
 await test('first PLUS page capture supplies the exact template read by the signin runner',async()=>{
  const h=host();h.map.clear();
  await capture(h,request('bff_marketing_interaction',{scene:'blindBox',touchPoint:'purePlusIndexNew2608'},{appid:'plus_business',h5st:sig('35fa0')}),{code:'1711000',msg:'成功',rs:{leftTimes:1,sendBenefitList:[]}});
  const login=api.jsLogin(h.read).login;assert(login);const value=api.jsLegacyAccount('blindbox','offline',h.read,login).value;
  assert.equal(value.modes.blindbox.query.signatureAppId,'35fa0');assert.equal(value.modes.blindbox.query.referenceEnvironmentEncoded,encodeEnv(env()));assert.equal(h.calls.length,0);
 });
 await test('shared Cookie alone does not invent a PLUS-specific template',()=>{const h=host();assert.equal(api.jsLegacyAccount('blindbox','offline',h.read,api.jsLogin(h.read).login).value,null);});

 await test('only two settings and one manual / one automatic entry',()=>{
  const p=fs.readFileSync(pluginPath,'utf8'),args=p.split('[Argument]')[1].split('[Script]')[0];assert.deepEqual([...args.matchAll(/^(\w+) = /gm)].map(x=>x[1]),['gapSeconds','cronExp']);assert.equal((p.match(/^generic /gm)||[]).length,1);assert.equal((p.match(/^cron /gm)||[]).length,1);assert(!/dailyEnabled|autoEnabled|delayMin|delayMax/.test(p));
 });
 await test('valid wait parameters',()=>{for(const n of [0,5,15,120])assert.equal(api.jsSettings({gapSeconds:n}).gap,n);assert.equal(api.jsSettings('{}').gap,15);});
 await test('invalid parameters rejected before requests',()=>{for(const n of [-1,1,4,121,1.1,'oops'])assert.throws(()=>api.jsSettings({gapSeconds:n}));assert.throws(()=>api.jsSettings('broken'));});
 await test('duplicate cookie identity rejected',()=>{assert.equal(api.jsPair('pt_pin=a;pt_pin=b;pt_key=x;'),null);assert.equal(api.jsPair('pt_pin=a;pt_key=x;pt_key=y;'),null);});
 await test('same-account refresh preserves page cookies',()=>{assert.equal(api.jsMergeCookie('pt_pin=offline;pt_key=OLD;page=keep;',{pin:'offline',cookie:'pt_pin=offline;pt_key=NEW;'}),'pt_pin=offline;pt_key=NEW;page=keep;');assert.throws(()=>api.jsMergeCookie('pt_pin=other;pt_key=x;',{pin:'offline',cookie:'pt_pin=offline;pt_key=y;'}));});
 await test('URL/body duplicate or conflicting fields rejected',()=>{assert.throws(()=>api.jsParams({url:'https://api.m.jd.com/api?functionId=a',body:'functionId=b'}));assert.throws(()=>api.jsParams({url:'https://api.m.jd.com/api',body:'functionId=a&functionId=a'}));});
 await test('latest generic cookie keeps a real page UA',()=>{const h=host();h.write('QL_BRIDGE_CREDENTIAL_V1',{pin:'offline',cookie:'pt_pin=offline;pt_key=FRESH;',capturedAt:Date.now()+1000});const l=api.jsLogin(h.read).login;assert(l.cookie.includes('FRESH'));assert(l.headers['User-Agent']);assert(l.headers.Cookie.includes('FRESH'));});
 await test('delayed legacy capture cannot overwrite canonical login',()=>{const h=host();h.write('JD_CHECKIN_TEST_ACCOUNT_V1',{pin:'offline',modes:{daily:{headers:{...headers(),Cookie:'pt_pin=offline;pt_key=STALE;'},capturedAt:Date.now()+10000}}});assert(!api.jsLogin(h.read).login.cookie.includes('STALE'));});
 await test('finance excluded from generic login sources',()=>{const h=host();h.map.delete(K.login);h.write('JD_JR_CHECKIN_ACCOUNT_V1',{pin:'offline',headers:headers(),capturedAt:Date.now()});assert.equal(api.jsLogin(h.read).login,null);});
 await test('finance retains independent cookie',()=>{const h=host();seedLegacy(h);const p=api.jsLegacyAccount('finance','offline',h.read,h.login());assert(p.value.headers.Cookie.includes('FINANCE_SECRET'));});
 await test('other-account activity profile rejected',()=>{const h=host();h.write('JXZY_CHECKIN_ACCOUNT_V1',{pin:'other',headers:headers()});assert.throws(()=>api.jsLegacyAccount('jxzy','offline',h.read,h.login()));});
 await test('external host and non-signin API blocked',()=>{assert.throws(()=>api.jsTarget('game',{url:'https://example.com/api',body:''}));assert.throws(()=>api.jsTarget('game',request('waterGoodForFarm',{linkId:api.JS_GAME})));});
 await test('wrong activity and health app key blocked',()=>{assert.throws(()=>api.jsTarget('game',request('weGameLottery',{linkId:'other'})));assert.throws(()=>api.jsTarget('delivery',request('bean_deliverySign_sign',{activityId:'999'})));assert.throws(()=>api.jsTarget('hs',request('jdh_bm_getKitTask',{m_patch_appKey:api.JS_HEALTH.ys.appKey,channel:'jdhapp',groupCode:'openkits'},{appid:'jdh-middle'})));});
 await test('algorithm initialization never receives login cookie',()=>{assert.throws(()=>api.jsTarget('game',{url:'https://cactus.jd.com/request_algo',headers:{Cookie:'SECRET'}}));api.jsTarget('game',{url:'https://cactus.jd.com/request_algo',headers:{'Content-Type':'application/json'}});});
 for(const task of ['hs','ys']){
  await test(task+' already done skips mutation',async()=>{const h=host();h.reply=()=>response({code:0,result:{status:4}});assert.equal((await extra(h).run(task)).status,'already_done');assert.equal(h.calls.length,1);});
  await test(task+' check-in followed by state verification',async()=>{const h=host();let n=0;h.reply=()=>response(++n===1?{code:0,result:{status:1,id:'task',encodeId:'fresh'}}:n===2?{code:0,result:{ok:true}}:{code:0,result:{status:4}});assert.equal((await extra(h).run(task)).status,'signed_confirmed');assert.equal(h.calls.length,3);const p=api.jsParams(h.calls[1]);assert.equal(JSON.parse(p.body).taskId,'task');assert.equal(p.appid,'JDHAPP');});
  await test(task+' pending mutation is never retried',async()=>{const h=host();h.reply=(t,o)=>api.jsParams(o).functionId==='jdh_bm_getKitTask'?response({code:0,result:{status:1,id:'task',encodeId:'fresh'}}):Promise.reject(Error('network'));await assert.rejects(()=>extra(h).run(task));assert.equal((await extra(h).run(task)).status,'pending');assert.equal(h.calls.filter(x=>api.jsParams(x).functionId==='jdh_msoa_doTaskGw').length,1);});
  await test(task+' HTTP 200 business rejection is failure',async()=>{const h=host();h.reply=(t,o)=>response(api.jsParams(o).functionId==='jdh_bm_getKitTask'?{code:0,result:{status:1,id:'task',encodeId:'fresh'}}:{code:1});assert.equal((await extra(h).run(task)).status,'rejected');});
 }
 await test('health malformed status cannot initiate action',async()=>{const h=host();h.reply=()=>response({code:0,result:{id:'task',encodeId:'fresh'}});await assert.rejects(()=>extra(h).run('hs'));assert.equal(h.calls.length,1);});
 await test('health unconfirmed verification does not claim success',async()=>{const h=host();h.reply=(t,o)=>response(api.jsParams(o).functionId==='jdh_bm_getKitTask'?{code:0,result:{status:1,id:'task',encodeId:'fresh'}}:{code:0});assert.equal((await extra(h).run('hs')).status,'pending');});
 for(const task of ['hs','ys']){
  await test(task+' reports nested bean reward and preserves it on requery',async()=>{
   const h=host();let signed=false;h.reply=(t,o)=>{if(api.jsParams(o).functionId==='jdh_bm_getKitTask')return response({code:0,result:{status:signed?4:1,id:'task',encodeId:'fresh'}});signed=true;return response({code:0,result:{code:0,result:{prizeInfovo:[{money:'1'},{money:2}]}}});};
   const r=await extra(h).run(task);assert.equal(r.status,'signed_confirmed');assert.equal(r.beanQuantity,3);assert(api.jsLine({task,...r}).includes('3 京豆'));
   const again=await extra(h).run(task);assert.equal(again.status,'already_done');assert.equal(again.beanQuantity,3);assert.equal(h.calls.filter(o=>api.jsParams(o).functionId==='jdh_msoa_doTaskGw').length,1);
  });
 }
 await test('health reward remains known when status verification fails',async()=>{
  const h=host();h.reply=(t,o)=>response(api.jsParams(o).functionId==='jdh_bm_getKitTask'?{code:0,result:{status:1,id:'t',encodeId:'e'}}:{code:0,result:{result:{prizeInfovo:[{money:'1'}]}}});
  const r=await extra(h).run('hs');assert.equal(r.status,'pending');assert.equal(r.beanQuantity,1);assert(api.jsLine({task:'hs',...r}).includes('接口返回 1 京豆'));const again=await extra(h).run('hs');assert.equal(again.status,'pending');assert.equal(again.beanQuantity,1);
 });
 await test('health absent or malformed money never invents a bean count',async()=>{
  for(const money of [undefined,null,'',true,{},'1.5',-1]){
   const h=host();let n=0;h.reply=()=>response(++n===1?{code:0,result:{status:1,id:'t',encodeId:'e'}}:n===2?{code:0,result:{result:{prizeInfovo:[{money}]}}}:{code:0,result:{status:4}});
   const r=await extra(h).run('ys');assert.equal(r.status,'signed_confirmed');assert.equal(r.beanQuantity,undefined);assert(api.jsLine({task:'ys',...r}).includes('接口未返回京豆数量'));
  }
 });
 await test('health explicit zero is displayed as zero',async()=>{
  const h=host();let n=0;h.reply=()=>response(++n===1?{code:0,result:{status:1,id:'t',encodeId:'e'}}:n===2?{code:0,result:{result:{prizeInfovo:[{money:0}]}}}:{code:0,result:{status:4}});
  const r=await extra(h).run('hs');assert.equal(r.beanQuantity,0);assert(api.jsLine({task:'hs',...r}).includes('0 京豆'));
 });
 await test('health rejected inner reward is not counted',async()=>{
  const h=host();let n=0;h.reply=()=>response(++n===1?{code:0,result:{status:1,id:'t',encodeId:'e'}}:n===2?{code:0,result:{code:9,result:{prizeInfovo:[{money:99}]}}}:{code:0,result:{status:4}});assert.equal((await extra(h).run('hs')).beanQuantity,undefined);
 });
 await test('health old successful journal without reward stays unknown',async()=>{
  const h=host();h.reply=()=>response({code:0,result:{status:4}});await extra(h).run('hs');const r=await extra(h).run('hs');assert.equal(r.beanQuantity,undefined);assert.equal(h.calls.length,2);
 });
 await test('game already checked in',async()=>{const h=host();h.reply=()=>response({success:true,data:{signMainVo:{currentStatus:3}}});assert.equal((await extra(h).run('game')).status,'already_done');assert.equal(h.calls.length,1);});
 await test('game uses fresh mark and confirms completion',async()=>{const h=host();let done=false;h.reply=(t,o)=>{const p=api.jsParams(o);if(p.functionId==='weGameLottery'){assert.equal(JSON.parse(p.body).markStr,'NEW_MARK');done=true;return response({success:true,data:{awardResultVO:{amount:5}}});}return response({success:true,data:{signMainVo:{currentStatus:done?3:1,markStr:'NEW_MARK'}}});};const r=await extra(h).run('game');assert.equal(r.status,'signed_confirmed');assert.equal(r.beanQuantity,5);});
 await test('game precondition does not run browse or gameplay',async()=>{const h=host();h.reply=()=>response({success:true,data:{signMainVo:{currentStatus:0}}});assert.equal((await extra(h).run('game')).status,'manual_required');assert.equal(h.calls.length,1);});
 await test('game missing mark cannot mutate',async()=>{const h=host();h.reply=()=>response({success:true,data:{signMainVo:{currentStatus:1}}});await assert.rejects(()=>extra(h).run('game'));assert.equal(h.calls.length,1);});
 await test('game accepted claim with failed verification stays pending',async()=>{const h=host();h.reply=(t,o)=>response(api.jsParams(o).functionId==='weGameLottery'?{success:true,data:{awardResultVO:{amount:5}}}:{success:true,data:{signMainVo:{currentStatus:1,markStr:'m'}}});assert.equal((await extra(h).run('game')).status,'pending');assert.equal((await extra(h).run('game')).status,'pending');assert.equal(h.calls.filter(o=>api.jsParams(o).functionId==='weGameLottery').length,1);});
 await test('game missing native signing material sends nothing',async()=>{const h=host();h.map.delete(K.extra);await assert.rejects(()=>extra(h).run('game'));assert.equal(h.calls.length,0);});
 await test('game malformed response cannot claim success',async()=>{const h=host();h.reply=()=>response({success:true,data:{signMainVo:{currentStatus:77}}});await assert.rejects(()=>extra(h).run('game'));assert.equal(h.calls.length,1);});
 await test('delivery two activities with separate journals',async()=>{const h=host();h.reply=()=>response({code:0,data:{bizCode:0,result:{value:2}}});const r=await extra(h).run('delivery');assert.equal(r.status,'accepted');assert.equal(r.parts.length,2);assert.equal(r.parts[0].beanQuantity,4);assert.equal(h.calls.length,6);await extra(h).run('delivery');assert.equal(h.calls.length,8);assert.equal(Object.keys(h.read(K.attempts)).length,4);});
 await test('delivery unknown home structure blocks writes',async()=>{const h=host();h.reply=()=>response({code:0,data:{bizCode:0}});const r=await extra(h).run('delivery');assert.equal(r.status,'partial');assert(h.calls.every(x=>api.jsParams(x).functionId==='bean_deliverySign_home'));});
 await test('delivery failed sign never triggers continue reward',async()=>{const h=host();h.reply=(t,o)=>response(api.jsParams(o).functionId==='bean_deliverySign_home'?{code:0,data:{bizCode:0,result:{}}}:{code:0,data:{bizCode:10,result:{value:2}}});await extra(h).run('delivery');assert(h.calls.every(x=>api.jsParams(x).functionId!=='bean_deliverySign_continue_award'));await extra(h).run('delivery');assert.equal(h.calls.filter(x=>api.jsParams(x).functionId==='bean_deliverySign_sign').length,2);});
 await test('delivery returned beans are not labeled verified',async()=>{const h=host();h.reply=()=>response({code:0,data:{bizCode:0,result:{value:1}}});const r=await extra(h).run('delivery');assert(!api.jsLine({task:'delivery',...r}).includes('签到成功'));assert(r.parts.every(x=>x.detail.includes('尚无状态复查')));});
 await test('delivery missing top-level code accepts explicit successful business reward',async()=>{
  const h=host();h.reply=()=>response({data:{bizCode:0,result:{value:1}}});const r=await extra(h).run('delivery');assert.equal(r.status,'accepted');assert(r.parts.every(p=>p.beanQuantity===2));assert.equal(h.calls.length,6);await extra(h).run('delivery');assert.equal(h.calls.filter(o=>api.jsParams(o).functionId==='bean_deliverySign_sign').length,2);
 });
 await test('delivery explicit transport rejection still blocks mutations',async()=>{
  const h=host();h.reply=()=>response({code:13,data:{bizCode:0,result:{value:1}}});const r=await extra(h).run('delivery');assert.equal(r.status,'partial');assert(r.parts.every(p=>p.detail==='首页查询：接口码 13'));assert.equal(h.calls.length,2);
 });
 await test('delivery business failure reports precise stage without response text',async()=>{
  const h=host();h.reply=(t,o)=>response(api.jsParams(o).functionId==='bean_deliverySign_home'?{data:{bizCode:0,result:{}}}:{data:{bizCode:9,bizMsg:'FAKE_SECRET',result:{value:9}}});const r=await extra(h).run('delivery');assert(r.parts.every(p=>p.detail==='签到：业务码 9'));assert(!JSON.stringify(r).includes('FAKE_SECRET'));assert(!h.logs.join('\n').includes('FAKE_SECRET'));
 });
 await test('delivery unknown reward field reports field names, not values',async()=>{
  const h=host();h.reply=(t,o)=>response(api.jsParams(o).functionId==='bean_deliverySign_home'?{data:{bizCode:0,result:{}}}:{data:{bizCode:0,result:{amount:'FAKE_SECRET'}}});const r=await extra(h).run('delivery');assert(r.parts.every(p=>p.detail==='签到：奖励数量字段变化'));assert.deepEqual(r.parts[0].diagnostic.rewardFields,['amount']);assert(!JSON.stringify(r).includes('FAKE_SECRET'));
 });
 await test('delivery partial reward survives later continuous-award failure',async()=>{
  const h=host();h.reply=(t,o)=>response(api.jsParams(o).functionId==='bean_deliverySign_continue_award'?{data:{bizCode:17}}:{data:{bizCode:0,result:{value:1}}});const r=await extra(h).run('delivery');assert(r.parts.every(p=>p.beanQuantity===1));assert(r.detail.includes('已返回 1 京豆，连续奖励：业务码 17'));
 });
 await test('delivery old pending record is preserved across display fix',async()=>{
  const h=host();h.reply=(t,o)=>response(api.jsParams(o).functionId==='bean_deliverySign_home'?{code:0,data:{bizCode:0,result:{}}}:{code:0,data:{bizCode:9}});await extra(h).run('delivery');h.reply=()=>response({data:{bizCode:0,result:{value:1}}});await extra(h).run('delivery');assert.equal(h.calls.filter(o=>api.jsParams(o).functionId==='bean_deliverySign_sign').length,2);assert.equal(h.calls.filter(o=>api.jsParams(o).functionId==='bean_deliverySign_continue_award').length,0);
 });
 await test('mutation journal failure blocks health action',async()=>{const h=host();h.write=(k,v)=>{if(k===K.attempts)throw Error('保存失败');h.map.set(k,JSON.stringify(v));};h.reply=()=>response({code:0,result:{status:1,id:'t',encodeId:'e'}});await assert.rejects(()=>extra(h).run('hs'));assert.equal(h.calls.length,1);});
 await test('date change after signing blocks mutation',async()=>{const h=host();h.reply=()=>response({success:true,data:{signMainVo:{currentStatus:1,markStr:'m'}}});let n=0;const c={...fakeCrypto,signOnline:async app=>{if(++n===2)h.changeDay('2099-01-01');return sig(app);}};await assert.rejects(()=>api.createExtraSignins(h,c).run('game'));assert.equal(h.calls.length,1);});
 await test('new day has independent journal',async()=>{const h=host();h.reply=(t,o)=>api.jsParams(o).functionId==='jdh_bm_getKitTask'?response({code:0,result:{status:1,id:'t',encodeId:'e'}}):Promise.reject(Error('network'));await assert.rejects(()=>extra(h).run('hs'));h.changeDay('2099-01-01');await assert.rejects(()=>extra(h).run('hs'));assert.equal(h.calls.filter(x=>api.jsParams(x).functionId==='jdh_msoa_doTaskGw').length,2);});
 await test('combined task ordering and finance double-sign position',async()=>{const h=host();seedLegacy(h);const r=await api.createSignins(h,basicLegacy(h),fakeCrypto).run({gapSeconds:0});assert.deepEqual(r.results.map(x=>x.task),api.JS_TASKS.map(x=>x[0]));assert(r.results[5].doubleSign);assert.equal(h.waits.length,0);assert.equal(r.results.length,11);});
 await test('random wait occurs only between tasks',async()=>{const h=host();seedLegacy(h);const events=[];h.log=s=>events.push(s);h.random=()=>0;await api.createSignins(h,basicLegacy(h),fakeCrypto).run({gapSeconds:15});assert.equal(h.waits.length,10);assert(h.waits.every(x=>x===5000));assert(events[0].includes('第 1/11 项'));});
 await test('random wait upper bound',async()=>{const h=host();seedLegacy(h);h.random=()=>0.999999;await api.createSignins(h,basicLegacy(h),fakeCrypto).run({gapSeconds:120});assert(h.waits.every(x=>x===120000));});
 await test('single failed legacy task leaves other sign-ins running',async()=>{const h=host();seedLegacy(h);const l=basicLegacy(h);l.jxzy=()=>{throw Error('test');};const r=await api.createSignins(h,l,fakeCrypto).run({gapSeconds:0});assert.equal(r.results[4].status,'stopped');assert.equal(r.results[9].status,'already_done');assert(r.finished);});
 await test('old LAST is not reused when a legacy lock returns early',async()=>{const h=host();seedLegacy(h);h.write('JXZY_CHECKIN_LAST_RESULT_V1',{time:1,date:day(),status:'signed_confirmed'});const l=basicLegacy(h);l.jxzy=c=>c.$done({});const r=await api.createSignins(h,l,fakeCrypto).run({gapSeconds:0});assert.equal(r.results[4].status,'stopped');});
 await test('overlap lock stops second execution',async()=>{const h=host();seedLegacy(h);h.write(K.lock,{id:'other',expires:Date.now()+100000});const r=await api.createSignins(h,basicLegacy(h),fakeCrypto).run({gapSeconds:0});assert.equal(r.busy,true);assert.equal(h.calls.length,0);});
 await test('cross-midnight queue stops before next task',async()=>{const h=host();seedLegacy(h);h.sleep=async()=>h.changeDay('2099-01-01');const r=await api.createSignins(h,basicLegacy(h),fakeCrypto).run({gapSeconds:5});assert.equal(r.finished,false);assert.equal(r.results.length,1);assert.equal(h.rawRead(K.lock),'');});
 await test('account change stops queue',async()=>{const h=host();seedLegacy(h);h.sleep=async()=>h.write(K.bound,{pin:'other'});const r=await api.createSignins(h,basicLegacy(h),fakeCrypto).run({gapSeconds:5});assert.equal(r.finished,false);assert.equal(r.results.length,1);});
 await test('legacy network adapter enforces host allowlist',async()=>{const h=host();seedLegacy(h);const l=basicLegacy(h);l.jxzy=c=>c.$httpClient.post({url:'https://example.com/steal',headers:headers()},(e)=>{assert(e);c.$done({});});await api.createSignins(h,l,fakeCrypto).run({gapSeconds:0});assert(!h.calls.some(x=>x.url.includes('example.com')));});
 await test('combined logs and saved summary omit cookie and device token',async()=>{const h=host();seedLegacy(h);const r=await api.createSignins(h,basicLegacy(h),fakeCrypto).run({gapSeconds:0});const text=JSON.stringify(r)+h.logs.join('\n');assert(!/FAKE_SECRET|FINANCE_SECRET|FAKE_DEVICE/.test(text));});
 await test('incremental and final results persist without profile erasure',async()=>{const h=host();seedLegacy(h);const old=h.rawRead('JD_JR_CHECKIN_ACCOUNT_V1');await api.createSignins(h,basicLegacy(h),fakeCrypto).run({gapSeconds:0});assert.equal(h.rawRead('JD_JR_CHECKIN_ACCOUNT_V1'),old);assert.equal(h.read(K.history).length,1);assert(h.read(K.last).finished);});
 await test('capture skips script generated requests',async()=>{const h=host(),r=request('startup',{});r.headers['X-Lazing-Signin-Run']='1';assert.equal(await capture(h,r,{code:0}),null);});
 await test('capture leaves splash start and arbitrary APIs alone',async()=>{const h=host();assert.equal(await capture(h,request('start',{}),{code:0}),null);assert.equal(await capture(h,request('unknown',{}),{code:0}),null);});
 await test('capture ignores foreign account without overwriting',async()=>{const h=host(),r=request('startup',{});r.headers.Cookie='pt_pin=other;pt_key=OTHER;';assert((await capture(h,r,{code:0})).ignored);assert(h.rawRead(K.login).includes('FAKE_SECRET'));});
 await test('capture daily login updates own and compatibility stores',async()=>{const h=host(),r=request('startup',{});r.headers.Cookie='pt_pin=offline;pt_key=NEW;';const before=JSON.stringify(r),out=await capture(h,r,{code:0});assert(out.updated.includes(K.login));assert(h.read('QL_BRIDGE_CREDENTIAL_V1').cookie.includes('NEW'));assert.equal(JSON.stringify(r),before);});
 await test('capture rejects failed daily response',async()=>{const h=host(),old=h.rawRead(K.login);assert.equal(await capture(h,request('startup',{}),{code:13}),null);assert.equal(h.rawRead(K.login),old);});
 await test('capture game environment records no mark or live signature',async()=>{const h=host(),r=request('weGameHome',{envType:1,linkId:api.JS_GAME,babelChannel:'ttt106'},{appid:'wegame-hub',clientVersion:'15.0.0','x-api-eid-token':'NEW_DEVICE',h5st:sig('101aa')});await capture(h,r,{success:true,data:{signMainVo:{currentStatus:3,markStr:'PRIVATE_MARK'}}});const stored=h.rawRead(K.extra);assert(stored.includes('NEW_DEVICE'));assert(!stored.includes('PRIVATE_MARK'));assert(!stored.includes('tk03_fixture'));});
 await test('capture accepts delivery business success without top-level code',async()=>{
  const h=host(),r=request('bean_deliverySign_sign',{activityId:'2775'},{appid:'signed_wh5_ihub',client:'apple',clientVersion:'15.0.0','x-api-eid-token':'DELIVERY_DEVICE',h5st:sig('987dd')});await capture(h,r,{data:{bizCode:0,result:{value:1}}});assert(h.read(K.extra).delivery.params['x-api-eid-token']==='DELIVERY_DEVICE');
 });
 await test('capture invalid environment account is rejected',async()=>{const h=host(),r=request('weGameHome',{envType:1,linkId:api.JS_GAME},{appid:'wegame-hub','x-api-eid-token':'x',h5st:sig('101aa',encodeEnv({...env(),pp:{p1:'other'}}))});await assert.rejects(()=>capture(h,r,{success:true}));});
 await test('body-only native capture is normalized privately',async()=>{const h=host(),r=request('startup',{});r.url='https://api.m.jd.com/client.action';const old=r.url;assert((await capture(h,r,{code:0})).updated);assert.equal(r.url,old);});
 await test('scratch business success code is accepted by capture',async()=>{
  const h=host(),r=request('bff_rightsCenter_jdInteractTask',{taskType:'beanDailySign_beanDailyPlus_newBeanTask',scene:'jdInteractTask'},{appid:'plus_business',h5st:sig('b63ff')});
  await capture(h,r,{code:'1711000',msg:'成功',rs:{beanTask:{taskList:[{encryptAssignmentId:'q',assignmentType:5,ext:{taskType:'beanDailySign'}}]}}});assert(h.read('JD_CHECKIN_TEST_ACCOUNT_V1').modes.scratch);
 });
 await test('capture finance never replaces generic JD cookie',async()=>{
  const h=host(),r={method:'POST',url:'https://ms.jr.jd.com/gw2/generic/jrSign/h5/m/queryWeekSignMain',headers:{...headers(),Cookie:'pt_pin=offline;pt_key=FINANCE_SECRET;'},body:form({reqData:JSON.stringify({site:'H5',channelSource:'fixture',signVersion:1,riskDeviceParam:{fixture:true}})})};
  await capture(h,r,{resultCode:0,success:true,resultData:{resBusiCode:0,resBusiData:{sign:false}}});assert(h.rawRead('JD_JR_CHECKIN_ACCOUNT_V1').includes('FINANCE_SECRET'));assert(!h.rawRead(K.login).includes('FINANCE_SECRET'));
 });
 await test('farm passive delegation persists query without task execution',async()=>{const h=host(),r=request('apTaskList',{linkId:'fWWo3YmB983abNOJPR7veg'},{appid:'activities_platform'});r.headers.Referer='https://pro.m.jd.com/mall/active/42HV4J3Q87B2xFQMJk81PCc1mEs3/index.html';await capture(h,r,{code:0,data:[]});assert(h.read('JD_FARM_TASKS_ACCOUNT_V1').scopes.farm);assert.equal(h.calls.length,0);});
 await test('actual embedded legacy normal check-in queries completed state',async()=>{
  const h=host(),e=encodeEnv(env()),encoding='of7rHGHQ8GlOIyVOF6JQ8G1P5WFW3yVSC61T-bEQGGlQI6ZNHuFT-bVR7qUT';
  h.write('JD_CHECKIN_TEST_ACCOUNT_V1',{pin:'offline',modes:{daily:{capturedAt:Date.now(),headers:headers(),query:{endpoint:'https://api.m.jd.com/client.action',capturedAt:Date.now(),signatureAppId:'ed9a2',signatureParameterEncoding:encoding,referenceEnvironmentEncoded:e,params:{functionId:'findBeanSceneNew',appid:'signed_wh5_ihub',client:'apple',clientVersion:'15.0.0',body:'{}','x-api-eid-token':'FAKE_DEVICE'}}}}});
  const timers=[];let finish;const complete=new Promise(r=>finish=r);api.runRetailSignin({$argument:'daily',$persistentStore:{read:h.rawRead,write:h.rawWrite},$notification:{post:()=>{}},$httpClient:{post:(o,cb)=>{assert.equal(api.jsParams(o).functionId,'findBeanSceneNew');cb(null,{status:200},JSON.stringify({code:0,data:{signComponentInfoResult:[{assignmentType:5,ext:{taskType:'beanDailySign'},encryptAssignmentId:'q',completionFlag:true}]}}));}},$done:finish,$script:{},console:{log:()=>{}},setTimeout:(f,n)=>{const t=setTimeout(f,n);timers.push(t);return t;},clearTimeout});try{await complete;assert.equal(h.read('JD_CHECKIN_TEST_LAST_RESULT_V1').status,'already_done');}finally{timers.forEach(clearTimeout);}
 });
 await test('actual plant wrapper shares SDK and confirms existing check-in',async()=>{
  const h=host(),link='4HcenxuZM4XiHesOb1HG4g',timers=[];h.write('JD_PLANT_CHECKIN_ACCOUNT_V1',{pin:'offline',query:{headers:headers(),capturedAt:Date.now(),endpoint:'https://api.m.jd.com/api',environment:encodeEnv(env()),appId:'101aa',encoding:'qbkgHGHQ8GlOIyVOF6JQ8G1P5WFW3yVSC61T-bEQGGlQI6ZNHuFT-bVR7qUT',params:{appid:'wegame-hub',functionId:'weGameHome',client:'ios',clientVersion:'15.0.0',body:JSON.stringify({envType:1,linkId:link,appType:1})}}});
  let finish;const done=new Promise(r=>finish=r);api.runPlantSignin({$argument:'manual',$persistentStore:{read:h.rawRead,write:h.rawWrite},$notification:{post:()=>{}},$httpClient:{post:(o,cb)=>cb(null,{status:200},JSON.stringify({success:true,code:0,data:{signMainVo:{currentStatus:3,startTime:day(),endTime:'2099-01-01',markStr:null},signListVo:[{signDate:day(),status:3,todayFlag:1}]}}))},$done:finish,$script:{},console:{log:()=>{}},setTimeout:(f,n)=>{const t=setTimeout(f,n);timers.push(t);return t;},clearTimeout});try{await done;assert.equal(h.read('JD_PLANT_CHECKIN_LAST_RESULT_V1').status,'already_done');}finally{timers.forEach(clearTimeout);}
 });
 await test('actual Jingxi wrapper preserves activity scope and completion',async()=>{
  const h=host(),page='2iqSwv1JiDHxAkHAikfU6XAECFmo';h.write('JXZY_CHECKIN_ACCOUNT_V1',{pin:'offline',headers:{...headers(),Referer:'https://pro.m.jd.com/mall/active/'+page+'/index.html'},capturedAt:Date.now(),query:{endpoint:'https://api.m.jd.com/api',params:{functionId:'jxzy_active_querySign',appid:'jx_h5_babel',channel:'jxh5',client:'jxh5',body:JSON.stringify({source:'jxzy',craftId:'6824629a7c46584759d39b78',tttId:'ttt2',canInstall:1,installed:0,sceneval:2,buid:325,appCode:'ms1888ebbf'})}},signing:{environment:encodeEnv(env()),capturedAt:Date.now(),eidToken:'FAKE_DEVICE'}});
  let finish;const done=new Promise(r=>finish=r);api.runJxSignin({$argument:'manual',$persistentStore:{read:h.rawRead,write:h.rawWrite},$notification:{post:()=>{}},$httpClient:{post:(o,cb)=>cb(null,{status:200},JSON.stringify({code:0,data:{itemId:'1',status:2,alreadySignDays:1,totalSignDays:3,signList:[day()+'_1.0'],prizeInfos:[]}}))},$done:finish,$script:{},console:{log:()=>{}},setTimeout,clearTimeout});await done;assert.equal(h.read('JXZY_CHECKIN_LAST_RESULT_V1').status,'already_done',h.read('JXZY_CHECKIN_LAST_RESULT_V1').message);
 });
 await test('actual finance wrapper checks cash and dual-sign independently',async()=>{
  const h=host();h.write('JD_JR_CHECKIN_ACCOUNT_V1',{pin:'offline',ready:true,headers:headers(),query:{site:'JD_JR_APP',channelSource:'JRAPP6.0',channelLv:'guangab',signVersion:'12',clientVersion:'8.2.70',clientType:'ios'},riskDeviceParam:'{"fixture":true}'});
  let finish;const done=new Promise(r=>finish=r),calls=[];api.runFinanceSignin({$argument:'manual',$persistentStore:{read:h.rawRead,write:h.rawWrite},$notification:{post:()=>{}},$httpClient:{post:(o,cb)=>{calls.push(o);cb(null,{status:200},JSON.stringify(o.url.includes('queryWeekSignMain')?{success:true,resultCode:0,resultData:{resBusiCode:0,resBusiData:{sign:true,today:Number(day().replace(/-/g,'')),dailyCash:{current:{amount:'0.02'}}}}}:{success:true,resultCode:0,resultData:{hasError:false,resultList:[{templateData:{data:{businessCode:'000sq',businessData:{dateTime:day()+' 10:00:00',signInJd:true,signInJr:true,get:true}}}}]}}));}},$done:finish,$script:{},console:{log:()=>{}},setTimeout,clearTimeout});await done;const r=h.read('JD_JR_CHECKIN_LAST_RESULT_V1');assert.equal(r.status,'already_done');assert.equal(r.doubleSign.status,'already_done');assert.equal(calls.length,2);
 });
 await test('queue notices external lock replacement',async()=>{const h=host();seedLegacy(h);h.sleep=async()=>h.write(K.lock,{id:'replacement',expires:Date.now()+99999});const r=await api.createSignins(h,basicLegacy(h),fakeCrypto).run({gapSeconds:5});assert.equal(r.finished,false);assert.equal(r.results.length,1);assert.equal(h.read(K.lock).id,'replacement');});
 await test('official embedded SDK initializes server algorithm for both revisions',async()=>{
  for(const version of ['h5_file_v5.3.5','h5_file_v5.3.6']){
   const cache=new Map();let count=0;const c=api.createSigninCrypto({read:(k,f)=>cache.get(k)||f,write:(k,v)=>cache.set(k,v),setTimeout:()=>0,clearTimeout:()=>{},progress:()=>{},requestAlgo:async o=>{count++;assert(!Object.keys(o.headers).some(k=>/cookie|authorization/i.test(k)));assert.equal(o.url,'https://cactus.jd.com/request_algo');const b=JSON.parse(o.body);return response({status:200,data:{ts:Date.now(),result:{fp:b.fp,tk:'tk03'+'a'.repeat(88),algo:'function test(tk,fp,ts,ai,algo){return algo.HmacSHA256(tk+fp+ts+ai,"offline");}'}}});}});
   const profile={pin:'offline',headers:headers()},input={appid:'wegame-hub',body:c.hash('{}'),functionId:'weGameHome',t:String(Date.now()),client:'apple',clientVersion:'15.0.0'};
   const s=await c.signOnline('101aa',profile,{...env(),v:version},input);assert.equal(s.split(';')[3],'tk03'+'a'.repeat(88));assert.equal(count,1);assert.equal((await c.signOnline('101aa',profile,{...env(),v:version},input)).split(';')[3],s.split(';')[3]);assert.equal(count,1);
  }
 });
 await test('complete Loon entry produces exactly one final notification',async()=>{
  const h=host(),notes=[],timers=[];let finish,count=0;const done=new Promise(r=>finish=r),calls=[];
  const ctx={$argument:{gapSeconds:0},$persistentStore:{read:h.rawRead,write:h.rawWrite},$notification:{post:(...a)=>notes.push(a)},$done:()=>{count++;finish();},console:{log:s=>h.logs.push(s)},setTimeout:(f,n)=>{const t=setTimeout(f,n);timers.push(t);return t;},clearTimeout,$httpClient:{post:(o,cb)=>{
   calls.push(o);let j;
   if(o.url==='https://cactus.jd.com/request_algo'){assert(!o.headers.Cookie);const b=JSON.parse(o.body);j={status:200,data:{ts:Date.now(),result:{fp:b.fp,tk:'tk03'+'a'.repeat(88),algo:'function test(tk,fp,ts,ai,algo){return algo.HmacSHA256(tk+fp+ts+ai,"offline");}'}}};}
   else{const p=api.jsParams(o);assert.equal(o['auto-redirect'],false);assert.equal(o['auto-cookie'],false);if(p.functionId==='jdh_bm_getKitTask')j={code:0,result:{status:4}};else if(p.functionId==='weGameHome')j={success:true,data:{signMainVo:{currentStatus:3}}};else if(p.functionId.startsWith('bean_deliverySign_'))j={code:0,data:{bizCode:0,result:{value:1}}};else throw Error('Unexpected native call');}
   cb(null,{status:200},JSON.stringify(j));
  }}};
  try{vm.runInNewContext(fs.readFileSync(mainPath,'utf8'),ctx,{timeout:10000});await done;assert.equal(notes.length,1);assert.equal(count,1);assert.equal(h.read(K.last).results.length,11);assert(!JSON.stringify(notes).includes('FAKE_SECRET'));assert(!h.logs.join('\n').includes('FAKE_DEVICE'));}finally{timers.forEach(clearTimeout);}
 });
 // Verify generated artifacts parse in a native-like context without Node globals.
 await test('generated Loon scripts parse without Node APIs',()=>{for(const p of [mainPath,capturePath])new vm.Script(fs.readFileSync(p,'utf8'));});
 console.log('Passed '+total+' offline checks. No live account requests.');
})().catch(e=>{console.error(e);process.exitCode=1;});
