// Offline: mock Qinglong read API, Telegram and Bark; never sends a real notification.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {channels,bounded,proxyUrl,request}=require('./function/report-notify');
const {main,collect,classify,render,assets,due,fileOf,panelUrl}=require('./function/report');
const now=Date.parse('2026-10-15T14:00:00Z'),today='2026-10-15',seconds=now/1000;
const env={LAZING_JD_REPORT_CLIENT_ID:'CLIENT_TEST',LAZING_JD_REPORT_CLIENT_SECRET:'SECRET_TEST',LAZING_JD_REPORT_TG_BOT_TOKEN:'123456789:TEST_TOKEN_abcdefghijklmnop',LAZING_JD_REPORT_TG_CHAT_ID:'123456789',LAZING_JD_REPORT_TG_PROXY_URL:'http://mihomo:7890'};
function task(id,file,name='测试任务',time=seconds-3600,schedule='0 1 * * *'){return{id,name,command:'task repo/'+file+'.js',last_execution_time:time,schedule,status:1,isDisabled:0};}
const own=(record)=>({code:200,logStatus:'completed',data:'[签到] '+JSON.stringify({time:now-1000,date:today,...record})});
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lazing-report-test-'));let seq=0;
function transport(tasks,logs,opts={}){
  const calls=[];
  async function send(url,method,body,headers,options){
    calls.push({url,method,body,headers,options});
    if(url.startsWith('https://api.telegram.org/bot')){
      assert.equal(method,'POST');assert.equal(body.chat_id,env.LAZING_JD_REPORT_TG_CHAT_ID);assert.equal(body.parse_mode,undefined);assert(body.text.length<=4096);assert.equal(options.proxyUrl,'http://mihomo:7890/');
      if(opts.pushError)throw Error('SECRET_TEST timeout');return opts.reject?{ok:false,error_code:400,description:'secret TEST_TOKEN_abcdefghijklmnop'}:opts.serverError?{ok:false,error_code:500}:{ok:true,result:{message_id:8}};
    }
    if(url==='https://api.day.app/push'){
      assert.equal(method,'POST');assert.equal(body.device_key,'BARK_TEST_SECRET');assert.equal(body.group,'京东日报');assert(Buffer.byteLength(JSON.stringify(body))<3500);assert.equal(options.proxyUrl,undefined);
      return opts.barkReject?{code:400}:{code:200};
    }
    assert.equal(options,undefined,'panel request must not inherit Telegram proxy');
    assert.equal(method,'GET','report must not mutate Qinglong');assert(url.startsWith('http://127.0.0.1:5700/open/'));
    if(url.includes('/auth/token?'))return{code:200,data:{token:'API_TEST_TOKEN'}};
    assert.equal(headers.Authorization,'Bearer API_TEST_TOKEN');
    if(url.endsWith('/crons'))return{code:200,data:tasks};
    const id=Number(url.match(/\/crons\/(\d+)\/log/)[1]);if(opts.logError===id)throw Error('SECRET_TEST');return logs[id]||{code:200,data:'',logStatus:'notFound'};
  }
  return{send,calls};
}
(async()=>{try{
  // Cron semantics: comma/steps, monthly/weekly, seconds and not-yet-due jobs.
  for(const cron of ['0 22 * * *','21 7-21/2 * * *','10 10,15 * * *','0 0 * * *','0 12 15 * 0'])assert.equal(due(cron,now),true,cron);
  for(const cron of ['1 22 * * *','0 23 * * *','0 0 29 2 *','0 0 * * 1','30 0 22 * * *'])assert.equal(due(cron,now),false,cron);
  for(const cron of ['bad','0 1 * * MON','0,99 * * * *'])assert.equal(due(cron,now),null,cron);
  assert.equal(fileOf(task(1,'lazing_jd_finance')),'lazing_jd_finance');assert.throws(()=>panelUrl('http://example.com:5700'));assert.throws(()=>panelUrl('https://secret@example.com'));
  const r=classify(task(1,'lazing_jd_scratch'),own({mode:'scratch',status:'reward_received',beanQuantity:3}),now);assert.equal(r.status,'success');assert(r.text.includes('3 京豆'));
  const finance=classify(task(2,'lazing_jd_finance'),own({mode:'manual',status:'signed_confirmed',amount:'0.02',days:5,doubleSign:{status:'signed_confirmed',beanQuantity:2}}),now);assert.equal(finance.status,'success');assert(finance.text.includes('0.02 元'));assert(finance.text.includes('2 京豆'));
  const partial=classify(task(2,'lazing_jd_finance'),own({status:'already_done',doubleSign:{status:'stopped',message:'网络超时 SECRET_TEST'}}),now);assert.equal(partial.status,'failure');assert(partial.text.includes('今天已完成'));assert(!partial.text.includes('SECRET_TEST'));
  assert.equal(classify(task(2,'lazing_jd_plus'),own({status:'claim_unconfirmed'}),now).status,'pending');
  assert.equal(classify(task(2,'lazing_jd_scratch'),own({status:'stopped',message:'今天已有领取提交记录'}),now).status,'pending');
  assert.equal(classify(task(2,'lazing_jd_plus'),own({status:'no_chance'}),now).status,'success');
  const faker=(text)=>({code:200,logStatus:'completed',data:text});
  assert.equal(classify(task(3,'jd_hdyxzd'),faker('apStartTaskTime => Response code 403 (Forbidden)\n## 完成 ✅'),now).status,'failure');
  assert.equal(classify(task(3,'jd_x'),faker('## 完成 ✅'),now).status,'pending');
  assert.equal(classify(task(3,'jd_x'),faker('签到失败：已签到了吧！\n## 失败 ❌(退出码 1)'),now).status,'failure');
  assert.equal(classify(task(3,'jd_x'),faker('签到成功...\n获得 5 京豆\n## 完成 ✅'),now).status,'success');
  assert.equal(classify(task(3,'jd_x'),faker('今日已签到'),now).status,'success');
  assert.equal(classify(task(3,'jd_x','旧任务',seconds-86400),faker('签到成功...'),now).status,'not_run');
  assert.equal(classify(task(3,'jd_x','晚间任务',seconds-86400,'0 23 * * *'),faker('签到成功...'),now).status,'not_due');
  assert.equal(classify({...task(3,'jd_x'),status:0},faker('签到成功...'),now).status,'running');
  assert.equal(classify(task(3,'jd_x'),{data:'',logStatus:'ignored'},now).status,'pending');
  const a='----------开始查询【账号1】PRIVATE_ACCOUNT-----------\n【当前京豆】100豆(≈1元)\n【今日京豆】收20豆支5豆\n【昨日京豆】收18豆支8豆\n【京豆变动】15豆(与昨日21:10比较)\n【红包总额】1.25元\n【钱包余额】0.02元\npt_key=SECRET_TEST;token=PUSHPLUS_TEST_TOKEN;';
  const snapshot=assets(a);assert.equal(snapshot.length,1);assert(snapshot[0].includes('今日收入 20、支出 5'));assert(snapshot[0].includes('较昨日21:10净变动 +15'));assert(!snapshot[0].includes('PRIVATE_ACCOUNT'));
  const tasks=[task(1,'lazing_jd_scratch','刮卡'),task(2,'lazing_jd_finance','金融'),task(3,'jd_hdyxzd','互动游戏'),task(4,'jd_bean_change','京东资产统计'),task(5,'jd_x','今天漏执行',seconds-86400),task(6,'jd_low','低频占位',0,'0 0 29 2 *'),{...task(7,'jd_off','禁用'),isDisabled:1},task(8,'lazing_jd_report','日报本身'),task(9,'other','无关任务')];
  const logs={1:own({status:'reward_received',beanQuantity:3}),2:own({status:'signed_confirmed',amount:'0.02',doubleSign:{status:'signed_confirmed',beanQuantity:2}}),3:faker('apStartTaskTime => Response code 403 (Forbidden)'),4:faker(a)};
  const t=transport(tasks,logs);const content=await collect(env,now,t.send);assert(content.includes('成功 3｜失败 1｜未执行 1'));assert(content.includes('资产快照'));assert(content.includes('未到计划时间'));assert(!content.includes('PRIVATE_ACCOUNT'));
  for(const secret of ['SECRET_TEST','API_TEST_TOKEN',env.LAZING_JD_REPORT_TG_BOT_TOKEN,'BARK_TEST_SECRET'])assert(!content.includes(secret));
  assert(!t.calls.some(x=>/\/crons\/(5|7|8|9)\//.test(x.url)));
  let dataDir=path.join(tmp,String(++seq)),messages=[];
  let code=await main({env,now,dataDir,request:t.send,log:x=>messages.push(x)});assert.equal(code,0);assert.equal(t.calls.filter(x=>x.method==='POST').length,1);
  code=await main({env,now,dataDir,request:t.send,log:x=>messages.push(x)});assert.equal(code,0);assert.equal(t.calls.filter(x=>x.method==='POST').length,1);
  for(const secret of ['SECRET_TEST','API_TEST_TOKEN',env.LAZING_JD_REPORT_TG_BOT_TOKEN,'BARK_TEST_SECRET'])assert(!messages.join('\n').includes(secret));
  const journal=JSON.parse(fs.readFileSync(path.join(dataDir,'report','push-telegram.json'),'utf8'));assert.equal(journal.state,'accepted');assert.equal(fs.statSync(path.join(dataDir,'report','push-telegram.json')).mode&0o777,0o600);
  const preview=transport(tasks,logs);code=await main({env,now,dataDir:path.join(tmp,String(++seq)),preview:true,request:preview.send,log(){}});assert.equal(code,0);assert(!preview.calls.some(x=>x.method==='POST'));
  const uncertain=transport(tasks,logs,{pushError:true});dataDir=path.join(tmp,String(++seq));code=await main({env,now,dataDir,request:uncertain.send,log(){}});assert.equal(code,1);
  code=await main({env,now,dataDir,request:uncertain.send,log(){}});assert.equal(code,0);assert.equal(uncertain.calls.filter(x=>x.method==='POST').length,1);
  const rejected=transport(tasks,logs,{reject:true});dataDir=path.join(tmp,String(++seq));assert.equal(await main({env,now,dataDir,request:rejected.send,log(){}}),1);
  const fixed=transport(tasks,logs);assert.equal(await main({env,now,dataDir,request:fixed.send,log(){}}),0);assert.equal(fixed.calls.filter(x=>x.method==='POST').length,1);
  const missing=[];assert.equal(await main({env:{},now,request:async()=>{throw Error('must not call');},log:x=>missing.push(x)}),1);
  const noAuth=transport([],{});dataDir=path.join(tmp,String(++seq));assert.equal(await main({env:{LAZING_JD_REPORT_TG_BOT_TOKEN:env.LAZING_JD_REPORT_TG_BOT_TOKEN,LAZING_JD_REPORT_TG_CHAT_ID:env.LAZING_JD_REPORT_TG_CHAT_ID,LAZING_JD_REPORT_TG_PROXY_URL:env.LAZING_JD_REPORT_TG_PROXY_URL},now,dataDir,request:noAuth.send,log(){}}),0);assert.equal(noAuth.calls.length,1);assert(noAuth.calls[0].body.text.includes('读取失败'));
  const unreadable=transport(tasks,logs,{logError:3});assert((await collect(env,now,unreadable.send)).includes('互动游戏：日志未能读取'));
  const names=render([{name:'测试',status:'pending',text:'业务结果待确认',assetLines:[]}],now);assert(names.includes('待确认 1'));
  // Independent channel journals: a rejection in one must not repeat the other.
  const both={...env,LAZING_JD_REPORT_BARK_URL:'https://api.day.app/BARK_TEST_SECRET'};
  const first=transport(tasks,logs,{reject:true});dataDir=path.join(tmp,String(++seq));
  assert.equal(await main({env:both,now,dataDir,request:first.send,log(){}}),1);assert.equal(first.calls.filter(x=>x.method==='POST').length,2);
  const retry=transport(tasks,logs);assert.equal(await main({env:both,now,dataDir,request:retry.send,log(){}}),0);assert.equal(retry.calls.filter(x=>x.method==='POST').length,1);assert(retry.calls.some(x=>x.url.includes('api.telegram.org')));
  const barkOnly=transport([],{});dataDir=path.join(tmp,String(++seq));assert.equal(await main({env:{LAZING_JD_REPORT_BARK_URL:both.LAZING_JD_REPORT_BARK_URL,LAZING_JD_REPORT_CLIENT_ID:'x',LAZING_JD_REPORT_CLIENT_SECRET:'y'},now,dataDir,request:barkOnly.send,log(){}}),0);assert(!barkOnly.calls.some(x=>x.url.includes('telegram')));
  const ambiguous=transport([],{},{serverError:true});dataDir=path.join(tmp,String(++seq));assert.equal(await main({env,now,dataDir,request:ambiguous.send,log(){}}),1);assert.equal(await main({env,now,dataDir,request:ambiguous.send,log(){}}),0);assert.equal(ambiguous.calls.filter(x=>x.method==='POST').length,1);
  const long=channels(both,'京东日报','中文😀'.repeat(5000));assert(long[0].body.text.length<=4000);assert(!/\uD800$|\uD83D$/.test(long[0].body.text));assert(Buffer.byteLength(JSON.stringify(long[1].body))<3500);assert(long.every(x=>(x.body.text||x.body.body).includes('完整内容')));
  assert.equal(channels({TG_BOT_TOKEN:env.LAZING_JD_REPORT_TG_BOT_TOKEN,BARK_PUSH:both.LAZING_JD_REPORT_BARK_URL,LAZING_JD_REPORT_PUSHPLUS_TOKEN:'OLD_TOKEN'},'t','x').length,0);
  assert.throws(()=>channels({LAZING_JD_REPORT_TG_BOT_TOKEN:env.LAZING_JD_REPORT_TG_BOT_TOKEN},'',''));
  for(const bad of ['http://api.day.app/abcdef','https://api.day.app/abcdef/test','https://api.day.app/key?x=y','https://secret@api.day.app/abcdef'])assert.throws(()=>channels({LAZING_JD_REPORT_BARK_URL:bad},'',''));
  for(const bad of ['socks5://mihomo:7890','http://secret@proxy:7890','http://mihomo:7890/path'])assert.throws(()=>proxyUrl(bad));
  const nested=channels({LAZING_JD_REPORT_BARK_URL:'https://example.org/bark/ABCDEF_KEY/'},'t','x');assert.equal(nested[0].url,'https://example.org/bark/push');
  // Old PushPlus journal does not suppress the new channel after migration.
  dataDir=path.join(tmp,String(++seq));fs.mkdirSync(path.join(dataDir,'report'),{recursive:true});fs.writeFileSync(path.join(dataDir,'report','push.json'),JSON.stringify({date:today,state:'accepted'}));const migration=transport([],{});assert.equal(await main({env,now,dataDir,request:migration.send,log(){}}),0);assert.equal(migration.calls.filter(x=>x.method==='POST').length,1);
  console.log('PASS: read-only report, cron/date/results/assets, Telegram/Bark dedicated configuration, proxy isolation, payload limits, previews, independent daily dedupe, definitive rejection retries and ambiguous-send guards; no live requests.');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
