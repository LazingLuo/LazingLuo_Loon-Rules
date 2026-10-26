// Independent synthetic coverage of the two new captured pages. No live account.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),nodeCrypto=require('crypto');
const local=fs.existsSync(path.join(__dirname,'发布包')),root=local?path.join(__dirname,'发布包'):path.join(__dirname,'..');
const signRoot=local?path.join(__dirname,'..','loon-jd-signin'):path.join(root,'Scripts');
const api=require(path.join(signRoot,'jd-signin.js')),cap=require(path.join(root,'Scripts','jd-activity-capture.js'));
const coupon=require(path.join(root,'Scripts','jd-coupon-activity.js'));
const hash=x=>nodeCrypto.createHash('sha256').update(x).digest('hex');
const env={v:'h5_file_v5.3.6',fp:'reference-fixture',pp:{p1:'offline'},extend:{bu6:33,bu13:'F3'},canvas:'a'.repeat(32),webglFp:'b'.repeat(32)};
const chars='rqponmlkjihgfedcbaZYXWVUTSRQPONMLKJIHGFEDCBA-_9876543210zyxwvuts',normal='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const encoded=[...Buffer.from(JSON.stringify(env)+'x').toString('base64').replace(/=+$/,'')].map(x=>chars[normal.indexOf(x)]).reverse().join('');
const sig=(app,last)=>['date','1234567890123456',app,'tk03_fake','hash','5.3','time',encoded,'hash',last||'fields'].join(';');
const housePage='2H8G6a7JecjqHH3t1ZWSoJjPtziP',houseCraft='69ae8eb86a31c802e19f9f8f',jxCraft='6824629a7c46584759d39b78';
const homeHeaders={Cookie:'pt_pin=offline;pt_key=FAKE;','User-Agent':'Offline',Referer:'https://pro.m.jd.com/mall/active/'+housePage+'/index.html'};
const queryBody={source:'jxzy',craftId:houseCraft,tttId:'ttt165',sceneval:2,buid:325,appCode:'ms1888ebbf'};
const pageBody={activeVersion:2,configIds:'PUBLIC_CONFIG',pageId:housePage,tttId:'ttt165',edit:0,benefitEdit:0,sceneval:2,buid:325,appCode:'ms1888ebbf'};
function signedBody(b){const x={...b,time:123};const value=Object.keys(x).sort().filter(k=>x[k]!==null&&x[k]!==undefined&&x[k]!=='').map(k=>typeof x[k]==='object'?JSON.stringify(x[k]):x[k]).join('&');x.signStr=nodeCrypto.createHmac('md5','xtl_sqg_mall-^&*-damai_(789)_@#$').update(value).digest('hex');return x;}
const reply=data=>({status:200,body:JSON.stringify(data)});
const queryResult=(done=false)=>({code:0,data:{status:done?2:1,itemId:'1',totalSignDays:3,alreadySignDays:done?1:0,...(done?{signList:[new Date(Date.now()+8*3600000).toISOString().slice(0,10)+'_1.0']}:{}),prizeInfos:[]}});
function host(){let now=Date.now();const day=new Date(now+8*3600000).toISOString().slice(0,10),map={},calls=[],waits=[],logs=[];
 const h={read:(k,f)=>!map[k]?f:JSON.parse(map[k]),write:(k,v)=>{map[k]=JSON.stringify(v);},rawRead:k=>map[k]||null,rawWrite:(v,k)=>{map[k]=v;return true;},now:()=>now,day:()=>day,random:()=>0.5,map,calls,waits,logs,log:x=>logs.push(x),sleep:async ms=>{waits.push(ms);now+=ms;},request:async(t,o)=>{calls.push(o);return h.reply(o);}};
 h.write('JD_SIGNIN_ACCOUNT_V1',{pin:'offline'});h.write('JD_SIGNIN_LOGIN_V1',{pin:'offline',cookie:homeHeaders.Cookie,headers:homeHeaders,capturedAt:1});return h;
}
const parsers={retail:cap.runRetailCapture,jxzy:cap.runJxCapture,home:cap.runHomeCapture,finance:cap.runFinanceCapture,plant:cap.runPlantCapture,farm:cap.farmCapture};
async function capture(h,f,b,{cookie=true,app='832f1',header={},params={}}={},j=queryResult()){
 const p={functionId:f,appid:'jx_h5_babel',channel:'jxh5',client:'jxh5',clientVersion:'1.2.5',body:JSON.stringify(signedBody(b)),...(f==='jxzy_active_querySign'?{}:{h5st:sig(app), 'x-api-eid-token':'FAKE_EID'}),...params};
 return cap.jsCapture(h,{method:'POST',url:'https://api.m.jd.com/api',headers:{...homeHeaders,...(!cookie?{Cookie:'page=only;'}:{}),...header},body:new URLSearchParams(p).toString()},reply(j),parsers,cap.farmDecodeEnvironment);
}
const task=(patch={})=>({assignmentName:'逛家电家居',assignmentType:1,assignmentDesc:'完成任务，可获得京豆',assignmentTimesLimit:1,completionCnt:0,completionFlag:false,encryptAssignmentId:'FAKE_ASSIGN',ext:{extraType:'shoppingActivity',waitDuration:5,shoppingActivity:[{status:1,itemId:'FAKE_ITEM',url:'https://pro.m.jd.com/mall/active/example/index.html'}]},...patch});
function setup(){const h=host();h.write(coupon.JC_KEY,{pin:'offline',headers:homeHeaders,params:{appid:'hourly-m',client:'apple',clientVersion:'16.1.50','x-api-eid-token':'FAKE_EID'},common:{scene:'jinquan',area:'OFFLINE_AREA'},signing:{environment:encoded,encoding:coupon.JC_ENCODING},capturedAt:1});return h;}
const fakeCrypto={hash,decodeEnvironment:cap.farmDecodeEnvironment,signOnline:async(app,p,e,input)=>{assert.deepEqual(Object.keys(input),['appid','body','client','clientVersion','functionId']);return sig(app,coupon.JC_ENCODING);}};
function serve(h,{failStart=false,failFinish=false,unconfirmed=false,needSlide=0,beans=true,tasks=[task()]}={}){let finished=false;h.reply=o=>{
 const p=api.jsParams(o),b=JSON.parse(p.body);assert.equal(p.appid,'hourly-m');assert.equal(b.scene,'jinquan');assert(!p.t);
 if(p.functionId==='sh_c_query_task_list')return reply({success:true,code:0,data:{subCode:'0',taskList:tasks.map(t=>({...t,completionFlag:finished&&!unconfirmed||t.completionFlag}))}});
 assert.equal(p.functionId,'sh_c_do_task');
 if(b.actionType===1){if(failStart)throw Error('network');return reply({success:true,code:0,data:{subCode:'1',toUrl:'openapp.jdmobile://virtual?params='+JSON.stringify({des:'countdown',needSlide,second:5})}});}
 assert.equal(b.actionType,0);if(failFinish)throw Error('network');finished=true;return reply({success:true,code:0,data:{subCode:'0',failRewards:[],...(beans?{successRewards:{'3':[{quantity:1,rewardName:'京豆',rewardType:3}]}}:{})}});
 };}
