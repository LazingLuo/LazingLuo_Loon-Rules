// No account requests, cookies, remote code execution, or HTTP clients.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const base=__dirname;
const source=fs.readFileSync(path.join(base,fs.existsSync(path.join(base,'taobao-splash-notify.generated.js'))?'taobao-splash-notify.generated.js':'../Scripts/taobao-splash-notify.js'),'utf8');
const plugin=fs.readFileSync(path.join(base,fs.existsSync(path.join(base,'taobao-splash-notify.plugin'))?'taobao-splash-notify.plugin':'../Plugins/taobao-splash-notify.plugin'),'utf8');
const rules=JSON.parse(source.match(/const rules=([\s\S]*?);\n  let result/)[1]),KEY='TB_SPLASH_NOTIFY_STATS_V1';
const fixtures={
 'tao-splash':'https://acs.m.taobao.com/gw/mtop.etao.noah.query/1.0/?data=tao_splash',
 'home-splash':'https://guide-acs.m.taobao.com/gw/mtop.taobao.wireless.home.splash.awesome.get/1.0/?data=PRIVATE_PARAMETER',
 'heic-1':'https://heic.alicdn.com/imgextra/i1/TEST_!!123-0-tps-1125-2436.png_1125x2436q90.jpg_.heic',
 'heic-2':'https://heic.alicdn.com/imgextra/i1/TEST_!!123-0-tps-1125-2436.jpg_1125x2436q90.jpg_.heic',
 'heic-3':'https://heic.alicdn.com/imgextra/i1/1234/TEST_!!123-0-tps-1125-2436.jpg_1125x0q90',
 webp:'https://gw.alicdn.com/imgextra/i2/TEST_!!123-0-tps-720-1280.png_720x1280q90.webp'
};
const NOW=Date.parse('2026-10-21T05:42:00Z');
function run({url=fixtures['home-splash'],method='GET',argument={notify:true,assets:true},store=new Map(),now=NOW,notificationFails=false,storageFails=false,stats=false,response=false}={}){
 let output,done=0;const notes=[],logs=[],writes=[];
 function TestDate(...a){if(new.target)return new Date(...(a.length?a:[now]));return new Date(now).toString();}
 Object.setPrototypeOf(TestDate,Date);TestDate.prototype=Date.prototype;TestDate.now=()=>now;
 const context={Date:TestDate,$argument:stats?'stats':argument,$done:r=>{done++;output=r;},
  $notification:{post:(...a)=>{if(notificationFails)throw Error('disabled');notes.push(a);}},console:{log:s=>logs.push(s)},
  $persistentStore:{read:k=>{assert.equal(k,KEY);return store.get(k)||'';},write:(v,k)=>{assert.equal(k,KEY);writes.push(k);if(storageFails)return false;store.set(k,v);return true;}},
  $httpClient:{get:()=>{throw Error('No network permitted');},post:()=>{throw Error('No network permitted');}}
 };
 if(!stats){context.$request={url,method};Object.defineProperty(context.$request,'headers',{get:()=>{throw Error('Must not read cookies');}});Object.defineProperty(context.$request,'body',{get:()=>{throw Error('Must not read body');}});}
 if(response)context.$response={status:200,body:'PRIVATE_RESPONSE'};
 vm.runInNewContext(source,context,{timeout:2000});assert.equal(done,1);
 const diagnostics=JSON.stringify([...store])+JSON.stringify(notes)+JSON.stringify(logs);
 for(const secret of ['PRIVATE_PARAMETER','PRIVATE_RESPONSE','TEST_!!123','https://'])assert(!diagnostics.includes(secret),'private URL/content in diagnostics');
 return {output,notes,logs,store,writes,record:JSON.parse(store.get(KEY)||'null')};
}
let checks=0;
function blocked(options){const r=run(options);assert(r.output.response,'Fixture did not match: '+JSON.stringify(options)+'; '+r.logs.join(';'));assert.equal(r.output.response.status,200);assert.equal(r.output.response.body,'{}');assert.equal(r.output.response.headers['Cache-Control'],'no-store');return r;}
function untouched(options){const r=run(options);assert.equal(Object.keys(r.output).length,0);assert.equal(r.notes.length,0);assert.equal(r.writes.length,0);checks++;}
for(const [id,url] of Object.entries(fixtures)){
 const r=blocked({url});assert.equal(r.record.history[0].id,id);assert.equal(r.notes.length,1);assert(r.notes[0][2].includes('首次记录'));
 assert.equal(r.record.total,1);if(id.startsWith('heic')||id==='webp')assert(r.notes[0][1].includes('待核实'));else assert.equal(r.notes[0][1],'开屏接口已拦截');checks++;
}
for(const url of [fixtures['home-splash'].replace('.com/','.com:443/'),fixtures['heic-2'].replace('.com/','.com:443/'),fixtures.webp.replace('https:','http:').replace('.com/','.com:80/'),fixtures.webp.replace('.com/','.com:443/')]){blocked({url});checks++;}
for(const url of [
 fixtures['home-splash'].replace('guide-acs.m.taobao.com','guide-acs.m.taobao.com.evil.example'),
 fixtures['home-splash'].replace('https:','http:'),
 fixtures['home-splash'].replace('get/1.0/','getFake/1.0/'),
 fixtures['home-splash'].replace('.com/','.com:8443/'),
 fixtures['home-splash']+'#fragment',
 fixtures['tao-splash'].replace('tao_splash','other_scene'),
 'https://acs.m.taobao.com/gw/mtop.taobao.cloudvideo.video.query/1.0/',
 'https://acs.m.taobao.com/gw/mtop.taobao.shot.resources.load/1.0/',
 'https://acs.m.goofish.com/gw/mtop.taobao.idlecommerce.splash.ads/2.0/',
 'http://106.11.43.138:80/amdc/mobileDispatch?appkey=21380790',
 'https://heic.alicdn.com/imgextra/i1/ordinary-product.jpg',
 fixtures.webp.replace('720-1280','800-800'),
 fixtures.webp.replace('https:','http:').replace('.com/','.com:443/'),
 fixtures.webp.replace('.com/','.com:80/')
])untouched({url});
untouched({method:'DELETE'});untouched({url:fixtures['heic-1'],method:'POST'});untouched({response:true});
untouched({url:fixtures['heic-1'],argument:{assets:false}});
let r=blocked({argument:{notify:false}});assert.equal(r.notes.length,0);assert.equal(r.record.total,1);checks++;
r=blocked({argument:JSON.stringify({notify:'false',assets:'true'})});assert.equal(r.notes.length,0);checks++;
r=blocked({notificationFails:true});assert.equal(r.record.total,1);assert(r.logs.some(s=>s.includes('通知未发送')));checks++;
r=blocked({storageFails:true});assert.equal(r.record,null);assert(r.notes[0][2].includes('未保存'));checks++;
let store=new Map([[KEY,'{broken']]);r=blocked({store});assert.equal(r.record.total,1);checks++;
store=new Map();r=blocked({store});
for(const [time,expected]of [[NOW+90000,'1分30秒'],[NOW+3600000,'58分30秒'],[NOW+25*3600000,'1天0小时']]){r=blocked({store,now:time});assert(r.notes[0][2].includes(expected));checks++;}
assert.equal(r.record.total,4);assert.equal(r.record.today,1);checks++;
const before=store.get(KEY);r=run({store,stats:true,now:NOW+25*3600000});assert.equal(r.writes.length,0);assert.equal(store.get(KEY),before);assert(r.notes[0][2].includes('今日 1 次；累计 4 次'));checks++;
r=run({store,stats:true,now:NOW+49*3600000});assert(r.notes[0][2].includes('今日 0 次'));checks++;
r=run({stats:true});assert(r.notes[0][2].includes('暂无命中'));checks++;
store=new Map();for(let i=0;i<55;i++)r=blocked({store,now:NOW+i*1000});assert.equal(r.record.total,55);assert.equal(r.record.history.length,50);checks++;
r=blocked({store,now:NOW});assert(r.notes[0][2].includes('系统时间已调整'));checks++;
const pluginPatterns=[...plugin.matchAll(/^request if \$\{url\} ~= \/(.+)\/ then script/gm)].map(m=>new RegExp(m[1]));
assert.equal(pluginPatterns.length,6);for(const url of Object.values(fixtures))assert(pluginPatterns.some(p=>p.test(url)));
for(let i=0;i<rules.length;i++)assert.equal(pluginPatterns[i].source,new RegExp(rules[i].pattern).source);checks++;
assert(!/^cron |^network-changed|\[Rule\]|\[Rewrite\]/m.test(plugin));assert.equal((plugin.match(/^generic /gm)||[]).length,1);checks++;
assert(!/\$request\.(headers|body)|\$response\.body|\$httpClient|fetch\(|eval\(/.test(source));checks++;
console.log(checks+' offline checks passed: six source rules, request-only mocks, unrelated traffic unchanged, per-hit notices, intervals, daily totals, history cap, privacy and plugin-pattern parity. Phone effectiveness unverified.');
