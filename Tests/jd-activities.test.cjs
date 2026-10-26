const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=fs.existsSync(path.join(__dirname,'发布包'))?path.join(__dirname,'发布包'):path.join(__dirname,'..');
const src=n=>fs.readFileSync(path.join(root,'Scripts',n),'utf8');
const api=require(path.join(root,'Scripts/jd-golden-egg.js'));
const plugin=fs.readFileSync(path.join(root,'Plugins/jd-activities.plugin'),'utf8');
let checks=0;const tests=[];function check(n,fn){tests.push([n,fn]);}
const ck='pt_key=PRIVATE_KEY;pt_pin=account1;';
const sign=(app,ver='5.3')=>['20261025000000000','1234567890123456',app,'ALGO_TOKEN','HASH',ver,'1234567890000','ENVIRONMENT_DATA','HASH','appid,body,client,clientVersion,functionId,t'].join(';');
const eggList=(done=false)=>({code:'0',data:{bizCode:0,result:{taskInfo:{taskList:[{encryptAssignmentId:'assignment1',assignmentName:'浏览精选商品',assignmentTimesLimit:1,completionCnt:done?1:0,completionFlag:done,ext:{extraType:'items',waitDuration:6,items:[{itemId:'item1',url:'https://pro.m.jd.com/test'}]}}]}}}});
const earnTask=(patch={})=>({missionId:'mission1',channelCode:'channel1',title:{text:'浏览赚京豆'},status:0,button:{jumpData:{jumpUrl:'https://u.jr.jd.com/test?missionId=mission1'}},...patch});
const earnList=tasks=>({success:true,resultCode:0,resultData:{resultList:[{templateData:{taskList:tasks}}]}});
function captureFixture(kind='egg',opts={}){
 const values={},writes=[];const app=kind==='egg'?'39e8e':'73fdb';
 const headers={Cookie:ck,'User-Agent':'jdapp;iPhone;16.1.50;','Referer':kind==='egg'?'https://pro.m.jd.com/mall/active/test/index.html':'https://member.jr.jd.com/member/coinQuest/coin/'};
 const params=kind==='egg'?{appid:'SecKill2020',client:'ios',clientVersion:'16.1.50',functionId:'interact_pre_executor',channelCode:'bargain',sceneCode:'task_list',h5st:sign(app),'x-api-eid-token':'PRIVATE_EID',body:JSON.stringify({encryptProjectId:api.EGG_PROJECT,ext:{queryReceiveTimes:1}})}:
 {reqData:JSON.stringify({clientVersion:'6.9.02',clientType:'apple',pageId:11189,pageType:11189,ctp:11189,pageNum:-1,extParams:{channelCode:'inside',sdkToken:'PRIVATE_SDK_TOKEN',signData:{sdkToken:'PRIVATE_SDK_TOKEN'},deviceInfos:'{}',nonce:'OLD_NONCE',signature:'OLD_SIGNATURE'}}),cco:JSON.stringify({h5st:sign(app),client:'apple',clientVersion:'6.0.9',_stk:'clientType,clientVersion,ctp,pageId,pageNum,pageType',_ste:1}),eid:'PRIVATE_EID'};
 const req={method:'POST',url:kind==='egg'?'https://api.m.jd.com/':api.EARN_QUERY+'?pageType=11189',headers,body:api.actEncode(params)};
 const res={status:200,body:JSON.stringify(kind==='egg'?eggList():earnList([earnTask()]))};
 const host={read:(k,f)=>k==='JD_SIGNIN_ACCOUNT_V1'?{pin:opts.boundPin||'account1'}:values[k]||f,write:(k,v)=>{values[k]=v;writes.push(k);},observedAt:1234567890000};
 const decode=()=>({pp:{p1:opts.signaturePin||'account1'},fp:'1234567890123456',extend:{},v:'h5_file_v5.3.6'});
 return {values,writes,req,res,host,decode,params,headers};
}
function fakeHost(handler,store={}){
 let now=1792886400000;const calls=[],sleeps=[],logs=[];
 const host={now:()=>now,day:()=> '2026-10-25',guard:()=>{},log:x=>logs.push(x),error:e=>String(e.message),
  read:(k,f)=>store[k]||f,write:(k,v)=>{store[k]=v;},sleep:async ms=>{sleeps.push(ms);now+=ms;},pause:async ms=>{now+=ms;},
  request:async o=>{calls.push(o);return {status:200,body:JSON.stringify(await handler(o,calls))};},
  json:r=>{if(r.status!==200)throw Error('HTTP '+r.status);return JSON.parse(r.body);},aar:async()=>({nonce:()=> '12345678901234567890',sign:()=> 'a'.repeat(66)})};
 const crypto={hash:x=>'HASH_BODY',decodeEnvironment:()=>({pp:{p1:'account1'},fp:'1234567890123456',extend:{},v:'h5_file_v5.3.6'}),signOnline:async(app,p,e,input)=>{calls.push({signature:app,input});return sign(app);}};
 return {host,crypto,calls,sleeps,logs,store};
}
check('exactly four manual entries and no cron or menu arguments',()=>{assert.equal((plugin.match(/^generic then/gm)||[]).length,4);assert(!/^cron\b|\[Argument\]/m.test(plugin));for(const t of ['京喜自营','东东农场','天天砸金蛋','天天赚京豆'])assert(plugin.includes('tag="'+t+'"'));});
check('bundled official SDK supports both activity signing shapes with simulated JD algorithm service',async()=>{
 const context={module:{exports:{}},setTimeout,clearTimeout};vm.createContext(context);vm.runInContext(src('jd-earn-beans.js'),context);const make=vm.runInContext('createFarmCrypto',context);let algos=0;
 const host={setTimeout,clearTimeout,read:(_k,f)=>f,write:()=>{},progress:()=>{},requestAlgo:async o=>{algos++;assert.equal(o.url,'https://cactus.jd.com/request_algo');assert(!Object.keys(o.headers).some(k=>k.toLowerCase()==='cookie'));assert(!JSON.stringify(o).includes('FAKE_PRIVATE_COOKIE'));const b=JSON.parse(o.body);return {status:200,body:JSON.stringify({status:200,data:{result:{fp:b.fp,tk:'tk03'+'a'.repeat(88),algo:'function test(tk,fp,ts,ai,algo){return algo.HmacSHA256(tk+fp+ts+ai,"offline");}'}}})};}};
 const env={v:'h5_file_v5.3.6',fp:'offline-reference',pp:{p1:'offline'},extend:{bu6:33,bu13:'F3'},canvas:'a'.repeat(32),webglFp:'b'.repeat(32),sua:'iPhone',pf:'iPhone',ccn:4},profile={pin:'offline',headers:{Cookie:'pt_pin=offline;pt_key=FAKE_PRIVATE_COOKIE;',Referer:'https://member.jr.jd.com/member/coinQuest/coin/','User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'}},crypto=make(host);
 for(const [app,input] of [['39e8e',{appid:'SecKill2020',body:'a'.repeat(64),client:'ios',clientVersion:'16.1.50',functionId:'task_list',t:Date.now()}],['73fdb',{clientType:'apple',clientVersion:'6.9.02',ctp:11189,pageId:11189,pageNum:-1,pageType:11189}]]){const sig=await crypto.signOnline(app,profile,env,input);assert.equal(sig.split(';').length,10);assert.equal(sig.split(';')[2],app);assert.equal(sig.split(';')[3],'tk03'+'a'.repeat(88));}assert.equal(algos,2);
 // Actual embedded SDK must also work when no page environment was ever captured.
 for(const [app,input] of [['39e8e',{appid:'SecKill2020',body:'a'.repeat(64),client:'ios',clientVersion:'16.1.50',functionId:'task_list',t:Date.now()}],['73fdb',{clientType:'apple',clientVersion:'6.9.0',ctp:11189,pageId:11189,pageNum:-1,pageType:11189}]]){const sig=await crypto.signOnline(app,profile,undefined,input);assert.equal(sig.split(';').length,10);assert.equal(sig.split(';')[2],app);assert.equal(sig.split(';')[3],'tk03'+'a'.repeat(88));}assert.equal(algos,4);
});
check('each manual entry has its own unique script',()=>{const paths=plugin.split('\n').filter(x=>x.startsWith('generic then')).map(x=>x.match(/Scripts\/([^?]+)\?/)[1]);assert.equal(new Set(paths).size,4);for(const p of paths)assert(fs.existsSync(path.join(root,'Scripts',p)));});
check('legacy workflow defaults are fixed, not caller-controlled',()=>{assert(src('jd-jxzy-activity.js').includes("const mode='all';"));assert(src('jd-farm-activity.js').includes("const mode='farm-all';"));assert(src('jd-golden-egg.js').includes('const ACTIVITY_KIND="egg"'));assert(src('jd-earn-beans.js').includes('const ACTIVITY_KIND="earn"'));});
check('farm preserves its no-watering task restriction',()=>{const m=require(path.join(root,'Scripts/jd-farm-activity.js'));assert.equal(m.farmTools().reason({taskType:'CUMULATIVE_TIMES'}),'手动浇水，保留水滴');assert(!m.farmTools().supported({taskType:'CUMULATIVE_TIMES'}));assert(![...m.farmTools().MUTATE].some(x=>/water|pay/i.test(x)));});
check('wheel activity entry and public script are removed',()=>{assert(!plugin.includes('幸运转盘'));assert(!plugin.includes('jd-wheel-activity.js'));assert(!fs.existsSync(path.join(root,'Scripts/jd-wheel-activity.js')));});
for(const kind of ['egg','earn'])check(kind+' capture stores only activity profile on success',()=>{const f=captureFixture(kind),r=api.activityCapture(f.host,f.req,f.res,f.decode);assert.equal(r.kind,kind);assert.deepEqual(f.writes,[api.ACTIVITY_KEY]);assert.equal(f.values[api.ACTIVITY_KEY].pin,'account1');assert(!JSON.stringify(f.values).includes('OLD_NONCE'));assert(!JSON.stringify(f.values).includes('OLD_SIGNATURE'));assert(!JSON.stringify(f.values).includes(sign(kind==='egg'?'39e8e':'73fdb')));});
check('egg capture ignores other projects',()=>{const f=captureFixture();const p=api.actForm(f.req.body);p.body='{"encryptProjectId":"other"}';f.req.body=api.actEncode(p);assert.equal(api.activityCapture(f.host,f.req,f.res,f.decode),null);assert.equal(f.writes.length,0);});
check('earn capture ignores other pages',()=>{const f=captureFixture('earn');const p=api.actForm(f.req.body),q=JSON.parse(p.reqData);q.pageId=11046;p.reqData=JSON.stringify(q);f.req.body=api.actEncode(p);assert.equal(api.activityCapture(f.host,f.req,f.res,f.decode),null);});
check('foreign account binding is rejected',()=>{const f=captureFixture('egg',{boundPin:'other'});assert.throws(()=>api.activityCapture(f.host,f.req,f.res,f.decode),/账号/);assert.equal(f.writes.length,0);});
check('foreign signing identity is rejected',()=>{const f=captureFixture('egg',{signaturePin:'other'});assert.throws(()=>api.activityCapture(f.host,f.req,f.res,f.decode),/账号/);});
check('unknown finance signature version saved as unsupported, never reused',()=>{const f=captureFixture('earn'),p=api.actForm(f.req.body),c=JSON.parse(p.cco);c.h5st=sign('73fdb','5.2');p.cco=JSON.stringify(c);f.req.body=api.actEncode(p);const r=api.activityCapture(f.host,f.req,f.res,f.decode);assert(r.unsupportedSigning);assert(!f.values[api.ACTIVITY_KEY].earn.signing);assert.equal(f.values[api.ACTIVITY_KEY].earn.signVersion,'5.2');});
check('script-generated activity requests are excluded from capture',()=>{const f=captureFixture();f.req.headers['X-Lazing-Activity-Run']='1';assert.equal(api.activityCapture(f.host,f.req,f.res,f.decode),null);assert.equal(f.writes.length,0);});
check('HTTP failure does not update credential profile',()=>{const f=captureFixture();f.res.status=403;assert.equal(api.activityCapture(f.host,f.req,f.res,f.decode),null);});
check('business failure does not update credential profile',()=>{const f=captureFixture();f.res.body='{"code":0,"data":{"bizCode":1}}';assert.throws(()=>api.activityCapture(f.host,f.req,f.res,f.decode));assert.equal(f.writes.length,0);});
check('duplicate form fields are rejected',()=>assert.throws(()=>api.actForm('functionId=a&functionId=b'),/重复/));
check('query/body conflict is rejected',()=>assert.throws(()=>api.actParams({url:'https://api.m.jd.com/?functionId=a',body:'functionId=b'}),/冲突/));
check('invalid or duplicate login pairs are rejected',()=>{assert.equal(api.actPair('pt_key=a;'),null);assert.equal(api.actPair('pt_key=a;pt_pin=b;pt_pin=c;'),null);});
check('oversized task lists are rejected',()=>assert.throws(()=>api.actEggList({code:0,data:{bizCode:0,result:{taskInfo:{taskList:Array(101).fill({})}}}}),/结构/));
check('egg uses live task IDs, waits and verifies progress, counts actual award',async()=>{
 const f=captureFixture();api.activityCapture(f.host,f.req,f.res,f.decode);let completed=false;
 const h=fakeHost(o=>{const q=api.actParams(o),b=JSON.parse(q.body);if(q.sceneCode==='task_list')return eggList(completed);if(b.actionType===0){completed=true;return {code:0,data:{bizCode:0,result:{assignmentResult:{rewardsInfo:{successRewards:{beans:[{rewardType:3,quantity:2}]}}}}}};}return {code:0,data:{bizCode:0,result:{}}};});
 const r=await api.createEggClient(h.host,h.crypto,f.values[api.ACTIVITY_KEY].egg).run();assert(!r.stopped,r.message);assert.equal(r.beans,2);assert.equal(h.sleeps[0],7000);assert(r.rows[0].result.includes('已确认'));const a=h.calls.filter(x=>x.url).map(x=>api.actParams(x)).filter(x=>x.sceneCode==='do_task').map(x=>JSON.parse(x.body));assert.deepEqual(a.map(x=>x.actionType),[1,0]);assert(a.every(x=>x.encryptAssignmentId==='assignment1'));
});
check('egg never turns purchase/follow/invite tasks into browse requests',async()=>{const f=captureFixture();api.activityCapture(f.host,f.req,f.res,f.decode);const j=eggList();j.data.result.taskInfo.taskList[0].assignmentName='下单关注邀请';const h=fakeHost(()=>j),r=await api.createEggClient(h.host,h.crypto,f.values[api.ACTIVITY_KEY].egg).run();assert.equal(r.rows[0].result,'需App操作');assert(!h.calls.filter(x=>x.url).some(x=>api.actParams(x).sceneCode==='do_task'));});
check('egg does not invent items when list lacks browse projects',async()=>{const f=captureFixture();api.activityCapture(f.host,f.req,f.res,f.decode);const j=eggList();j.data.result.taskInfo.taskList[0].ext={waitDuration:6,extraType:'missingItems'};const h=fakeHost(()=>j),r=await api.createEggClient(h.host,h.crypto,f.values[api.ACTIVITY_KEY].egg).run();assert(r.rows[0].result.includes('缺少'));assert(!h.calls.filter(x=>x.url).some(x=>api.actParams(x).sceneCode==='do_task'));});
check('egg uncertain mutation not automatically repeated on next manual run',async()=>{const f=captureFixture();api.activityCapture(f.host,f.req,f.res,f.decode);const h=fakeHost(o=>{if(api.actParams(o).sceneCode==='do_task')throw Error('活动网络请求失败');return eggList();});const client=()=>api.createEggClient(h.host,h.crypto,f.values[api.ACTIVITY_KEY].egg);assert((await client().run()).stopped);const before=h.calls.filter(x=>x.url&&api.actParams(x).sceneCode==='do_task').length;const r=await client().run();assert(!r.stopped,r.message);assert(r.rows[0].result.includes('已有提交记录'));assert.equal(h.calls.filter(x=>x.url&&api.actParams(x).sceneCode==='do_task').length,before);});
check('egg HTTP200 business rejection is not success',async()=>{const f=captureFixture();api.activityCapture(f.host,f.req,f.res,f.decode);const h=fakeHost(()=>({code:0,data:{bizCode:403}})),r=await api.createEggClient(h.host,h.crypto,f.values[api.ACTIVITY_KEY].egg).run();assert(r.stopped);assert.equal(r.beans,0);});
check('finance query rejects an incomplete query before any network mutation',async()=>{const h=fakeHost(()=>{throw Error('must not call');}),r=await api.createEarnClient(h.host,h.crypto,{pin:'account1'}).run();assert(r.stopped);assert(r.message.includes('查询参数'));assert.equal(h.calls.length,0);});
check('finance browse uses next/start/wait/finish and actual named bean awards',async()=>{const f=captureFixture('earn');api.activityCapture(f.host,f.req,f.res,f.decode);const h=fakeHost(o=>{const u=api.actEndpoint(o.url);if(u===api.EARN_QUERY)return earnList([earnTask()]);if(u===api.EARN_PATHS.next)return {success:true,resultData:{code:'0000',data:{missionId:'child1'}}};if(u===api.EARN_PATHS.finish)return {success:true,resultData:{code:'0000',data:{awards:[{awardName:'京豆',awardNum:3},{awardName:'优惠券',awardNum:100}]}}};return {success:true,resultData:{code:'0000'}};});const r=await api.createEarnClient(h.host,h.crypto,f.values[api.ACTIVITY_KEY].earn).run();assert(!r.stopped,r.message);assert.equal(r.beans,3);assert.deepEqual(h.sleeps,[12000]);const bodies=h.calls.filter(x=>x.url&&![api.EARN_QUERY,api.EARN_POP,api.EARN_LEDGER].includes(api.actEndpoint(x.url))).map(x=>JSON.parse(x.body));assert.deepEqual(bodies.map(x=>x.missionId),['mission1','child1','child1']);assert(!JSON.stringify(h.calls).includes('OLD_SIGNATURE'));});
check('finance jump advertised amount is never counted as actual beans',async()=>{const f=captureFixture('earn');api.activityCapture(f.host,f.req,f.res,f.decode);let done=false;const t=earnTask({awardNumber:{text:'999'},button:{jumpData:{jumpUrl:'https://show.jd.com/?juid='+'a'.repeat(32)}}});const h=fakeHost(o=>{const u=api.actEndpoint(o.url);if(u===api.EARN_QUERY)return earnList([{...t,status:done?1:0}]);if(u===api.EARN_PATHS.jump)done=true;return {success:true,resultData:{code:'0000'}};});const r=await api.createEarnClient(h.host,h.crypto,f.values[api.ACTIVITY_KEY].earn).run();assert(!r.stopped,r.message);assert.equal(r.beans,0);assert(r.rows[0].result.startsWith('任务已完成'));assert(h.calls.some(x=>x.method==='get'));});
check('finance completed tasks are skipped',async()=>{const f=captureFixture('earn');api.activityCapture(f.host,f.req,f.res,f.decode);const h=fakeHost(()=>earnList([earnTask({status:1})])),r=await api.createEarnClient(h.host,h.crypto,f.values[api.ACTIVITY_KEY].earn).run();assert.equal(r.rows[0].result,'任务已完成，到账待确认');assert.equal(h.calls.filter(x=>x.url&&api.actEndpoint(x.url)!==api.EARN_LEDGER).length,1);});
check('finance business rejection stops instead of reporting an award',async()=>{const f=captureFixture('earn');api.activityCapture(f.host,f.req,f.res,f.decode);const h=fakeHost(o=>api.actEndpoint(o.url)===api.EARN_QUERY?earnList([earnTask()]):{success:true,resultData:{code:'1001'}}),r=await api.createEarnClient(h.host,h.crypto,f.values[api.ACTIVITY_KEY].earn).run();assert(r.stopped);assert.equal(r.beans,0);});
check('capture rule excludes all four splash diagnostic routes',()=>{const line=plugin.split('\n').find(x=>x.startsWith('response if ')&&x.includes('api\\.m\\.jd'));
 const re=new RegExp(line.split(' ~= /')[1].split('/ &&')[0]);for(const f of ['start','basicConfig','welcomeHome','searchBoxWord'])assert(!re.test('https://api.m.jd.com/api?functionId='+f));assert(re.test('https://api.m.jd.com/?functionId=interact_pre_executor'));assert(re.test('https://api.m.jd.com/client.action?functionId=apTaskList'));});
