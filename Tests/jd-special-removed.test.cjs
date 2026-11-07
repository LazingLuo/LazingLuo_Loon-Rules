const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),api=require(path.join(root,'Scripts/jd-signin.js'));
assert.deepEqual(api.JS_TASKS.map(x=>x[0]),['daily','scratch','blindbox','jxzy','finance','home','index','medical','gameDaily','gear','gearAI','wallet','hardware','used','furnishing','service','campus','housekeeping','healthKit']);
for(const dir of ['Scripts','Plugins','Docs'])for(const name of fs.readdirSync(path.join(root,dir))){
 const s=fs.readFileSync(path.join(root,dir,name),'utf8');
 assert(!/JD_SPECIAL_CHANNEL|createSpecialClient|tjCapture|特价频道|特价签到|jd-special-activity|\bspecial:/.test(s),dir+'/'+name);
}
assert(!fs.existsSync(path.join(root,'Scripts/jd-special-activity.js')));
assert(!fs.readFileSync(path.join(root,'Scripts/jd-splash.js'),'utf8').includes('jdSplashCapture'));
assert.throws(()=>api.jsTarget('special',{url:'https://api.m.jd.com/',body:'functionId=common_do_task&appid=newtry&body=%7B%22channelId%22%3A%2216%22%7D'}));
(async()=>{
 for(const name of ['jd-signin-capture.js','jd-activity-capture.js']){
  const cap=require(path.join(root,'Scripts',name));
  assert.equal(cap.tjCapture,undefined);assert.equal(cap.TJ_KEY,undefined);
  for(const url of ['https://api.m.jd.com/','https://api.m.jd.com/api']){
   const noSideEffects={read:(k,f)=>f,rawRead:()=>'',write(){throw Error('removed channel must not save credentials');},rawWrite(){throw Error('removed channel must not save credentials');}};
   const result=await cap.jsCapture(noSideEffects,{url,method:'POST',headers:{Cookie:'pt_key=OFFLINE;pt_pin=offline;'},body:new URLSearchParams({functionId:'common_task_list',appid:'newtry',body:'{"channelId":"16"}'}).toString()},{status:200,body:'{"code":0,"data":{"bizCode":0,"result":{}}}'},{farm:cap.farmCapture},()=>{throw Error('unexpected decode');});
   assert.equal(result,null);
  }
 }
 console.log('Removed channel: thirteen retained sign-ins, no menu/client/capture, retired request rejected; zero live requests.');
})().catch(e=>{console.error(e);process.exitCode=1;});
