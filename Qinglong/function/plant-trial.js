'use strict';
// Experimental adapter for four task mutations and their two existing queries.
// The upstream file stays unchanged on disk; all other upstream operations retain
// their existing behavior. This is not a security sandbox for the Faker script.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),https=require('node:https');
const signer=require('./plant-signer');
const VERSION='2026-10-18.1';
// Hash the audited source after normalizing only a leading UTF-8 BOM, line
// endings and trailing file whitespace. An extra newline in a review copy must
// not reject the byte-exact GitHub file. All substantive code remains pinned.
const EXPECTED='0e0f582b8f1ab05cc666bad46342e6a82cd60e956eabb9a0a1905c4d62b8748d';
const MARKER='async function sgySJb_(vcYj9Vz,...doOZbP){';
const IDS={apTaskList:null,apTaskDetail:null,apStartTaskTime:'acb1e',apDoLimitTimeTask:'ebecc',apsDoTask:'54ed7',apTaskDrawAward:'f0f3f'};
// The authenticated phone start request uses a separate routing appid. Its
// signing application remains acb1e; completion/list requests keep the old appid.
const APPIDS={apStartTaskTime:'activity_platform_se'};
function safe(message){const e=Error(message);e.safe=true;return e;}
function pair(cookie){
 const fields=String(cookie||'').split(';').map(s=>s.trim()).filter(Boolean);
 const key=fields.filter(s=>s.startsWith('pt_key=')),pin=fields.filter(s=>s.startsWith('pt_pin='));
 if(key.length!==1||pin.length!==1||!key[0].slice(7)||!pin[0].slice(7)||/[\r\n\s]/.test(key[0]+pin[0]))throw safe('京东登录凭据格式不正确');
 return {pin:pin[0].slice(7),key:key[0].slice(7),cookie:key[0]+';'+pin[0]+';'};
}
function header(headers,name){const k=Object.keys(headers||{}).find(k=>k.toLowerCase()===name.toLowerCase());return k?headers[k]:'';}
function packs(env){
 let data;try{data=JSON.parse(env.LAZING_JD_ACTIVITY_V1||'null');}catch(_){throw safe('活动凭据格式错误，请在Loon重新同步');}
 data=Array.isArray(data)?data:[data];const profiles=new Map();
 for(const p of data){
  if(!p||p.version!==1||typeof p.pin!=='string'||profiles.has(p.pin))throw safe('缺少或存在重复的活动账号，请同步活动凭据');
  const profile=p.activities&&p.activities.plantTasks;
  if(!profile||profile.version!==1||profile.pin!==p.pin||!profile.ready||profile.linkId!=='4HcenxuZM4XiHesOb1HG4g')throw safe('缺少完整种豆任务上下文：请更新Loon青龙接入，完成一次种豆浏览任务，再同步活动凭据');
  if(pair(header(profile.headers,'Cookie')).pin!==p.pin)throw safe('种豆任务上下文账号不匹配');
  for(const fid of ['apTaskList','apStartTaskTime','apDoLimitTimeTask']){
   const t=profile.templates&&profile.templates[fid];
   if(!t||t.endpoint!=='https://api.m.jd.com/api'||!t.params||!t.headers||pair(header(t.headers,'Cookie')).pin!==p.pin)throw safe('种豆任务模板不完整或账号不一致，请重新获取');
   for(const key of ['client','clientVersion','x-api-eid-token','uuid','wg-sdk-token'])if(typeof t.params[key]!=='string'||!t.params[key])throw safe('种豆任务缺少页面及设备参数，请重新获取');
   if(t.params.uuid!==profile.uuid||t.params.clientVersion!==profile.clientVersion||header(t.headers,'User-Agent')!==header(profile.headers,'User-Agent'))throw safe('种豆任务模板来自不同设备或版本，请重新获取');
   if(t.params.appid!==(APPIDS[fid]||'activities_platform'))throw safe('种豆任务路由参数变化，请核对手机成功请求');
   if(IDS[fid]){
    if(t.signatureAppId!==IDS[fid]||!t.signatureParameterEncoding)throw safe('种豆任务签名配置不完整');
    try{signer.environment({query:t},p.pin);}catch(_){throw safe('种豆任务签名环境不匹配或不兼容，请重新获取');}
   }
  }
  profiles.set(p.pin,{profile});
 }
 return profiles;
}
function build(fid,args,linkId){
 if(!Object.hasOwn(IDS,fid)||typeof linkId!=='string'||!linkId)throw safe('任务接口或活动编号不完整');
 const task={taskType:args[0],taskId:args[1],channel:4,checkVersion:true,linkId,pipeExt:args[2]};
 switch(fid){
  case 'apTaskList':return {linkId,queryType:args[0]||0,channel:4,area:''};
  case 'apTaskDetail':return task;
  case 'apStartTaskTime':return {linkId,taskId:args[0],itemId:args[1],taskInsert:false,channel:4,pipeExt:args[2],...(args[3]?{itemType:args[3]}:{})};
  case 'apDoLimitTimeTask':return {linkId};
  case 'apsDoTask':return {...task,taskInsert:false};
  case 'apTaskDrawAward':return task;
 }
}
function transport(options){
 return new Promise((resolve,reject)=>{
  let u;try{u=new URL(options.url);}catch(_){return reject(safe('请求地址错误'));}
  if(u.protocol!=='https:'||u.hostname!=='api.m.jd.com'||u.pathname!=='/api'||u.username||u.password||u.port||u.hash)return reject(safe('任务请求地址不符'));
  const form=new URLSearchParams(options.body);
  if(!Object.hasOwn(IDS,form.get('functionId'))||u.searchParams.size!==1||u.searchParams.get('functionId')!==form.get('functionId'))return reject(safe('任务接口不符'));
  const req=https.request(u,{method:'POST',headers:{...options.headers,'Content-Length':Buffer.byteLength(options.body)},rejectUnauthorized:true},res=>{
   const chunks=[];let bytes=0;
   res.on('data',chunk=>{bytes+=chunk.length;if(bytes>2*1024*1024)req.destroy(safe('响应过大'));else chunks.push(chunk);});
   res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8')}));
   res.on('error',()=>reject(safe('响应接收失败')));
  });
  req.setTimeout(15000,()=>req.destroy(safe('请求超时')));req.on('error',()=>reject(safe('网络请求失败')));req.end(options.body);
 });
}
function atomic(file,value){const tmp=file+'.'+process.pid+'.'+crypto.randomBytes(8).toString('hex');try{fs.writeFileSync(tmp,JSON.stringify(value),{mode:0o600,flag:'wx'});fs.renameSync(tmp,file);}finally{try{fs.unlinkSync(tmp);}catch(_){}}}
function create(options={}){
 const env=options.env||process.env,profiles=packs(env),sessions=new Map();
 const send=options.transport||transport,log=options.log||console.log;
 const base=options.dataDir||env.LAZING_JD_DATA_DIR||'/ql/data/lazing-jd';
 function session(cookie){
  const login=pair(cookie),selected=profiles.get(login.pin);
  if(!selected)throw safe('该账号没有已同步的手机活动环境');
  if(sessions.has(login.pin))return sessions.get(login.pin);
  const dir=path.join(base,crypto.createHash('sha256').update(login.pin).digest('hex').slice(0,24),'plant-trial');fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const lock=path.join(dir,'running.lock'),owner=crypto.randomBytes(16).toString('hex');
  try{fs.writeFileSync(lock,JSON.stringify({pid:process.pid,owner}),{mode:0o600,flag:'wx'});}catch(_){throw safe('种豆试验入口正在执行或留有异常退出的锁，请检查后再运行');}
  const file=path.join(dir,'state.json');let state;
  try{state=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};if(!state||typeof state!=='object'||Array.isArray(state))throw Error();}catch(_){fs.unlinkSync(lock);throw safe('种豆任务提交记录损坏，已停止');}
  const s={...selected,login,file,lock,owner,state,validated:new Set(),started:new Set(),blocked:false};sessions.set(login.pin,s);
  if(state.pending)s.blocked=true;
  log('[种豆任务试验] 使用种豆任务专用页面上下文；未借用刮卡或PLUS环境。');
  return s;
 }
 function record(s,fields){s.state.last={time:Date.now(),...fields};atomic(s.file,s.state);log('[种豆任务试验] '+JSON.stringify(s.state.last));}
 async function request(fid,args,context){
  let s;
  try{
   s=session(context.cookie);
   if(s.blocked){if(!s.warned){s.warned=true;log('[种豆任务试验] 本账号任务已停止；若有未确认提交，请先到App核对，不自动重试。');}return;}
   const appId=IDS[fid],mutation=!!appId;
   if(mutation&&!s.validated.has(context.linkId))throw safe('任务列表尚未查询成功，不提交任务');
   if(fid==='apDoLimitTimeTask'&&!s.started.has(context.linkId))throw safe('尚未确认任务开始，不提交浏览完成');
   if(context.linkId!==s.profile.linkId)throw safe('活动编号与种豆上下文不一致，未提交');
   const body=build(fid,args,context.linkId),base=s.profile.templates;
   // Exact task contexts take priority. Legacy detail/award calls reuse the
   // same plant page's list/completion context, never another activity.
   const contextSource=base[fid]?fid:mutation?'apDoLimitTimeTask':'apTaskList';
   const template=base[contextSource],headers={};
   if(!template)throw safe('缺少该种豆任务接口上下文，未提交');
   if(base[fid]&&mutation&&template.signatureAppId!==appId)throw safe('种豆任务签名应用不匹配，未提交');
   for(const name of ['User-Agent','Referer','Origin','Accept','Accept-Language','x-rp-client','x-referer-page','request-from','sec-fetch-site','sec-fetch-mode','sec-fetch-dest','priority']){const v=header(template.headers,name);if(v)headers[name]=v;}
   const extras=header(template.headers,'Cookie').split(';').map(x=>x.trim()).filter(x=>x&&!/^pt_(key|pin)=/.test(x));
   headers.Cookie=s.login.cookie+extras.join(';')+';';headers['Content-Type']='application/x-www-form-urlencoded';headers['Accept-Encoding']='identity';
   const params={...template.params,functionId:fid,appid:APPIDS[fid]||'activities_platform',body:JSON.stringify(body),t:String(Date.now())};delete params.h5st;
   let version;
   if(mutation){
    const signed=(options.sign||signer.sign)(params,appId,{headers,query:template},s.login.pin);
    const parts=String(signed.h5st||'').split(';');
    if(parts.length!==10||parts[9]!==template.signatureParameterEncoding)throw safe('种豆任务签名字段与手机模板不一致，未提交');
    params.h5st=signed.h5st;version=signed.version;
   }else if(template.unsignedH5st)params.h5st='null';
   const query=new URLSearchParams({functionId:fid});
   const bodyText=new URLSearchParams(params).toString();
   if(mutation){s.state.pending={time:Date.now(),functionId:fid};atomic(s.file,s.state);}
   let response;
   try{response=await send({url:'https://api.m.jd.com/api?'+query,headers,body:bodyText});}
   catch(_){s.blocked=true;record(s,{functionId:fid,status:'network_failed',message:'请求结果不明确，任务已停止；没有自动重试'});process.exitCode=1;return;}
   if(response.status!==200){
    // 401/403 explicitly reject the request. Server errors/redirects remain ambiguous.
    if([401,403].includes(response.status)){delete s.state.pending;atomic(s.file,s.state);}
    s.blocked=true;record(s,{functionId:fid,requestAppid:params.appid,contextSource,contextCapturedAt:template.capturedAt,httpStatus:response.status,status:'http_rejected',environmentVersion:version,message:'本账号后续任务已停止；没有重试或切换签名路径'});process.exitCode=1;return;
   }
   let data;try{data=JSON.parse(response.body);}catch(_){throw safe('响应不是JSON，结果不明确，已停止');}
   if(!data||typeof data!=='object'||typeof data.success!=='boolean')throw safe('响应状态不明确，已停止');
   delete s.state.pending;
   if(data.success){if(fid==='apTaskList')s.validated.add(context.linkId);if(fid==='apStartTaskTime')s.started.add(context.linkId);if(fid==='apDoLimitTimeTask')s.started.delete(context.linkId);}
   else s.blocked=true;
   const code=String(data.code??data.errCode??'');
   record(s,{functionId:fid,requestAppid:params.appid,contextSource,contextCapturedAt:template.capturedAt,httpStatus:200,status:data.success?'accepted':'business_rejected',environmentVersion:version,...(/^[A-Za-z0-9_-]{1,40}$/.test(code)?{businessCode:code}:{}),message:data.success?'接口接受请求；奖励以活动页面及原脚本复查为准':'接口拒绝任务，本账号后续任务已停止'});
   if(!data.success){process.exitCode=1;return;}
   return data;
  }catch(error){if(s){s.blocked=true;try{record(s,{functionId:fid,status:'stopped',message:error.safe?error.message:'准备或解析失败，任务已停止'});}catch(_){log('[种豆任务试验] 结果保存失败，任务已停止');}}else log('[种豆任务试验] '+(error.safe?error.message:'凭据或本地记录处理失败'));process.exitCode=1;}
 }
 function close(){for(const s of sessions.values()){try{if(JSON.parse(fs.readFileSync(s.lock,'utf8')).owner===s.owner)fs.unlinkSync(s.lock);}catch(_){}}}
 if(!options.noExitHook)process.once('exit',close);
 return {handles:fid=>Object.hasOwn(IDS,fid),request,close};
}
function normalizeSource(source){return source.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').replace(/[ \t\r\n]+$/,'');}
function patch(source,adapterPath){
 source=normalizeSource(source);
 const digest=crypto.createHash('sha256').update(source).digest('hex');
 if(digest!==EXPECTED||source.split(MARKER).length!==2||source.split('process.exit(0)').length!==2)throw safe('Faker种豆脚本版本与已核查版本不同，试验入口已停止；校验摘要 '+digest.slice(0,12)+'，请先核对更新');
 const hook=`\nif(__lazingPlantAdapter.handles(vcYj9Vz)){if($["outFlag"]||$["isban"])return;const response=await __lazingPlantAdapter.request(vcYj9Vz,doOZbP,{linkId:$["linkId"],cookie:s8xCLCX});if(!response){$["taskfail"]=true;return;}return await _kerw_(vcYj9Vz,JSON.stringify(response));}\n`;
 // The original Env.done() always exits 0. Preserve an adapter failure for Qinglong.
 return 'const __lazingPlantAdapter=require('+JSON.stringify(adapterPath)+').create();\n'+source.replace(MARKER,MARKER+hook).replace('process.exit(0)','process.exit(process.exitCode||0)');
}
function main(){
 try{
  console.log('[种豆任务试验] 适配器版本 '+VERSION);
  const requested=process.env.LAZING_FAKER_PLANT_PATH;
  const candidates=requested?[path.resolve(requested)]:['/ql/data/scripts/shufflewzc_faker3_main/jd_plantBean.js',path.resolve(__dirname,'../../../shufflewzc_faker3_main/jd_plantBean.js')];
  const file=candidates.find(p=>fs.existsSync(p));if(!file)throw safe('未找到Faker3种豆脚本；可用LAZING_FAKER_PLANT_PATH填写其完整路径');
  const source=patch(fs.readFileSync(file,'utf8'),__filename);
  const Module=require('node:module'),instance=new Module(file,module);
  instance.filename=file;instance.paths=Module._nodeModulePaths(path.dirname(file));
  // Compile only on the user's NAS when this manual trial task is explicitly run.
  instance._compile(source,file);
 }catch(error){console.error('[种豆任务试验] '+(error.safe?error.message:'初始化失败，请检查活动凭据和依赖文件'));process.exitCode=1;}
}
module.exports={create,patch,build,transport,EXPECTED,MARKER,VERSION,normalizeSource,main};
