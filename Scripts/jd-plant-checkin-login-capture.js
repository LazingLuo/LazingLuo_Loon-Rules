// Passive same-account login refresh for plant check-in.
const JDC_KEY = 'JD_CHECKIN_TEST_ACCOUNT_V1';
function jdcRead(key, fallback) {
  const raw = $persistentStore.read(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch (_) { throw new Error('本地数据损坏，请重新获取凭据'); }
}
function jdcWrite(key, value) {
  if (!$persistentStore.write(JSON.stringify(value), key)) throw new Error('本地保存失败');
}
function jdcParseForm(text) {
  const result = {};
  String(text || '').split('&').forEach(pair => {
    if (!pair) return;
    const i = pair.indexOf('=');
    const decode = s => decodeURIComponent(s.replace(/\+/g, ' '));
    result[decode(i < 0 ? pair : pair.slice(0, i))] = decode(i < 0 ? '' : pair.slice(i + 1));
  });
  return result;
}
function jdcForm(params) {
  return Object.keys(params).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');
}
function jdcHeader(headers, name) {
  const k = Object.keys(headers || {}).find(k => k.toLowerCase() === name.toLowerCase());
  return k ? headers[k] : '';
}
function jdcCookie(cookie, name) {
  const m = String(cookie).match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : '';
}
function jdcDay() { return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10); }
function jdcTask(data, mode) {
  const list = mode === 'daily' ? data && data.data && data.data.signComponentInfoResult
    : data && data.rs && data.rs.beanTask && data.rs.beanTask.taskList;
  if (!Array.isArray(list)) throw new Error('任务列表结构不符，未提交领取');
  const tasks = list.filter(t => Number(t.assignmentType) === 5 && t.ext && t.ext.taskType === 'beanDailySign' && t.encryptAssignmentId);
  if (tasks.length !== 1) throw new Error('每日任务无法唯一识别，未提交领取');
  return tasks[0];
}
function jdcLabel(mode) { return mode === 'query_compare' ? '环境对比查询（不领取）' : mode === 'diagnose' ? '本地签名诊断' : mode === 'daily' ? '普通签到' : mode === 'blindbox' ? 'PLUS每日盲盒' : '每日刮卡'; }
function jdcEndpoint(url) {
  const m = String(url).match(/^https:\/\/api\.m\.jd\.com\/(api|client\.action)(?:\?|$)/);
  if (!m) throw new Error('接口地址不符');
  return 'https://api.m.jd.com/' + m[1];
}

// The observed scratch query uses a business success code different from daily sign-in.
function jdcQueryAccepted(data, mode) {
  const code = String(data && data.code);
  if (code === '0') return true;
  return mode === 'scratch' && code === '1711000' && data.msg === '成功' &&
    !!(data.rs && data.rs.beanTask && Array.isArray(data.rs.beanTask.taskList));
}