const tests=[];const test=(n,f)=>tests.push([n,f]);
test('house is eleventh sign-in with no additional menu',()=>{assert.equal(api.JS_TASKS.length,11);assert.deepEqual(api.JS_TASKS.at(-1),['home','家电家居签到']);});
test('house query and page environment use independent storage',async()=>{const h=host();h.write('JXZY_CHECKIN_ACCOUNT_V1',{pin:'offline',keep:true});await capture(h,'jxzy_active_querySign',queryBody);await capture(h,'jxzy_active_queryActive',pageBody,{}, {code:0,data:{}});const p=h.read('JD_HOME_CHECKIN_ACCOUNT_V1');assert(p.query&&p.signing);assert.equal(JSON.parse(p.query.params.body).craftId,houseCraft);assert(!p.query.params.h5st);assert(!p.query.params.body.includes('signStr'));assert.deepEqual(h.read('JXZY_CHECKIN_ACCOUNT_V1'),{pin:'offline',keep:true});});
test('native house capture uses existing shared Cookie when page omits login',async()=>{const h=host();await capture(h,'jxzy_active_querySign',queryBody,{cookie:false});await capture(h,'jxzy_active_queryActive',pageBody,{cookie:false},{code:0,data:{}});assert(h.read('JD_HOME_CHECKIN_ACCOUNT_V1').signing);assert(h.read('JD_HOME_CHECKIN_ACCOUNT_V1').headers.Cookie.includes('pt_key=FAKE'));});
test('native page without shared login cannot invent credentials',async()=>{const h=host();delete h.map.JD_SIGNIN_LOGIN_V1;await capture(h,'jxzy_active_querySign',queryBody,{cookie:false});assert(!h.read('JD_HOME_CHECKIN_ACCOUNT_V1',null));});
test('house page cannot replace Jingxi query material',async()=>{const h=host();await capture(h,'jxzy_active_querySign',queryBody);assert.equal(api.jsLegacyAccount('jxzy','offline',h.read,h.read('JD_SIGNIN_LOGIN_V1')).value,null);assert(api.jsLegacyAccount('home','offline',h.read,h.read('JD_SIGNIN_LOGIN_V1')).value);});
test('house runner rejects the old Jingxi craft',()=>{assert.throws(()=>api.jsTarget('home',{url:'https://api.m.jd.com/api',body:new URLSearchParams({functionId:'jxzy_active_drawSign',appid:'jx_h5_babel',body:JSON.stringify({...queryBody,craftId:jxCraft})}).toString()}));});
test('house capture rejects another account and mismatching referer',async()=>{for(const header of [{Cookie:'pt_pin=other;pt_key=OTHER;'},{Referer:'https://evil.test/'}]){const h=host();await capture(h,'jxzy_active_querySign',queryBody,{header});assert(!h.read('JD_HOME_CHECKIN_ACCOUNT_V1',null));}});
test('actual house sign-in wrapper queries signs claims and verifies one bean',async()=>{
 const h=host();await capture(h,'jxzy_active_querySign',queryBody);await capture(h,'jxzy_active_queryActive',pageBody,{}, {code:0,data:{}});let signed=false,claims=0;
 async function invoke(){return new Promise(resolve=>{api.runHomeSignin({$argument:'manual',$persistentStore:{read:h.rawRead,write:h.rawWrite},$notification:{post:()=>{}},console:{log:()=>{}},setTimeout:()=>1,clearTimeout:()=>{},$done:resolve,$httpClient:{post:(o,cb)=>{
  const p=api.jsParams(o),b=JSON.parse(p.body);assert.equal(b.craftId,houseCraft);assert.equal(p.appid,'jx_h5_babel');
  if(p.functionId==='jxzy_active_querySign')return cb(null,{status:200},JSON.stringify(queryResult(signed)));
  assert.equal(p.functionId,'jxzy_active_drawSign');assert.equal(p.h5st.split(';')[2],'c50cc');assert.equal(b.itemId,'1');signed=true;claims++;
  cb(null,{status:200},JSON.stringify({code:0,data:{alreadySignDays:1,signList:[new Date(Date.now()+8*3600000).toISOString().slice(0,10)+'_1.0'],prizeInfos:[{prizeType:2,discount:1}]}}));
 }}});});}
 await invoke();const r=h.read('JD_HOME_CHECKIN_LAST_RESULT_V1');assert.equal(r.status,'signed_confirmed',r.message);assert.equal(r.beanQuantity,1);await invoke();assert.equal(claims,1);assert.equal(h.read('JD_HOME_CHECKIN_LAST_RESULT_V1').status,'already_done');
});
test('coupon page captures no old action body or h5st',async()=>{const h=host(),headers={...homeHeaders,Referer:'https://pro.m.jd.com/mall/active/2BGmkjr2mbi81R4ozsAR1ragZcyh/index.html',Cookie:'page=only;'};
 const r={method:'POST',url:'https://api.m.jd.com/client.action?functionId=sh_c_query_task_list',headers,body:new URLSearchParams({functionId:'sh_c_query_task_list',appid:'hourly-m',client:'apple',clientVersion:'16.1.50','x-api-eid-token':'FAKE_EID',body:JSON.stringify({scene:'jinquan',viewStage:'taskList',area:'TEST_AREA'}),h5st:sig('35fa0',coupon.JC_ENCODING)}).toString()};
 await cap.jsCapture(h,r,reply({success:true,code:0,data:{subCode:'0',taskList:[task()]}}),parsers,cap.farmDecodeEnvironment);const p=h.read(coupon.JC_KEY);assert(p);assert(!p.params.h5st);assert(!JSON.stringify(p).includes('FAKE_ASSIGN'));assert.equal(p.common.scene,'jinquan');assert.equal(h.calls.length,0);
});
test('coupon run confirms browse and actual bean quantity',async()=>{const h=setup();serve(h);const r=await coupon.createCouponActivity(h,fakeCrypto).run();assert(!r.stopped);assert.equal(r.beanQuantity,1);assert(r.results[0].confirmed);assert.deepEqual(h.waits,[6000]);assert.equal(h.calls.length,4);});
test('coupon completed tasks do not submit again',async()=>{const h=setup();serve(h,{tasks:[task({completionFlag:true,completionCnt:1})]});await coupon.createCouponActivity(h,fakeCrypto).run();assert.equal(h.calls.length,2);assert(h.calls.every(x=>api.jsParams(x).functionId==='sh_c_query_task_list'));});
test('mutation failure is never automatically repeated',async()=>{const h=setup();serve(h,{failStart:true});const r=await coupon.createCouponActivity(h,fakeCrypto).run();assert(r.stopped);serve(h);await coupon.createCouponActivity(h,fakeCrypto).run();assert.equal(h.calls.filter(x=>api.jsParams(x).functionId==='sh_c_do_task').length,1);});
test('failed finish preserves pending action and cannot claim reward',async()=>{const h=setup();serve(h,{failFinish:true});const r=await coupon.createCouponActivity(h,fakeCrypto).run();assert(r.stopped);assert.equal(r.beanQuantity,0);serve(h);await coupon.createCouponActivity(h,fakeCrypto).run();assert.equal(h.calls.filter(x=>api.jsParams(x).functionId==='sh_c_do_task').length,2);});
test('unknown reward is not invented as zero earned',async()=>{const h=setup();serve(h,{beans:false});const r=await coupon.createCouponActivity(h,fakeCrypto).run();assert.equal(r.unknownRewards,1);assert(r.results[0].detail.includes('数量待确认'));});
test('HTTP success alone cannot confirm task state',async()=>{const h=setup();serve(h,{unconfirmed:true});const r=await coupon.createCouponActivity(h,fakeCrypto).run();assert.equal(r.results[0].confirmed,false);assert(r.results[0].detail.includes('状态待确认'));});
test('slider-required countdown never submits completion',async()=>{const h=setup();serve(h,{needSlide:1});const r=await coupon.createCouponActivity(h,fakeCrypto).run();assert(r.stopped);assert.equal(h.waits.length,0);assert.equal(h.calls.filter(x=>api.jsParams(x).functionId==='sh_c_do_task').length,1);});
for(const name of ['进群天天领4元叠加券','浏览并关注频道','邀请好友领豆','订阅提醒','下单得京豆'])test('skip '+name,()=>assert(coupon.jcPlan(task({assignmentName:name})).skip));
test('skip egg lottery and chance-only browse tasks',()=>{assert(coupon.jcPlan(task({assignmentType:30})).skip);assert(coupon.jcPlan(task({assignmentDesc:'完成任务，可获得砸金蛋机会'})).skip);});
test('business rejection despite HTTP 200 is reported without action',async()=>{const h=setup();h.reply=()=>reply({success:false,code:405});const r=await coupon.createCouponActivity(h,fakeCrypto).run();assert(r.stopped);assert(r.error.includes('code=405'));assert.equal(h.calls.length,1);});
test('finish business rejection cannot add reported beans',async()=>{const h=setup();serve(h);const old=h.reply;h.reply=o=>{const p=api.jsParams(o),b=JSON.parse(p.body);return p.functionId==='sh_c_do_task'&&b.actionType===0?reply({success:true,code:0,data:{subCode:'8',successRewards:{'3':[{rewardType:3,rewardName:'京豆',quantity:99}]}}}):old(o);};const r=await coupon.createCouponActivity(h,fakeCrypto).run();assert(r.stopped);assert(r.error.includes('subCode=8'));assert.equal(r.beanQuantity,0);});
test('wrong account cannot execute any request',async()=>{const h=setup();h.write('JD_SIGNIN_ACCOUNT_V1',{pin:'other'});serve(h);await assert.rejects(()=>coupon.createCouponActivity(h,fakeCrypto).run(),/账号/);assert.equal(h.calls.length,0);});
test('signature field-set mismatch stops before action HTTP',async()=>{const h=setup();serve(h);const r=await coupon.createCouponActivity(h,{...fakeCrypto,signOnline:async()=>sig('35fa0','WRONG')}).run();assert(r.stopped);assert.equal(h.calls.length,0);});
test('three activity menu entries and no automatic activity',()=>{const p=fs.readFileSync(path.join(root,'Plugins/jd-activities.plugin'),'utf8');assert.equal((p.match(/^generic /gm)||[]).length,3);assert(p.includes('tag="领券中心赚京豆"'));assert(!/^cron /m.test(p));});
(async()=>{for(const [n,f]of tests){await f();console.log('PASS '+n);}console.log(tests.length+' new page checks passed; no live account requests.');})().catch(e=>{console.error(e);process.exitCode=1;});
