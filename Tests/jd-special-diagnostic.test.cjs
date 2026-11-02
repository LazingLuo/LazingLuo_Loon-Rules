const assert=require('assert/strict'),path=require('path'),fs=require('fs');
const api=require(path.join(__dirname,'../Scripts/jd-special-activity.js'));
const request=(f,b={})=>({url:'https://api.m.jd.com/',body:'functionId='+f+'&body='+encodeURIComponent(JSON.stringify(b))});
const finish=request(api.TJ_DO,{actionType:0,ext:{doReceiveRewards:null}}),start=request(api.TJ_DO,{actionType:1}),claim=request(api.TJ_DO,{actionType:0,ext:{doReceiveRewards:1}}),query=request(api.TJ_QUERY);
const explain=(o,j,status=200)=>api.tjResponseDiagnostic(o,{status},typeof j==='string'?j:JSON.stringify(j));
const success=sub=>({code:0,data:{bizCode:0,result:{assignmentResult:{subCode:sub}}}});
let n=0;function test(name,f){f();n++;console.log('OK '+name);}
test('browser time rejection identifies the failing step and actual business code',()=>{assert.equal(explain(finish,{code:0,data:{bizCode:110,bizMsg:'浏览时间不足',result:{}}}),'特价频道提交完成未通过（接口码 0，业务码 110）：浏览时间不足');});
test('task receipt and reward claim are separate diagnostic stages',()=>{for(const [o,label] of [[start,'接取任务'],[claim,'领取奖励'],[query,'读取列表']])assert(explain(o,{code:0,data:{bizCode:403,result:{}}}).includes(label));});
test('transport failure identifies HTTP status without touching response text',()=>{const s=explain(finish,'pt_key=PRIVATE_SECRET',403);assert(s.includes('HTTP 403'));assert(!s.includes('PRIVATE_SECRET'));});
test('malformed JSON is distinguished from business rejection',()=>{assert.equal(explain(finish,'<html>private</html>'),'特价频道提交完成失败：响应无法读取');});
test('unexpected subcode is preserved and not treated as complete',()=>{assert(explain(finish,success('2')).includes('步骤码 2'));assert(explain(finish,success('2')).includes('返回步骤或结构与预期不同'));});
test('arbitrary server messages are never echoed',()=>{const s=explain(finish,{code:'DENIED',data:{bizCode:999,bizMsg:'pt_key=PRIVATE_SECRET https://example.com/user?token=PRIVATE',result:{}}});assert(s.includes('业务码 999'));assert(!/PRIVATE|example/.test(s));});
test('malicious code values are never echoed',()=>{const s=explain(finish,{code:'pt_key=PRIVATE_SECRET',data:{bizCode:{token:'PRIVATE'},result:{}}});assert(!s.includes('PRIVATE'));});
test('ordinary successful steps produce no failure line',()=>{assert.equal(explain(start,success('1')),'');assert.equal(explain(finish,success('0')),'');assert.equal(explain(claim,success('0')),'');assert.equal(explain(query,{code:0,data:{bizCode:0,result:{taskInfo:{taskList:[]}}}}),'');});
test('known login error uses fixed readable wording',()=>{assert(explain(query,{code:0,data:{bizCode:10,bizMsg:'请先登录',result:{}}}).endsWith('登录状态失效'));});
// Execute the actual Loon entry: task receipt succeeds, completion returns 110.
(async()=>{
 const vm=require('vm'),map=new Map(),logs=[],notes=[],calls=[];
 const environment={v:'h5_file_v5.3.6',fp:'offline-fixture',pp:{p1:'offline'},extend:{bu6:33,bu13:'F3'},canvas:'a'.repeat(32),webglFp:'b'.repeat(32)};
 const a='rqponmlkjihgfedcbaZYXWVUTSRQPONMLKJIHGFEDCBA-_9876543210zyxwvuts',z='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
 const encoded=[...Buffer.from(JSON.stringify(environment)+'x').toString('base64').replace(/=+$/,'')].map(c=>a[z.indexOf(c)]).reverse().join('');
 const headers={Cookie:'pt_pin=offline;pt_key=FAKE_SECRET;','User-Agent':'offline-ios',Referer:api.TJ_PAGE};
 map.set('JD_SIGNIN_ACCOUNT_V1',{pin:'offline'});map.set('JD_SIGNIN_LOGIN_V1',{pin:'offline',cookie:headers.Cookie,headers,capturedAt:Date.now()});
 map.set(api.TJ_KEY,{pin:'offline',headers,environment:encoded,params:{appid:'newtry',client:'apple',clientVersion:'16.1.81','x-api-eid-token':'FAKE_DEVICE'},query:{channelId:'16',ext:{queryReceiveTimes:1},extMap:{sceneType:2}},capturedAt:Date.now()});
 const task={encryptAssignmentId:'offline_visit',assignmentName:'逛活动页面领5京豆',assignmentDesc:'浏览10秒',assignmentType:1,assignmentTimesLimit:1,completionCnt:0,completionFlag:false,canReceiveTimes:0,canParticipation:true,timeStatus:1,rewards:[{rewardType:3}],ext:{outerTaskType:9,extraType:'shoppingActivity',waitDuration:10,shoppingActivity:[{itemId:'offline_item',status:1,url:'https://pro.m.jd.com/mall/active/offline/index.html'}]}};
 await new Promise((resolve,reject)=>{const watchdog=setTimeout(()=>reject(Error('runtime stalled')),2000);const context={$persistentStore:{read:k=>map.has(k)?JSON.stringify(map.get(k)):'',write:(v,k)=>{if(v)map.set(k,JSON.parse(v));else map.delete(k);return true;}},$httpClient:{post:(o,cb)=>{
  calls.push(o);let j;if(o.url==='https://cactus.jd.com/request_algo'){const b=JSON.parse(o.body);j={status:200,data:{ts:Date.now(),result:{fp:b.fp,tk:'tk03'+'a'.repeat(88),algo:'function test(tk,fp,ts,ai,algo){return algo.HmacSHA256(tk+fp+ts+ai,"offline");}'}}};}
  else{const p=Object.fromEntries(new URLSearchParams(o.body)),b=JSON.parse(p.body);j=p.functionId===api.TJ_QUERY?{code:0,data:{bizCode:0,result:{taskInfo:{taskList:[task]}}}}:b.actionType===1?success('1'):{code:0,data:{bizCode:110,bizMsg:'浏览时间不足',result:{}}};}
  cb(null,{status:200},JSON.stringify(j));}},$notification:{post:(...x)=>notes.push(x)},$done:()=>{clearTimeout(watchdog);resolve();},console:{log:s=>logs.push(s)},setTimeout:(fn,ms)=>setTimeout(fn,ms===11000?0:ms),clearTimeout};
  try{vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../Scripts/jd-special-activity.js'),'utf8'),context,{timeout:5000});}catch(e){clearTimeout(watchdog);reject(e);}
 });
 assert(logs.some(s=>s.includes('已暂停')));assert(notes.flat().some(s=>s.includes('已暂停')));assert(!map.has('JD_ACTIVITY_MANUAL_V1.lock'));assert(!map.has('JD_SPECIAL_CHANNEL_LAST_V1'));assert.equal(calls.length,0);assert(!logs.join('').includes('FAKE_SECRET'));n++;
 console.log('OK paused Loon entry makes zero requests and changes no task records');
 console.log(n+' diagnostic checks passed; synthetic data, no account requests.');
})().catch(e=>{console.error(e);process.exitCode=1;});
