// Offline fixtures only. No HTTP requests or personal HAR content.
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../Scripts/taobao-splash-notify.js'),'utf8');
const plugin=fs.readFileSync(path.join(__dirname,'../Plugins/taobao-splash-notify.plugin'),'utf8');
const rules=JSON.parse(source.match(/const rules=([\s\S]*?);\n  let result/)[1]);
const CONFIG='TB_SPLASH_NOTIFY_CONFIG_V1', BLOCK='TB_SPLASH_NOTIFY_STATS_V1';
const hosts=['acs.m.taobao.com','guide-acs.m.taobao.com','106.11.226.222','59.82.9.242','203.119.238.85','203.119.238.234'];
const api='mtop.taobao.wireless.home.splash.awesome.get';
const url=(host=hosts[0],name=api,route='gw')=>'https://'+host+'/'+route+'/'+name+'/1.0/?private=PRIVATE_PARAMETER';
const home=url(hosts[0],'mtop.taobao.wireless.home.newface.awesome.get');
const asset='https://heic.alicdn.com/imgextra/i1/TEST_!!123-0-tps-1125-1602.png_1125x1602q90.jpg_.heic';
const START=4070908800000, END=4102444800000;
const item=()=>({gmtStartMs:1790000000000,gmtEndMs:'1800000000000',imgUrl:'https://private.example/PRIVATE_MEDIA.jpg',keep:'PRIVATE_CONTENT'});
const doc=()=>({data:{containers:{splash_home_base:{base:{topViewSplashSection:{sections:[{items:[item()]}]}}}}},other:{gmtStartMs:123,gmtEndMs:456,imgUrl:'https://private.example/unrelated.jpg'}});
const section=d=>d.data.containers.splash_home_base.base.topViewSplashSection;
const count=r=>JSON.parse(r.store.get(CONFIG)||'{}');
let checks=0;
function check(name,fn){fn();checks++;}
function run({target=url(),body,method='GET',status=200,argument={notify:true,assets:true},store=new Map(),stats=false,storageFails=false,notificationFails=false,now=1793240000000}={}){
 let output,calls=0;const notes=[],logs=[];
 function FixedDate(...a){if(new.target)return new Date(...(a.length?a:[now]));return new Date(now).toString();}
 Object.setPrototypeOf(FixedDate,Date);FixedDate.prototype=Date.prototype;FixedDate.now=()=>now;
 const env={Date:FixedDate,$argument:stats?'stats':argument,$done:r=>{output=r;calls++;},console:{log:x=>logs.push(x)},
  $notification:{post:(...a)=>{if(notificationFails)throw Error('off');notes.push(a);}},
  $persistentStore:{read:k=>store.get(k)||'',write:(v,k)=>{if(storageFails)return false;store.set(k,v);return true;}}};
 if(!stats){env.$request={url:target,method};for(const p of ['headers','body'])Object.defineProperty(env.$request,p,{get(){throw Error('request data read');}});}
 if(body!==undefined)env.$response={status,body:typeof body==='string'?body:JSON.stringify(body)};
 vm.runInNewContext(source,env,{timeout:2000});assert.equal(calls,1,'exactly one completion');
 const diagnostics=JSON.stringify([...store])+JSON.stringify(notes)+JSON.stringify(logs);
 for(const s of ['PRIVATE_PARAMETER','PRIVATE_CONTENT','PRIVATE_MEDIA','private.example','TEST_!!123'])assert(!diagnostics.includes(s),'diagnostic leaked '+s);
 return {output,notes,logs,store};
}
function blocked(options){const r=run(options);assert.equal(r.output.response?.status,200);assert.equal(r.output.response.body,'{}');return r;}
function pass(options){const r=run(options);assert.equal(Object.keys(r.output).length,0);return r;}

