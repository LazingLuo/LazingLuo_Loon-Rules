const assert=require('assert/strict'),path=require('path'),fs=require('fs'),vm=require('vm');
const root=path.join(__dirname,'../Scripts'),api=require(path.join(root,'jd-signin.js'));
const map=new Map(),reads=[],writes=[],requests=[];
const host={pin:'offline',day:()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10),guard:()=>{},read:(k,f)=>{reads.push(k);return map.get(k)||f;},write:(k,v)=>{writes.push(k);map.set(k,v);},request:async(...a)=>requests.push(a),login:()=>{throw Error('paused sign-in must not read login');}};
const unusedCrypto=new Proxy({}, {get(){throw Error('paused sign-in must not initialize SDK');}});
const r=api.createExtraSignins(host,unusedCrypto).run('special');assert.equal(r.status,'manual_required');assert(r.detail.includes('已暂停'));assert.equal(requests.length,0);assert.equal(reads.length,0);assert.equal(writes.length,0);
assert(api.JS_TASKS.some(t=>t[0]==='medical'));assert(api.JS_TASKS.some(t=>t[0]==='home'));assert(api.JS_TASKS.some(t=>t[0]==='jxzy'));
let done=0,notes=[];vm.runInNewContext(fs.readFileSync(path.join(root,'jd-special-activity.js'),'utf8'),{$persistentStore:{read(){throw Error('paused activity must not read credentials');},write(){throw Error('paused activity must not change records');}},$httpClient:{post(){throw Error('paused activity must not request');}},$notification:{post:(...x)=>notes.push(x)},console:{log:()=>{}},$done:()=>done++},{timeout:5000});assert.equal(done,1);assert.equal(notes.length,1);assert(notes[0].join('').includes('已暂停'));
console.log('Paused sign-in and activity: zero credential reads, writes, requests or SDK initialization. Other entries preserved.');
