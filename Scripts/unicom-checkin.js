function checkinScheduleArgument(value) {
 const raw=typeof value==='string'?value:'';
 let config=value && typeof value==='object' && !Array.isArray(value) ? Object.assign({},value) : {mode:raw};
 if(raw.trim().startsWith('{')) {try {config=JSON.parse(raw);} catch(_) {throw new Error('随机延迟参数格式错误');}}
 if(!config.mode && Object.prototype.hasOwnProperty.call(config,'delayMin') && Object.prototype.hasOwnProperty.call(config,'delayMax'))config.mode='cron';
 const min=config.delayMin===undefined?0:Number(config.delayMin),max=config.delayMax===undefined?1200:Number(config.delayMax);
 if(config.mode==='cron'&&(!Number.isInteger(min)||!Number.isInteger(max)||min<0||max>2000||min>max))throw new Error('随机延迟须为0–2000秒的整数，最小值不能大于最大值');
 return {mode:config.mode||'',min,max};
}
// China Unicom daily sign-in: local capture, scheduled and manual sign-in, 2026-10-10.
// Credentials stay in Loon. No browser shim, third-party service or auto retries.
(async function () {
  const KEY='UNICOM_CHECKIN_ACCOUNT_V1', LAST='UNICOM_CHECKIN_LAST_RESULT_V1';
  const HISTORY='UNICOM_CHECKIN_HISTORY_V1', ATTEMPT='UNICOM_CHECKIN_ATTEMPT_V1';
  const LOCK='UNICOM_CHECKIN_LOCK_V1', RUN='UNICOM_CHECKIN_LAST_RUN_V1';
  const VERSION='2026-10-14.1';
  const BASE='https://activity.10010.com/sixPalaceGridTurntableLottery/signin/';
  const suppliedArgument=typeof $argument==='undefined'?undefined:$argument;
  let settings,mode,argumentError;
  try{
    settings=checkinScheduleArgument(suppliedArgument);mode=settings.mode;
    if(!['capture','status','manual','cron'].includes(mode)){mode='unknown';argumentError='签到入口参数无法识别，请更新插件和远程脚本';}
  }catch(e){mode='unknown';argumentError=/^(随机延迟|签到参数)/.test(String(e.message))?e.message:'签到入口参数格式错误';}
  const day=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
  const result={time:Date.now(),date:day(),mode,phase:'prepare',scriptVersion:VERSION};
  const isExecution=!['capture','status'].includes(mode)&&typeof $request==='undefined';
  if(isExecution)result.argumentFormat=typeof suppliedArgument==='string'?(suppliedArgument.trim().startsWith('{')?'json_string':'string'):suppliedArgument&&typeof suppliedArgument==='object'?'object':'missing';
  let locked=false,lockValue,recordResult=true;
  function read(key,fallback) {try {const v=$persistentStore.read(key);return v?JSON.parse(v):fallback;}catch(_){return fallback;}}
  function write(key,value) {if(!$persistentStore.write(JSON.stringify(value),key))throw new Error('本地记录保存失败');}
  function progress(phase){result.phase=phase;result.status='running';result.updatedAt=Date.now();write(RUN,result);}
  function visibleMessage(value){
    if(value.status!=='running')return value.message||'暂无结果';
    if(value.phase==='waiting'){
      if(Date.now()>Number(value.resumeAt||0)+90000)return '本次任务停在随机等待阶段，尚无结束记录，请查看任务日志';
      return '定时任务正在随机等待，约 '+Math.max(0,Math.ceil((Number(value.resumeAt||Date.now())-Date.now())/1000))+' 秒后查询签到状态';
    }
    const label={prepare:'准备',query:'查询',sign:'签到',verify:'复查'}[value.phase]||'处理';
    return Date.now()-Number(value.updatedAt||value.time)>90000?'本次任务停在'+label+'阶段，尚无结束记录，请查看任务日志':'签到正在'+label+'，请稍后查看结果';
  }
  function headers(source) {
    const out={};
    Object.keys(source||{}).forEach(k=>{
      const name=k.toLowerCase();
      if(!['cookie','user-agent','referer','origin','accept','accept-language'].includes(name))return;
      const v=Array.isArray(source[k])?source[k].join(name==='cookie'?'; ':', '):String(source[k]);
      out[name]=out[name]&&name==='cookie'?out[name]+'; '+v:v;
    });
    return out;
  }
  function queryParams(url) {
    const q=String(url).split('?')[1]||'', out={};
    q.split('&').forEach(pair=>{
      if(!pair)return;
      const p=pair.indexOf('=');
      const k=decodeURIComponent(p<0?pair:pair.slice(0,p));
      if(['taskId','channel','imei'].includes(k))out[k]=decodeURIComponent((p<0?'':pair.slice(p+1)).replace(/\+/g,' '));
    });
    return out;
  }
  function state(reply) {
    if(!reply||String(reply.code)!=='0000')throw new Error('签到状态查询失败');
    const data=reply.data;
    if(!data||!['y','n'].includes(data.todayIsSignIn))throw new Error('今天的签到状态不明确');
    return data;
  }
  function request(method,url,h,body) {
    return new Promise((resolve,reject)=>{
      // $httpClient timeout is milliseconds; Script timeout is seconds.
      const options={url,headers:h,timeout:12000,'auto-redirect':false,'auto-cookie':false,insecure:false};
      if(body!==undefined)options.body=body;
      $httpClient[method](options,(error,response,text)=>{
        if(error) {
          // Classify locally, never persist the raw error (it may contain the URL).
          const raw=typeof error==='string'?error:String(error.message||error.error||'');
          const code=String(error.code||'').match(/^-?\d{1,6}$/);
          const kind=/timed?\s*out|timeout|超时|-1001/i.test(raw)?'timeout':/certificate|ssl|tls|证书|-120[0-6]/i.test(raw)?'tls':/dns|resolve|找不到.*服务器|-1003/i.test(raw)?'dns':'connection';
          result.networkError={kind,timeoutMs:12000};
          if(code)result.networkError.code=Number(code[0]);
          const reason={timeout:'网络请求超时',tls:'安全连接或证书异常',dns:'域名解析失败',connection:'网络连接失败'}[kind];
          return reject(new Error(reason));
        }
        if(!response||Number(response.status)!==200) {
          result.httpStatus=response&&Number(response.status)||0;
          return reject(new Error('服务器响应异常（HTTP '+result.httpStatus+'）'));
        }
        try {resolve(JSON.parse(text));}catch(_){reject(new Error('服务器返回内容无法解析'));}
      });
    });
  }
  try {
    if(isExecution){progress('prepare');console.log('[联通签到] 启动，版本 '+VERSION+'，入口 '+mode+'，参数形式 '+result.argumentFormat);}
    if(argumentError)throw new Error(argumentError);
    if(mode==='capture') {
      if(typeof $request==='undefined'||typeof $response==='undefined')return;
      if(!/^https:\/\/activity\.10010\.com\/sixPalaceGridTurntableLottery\/signin\/getContinuous(?:\?|$)/.test($request.url)||String($request.method).toUpperCase()!=='GET')return;
      if(Number($response.status)!==200)return;
      state(JSON.parse($response.body));
      const h=headers($request.headers);
      if(!h.cookie||!h['user-agent'])throw new Error('登录凭据或页面信息不完整');
      // Never retain a referer outside the observed Unicom page host.
      if(!/^https:\/\/img\.client\.10010\.com\//.test(h.referer||''))h.referer='https://img.client.10010.com/SigininApp/index.html';
      h.origin='https://img.client.10010.com';
      const previous=read(KEY,null);
      write(KEY,{capturedAt:Date.now(),headers:h,query:queryParams($request.url)});
      console.log('[联通签到] 已保存查询凭据（未修改原请求或响应）');
      if(!previous||Date.now()-previous.capturedAt>3600000)$notification.post('联通签到','凭据已保存','可以关闭获取凭据开关，再手动测试签到。');
      return;
    }
    if(mode==='status') {
      const last=read(LAST,null),run=read(RUN,null);
      const current=run&&Number(run.updatedAt||run.finishedAt||run.time)>Number(last&&(last.finishedAt||last.time)||0)?run:last;
      console.log('[联通签到] 最近结果：'+JSON.stringify(current));
      $notification.post('联通签到','最近执行结果',current?current.date+'：'+visibleMessage(current):'暂无执行记录');
      return;
    }
    if(!['manual','cron'].includes(mode)||typeof $request!=='undefined')throw new Error('请从联通签到定时或手动入口执行');
    if(mode==='cron') {
      const delaySeconds=settings.min+Math.floor(Math.random()*(settings.max-settings.min+1));
      result.randomDelaySeconds=delaySeconds;result.resumeAt=Date.now()+delaySeconds*1000;progress('waiting');
      console.log('[联通签到] 定时任务随机等待 '+delaySeconds+' 秒');
      if(delaySeconds>0)await new Promise(resolve=>setTimeout(resolve,delaySeconds*1000));
      if(day()!==result.date)throw new Error('随机等待跨过零点');
    }
    const profile=read(KEY,null);
    if(!profile||!profile.headers||!profile.headers.cookie)throw new Error('缺少凭据，请重新获取凭据。');
    result.credentialCapturedAt=profile.capturedAt||null;
    const h=headers(profile.headers), q=profile.query||{};
    const query=Object.keys(q).filter(k=>['taskId','channel','imei'].includes(k)).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(q[k])).join('&');
    const queryURL=BASE+'getContinuous'+(query?'?'+query:'');
    if(Number($persistentStore.read(LOCK)||0)>Date.now()){recordResult=false;result.status='skipped_busy';result.message='签到正在执行，请稍后查看结果';console.log('[联通签到] '+result.message);return;}
    lockValue=String(Date.now()+90000);
    if(!$persistentStore.write(lockValue,LOCK))throw new Error('执行锁保存失败');locked=true;
    progress('query');
    const before=state(await request('get',queryURL,h));
    result.daysBefore=String(before.continueCountCur||before.continueCount||'');
    if(before.todayIsSignIn==='y') {
      result.status='already_done';result.message='今天已签到，连续 '+result.daysBefore+' 天。';return;
    }
    if(day()!==result.date)throw new Error('执行过程中跨过零点');
    const attempt=read(ATTEMPT,null);
    if(attempt&&attempt.date===result.date)throw new Error('今天已发送过签到请求，结果尚未确认');
    // Persist before POST, including ambiguous network failures, to avoid retries.
    write(ATTEMPT,{date:result.date,time:Date.now()});
    progress('sign');
    const signed=await request('post',BASE+'daySign',Object.assign({},h,{'content-type':'application/x-www-form-urlencoded'}),'shareCl=&shareCode=');
    result.signCode=String(signed.code);
    result.businessStatus=String(signed.data&&signed.data.status);
    if(result.signCode!=='0000'||result.businessStatus!=='0000')throw new Error('签到接口返回异常（业务码 '+result.signCode+' / '+result.businessStatus+'）');
    const reward=String(signed.data.redSignMessage||'').match(/^\+?\d+(?:\.\d+)?元$/);
    result.reward=reward?reward[0]:'';
    progress('verify');
    try {
      const after=state(await request('get',queryURL,h));
      result.daysAfter=String(after.continueCountCur||after.continueCount||'');
      if(after.todayIsSignIn!=='y')throw new Error('状态尚未更新');
      result.status='signed_confirmed';
      result.message='签到成功'+(result.reward?'，话费红包 '+result.reward:'')+'，连续 '+result.daysAfter+' 天。';
    } catch(_) {
      result.status='sign_success_verify_unconfirmed';
      result.message='签到接口返回成功'+(result.reward?'，话费红包 '+result.reward:'')+'；签到状态暂无法确认。';
    }
  } catch(e) {
    result.status='stopped';
    // Only our own fixed error messages are retained; parsing/runtime errors are generic.
    result.message=/[\u4e00-\u9fff]/.test(String(e.message))?String(e.message).slice(0,160):'脚本处理失败';
    if(mode==='capture') {
      console.log('[联通签到] '+result.message);
      $notification.post('联通签到','凭据未保存',result.message);
    }
  } finally {
    if(locked&&$persistentStore.read(LOCK)===lockValue)$persistentStore.write(undefined,LOCK);
    if(isExecution){result.finishedAt=Date.now();result.updatedAt=result.finishedAt;try{write(RUN,result);}catch(_){console.log('[联通签到] 启动与阶段记录保存失败');}}
    if(recordResult&&(mode==='manual'||mode==='cron')) {
      try {write(LAST,result);const history=read(HISTORY,[]);history.push(result);write(HISTORY,history.slice(-20));}catch(_){console.log('[联通签到] 执行结果保存失败');}
      console.log('[联通签到] '+JSON.stringify(result));
      $notification.post('联通签到',mode==='cron'?'定时签到结果':'手动签到结果',result.message||result.status);
    }
    else if(isExecution&&recordResult){console.log('[联通签到] '+JSON.stringify(result));$notification.post('联通签到','执行失败',result.message||'签到入口参数无法识别');}
    $done({});
  }
})();
