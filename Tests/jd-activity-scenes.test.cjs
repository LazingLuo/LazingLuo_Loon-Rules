// Scene binding and home-channel regressions. All requests are mocked.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),C=require('node:crypto');
const local=fs.existsSync(path.join(__dirname,'发布包')),root=local?path.join(__dirname,'发布包'):path.join(__dirname,'..');
const cap=require(path.join(root,'Scripts/jd-activity-capture.js')),coupon=require(path.join(root,'Scripts/jd-coupon-activity.js'));
const home={};const homeSource=fs.readFileSync(path.join(root,'Scripts/jd-home-activity.js'),'utf8');
vm.runInNewContext(homeSource.split('(async function jxLoonTaskMain(){')[0]+'\nObject.assign(EXPOSE,{createJxTaskClient,createJxTaskCrypto,actJxProfile,jxTaskSharedProfile});',{EXPOSE:home},{timeout:3000});
const hash=s=>C.createHash('sha256').update(s).digest('hex'),clone=x=>JSON.parse(JSON.stringify(x));
const env={v:'h5_file_v5.3.6',fp:'1234567890123456',pp:{p1:'offline'},extend:{bu6:33,bu13:'F3'},canvas:'a'.repeat(32),webglFp:'b'.repeat(32)};
const normal='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',chars='rqponmlkjihgfedcbaZYXWVUTSRQPONMLKJIHGFEDCBA-_9876543210zyxwvuts';
const encoded=[...Buffer.from(JSON.stringify(env)+'x').toString('base64').replace(/=+$/,'')].map(c=>chars[normal.indexOf(c)]).reverse().join('');
const signature=(app,encoding)=>['date',env.fp,app,'tk03_fake','hash','5.3','time',encoded,'hash',encoding].join(';');
const headers={Cookie:'pt_pin=offline;pt_key=OFFLINE;','User-Agent':'Offline'};
const pages={jinquan:'2BGmkjr2mbi81R4ozsAR1ragZcyh',jinquan3:'2BuMtujoMx1EPnFvUrUpsrYucqUK'};
const housePage='2H8G6a7JecjqHH3t1ZWSoJjPtziP',craft='69ae8eb86a31c802e19f9f8f';
const params=o=>new URLSearchParams(o).toString(),postReply=j=>({status:200,body:JSON.stringify(j)});
function host(){const map={},calls=[],waits=[],logs=[];let time=1793232000000;
 const h={map,calls,waits,logs,read:(k,f)=>map[k]?JSON.parse(map[k]):f,write:(k,v)=>map[k]=JSON.stringify(v),rawRead:k=>map[k]||null,rawWrite:(v,k)=>{map[k]=v;return true;},now:()=>time,day:()=> '2026-10-29',random:()=>0.5,setTimeout:()=>1,clearTimeout:()=>{},log:x=>logs.push(x),progress:()=>{},sleep:async ms=>{waits.push(ms);time+=ms;},request:async(...a)=>{calls.push(a);return h.reply(...a);}};
 h.write('JD_SIGNIN_ACCOUNT_V1',{pin:'offline'});h.write('JD_SIGNIN_LOGIN_V1',{pin:'offline',cookie:headers.Cookie,headers,capturedAt:1});return h;
}
const parsers={retail:cap.runRetailCapture,jxzy:cap.runJxCapture,home:cap.runHomeCapture,finance:cap.runFinanceCapture,plant:cap.runPlantCapture,farm:cap.farmCapture};
const seed={assignmentName:'浏览页面得奖励',assignmentType:1,assignmentTimesLimit:1,completionCnt:0,completionFlag:false,encryptAssignmentId:'FAKE_ASSIGN',ext:{extraType:'shoppingActivity',waitDuration:5,shoppingActivity:[{status:1,itemId:'FAKE_ITEM',url:'https://pro.m.jd.com/mall/active/offline/index.html'}]}};
function queryRequest(scene,refScene=scene){return {method:'POST',url:'https://api.m.jd.com/client.action',headers:{...headers,Cookie:'page=only;',Referer:'https://pro.m.jd.com/mall/active/'+pages[refScene]+'/index.html'},body:params({functionId:'sh_c_query_task_list',appid:'hourly-m',client:'apple',clientVersion:'16.1.50','x-api-eid-token':'OFFLINE_EID',h5st:signature('35fa0',coupon.JC_ENCODING),body:JSON.stringify({scene,viewStage:'taskList'})})};}
const taskReply=(t=seed,n=0)=>({code:0,success:true,data:{subCode:'0',taskList:[t],smashRemainCnt:n}});
const crypto={hash,decodeEnvironment:cap.farmDecodeEnvironment,signOnline:async(app,p,e,input)=>{assert.deepEqual(Object.keys(input),['appid','body','client','clientVersion','functionId']);return signature(app,coupon.JC_ENCODING);}};
const tests=[],test=(n,f)=>tests.push([n,f]);
for(const scene of Object.keys(pages))test('capture native scene '+scene,async()=>{const h=host();await cap.jsCapture(h,queryRequest(scene),postReply(taskReply()),parsers,cap.farmDecodeEnvironment);assert.equal(h.read(coupon.JC_KEY).common.scene,scene);assert.equal(h.calls.length,0);});
test('scene and page mismatch cannot overwrite profile',async()=>{const h=host();await cap.jsCapture(h,queryRequest('jinquan3','jinquan'),postReply(taskReply()),parsers,cap.farmDecodeEnvironment);assert(!h.read(coupon.JC_KEY,null));});
test('latest visited scene wins, delayed response cannot roll it back',async()=>{const h=host();h.observedAt=20;await cap.jsCapture(h,queryRequest('jinquan3'),postReply(taskReply()),parsers,cap.farmDecodeEnvironment);h.observedAt=10;await cap.jsCapture(h,queryRequest('jinquan'),postReply(taskReply()),parsers,cap.farmDecodeEnvironment);assert.equal(h.read(coupon.JC_KEY).common.scene,'jinquan3');});
test('new scene executes separately and reports egg balance without drawing',async()=>{const h=host();await cap.jsCapture(h,queryRequest('jinquan3'),postReply(taskReply()),parsers,cap.farmDecodeEnvironment);
 h.write(coupon.JC_JOURNAL,{[h.day()+':'+hash('offline').slice(0,24)+':'+hash(seed.encryptAssignmentId).slice(0,24)]:{phase:'starting'}});
 let done=false;h.reply=async(t,o)=>{const p=Object.fromEntries(new URLSearchParams(o.body)),b=JSON.parse(p.body);assert.equal(b.scene,'jinquan3');assert(!('exchangeNum'in b));assert(!('singleCustomCostAmount'in b));
 if(p.functionId==='sh_c_query_task_list')return postReply(taskReply(done?{...seed,completionCnt:1,completionFlag:true}:seed,done?1:0));
 if(b.actionType===1)return postReply({code:0,success:true,data:{subCode:'1',toUrl:'openapp.jdmobile://virtual?params='+JSON.stringify({des:'countdown',second:5,needSlide:0})}});
 done=true;return postReply({code:0,success:true,data:{subCode:'0',successRewards:{'1':{quantity:1,quantityDetails:[{rewardName:'砸金蛋机会',quantity:1}]}},failRewards:[]}});
 };
 const r=await coupon.createCouponActivity(h,crypto).run();assert(!r.stopped,r.error);assert.equal(r.scene,'jinquan3');assert.equal(r.eggBefore,0);assert.equal(r.eggAfter,1);assert.equal(r.eggsSmashed,0);assert.equal(r.eggChances,1);assert(r.message.includes('0 → 1'));assert(r.results[0].confirmed);
});
test('unsupported scene is rejected before network',async()=>{const h=host();h.write(coupon.JC_KEY,{pin:'offline',params:{appid:'hourly-m'},common:{scene:'other'},signing:{encoding:coupon.JC_ENCODING}});await assert.rejects(()=>coupon.createCouponActivity(h,crypto).run(),/凭据不完整/);assert.equal(h.calls.length,0);});
const houseBase={source:'jxzy',craftId:craft,sceneval:2,buid:325,appCode:'ms1888ebbf'};
const houseHeaders={...headers,Referer:'https://pro.m.jd.com/mall/active/'+housePage+'/index.html'};
const houseTask=(status=1)=>({showTask:1,taskName:'跟着指数买好价',taskId:'FAKE_TASK',taskType:3,taskStatus:status,taskProgress:{total:1,current:status===1?0:1,itemId:'FAKE_ITEM'},taskAmount:1,extInfo:{browseTask:{browseTime:10,completionFlag:status!==1,shoppingActivityList:[{itemId:'FAKE_ITEM',status:status===1?1:2,url:'https://pro.m.jd.com/mall/active/offline/index.html'}]}}});
function houseProfile(){return {pin:'offline',headers:houseHeaders,query:{appid:'jx_h5_babel',channel:'jxh5',client:'jxh5',clientVersion:'1.2.5',functionId:'jxzy_active_task_queryTaskList',body:JSON.stringify(houseBase)},environment:encoded,encoding:'qbkgHGHQ8GlOIyVOF6JQ8G1P5WFW3yVSC61T-bEQGGlQI6ZNHuFT-bVR7qUT',eidToken:'OFFLINE_EID'};}
const homeCrypto={hash,bodySign:b=>C.createHmac('md5','xtl_sqg_mall-^&*-damai_(789)_@#$').update(Object.keys(b).filter(k=>k!=='signStr').sort().map(k=>typeof b[k]==='object'?JSON.stringify(b[k]):b[k]).join('&')).digest('hex'),decodeEnvironment:cap.farmDecodeEnvironment,sign:(app,p)=>signature(app,p.encoding)};
test('home task capture uses shared login and preserves sign-in signing data',async()=>{const h=host();h.write('JD_HOME_CHECKIN_ACCOUNT_V1',{pin:'offline',headers:houseHeaders,signing:{environment:encoded,eidToken:'OFFLINE',source:'jxzy_active_queryActive'}});h.write('JXZY_CHECKIN_ACCOUNT_V1',{pin:'offline',keep:true});
 await cap.jsCapture(h,{method:'POST',url:'https://api.m.jd.com/api',headers:{...houseHeaders,Cookie:'page=only;'},body:params({appid:'jx_h5_babel',client:'jxh5',channel:'jxh5',functionId:'jxzy_active_task_queryTaskList',body:JSON.stringify({...houseBase,time:123,signStr:'OLD'})})},postReply({code:0,data:{taskInfoList:[houseTask()]}}),parsers,cap.farmDecodeEnvironment);
 const p=h.read('JD_HOME_CHECKIN_ACCOUNT_V1');assert(p.query);assert(p.signing);assert(p.headers.Cookie.includes('pt_key=OFFLINE'));assert(!p.query.params.body.includes('OLD'));assert.equal(p.query.params.functionId,'jxzy_active_querySign');assert(h.read('JXZY_CHECKIN_ACCOUNT_V1').keep);
});
test('home client completes, claims, verifies and does not call sign-in',async()=>{const h=host();let status=1;h.reply=async o=>{const p=Object.fromEntries(new URLSearchParams(o.body)),b=JSON.parse(p.body);assert.equal(b.craftId,craft);assert(!p.functionId.includes('drawSign'));
 if(p.functionId==='jxzy_active_task_completeTask'){assert.equal(p.h5st.split(';')[2],'cec1e');status=10;return postReply({code:0,data:{}});}
 if(p.functionId==='jxzy_active_task_rewardTask'){assert.equal(p.h5st.split(';')[2],'573fe');status=20;return postReply({code:0,data:{prizeInfos:[{prizeType:2,discount:1}]}});}
 return postReply({code:0,data:{taskInfoList:[houseTask(status)]}});
 };
 const r=await home.createJxTaskClient(h,homeCrypto).makeRunner(houseProfile()).run('all');assert(!r.stopped,r.message);assert.equal(r.confirmedBeans,1);assert.equal(r.claimedBeans,1);assert.deepEqual(h.waits,[11000]);
});
test('home and Jingxi profiles stay separate',()=>{const p=houseProfile();p.query.body=JSON.stringify({...houseBase,craftId:'6824629a7c46584759d39b78'});assert.throws(()=>home.createJxTaskClient(host(),homeCrypto).makeRunner(p),/活动不符/);assert(!homeSource.includes('JXZY_TASKS_V1.'));assert(homeSource.includes('JD_HOME_TASKS_V1.'));});
test('home skips invitations and already claimed tasks',async()=>{const h=host();h.reply=async()=>postReply({code:0,data:{taskInfoList:[houseTask(20),{showTask:1,taskType:1,taskName:'分享好友助力'}]}});const r=await home.createJxTaskClient(h,homeCrypto).makeRunner(houseProfile()).run('all');assert.equal(r.skipped,1);assert(h.calls.every(a=>Object.fromEntries(new URLSearchParams(a[0].body)).functionId==='jxzy_active_task_queryTaskList'));});
test('home failed claim is not retried on a second run',async()=>{const h=host();let claims=0;h.reply=async o=>{const p=Object.fromEntries(new URLSearchParams(o.body));if(p.functionId==='jxzy_active_task_rewardTask'){claims++;throw Error('offline network');}return postReply({code:0,data:{taskInfoList:[houseTask(10)]}});};
 for(let i=0;i<2;i++)assert((await home.createJxTaskClient(h,homeCrypto).makeRunner(houseProfile()).run('all')).stopped);assert.equal(claims,1);
});
function readHAR(file){return JSON.parse(fs.readFileSync(file,'utf8')).log.entries.map(e=>{const decode=p=>p?.encoding==='base64'?Buffer.from(p.text||'','base64').toString():p?.text||'';const q=Object.fromEntries(new URLSearchParams(e.request.url.split('?')[1]||'')),p={...q,...Object.fromEntries(new URLSearchParams(decode(e.request.postData)))};let b,j;try{b=JSON.parse(p.body||'{}');j=JSON.parse(decode(e.response.content));}catch(_){}return {f:p.functionId,b,j,p,at:Date.parse(e.startedDateTime)};}).sort((a,b)=>a.at-b.at);}
for(const file of process.argv.slice(2)){
 const es=readHAR(file);
 if(es.some(x=>x.f==='sh_c_do_task'&&x.b?.scene==='jinquan3'))test('HAR451 confirms separate scene rewards and manual egg consumption',()=>{
  const lists=es.filter(x=>x.f==='sh_c_query_task_list'&&x.b?.scene==='jinquan3');assert(lists.length>1);const first=lists[0].j.data,last=lists.at(-1).j.data;
  for(const name of ['读小说 最高赚20元','逛家电家居']){const t=first.taskList.find(x=>x.assignmentName===name),after=last.taskList.find(x=>x.encryptAssignmentId===t.encryptAssignmentId);assert(!t.completionFlag);assert(after.completionFlag);const done=es.find(x=>x.f==='sh_c_do_task'&&x.b?.actionType===0&&x.b?.encryptAssignmentId===t.encryptAssignmentId);assert.equal(coupon.jcBeans(done.j.data),1);}
  const chance=es.find(x=>x.f==='sh_c_do_task'&&coupon.jcEggChances(x.j?.data)===1),draw=es.find(x=>x.f==='sh_c_do_task'&&x.b?.exchangeNum===1);assert(chance);assert(draw);assert(draw.at>chance.at);assert.equal(first.smashUsedCnt,0);assert.equal(last.smashUsedCnt,1);assert.equal(last.smashRemainCnt,0);
 });
 if(es.some(x=>x.f==='jxzy_active_task_completeTask'&&x.b?.craftId===craft))test('HAR452 home reward and completion signatures match the reused client',()=>{
  const crypt=home.createJxTaskCrypto({read:(k,f)=>f,write:()=>{},setTimeout:()=>1,clearTimeout:()=>{}});let complete=0,reward=0;
  for(const x of es.filter(x=>x.b?.craftId===craft&&['jxzy_active_task_completeTask','jxzy_active_task_rewardTask'].includes(x.f))){assert.equal(crypt.bodySign(x.b),x.b.signStr);assert.equal(x.p.h5st.split(';')[2],x.f.endsWith('completeTask')?'cec1e':'573fe');assert.equal(x.p.h5st.split(';')[9],houseProfile().encoding);if(x.f.endsWith('completeTask'))complete++;else{assert.equal(x.j.data.prizeInfos[0].discount,1);reward++;}}
  assert.equal(complete,2);assert.equal(reward,2);
 });
}
(async()=>{for(const [n,f]of tests){await f();console.log('PASS '+n);}console.log(tests.length+' scene/home checks passed; no live requests.');})().catch(e=>{console.error(e);process.exitCode=1;});
