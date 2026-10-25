const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const local=fs.existsSync(path.join(__dirname,'jd-splash.js'));
const script=fs.readFileSync(local?path.join(__dirname,'jd-splash.js'):path.join(__dirname,'../Scripts/jd-splash.js'),'utf8');
const plugin=fs.readFileSync(local?path.join(__dirname,'jd_open.plugin'):path.join(__dirname,'../Plugins/jd_open.plugin'),'utf8');
const KEY='LAZING_JD_SPLASH_DIAG_V1', APIS=['start','basicConfig','welcomeHome','searchBoxWord'];
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name);}
function run(body,options={}){
 const store=options.store||{},notices=[],logs=[];let out,done=0,writes=0;
 const sandbox={$argument:options.action,console:{log:x=>logs.push(x)},
  $persistentStore:{read:k=>{assert.equal(k,KEY);if(options.failRead)throw Error('read');return store[k]||null;},write:(v,k)=>{assert.equal(k,KEY);writes++;if(options.failWrite)throw Error('write');if(options.falseWrite)return false;store[k]=v;return true;}},
  $httpClient:{get:()=>{throw Error('forbidden network');},post:()=>{throw Error('forbidden network');}},
  $notification:{post:(...x)=>{if(options.failNotice)throw Error('disabled');notices.push(x);}},
  $done:x=>{out=JSON.parse(JSON.stringify(x));done++;}};
 if(!options.manual){sandbox.$request={url:options.url||'https://api.m.jd.com/client.action?functionId=start',body:options.requestBody,headers:{Cookie:'PRIVATE_COOKIE',Authorization:'PRIVATE_AUTH'}};
  if(!options.requestOnly)sandbox.$response={body,status:options.status??200,headers:{'Set-Cookie':'PRIVATE_RESPONSE_COOKIE'}};}
 vm.runInNewContext(script,sandbox,{timeout:2000});assert.equal(done,1);
 const state=store[KEY]?JSON.parse(store[KEY]):null;return {out,notices,logs,store,state,writes};
}
const material={groupId:'12345',url:'https://img1.360buyimg.com/private.png?token=PRIVATE_URL',videoUrl:'https://example.test/private.mp4',onlineTime:'2026-10-25 00:00:00',referralsTime:'2026-10-26 23:59:59',startTimeStamp:123,endTimeStamp:'456',maxShowTimes:8,nested:{onlineTime:'keep'}};
const response={code:'0',showTimesDaily:3,images:[[material]],other:{onlineTime:'keep'}};
const expired=m=>({...m,onlineTime:'2000-01-01 00:00:00',referralsTime:'2000-01-02 00:00:00'});
const sample=r=>r.state.apis.start.samples.at(-1);
check('original expiry behavior changes only confirmed date pair',()=>{const r=run(JSON.stringify(response));assert.deepEqual(JSON.parse(r.out.body),{...response,images:[[expired(material)]]});assert.equal(r.notices.length,1);assert.equal(sample(r).changed,1);});
check('snapshot records dates before expiry and ad group id',()=>{const s=sample(run(JSON.stringify(response)));assert(s.fields.some(f=>f.name==='onlineTime'&&f.value===material.onlineTime));assert(s.fields.some(f=>f.name==='groupId'&&f.value[0]==='12345'));});
check('nested array order and all unrelated response fields remain',()=>{const x={...response,images:[[material,null],[{...material,groupId:'67890'}]]};assert.deepEqual(JSON.parse(run(JSON.stringify(x)).out.body),{...x,images:[[expired(material),null],[expired({...material,groupId:'67890'})]]});});
check('flat material array',()=>assert.deepEqual(JSON.parse(run(JSON.stringify({...response,images:[material]})).out.body).images,[expired(material)]));
check('missing showTimesDaily still expires dates',()=>assert(run(JSON.stringify({code:0,images:[[material]]})).out.body));
check('already expired response logs and notifies hit without reserializing',()=>{const r=run(JSON.stringify({...response,images:[[expired(material)]]}));assert.deepEqual(r.out,{});assert.equal(r.notices.length,1);assert.equal(sample(r).changed,0);});
for(const [name,patch] of Object.entries({missingOnline:{onlineTime:undefined},missingEnd:{referralsTime:undefined},number:{onlineTime:123},null:{referralsTime:null},object:{onlineTime:{}},month:{onlineTime:'2026-13-01 00:00:00'},day:{onlineTime:'2026-02-30 00:00:00'},leap:{onlineTime:'2025-02-29 00:00:00'},hour:{onlineTime:'2026-10-25 24:00:00'},minute:{onlineTime:'2026-10-25 00:60:00'},second:{onlineTime:'2026-10-25 00:00:60'},iso:{onlineTime:'2026-10-25T00:00:00Z'},reversed:{onlineTime:'2027-01-01 00:00:00'}}))check('invalid date pair unchanged: '+name,()=>assert.deepEqual(run(JSON.stringify({...response,images:[{...material,...patch}]})).out,{}));
check('valid leap day',()=>assert(run(JSON.stringify({...response,images:[{...material,onlineTime:'2024-02-29 00:00:00'}]})).out.body));
check('unknown material wrappers unchanged',()=>assert.deepEqual(run(JSON.stringify({...response,images:[{wrapper:material}]})).out,{}));
check('too deep material arrays fail atomically',()=>{let deep=material;for(let i=0;i<5;i++)deep=[deep];assert.deepEqual(run(JSON.stringify({...response,images:[material,deep]})).out,{});});
for(const [name,b] of Object.entries({broken:'broken',null:'null',array:'[]',empty:JSON.stringify({...response,images:[]}),businessFailure:JSON.stringify({...response,code:1000})}))check('target diagnostic kept even without eligible dates: '+name,()=>{const r=run(b);assert.deepEqual(r.out,{});assert.equal(r.notices.length,1);assert.equal(r.state.apis.start.hits,1);});
check('oversized response saves metadata only',()=>{const r=run(JSON.stringify({...response,pad:'x'.repeat(2*1024*1024)}));assert.deepEqual(r.out,{});assert.deepEqual(sample(r).fields,[]);assert(sample(r).result.includes('2MB'));});
for(const status of [304,403,500])check('HTTP '+status+' recorded and original body untouched',()=>{const r=run(JSON.stringify(response),{status});assert.deepEqual(r.out,{});assert.equal(sample(r).httpStatus,status);});
for(const api of APIS.slice(1))check(api+' observed without changing response',()=>{const r=run(JSON.stringify({...response,expireAds:'12345,67890',appConfig:{extSwitch:'{"degradeSplashAD":"0","otherSwitch":true}'}}),{url:'https://api.m.jd.com/client.action?functionId='+api});assert.deepEqual(r.out,{});const s=r.state.apis[api].samples[0];assert(s.fields.some(f=>f.name==='degradeSplashAD'&&f.value==='0'));assert(s.fields.some(f=>f.name==='expireAds'));assert.equal(r.notices.length,1);});
check('double nested JSON config strings inspected',()=>{const r=run(JSON.stringify({data:{'JDApp-home':JSON.stringify({extSwitch:JSON.stringify({degradeSplashAD:'1'})})}}),{url:'https://api.m.jd.com/client.action?functionId=basicConfig'});assert(r.state.apis.basicConfig.samples[0].fields.some(f=>f.name==='degradeSplashAD'&&f.value==='1'));});
for(const body of ['functionId=basicConfig&body=%7B%7D',JSON.stringify({functionId:'basicConfig',cookie:'PRIVATE_BODY_COOKIE'})])check('body-only functionId supported: '+body[0],()=>{const r=run('{"code":0}',{url:'https://api.m.jd.com/client.action',requestBody:body});assert.equal(r.state.apis.basicConfig.hits,1);});
check('api route and extra query arguments supported',()=>{const r=run('{"code":0}',{url:'https://api.m.jd.com/api?appid=x&functionId=searchBoxWord&t=123'});assert.equal(r.state.apis.searchBoxWord.hits,1);});
for(const fid of ['startup','logConfig','apTaskList','queryPagePopWindow','getPageConfig'])check('non-target '+fid+' causes no writes or notification',()=>{const r=run(JSON.stringify(response),{url:'https://api.m.jd.com/client.action?functionId='+fid});assert.deepEqual(r.out,{});assert.equal(r.writes,0);assert.equal(r.notices.length,0);});
check('does not discover functionId inside another query value',()=>assert.equal(run(JSON.stringify(response),{url:'https://api.m.jd.com/client.action?body=functionId=start'}).writes,0));
check('query functionId wins over request body',()=>assert.equal(run('{}',{url:'https://api.m.jd.com/client.action?functionId=startup',requestBody:'functionId=start'}).writes,0));
check('conflicting repeated URL functionIds ignored',()=>assert.equal(run('{}',{url:'https://api.m.jd.com/client.action?functionId=start&functionId=basicConfig'}).writes,0));
check('unrelated host and endpoint ignored',()=>{for(const url of ['https://evil.test/client.action?functionId=start','https://api.m.jd.com/other?functionId=start','https://api.m.jd.com/client.action.more?functionId=start'])assert.equal(run('{}',{url}).writes,0);});
check('request-only event records counts without changing request or notifying twice',()=>{const r=run(undefined,{requestOnly:true,url:'https://api.m.jd.com/client.action',requestBody:'functionId=basicConfig'});assert.deepEqual(r.out,{});assert.equal(r.state.apis.basicConfig.requests,1);assert.equal(r.state.apis.basicConfig.hits,0);assert.equal(r.notices.length,0);});
check('request and response counts remain separate',()=>{const a=run(undefined,{requestOnly:true});const b=run(JSON.stringify(response),{store:a.store});assert.equal(b.state.apis.start.requests,1);assert.equal(b.state.apis.start.hits,1);});
check('retain latest three samples per interface',()=>{const store={};for(let i=0;i<8;i++)run(JSON.stringify({code:0,requestStartMins:i}),{store});const r=run('{}',{url:'https://api.m.jd.com/client.action?functionId=basicConfig',store});assert.equal(r.state.apis.start.hits,8);assert.equal(r.state.apis.start.samples.length,3);assert.equal(r.state.apis.basicConfig.samples.length,1);});
check('credentials, account values, URLs and unknown values absent from persistence and export',()=>{
 const secrets=['PRIVATE_COOKIE','PRIVATE_AUTH','PRIVATE_RESPONSE_COOKIE','PRIVATE_URL','PRIVATE_TOP_SECRET','PRIVATE_NESTED_SECRET','PRIVATE_BODY_COOKIE'];
 const doc={...response,cookie:'PRIVATE_TOP_SECRET',token:'PRIVATE_TOP_SECRET',uuid:'PRIVATE_TOP_SECRET',sign:'PRIVATE_TOP_SECRET',user:{phone:'PRIVATE_NESTED_SECRET',nickname:'PRIVATE_NESTED_SECRET'},appConfig:{extSwitch:JSON.stringify({degradeSplashAD:'0',token:'PRIVATE_NESTED_SECRET',otherValue:'PRIVATE_NESTED_SECRET'})}};
 const r=run(JSON.stringify(doc),{requestBody:'functionId=start&cookie=PRIVATE_BODY_COOKIE'}), exp=run(undefined,{manual:true,store:r.store});
 const all=JSON.stringify(r.store)+exp.logs.join('\n')+JSON.stringify(r.notices);for(const s of secrets)assert(!all.includes(s),s);assert(!all.includes('https://'));assert(sample(r).fields.some(f=>f.name==='groupId'));
});
check('unrecognized switch values recorded as type only',()=>{const r=run('{"degradeSplashAD":"PRIVATE_NESTED_SECRET"}');assert(!JSON.stringify(r.store).includes('PRIVATE_NESTED_SECRET'));assert.equal(sample(r).fields[0].value.type,'string');});
check('notification failure does not break expiry or saving',()=>{const r=run(JSON.stringify(response),{failNotice:true});assert(r.out.body);assert(r.state);});
for(const o of [{failWrite:true},{falseWrite:true}])check('storage failure is reported, expiry still works: '+JSON.stringify(o),()=>{const r=run(JSON.stringify(response),o);assert(r.out.body);assert(r.notices[0].join(' ').includes('保存失败'));});
check('corrupt persistent data resets safely',()=>{const r=run('{}',{store:{[KEY]:'bad'}});assert.equal(r.state.apis.start.hits,1);});
check('manual export emits complete JSON for sharing',()=>{const r=run(JSON.stringify(response));const ex=run(undefined,{manual:true,store:r.store});assert.deepEqual(JSON.parse(ex.logs.at(-1)),r.state);assert.deepEqual(ex.out,{});assert(ex.notices[0].join(' ').includes('分享本次运行日志'));});
check('manual reset clears all data',()=>{const r=run('{}');const ex=run(undefined,{manual:true,action:'reset',store:r.store});assert.deepEqual(ex.state,{version:1,apis:{}});});
check('huge config remains within storage budget, traversal is marked limited',()=>{const many=Array.from({length:500},(_,i)=>({expireAds:Array.from({length:80},(_,j)=>String(i*100+j)),unknown:'PRIVATE_NESTED_SECRET'}));const r=run(JSON.stringify({data:many}),{url:'https://api.m.jd.com/client.action?functionId=basicConfig'});assert(r.store[KEY].length<192*1024);assert(r.state.apis.basicConfig.samples[0].limited);});
check('plugin has bounded API rules plus export and reset, no DNS changes',()=>{
 const rows=plugin.split('\n').filter(x=>/^(request|response) if/.test(x));assert.equal(rows.length,2);
 for(const row of rows){const raw=row.split(' ~= /')[1].split('/i then')[0];const re=new RegExp(raw,'i');assert(re.test('https://api.m.jd.com/client.action'));assert(re.test('https://api.m.jd.com/api?functionId=basicConfig'));assert(!re.test('https://evil.test/client.action'));assert(!re.test('https://api.m.jd.com/client.action.extra'));assert(row.includes('requires_body=true'));}
 assert.equal((plugin.match(/^generic then/gm)||[]).length,2);assert(!/\[Rule\]|REJECT|\[Argument\]/.test(plugin));assert(plugin.includes('hostname = api.m.jd.com'));
});
check('script has no dynamic loading or outgoing requests',()=>assert(!/\beval\s*\(|new Function|\$httpClient\.|\$task\.|fetch\s*\(/.test(script)));
console.log(checks+' checks passed; synthetic input only, no live JD requests.');
