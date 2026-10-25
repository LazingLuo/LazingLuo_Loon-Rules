const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const local=fs.existsSync(path.join(__dirname,'jd-splash.js'));
const script=fs.readFileSync(local?path.join(__dirname,'jd-splash.js'):path.join(__dirname,'../Scripts/jd-splash.js'),'utf8');
const plugin=fs.readFileSync(local?path.join(__dirname,'jd_open.plugin'):path.join(__dirname,'../Plugins/jd_open.plugin'),'utf8');
const bridge=fs.readFileSync(local?path.join(__dirname,'../loon-qinglong-bridge/qinglong-bridge.plugin'):path.join(__dirname,'../Plugins/qinglong-bridge.plugin'),'utf8');
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name);}
function run(body,options={}){
 let out,done=0,sideEffects=0;const notices=[],logs=[];
 const forbidden=()=>{sideEffects++;throw Error('unexpected side effect');};
 vm.runInNewContext(script,{$request:{url:options.url||'https://api.m.jd.com/client.action?functionId=start'},
  $response:{body,status:options.status??200},console:{log:x=>logs.push(x)},
  $persistentStore:{read:forbidden,write:forbidden},$httpClient:{get:forbidden,post:forbidden},
  $notification:{post:(...x)=>{if(options.failNotice)throw Error('disabled');notices.push(x);}},
  $done:x=>{out=JSON.parse(JSON.stringify(x));done++;}});
 assert.equal(done,1);assert.equal(sideEffects,0);return {out,notices,logs};
}
const material={url:'https://img1.360buyimg.com/test.jpg',videoUrl:'https://storage.360buyimg.com/test.mp4',onlineTime:'2026-10-25 00:00:00',referralsTime:'2026-10-26 23:59:59',startTimeStamp:123,endTimeStamp:'456',maxShowTimes:8,nested:{onlineTime:'keep'}};
const response={code:'0',showTimesDaily:3,images:[[material]],other:{onlineTime:'keep'}};
function expire(item){return {...item,onlineTime:'2000-01-01 00:00:00',referralsTime:'2000-01-02 00:00:00'};}
check('only two confirmed date fields change',()=>{const r=run(JSON.stringify(response));assert.deepEqual(JSON.parse(r.out.body),{...response,images:[[expire(material)]]});assert.equal(r.notices.length,1);});
check('complete nested groups retain item order and other fields',()=>{const x={...response,images:[[material,null],[{...material,groupId:'other'}]]};const r=run(JSON.stringify(x));assert.deepEqual(JSON.parse(r.out.body),{...x,images:[[expire(material),null],[expire({...material,groupId:'other'})]]});assert(r.notices[0].join(' ').includes('2 条'));});
check('flat material array is supported',()=>{const r=run(JSON.stringify({...response,images:[material]}));assert.deepEqual(JSON.parse(r.out.body).images,[expire(material)]);});
check('missing showTimesDaily does not block date handling',()=>{const r=run(JSON.stringify({code:0,images:[[material]]}));const d=JSON.parse(r.out.body);assert.equal(d.images[0][0].onlineTime,'2000-01-01 00:00:00');assert(!Object.hasOwn(d,'showTimesDaily'));});
check('already rewritten payload returns no replacement or repeated notification',()=>{const r=run(JSON.stringify({...response,images:[[expire(material)]]}));assert.deepEqual(r.out,{});assert.equal(r.notices.length,0);});
check('failed notification preserves response replacement',()=>{assert(run(JSON.stringify(response),{failNotice:true}).out.body);});
for(const [name,patch] of Object.entries({missingOnline:{onlineTime:undefined},missingEnd:{referralsTime:undefined},number:{onlineTime:123},null:{referralsTime:null},object:{onlineTime:{}},invalidMonth:{onlineTime:'2026-13-01 00:00:00'},invalidDay:{onlineTime:'2026-02-30 00:00:00'},invalidLeap:{onlineTime:'2025-02-29 00:00:00'},invalidHour:{onlineTime:'2026-10-25 24:00:00'},invalidMinute:{onlineTime:'2026-10-25 00:60:00'},invalidSecond:{onlineTime:'2026-10-25 00:00:60'},timezoneSuffix:{onlineTime:'2026-10-25T00:00:00Z'},reversed:{onlineTime:'2027-01-01 00:00:00'}})){
 check('unknown date unchanged: '+name,()=>{const r=run(JSON.stringify({...response,images:[{...material,...patch}]}));assert.deepEqual(r.out,{});assert.equal(r.notices.length,0);});
}
check('valid leap day supported',()=>{assert(run(JSON.stringify({...response,images:[{...material,onlineTime:'2024-02-29 00:00:00'}]})).out.body);});
check('unknown wrappers are not traversed',()=>{assert.deepEqual(run(JSON.stringify({...response,images:[{wrapper:material}]})).out,{});});
check('too deeply nested payload is returned unchanged atomically',()=>{let nested=material;for(let i=0;i<5;i++)nested=[nested];assert.deepEqual(run(JSON.stringify({...response,images:[material,nested]})).out,{});});
for(const [name,body] of Object.entries({bad:'broken',null:'null',array:'[]',empty:JSON.stringify({...response,images:[]}),unknown:JSON.stringify({code:0,data:response}),businessFailure:JSON.stringify({...response,code:1000})})){
 check('unrelated payload unchanged: '+name,()=>{const r=run(body);assert.deepEqual(r.out,{});assert.equal(r.notices.length,0);});
}
check('oversized payload is unchanged',()=>{assert.deepEqual(run(JSON.stringify({...response,pad:'x'.repeat(2*1024*1024)})).out,{});});
for(const fid of ['startup','logConfig','welcomeHome','apTaskList','findBeanSceneNew'])check('other API unchanged: '+fid,()=>{assert.deepEqual(run(JSON.stringify(response),{url:'https://api.m.jd.com/client.action?functionId='+fid}).out,{});});
check('non-success HTTP unchanged',()=>{for(const status of [403,500])assert.deepEqual(run(JSON.stringify(response),{status}).out,{});});
check('one rule exclusively matches start, no DNS or resource rules',()=>{
 const rows=plugin.split('\n').filter(x=>/^(request|response) if/.test(x));assert.equal(rows.length,1);
 const re=new RegExp(rows[0].split(' ~= /')[1].split('/i &&')[0],'i');
 assert(re.test('https://api.m.jd.com/client.action?x=1&functionId=start&y=2'));
 for(const url of ['https://api.m.jd.com/client.action?functionId=startup','https://api.m.jd.com/client.action?x=functionId=start','https://img1.360buyimg.com/ad.jpg'])assert(!re.test(url));
 assert(!/\[Rule\]|REJECT|HTTPDNS|360buyimg|\[Argument\]/.test(plugin));assert(plugin.includes('hostname = api.m.jd.com'));
});
check('credential capture remains separate from splash response handling',()=>{
 const row=bridge.split('\n').find(x=>x.startsWith('response if ')&&x.includes('api\\.m\\.jd'));
 assert(row,'JD credential rule missing');
 const capture=new RegExp(row.split(' ~= /')[1].split('/ && ')[0]);
 assert(!capture.test('https://api.m.jd.com/client.action?functionId=start'));
 for(const fid of ['startup','logConfig','bff_rightsCenter_jdInteractTask'])assert(capture.test('https://api.m.jd.com/client.action?functionId='+fid));
});
console.log(checks+' checks passed; no live JD requests.');
