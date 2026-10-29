// Three manual activities; synthetic identities and responses, no live account requests.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=fs.existsSync(path.join(__dirname,'发布包'))?path.join(__dirname,'发布包'):path.join(__dirname,'..');
const src=n=>fs.readFileSync(path.join(root,'Scripts',n),'utf8');
const captureSource=src('jd-activity-capture.js'),jxSource=src('jd-jxzy-activity.js'),farmSource=src('jd-farm-activity.js');
const cap=require(path.join(root,'Scripts/jd-activity-capture.js')),farm=require(path.join(root,'Scripts/jd-farm-activity.js'));
const jx={};vm.runInNewContext(jxSource.split('(async function jxLoonTaskMain(){')[0]+'\nObject.assign(EXPOSE,{actSharedMaterial,actJxProfile,actJxTaskCapture});',{EXPOSE:jx},{timeout:3000});
const plugin=fs.readFileSync(path.join(root,'Plugins/jd-activities.plugin'),'utf8');let total=0;
const tests=[];const test=(n,f)=>tests.push([n,f]);
const headers={Cookie:'pt_key=OFFLINE_KEY;pt_pin=offline;','User-Agent':'Offline test',Referer:'https://pro.m.jd.com/'};
const params=p=>new URLSearchParams(Object.entries(p).map(([k,v])=>[k,typeof v==='object'?JSON.stringify(v):v])).toString();
const sig=['date','fp','35fa0','token','hash','5.3','timestamp','OFFLINE_ENV','hash','fields'].join(';');
async function dispatch(fn,body,extra={},response={code:0},initial={}){
 const store={...initial},logs=[],notes=[];let finished=false,out;
 const sandbox={console:{log:x=>logs.push(String(x))},setTimeout,clearTimeout,
 $request:{method:'POST',url:extra.url||'https://api.m.jd.com/api',headers:{...headers,...extra.headers},body:params({functionId:fn,body,...extra.params})},
 $response:{status:200,body:JSON.stringify(response)},$persistentStore:{read:k=>store[k]||null,write:(v,k)=>{store[k]=v;return true;}},
 $notification:{post:(...x)=>notes.push(x)},$httpClient:{get:()=>{throw Error('forbidden network');},post:()=>{throw Error('forbidden network');}},$done:x=>{out=x;finished=true;}};
 vm.runInNewContext(captureSource,sandbox,{timeout:3000});for(let i=0;i<30&&!finished;i++)await new Promise(r=>setTimeout(r,1));assert(finished);return {store,logs,notes,out};
}
test('six manual entries, no cron',()=>{assert.equal((plugin.match(/^generic then/gm)||[]).length,6);assert(!/^cron /m.test(plugin));assert(plugin.includes('tag="家电家居"'));assert(plugin.includes('tag="京喜自营"'));assert(plugin.includes('tag="东东农场"'));});
for(const n of ['jd-golden-egg.js','jd-earn-beans.js','jd-wheel-activity.js'])test('removed release file '+n,()=>{assert(!fs.existsSync(path.join(root,'Scripts',n)));assert(!plugin.includes(n));});
test('capture keeps PLUS and financial signin routes',()=>{assert(captureSource.includes("expected = mode==='blindbox' ? '35fa0'"));assert(plugin.includes('getPageInfoDoubleSignInForH5'));assert(plugin.includes('getPageInfoSafetyTranslate'));assert(plugin.includes('tag="医药赚京豆"'));});
test('retired clients and automatic device/receipt requests absent',()=>{for(const s of [captureSource,jxSource])for(const key of ['createEggClient','createEarnClient','createEarnLedger','EARN_PATHS','EGG_PROJECT','jsTk.do','beanDetail/detail.json'])assert(!s.includes(key),key);});
for(const n of ['JD_SIGNIN_LOGIN_V1','JD_CHECKIN_TEST_ACCOUNT_V1','JXZY_CHECKIN_ACCOUNT_V1','JD_FARM_TASKS_ACCOUNT_V1','JD_JR_CHECKIN_ACCOUNT_V1'])test('keeps shared storage key '+n,()=>assert(captureSource.includes(n)));
test('PLUS capture from empty store persists the signin template and shared Cookie',async()=>{const r=await dispatch('bff_marketing_interaction',{scene:'blindBox',touchPoint:'purePlusIndexNew2608'},{params:{appid:'plus_business',h5st:sig}},{code:'1711000',msg:'成功',rs:{leftTimes:1,sendBenefitList:[]}});const p=JSON.parse(r.store.JD_CHECKIN_TEST_ACCOUNT_V1);assert.equal(p.modes.blindbox.query.signatureAppId,'35fa0');assert.equal(p.modes.blindbox.query.referenceEnvironmentEncoded,'OFFLINE_ENV');assert(!p.modes.blindbox.query.params.h5st);assert(JSON.parse(r.store.JD_SIGNIN_LOGIN_V1).cookie.includes('OFFLINE_KEY'));});
test('ordinary native request refreshes login',async()=>{const r=await dispatch('logConfig',{});assert(JSON.parse(r.store.JD_SIGNIN_LOGIN_V1).cookie.includes('OFFLINE_KEY'));});
test('bound account rejects another account capture',async()=>{const r=await dispatch('logConfig',{}, {},{code:0},{JD_SIGNIN_ACCOUNT_V1:JSON.stringify({pin:'other'})});assert(!r.store.JD_SIGNIN_LOGIN_V1);});
for(const fn of ['interact_pre_executor','getPageInfoSafetyTranslate'])test('removed activity template is not captured: '+fn,async()=>{const r=await dispatch(fn,{encryptProjectId:'old'});assert(!r.store.JD_ACTIVITY_TASKS_ACCOUNT_V1);assert(!Object.keys(r.store).some(k=>/journal|receipt/.test(k)));});
test('Jingxi task-list-only visit preserves query without inventing a signature',async()=>{const r=await dispatch('jxzy_active_task_queryTaskList',{source:'jxzy',craftId:'6824629a7c46584759d39b78',sceneval:2,buid:325,appCode:'ms1888ebbf',signStr:'OLD_SIGNATURE',time:123},{params:{appid:'jx_h5_babel',client:'jxh5',channel:'jxh5'},headers:{Referer:'https://pro.m.jd.com/mall/active/2iqSwv1JiDHxAkHAikfU6XAECFmo/index.html'}},{code:0,data:{taskInfoList:[]}});const p=JSON.parse(r.store.JXZY_CHECKIN_ACCOUNT_V1);assert(p.query);assert(!p.signing);assert(!JSON.stringify(p).includes('OLD_SIGNATURE'));});
test('farm task query is passively captured',async()=>{const r=await dispatch('apTaskList',{linkId:'fWWo3YmB983abNOJPR7veg',queryType:0,channel:4},{params:{appid:'activities_platform',client:'ios',clientVersion:'16.1.50'},headers:{Referer:'https://pro.m.jd.com/mall/active/42HV4J3Q87B2xFQMJk81PCc1mEs3/index.html'}},{code:0,data:[]});assert(JSON.parse(r.store.JD_FARM_TASKS_ACCOUNT_V1).scopes.farm);});
test('farm entry cannot switch to lottery through arguments',()=>{assert(farmSource.includes("const mode='farm-all';"));assert(!farmSource.includes("const mode=typeof $argument==='string'?$argument:'status';"));});
test('farm has no automatic watering endpoint',()=>{const t=farm.farmTools();assert(![...t.ALLOWED].some(x=>/water|irrigat/i.test(x)));});
test('latest canonical Cookie beats stale page Cookie',()=>{const d={JD_SIGNIN_LOGIN_V1:{pin:'offline',cookie:'pt_key=NEW;pt_pin=offline;',headers:{...headers,Cookie:'pt_key=STALE;pt_pin=offline;'},capturedAt:10},JD_CHECKIN_TEST_ACCOUNT_V1:{pin:'offline',modes:{blindbox:{headers,capturedAt:2}}}};const s=jx.actSharedMaterial((k,f)=>d[k]||f,()=>({pp:{p1:'offline'}}));assert(s.headers.Cookie.includes('NEW'));assert(!s.headers.Cookie.includes('STALE'));});
test('another account cannot supply shared material',()=>{assert.throws(()=>jx.actSharedMaterial((k,f)=>k==='JD_SIGNIN_ACCOUNT_V1'?{pin:'other'}:k==='JD_SIGNIN_LOGIN_V1'?{pin:'offline',cookie:headers.Cookie,headers,capturedAt:1}:f,()=>({})),/缺少京东Cookie/);});
test('Cookie alone does not fabricate PLUS or Jingxi signing templates',()=>{const d={JD_SIGNIN_LOGIN_V1:{pin:'offline',cookie:headers.Cookie,headers,capturedAt:1}};assert.throws(()=>jx.actJxProfile((k,f)=>d[k]||f,()=>({})),/共享设备资料不完整/);});
test('all release scripts parse',()=>{for(const n of ['jd-jxzy-activity.js','jd-farm-activity.js','jd-activity-capture.js','jd-coupon-activity.js'])new vm.Script(src(n));});
(async()=>{for(const [n,f]of tests){await f();total++;console.log('PASS '+n);}console.log(total+' checks passed; synthetic data, no live account requests.');})().catch(e=>{console.error(e);process.exitCode=1;});

