// Synthetic fixtures: these validate local rewriting, not live Taobao behavior.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const scriptFile = fs.existsSync(__dirname+'/taobao-splash-config.js') ? __dirname+'/taobao-splash-config.js' : __dirname+'/../Scripts/taobao-splash-config.js';
const pluginFile = fs.existsSync(__dirname+'/taobao-splash-config-local.plugin') ? __dirname+'/taobao-splash-config-local.plugin' : __dirname+'/../Plugins/taobao-splash-config.plugin';
const source = fs.readFileSync(scriptFile, 'utf8');
const baseUrl = 'https://acs.m.taobao.com/gw/mtop.taobao.homepage.example/1.0/?token=SECRET';
const item = () => ({itemId:'123', imgUrl:'https://gw.alicdn.com/example.png', gmtStartMs:'1700000000000', gmtEndMs:'1900000000000', unrelated:'keep'});
const section = x => ({sections:[{subSection:{splash:{item:{'0':{content:x}}}}}]});
const doc = () => ({data:{containers:{homepage:{base:{topViewSplashSection:section(item()),feed:[{gmtStartMs:1,gmtEndMs:2,imgUrl:'https://example.com/a'}],ordinary:17}}}},ret:['SUCCESS::OK']});
function run(body, options={}) {
  let calls=0,result,logs=[],notices=[],state={};
  const context = {
    $request:{url:options.url || baseUrl},
    $response:{status:options.status || 200,body:typeof body==='object' && !options.binary?JSON.stringify(body):body},
    $argument:{notify:true},
    $persistentStore:{read:k=>state[k],write:(v,k)=>{if(options.storeFail)throw Error('store');state[k]=v;return true;}},
    $notification:{post:(...v)=>{if(options.noticeFail)throw Error('notice');notices.push(v);}},
    console:{log:s=>logs.push(s)},$done:r=>{calls++;result=r;}
  };
  if(options.manual){delete context.$request;delete context.$response;context.$argument='stats';}
  if(options.noResponse)delete context.$response;
  if(options.notify===false)context.$argument={notify:false};
  vm.runInNewContext(source,context,{timeout:1000});
  assert.equal(calls,1);
  return {result:JSON.parse(JSON.stringify(result)),logs,notices,state};
}
const tests=[];function test(n,f){f();tests.push(n);console.log('PASS '+n);}
test('known section changes only two schedule fields',()=>{
 const original=doc(),r=run(original),expected=doc();
 const i=expected.data.containers.homepage.base.topViewSplashSection.sections[0].subSection.splash.item['0'].content;
 i.gmtStartMs='4070908800000';i.gmtEndMs='4102444800000';
 assert.deepEqual(JSON.parse(r.result.body),expected);assert.equal(r.notices.length,1);
 assert(!JSON.stringify(r).includes('SECRET'));
});
test('future window is valid and in 2099 through 2100',()=>{assert.equal(new Date(4070908800000).toISOString(),'2099-01-01T00:00:00.000Z');assert(4102444800000>4070908800000);});
test('numeric wire types preserved',()=>{let d=doc(),i=d.data.containers.homepage.base.topViewSplashSection.sections[0].subSection.splash.item['0'].content;i.gmtStartMs=1700000000000;i.gmtEndMs=1900000000000;const r=JSON.parse(run(d).result.body);assert.equal(typeof r.data.containers.homepage.base.topViewSplashSection.sections[0].subSection.splash.item['0'].content.gmtStartMs,'number');});
test('base and delta both rewritten',()=>{let d=doc();d.data.containers.homepage.delta={topViewSplashSection:section(item())};assert(run(d).notices[0][1].includes('2'));});
test('encoded topView section supported',()=>{let d=doc();d.data.containers.homepage.base.topViewSplashSection=JSON.stringify(section(item()));const r=JSON.parse(run(d).result.body);assert.equal(typeof r.data.containers.homepage.base.topViewSplashSection,'string');assert(r.data.containers.homepage.base.topViewSplashSection.includes('4070908800000'));});
test('JSONP wrapper preserved',()=>{const r=run('callback123('+JSON.stringify(doc())+');');assert(r.result.body.startsWith('callback123('));assert(r.result.body.endsWith(');'));});
test('literal IPv4 gateway accepted',()=>{assert(run(doc(),{url:'https://59.82.1.2/gw/mtop.taobao.homepage.example/1.0/'}).result.body);});
test('literal IPv6 gateway accepted',()=>{assert(run(doc(),{url:'https://[2400:3200::1]/gw/mtop.taobao.homepage.example/1.0/'}).result.body);});
test('foreign hostname untouched',()=>{assert.deepEqual(run(doc(),{url:'https://taobao.com.evil.test/gw/mtop.taobao.example/1.0/'}).result,{});});
test('wrong path untouched',()=>{assert.deepEqual(run(doc(),{url:'https://acs.m.taobao.com/login'}).result,{});});
test('non-200 untouched',()=>{assert.deepEqual(run(doc(),{status:403}).result,{});});
test('no topView field untouched',()=>{assert.deepEqual(run({data:item()}).result,{});});
test('empty sections untouched',()=>{assert.deepEqual(run({topViewSplashSection:{sections:[]}}).result,{});});
test('unknown date names untouched',()=>{assert.deepEqual(run({topViewSplashSection:section({gmt_start_ms:1,gmt_end_ms:2,imgUrl:'https://example.com/a'})}).result,{});});
test('missing end date untouched',()=>{const i=item();delete i.gmtEndMs;assert.deepEqual(run({topViewSplashSection:section(i)}).result,{});});
test('zero dates untouched',()=>{const i=item();i.gmtStartMs=0;assert.deepEqual(run({topViewSplashSection:section(i)}).result,{});});
test('dates without material URL untouched',()=>{const i=item();delete i.imgUrl;assert.deepEqual(run({topViewSplashSection:section(i)}).result,{});});
test('video material supported',()=>{const i=item();delete i.imgUrl;i.videoUrl='https://example.com/a.mp4';assert(run({topViewSplashSection:section(i)}).result.body);});
test('already rewritten input produces no body change',()=>{const first=run(doc()).result.body;assert.deepEqual(run(first).result,{});});
test('invalid JSON untouched',()=>{assert.deepEqual(run('{"topViewSplashSection":').result,{});});
test('binary untouched',()=>{assert.deepEqual(run(Buffer.from('topViewSplashSection'),{binary:true}).result,{});});
test('oversized body untouched',()=>{assert.deepEqual(run('topViewSplashSection'+' '.repeat(4*1024*1024)).result,{});});
test('unsafe numeric IDs preserve original raw response',()=>{const raw=JSON.stringify(doc()).replace('"ordinary":17','"ordinary":9007199254740993');assert.deepEqual(run(raw).result,{});});
test('depth limit preserves original even after local edits',()=>{const d=doc();let x=d;for(let i=0;i<30;i++){x.deep={};x=x.deep;}assert.deepEqual(run(d).result,{});});
test('notification failure retains modification',()=>{assert(run(doc(),{noticeFail:true}).result.body);});
test('storage failure retains modification',()=>{assert(run(doc(),{storeFail:true}).result.body);});
test('notification toggle',()=>{const r=run(doc(),{notify:false});assert(r.result.body);assert.equal(r.notices.length,0);});
test('request-phase misuse untouched',()=>{assert.deepEqual(run(doc(),{noResponse:true}).result,{});});
test('manual status does not send network requests',()=>{const r=run('',{manual:true});assert.deepEqual(r.result,{});assert.equal(r.notices.length,1);});
test('plugin has no DNS or network-blocking rules',()=>{const p=fs.readFileSync(pluginFile,'utf8');assert(!/^\[(?:General|Rule|Host|IP Rewrite)\]/m.test(p));assert(!/REJECT|httpdns|amdc|dns-server/i.test(p));});
console.log(tests.length+' offline checks passed');
