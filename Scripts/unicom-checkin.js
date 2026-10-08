// China Unicom daily sign-in: local capture and manual test, 2026-10-09.
// Credentials stay in Loon. No browser shim, third-party service or auto retries.
(async function () {
  const KEY='UNICOM_CHECKIN_ACCOUNT_V1', LAST='UNICOM_CHECKIN_LAST_RESULT_V1';
  const HISTORY='UNICOM_CHECKIN_HISTORY_V1', ATTEMPT='UNICOM_CHECKIN_ATTEMPT_V1';
  const LOCK='UNICOM_CHECKIN_LOCK_V1';
  const BASE='https://activity.10010.com/sixPalaceGridTurntableLottery/signin/';
  const mode=typeof $argument==='string'?$argument:'';
  const day=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
  const result={time:Date.now(),date:day(),phase:'prepare'};
  let locked=false;
  function read(key,fallback) {try {const v=$persistentStore.read(key);return v?JSON.parse(v):fallback;}catch(_){return fallback;}}
  function write(key,value) {if(!$persistentStore.write(JSON.stringify(value),key))throw new Error('本地记录保存失败，已停止');}
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
    if(!reply||String(reply.code)!=='0000')throw new Error('状态查询未成功，未提交签到');
    const data=reply.data;
    if(!data||!['y','n'].includes(data.todayIsSignIn))throw new Error('今天的签到状态不明确，未提交签到');
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
          return reject(new Error('网络请求失败（'+kind+'）；本次不自动重试'));
        }
        if(!response||Number(response.status)!==200) {
          result.httpStatus=response&&Number(response.status)||0;
          return reject(new Error('HTTP 状态异常 '+result.httpStatus+'；本次不自动重试'));
        }
        try {resolve(JSON.parse(text));}catch(_){reject(new Error('返回内容不是 JSON；本次不自动重试'));}
      });
    });
  }
  try {
    if(mode==='capture') {
      if(typeof $request==='undefined'||typeof $response==='undefined')return;
      if(!/^https:\/\/activity\.10010\.com\/sixPalaceGridTurntableLottery\/signin\/getContinuous(?:\?|$)/.test($request.url)||String($request.method).toUpperCase()!=='GET')return;
      if(Number($response.status)!==200)return;
      state(JSON.parse($response.body));
      const h=headers($request.headers);
      if(!h.cookie||!h['user-agent'])throw new Error('没有读取到完整 Cookie 或 User-Agent，未保存凭据');
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
      const last=read(LAST,null);
      console.log('[联通签到] 最近结果：'+JSON.stringify(last));
      $notification.post('联通签到','最近执行结果',last?last.date+'：'+last.message:'暂无执行记录');
      return;
    }
    if(mode!=='manual'||typeof $request!=='undefined')throw new Error('请从联通每日签到手动测试入口执行');
    const profile=read(KEY,null);
    if(!profile||!profile.headers||!profile.headers.cookie)throw new Error('缺少凭据：开启获取凭据后，打开联通签到页面');
    if(!profile.capturedAt||Date.now()-profile.capturedAt>7*86400000)throw new Error('凭据已超过七天，请重新打开签到页更新');
    if(Number($persistentStore.read(LOCK)||0)>Date.now())throw new Error('签到脚本正在运行，请稍后查看结果');
    if(!$persistentStore.write(String(Date.now()+90000),LOCK))throw new Error('执行锁保存失败');
    locked=true;
    const h=headers(profile.headers), q=profile.query||{};
    const query=Object.keys(q).filter(k=>['taskId','channel','imei'].includes(k)).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(q[k])).join('&');
    const queryURL=BASE+'getContinuous'+(query?'?'+query:'');
    result.phase='query';
    const before=state(await request('get',queryURL,h));
    result.daysBefore=String(before.continueCountCur||before.continueCount||'');
    if(before.todayIsSignIn==='y') {
      result.status='already_done';result.message='今天已签到，连续 '+result.daysBefore+' 天；未重复提交。';return;
    }
    if(day()!==result.date)throw new Error('运行时跨过零点，请稍后重新执行');
    const attempt=read(ATTEMPT,null);
    if(attempt&&attempt.date===result.date)throw new Error('今天已提交过签到；先查看最近结果，本测试版不重复提交');
    // Persist before POST, including ambiguous network failures, to avoid retries.
    write(ATTEMPT,{date:result.date,time:Date.now()});
    result.phase='sign';
    const signed=await request('post',BASE+'daySign',Object.assign({},h,{'content-type':'application/x-www-form-urlencoded'}),'shareCl=&shareCode=');
    result.signCode=String(signed.code);
    result.businessStatus=String(signed.data&&signed.data.status);
    if(result.signCode!=='0000'||result.businessStatus!=='0000')throw new Error('签到未确认，业务码 '+result.signCode+' / '+result.businessStatus+'；未自动重试');
    const reward=String(signed.data.redSignMessage||'').match(/^\+?\d+(?:\.\d+)?元$/);
    result.reward=reward?reward[0]:'';
    result.phase='verify';
    try {
      const after=state(await request('get',queryURL,h));
      result.daysAfter=String(after.continueCountCur||after.continueCount||'');
      if(after.todayIsSignIn!=='y')throw new Error('状态尚未更新');
      result.status='signed_confirmed';
      result.message='签到成功'+(result.reward?'，话费红包 '+result.reward:'')+'；已复查今天已签到，连续 '+result.daysAfter+' 天。';
    } catch(_) {
      result.status='sign_success_verify_unconfirmed';
      result.message='签到接口返回成功'+(result.reward?'，话费红包 '+result.reward:'')+'；后续状态复查未确认，不自动重试。';
    }
  } catch(e) {
    result.status='stopped';
    // Only our own fixed error messages are retained; parsing/runtime errors are generic.
    result.message=/[\u4e00-\u9fff]/.test(String(e.message))?String(e.message).slice(0,160):'脚本处理失败，请查看配置并反馈执行阶段';
    if(mode==='capture') {
      console.log('[联通签到] '+result.message);
      $notification.post('联通签到','凭据未保存',result.message);
    }
  } finally {
    if(locked)$persistentStore.write(undefined,LOCK);
    if(mode==='manual') {
      try {write(LAST,result);const history=read(HISTORY,[]);history.push(result);write(HISTORY,history.slice(-20));}catch(_){console.log('[联通签到] 执行结果保存失败');}
      console.log('[联通签到] '+JSON.stringify(result));
      $notification.post('联通签到','手动测试结果',result.message||result.status);
    }
    $done({});
  }
})();
