'use strict';
// Executes the audited Loon business cores with Node adapters. No third-party signer.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const https = require('node:https');
const crypto = require('node:crypto');
const TASKS = {
  scratch: {label:'京东每日刮卡',core:'jd-core.js',account:'JD_CHECKIN_TEST_ACCOUNT_V1',last:'JD_CHECKIN_TEST_LAST_RESULT_V1',prefix:'JD_CHECKIN_TEST_',argument:'scratch'},
  blindbox: {label:'京东PLUS盲盒',core:'jd-core.js',account:'JD_CHECKIN_TEST_ACCOUNT_V1',last:'JD_CHECKIN_TEST_LAST_RESULT_V1',prefix:'JD_CHECKIN_TEST_',argument:'blindbox'},
  jxzy: {label:'京喜自营签到',core:'jxzy-core.js',account:'JXZY_CHECKIN_ACCOUNT_V1',last:'JXZY_CHECKIN_LAST_RESULT_V1',prefix:'JXZY_CHECKIN_',argument:'manual'}
};
function fail(message) { const e=new Error(message);e.safe=true;throw e; }
function pair(cookie) {
  const fields=String(cookie||'').split(';').map(x=>x.trim());
  const keys=fields.filter(x=>x.startsWith('pt_key=')),pins=fields.filter(x=>x.startsWith('pt_pin='));
  if(keys.length!==1||pins.length!==1||!keys[0].slice(7)||!pins[0].slice(7)||/[\s\r\n]/.test(keys[0]+pins[0]))fail('登录凭据格式错误，请重新同步');
  return {pin:pins[0].slice(7),cookie:keys[0]+';'+pins[0]+';'};
}
function credentials(env) {
  let packs;
  try {packs=JSON.parse(env.LAZING_JD_ACTIVITY_V1||'null');}catch(_){fail('活动凭据格式错误，请在 Loon 重新同步活动凭据');}
  if(!packs)fail('缺少活动凭据：请更新青龙接入插件，执行“同步活动凭据”');
  packs=Array.isArray(packs)?packs:[packs];
  if(!packs.length)fail('活动凭据为空，请重新同步');
  const seen=new Set();
  for(const p of packs){
    if(!p||p.version!==1||typeof p.pin!=='string'||!p.pin||!p.activities||seen.has(p.pin))fail('活动凭据版本、账号或结构不符，请重新同步');
    seen.add(p.pin);
  }
  const cookies=String(env.JD_COOKIE||'').split(/&|\r?\n/).map(x=>x.trim()).filter(Boolean).map(pair);
  return packs.map(p=>{
    const matching=cookies.filter(x=>x.pin===p.pin);
    if(matching.length!==1)fail('活动账号须对应一条已启用的 JD_COOKIE，请检查青龙环境变量');
    return {pack:p,cookie:matching[0]};
  });
}
function overlay(profile,cookie) {
  profile=JSON.parse(JSON.stringify(profile));
  const headers=profile.headers||{},cookieKey=Object.keys(headers).find(k=>k.toLowerCase()==='cookie');
  if(!cookieKey||pair(headers[cookieKey]).pin!==cookie.pin)fail('活动凭据与登录账号不一致，请重新同步');
  const extra=String(headers[cookieKey]).split(';').map(x=>x.trim()).filter(x=>x&&!/^pt_(?:key|pin)=/.test(x));
  delete headers[cookieKey];headers.Cookie=cookie.cookie+(extra.length?extra.join(';')+';':'');
  profile.loginSource='qinglong:JD_COOKIE';
  return profile;
}
function atomic(file,data) {
  const temp=file+'.'+process.pid+'.'+crypto.randomBytes(8).toString('hex');
  try {fs.writeFileSync(temp,JSON.stringify(data),{encoding:'utf8',mode:0o600,flag:'wx'});fs.renameSync(temp,file);}
  finally {try{fs.unlinkSync(temp);}catch(_){}}
}
function acquire(file) {
  const owner={pid:process.pid,id:crypto.randomBytes(16).toString('hex'),time:Date.now()};
  {
    try {fs.writeFileSync(file,JSON.stringify(owner),{mode:0o600,flag:'wx'});return ()=>{
      try{if(JSON.parse(fs.readFileSync(file,'utf8')).id===owner.id)fs.unlinkSync(file);}catch(_){}
    };}catch(e){
      if(e.code!=='EEXIST')fail('任务锁保存失败');
      let old;try{old=JSON.parse(fs.readFileSync(file,'utf8'));}catch(_){fail('任务锁损坏，请检查任务数据目录');}
      if(!Number.isInteger(old.pid)||old.pid<1)fail('任务锁损坏，请检查任务数据目录');
      try{process.kill(old.pid,0);}
      catch(error){if(error.code==='ESRCH')fail('上次进程异常结束，请确认无任务运行后清理该任务 running.lock；领取记录须保留');throw error;}
      fail('该签到正在执行，本次未重复提交');
    }
  }
  fail('任务锁被占用，请稍后查看');
}
function target(mode,options) {
  const url=new URL(options.url);
  const allowed=mode==='jxzy'?['jxzy_active_querySign','jxzy_active_drawSign']:
    mode==='blindbox'?['bff_marketing_interaction']:['bff_rightsCenter_jdInteractTask','bff_rightsCenter_interaction'];
  const form=new URLSearchParams(options.body);
  if(url.protocol!=='https:'||url.hostname!=='api.m.jd.com'||url.port||url.username||url.password||url.hash||
    !['/api','/client.action'].includes(url.pathname)||!allowed.includes(url.searchParams.get('functionId'))||
    form.get('functionId')!==url.searchParams.get('functionId'))fail('任务请求目标不符，未发送');
  return url;
}
function transport(mode,options,callback,active) {
  let url;try{url=target(mode,options);}catch(_){callback('request blocked');return;}
  const data=String(options.body||'');let settled=false;
  const finish=(...args)=>{if(settled)return;settled=true;active.delete(req);callback(...args);};
  const req=https.request(url,{method:'POST',headers:{...options.headers,'Content-Length':Buffer.byteLength(data)},rejectUnauthorized:true},res=>{
    let size=0;const chunks=[];
    res.on('data',chunk=>{size+=chunk.length;if(size>2*1024*1024){finish('response too large');req.destroy();}else chunks.push(chunk);});
    res.on('end',()=>finish(null,{status:res.statusCode},Buffer.concat(chunks).toString('utf8')));
    res.on('error',()=>finish('response failed'));
  });
  active.add(req);req.on('error',()=>finish('network failed'));
  req.setTimeout(15000,()=>req.destroy(new Error('timeout')));req.end(data);
}
function redactor(profile,cookie) {
  const secrets=new Set([cookie.pin,pair(cookie.cookie).cookie, cookie.cookie.match(/pt_key=([^;]+)/)[1]]);
  function collect(value,key=''){
    if(typeof value==='string'&&value.length>=4&&/cookie|token|environment|uuid|openudid|eid|h5st/i.test(key))secrets.add(value);
    else if(value&&typeof value==='object')for(const [k,v]of Object.entries(value))collect(v,k);
  }
  collect(profile);
  return value=>{let s=String(value);for(const secret of [...secrets].sort((a,b)=>b.length-a.length))s=s.split(secret).join('[已隐藏]');return s.replace(/pt_key=[^;\s"\\]+/g,'pt_key=[已隐藏]').slice(0,6000);};
}
async function execute(mode,entry,options={}) {
  const spec=TASKS[mode],profile=entry.pack.activities[mode];
  if(!profile)fail('缺少该活动凭据，请在 Loon 开启对应活动获取开关、进入活动页后同步');
  const current=overlay(profile,entry.cookie),redact=redactor(current,entry.cookie);
  const base=options.dataDir||process.env.LAZING_JD_DATA_DIR||'/ql/data/lazing-jd';
  const dir=path.join(base,crypto.createHash('sha256').update(entry.pack.pin).digest('hex').slice(0,24),mode);
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const release=acquire(path.join(dir,'running.lock'));
  const file=path.join(dir,'state.json');
  let stored={},completed=false,watchdog;const timers=new Set(),active=new Set(),notices=[];
  try{
    if(fs.existsSync(file)){try{stored=JSON.parse(fs.readFileSync(file,'utf8'));}catch(_){fail('任务数据损坏；为避免重复领取，本次停止');}}
    if(!stored||typeof stored!=='object'||Array.isArray(stored))fail('任务数据结构错误；本次停止');
    // A dead Node process cannot still own an in-core timer lock.
    for(const key of Object.keys(stored))if(/_LOCK_/.test(key))delete stored[key];
    const attemptKey=mode==='jxzy'?'JXZY_CHECKIN_ATTEMPT_V1':'JD_CHECKIN_TEST_ATTEMPT_'+mode;
    const imported=entry.pack.attempts&&entry.pack.attempts[mode];
    let existing;try{existing=JSON.parse(stored[attemptKey]||'null');}catch(_){fail('领取记录损坏；本次停止');}
    if(imported&&imported.pin===entry.pack.pin&&/^\d{4}-\d{2}-\d{2}$/.test(imported.date)&&(!existing||imported.date>existing.date)){
      stored[attemptKey]=JSON.stringify(imported);atomic(file,stored);
    }
    const account=mode==='jxzy'?current:{pin:entry.pack.pin,modes:{[mode]:current}};
    let finish,reject;const done=new Promise((resolve,no)=>{finish=resolve;reject=no;});
    const sandbox={
      console:{log:(...args)=>(options.log||console.log)(redact(args.join(' ')))},
      $argument:spec.argument,
      $persistentStore:{read:key=>key===spec.account?JSON.stringify(account):stored[key]||'',write:(value,key)=>{
        if(completed||!key.startsWith(spec.prefix)||key===spec.account)return false;
        if(value===undefined||value===null||value==='')delete stored[key];else stored[key]=String(value);
        atomic(file,stored);return true;
      }},
      $notification:{post:(...args)=>notices.push(args.map(redact))},
      $httpClient:{post:(params,cb)=>{
        if(completed)return;
        try{target(mode,params);(options.transport||transport)(mode,params,(...args)=>{if(!completed)cb(...args);},active);}catch(_){cb('request failed');}
      }},
      $done:()=>{completed=true;finish();},
      setTimeout:(fn,ms,...args)=>{const t=setTimeout(()=>{timers.delete(t);if(!completed)fn(...args);},ms);timers.add(t);return t;},
      clearTimeout:t=>{timers.delete(t);clearTimeout(t);},
      setInterval:(fn,ms,...args)=>{const t=setInterval(()=>{if(!completed)fn(...args);},ms);timers.add(t);return t;},
      clearInterval:t=>{timers.delete(t);clearInterval(t);}
    };
    watchdog=setTimeout(()=>reject(new Error('timeout')),options.timeout||120000);
    const returned=vm.runInNewContext(fs.readFileSync(path.join(__dirname,spec.core),'utf8'),sandbox,{timeout:10000,filename:spec.core});
    if(returned&&typeof returned.catch==='function')returned.catch(reject);
    await done;
    let result;try{result=JSON.parse(stored[spec.last]||'null');}catch(_){}
    if(!result)fail('任务未保存本次结果，请查看日志');
    const summary=notices.length?notices[notices.length-1][2]:result.message;
    const ok=['reward_received','box_confirmed','already_done','no_chance','signed_confirmed'].includes(result.status);
    return {ok,message:redact(summary||'请查看日志'),result};
  }finally{
    completed=true;clearTimeout(watchdog);for(const timer of timers){clearTimeout(timer);clearInterval(timer);}for(const req of active)req.destroy();release();
  }
}
async function notify(title,message) {
  for(const file of [path.join(__dirname,'..','..','sendNotify.js'),'/ql/data/scripts/sendNotify.js']){
    if(fs.existsSync(file)){
      try{await require(file).sendNotify(title,message);return;}catch(_){console.log('[京东独立签到] 通知发送失败，请查看任务日志');return;}
    }
  }
  console.log('[京东独立签到] 未找到 sendNotify.js，结果已写入本次日志');
}
async function main(mode,options={}) {
  const spec=TASKS[mode];if(!spec)throw new Error('unknown task');
  const log=options.log||console.log;let entries;
  try{entries=credentials(options.env||process.env);}catch(e){const text=e.safe?e.message:'凭据读取失败';log('['+spec.label+'] '+text);if(!options.noNotify)await notify(spec.label+'：失败',text);return 1;}
  const lines=[];let code=0;
  for(let i=0;i<entries.length;i++){
    log('['+spec.label+'] 开始账号 '+(i+1));
    try{const outcome=await execute(mode,entries[i],options);if(!outcome.ok)code=1;lines.push('账号'+(i+1)+'：'+outcome.message);}
    catch(e){code=1;lines.push('账号'+(i+1)+'：'+(e.safe?e.message:'执行异常或超时，未自动重试，请查看任务数据和活动页面'));}
  }
  const message=lines.join('\n');log(message);
  if(!options.noNotify)await notify(spec.label+'：'+(code?'失败':'成功'),message);
  return code;
}
module.exports={main,execute,credentials,pair,target,TASKS};