check('no upstream runtime, external Cookie exchange or third-party signer is bundled',()=>{for(const f of ['jd-golden-egg.js','jd-earn-beans.js']){const s=src(f);assert(!s.includes('new Env('));assert(!s.includes('require("./function/dylans")'));assert(!s.includes('DY_PROXY'));assert(!s.includes('userInfo"]('));assert(s.includes("'auto-redirect':false"));}});
for(const [file,name] of [['jd-jxzy-activity.js','京喜自营'],['jd-farm-activity.js','农场'],['jd-golden-egg.js','金蛋'],['jd-earn-beans.js','赚京豆']])check(name+' entry stops safely with missing local credentials',async()=>{
 const notes=[],writes={},calls=[];let done=0;const sandbox={console:{log:()=>{}},$argument:'query',$persistentStore:{read:k=>writes[k]||null,write:(v,k)=>{writes[k]=v;return true;}},$notification:{post:(...x)=>notes.push(x)},$httpClient:{get:()=>calls.push('get'),post:()=>calls.push('post')},$done:()=>{done++;},setTimeout,clearTimeout};vm.runInNewContext(src(file),sandbox,{timeout:5000});for(let i=0;i<5&&done===0;i++)await new Promise(r=>setTimeout(r,1));assert.equal(done,1);assert.equal(calls.length,0);assert.equal(notes.length,1);
});

