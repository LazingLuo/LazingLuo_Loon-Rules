// Offline Node adapter + actual embedded AAR2 SDK. Every HTTP call is mocked.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {main,target}=require('./function/runtime');
const init=fs.readFileSync(process.env.JR_AAR_INIT_FIXTURE||'/private/tmp/jr-aar2-init-response.txt','utf8');
const day=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
const A='JD_JR_CHECKIN_ACCOUNT_V1',L='JD_JR_CHECKIN_LAST_RESULT_V1',T='JD_JR_CHECKIN_ATTEMPT_V1',D='JD_JR_DOUBLE_SIGN_ATTEMPT_V1';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lazing-finance-test-'));let number=0;
function profile(){return {pin:'offline',ready:true,capturedAt:Date.now(),headers:{Cookie:'pt_pin=offline;pt_key=FINANCE_SECRET;finance_session=KEEP_FINANCE;','User-Agent':'offline-test','Content-Type':'application/x-www-form-urlencoded'},
  query:{channelSource:'JRAPP6.0',site:'JD_JR_APP',channelLv:'guangab',signVersion:12,clientVersion:'8.2.70',clientType:'ios'},riskDeviceParam:'RISK_DEVICE_SECRET',
  doubleSign:{pin:'offline',headers:{Cookie:'pt_pin=offline;pt_key=FINANCE_SECRET;','x-mlaas-at':'DOUBLE_DEVICE_SECRET'}}};}
