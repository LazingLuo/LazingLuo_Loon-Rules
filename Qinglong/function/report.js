'use strict';
// Read-only Qinglong report. Never calls JD, starts tasks or evaluates task logs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),http=require('node:http'),https=require('node:https');
const OWN={lazing_jd_plus:'blindbox',lazing_jd_scratch:'scratch',lazing_jd_jxzy:'jxzy',lazing_jd_finance:'finance'};
const day=ms=>new Date(ms+8*3600000).toISOString().slice(0,10);
const clock=ms=>new Date(ms+8*3600000).toISOString().slice(11,16);
function fail(message){const error=new Error(message);error.safe=true;throw error;}
function stamp(value){const n=Number(value);return Number.isFinite(n)&&n>0?(n>1e12?n:n*1000):0;}
function label(value){return String(value||'未命名任务').replace(/(?:pt_key|pt_pin|token|secret|authorization)\s*[=:]\s*[^\s;]+/gi,'[已隐藏]').replace(/https?:\/\/\S+/g,'[链接]').replace(/[A-Za-z0-9_+=/-]{18,}/g,'[已隐藏]').replace(/\b\d{5,}-\d{5,}\b/g,'[已隐藏]').replace(/\b\d{11,}\b/g,'[已隐藏]').replace(/[\r\n\t]/g,' ').slice(0,64);}
function amount(value){return /^\d+(?:\.\d{1,4})?$/.test(String(value))&&Number(value)<=1000000?String(value):null;}
function fileOf(task){const m=String(task.command||'').match(/(?:^|[\s/"'])((?:lazing_jd_|jd_)[\w.-]+)\.js(?=$|[\s"'])/);return m&&m[1];}
function field(source,value,min,max){
  if(!/^[\d*,/\-]+$/.test(source))throw Error('invalid cron');
  return source.split(',').map(part=>{
    const pieces=part.split('/');if(pieces.length>2)throw Error('invalid cron');
    const step=pieces.length===2?Number(pieces[1]):1;if(!Number.isInteger(step)||step<1)throw Error('invalid cron');
    let lo,hi;
    if(pieces[0]==='*'){lo=min;hi=max;}else{
      const range=pieces[0].split('-');if(range.length>2||!range.every(x=>/^\d+$/.test(x)))throw Error('invalid cron');
      lo=Number(range[0]);hi=range.length===2?Number(range[1]):pieces.length===2?max:lo;
    }
    if(lo<min||hi>max||lo>hi)throw Error('invalid cron');
    return value>=lo&&value<=hi&&(value-lo)%step===0;
  }).some(Boolean);
}
function due(schedule,now){
  try{
    let parts=String(schedule||'').trim().split(/\s+/),seconds='0';
    if(parts.length===6)seconds=parts.shift();if(parts.length!==5)return null;
    const local=new Date(now+8*3600000),minute=local.getUTCHours()*60+local.getUTCMinutes();
    const dom=field(parts[2],local.getUTCDate(),1,31),dow=field(parts[4],local.getUTCDay(),0,7)||(local.getUTCDay()===0&&field(parts[4],7,0,7));
    if(!field(parts[3],local.getUTCMonth()+1,1,12))return false;
    if(parts[2].startsWith('*')||parts[4].startsWith('*')){if(!dom||!dow)return false;}else if(!dom&&!dow)return false;
    const secondChoices=Array.from({length:60},(_,i)=>i).filter(i=>field(seconds,i,0,59));
    if(!secondChoices.length)return false;
    for(let i=0;i<=minute;i++)if(field(parts[0],i%60,0,59)&&field(parts[1],Math.floor(i/60),0,23)&&
      (i<minute||secondChoices.some(s=>s<=local.getUTCSeconds())))return true;
    return false;
  }catch(_){return null;}
}
function taskDue(task,now){const values=[task.schedule,...(Array.isArray(task.extra_schedules)?task.extra_schedules.map(x=>x.schedule):[])].map(x=>due(x,now));return values.includes(true)?true:values.includes(null)?null:false;}
function reason(message){
  const s=String(message||'');
  if(/未登[录陆]|not.?login|(?:cookie|登录|凭据).{0,8}(?:失效|过期|缺失|不完整)/i.test(s))return '凭据可能失效或不完整';
  if(/403|Forbidden/i.test(s))return 'HTTP 403，访问被拒绝';
  if(/签名|h5st|AAR2/i.test(s))return '签名或环境异常';
  if(/今天已.{0,12}提交|已有.{0,12}提交记录/.test(s))return '已有提交记录，需核实结果';
  if(/浏览|前置/.test(s))return '需先在 App 完成前置任务';
  if(/网络|超时|timeout/i.test(s))return '网络异常或超时';
  if(/缺少.*凭据/.test(s))return '缺少活动凭据';
  return '详情见青龙日志';
}
function structured(record,kind){
  let status='pending',text;
  if(['signed_confirmed','reward_received','box_confirmed'].includes(record.status)){
    status='success';text='成功';
    if(kind==='finance'&&amount(record.amount)!==null)text+='，现金 '+amount(record.amount)+' 元';
    else if(amount(record.beanQuantity)!==null&&Number(record.beanQuantity)>0)text+='，'+amount(record.beanQuantity)+' 京豆';
    if(Number.isInteger(record.continuousDays||record.days||record.roundDays)&&Number(record.continuousDays||record.days||record.roundDays)>0)text+='，连续/本轮 '+Number(record.continuousDays||record.days||record.roundDays)+' 天';
  }else if(record.status==='already_done'){status='success';text='今天已完成';}
  else if(record.status==='no_chance'){status='success';text='没有开盒机会，已跳过';}
  else if(/unconfirmed/.test(record.status||'')){text='领取返回后未确认，勿重复提交';}
  else if(record.status==='stopped'||record.status==='failed'){
    text=reason(record.message);status=/已有提交记录/.test(text)?'pending':'failure';
  }else text='业务结果待确认';
  if(kind==='finance'){
    const d=record.doubleSign;
    if(d&&['signed_confirmed','already_done'].includes(d.status))text+='；双签：'+(d.status==='already_done'?'今天已领取':'成功'+(amount(d.beanQuantity)!==null?'，'+amount(d.beanQuantity)+' 京豆':''));
    else if(d&&d.status==='not_eligible')text+='；双签条件未满足';
    else if(d){text+='；双签：'+(/unconfirmed/.test(d.status||'')?'领取未确认':reason(d.message));if(d.status==='stopped')status='failure';else if(status!=='failure')status='pending';}
    else if(status==='success'){status='pending';text+='；双签结果缺失';}
  }
  return {status,text};
}
function assets(text){
  const rows=new Map();let account=1;
  for(const raw of String(text).split(/\r?\n/)){
    const accountMatch=raw.match(/(?:开始查询|开始).{0,16}【账号(\d+)/);if(accountMatch)account=Number(accountMatch[1]);
    if(!Number.isSafeInteger(account)||account<1||account>1000)continue;
    const data=rows.get(account)||{};
    let m=raw.match(/【当前京豆】\s*(\d+)\s*豆/);if(m)data.beans=Number(m[1]);
    m=raw.match(/【今日京豆】\s*收\s*(\d+)(?:豆)?(?:\s*支\s*(\d+))?/);if(m){data.income=Number(m[1]);data.expense=Number(m[2]||0);}
    m=raw.match(/【昨日京豆】\s*收\s*(\d+)(?:豆)?(?:\s*支\s*(\d+))?/);if(m){data.yesterdayIncome=Number(m[1]);data.yesterdayExpense=Number(m[2]||0);}
    m=raw.match(/【京豆变动】\s*(-?\d+)\s*豆(?:.*?与(昨日|今日)(\d{2}:\d{2})比较)?/);if(m){data.change=Number(m[1]);if(m[2])data.baseline=m[2]+m[3];}
    m=raw.match(/【红包总额】\s*(\d+(?:\.\d{1,4})?)\s*元/);if(m&&amount(m[1])!==null)data.red=amount(m[1]);
    m=raw.match(/【钱包余额】\s*(\d+(?:\.\d{1,4})?)\s*元/);if(m&&amount(m[1])!==null)data.wallet=amount(m[1]);
    if(Object.keys(data).length)rows.set(account,data);
  }
  return [...rows].map(([n,v])=>{
    const parts=[];
    if(v.beans!==undefined)parts.push('余额 '+v.beans+' 京豆');
    if(v.income!==undefined)parts.push('今日收入 '+v.income+'、支出 '+v.expense+' 京豆');
    if(v.yesterdayIncome!==undefined)parts.push('昨日收入 '+v.yesterdayIncome+'、支出 '+v.yesterdayExpense+' 京豆');
    if(v.change!==undefined)parts.push('较'+(v.baseline||'缓存')+'净变动 '+(v.change>0?'+':'')+v.change+' 京豆');
    if(v.red!==undefined)parts.push('红包 '+v.red+' 元');if(v.wallet!==undefined)parts.push('钱包 '+v.wallet+' 元');
    return '账号'+n+'：'+parts.join('；');
  });
}
function classify(task,log,now){
  const name=label(task.name||fileOf(task)),date=day(now),file=fileOf(task),started=stamp(task.last_execution_time);
  const row={name,status:'pending',text:'',assetLines:[]};
  if([0,3].includes(Number(task.status))){row.status='running';row.text=Number(task.status)===3?'排队中':'运行中';return row;}
  const header=String(log.data||'').match(/开始执行[^\n]*?(\d{4}-\d{2}-\d{2})/);
  if(!(started&&day(started)===date||!started&&header&&header[1]===date)){
    const expected=taskDue(task,now);row.status=expected===true?'not_run':expected===false?'not_due':'pending';
    row.text=expected===true?'今天应执行但没有当日记录':expected===false?'截至现在未到计划时间':'未见当日记录，定时规则待核对';return row;
  }
  row.time=started?clock(started):null;
  const text=String(log.data||'');
  if(log.logStatus==='ignored'||!text.trim()||['notFound','empty'].includes(log.logStatus)){row.text='当日日志缺失或已忽略';return row;}
  if(OWN[file]){
    const records=[];
    for(const line of text.split(/\r?\n/)){
      const at=line.indexOf('{');if(at<0)continue;
      try{const r=JSON.parse(line.slice(at));if(r&&r.date===date&&typeof r.status==='string'&&r.time)records.push(r);}catch(_){}
    }
    if(records.length){
      const values=records.map(r=>structured(r,OWN[file]));
      row.status=values.some(x=>x.status==='failure')?'failure':values.some(x=>x.status==='pending')?'pending':'success';
      row.text=values.map((x,i)=>(values.length>1?'账号'+(i+1)+'：':'')+x.text).join('；');return row;
    }
  }
  if(file==='jd_bean_change'){row.assetLines=assets(text);row.text=row.assetLines.length?'资产快照已读取':'未识别到有效资产快照';row.status=row.assetLines.length?'success':'pending';}
  const bad=/Response code 403|HTTP(?:状态)?\s*403|Forbidden|未登[录陆]|(?:cookie|凭据).{0,8}(?:已失效|已过期)|(?:^|\n)\s*(?:签到失败|Error:|Cannot find module)|##\s*失败\s*❌/i.test(text);
  if(bad){row.status='failure';row.text=reason(text);return row;}
  if(file==='jd_bean_change')return row;
  if(/(?:^|\n)\s*(?:签到成功|今日签到完成|今天已签到|今日已签到|已完成今日签到)(?:[！!，,。.:：\s]|$)/.test(text)){
    row.status='success';row.text=/今天已签到|今日已签到/.test(text)?'今天已签到':'日志报告成功';
    const beans=[...text.matchAll(/(?:获得|领取成功)[：:\s]*(\d+)\s*京豆/g)].map(x=>Number(x[1]));
    if(beans.length===1)row.text+='，'+beans[0]+' 京豆';else if(beans.length>1)row.text+='，数量见任务日志';
  }else row.text='脚本已执行，业务结果待确认';
  return row;
}
function render(rows,now,warnings=[]){
  const groups={failure:[],not_run:[],pending:[],running:[],success:[],not_due:[]};for(const row of rows)(groups[row.status]||groups.pending).push(row);
  const lines=['截至北京时间 '+day(now)+' '+clock(now),
    '成功 '+groups.success.length+'｜失败 '+groups.failure.length+'｜未执行 '+groups.not_run.length+'｜待确认 '+groups.pending.length+'｜运行/排队 '+groups.running.length];
  for(const [key,title]of [['failure','失败'],['not_run','应执行但未执行'],['pending','待确认'],['running','运行中'],['success','成功']])if(groups[key].length){
    lines.push('',title+'：');for(const r of groups[key])lines.push('· '+r.name+'：'+r.text+(r.time?'（'+r.time+'）':''));
  }
  const balances=rows.filter(x=>x.assetLines.length);if(balances.length){lines.push('','资产快照（不与任务奖励相加）：');for(const r of balances){lines.push('统计时间：'+(r.time||'当天日志'));lines.push(...r.assetLines);}}
  if(groups.not_due.length)lines.push('','另有 '+groups.not_due.length+' 项截至现在未到计划时间，不计为漏执行。');
  if(!rows.length)lines.push('没有查到已启用的京东任务。');
  if(warnings.length)lines.push('',...warnings.map(x=>'提示：'+x));
  lines.push('','仅汇总当日最新一次任务日志；执行完成不等于奖励到账。');
  let content=lines.join('\n');if(Buffer.byteLength(content)>18000){while(Buffer.byteLength(content)>17500)content=content.slice(0,-128);content+='\n内容较多，剩余请查看青龙任务日志。';}
  return content;
}
function request(url,method,body,headers={}){
  return new Promise((resolve,reject)=>{
    const data=body===undefined?null:JSON.stringify(body),parsed=new URL(url),client=parsed.protocol==='https:'?https:http;
    let settled=false;const finish=(e,v)=>{if(settled)return;settled=true;e?reject(e):resolve(v);};
    const req=client.request(parsed,{method,headers:{Accept:'application/json',...headers,...(data?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}:{})},rejectUnauthorized:true},res=>{
      let length=0;const parts=[];res.on('data',chunk=>{length+=chunk.length;if(length>2*1024*1024){finish(new Error('response limit'));req.destroy();}else parts.push(chunk);});
      res.on('end',()=>{if(res.statusCode!==200)return finish(new Error('http status'));try{finish(null,JSON.parse(Buffer.concat(parts).toString('utf8')));}catch(_){finish(new Error('json'));}});res.on('error',()=>finish(new Error('network')));
    });req.on('error',()=>finish(new Error('network')));req.setTimeout(10000,()=>req.destroy(new Error('timeout')));if(data)req.write(data);req.end();
  });
}
function panelUrl(value){
  const url=new URL(value||'http://127.0.0.1:5700');
  if(url.username||url.password||url.search||url.hash||!['http:','https:'].includes(url.protocol))fail('青龙地址格式错误');
  if(url.protocol==='http:'&&!['127.0.0.1','localhost','[::1]'].includes(url.hostname))fail('日报的 HTTP 青龙地址只允许本机回环地址');
  return url.href.replace(/\/$/,'');
}
async function collect(env,now,send=request){
  const client=String(env.LAZING_JD_REPORT_CLIENT_ID||''),secret=String(env.LAZING_JD_REPORT_CLIENT_SECRET||'');
  if(!client||!secret)fail('请填写日报的青龙 Client ID 和 Client Secret');
  const base=panelUrl(env.LAZING_JD_REPORT_QL_URL);
  const auth=await send(base+'/open/auth/token?client_id='+encodeURIComponent(client)+'&client_secret='+encodeURIComponent(secret),'GET');
  if(!auth||Number(auth.code)!==200||!auth.data||!auth.data.token)fail('青龙日报授权失败，请核对应用和定时任务权限');
  const headers={Authorization:'Bearer '+auth.data.token};
  const response=await send(base+'/open/crons','GET',undefined,headers);
  const list=response&&Array.isArray(response.data)?response.data:response&&response.data&&response.data.data;
  if(Number(response&&response.code)!==200||!Array.isArray(list))fail('无法读取青龙任务列表，请检查定时任务读取权限');
  const selected=list.filter(t=>fileOf(t)&&fileOf(t)!=='lazing_jd_report'&&Number(t.isDisabled)!==1&&Number(t.status)!==2);
  const rows=[],warnings=[],bounded=selected.slice(0,200),deadline=Date.now()+60000;
  for(let index=0;index<bounded.length;index++){
    const task=bounded[index];
    if(Date.now()>deadline){
      warnings.push('读取任务日志超过60秒，剩余结果未确认');
      rows.push(...bounded.slice(index).map(t=>({name:label(t.name),status:'pending',text:'本次读取未完成',assetLines:[]})));break;
    }
    if(!Number.isSafeInteger(Number(task.id))||Number(task.id)<1){warnings.push('有任务 ID 无法识别');continue;}
    const started=stamp(task.last_execution_time);let log={};
    if(!started||day(started)===day(now)||[0,3].includes(Number(task.status))){
      try{log=await send(base+'/open/crons/'+Number(task.id)+'/log?tail=true&limit=65536','GET',undefined,headers);if(Number(log&&log.code)!==200)throw Error('log unavailable');}
      catch(_){log={logStatus:'notFound'};warnings.push(label(task.name)+'：日志未能读取');}
    }
    rows.push(classify(task,log,now));
  }
  if(selected.length>200)warnings.push('任务超过200项，仅汇总前200项');
  return render(rows,now,warnings);
}
function save(file,value){const temp=file+'.'+process.pid+'.'+crypto.randomBytes(8).toString('hex');try{fs.writeFileSync(temp,JSON.stringify(value),{mode:0o600,flag:'wx'});fs.renameSync(temp,file);}finally{try{fs.unlinkSync(temp);}catch(_){}}}
async function main(options={}){
  const env=options.env||process.env,now=options.now||Date.now(),log=options.log||console.log,send=options.request||request;
  const preview=options.preview===undefined?process.argv.includes('--preview'):options.preview;
  const token=String(env.LAZING_JD_REPORT_PUSHPLUS_TOKEN||'').trim();
  if(!preview&&!/^[A-Za-z0-9_-]{12,128}$/.test(token)){log('[京东日报] 请在青龙填写 LAZING_JD_REPORT_PUSHPLUS_TOKEN');return 1;}
  let content;
  try{content=await collect(env,now,send);}catch(e){content='京东任务日报读取失败：'+(e.safe?e.message:'青龙连接或响应异常，请查看面板')+'。未触发任何签到。';}
  const title='京东任务日报 '+day(now);log(title+'\n'+content);
  if(preview){log('[京东日报] 仅预览，没有发送微信消息');return 0;}
  const dir=path.join(options.dataDir||env.LAZING_JD_DATA_DIR||'/ql/data/lazing-jd','report');fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const lock=path.join(dir,'running.lock'),journal=path.join(dir,'push.json');let fd;
  try{fd=fs.openSync(lock,'wx',0o600);fs.writeFileSync(fd,String(process.pid));}catch(_){log('[京东日报] 另一份日报正在处理或残留执行锁，本次未重复发送');return 1;}
  try{
    let previous;try{previous=JSON.parse(fs.readFileSync(journal,'utf8'));}catch(e){if(e.code!=='ENOENT'){log('[京东日报] 推送记录损坏，本次未发送');return 1;}}
    if(previous&&previous.date===day(now)&&['sending','accepted'].includes(previous.state)){log('[京东日报] 今天已提交过推送；若未收到请先查看 PushPlus 发送记录，未重复发送');return 0;}
    const record={date:day(now),time:now,state:'sending',hash:crypto.createHash('sha256').update(content).digest('hex')};save(journal,record);
    let result;
    try{result=await send('https://www.pushplus.plus/send','POST',{token,title,content,template:'txt',channel:'wechat'});}
    catch(_){log('[京东日报] 推送结果不明确，未自动重试；请先检查 PushPlus 发送记录');return 1;}
    if(!result||Number(result.code)!==200){record.state='rejected';save(journal,record);log('[京东日报] PushPlus 拒绝请求，请检查令牌、微信绑定和发送额度');return 1;}
    record.state='accepted';save(journal,record);log('[京东日报] PushPlus 已接收日报，实际送达请以微信及 PushPlus 发送记录为准');return 0;
  }finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
module.exports={main,collect,classify,render,assets,structured,due,taskDue,fileOf,panelUrl};
