// Offline response and rule-isolation checks. No JD, NAS or phone access.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const local=fs.existsSync(path.join(__dirname,'jd-splash.js'));
const script=fs.readFileSync(local?path.join(__dirname,'jd-splash.js'):path.join(__dirname,'../Scripts/jd-splash.js'),'utf8');
const plugin=fs.readFileSync(local?path.join(__dirname,'jd_open.plugin'):path.join(__dirname,'../Plugins/jd_open.plugin'),'utf8');
const bridge=fs.readFileSync(local?path.join(__dirname,'../loon-qinglong-bridge/qinglong-bridge.plugin'):path.join(__dirname,'../Plugins/qinglong-bridge.plugin'),'utf8');
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name);}
function run(body,{url='https://api.m.jd.com/client.action?functionId=start',status=200,failNotification=false}={}){
 let out,done=0,sideEffects=0;const notices=[];
 const forbidden=()=>{sideEffects++;throw Error('start handler must not store or request anything');};
 vm.runInNewContext(script,{$request:{url},$response:{body,status},console:{log:()=>{}},
  $persistentStore:{read:forbidden,write:forbidden},$httpClient:{get:forbidden,post:forbidden},
  $notification:{post:(...args)=>{if(failNotification)throw Error('disabled');notices.push(args);}},$done:x=>{out=x;done++;}});
 assert.equal(done,1);assert.equal(sideEffects,0);return {out:JSON.parse(JSON.stringify(out)),notices};
}
const targets={onlineTime:'2099-01-01 00:00:00',referralsTime:'2099-12-31 23:59:59',startTimeStamp:Date.UTC(2098,11,31,16),endTimeStamp:Date.UTC(2099,11,31,15,59,59)};
function expectedDates(value){if(Array.isArray(value)){value.forEach(expectedDates);return;}if(!value||typeof value!=='object')return;for(const[key,v]of Object.entries(targets))if(Object.hasOwn(value,key)&&['string','number'].includes(typeof value[key]))value[key]=typeof value[key]==='string'?String(v):v;}
const sample={code:'0',showTimesDaily:3,startTimeStamp:123,extra:{keep:true},images:[[{url:'https://img1.360buyimg.com/ad.jpg',videoUrl:'https://storage.360buyimg.com/ad.mp4',onlineTime:'2026-10-18 00:00:00',referralsTime:'2026-10-19 23:59:59',startTimeStamp:123,endTimeStamp:'456',showTimes:2,unknownTime:'keep'}],null]};
check('only display dates change; materials, counters and other fields stay intact',()=>{
 const r=run(JSON.stringify(sample)),expected=structuredClone(sample);expectedDates(expected.images);
 assert.deepEqual(JSON.parse(r.out.body),expected);assert.equal(r.notices.length,1);assert(r.notices[0].join(' ').includes('2099'));
});
check('response notification failure preserves the completed modification',()=>{const r=run(JSON.stringify(sample),{failNotification:true});assert(r.out.body);assert.equal(r.notices.length,0);});
check('already postponed dates do not emit another handled notification',()=>{const s=structuredClone(sample);expectedDates(s.images);const r=run(JSON.stringify(s));assert.deepEqual(r.out,{});assert.equal(r.notices.length,0);});
check('empty, unfamiliar, rejected and malformed responses remain untouched and quiet',()=>{
 for(const body of ['bad','null','[]',JSON.stringify({...sample,code:'1000'}),JSON.stringify({...sample,images:{}}),JSON.stringify({code:0,images:[]}),JSON.stringify({code:0,images:[],showTimesDaily:3}),JSON.stringify({code:0,images:[{onlineTime:null,startTimeStamp:{value:123},unknownTime:'keep'}],showTimesDaily:3})]){const r=run(body);assert.deepEqual(r.out,{});assert.equal(r.notices.length,0);}
 for(const status of [403,500]){const r=run(JSON.stringify(sample),{status});assert.deepEqual(r.out,{});assert.equal(r.notices.length,0);}
});
check('unrelated API responses never change or notify',()=>{
 for(const fid of ['startup','logConfig','welcomeHome','findBeanSceneNew','bff_rightsCenter_jdInteractTask']){const r=run(JSON.stringify(sample),{url:'https://api.m.jd.com/client.action?functionId='+fid});assert.deepEqual(r.out,{});assert.equal(r.notices.length,0);}
});
check('plugin has one start-only rule, one MITM host and no detection or media rules',()=>{
 const rules=plugin.split('\n').filter(x=>/^(request|response) if /.test(x));assert.equal(rules.length,1);assert(rules[0].startsWith('response if '));assert(plugin.includes('hostname = api.m.jd.com\n'));assert(!/\[Argument\]|probe_|jd-config-probe|jd-image-size|jd-video-block|360buyimg/.test(plugin));
 const match=new RegExp(rules[0].split(' ~= /')[1].split('/i && ')[0],'i');
 assert(match.test('https://api.m.jd.com/client.action?x=1&functionId=start&x=2'));
 for(const url of ['https://api.m.jd.com/client.action?functionId=startup','https://api.m.jd.com/api?functionId=logConfig','https://api.m.jd.com/client.action?functionId=welcomeHome','https://m.360buyimg.com/image.jpg','https://storage.360buyimg.com/material-video/video/test.mp4'])assert(!match.test(url));
 const credentialRule=bridge.split('\n').find(x=>x.startsWith('response if ')&&x.includes('api\\.m\\.jd'));
 const captureMatch=new RegExp(credentialRule.split(' ~= /')[1].split('/ && ')[0]);
 assert(!captureMatch.test('https://api.m.jd.com/client.action?functionId=start'));
 for(const id of ['startup','logConfig','bff_rightsCenter_jdInteractTask']){const url='https://api.m.jd.com/client.action?functionId='+id;assert(captureMatch.test(url));assert(!match.test(url));}
});
const harArg=process.argv.indexOf('--har');
if(harArg>=0)check('private real start response preserves every field except the known display dates',()=>{
 const har=JSON.parse(fs.readFileSync(process.argv[harArg+1],'utf8'));let original;
 for(const e of har.log.entries){if(!/[?&]functionId=start(?:&|$)/.test(e.request.url)||e.response.status!==200)continue;const c=e.response.content,text=c.encoding==='base64'?Buffer.from(c.text,'base64').toString():c.text;try{const d=JSON.parse(text);if(d.images&&d.images.length){original=d;break;}}catch(_){}}
 assert(original,'no usable private start response');const r=run(JSON.stringify(original)),expected=structuredClone(original);expectedDates(expected.images);assert(r.out.body);assert.deepEqual(JSON.parse(r.out.body),expected);assert.equal(r.notices.length,1);
});
console.log(checks+' start-only checks passed. No storage writes or network requests.');