for(const host of hosts)for(const route of ['gw','h5'])check('splash '+host+' '+route,()=>{
 const r=blocked({target:url(host,api,route)});assert.equal(JSON.parse(r.store.get(BLOCK)).lastHost,host);assert.equal(r.notes[0][1],'开屏接口已拦截');
});
for(const host of hosts)check('legacy splash '+host,()=>blocked({target:url(host,'mtop.etao.noah.query')+'&data=tao_splash'}));
for(const host of hosts)check('homepage rewrite '+host,()=>{
 const r=run({target:url(host,'mtop.taobao.wireless.home.newface.awesome.get'),body:doc()});
 const d=JSON.parse(r.output.body);assert.equal(section(d).sections[0].items[0].gmtStartMs,START);assert.equal(section(d).sections[0].items[0].gmtEndMs,String(END));assert.deepEqual(d.other,doc().other);assert.equal(count(r).changed,1);assert.equal(r.notes[0][1],'已改写 1 条');
});
check('explicit port',()=>blocked({target:url('203.119.238.234:443')}));
for(const target of [url('203.119.238.235'),url('acs.m.taobao.com.evil.example'),url('203.119.238.234:8443'),url().replace('get/','getFake/'),url()+'#fragment',url().replace('https:','http:'),url(hosts[0],'mtop.taobao.afc.refine.operate'),url(hosts[0],'mtop.etao.noah.query')])check('unrelated request unchanged',()=>pass({target}));
check('normal homepage request unchanged',()=>pass({target:home}));
check('delete unchanged',()=>pass({method:'DELETE'}));
check('AMDC unchanged',()=>pass({target:'http://59.82.113.10/amdc/mobileDispatch?private=PRIVATE_PARAMETER'}));
check('no arbitrary IP response',()=>pass({target:url('1.2.3.4','mtop.taobao.wireless.home.newface.awesome.get'),body:doc()}));
check('status error unchanged',()=>pass({target:home,body:doc(),status:403}));
check('unrelated API response unchanged',()=>pass({target:url(hosts[0],'mtop.common.getTimestamp'),body:doc()}));
check('ordinary homepage counted silently',()=>{const r=pass({target:home,body:{data:{cards:[]}}});assert.equal(count(r).inspected,1);assert.equal(r.notes.length,0);});
check('exact field only',()=>pass({target:home,body:{data:{splash:{sections:[item()]}}}}));
check('empty sections silent',()=>{const d=doc();section(d).sections=[];assert.equal(pass({target:home,body:d}).notes.length,0);});
check('already rewritten silent',()=>{const d=doc();Object.assign(section(d).sections[0].items[0],{gmtStartMs:START,gmtEndMs:String(END)});assert.equal(pass({target:home,body:d}).notes.length,0);});
check('missing media unchanged',()=>{const d=doc();delete section(d).sections[0].items[0].imgUrl;pass({target:home,body:d});});
check('invalid date unchanged',()=>{const d=doc();section(d).sections[0].items[0].gmtStartMs='tomorrow';pass({target:home,body:d});});
check('video item',()=>{const d=doc(),i=section(d).sections[0].items[0];delete i.imgUrl;i.videoUrl='https://private.example/PRIVATE_MEDIA.mp4';assert(run({target:home,body:d}).output.body);});
check('encoded section',()=>{const d=doc(),base=d.data.containers.splash_home_base.base;base.topViewSplashSection=JSON.stringify(section(d));const r=run({target:home,body:d});assert.equal(JSON.parse(JSON.parse(r.output.body).data.containers.splash_home_base.base.topViewSplashSection).sections[0].items[0].gmtStartMs,START);});
check('JSONP preserves wrapper',()=>{const r=run({target:home,body:' callback.x( '+JSON.stringify(doc())+' ); '});assert(r.output.body.startsWith(' callback.x( '));assert(r.output.body.endsWith(' ); '));});
check('HTML unchanged',()=>pass({target:home,body:'<html>topViewSplashSection</html>'}));
check('malformed JSON unchanged',()=>pass({target:home,body:'{"topViewSplashSection":'}));
check('four MiB limit',()=>{const r=pass({target:home,body:'topViewSplashSection'+' '.repeat(4*1024*1024)});assert.equal([...r.store].length,0);});
check('atomic unsafe integer protection',()=>{const d=doc();d.unsafe=Number.MAX_SAFE_INTEGER+1;assert.equal(count(pass({target:home,body:d})).changed||0,0);});
check('atomic depth protection',()=>{const d=doc();let p=d;for(let i=0;i<30;i++)p=p.deep={};assert.equal(count(pass({target:home,body:d})).changed||0,0);});
check('atomic node cap',()=>{const d=doc();d.large=Array(21000).fill(0);assert.equal(count(pass({target:home,body:d})).changed||0,0);});
check('response notification off',()=>assert.equal(run({target:home,body:doc(),argument:{notify:false}}).notes.length,0));
check('notification failure does not block rewrite',()=>assert(run({target:home,body:doc(),notificationFails:true}).output.body));
check('storage failure does not block rewrite',()=>assert(run({target:home,body:doc(),storageFails:true}).output.body));
check('corrupt counters recover',()=>assert(run({target:home,body:doc(),store:new Map([[CONFIG,'bad json']])}).output.body));
for(const dims of ['720-1280','1080-1920','1125-1602','1125-1950','1242-2208'])for(const ext of ['png','jpg'])check('HEIC size '+dims+' '+ext,()=>blocked({target:asset.replace('1125-1602',dims).replace('.png_', '.'+ext+'_')}));
check('HEIC portrait variant',()=>blocked({target:'https://heic.alicdn.com/imgextra/i1/1234/TEST_!!123-0-octopus-1080-1920.jpg_1080x0q90.jpg_.heic'}));
check('HEIC unknown dimension passes',()=>pass({target:asset.replace('1125-1602','800-800')}));
check('unscoped CDN passes',()=>pass({target:asset.replace('heic.alicdn.com','unrelated.example')}));
check('asset option off',()=>pass({target:asset,argument:{assets:false}}));
check('asset request body not read',()=>blocked({target:asset}));
check('HEAD asset',()=>blocked({target:asset,method:'HEAD'}));
check('POST asset passes',()=>pass({target:asset,method:'POST'}));
const webp='http://gw.alicdn.com/imgextra/i2/TEST_!!123-0-tps-720-1280.png_720x1280q90.webp';
for(const dims of ['720-1280','1080-1920','1125-1602','1242-2208'])check('WebP '+dims,()=>blocked({target:webp.replace('720-1280',dims)}));
check('WebP query',()=>blocked({target:webp+'?private=PRIVATE_PARAMETER'}));
check('WebP square passes',()=>pass({target:webp.replace('720-1280','800-800')}));
check('request notification off',()=>assert.equal(blocked({argument:{notify:false}}).notes.length,0));
check('JSON argument flags',()=>assert.equal(blocked({argument:'{"notify":false}'}).notes.length,0));
check('combined stats',()=>{const store=new Map();blocked({store});run({target:home,body:doc(),store});const r=run({stats:true,store});assert(r.notes[0][2].includes('首页配置响应 1 次；时间改写 1 次'));assert(r.notes[0][2].includes('专用开屏接口：1次'));});
check('history cap',()=>{const store=new Map();for(let i=0;i<55;i++)blocked({store});assert.equal(JSON.parse(store.get(BLOCK)).history.length,50);});
check('daily count and interval',()=>{const store=new Map();blocked({store});const r=blocked({store,now:1793240090000});assert(r.notes[0][2].includes('1分30秒'));assert.equal(JSON.parse(store.get(BLOCK)).today,2);const s=blocked({store,now:1793412800000});assert.equal(JSON.parse(s.store.get(BLOCK)).today,1);});
check('plugin/script guards identical',()=>{const pp=[...plugin.matchAll(/^request if \$\{url\} ~= \/(.+)\/ then script/gm)].map(m=>new RegExp(m[1]));assert.equal(pp.length,6);rules.forEach((r,i)=>assert.equal(pp[i].source,new RegExp(r.pattern).source));const rp=plugin.match(/^response if \$\{url\} ~= \/(.+)\/ &&/m)[1];const sp=JSON.parse(source.match(/const RESPONSE_PATTERN = new RegExp\((.*)\);/)[1]);assert.equal(new RegExp(rp).source,new RegExp(sp).source);});
check('no broad DNS/IP/protocol blocking',()=>{assert(!/\[Rule\]|\[General\]|\[Rewrite\]|skip-server-cert-verify|disable-udp-ports/.test(plugin));const mitm=plugin.split('hostname = ')[1].trim().split(', ');assert.equal(mitm.length,8);for(const h of hosts)assert(mitm.includes(h));assert(!mitm.includes('*'));});
check('no outbound API or credential access',()=>assert(!/\$httpClient|fetch\(|eval\(|\$request\.(?:headers|body)|\.bodyBytes/.test(source)));
check('one remote script version',()=>{const urls=[...plugin.matchAll(/script\("([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(urls).size,1);assert(urls[0].endsWith('?v=20261029-1'));});
console.log(checks+' offline checks passed; phone TLS/MitM effectiveness still requires observation.');
