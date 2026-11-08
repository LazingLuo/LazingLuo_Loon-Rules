const assert=require('node:assert/strict');
const test=require('node:test');
const crypto=require('node:crypto');
const fs=require('node:fs');
const P=require('../Scripts/jd-plant-activity.js');
const A=require('../Scripts/jd-activity-capture.js');
const S=require('../Scripts/jd-signin-capture.js');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const clone=v=>JSON.parse(JSON.stringify(v));
const env={v:'h5_file_v5.3.6',fp:'offline',pp:{p1:'offline'}};
const sig=(app,kind)=>['1',env.fp,app,'fake','fake','5.3','1','test-env','fake',P.PL_ENCODING[kind]].join(';');
const cookie='pt_pin=offline; pt_key=OFFLINE;';
const page='https://pro.m.jd.com/mall/active/ABC123456789012345678901/index.html?babelChannel=sample';
const jr='https://u.jr.jd.com/uc-fe-wxgrowing/jd-undertake?hkid=100&channelLv=sample';
const root='https://api.m.jd.com/';
const base={monitor_source:'plant_m_plant_index',appType:1,version:'9.2.4.6',busiVersion:'2'};
const bubble={nutrientsType:'sample-1',nutrNum:10,name:'测试奖励'};
const round=(growth=1688,bubbles=[])=>({roundList:[{roundId:'test-round',roundState:'2',growth:String(growth),bubbleInfos:bubbles}]});
const task=(title='逛新上的频道',url=page)=>({id:-9999,taskType:'BROWSE_CHANNEL',pipeExt:{taskType:'BROWSE_CHANNEL',assignmentId:title},taskShowTitle:title,taskLimitTimes:1,taskDoTimes:0,timeLimitSwitch:2,timeLimitPeriod:5,taskItemList:[{itemId:url,itemType:'1',pipeExt:{itemId:'offline-item'}}]});
const jump=(url=page,extra={})=>({jumpUrl:'openapp.jdmobile://virtual?params='+encodeURIComponent(JSON.stringify({category:'jump',des:'countdown',needSlide:0,second:5,taskUrl:url,...extra}))});
const response=(data,code=0,status=200)=>({status,headers:{},body:JSON.stringify({code,data})});
function memory(){
 const map=new Map([['JD_SIGNIN_LOGIN_V1',{pin:'offline',cookie}]]);
 return {map,observedAt:100,read:(k,f)=>map.has(k)?clone(map.get(k)):f,write:(k,v)=>map.set(k,clone(v))};
}
function req(f,b,headers={}){
 const platform=f.startsWith('ap'),app=P.PL_APPS[f],params={functionId:f,appid:platform?(f==='apStartTaskTime'?'activity_platform_se':'activities_platform'):'signed_wh5',body:JSON.stringify(b),client:'ios',clientVersion:'16.1.81'};
 if(app)Object.assign(params,{'x-api-eid-token':'offline-eid',h5st:sig(app,platform?'platform':'root')});
 if(f==='apTaskList')Object.assign(params,{'x-api-eid-token':'list-eid',h5st:''});
 return {method:'POST',url:root+(platform?'api?functionId='+f:''),headers:{Referer:P.PL_PAGE,'User-Agent':'iPhone',Cookie:'shshshfpx=offline;',...headers},body:new URLSearchParams(params).toString()};
}
const fixtures=[
 ['plantBeanIndex',{...base,channel:'baibaoxiang'},response(round())],
 ['plantBeanBubbleInfo',{...base,roundId:'old-round'},response({bubbleSwitch:true,bubbleInfos:[]})],
 ['apTaskList',{linkId:P.PL_LINK,queryType:0,channel:4},response([task()])],
 ['apStartTaskTime',{linkId:P.PL_LINK},response(jump())],
 ['apDoLimitTimeTask',{linkId:P.PL_LINK},response(null,2031)]
];
function profile(){const m=memory();for(const [f,b,r] of fixtures)P.plCapture(m,req(f,b),r,()=>env);return m.read(P.PL_KEY,null);}
test('both capture routes store the complete list, bubble list and distinct signer profiles',async()=>{
 for(const capture of [A,S]){
  const m=memory();for(const [f,b,r] of fixtures)assert((await capture.jsCapture(m,req(f,b),r,{},()=>env)).updated.includes(P.PL_KEY));
  const p=m.read(P.PL_KEY,null);assert(P.plCredentialStatus(p).ready);
  assert.deepEqual(Object.keys(p.signing).sort(),['apDoLimitTimeTask','apStartTaskTime','plantBeanIndex']);
  assert.equal(p.templates['apTaskList:0'].params['x-api-eid-token'],'list-eid');
  assert(!JSON.stringify(p).includes('old-round'));
 }
});
test('capture ignores own execution, other activities, and recommendation-only lists',async()=>{
 const m=memory();
 assert.equal(await A.jsCapture(m,req('plantBeanIndex',base,{'X-Lazing-Plant-Run':'1'}),response(round()),{},()=>env),null);
 assert.equal(P.plCapture(m,req('apStartTaskTime',{linkId:'other'}),response(jump()),()=>env),null);
 assert.equal(await A.jsCapture(m,req('apTaskList',{linkId:P.PL_LINK,queryType:6}),response([task()]),{},()=>env),null);
 assert(!m.read(P.PL_KEY,null));
});
test('new campaign pages are eligible by type and endpoint; lookalike games, purchase and item tracking stay manual',()=>{
 assert(P.plItem(task()));assert(P.plItem(task('每日领钱',jr)));
 for(const t of [task('浏览5秒','https://miniapp-fe.jd.com/myshare?appId=x'),task('浏览5秒',page+'&jwebprog=1'),task('玩一玩得奖励'),{...task(),taskType:'BROWSE_RTB'},{...task(),timeLimitPeriod:16},{...task(),taskShowTitle:'下单领奖励'}])assert.equal(P.plItem(t),null);
});
test('countdown accepts the two observed URL shapes and rejects a changed destination or slide requirement',()=>{
 const item=P.plItem(task());
 assert.equal(P.plTimer({data:jump(page+'&hdTimerId=sample%3Btoken')},item),5);
 assert.equal(P.plTimer({data:jump(jr)},P.plItem(task('每日领钱',jr))),5);
 for(const j of [jump(page+'&target=other'),jump(page.replace('sample','other')),jump(page,{needSlide:1}),jump(page,{second:16})])assert.equal(P.plTimer({data:j},item),null);
});
async function simulate(o={}){
 const m=o.memory||memory(),calls=[],waits=[],t=task(),account=o.profile||profile();
 let finished=0;
 const host={...m,now:()=>1000,day:()=>o.day?.(waits)||'2026-11-08',guard:()=>{},progress:()=>{},sleep:async ms=>waits.push(ms),
 request:async r=>{
  const p=P.plForm(r.body),f=p.functionId,b=JSON.parse(p.body);calls.push(f);assert.equal(r.headers['X-Lazing-Plant-Run'],'1');
  if(o.reply?.[f])return o.reply[f];
  if(f==='plantBeanIndex')return response(round());
  if(f==='apTaskList'){assert.equal(b.queryType,0);assert.equal(p['x-api-eid-token'],'list-eid');return response(o.list||[t,task('玩一玩')]);}
  if(f==='apStartTaskTime'){assert.equal(b.pipeExt.assignmentId,t.pipeExt.assignmentId);return response(jump(b.itemId));}
  if(f==='apDoLimitTimeTask')return response({finished:true,userFinishedTimes:++finished,encryptAssignmentId:t.pipeExt.assignmentId});
  if(f==='plantBeanBubbleInfo'){assert.equal(b.roundId,'test-round');assert(!('h5st' in p));return response({bubbleSwitch:true,bubbleInfos:[bubble]});}
  if(f==='cultureBean'){assert.equal(b.nutrientsType,bubble.nutrientsType);assert.equal(p.functionId,'cultureBean');return response({growth:'1698'});}
  throw Error(f);
 }};
 const c={hash,decodeEnvironment:()=>env,signOnline:async(app,_pr,_env,input)=>sig(app,input.t?'platform':'root')};
 return {result:await P.createPlantActivity(host,c,account,{pin:'offline',cookie}).run(),calls,waits};
}
test('full list is read once; one timed browse and one bubble claim are counted separately',async()=>{
 const {result:r,calls,waits}=await simulate();
 assert.equal(r.error,undefined);
 assert.deepEqual(calls,['plantBeanIndex','apTaskList','apStartTaskTime','apDoLimitTimeTask','plantBeanBubbleInfo','cultureBean']);
 assert.deepEqual(waits,[6000]);assert.equal(r.completed,1);assert.equal(r.bubbles,1);assert.equal(r.collected,10);
 assert.equal(r.rows[1].result,'需 App 操作');assert.match(P.plReport(r),/1688 → 1698/);
});
test('multi-visit tasks use distinct eligible targets and stop at the server limit',async()=>{
 const t=task();
 t.taskLimitTimes=3;
 t.taskItemList.push(t.taskItemList[0],{...t.taskItemList[0],itemId:page.replace('sample','new'),pipeExt:{itemId:'second'}});
 const {result:r,calls}=await simulate({list:[t]});
 assert(!r.stopped,r.error);assert.equal(r.completed,2);assert.equal(r.rows[0].result,'已完成 2/3');
 assert.equal(calls.filter(f=>f==='apStartTaskTime').length,2);
});
test('can collect an existing bubble when there are no eligible tasks',async()=>{
 const {result:r,calls}=await simulate({list:[task('玩一玩')]});assert.equal(r.completed,0);assert.equal(r.bubbles,1);assert(!calls.includes('apStartTaskTime'));
});
test('a growth increase above the bubble face value keeps both values distinct',async()=>{
 const {result:r}=await simulate({reply:{cultureBean:response({growth:'1701'})}});
 assert(!r.stopped,r.error);assert.equal(r.collected,10);assert.equal(r.growthAfter-r.growthBefore,13);
});
test('a 413 or an HTTP refusal stops immediately and does not retry',async()=>{
 for(const refusal of [response(null,413),response(null,0,403)]){
  const {result:r,calls}=await simulate({reply:{apDoLimitTimeTask:refusal}});
  assert(r.stopped);assert.match(r.error,/413|403/);assert.equal(r.collected,0);assert.equal(calls.at(-1),'apDoLimitTimeTask');
 }
});
test('ambiguous completion and mismatched growth cannot be counted',async()=>{
 const a=await simulate({reply:{apDoLimitTimeTask:response({finished:true,userFinishedTimes:1,encryptAssignmentId:'other'})}});
 assert.equal(a.result.completed,0);assert.equal(a.calls.at(-1),'apDoLimitTimeTask');
 const b=await simulate({reply:{cultureBean:response({growth:'1688'})}});assert(b.result.stopped);assert.equal(b.result.collected,0);
});
test('duplicate start is blocked after restart and an incomplete profile sends no traffic',async()=>{
 const m=memory(),a=await simulate({memory:m,reply:{apStartTaskTime:response(null,413)}});
 assert(a.result.stopped);
 const b=await simulate({memory:m});assert(!b.calls.includes('apStartTaskTime'));
 const p=profile();delete p.templates['apTaskList:0'];const c=await simulate({profile:p});assert.deepEqual(c.calls,[]);
});
test('manual entry is confined to activities and both plugins share the same capture source',()=>{
 const files=n=>fs.readFileSync(new URL('../Plugins/'+n,'file://'+__filename),'utf8');
 assert.match(files('jd-activities.plugin'),/generic then .*jd-plant-activity\.js.*tag="种豆得豆"/);
 for(const n of ['jd-activities.plugin','jd-signin.plugin','jd-checkin-test.plugin']){
  const text=files(n);
  assert.match(text,/request\.header\['Referer'\].*种豆页面凭据获取/);
  assert(!/cron .*jd-plant-activity/.test(text));
 }
 assert.deepEqual(fs.readFileSync(require.resolve('../Scripts/jd-activity-capture.js')),fs.readFileSync(require.resolve('../Scripts/jd-signin-capture.js')));
});