function jdcBoxAccepted(data) {
  return !!data && String(data.code)==='1711000' && data.msg==='成功' && !!data.rs;
}
function jdcBoxToday(data) {
  if(!jdcBoxAccepted(data)||!Array.isArray(data.rs.sendBenefitList))
    throw new Error('盲盒奖励记录不完整，未继续开盒');
  return data.rs.sendBenefitList.filter(x=>String(x.prizeTime||'').slice(0,10)===jdcDay());
}
const Z_KEY='JD_PLANT_CHECKIN_ACCOUNT_V1';
const Z_LINK='4HcenxuZM4XiHesOb1HG4g';
function zAccepted(data){return !!data&&data.success===true&&String(data.code)==='0'&&!!data.data;}
function zMessage(data){return String(data.displayMsg||data.msg||data.message||data.errMsg||'无说明').replace(/https?:\/\/\S+/g,'[链接]').slice(0,160);}
function zSummary(result){
 if(result.status==='manual_required')return result.message;
 if(['signed_confirmed','already_done'].includes(result.status)){
  let text=result.status==='already_done'?'今天已领取':result.beanQuantity>0?'获得 '+result.beanQuantity+' 京豆':'已领取，奖励见活动页';
  if(result.continuousDays>0)text+='，连续 '+result.continuousDays+' 天';
  return '成功，'+text+'。';
 }
 const text=[result.message,result.queryMessage,result.claimMessage].join(' ');
 return '失败，'+(/未登[录陆]|登录|凭据|账号.*匹配|原始签名环境/.test(text)?'凭据可能失效或不完整，请重新获取种豆凭据。':'请查看执行日志或最近结果。');
}
function zStatus(data){
 if(!zAccepted(data))throw new Error('签到状态查询失败：'+String(data&&data.code)+' '+(data?zMessage(data):'无说明'));
 const main=data.data.signMainVo,list=data.data.signListVo;
 if(!main||!Array.isArray(list))throw new Error('签到状态结构变化，未继续领取');
 const today=list.find(x=>x.signDate===jdcDay()&&Number(x.status)===3);
 if(today)return {done:true,main};
 const task=main.beforeTaskVo;
 if(Number(main.currentStatus)===0&&task&&task.taskType==='BROWSE_RTB'&&task.taskFinished===false){
  const seconds=Number(task.timeLimitPeriod);
  const duration=Number.isInteger(seconds)&&seconds>0&&seconds<=3600?seconds+'秒':'';
  throw Object.assign(new Error('请先到种豆活动页手动完成浏览页面'+duration+'，再执行签到。'),{status:'manual_required'});
 }
 if(Number(main.currentStatus)!==1)throw new Error('今日可领取状态不明确，未继续领取');
 return {done:false,main};
}
// Only this plugin's existing same-account login fields are refreshed.
function zSyncLogin(profile,cookie,source,observedAt){
 const pin=jdcCookie(cookie,'pt_pin'),key=jdcCookie(cookie,'pt_key');
 if(!profile||profile.pin!==pin||!pin||!key)return false;
 let changed=false;
 for(const kind of ['query','claim']){
  const template=profile[kind];
  if(!template||!template.headers||jdcCookie(template.headers.Cookie,'pt_pin')!==pin)continue;
  if(observedAt<Number(template.loginUpdatedAt||template.capturedAt||0))continue;
  template.headers.Cookie=String(template.headers.Cookie).split(';').map(x=>x.trim()).filter(x=>x&&!/^pt_(?:pin|key)=/.test(x)).concat(['pt_pin='+pin,'pt_key='+key]).join('; ');
  template.loginUpdatedAt=observedAt;template.loginSource=source;changed=true;
 }
 return changed;
}
function zLoginObservedAt(){
 const start=typeof $script!=='undefined'&&$script.startTime;
 const value=start?Number(new Date(start)):NaN;
 return Number.isFinite(value)&&value>0&&value<=Date.now()?value:Date.now();
}
(function(){
 try{
  if(typeof $request==='undefined'||typeof $response==='undefined'||$request.method!=='POST'||Number($response.status)!==200)return;
  const url=String($request.url||'');
  if(!/^https:\/\/api\.m\.jd\.com\/client\.action\?/.test(url))return;
  const params=jdcParseForm((url.split('?')[1]||'').split('#')[0]);
  if(!['startup','logConfig','queryPagePopWindow','babelGetGuideTips'].includes(params.functionId))return;
  const data=JSON.parse($response.body||'{}');
  if(!data||data.success===false||!['0','200'].includes(String(data.code)))return;
  const profile=jdcRead(Z_KEY,null);
  if(!zSyncLogin(profile,jdcHeader($request.headers,'Cookie'),'daily-use:'+params.functionId,zLoginObservedAt()))return;
  jdcWrite(Z_KEY,profile);
  console.log('[种豆签到] 已从日常请求同步同账号登录凭据，活动模板和设备令牌保持各自记录');
 }catch(_){console.log('[种豆签到] 日常登录凭据同步失败，保留原记录');}
 finally{$done({});}
})();
