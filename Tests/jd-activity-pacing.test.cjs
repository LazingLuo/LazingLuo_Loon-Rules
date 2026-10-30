// Offline request timing regression. Task-specific browse countdowns are covered by activity tests.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const names=['jd-jxzy-activity.js','jd-farm-activity.js','jd-coupon-activity.js','jd-home-activity.js','jd-index-activity.js'];
const text=n=>fs.readFileSync(path.join(root,'Scripts',n),'utf8');
const tests=[],test=(n,f)=>tests.push([n,f]);
for(const name of names){
 const source=text(name);
 test(name+' has no extra request-delay layer',()=>{
  assert(!/createJdActivityPacer|pacing\.|请求间隔：等待/.test(source));
  assert.equal((source.match(/await host\.request\(/g)||[]).length,1);
  new vm.Script(source);
 });
}
for(const home of [false,true])test((home?'home':'jingxi')+' real client sends consecutive queries without added waits',async()=>{
 const source=text(home?'jd-home-activity.js':'jd-jxzy-activity.js'),ctx=vm.createContext({console,Math});vm.runInContext(source.split('(async function jxLoonTaskMain(){')[0],ctx,{timeout:5000});
 const times=[],waits=[],storage={};let clock=10000;
 const host={now:()=>clock,day:()=> '2026-10-29',random:()=>0,read:(k,f)=>storage[k]??f,write:(k,v)=>storage[k]=v,sleep:async ms=>{waits.push(ms);clock+=ms;},request:async o=>{times.push(clock);const p=new URLSearchParams(o.body);assert.equal(JSON.parse(p.get('body')).time,clock);return {status:200,body:'{"code":0,"data":{"taskInfoList":[]}}'};}};
 const profile={pin:'offline',environment:'FAKE',eidToken:'FAKE',headers:{Cookie:'pt_key=FAKE;pt_pin=offline;','User-Agent':'Offline',Referer:'https://pro.m.jd.com/mall/active/'+(home?'2H8G6a7JecjqHH3t1ZWSoJjPtziP':'2iqSwv1JiDHxAkHAikfU6XAECFmo')+'/index.html'},query:{appid:'jx_h5_babel',client:'jxh5',channel:'jxh5',functionId:'jxzy_active_task_queryTaskList',body:JSON.stringify({source:'jxzy',craftId:home?'69ae8eb86a31c802e19f9f8f':'6824629a7c46584759d39b78',sceneval:2,buid:325,appCode:'FAKE'})}};
 const runner=ctx.createJxTaskClient(host,{hash:()=> 'HASH',decodeEnvironment:()=>({pp:{p1:'offline'}}),bodySign:()=> 'FAKE'}).makeRunner(profile);
 await runner.query();await runner.query();assert.deepEqual(times,[10000,10000]);assert.deepEqual(waits,[]);
});
(async()=>{for(const [name,run]of tests){try{await run();}catch(e){console.error(name);throw e;}}console.log(tests.length+' activity timing checks passed');})().catch(e=>{console.error(e);process.exitCode=1;});