const cash=data=>({success:true,resultCode:0,resultData:{resBusiCode:0,resBusiData:data}});
const state=done=>cash({sign:done,today:day().replace(/-/g,''),hcDays:done?4:3,dailyCash:{current:{amount:'0.02'}}});
const award=()=>cash({signType:'sign',todaySignAmount:0.02});
const page=(claimed,{jd=true,jr=true,date=day()}={})=>({success:true,resultCode:0,resultData:{hasError:false,resultList:[{templateData:{data:{businessCode:'000sq',businessData:{dateTime:date+' 01:00:00',signInJd:jd,signInJr:jr,get:claimed}}}}]}});
const doubleAward=()=>({success:true,resultCode:0,resultData:{code:'YES',result:{businessCode:'000sq',businessData:{businessCode:'000sq',businessData:{sendSuccessYn:true,createTime:day()+' 01:00:01',awardListVo:[{count:2,name:'京豆+2',type:1}]}}}}});
async function run(replies=[],opts={}){
  const calls=[],logs=[],dataDir=opts.dataDir||path.join(tmp,String(++number)),pack={version:1,pin:'offline',activities:{finance:opts.profile||profile()},attempts:opts.attempts||{}};
  const code=await main('finance',{env:opts.env||{JD_COOKIE:'pt_key=RETAIL_SECRET;pt_pin=offline;',LAZING_JD_ACTIVITY_V1:JSON.stringify(pack)},dataDir,noNotify:true,timeout:opts.timeout||10000,log:s=>logs.push(s),transport:(mode,opt,cb)=>{
    calls.push(opt);
    if(opt.url.includes('/aar2/getJS')){
      assert(!Object.keys(opt.headers||{}).some(k=>/cookie|authorization/i.test(k)));
      return setImmediate(()=>cb(null,{status:200},init));
    }
    assert(opt.headers.Cookie.includes('FINANCE_SECRET'));assert(opt.headers.Cookie.includes('KEEP_FINANCE'));assert(!opt.headers.Cookie.includes('RETAIL_SECRET'));
    if(opt.url.includes('/legogw/')||opt.url.includes('/DoubleSign/'))assert.equal(opt.headers['x-mlaas-at'],'DOUBLE_DEVICE_SECRET');
    const reply=replies.shift();if(reply===undefined)throw new Error('unexpected HTTP');if(reply==='hang')return;
    setImmediate(()=>reply==='network'?cb('offline failure'):cb(null,{status:200},JSON.stringify(reply)));
  }});
  const text=logs.join('\n');for(const secret of ['FINANCE_SECRET','RETAIL_SECRET','RISK_DEVICE_SECRET','DOUBLE_DEVICE_SECRET'])assert(!text.includes(secret),'secret leaked');
  let stored;for(const account of fs.existsSync(dataDir)?fs.readdirSync(dataDir):[]){const f=path.join(dataDir,account,'finance','state.json');if(fs.existsSync(f)){stored=JSON.parse(fs.readFileSync(f,'utf8'));assert.equal(fs.statSync(f).mode&0o777,0o600);assert(!fs.existsSync(path.join(path.dirname(f),'running.lock')));}}
  const result=stored&&JSON.parse(stored[L]||'null');return{code,calls,logs,dataDir,stored,result};
}
(async()=>{try{
  let r=await run([state(false),award(),state(true),page(false),doubleAward(),page(true)]);
  assert.equal(r.code,0);assert.equal(r.calls.length,7);assert.equal(r.result.status,'signed_confirmed');assert.equal(r.result.doubleSign.status,'signed_confirmed');assert.equal(r.result.doubleSign.beanQuantity,2);assert(r.stored[T]);assert(r.stored[D]);assert(!r.stored[A]);
  const sent=JSON.parse(new URLSearchParams(r.calls[2].body).get('reqData'));assert.equal(sent.nonce.length,20);assert.equal(sent.signature.length,66);assert.equal(sent.userDay,day().replace(/-/g,''));assert.equal(JSON.parse(sent.signData).riskDeviceParam,'RISK_DEVICE_SECRET');
  assert.deepEqual(r.calls.map(x=>new URL(x.url).pathname.split('/').pop()),['queryWeekSignMain','getJS','dailyCashSignReceive','queryWeekSignMain','getPageInfoDoubleSignInForH5','jrSendSignAward','getPageInfoDoubleSignInForH5']);
  let again=await run([state(true),page(true)],{dataDir:r.dataDir});assert.equal(again.code,0);assert.equal(again.calls.length,2);
  again=await run([state(false)],{dataDir:r.dataDir});assert.equal(again.code,1);assert.equal(again.calls.length,1);
  r=await run([state(true),page(false),doubleAward(),page(true)]);assert.equal(r.code,0);assert.equal(r.calls.length,4);assert(!r.calls.some(x=>x.url.includes('/aar2/')));assert(!r.stored[T]);assert(r.stored[D]);
  again=await run([state(true),page(false)],{dataDir:r.dataDir});assert.equal(again.code,1);assert.equal(again.calls.length,2);assert.equal(again.result.status,'already_done');assert.equal(again.result.doubleSign.status,'stopped');
  r=await run([state(true),page(false,{jd:false})]);assert.equal(r.code,0);assert.equal(r.result.doubleSign.status,'not_eligible');assert(!r.stored[D]);
  r=await run([state(true),page(false),'network']);assert.equal(r.code,1);assert.equal(r.result.status,'already_done');assert(r.stored[D]);
  again=await run([state(true),page(false)],{dataDir:r.dataDir});assert.equal(again.code,1);assert.equal(again.calls.length,2);
  r=await run([state(false),'network']);assert.equal(r.code,1);assert.equal(r.calls.length,3);assert(r.stored[T]);assert(!r.stored[D]);
  again=await run([state(false)],{dataDir:r.dataDir});assert.equal(again.calls.length,1);
  r=await run([state(true),page(false),doubleAward(),'network']);assert.equal(r.code,1);assert.equal(r.result.doubleSign.status,'claim_success_verify_unconfirmed');assert(r.stored[D]);
  r=await run([state(false)],{attempts:{finance:{pin:'offline',date:day(),time:Date.now()}}});assert.equal(r.code,1);assert.equal(r.calls.length,1);
  r=await run([state(true),page(false)],{attempts:{financeDouble:{pin:'offline',date:day(),time:Date.now()}}});assert.equal(r.code,1);assert.equal(r.calls.length,2);
  r=await run([{success:true,resultCode:0,resultData:{resBusiCode:1000,resBusiMsg:'未登录'}}]);assert.equal(r.code,1);assert.equal(r.calls.length,1);assert(!r.stored[T]);
  r=await run([state(true),page(false,{date:'2000-01-01'})]);assert.equal(r.code,1);assert.equal(r.result.doubleSign.status,'stopped');assert(!r.stored[D]);
  for(const p of [{...profile(),pin:'other'},{...profile(),doubleSign:{pin:'other'}},{...profile(),headers:{Cookie:'pt_pin=offline;'}}]){r=await run([],{profile:p});assert.equal(r.code,1);assert.equal(r.calls.length,0);}
  const p=profile();r=await run([state(true),page(true)],{env:{LAZING_JD_ACTIVITY_V1:JSON.stringify({version:1,pin:'offline',activities:{finance:p}})}});assert.equal(r.code,0);
  for(const url of ['https://api.m.jd.com/api','http://ms.jr.jd.com/gw2/generic/jrSign/h5/m/dailyCashSignReceive','https://ms.jr.jd.com/gw2/generic/other/h5/m/foo','https://aks.jdpay.com/aar2/getJS?version=4&name=browser'])assert.throws(()=>target('finance',{url,body:'reqData=%7B%7D'}));
  assert.throws(()=>target('finance',{url:'https://aks.jdpay.com/aar2/getJS?version=2.1.0&name=browser',headers:{Cookie:'FINANCE_SECRET'}}));
  r=await run(['hang'],{timeout:30});assert.equal(r.code,1);again=await run([state(true),page(true)],{dataDir:r.dataDir});assert.equal(again.code,0);
  console.log('PASS: Node finance + double-sign, actual AAR2 signing, financial Cookie isolation, eligible-only double claim, durable separate attempt guards/import, partial failures, secret redaction, endpoint restrictions and timeout release. No live requests.');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
