const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const sourcePath = fs.existsSync(__dirname + '/idle-splash.js') ? __dirname + '/idle-splash.js' : __dirname + '/../Scripts/idle-splash.js';
const source = fs.readFileSync(sourcePath, 'utf8');
let count = 0;
function run(options = {}) {
  const async = options.async || false;
  const api = 'mtop.taobao.idlecommerce.splash.' + (async ? 'async.ads' : 'ads');
  const version = async ? '1.0' : '2.0';
  const obj = {api, v: version, ret: ['SUCCESS::调用成功'], data: {adMap: {}, dspList: [], hotStartInterval: '120'}, ...options.obj};
  let result, done = 0; const notes = [], logs = [];
  const context = {$request: {url: options.url || `https://acs.m.goofish.com/gw/${api}/${version}?secret=PRIVATE`},
    $response: {status: options.status === undefined ? 200 : options.status, body: options.body === undefined ? JSON.stringify(obj) : options.body},
    $done: r => {result = r; done++;}, $notification: {post: (...a) => {if(options.noteError)throw Error('off');notes.push(a);}}, console: {log: s => logs.push(s)}};
  vm.runInNewContext(source, options.noRequest ? {$done: context.$done, console: context.console} : context);
  assert.equal(done, 1); assert(!JSON.stringify({notes, logs}).includes('PRIVATE')); count++;
  return {result, notes, logs, data: result.body ? JSON.parse(result.body).data : null};
}
for (const async of [false, true]) {
  let r = run({async, obj: {data: {adMap: {x: [1]}, dspList: ['ylh'], realTimeAd: {fromDsp: 'ylh'}, keep: {x: 1}, hotStartInterval: '120'}}});
  assert.deepEqual(r.data.adMap, {}); assert.deepEqual(r.data.dspList, []); assert.equal(r.data.realTimeAd, null);
  assert.deepEqual(r.data.keep, {x: 1}); assert.equal(r.data.hotStartInterval, async ? '120' : '315360000');
  r = run({async, obj: {data: {adMap: {}}}});
  if(async) assert.equal(Object.keys(r.result).length, 0);
  else {assert.deepEqual(r.data.dspList, []); assert.equal(r.data.hotStartInterval, '315360000');}
  r = run({async, obj: {data: {realTimeAd: {fromDsp: 'mama'}}}}); assert.equal(r.data.realTimeAd, null);
}
for(const interval of [120, '120', undefined]) {
  const data = {adMap: {}, dspList: []}; if(interval !== undefined)data.hotStartInterval=interval;
  const r=run({obj:{data}});assert.equal(r.data.hotStartInterval, typeof interval === 'number' ? 315360000 : '315360000');
}
let r=run({obj:{data:{adMap:{},dspList:[],hotStartInterval:'315360000',realTimeAd:null}}});assert.equal(Object.keys(r.result).length,0);
for(const data of [{}, {other:1}, {adMap:[]}, {adMap:null}, {adMap:{},dspList:{}}, {realTimeAd:[]}, {realTimeAd:'x'}]) {
  r=run({obj:{data}});assert.equal(Object.keys(r.result).length,0);assert.equal(r.notes.length,0);
}
for(const data of [null,[],3]) {r=run({obj:{data}});assert.equal(Object.keys(r.result).length,0);}
for(const obj of [{api:'other'}, {v:'3.0'}, {ret:['FAIL::拒绝']}, {ret:[]}, {ret:null}]) {
  r=run({obj});assert.equal(Object.keys(r.result).length,0);assert.equal(r.notes.length,0);
}
for(const url of [
  'http://acs.m.goofish.com/gw/mtop.taobao.idlecommerce.splash.ads/2.0',
  'https://evil.test/gw/mtop.taobao.idlecommerce.splash.ads/2.0',
  'https://acs.m.goofish.com.evil.test/gw/mtop.taobao.idlecommerce.splash.ads/2.0',
  'https://acs.m.goofish.com/gw/mtop.taobao.idlecommerce.splash.ads/1.0',
  'https://acs.m.goofish.com/gw/mtop.taobao.idlecommerce.splash.async.ads/2.0',
  'https://acs.m.goofish.com/gw/mtop.taobao.idlecommerce.splash.config/1.0',
  'https://acs.m.goofish.com/gw/mtop.taobao.idlecommerce.splash.ads/2.0x'
]) {r=run({url});assert.equal(Object.keys(r.result).length,0);assert.equal(r.notes.length,0);}
for(const status of [403,500,'HTTP/1.1 403 Forbidden',2000]) {r=run({status});assert.equal(Object.keys(r.result).length,0);}
for(const body of ['not-json','null','[]','x'.repeat(2*1024*1024+1)]) {r=run({body});assert.equal(Object.keys(r.result).length,0);}
run({status:'HTTP/1.1 200 OK'});run({noRequest:true});r=run({noteError:true});assert(r.data.hotStartInterval);
// Synthetic fixture shaped like a known response. Contains no HAR or account material.
const fixture = {api:'mtop.taobao.idlecommerce.splash.ads',v:'2.0',ret:['SUCCESS::调用成功'],data:{adMap:{},dspList:[],hotStartInterval:'120',config:{shake:{count:'3',durationIos:'1200'},skip:{padding:null}},spaceIdMap:{ylh:{cacheSpaceId:null,showSpaceId:'SYNTHETIC_SLOT'}}}};
r=run({obj:fixture});assert.equal(r.data.hotStartInterval,'315360000');
assert.deepEqual(r.data.config,fixture.data.config);assert.deepEqual(r.data.spaceIdMap,fixture.data.spaceIdMap);
const r2=run({obj:JSON.parse(r.result.body)});assert.equal(Object.keys(r2.result).length,0);
assert(!/\$httpClient|\$task\.fetch|fetch\(/.test(source));
console.log(`${count} offline cases passed; no live requests or account operations.`);
