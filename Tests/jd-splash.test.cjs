// Offline checks of the exact release script. No network or real user credentials.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const local=fs.existsSync(path.join(__dirname,'jd-splash.js')),root=local?__dirname:path.join(__dirname,'..');
const source=fs.readFileSync(local?path.join(root,'jd-splash.js'):path.join(root,'Scripts/jd-splash.js'),'utf8');
const plugin=fs.readFileSync(local?path.join(root,'jd_open.plugin'):path.join(root,'Plugins/jd_open.plugin'),'utf8');
const KEY='LAZING_JD_SPLASH_DIAG_V1',tests=[];const test=(n,f)=>tests.push([n,f]);let total=0;
async function run(body,o={}){
 const store=o.store||{},notes=[],logs=[];let done=0,out,network=0,reads=0,writes=0,bodyReads=0;
 const ctx={console:{log:x=>logs.push(String(x))},$argument:o.action,$script:{startTime:new Date().toISOString()},setTimeout,clearTimeout,
 $persistentStore:{read:k=>{reads++;if(o.failRead)throw Error('read');return store[k]||null;},write:(v,k)=>{writes++;if(o.failWrite)throw Error('write');if(o.falseWrite)return false;store[k]=v;return true;}},
 $notification:{post:(...a)=>{if(o.failNotice)throw Error('disabled');notes.push(a);}},$httpClient:{get:()=>{network++;throw Error('network forbidden');},post:()=>{network++;throw Error('network forbidden');}},
 $done:r=>{out=r;done++;}};
 if(!o.manual){ctx.$request={method:o.method||'POST',url:o.url||'https://api.m.jd.com/client.action?functionId=start',body:o.requestBody,headers:o.headers||{Cookie:'PRIVATE_COOKIE',Authorization:'PRIVATE_AUTH'}};if(!o.requestOnly)ctx.$response={status:o.status??200,headers:o.responseHeaders||{'Content-Type':'application/json','Set-Cookie':'PRIVATE_SET_COOKIE'},body};}
 if(o.forbidBody&&ctx.$response)Object.defineProperty(ctx.$response,'body',{get:()=>{bodyReads++;throw Error('image body must not be read');}});
 if(o.omitArgument)delete ctx.$argument;
 vm.runInNewContext(source,ctx,{timeout:3000});for(let i=0;i<30&&!done;i++)await new Promise(r=>setTimeout(r,1));assert.equal(done,1);assert.equal(network,0);
 return {out,notes,logs,store,reads,writes,bodyReads,state:store[KEY]?JSON.parse(store[KEY]):null};
}
const plain=o=>JSON.parse(JSON.stringify(o));
const m={groupId:'80649388029',url:'https://img1.360buyimg.com/cc/jfs/a/0258465984d99479.jpg?token=PRIVATE_URL',videoUrl:'https://storage.360buyimg.com/material-video/video/abc123abc123abc1.mp4?auth=PRIVATE_VIDEO',buttonImg:'https://m.360buyimg.com/a/1111111111111111.png',onlineTime:'2026-10-25 00:00:00',referralsTime:'2026-10-26 23:59:59',other:'keep'};
const doc={code:0,images:[[m]],showTimesDaily:4,other:{value:'keep'}};
const expired=x=>({...x,onlineTime:'2000-01-01 00:00:00',referralsTime:'2000-01-02 00:00:00'});
const png=(w,h)=>{const b=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(b);b.write('IHDR',12);b.writeUInt32BE(w,16);b.writeUInt32BE(h,20);return new Uint8Array(b);};
const imageOpts=(patch={})=>({action:'assets',method:'GET',url:'https://m.360buyimg.com/mobilecms/jfs/9876543210abcdef.jpg.avif',responseHeaders:{'Content-Type':'image/avif','Content-Length':'999','ETag':'old','Content-Encoding':'gzip'},...patch});
test('date expiry changes only eligible dates',async()=>{const r=await run(JSON.stringify(doc));assert.deepEqual(JSON.parse(r.out.body),{...doc,images:[[expired(m)]]});assert.equal(r.notes.length,1);assert(r.notes[0][1].includes('配置已修改'));});
test('API handler also works when Loon omits the argument global',async()=>assert((await run(JSON.stringify(doc),{omitArgument:true})).out.body));
test('group id linked with sanitized primary and auxiliary resource paths',async()=>{const r=await run(JSON.stringify(doc));const x=r.state.apis.start.samples[0].materials[0];assert.equal(x.groupId,m.groupId);assert.equal(x.resources.length,3);assert(x.resources.every(y=>!y.url.includes('?')));assert(r.state.materials.some(x=>x.kind==='auxiliary'));assert(!JSON.stringify(r.state).includes('PRIVATE_URL'));});
test('missing dates still learns exact start material, without inventing expiry',async()=>{const r=await run(JSON.stringify({code:0,images:[{groupId:'12345',url:m.url}]}));assert(!r.out.body);assert.equal(r.state.materials[0].groupId,'12345');assert.equal(r.notes.length,1);assert.equal(r.notes[0][1],'start 已命中');});
test('already expired start notifies hit without reserialization',async()=>{const r=await run(JSON.stringify({...doc,images:[[expired(m)]]}));assert.deepEqual(plain(r.out),{});assert.equal(r.notes.length,1);assert.equal(r.notes[0][1],'start 已命中');});
for(const [label,patch]of Object.entries({missing:{onlineTime:undefined},invalid:{onlineTime:'2026-02-30 00:00:00'},reversed:{onlineTime:'2027-01-01 00:00:00'},number:{referralsTime:123},iso:{onlineTime:'2026-01-01T00:00:00Z'},hour:{onlineTime:'2026-01-01 24:00:00'},leap:{onlineTime:'2025-02-29 00:00:00'}}))test('invalid dates preserved: '+label,async()=>assert.deepEqual(plain((await run(JSON.stringify({...doc,images:[{...m,...patch}]}))).out),{}));
test('valid leap day date is accepted',async()=>assert((await run(JSON.stringify({...doc,images:[{...m,onlineTime:'2024-02-29 00:00:00'}]}))).out.body));
test('deep arrays do not partially modify response',async()=>{let a=m;for(let i=0;i<5;i++)a=[a];assert.deepEqual(plain((await run(JSON.stringify({...doc,images:[m,a]}))).out),{});});
test('unknown wrapper is not rewritten',async()=>assert.deepEqual(plain((await run(JSON.stringify({...doc,images:[{wrapper:m}]}))).out),{}));
for(const b of ['bad','null','[]',JSON.stringify({code:0,images:[]})])test('start hit notifies even without modification: '+b.slice(0,12),async()=>{const r=await run(b);assert.deepEqual(plain(r.out),{});assert.equal(r.notes.length,1);assert.equal(r.notes[0][1],'start 已命中');assert.equal(r.state.apis.start.hits,1);});
for(const status of [304,403,500])test('HTTP '+status+' does not change configuration',async()=>assert.deepEqual(plain((await run(JSON.stringify(doc),{status})).out),{}));
for(const api of ['basicConfig','welcomeHome','searchBoxWord'])test('ignores '+api,async()=>{
 const r=await run(JSON.stringify(doc),{url:'https://api.m.jd.com/api?functionId='+api,forbidBody:true});
 assert.deepEqual(plain(r.out),{});assert.equal(r.bodyReads,0);assert.equal(r.reads,0);assert.equal(r.writes,0);assert.equal(r.notes.length,0);
});
test('opaque switch values are not copied',async()=>{const r=await run('{"degradeSplashAD":"PRIVATE_OPAQUE"}');assert(!JSON.stringify(r.state).includes('PRIVATE_OPAQUE'));});
test('oversized config preserves response and marks not scanned',async()=>{const r=await run(JSON.stringify({pad:'x'.repeat(2*1024*1024)}));assert(!r.out.body);assert(r.state.apis.start.samples[0].result.includes('未扫描'));});
for(const requestBody of ['functionId=start&body=%7B%7D',JSON.stringify({functionId:'start'})])test('ignores start in POST body only',async()=>{
 const r=await run(JSON.stringify(doc),{url:'https://api.m.jd.com/client.action',requestBody,forbidBody:true});
 assert(!r.state);assert.deepEqual(plain(r.out),{});assert.equal(r.bodyReads,0);assert.equal(r.writes,0);
});
test('URL non-target API is never overridden by body-only start',async()=>{const r=await run('{}',{url:'https://api.m.jd.com/api?functionId=logConfig',requestBody:'functionId=start'});assert(!r.state);});
test('duplicate and embedded functionIds do not hijack diagnostics',async()=>{for(const url of ['https://api.m.jd.com/api?functionId=start&functionId=basicConfig','https://api.m.jd.com/api?body=functionId=start','https://evil.test/api?functionId=start'])assert(!(await run('{}',{url})).state);});
test('request and response counts remain independent and request does not notify',async()=>{const a=await run(undefined,{requestOnly:true,requestBody:'functionId=start'});assert.equal(a.notes.length,0);const b=await run(JSON.stringify(doc),{store:a.store});assert.equal(b.state.apis.start.requests,1);assert.equal(b.state.apis.start.hits,1);});
test('legacy diagnostic buckets survive migration',async()=>{const store={[KEY]:JSON.stringify({version:1,apis:{start:{hits:4,requests:4,lastRequestAt:1,samples:[]}}})};const r=await run(JSON.stringify({code:0,images:[]}),{store});assert.equal(r.state.apis.start.hits,5);assert.equal(r.state.materials.length,0);});
test('legacy incomplete negative result is relabeled when exported',async()=>{const store={[KEY]:JSON.stringify({version:1,apis:{basicConfig:{hits:1,requests:1,samples:[{limited:true,result:'收到JSON，本条没有开屏字段',fields:[],structure:[]}]}}})};const r=await run(undefined,{manual:true,store});assert(r.logs.join('').includes('旧版扫描未完成'));assert(!r.logs.join('').includes('本条没有开屏字段'));});
test('recent response samples bounded to three',async()=>{const store={};for(let i=0;i<6;i++)await run('{"code":0}',{store});assert.equal(JSON.parse(store[KEY]).apis.start.samples.length,3);});
for(const url of ['https://m.360buyimg.com/mobilecms/jfs/plain.jpg','https://m.360buyimg.com/mobilecms/s1125x2436_jfs/plain.jpg','https://m.360buyimg.com/other/plain.jpg'])test('retired image entry never reads body or store: '+url,async()=>{
 const r=await run(png(1125,2436),imageOpts({url,forbidBody:true}));assert.deepEqual(plain(r.out),{});assert.equal(r.bodyReads,0);assert.equal(r.reads,0);assert.equal(r.writes,0);assert.equal(r.notes.length,0);
});
test('unsized URL passes even when actual pixels match an ad size',async()=>{const r=await run(png(1125,2436),imageOpts());assert.deepEqual(plain(r.out),{});assert.equal(r.notes.length,0);assert.equal(r.reads,0);assert.equal(r.writes,0);});
const rewrites=plugin.split('[Rewrite]')[1].split('[Mitm]')[0].split('\n').filter(l=>l.startsWith('^')).map(l=>new RegExp(l.split(' ')[0]));
test('URL size images reject before body, regardless of suffix or query',()=>{for(const size of ['1125x2436','1125x1602'])for(const suffix of ['jpg','png.qpng','jpg.avif','webp?x=1'])assert(rewrites[0].test('https://m.360buyimg.com/mobilecms/s'+size+'_jfs/test.'+suffix));});
test('URL rewrite does not cover unrelated hosts paths or other sizes',()=>{for(const u of ['https://m11.360buyimg.com/mobilecms/s1125x2436_jfs/a.jpg','https://m.360buyimg.com/product/s1125x2436_jfs/a.jpg','https://m.360buyimg.com/mobilecms/s800x800_jfs/a.jpg','https://m.360buyimg.com/mobilecms/jfs/a.jpg','https://m.360buyimg.com/mobilecms/jfs/a.jpg?size=1125x2436'])assert(!rewrites[0].test(u));});
test('original MP4 directory silently rejects including query strings',()=>{assert(rewrites[1].test('https://storage.360buyimg.com/material-video/video/example.mp4'));assert(rewrites[1].test('https://storage.360buyimg.com/material-video/video/example.mp4?a=1'));for(const u of ['https://storage.360buyimg.com/product/video/example.mp4','https://vod.300hu.com/material-video/video/example.mp4','https://storage.360buyimg.com/material-video/video/example.mp4x'])assert(!rewrites[1].test(u));});
test('ordinary JD responses leave login and activity stores untouched',async()=>{
 const store={JD_SIGNIN_LOGIN_V1:'keep',JD_FARM_TASKS_ACCOUNT_V1:'keep'};
 for(const functionId of ['logConfig','bff_marketing_interaction','apTaskList','jxzy_active_task_queryTaskList','sh_c_query_task_list','bom_doInteractiveAssignment','checkInTaskList']){
  const r=await run('{"code":0}',{store,url:'https://api.m.jd.com/api?functionId='+functionId,forbidBody:true});
  assert.deepEqual(plain(r.out),{});assert.equal(r.bodyReads,0);assert.equal(r.reads,0);assert.equal(r.writes,0);
 }
 assert.deepEqual(store,{JD_SIGNIN_LOGIN_V1:'keep',JD_FARM_TASKS_ACCOUNT_V1:'keep'});
});
test('export includes no login secrets or resource query parameters',async()=>{const a=await run(JSON.stringify({...doc,cookie:'PRIVATE_TOP',token:'PRIVATE_TOP',appConfig:{extSwitch:'{"degradeSplashAD":"0","token":"PRIVATE_NESTED"}'}})),r=await run(undefined,{manual:true,action:'export',store:a.store});const s=r.logs.join('\n');for(const x of ['PRIVATE_TOP','PRIVATE_NESTED','PRIVATE_COOKIE','PRIVATE_AUTH','PRIVATE_URL','PRIVATE_VIDEO','PRIVATE_SET_COOKIE'])assert(!s.includes(x),x);assert(s.includes('80649388029'));assert(s.includes('0258465984d99479'));});
test('reset only touches dedicated diagnostic store',async()=>{const a=await run(JSON.stringify(doc));a.store.JD_SIGNIN_LOGIN_V1='keep';const r=await run(undefined,{manual:true,action:'reset',store:a.store});assert.equal(r.state.materials.length,0);assert.equal(Object.keys(r.state.apis).length,0);assert.equal(r.store.JD_SIGNIN_LOGIN_V1,'keep');});
for(const opt of [{failWrite:true},{falseWrite:true},{failNotice:true}])test('expiry survives storage/notification errors '+JSON.stringify(opt),async()=>assert((await run(JSON.stringify(doc),opt)).out.body));
test('corrupt store recovers without leaking original contents',async()=>{const r=await run('{"code":0}',{store:{[KEY]:'bad'}});assert.equal(r.state.apis.start.hits,1);});
test('only URL start is eligible to run either HTTP script',()=>{
 const entries=plugin.split('\n').filter(l=>/^(request|response) if /.test(l));
 assert.deepEqual(entries.map(l=>l.split(' ')[0]),['request','response']);
 assert.equal((plugin.match(/^generic then/gm)||[]).length,2);
 for(const line of entries){
  const pattern=line.match(/ ~= \/(.+)\/ then script/)[1];
  const guard=new RegExp(pattern);
  for(const url of ['https://api.m.jd.com/api?functionId=start','https://api.m.jd.com/client.action?foo=1&functionId=start&bar=2'])assert(guard.test(url),url);
  for(const url of ['https://api.m.jd.com/api','https://api.m.jd.com/api?functionId=apTaskList','https://api.m.jd.com/api?body=functionId=start',
    'https://api.m.jd.com/api?functionId=starter','https://api.m.jd.com/?functionId=checkInTaskList','https://ms.jr.jd.com/api?functionId=start'])assert(!guard.test(url),url);
 }
 assert(!source.includes('jdSplashCapture'));assert(!plugin.includes('凭据获取'));assert(!plugin.includes('binary_body_mode'));
});

(async()=>{for(const [n,f]of tests){await f();total++;console.log('PASS '+n);}console.log(total+' checks passed; no live JD requests.');})().catch(e=>{console.error(e);process.exitCode=1;});
