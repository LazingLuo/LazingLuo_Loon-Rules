// Verify the actual cleanup and user-facing distinction with synthetic responses.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const file=fs.existsSync(path.join(__dirname,'idle-splash.js'))?path.join(__dirname,'idle-splash.js'):path.join(__dirname,'../Scripts/idle-splash.js');
const source=fs.readFileSync(file,'utf8');
function run({async=false,data={adMap:{},dspList:[]},body,ret=['SUCCESS::调用成功'],api,url,notificationFails=false}={}){
 const name='mtop.taobao.idlecommerce.splash.'+(async?'async.ads':'ads');
 const original={api:api||name,ret,data};let result,done=0;const notes=[],logs=[];
 vm.runInNewContext(source,{$request:{url:url||'https://acs.m.goofish.com/gw/'+name+'/'+(async?'1.0':'2.0')+'?rnd=PRIVATE_QUERY'},
  $response:{body:body===undefined?JSON.stringify(original):body},$done:r=>{done++;result=r;},
  $notification:{post:(...args)=>{if(notificationFails)throw Error('disabled');notes.push(args);}},console:{log:s=>logs.push(s)}});
 assert.equal(done,1);assert(!JSON.stringify(notes).includes('PRIVATE_QUERY'));assert(!logs.join('').includes('PRIVATE_QUERY'));
 return {result,notes,logs,original};
}
let checks=0;
for(const async of [false,true]){
 for(const data of [{adMap:{},dspList:[]},{adMap:{}},{dspList:[]},{}]){
  const r=run({async,data});assert.equal(Object.keys(r.result).length,0);assert.equal(r.notes[0][0],'闲鱼开屏：本次没有广告');assert.equal(r.notes[0][2],'广告列表为空，已原样放行。');assert(r.logs[0].includes('原样放行'));checks++;
 }
 for(const data of [{adMap:{ad:{id:'synthetic'}},keep:'preserve'},{dspList:[{id:'synthetic'}],keep:'preserve'},{adMap:{a:1},dspList:[1],keep:'preserve'}]){
  const r=run({async,data}),clean=JSON.parse(r.result.body);assert.deepEqual(clean.data.adMap,{});if('dspList'in data)assert.deepEqual(clean.data.dspList,[]);assert.equal(clean.data.keep,'preserve');assert.deepEqual(clean.ret,r.original.ret);assert.equal(r.notes[0][0],'闲鱼开屏：已清除广告');assert(r.logs[0].includes('已清除广告'));checks++;
 }
}
for(const o of [{ret:['FAIL::拒绝']},{body:'not json'},{api:'other.api'},{url:'https://acs.m.goofish.com/gw/other.api/2.0'}]){
 const r=run(o);assert.equal(Object.keys(r.result).length,0);assert.equal(r.notes.length,0);checks++;
}
let r=run({data:{adMap:{ad:1}},notificationFails:true});assert.deepEqual(JSON.parse(r.result.body).data.adMap,{});assert(r.logs.some(s=>s.includes('通知发送失败')));checks++;
r=run({notificationFails:true});assert.equal(Object.keys(r.result).length,0);checks++;
assert(!/未发现|非空|规则已命中|已处理/.test(source));checks++;
console.log(checks+' offline checks passed: clear ads, pass empty lists unchanged, plain notifications, both APIs, error guards and notification failure.');
