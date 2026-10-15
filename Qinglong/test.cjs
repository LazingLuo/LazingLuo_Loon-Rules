// All requests mocked. No real credentials or JD/NAS calls.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {main,credentials,target}=require('./function/runtime');
const pin='offline',oldCookie='pt_pin=offline;pt_key=OLD_SECRET; page_session=KEEP;',cookie='pt_key=NEW_SECRET;pt_pin=offline;';
const day=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
function environment(version='h5_file_v5.3.6'){
  const normal='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',custom='rqponmlkjihgfedcbaZYXWVUTSRQPONMLKJIHGFEDCBA-_9876543210zyxwvuts';
  const env={v:version,fp:'reference-fp',pp:{p1:pin},extend:{bu6:33,bu13:'F3'},canvas:'a'.repeat(32),webglFp:'b'.repeat(32)};
  return [...Buffer.from(JSON.stringify(env)+'x').toString('base64').replace(/=+$/,'')].map(c=>custom[normal.indexOf(c)]).reverse().join('');
}
function pack(){
  const headers={Cookie:oldCookie,'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',Referer:'https://pro.m.jd.com/'};
  const scratch={headers,capturedAt:Date.now(),query:{endpoint:'https://api.m.jd.com/api',capturedAt:Date.now(),referenceEnvironmentEncoded:environment(),signatureAppId:'b63ff',signatureParameterEncoding:'of7rHGHQ8GlOIyVOF6ZNHuFT-bVR7qUT',params:{appid:'plus_business',functionId:'bff_rightsCenter_jdInteractTask',body:JSON.stringify({taskType:'beanDailySign_beanDailyPlus_newBeanTask',scene:'jdInteractTask'}),'x-api-eid-token':'DEVICE_SECRET'}}};
  const blindbox=JSON.parse(JSON.stringify(scratch));
  Object.assign(blindbox.query,{signatureAppId:'35fa0',signatureParameterEncoding:'qbkgHGHQ8GlOIyVOF6ZNHuFT-bVR7qUT',params:{appid:'plus_business',functionId:'bff_marketing_interaction',body:JSON.stringify({scene:'blindBox',touchPoint:'purePlusIndexNew2608',version:'250520',eid:'DEVICE_SECRET'}),loginType:'2'}});
  const craft='6824629a7c46584759d39b78',page='2iqSwv1JiDHxAkHAikfU6XAECFmo';
  const jxzy={pin,headers:{...headers,Referer:'https://pro.m.jd.com/mall/active/'+page+'/index.html'},capturedAt:Date.now(),query:{endpoint:'https://api.m.jd.com/api',params:{appid:'jx_h5_babel',channel:'jxh5',client:'jxh5',clientVersion:'1.2.0',functionId:'jxzy_active_querySign',body:JSON.stringify({source:'jxzy',craftId:craft,sceneval:2,buid:325,appCode:'ms1888ebbf'})}},signing:{environment:environment(),capturedAt:Date.now(),eidToken:'DEVICE_SECRET'}};
  return {version:1,pin,activities:{scratch,blindbox,jxzy},attempts:{}};
}
const scratchQuery=done=>({code:'1711000',msg:'成功',rs:{beanTask:{taskList:[{encryptAssignmentId:'fresh-task',assignmentType:5,ext:{taskType:'beanDailySign'},completionFlag:done,assignmentEndTime:'2099-01-01 00:00:00'}]}}});
const scratchReward={code:'0',msg:'成功',rs:{rewardsInfo:{successRewards:{'3':[{quantity:2}]}}}};
const box=rs=>({code:'1711000',msg:'成功',rs});
const boxHistory=()=>box({sendBenefitList:[]});
const boxDone=()=>box({sendBenefitList:[{prizeTime:day()+' 00:01:00'}]});
const boxReward=box({compInfoList:[{success:true,data:{rightResourceDetails:[{beanInfo:{beanNum:3}}]}}]});
const jxQuery=done=>({code:0,msg:'成功',data:{itemId:'1',status:done?2:1,alreadySignDays:done?1:0,totalSignDays:3,signList:done?[day()+'_1.0']:[]}});
const jxReward=()=>({code:0,msg:'成功',data:{alreadySignDays:1,signList:[day()+'_1.0'],prizeInfos:[{prizeType:2,discount:1}]}});
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lazing-ql-test-'));
let number=0;
async function run(mode,replies=[],opts={}){
  const calls=[],logs=[],p=opts.pack||pack(),dataDir=opts.dataDir||path.join(tmp,String(++number));
  const code=await main(mode,{env:opts.env||{JD_COOKIE:cookie,LAZING_JD_ACTIVITY_V1:JSON.stringify(p)},dataDir,noNotify:true,timeout:opts.timeout||10000,log:s=>logs.push(s),transport:(task,o,cb)=>{
    calls.push(o);const response=replies.shift();
    const pair=o.headers.Cookie;assert(pair.includes('pt_key=NEW_SECRET;'));assert(!pair.includes('OLD_SECRET'));assert(pair.includes('page_session=KEEP'));
    if(opts.onCall)opts.onCall(o);
    if(response===undefined)throw new Error('unexpected HTTP');
    if(response==='hang')return;
    setImmediate(()=>response==='network'?cb('offline'):cb(null,{status:200},JSON.stringify(response)));
  }});
  const visible=logs.join('\n');for(const s of ['OLD_SECRET','NEW_SECRET','DEVICE_SECRET'])assert(!visible.includes(s),'secret leaked');
  return {code,calls,logs,dataDir};
}
(async()=>{
  try{
    for(const mode of ['scratch','blindbox','jxzy']){
      const r=await run(mode,mode==='scratch'?[scratchQuery(true)]:mode==='blindbox'?[boxDone()]:[jxQuery(true)]);
      assert.equal(r.code,0);assert.equal(r.calls.length,1);
    }
    let r=await run('scratch',[scratchQuery(false),scratchReward]);assert.equal(r.code,0);assert.equal(r.calls.length,2);
    let after=await run('scratch',[scratchQuery(false)],{dataDir:r.dataDir});assert.equal(after.code,1);assert.equal(after.calls.length,1);
    assert(JSON.parse(new URLSearchParams(r.calls[1].body).get('body')).assignmentId==='fresh-task');
    r=await run('blindbox',[boxHistory(),box({leftTimes:3}),boxReward,boxDone()]);assert.equal(r.code,0);assert.equal(r.calls.length,4);
    after=await run('blindbox',[boxHistory(),box({leftTimes:3})],{dataDir:r.dataDir});assert.equal(after.code,1);assert.equal(after.calls.length,2);
    r=await run('jxzy',[jxQuery(false),jxReward(),jxQuery(true)]);assert.equal(r.code,0);assert.equal(r.calls.length,3);
    after=await run('jxzy',[jxQuery(false)],{dataDir:r.dataDir});assert.equal(after.code,1);assert.equal(after.calls.length,1);
    r=await run('scratch',[scratchQuery(false),'network']);assert.equal(r.code,1);
    after=await run('scratch',[scratchQuery(false)],{dataDir:r.dataDir});assert.equal(after.calls.length,1);assert.equal(after.code,1);
    r=await run('blindbox',[boxHistory(),box({leftTimes:1}),boxReward,boxHistory()]);assert.equal(r.code,1);
    r=await run('scratch',[],{env:{JD_COOKIE:cookie}});assert.equal(r.code,1);assert.equal(r.calls.length,0);
    r=await run('scratch',[],{env:{JD_COOKIE:cookie+'\n'+cookie,LAZING_JD_ACTIVITY_V1:JSON.stringify(pack())}});assert.equal(r.code,1);assert.equal(r.calls.length,0);
    const p=pack();p.activities.scratch.headers.Cookie='pt_key=OLD_SECRET;pt_pin=other;';r=await run('scratch',[],{pack:p});assert.equal(r.code,1);assert.equal(r.calls.length,0);
    const imported=pack();imported.attempts.scratch={pin,date:day(),time:Date.now()};r=await run('scratch',[scratchQuery(false)],{pack:imported});assert.equal(r.code,1);assert.equal(r.calls.length,1);
    const bad=pack();bad.activities.scratch.query.endpoint='https://example.com/api';r=await run('scratch',[],{pack:bad});assert.equal(r.code,1);assert.equal(r.calls.length,0);
    for(const url of ['http://api.m.jd.com/api','https://api.m.jd.com.evil/api','https://evil@api.m.jd.com/api','https://api.m.jd.com:444/api'])assert.throws(()=>target('scratch',{url:url+'?functionId=bff_rightsCenter_interaction',body:'functionId=bff_rightsCenter_interaction'}));
    const lockDir=path.join(tmp,'concurrent');let second;
    r=await run('scratch',[scratchQuery(true)],{dataDir:lockDir,onCall:()=>{second=run('scratch',[],{dataDir:lockDir});}});assert.equal(r.code,0);const blocked=await second;assert.equal(blocked.code,1);assert.equal(blocked.calls.length,0);
    r=await run('scratch',['hang'],{timeout:30});assert.equal(r.code,1);assert.equal(r.calls.length,1);
    after=await run('scratch',[scratchQuery(true)],{dataDir:r.dataDir});assert.equal(after.code,0);
    const stateFiles=[];function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())walk(file);else if(item.name==='state.json')stateFiles.push(file);}}walk(tmp);
    assert(stateFiles.length>5);for(const file of stateFiles){assert.equal(fs.statSync(file).mode&0o777,0o600);const text=fs.readFileSync(file,'utf8');assert(!text.includes('OLD_SECRET'));assert(!text.includes('NEW_SECRET'));assert(!text.includes('DEVICE_SECRET'));}
    for(const value of ['null','[]','{}','broken'])assert.throws(()=>credentials({LAZING_JD_ACTIVITY_V1:value,JD_COOKIE:cookie}));
    console.log('PASS: three independent Node tasks, refreshed Cookie, persistent single-claim guards, Loon attempt import, unknown-result stop, locks/timeouts, destination restrictions and secret-free logs/state');
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