check('device URL escapes every custom-Base64 character before Loon sends it',()=>{
 const o=api.actDeviceRequest('Mozilla/5.0 (iPhone)',1000,'a'.repeat(32));assert(!/[<>\s"#]/.test(o.url));assert(o.url.includes('%3C'));assert.equal(new URL(o.url).searchParams.get('a'),api.actTDEncode({pin:'',oid:'',bizId:'jd-babelh5',fc:'',mode:'strict',p:'s',fp:'a'.repeat(32),ctype:1,v:'3.2.1.1',f:'3',o:'pro.m.jd.com/mall/active/3fcyrvLZALNPWCEDRvaZJVrzek8v/index.html',qs:'',jsTk:'',qi:''}));
 const d=api.actForm(o.body).d,map='23IL<N01c7KvwZO56RSTAfghiFyzWJqVabGH4PQdopUrsCuX*xeBjkltDEmn89.-';let bits=0,n=0,out='';for(const c of d.slice(0,-1)){const v=map.indexOf(c);if(v<0||v>=64)continue;n=n<<6|v;bits+=6;if(bits>=8){bits-=8;out+=String.fromCharCode(n>>>bits&255);}}const data=JSON.parse(decodeURIComponent(out));assert(data.n.enumerationOrder.includes('requestMIDIAccess'));assert.equal(data.sc.ActiveBorder,'rgb(118, 118, 118)');assert.equal(data.n.userAgent,'Mozilla/5.0 (iPhone)');
});
check('opaque item IDs retain Base64 punctuation while control characters and objects are rejected',()=>{
 for(const id of ['item/ABC+xyz==','sku:123456','123%2F45',123])assert(api.actItemId(id));for(const id of ['',null,{},'bad\nvalue'.replace('\\n','\n'),String.fromCharCode(0)])assert(!api.actItemId(id));
});
check('egg submits server-issued opaque item unchanged and carries standard region parameters',async()=>{
 const f=captureFixture();api.activityCapture(f.host,f.req,f.res,f.decode);let done=false;const item='server/item+id==';
 const h=fakeHost(o=>{const p=api.actParams(o),b=JSON.parse(p.body);assert.equal(p.xAPIRegion,'CN');assert.equal(p.xAPITz,'Asia/Shanghai');assert.equal(p.loginType,'2');assert(p.t);if(p.sceneCode==='task_list'){const j=eggList(done);j.data.result.taskInfo.taskList[0].ext.items[0].itemId=item;return j;}assert.equal(b.itemId,item);if(b.actionType===0){done=true;return {code:0,data:{bizCode:0,result:{}}};}return {code:0,data:{bizCode:0,result:{}}};});
 const r=await api.createEggClient(h.host,h.crypto,f.values[api.ACTIVITY_KEY].egg).run();assert(!r.stopped,r.message);assert(r.rows[0].result.includes('已确认'));assert.equal(h.calls.filter(x=>x.url&&api.actParams(x).sceneCode==='do_task').length,2);
});
check('egg uses reviewed direct-completion contract only when extraType is absent',async()=>{
 const f=captureFixture();api.activityCapture(f.host,f.req,f.res,f.decode);let done=false;
 const h=fakeHost(o=>{const p=api.actParams(o),b=JSON.parse(p.body);if(p.sceneCode==='task_list'){const j=eggList(done);j.data.result.taskInfo.taskList[0].ext={};return j;}assert.equal(b.itemId,'1');assert.equal(b.actionType,0);done=true;return {code:0,data:{bizCode:0,result:{}}};});
 const r=await api.createEggClient(h.host,h.crypto,f.values[api.ACTIVITY_KEY].egg).run();assert(!r.stopped,r.message);assert.equal(h.sleeps.length,0);assert.equal(h.calls.filter(x=>x.url&&api.actParams(x).sceneCode==='do_task').length,1);
});
check('egg skips offers without bean rewards as Faker does',async()=>{
 const f=captureFixture();api.activityCapture(f.host,f.req,f.res,f.decode);const j=eggList();j.data.result.taskInfo.taskList[0].rewards=[{rewardName:'优惠券'}];const h=fakeHost(()=>j),r=await api.createEggClient(h.host,h.crypto,f.values[api.ACTIVITY_KEY].egg).run();assert.equal(r.rows[0].result,'奖励不是京豆，跳过');assert(!h.calls.some(x=>x.url&&api.actParams(x).sceneCode==='do_task'));
});
check('late egg refusal preserves earlier reward and shows rejected phase and business code',async()=>{
 const f=captureFixture();api.activityCapture(f.host,f.req,f.res,f.decode);let firstDone=false;
 const h=fakeHost(o=>{const p=api.actParams(o),b=JSON.parse(p.body);if(p.sceneCode==='task_list'){const one=eggList(firstDone).data.result.taskInfo.taskList[0],two=JSON.parse(JSON.stringify(eggList().data.result.taskInfo.taskList[0]));two.encryptAssignmentId='second';two.assignmentName='浏览省钱频道';return {code:0,data:{bizCode:0,result:{taskInfo:{taskList:[one,two]}}}};}if(b.actionType===0&&b.encryptAssignmentId==='second')return {code:0,data:{bizCode:'TIME_123',bizMsg:'浏览时间不足 pt_key=PRIVATE_RESPONSE'}};if(b.actionType===0){firstDone=true;return {code:0,data:{bizCode:0,result:{assignmentResult:{rewardsInfo:{successRewards:{beans:[{rewardType:3,quantity:1}]}}}}}};}return {code:0,data:{bizCode:0,result:{}}};});
 const r=await api.createEggClient(h.host,h.crypto,f.values[api.ACTIVITY_KEY].egg).run();assert(r.stopped);assert.equal(r.beans,1);assert(r.message.includes('提交完成'));assert(r.message.includes('TIME_123'));assert(r.rows[1].result.includes('未完成'));assert(!JSON.stringify(r).includes('PRIVATE_RESPONSE'));
});

check('diagnostic shows real code and resultMsg without inventing a missing bizCode',()=>{
 const s=api.actRejection({success:false,resultCode:200014000,resultMsg:'服务繁忙，请稍后再试'},'earn');assert(s.includes('200014000'));assert(s.includes('服务繁忙'));assert(!s.includes('bizCode'));const t=api.actRejection({resultCode:200014000,resultMsg:'服务异常 pt_key=PRIVATE_VALUE https://example.com/private'},'earn');assert(!t.includes('PRIVATE_VALUE'));assert(!t.includes('example.com'));
});
check('finance initializes once, signs raw juid, processes six tasks and verifies once at end',async()=>{
 const f=captureFixture('earn');api.activityCapture(f.host,f.req,f.res,f.decode);const sent=new Set(),juid=i=>i.toString(16).padStart(32,'a'),tasks=()=>Array.from({length:6},(_,i)=>earnTask({missionId:'mission'+i,status:sent.has(juid(i))?1:0,awardNumber:{text:'999'},button:{jumpData:{jumpUrl:'https://show.jd.com/?juid='+juid(i)}}}));let queries=0,pops=0;const strings=[],pauses=[];
 const h=fakeHost(o=>{const u=api.actEndpoint(o.url);if(u===api.EARN_QUERY){queries++;assert(queries<=2);return earnList(tasks());}if(u===api.EARN_POP){pops++;const p=api.actForm(o.body),q=JSON.parse(p.reqData);assert(!('osVersion' in q.extParams));return {success:true,resultData:{code:'0000'}};}if(u===api.EARN_PATHS.jump)sent.add(new URL(o.url).searchParams.get('juid'));return {success:true,resultData:{code:'0000'}};});
 h.host.aar=async()=>({nonce:()=> '12345678901234567890',sign:s=>{strings.push(s);return 'a'.repeat(66);}});h.host.pause=async ms=>pauses.push(ms);
 const r=await api.createEarnClient(h.host,h.crypto,f.values[api.ACTIVITY_KEY].earn).run();assert(!r.stopped,r.message);assert.equal(queries,2);assert.equal(pops,1);assert.equal(r.submitted,6);assert(r.rows.every(x=>x.result.startsWith('任务已完成')));assert.equal(r.beans,0);for(let i=0;i<6;i++){assert(strings.includes(juid(i)));assert(!strings.includes(JSON.stringify(juid(i))));}assert.equal(pauses.length,6);assert(pauses.every(ms=>ms>=2000&&ms<3000));const ops=h.calls.filter(x=>x.url&&api.actEndpoint(x.url)!==api.EARN_LEDGER).map(x=>api.actEndpoint(x.url));assert.deepEqual(ops.slice(0,2),[api.EARN_QUERY,api.EARN_POP]);assert.equal(ops.at(-1),api.EARN_QUERY);
});
check('final verification refusal preserves successful submissions and names verification as failure',async()=>{
 const f=captureFixture('earn');api.activityCapture(f.host,f.req,f.res,f.decode);let queries=0;const t=earnTask({button:{jumpData:{jumpUrl:'https://show.jd.com/?juid='+'b'.repeat(32)}}});const h=fakeHost(o=>{if(api.actEndpoint(o.url)===api.EARN_QUERY)return ++queries===1?earnList([t]):{success:false,resultCode:200014000,resultMsg:'服务繁忙，请稍后再试'};return {success:true,resultData:{code:'0000'}};});const r=await api.createEarnClient(h.host,h.crypto,f.values[api.ACTIVITY_KEY].earn).run();assert(r.stopped);assert.equal(r.submitted,1);assert(r.message.includes('复查任务列表'));assert(r.message.includes('200014000'));assert(r.rows[0].result.includes('已接取并提交'));assert(!r.rows[0].result.includes('未完成'));
});
check('pending finance journal is retained and prevents replay after final query rejection',async()=>{
 const f=captureFixture('earn');api.activityCapture(f.host,f.req,f.res,f.decode);let queries=0;const t=earnTask({button:{jumpData:{jumpUrl:'https://show.jd.com/?juid='+'c'.repeat(32)}}});const h=fakeHost(o=>{if(api.actEndpoint(o.url)===api.EARN_QUERY)return ++queries===2?{success:false,resultCode:200014000}:earnList([t]);return {success:true,resultData:{code:'0000'}};});const run=()=>api.createEarnClient(h.host,h.crypto,f.values[api.ACTIVITY_KEY].earn).run();assert((await run()).stopped);const mutations=()=>h.calls.filter(x=>x.url&&[api.EARN_PATHS.receive,api.EARN_PATHS.jump].includes(api.actEndpoint(x.url))).length;const before=mutations(),r=await run();assert(!r.stopped,r.message);assert.equal(mutations(),before);assert(r.rows[0].result.includes('已有提交记录'));
});
check('finance page initialization rejection stops before any receive or jump',async()=>{
 const f=captureFixture('earn');api.activityCapture(f.host,f.req,f.res,f.decode);const h=fakeHost(o=>api.actEndpoint(o.url)===api.EARN_QUERY?earnList([earnTask()]):{success:false,resultCode:200014000,resultMsg:'服务繁忙'});const r=await api.createEarnClient(h.host,h.crypto,f.values[api.ACTIVITY_KEY].earn).run();assert(r.stopped);assert(r.message.includes('初始化任务页'));assert.equal(r.submitted,0);assert(!h.calls.some(x=>x.url&&[api.EARN_PATHS.receive,api.EARN_PATHS.jump].includes(api.actEndpoint(x.url))));
});

const receiptDate='2026-10-25';
const receipt=(title,amount=1,id='receipt1',date=receiptDate+' 10:03:00')=>({id,date,eventMassage:title,amount:String(amount)});
const sha=x=>require('node:crypto').createHash('sha256').update(x).digest('hex');
function ledgerFixture(rows,patch={}){
 const store=patch.store||{},report={name:'天天赚京豆',pin:'account1',day:receiptDate,rows:(patch.titles||['浏览测试甲']).map(title=>({title,result:'已提交，进度待App确认'})),beans:patch.beans||0,submitted:patch.submitted||0,stopped:false},calls=[];
 const host={day:()=>receiptDate,now:()=>1792886400000,read:(k,f)=>store[k]||f,write:(k,v)=>{store[k]=v;},guard:()=>{},log:()=>{},pause:async()=>{},json:r=>{if(r.status!==200)throw Error('HTTP '+r.status);return JSON.parse(r.body);},request:async o=>{calls.push(o);assert.equal(api.actEndpoint(o.url),api.EARN_LEDGER);assert(o.headers.Cookie.includes('account1'));assert(!o.headers.Authorization);const page=Number(new URL(o.url).searchParams.get('page')),j=typeof rows==='function'?rows(page):{code:'0',jingDetailList:rows};if(j.status)return j;return {status:200,body:JSON.stringify(j)};}};
 const ledger=api.createEarnLedger(host,{hash:sha},{pin:'account1',headers:{Cookie:ck,'User-Agent':'offline'}},report);ledger.targets(patch.titles||['浏览测试甲']);return {ledger,report,store,calls};
}
check('ledger confirms six exact-name credits while excluding gold-egg, other days and debits',async()=>{
 const titles=Array.from({length:6},(_,i)=>'浏览测试'+i),rows=titles.map((t,i)=>receipt(t,1,'id'+i));rows.push(receipt('京豆',2,'gold'),receipt(titles[0],-1,'debit'),receipt(titles[0],9,'yesterday','2026-10-24 10:03:00'));
 const f=ledgerFixture(rows,{titles});await f.ledger.confirm();assert.equal(f.report.ledgerBeans,6);assert(f.report.rows.every(x=>x.creditedBeans===1&&x.receiptState==='confirmed'));const text=api.activityRewardText('earn',f.report);assert(text.includes('到账 6 京豆'));assert(!text.includes('0 京豆'));assert.equal(f.calls.length,1);
});
check('ledger receipt and direct API award are not added twice',async()=>{
 const f=ledgerFixture([receipt('浏览测试甲',3)],{beans:3,submitted:1});await f.ledger.confirm();assert.equal(f.report.ledgerBeans,3);assert(api.activityRewardText('earn',f.report).includes('到账 3 京豆'));assert(!api.activityRewardText('earn',f.report).includes('6 京豆'));
});
check('ledger failure leaves completed tasks intact and labels payment as pending',async()=>{
 const f=ledgerFixture(()=>({status:403,body:'{}'}));f.report.rows[0].result='任务已完成，到账待确认';f.report.rows[0].completed=true;await f.ledger.confirm();assert.equal(f.report.ledgerBeans,null);assert.equal(f.report.ledgerState,'unavailable');assert(f.report.rows[0].completed);assert(api.activityRewardText('earn',f.report).startsWith('到账待确认'));assert.equal(f.calls.length,1);
});
check('ledger deduplicates overlapping pages and repeated runs without losing confirmed credits',async()=>{
 const rows=Array.from({length:20},(_,i)=>receipt('浏览测试甲',1,'same'+i));const store={},f=ledgerFixture(page=>({code:'0',jingDetailList:page===3?[]:rows}),{store});await f.ledger.confirm();assert.equal(f.report.ledgerBeans,20);const g=ledgerFixture(page=>({code:'0',jingDetailList:page===3?[]:rows}),{store});await g.ledger.confirm();assert.equal(g.report.ledgerBeans,20);assert.equal(g.calls.length,3);
});
check('ledger same-name ambiguity never marks two missions paid from one receipt',async()=>{
 const f=ledgerFixture([receipt('浏览测试甲')],{titles:['浏览测试甲','浏览测试甲']});await f.ledger.confirm();assert.equal(f.report.ledgerBeans,1);assert(f.report.rows.every(x=>x.receiptState==='ambiguous'&&x.creditedBeans===null&&!x.completed));
});
check('ledger cache belongs to one account and one day',async()=>{
 for(const bad of [{pin:'other',day:receiptDate},{pin:'account1',day:'2026-10-24'}]){const store={'receipts.earn.account1':{...bad,rows:[{key:'foreign',title:'浏览测试甲',amount:999,date:receiptDate+' 10:00:00'}]}},f=ledgerFixture([],{store});await f.ledger.confirm();assert.equal(f.report.ledgerBeans,0);assert(api.activityRewardText('earn',f.report).startsWith('到账待确认'));}
});
check('confirmed cached receipts remain identified as previously verified when refresh fails',async()=>{
 const store={},f=ledgerFixture([receipt('浏览测试甲')],{store});await f.ledger.confirm();const g=ledgerFixture(()=>({status:403,body:'{}'}),{store});await g.ledger.confirm();assert.equal(g.report.ledgerBeans,1);assert.equal(g.report.ledgerState,'cached');assert(api.activityRewardText('earn',g.report).includes('此前已核实到账 1'));
});
check('ledger rejects malformed timestamps and incomplete responses',()=>{
 assert.throws(()=>api.earnReceiptRows({code:3},receiptDate,sha));assert.throws(()=>api.earnReceiptRows({code:0},receiptDate,sha));const p=api.earnReceiptRows({code:0,jingDetailList:[receipt('浏览测试甲',1,'a','2026-02-30 10:00:00'),receipt('浏览测试甲',1,'b','invalid')]},receiptDate,sha);assert.equal(p.rows.length,0);
});
check('legacy pending run can be confirmed by ledger even when initial task query fails',async()=>{
 const f=captureFixture('earn');api.activityCapture(f.host,f.req,f.res,f.decode);const title='浏览此前任务',store={'earn.last':{name:'天天赚京豆',rows:[{title,result:'已提交，进度待确认'}]},'journal.earn.account1':{day:receiptDate,entries:{'old:receive':'submitted'}}};
 const h=fakeHost(o=>api.actEndpoint(o.url)===api.EARN_LEDGER?{code:'0',jingDetailList:[receipt(title)]}:{success:false,resultCode:20001400},store);h.crypto.hash=sha;const r=await api.createEarnClient(h.host,h.crypto,f.values[api.ACTIVITY_KEY].earn).run();assert(r.stopped);assert.equal(r.submitted,0);assert.equal(r.ledgerBeans,1);assert(r.rows[0].result.includes('此前任务'));assert(!h.calls.some(x=>x.url&&[api.EARN_PATHS.receive,api.EARN_PATHS.jump].includes(api.actEndpoint(x.url))));
});
check('task names survive a failed run for future read-only receipt checks',async()=>{
 const store={},a=ledgerFixture([receipt('浏览测试甲')],{store});await a.ledger.confirm();store['earn.last']={pin:'account1',day:receiptDate,rows:[]};const report={rows:[],beans:0,submitted:0};const host={day:()=>receiptDate,now:()=>1792886400000,read:(k,f)=>store[k]||f,write:(k,v)=>{store[k]=v;},guard:()=>{},log:()=>{},pause:async()=>{},json:r=>JSON.parse(r.body),request:async()=>({status:200,body:JSON.stringify({code:0,jingDetailList:[]})})};await api.createEarnLedger(host,{hash:sha},{pin:'account1',headers:{Cookie:ck,'User-Agent':'offline'}},report).confirm();assert.equal(report.ledgerBeans,1);assert.equal(report.rows.length,1);
});
check('stable receipt ID updates do not count the same credit twice',async()=>{const store={},a=ledgerFixture([receipt('浏览测试甲',1,'stable')],{store});await a.ledger.confirm();const b=ledgerFixture([receipt('浏览测试甲',2,'stable',receiptDate+' 10:04:00')],{store});await b.ledger.confirm();assert.equal(b.report.ledgerBeans,2);});
// Included by build.py in the single public offline check file.
function credentialChecks(){
 for(const seeded of [false,true])check('full activity capture saves PLUS signin template with '+(seeded?'existing login':'empty store'),async()=>{
  const records={},notes=[];if(seeded)records.JD_SIGNIN_LOGIN_V1=JSON.stringify({pin:'offline',cookie:'pt_key=OLD;pt_pin=offline;',headers:{Cookie:'pt_key=OLD;pt_pin=offline;'},capturedAt:1});
  const env='OFFLINE_PLUS_ENV',params={functionId:'bff_marketing_interaction',appid:'plus_business',body:JSON.stringify({scene:'blindBox',touchPoint:'purePlusIndexNew2608'}),h5st:['time','fp','35fa0','token','hash','5.3','timestamp',env,'hash','ENCODING'].join(';')};let ended=false;
  const sandbox={console:{log:()=>{}},setTimeout,clearTimeout,$request:{method:'POST',url:'https://api.m.jd.com/api',headers:{Cookie:'pt_key=NEW;pt_pin=offline;','User-Agent':'Offline test',Referer:'https://plus.m.jd.com/'},body:new URLSearchParams(params).toString()},$response:{status:200,body:JSON.stringify({code:'1711000',msg:'成功',rs:{leftTimes:1,sendBenefitList:[]}})},$persistentStore:{read:k=>records[k]||null,write:(v,k)=>{records[k]=v;return true;}},$notification:{post:(...x)=>notes.push(x)},$httpClient:{post:()=>{throw Error('Capture must not issue requests');}},$done:()=>{ended=true;}};
  vm.runInNewContext(src('jd-activity-capture.js'),sandbox,{timeout:5000});for(let i=0;i<30&&!ended;i++)await new Promise(r=>setTimeout(r,1));assert(ended);const p=JSON.parse(records.JD_CHECKIN_TEST_ACCOUNT_V1);assert.equal(p.modes.blindbox.query.signatureAppId,'35fa0');assert.equal(p.modes.blindbox.query.referenceEnvironmentEncoded,env);assert(JSON.parse(records.JD_SIGNIN_LOGIN_V1).cookie.includes('NEW'));assert(!p.modes.blindbox.query.params.h5st);
 });

 const decode=()=>({pp:{p1:'account1'},extend:{},v:'h5_file_v5.3.6'});
 const cookie='pt_key=NEW_KEY;pt_pin=account1;',ua='jdapp;iPhone;16.1.50;Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
 const from=values=>(k,f)=>values[k]||f;
 const native={JD_SIGNIN_LOGIN_V1:{pin:'account1',cookie,headers:{'User-Agent':ua},capturedAt:100}};
 check('shared login alone builds both new activity profiles without a page capture',()=>{
  const s=api.actSharedMaterial(from(native),decode);assert.equal(s.pin,'account1');assert.equal(s.signing,undefined);
  for(const kind of ['egg','earn']){const p=api.actDefaultProfile(kind,s);assert(p.headers.Cookie.includes('NEW_KEY'));assert(p.query||p.params);}
  const p=api.actDefaultProfile('earn',s);assert(p.headers.Cookie.includes('pwdt_id=account1;'));assert.equal(p.signClientVersion,'6.9.0');assert.equal(p.query.pageId,11189);
 });
 check('farm-only profile supplies same-account login and device environment to every activity',()=>{
  const d={JD_FARM_TASKS_ACCOUNT_V1:{pin:'account1',scopes:{farm:{signing:{environment:'SHARED_ENV',encoding:'ENCODING'},templates:{apTaskList:{headers:{Cookie:cookie,'User-Agent':ua},at:100,params:{'x-api-eid-token':'LOCAL_EID'}}}}}}};
  const s=api.actSharedMaterial(from(d),decode);assert.equal(s.signing.environment,'SHARED_ENV');
  const jx=api.actJxProfile(from(d),decode);assert.equal(jx.signing.eidToken,'LOCAL_EID');assert.equal(jx.signing.encoding,'ENCODING');assert.equal(JSON.parse(jx.query.params.body).appCode,'ms1888ebbf');
 });
 check('canonical cookie value supersedes stale Cookie header and stale page captures',()=>{
  const d={...native,JD_SIGNIN_LOGIN_V1:{...native.JD_SIGNIN_LOGIN_V1,headers:{Cookie:'pt_key=STALE;pt_pin=account1;','User-Agent':ua}},[api.ACTIVITY_KEY]:{pin:'account1',earn:{pin:'account1',headers:{Cookie:'pt_key=OLDER;pt_pin=account1;','User-Agent':ua},capturedAt:999}}};
  const s=api.actSharedMaterial(from(d),decode);assert(s.headers.Cookie.includes('NEW_KEY'));assert(!s.headers.Cookie.includes('STALE'));assert(!s.headers.Cookie.includes('OLDER'));
 });
 check('binding prevents falling back to a different account',()=>{assert.throws(()=>api.actSharedMaterial(from({...native,JD_SIGNIN_ACCOUNT_V1:{pin:'different'}}),decode),/缺少京东Cookie/);});
 check('foreign activity template is never merged with current account cookie',()=>{const s=api.actSharedMaterial(from(native),decode);assert.throws(()=>api.actDefaultProfile('earn',s,{pin:'foreign'}),/其他账号/);});
 check('foreign environment is not reused for a valid shared cookie',()=>{const d={...native,[api.ACTIVITY_KEY]:{pin:'account1',egg:{pin:'account1',headers:{Cookie:cookie,'User-Agent':ua},signing:{environment:'BAD'},capturedAt:10}}};assert(!api.actSharedMaterial(from(d),()=>({pp:{p1:'foreign'}})).signing);});
 check('device token request contains no login cookie or account pin',()=>{
  const o=api.actDeviceRequest(ua,1000,'a'.repeat(32));assert(o.url.startsWith('https://jra.jd.com/jsTk.do?a='));assert(!JSON.stringify(o).includes('NEW_KEY'));assert(!JSON.stringify(o).includes('account1'));assert(!Object.keys(o.headers).some(k=>/cookie/i.test(k)));
  // Independently decode the public custom Base64 encoding, including Unicode.
  const map='23IL<N01c7KvwZO56RSTAfghiFyzWJqVabGH4PQdopUrsCuX*xeBjkltDEmn89.-';const value={name:'浏览参数',test:1000},t=api.actTDEncode(value);let bits=0,n=0,out='';for(const c of t.slice(0,-1)){const v=map.indexOf(c);if(v<0||v>=64)continue;n=n<<6|v;bits+=6;if(bits>=8){bits-=8;out+=String.fromCharCode(n>>>bits&255);}}assert.deepEqual(JSON.parse(decodeURIComponent(out)),value);
 });
 check('task-list-only Jingxi visit is captured without pretending to have captured its signature',()=>{
  const store={...native},read=from(store);const host={read,write:(k,v)=>{store[k]=v;},observedAt:200};
  const req={method:'POST',url:'https://api.m.jd.com/client.action?functionId=jxzy_active_task_queryTaskList',headers:{Cookie:cookie,'User-Agent':ua,Referer:'https://pro.m.jd.com/mall/active/2iqSwv1JiDHxAkHAikfU6XAECFmo/index.html'},body:api.actEncode({appid:'jx_h5_babel',client:'jxh5',channel:'jxh5',body:JSON.stringify({source:'jxzy',craftId:'6824629a7c46584759d39b78',sceneval:2,buid:325,appCode:'ms1888ebbf',signStr:'OLD_BODY_SIGNATURE',time:123})})};
  assert(api.actJxTaskCapture(host,req,{status:200,body:'{"code":0,"data":{"taskInfoList":[]}}'},decode));const p=store.JXZY_CHECKIN_ACCOUNT_V1;assert(p.query);assert(!p.signing);assert(!JSON.stringify(p).includes('OLD_BODY_SIGNATURE'));
 });
 check('Jingxi manual wrapper queries tasks with farm-only shared material',async()=>{
  const data={JD_FARM_TASKS_ACCOUNT_V1:{pin:'account1',scopes:{farm:{signing:{environment:'ENV',encoding:'ENCODING'},templates:{apTaskList:{headers:{Cookie:cookie,'User-Agent':ua},at:100,params:{'x-api-eid-token':'LOCAL_EID'}}}}}}},notes=[],calls=[];let done=false;
  const sandbox={console:{log:()=>{}},setTimeout,clearTimeout,$persistentStore:{read:k=>data[k]?JSON.stringify(data[k]):'',write:(v,k)=>{data[k]=v?JSON.parse(v):null;return true;}},$notification:{post:(...x)=>notes.push(x)},$done:()=>{done=true;},$httpClient:{post:(o,cb)=>{calls.push(o);assert(o.headers.Cookie.includes('NEW_KEY'));assert(o.url.includes('jxzy_active_task_queryTaskList'));cb(null,{status:200},'{"code":0,"data":{"taskInfoList":[]}}');}}};
  const source=src('jd-jxzy-activity.js').replace('(async function jxLoonTaskMain(){',"createJxTaskCrypto=()=>({decodeEnvironment:()=>({pp:{p1:'account1'},extend:{}}),hash:()=> 'a'.repeat(64),bodySign:()=> 'BODY_SIGNATURE'});\n(async function jxLoonTaskMain(){");vm.runInNewContext(source,sandbox,{timeout:5000});for(let i=0;i<30&&!done;i++)await new Promise(r=>setTimeout(r,1));assert(done);assert.equal(calls.length,1,JSON.stringify(notes));assert(notes.some(x=>x[1]==='执行结果'),JSON.stringify(notes));
 });

 check('device HTTP400 stops once and reports response type without exposing body',async()=>{
  const data=JSON.parse(JSON.stringify(native)),notes=[],calls=[];let ended=false;
  const sandbox={console:{log:()=>{}},setTimeout,clearTimeout,$persistentStore:{read:k=>data[k]?JSON.stringify(data[k]):'',write:(v,k)=>{data[k]=v?JSON.parse(v):null;return true;}},$notification:{post:(...x)=>notes.push(x)},$done:()=>{ended=true;},$httpClient:{post:(o,cb)=>{calls.push(o);assert(!o.headers.Cookie);assert(!o.alpn);cb(null,{status:400,headers:{}},'<html>PRIVATE_ECHO</html>');}},createFarmCrypto:()=>({hash:()=> 'a'.repeat(64),decodeEnvironment:decode})};
  const source=src('jd-earn-beans.js').split('function createFarmCrypto(')[0]+src('jd-earn-beans.js').slice(src('jd-earn-beans.js').indexOf('// ACTIVITY_KIND is fixed'));vm.runInNewContext(source,sandbox,{timeout:5000});for(let i=0;i<30&&!ended;i++)await new Promise(r=>setTimeout(r,1));assert(ended);assert.equal(calls.length,1);assert(notes[0][2].includes('HTTP 400'));assert(notes[0][2].includes('HTML'));assert(!JSON.stringify(notes).includes('PRIVATE_ECHO'));
 });
 for(const {kind,tokenOnly} of [{kind:'egg'},{kind:'earn'},{kind:'earn',tokenOnly:true}])check(kind+' full manual wrapper reaches query from only the shared Cookie'+(tokenOnly?' without an optional sdkToken':''),async()=>{
  const data=JSON.parse(JSON.stringify(native)),calls=[],notes=[];let ended=false,init=false;
  const response=o=>{
   if(o.url.startsWith('https://jra.jd.com/jsTk.do?')){assert(!o.headers.Cookie);return {data:tokenOnly?{token:'DEVICE_TOKEN'}:{token:'DEVICE_TOKEN',sdkToken:'SDK_TOKEN',eid:'EID'}};}
   if(kind==='egg'){const p=api.actParams(o);assert.equal(p.functionId,'interact_pre_executor');assert(p['x-api-eid-token']);return {code:0,data:{bizCode:0,result:{taskInfo:{taskList:[]}}}};}
   if(o.url.startsWith('https://aks.jdpay.com/aar2/getJS')){init=true;assert(!o.headers.Cookie);return 'eyJMOCK';}
   assert.equal(api.actEndpoint(o.url),api.EARN_QUERY);const q=api.actForm(o.body);const ep=JSON.parse(q.reqData).extParams;assert.equal(ep.sdkToken,tokenOnly?'':'SDK_TOKEN');assert.deepEqual(ep.signData,{sdkToken:tokenOnly?'':'SDK_TOKEN'});assert.deepEqual(JSON.parse(ep.deviceInfos),{sdkToken:tokenOnly?'':'SDK_TOKEN'});return {success:true,resultData:{resultList:[]}};
  };
  const sandbox={ACTIVITY_KIND:kind,console:{log:()=>{}},setTimeout,clearTimeout,$persistentStore:{read:k=>data[k]?JSON.stringify(data[k]):'',write:(v,k)=>{data[k]=v?JSON.parse(v):null;return true;}},$notification:{post:(...x)=>notes.push(x)},$done:()=>{ended=true;},$httpClient:{post:(o,cb)=>{calls.push(o);const b=response(o);cb(null,{status:200,headers:{}},typeof b==='string'?b:JSON.stringify(b));}},createFarmCrypto:()=>({hash:()=> 'a'.repeat(64),decodeEnvironment:decode,signOnline:async()=>sign(kind==='egg'?'39e8e':'73fdb')}),createAar:()=>{function A(){}A.init=o=>o.callback(true);A.prototype.nonce=()=> '12345678901234567890';A.prototype.sign=()=> 'a'.repeat(66);return A;}};
  const source=src('jd-earn-beans.js').split('function createFarmCrypto(')[0]+src('jd-earn-beans.js').slice(src('jd-earn-beans.js').indexOf('// ACTIVITY_KIND is fixed'));vm.runInNewContext(source.replace('ACTIVITY_KIND="earn"','ACTIVITY_KIND="'+kind+'"'),sandbox,{timeout:5000});
  for(let i=0;i<30&&!ended;i++)await new Promise(r=>setTimeout(r,1));assert(ended);assert(calls.length>=2);assert(notes.some(x=>x[1]==='执行完成'),JSON.stringify(notes));if(kind==='earn')assert(init);
 });
}
credentialChecks();

(async()=>{for(const [n,fn] of tests){await fn();checks++;console.log('PASS '+n);}console.log(checks+' checks passed; no live account requests.');})().catch(e=>{console.error(e);process.exitCode=1;});
