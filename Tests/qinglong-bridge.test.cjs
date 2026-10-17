// Offline VM tests: all HTTP is mocked; no account or NAS access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const scriptPath = fs.existsSync(__dirname + '/qinglong-bridge.js') ? __dirname + '/qinglong-bridge.js' : __dirname + '/../Scripts/qinglong-bridge.js';
const source = fs.readFileSync(scriptPath, 'utf8');
const base = {qlUrl: 'http://192.168.1.100:5700/', clientId: 'TEST_ID', clientSecret: 'TEST_SECRET', action: '检查连接'};
const account = {pin: 'TEST_PIN', modes: {daily: {headers: {Cookie: 'pt_key=OLD_KEY;pt_pin=TEST_PIN;'}, capturedAt: 100},
  scratch: {headers: {cookie: 'pt_key=NEW_KEY;pt_pin=TEST_PIN;'}, loginUpdatedAt: 200}}};
async function run(arg = {}, initial = {}, handler, httpContext) {
  const store = {...initial}, calls = [], logs = [], notices = [];
  let done = 0;
  const sandbox = {$argument: {...base, ...arg}, $persistentStore: {
    read: k => store[k] || null, write: (value, key) => (store[key] = value, true)
  }, console: {log: x => logs.push(x)}, $notification: {post: (...x) => notices.push(x)}, $done: () => done++,
    $script: {startTime: new Date()}, ...httpContext};
  sandbox.$httpClient = Object.fromEntries(['get','put','post'].map(method => [method, (options, cb) => {
    calls.push({method, ...options});
    assert.equal(options['auto-redirect'], false);
    assert.equal(options['auto-cookie'], false);
    assert.equal(options.insecure, false);
    const path = options.url.split('/open')[1].split('?')[0];
    const custom = handler && handler(method, path, options);
    if (custom && custom.error) return cb(custom.error, null, null);
    const data = custom === undefined ? path === '/auth/token' ? {token: 'TEST_TOKEN'} : [] : custom;
    cb(null, {status: 200}, JSON.stringify({code: 200, data}));
  }]));
  await vm.runInNewContext(source, sandbox, {timeout: 2000});
  assert.equal(done, 1);
  const visible = JSON.stringify({logs, notices, result: store.QL_BRIDGE_LAST_RESULT_V1});
  for (const secret of ['TEST_SECRET','TEST_TOKEN','OLD_KEY','NEW_KEY','LOCAL_KEY']) assert.equal(visible.includes(secret), false, 'secret leaked: ' + secret);
  return {store, calls, logs, notices, result: JSON.parse(store.QL_BRIDGE_LAST_RESULT_V1 || 'null')};
}
(async () => {
  let checks = 0;
  const test = async (name, fn) => {await fn(); checks++; console.log('PASS ' + name);};
  await test('connection checks both read permissions without writes', async () => {
    const r = await run(); assert.equal(r.result.status, 'success'); assert.equal(r.calls.length, 3); assert(r.calls.every(x => x.method === 'get'));
  });
  await test('local capture status requires no NAS credentials and preserves sync result', async () => {
    const previous=JSON.stringify({status:'success',message:'previous sync'});
    const capture=JSON.stringify({status:'updated',source:'金融现金签到',complete:true});
    const r=await run({action:'最近凭据获取结果',clientSecret:''},{QL_BRIDGE_LAST_RESULT_V1:previous,QL_BRIDGE_CAPTURE_LAST_V1:capture});
    assert.equal(r.calls.length,0);assert.equal(r.store.QL_BRIDGE_LAST_RESULT_V1,previous);assert(r.logs.some(x=>x.includes('金融现金签到')));
  });
  await test('missing authorization stops before networking', async () => {
    const r = await run({clientSecret: ''}); assert.equal(r.calls.length, 0); assert.equal(r.result.status, 'failed');
  });
  await test('HTTP outside LAN rejected before credentials leave device', async () => {
    const r = await run({qlUrl: 'http://example.com:5700'}); assert.equal(r.calls.length, 0); assert.equal(r.result.status, 'failed');
  });
  await test('sync selects newest existing login and preserves other account', async () => {
    const r = await run({action:'同步京东凭据'}, {JD_CHECKIN_TEST_ACCOUNT_V1: JSON.stringify(account)}, (method, path, o) => {
      if (path === '/envs' && method === 'get') return [{id: 1, name: 'JD_COOKIE', value: 'pt_key=OTHER;pt_pin=OTHER;', status:0},
        {id: 2, name: 'JD_COOKIE', value: 'pt_key=OLD_KEY;pt_pin=TEST_PIN;', remarks:'preserved', labels:['keep'], status:1}];
      if (method === 'put') {const b=JSON.parse(o.body); assert.equal(b.id,2); assert.equal(b.value,'pt_key=NEW_KEY;pt_pin=TEST_PIN;'); assert.equal(b.remarks,'preserved'); assert.deepEqual(b.labels,['keep']); return {};}
    });
    assert.equal(r.result.status,'success'); assert.equal(r.calls.filter(x=>x.method==='put').length,1);
    assert(r.result.message.includes('禁用')); assert(!r.calls.some(x=>/enable/.test(x.url))); assert.equal(r.store.JD_CHECKIN_TEST_ACCOUNT_V1,JSON.stringify(account));
  });
  await test('new account creates one environment variable', async () => {
    const r=await run({action:'同步京东凭据'},{JD_CHECKIN_TEST_ACCOUNT_V1:JSON.stringify(account)},(method,path,o)=>{
      if(method==='post'){const b=JSON.parse(o.body);assert.equal(b.length,1);assert.equal(b[0].name,'JD_COOKIE');return [];}
    });assert.equal(r.result.status,'success');assert.equal(r.calls.filter(x=>x.method==='post').length,1);
  });
  await test('duplicate same-account variables stop all mutations', async () => {
    const r=await run({action:'同步京东凭据'},{JD_CHECKIN_TEST_ACCOUNT_V1:JSON.stringify(account)},(method,path)=>{
      if(path==='/envs')return [1,2].map(id=>({id,name:'JD_COOKIE',value:'pt_key=OLD_KEY;pt_pin=TEST_PIN;'}));
    }); assert.equal(r.result.status,'failed');assert(r.calls.every(x=>x.method==='get'));
  });
  await test('ambiguous write failure is not retried', async () => {
    const r=await run({action:'同步京东凭据'},{JD_CHECKIN_TEST_ACCOUNT_V1:JSON.stringify(account)},(method)=>method==='post'?{error:'TEST_SECRET network error'}:undefined);
    assert.equal(r.result.status,'failed');assert.equal(r.calls.filter(x=>x.method==='post').length,1);assert.equal(JSON.parse(r.store.QL_BRIDGE_LOCK_V1),null);
  });
  await test('capture stays local and ignores another account', async () => {
    const context={$request:{url:'https://api.m.jd.com/client.action?functionId=logConfig',method:'POST',headers:{Cookie:'pt_key=LOCAL_KEY;pt_pin=TEST_PIN;'}},$response:{status:200,body:'{"code":"0"}'}};
    let r=await run({}, {}, undefined, context);assert.equal(r.calls.length,0);assert.equal(JSON.parse(r.store.QL_BRIDGE_CREDENTIAL_V1).pin,'TEST_PIN');
    r=await run({}, {QL_BRIDGE_ACCOUNT_V1:JSON.stringify({pin:'BOUND_OTHER'})}, undefined,context);assert.equal(r.calls.length,0);assert(!r.store.QL_BRIDGE_CREDENTIAL_V1);
  });
  await test('disabled, running or queued tasks are not triggered', async () => {
    for(const task of [{id:7,isDisabled:1,status:1},{id:7,isDisabled:0,status:0},{id:7,isDisabled:0,status:3},{id:7,isDisabled:0,status:2}]){
      const r=await run({action:'执行指定任务',taskIds:'7'}, {}, (method,path)=>path==='/crons'?{data:[task],total:1}:undefined);
      assert.equal(r.result.status,'failed');assert(r.calls.every(x=>x.method==='get'));
    }
  });
  await test('only specified existing idle task is triggered, never reports reward', async () => {
    const r=await run({action:'执行指定任务',taskIds:'7'}, {}, (method,path,o)=>{
      if(path==='/crons')return {data:[{id:7,name:'Test',isDisabled:0,status:1},{id:8,name:'Other',status:1}],total:2};
      if(path==='/crons/run'){assert.equal(method,'put');assert.deepEqual(JSON.parse(o.body),[7]);return null;}
    });assert.equal(r.result.status,'success');assert.equal(r.calls.filter(x=>x.method==='put').length,1);assert(r.result.message.includes('已接收'));
  });
  await test('automatic sync never starts activity tasks; unchanged failure is quiet', async () => {
    const r=await run({autoSync:true},{JD_CHECKIN_TEST_ACCOUNT_V1:JSON.stringify(account)});
    assert.equal(r.result.status,'success');assert(!r.calls.some(x=>x.url.includes('/crons')));
    const a=await run({autoSync:true}, {}, ()=>({error:'offline'}));
    const b=await run({autoSync:true},a.store,()=>({error:'offline'}));assert.equal(b.notices.length,0);
  });
  await test('concurrent sync does not clear another run lock',async()=>{
    const lock={time:Date.now(),owner:'other'};
    const r=await run({action:'同步京东凭据'},{QL_BRIDGE_LOCK_V1:JSON.stringify(lock)});
    assert.equal(r.calls.length,0);assert.equal(r.store.QL_BRIDGE_LOCK_V1,JSON.stringify(lock));
  });
  await test('activity sync exports only the selected profiles and sends no activity requests',async()=>{
    const activity=JSON.parse(JSON.stringify(account));
    activity.modes.scratch.query={params:{functionId:'bff_rightsCenter_jdInteractTask',body:'{}',h5st:'OLD_KEY'}};
    activity.modes.scratch.capturedAt=100;
    activity.modes.blindbox={headers:{Cookie:'pt_key=NEW_KEY;pt_pin=TEST_PIN;'},capturedAt:200,query:{params:{functionId:'bff_marketing_interaction'}}};
    activity.modes.daily.query={params:{privateUnused:'DO_NOT_EXPORT'}};
    const jx={pin:'TEST_PIN',headers:{Cookie:'pt_key=OLD_KEY;pt_pin=TEST_PIN;'},capturedAt:1,query:{params:{functionId:'jxzy_active_querySign'}},signing:{environment:'PRIVATE_ENV'}};
    const r=await run({action:'同步活动凭据'}, {JD_CHECKIN_TEST_ACCOUNT_V1:JSON.stringify(activity),JXZY_CHECKIN_ACCOUNT_V1:JSON.stringify(jx)},(method,path,o)=>{
      if(method==='post'){
        const item=JSON.parse(o.body)[0];
        if(item.name==='LAZING_JD_ACTIVITY_V1'){
          const value=JSON.parse(item.value);assert.equal(value.version,1);assert.equal(value.pin,'TEST_PIN');
          assert.deepEqual(Object.keys(value.activities),['scratch','blindbox','jxzy']);assert(!item.value.includes('DO_NOT_EXPORT'));
          assert.equal(value.activities.scratch.query.params.h5st,undefined);assert.equal(value.activities.jxzy.signing.environment,'PRIVATE_ENV');
        }
      }
    });
    assert.equal(r.result.status,'success');assert.equal(r.calls.filter(x=>x.method==='post').length,2);assert(!r.calls.some(x=>x.url.includes('/crons')));
    assert(!r.logs.join('\n').includes('PRIVATE_ENV'));
  });
  await test('mixed activity accounts fail before any networking',async()=>{
    const a=JSON.parse(JSON.stringify(account));a.modes.scratch.query={params:{}};
    const r=await run({action:'同步活动凭据'},{JD_CHECKIN_TEST_ACCOUNT_V1:JSON.stringify(a),JXZY_CHECKIN_ACCOUNT_V1:JSON.stringify({pin:'OTHER',headers:{Cookie:'pt_key=OTHER;pt_pin=OTHER;'},query:{params:{}}})});
    assert.equal(r.result.status,'failed');assert.equal(r.calls.length,0);
  });
  const plantFixture=()=>({version:1,pin:'TEST_PIN',linkId:'4HcenxuZM4XiHesOb1HG4g',uuid:'TEST_UUID',clientVersion:'16.1.30',ready:true,capturedAt:300,updatedAt:300,
    headers:{Cookie:'pt_key=NEW_KEY;pt_pin=TEST_PIN;','User-Agent':'TEST_UA'},templates:{apStartTaskTime:{endpoint:'https://api.m.jd.com/api',capturedAt:300,
      headers:{Cookie:'pt_key=NEW_KEY;pt_pin=TEST_PIN;','User-Agent':'TEST_UA'},params:{appid:'activity_platform_se','wg-sdk-token':'PRIVATE_PLANT_TOKEN',uuid:'TEST_UUID',body:'PRIVATE_TASK',h5st:'OLD_SIGNATURE',t:'123'},
      referenceEnvironmentEncoded:'PRIVATE_PLANT_ENV',signatureParameterEncoding:'TEST_STK',signatureAppId:'acb1e',environmentVersion:'h5_file_v5.3.6',privateUnused:'DO_NOT_EXPORT'}}});
  await test('plant-only capture exports native context without task bodies or old signatures',async()=>{
    let exported;
    const r=await run({action:'同步活动凭据'},{JD_PLANT_TASK_CONTEXT_V1:JSON.stringify(plantFixture())},(method,path,o)=>{
      if(method==='post'){
        const item=JSON.parse(o.body)[0];
        if(item.name==='JD_COOKIE')assert.equal(item.value,'pt_key=NEW_KEY;pt_pin=TEST_PIN;');
        if(item.name==='LAZING_JD_ACTIVITY_V1')exported=JSON.parse(item.value);
      }
    });
    assert.equal(r.result.status,'success');assert(r.result.activities.includes('种豆任务上下文'));
    const t=exported.activities.plantTasks.templates.apStartTaskTime;
    assert.equal(t.params['wg-sdk-token'],'PRIVATE_PLANT_TOKEN');assert.equal(t.referenceEnvironmentEncoded,'PRIVATE_PLANT_ENV');
    for(const k of ['body','h5st','t'])assert.equal(t.params[k],undefined);assert.equal(t.privateUnused,undefined);
    assert.equal(r.calls.filter(x=>x.method==='post').length,2);assert(r.calls.every(x=>x.url.startsWith('http://192.168.1.100:5700/open/')));
    for(const s of ['PRIVATE_PLANT_TOKEN','PRIVATE_PLANT_ENV','PRIVATE_TASK','OLD_SIGNATURE'])assert(!JSON.stringify({logs:r.logs,notices:r.notices,result:r.result}).includes(s));
  });
  await test('partial plant context stays partial and rejects mixed account templates before upload',async()=>{
    const partial=plantFixture();partial.ready=false;
    let exported;
    let r=await run({action:'同步活动凭据'},{JD_PLANT_TASK_CONTEXT_V1:JSON.stringify(partial)},(method,path,o)=>{
      if(method==='post'){const item=JSON.parse(o.body)[0];if(item.name==='LAZING_JD_ACTIVITY_V1')exported=JSON.parse(item.value);}
    });
    assert.equal(r.result.status,'success');assert.equal(exported.activities.plantTasks.ready,false);
    for(const field of ['profile','template']){
      const p=plantFixture();if(field==='profile')p.pin='OTHER';else p.templates.apStartTaskTime.headers.Cookie='pt_key=OTHER;pt_pin=OTHER;';
      r=await run({action:'同步活动凭据'},{JD_CHECKIN_TEST_ACCOUNT_V1:JSON.stringify(account),JD_PLANT_TASK_CONTEXT_V1:JSON.stringify(p)});
      assert.equal(r.result.status,'failed');assert.equal(r.calls.length,0);
    }
  });
  await test('activity update preserves disabled state and unrelated labels, partial failure is explicit',async()=>{
    const a=JSON.parse(JSON.stringify(account));a.modes.scratch.query={params:{}};
    let r=await run({action:'同步活动凭据'},{JD_CHECKIN_TEST_ACCOUNT_V1:JSON.stringify(a)},(method,path,o)=>{
      if(method==='get'&&path==='/envs'&&o.url.includes('LAZING_JD_ACTIVITY_V1'))return [{id:22,name:'LAZING_JD_ACTIVITY_V1',status:1,labels:['keep'],remarks:'keep',value:JSON.stringify({version:1,pin:'TEST_PIN',activities:{blindbox:{query:{params:{}}}}})}];
      if(method==='put'){const b=JSON.parse(o.body);assert.equal(b.id,22);assert.equal(b.remarks,'keep');assert.deepEqual(b.labels,['keep']);assert(JSON.parse(b.value).activities.blindbox);}
    });assert.equal(r.result.status,'success');assert(r.result.message.includes('禁用'));assert(!r.calls.some(x=>x.url.includes('/enable')));
    r=await run({action:'同步活动凭据'},{JD_CHECKIN_TEST_ACCOUNT_V1:JSON.stringify(a)},(method,path,o)=>method==='post'&&o.body.includes('LAZING_JD_ACTIVITY_V1')?{error:'NEW_KEY'}:undefined);
    assert.equal(r.result.status,'failed');assert(r.result.message.includes('登录凭据已同步'));assert.equal(r.calls.filter(x=>x.method==='post').length,2);
  });
  await test('finance export keeps financial login, risk/page context and both attempt records',async()=>{
    const finance={pin:'TEST_PIN',ready:true,capturedAt:10,headers:{Cookie:'pt_key=FINANCE_KEY;pt_pin=TEST_PIN;','Content-Type':'application/x-www-form-urlencoded'},query:{site:'JD_JR_APP'},riskDeviceParam:'PRIVATE_RISK',scopeKey:'scope',riskScope:'scope',doubleSign:{pin:'TEST_PIN',headers:{'x-mlaas-at':'PRIVATE_DOUBLE_TOKEN'}}};
    const initial={JD_CHECKIN_TEST_ACCOUNT_V1:JSON.stringify(account),JD_JR_CHECKIN_ACCOUNT_V1:JSON.stringify(finance),
      JD_JR_CHECKIN_ATTEMPT_V1:JSON.stringify({pin:'TEST_PIN',date:'2026-10-15'}),JD_JR_DOUBLE_SIGN_ATTEMPT_V1:JSON.stringify({pin:'TEST_PIN',date:'2026-10-15'})};
    const r=await run({action:'同步活动凭据'},initial,(method,path,o)=>{
      if(method==='post'){
        const item=JSON.parse(o.body)[0];
        if(item.name==='JD_COOKIE')assert.equal(item.value,'pt_key=NEW_KEY;pt_pin=TEST_PIN;');
        if(item.name==='LAZING_JD_ACTIVITY_V1'){
          const p=JSON.parse(item.value);assert.deepEqual(p.activities.finance,finance);
          assert(p.attempts.finance);assert(p.attempts.financeDouble);
        }
      }
    });assert.equal(r.result.status,'success');assert(r.result.activities.includes('金融签到＋双签'));assert.equal(r.store.JD_JR_CHECKIN_ACCOUNT_V1,initial.JD_JR_CHECKIN_ACCOUNT_V1);
    for(const secret of ['FINANCE_KEY','PRIVATE_RISK','PRIVATE_DOUBLE_TOKEN'])assert(!JSON.stringify({logs:r.logs,notices:r.notices}).includes(secret));
  });
  await test('wrong finance or double account stops before any upload',async()=>{
    for(const finance of [
      {pin:'OTHER',ready:true,headers:{Cookie:'pt_key=OTHER;pt_pin=OTHER;'},query:{site:'H5'},riskDeviceParam:'risk'},
      {pin:'TEST_PIN',ready:true,headers:{Cookie:'pt_key=OTHER;pt_pin=TEST_PIN;'},query:{site:'H5'},riskDeviceParam:'risk',doubleSign:{pin:'OTHER'}}
    ]){
      const r=await run({action:'同步活动凭据'},{JD_CHECKIN_TEST_ACCOUNT_V1:JSON.stringify(account),JD_JR_CHECKIN_ACCOUNT_V1:JSON.stringify(finance)});
      assert.equal(r.result.status,'failed');assert.equal(r.calls.length,0);
    }
  });
  console.log(checks+' offline checks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
