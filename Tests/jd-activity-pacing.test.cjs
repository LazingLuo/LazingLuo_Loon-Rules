// Synthetic HTTP and virtual time only; never connects to JD.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=fs.existsSync(path.join(__dirname,'../Scripts'))?path.join(__dirname,'..'):path.join(__dirname,'发布包');
const names=['jd-jxzy-activity.js','jd-farm-activity.js','jd-coupon-activity.js','jd-home-activity.js','jd-index-activity.js'];
const text=n=>fs.readFileSync(path.join(root,'Scripts',n),'utf8');
const tests=[],test=(n,f)=>tests.push([n,f]);
function pacing(source,options={}) {
 let now=10000,guards=0,randoms=0;const waits=[],calls=[],logs=[];
 const ctx=vm.createContext({Math});vm.runInContext(source.slice(source.indexOf('// BEGIN JD activity request pacing'),source.indexOf('// END JD activity request pacing')),ctx);
 const h={now:()=>now,random:()=>{randoms++;return options.random??0.5;},log:x=>logs.push(x),guard:()=>{guards++;if(options.cancel?.(now))throw Error('CANCELLED');},sleep:async ms=>{waits.push(ms);now+=ms;},request:async(...args)=>{calls.push({time:now,args});now+=options.networkMs??0;if(options.fail)throw Error('NETWORK_FAILURE');return {status:200};}};
 return {p:ctx.createJdActivityPacer(h),h,waits,calls,logs,advance:ms=>now+=ms,now:()=>now,guards:()=>guards,randoms:()=>randoms};
}
for(const name of names){
 const source=text(name);
 test(name+' first request has no delay or dummy final sleep',async()=>{const r=pacing(source);await r.p.beforeRequest();await r.p.request('FIRST');assert.equal(r.calls.length,1);assert.deepEqual(r.waits,[]);});
 test(name+' randomized business request gaps include list refreshes',async()=>{for(const [random,ms]of [[0,2000],[0.25,3000],[0.5,4000],[0.9999,5000]]){const r=pacing(source,{random,networkMs:700});await r.p.request('QUERY');await r.p.beforeRequest();await r.p.request('QUERY');assert.deepEqual(r.waits,[ms]);assert.equal(r.calls[1].time-r.calls[0].time,ms+700);}});
 test(name+' existing browse time counts toward spacing',async()=>{const r=pacing(source);await r.p.request('START');r.advance(6000);await r.p.beforeRequest();await r.p.request('COMPLETE');assert.deepEqual(r.waits,[]);});
 test(name+' only remaining gap is waited and log-only rows do nothing',async()=>{const r=pacing(source);await r.p.request('QUERY');for(let i=0;i<10;i++)r.h.log('需App操作');assert.equal(r.randoms(),1);assert.deepEqual(r.waits,[]);r.advance(1500);await r.p.beforeRequest();assert.deepEqual(r.waits,[2500]);});
 test(name+' credentials or date changes abort after spacing',async()=>{const r=pacing(source,{cancel:now=>now>10000});await r.p.request('QUERY');await assert.rejects(r.p.beforeRequest(),/CANCELLED/);assert.equal(r.calls.length,1);});
 test(name+' failed network request is not retried',async()=>{const r=pacing(source,{fail:true});await assert.rejects(r.p.request('SUBMIT'),/NETWORK_FAILURE/);assert.equal(r.calls.length,1);assert.deepEqual(r.waits,[]);});
 test(name+' request sites are gated before signatures',()=>{
   const body=source.slice(source.indexOf('// END JD activity request pacing'));
   assert(!body.includes('await host.request('));
   assert.equal((body.match(/await pacing.request\(/g)||[]).length,1);
   const starts={
    'jd-jxzy-activity.js':['async function request(fn,task)'],
    'jd-home-activity.js':['async function request(fn,task)'],
    'jd-index-activity.js':['async function request(fn,task)'],
    'jd-farm-activity.js':['async function api(scope,fn,body,key'],
    'jd-coupon-activity.js':['async function call(f,body)']
   };
   for(const start of starts[name]){const section=body.slice(body.indexOf(start));const gate=section.indexOf('await pacing.beforeRequest()'),send=section.indexOf('await pacing.request('),sign=section.search(/crypto\.(?:signOnline|sign|bodySign)\(|await signed\(/);assert(gate>=0&&gate<send);assert(sign<0||gate<sign);assert(!/await host\.(?:sleep|pause)\(/.test(section.slice(gate+29,send)));}
 });
}
for(const home of [false,true])test((home?'home':'jingxi')+' real client paces consecutive queries',async()=>{
 const source=text(home?'jd-home-activity.js':'jd-jxzy-activity.js'),ctx=vm.createContext({console,Math});vm.runInContext(source.split('(async function jxLoonTaskMain(){')[0],ctx,{timeout:5000});
 const times=[],waits=[],storage={};let clock=10000;
 const host={now:()=>clock,day:()=> '2026-10-29',random:()=>0,read:(k,f)=>storage[k]??f,write:(k,v)=>storage[k]=v,sleep:async ms=>{waits.push(ms);clock+=ms;},request:async o=>{times.push(clock);const p=new URLSearchParams(o.body);assert.equal(JSON.parse(p.get('body')).time,clock);return {status:200,body:'{"code":0,"data":{"taskInfoList":[]}}'};}};
 const profile={pin:'offline',environment:'FAKE',eidToken:'FAKE',headers:{Cookie:'pt_key=FAKE;pt_pin=offline;','User-Agent':'Offline',Referer:'https://pro.m.jd.com/mall/active/'+(home?'2H8G6a7JecjqHH3t1ZWSoJjPtziP':'2iqSwv1JiDHxAkHAikfU6XAECFmo')+'/index.html'},query:{appid:'jx_h5_babel',client:'jxh5',channel:'jxh5',functionId:'jxzy_active_task_queryTaskList',body:JSON.stringify({source:'jxzy',craftId:home?'69ae8eb86a31c802e19f9f8f':'6824629a7c46584759d39b78',sceneval:2,buid:325,appCode:'FAKE'})}};
 const runner=ctx.createJxTaskClient(host,{hash:()=> 'HASH',decodeEnvironment:()=>({pp:{p1:'offline'}}),bodySign:()=> 'FAKE'}).makeRunner(profile);
 await runner.query();await runner.query();assert.deepEqual(times,[10000,12000]);assert.deepEqual(waits,[2000]);
});
(async()=>{for(const [name,run]of tests){try{await run();}catch(e){console.error(name);throw e;}}console.log(tests.length+' activity pacing checks passed');})().catch(e=>{console.error(e);process.exitCode=1;});
