// Passive same-account login refresh. No requests or token generation.
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
// Refresh only the shared login pair; preserve every activity's device/page context.
function jdcSyncLogin(state, cookie, source, observedAt) {
  const pin=jdcCookie(cookie,'pt_pin'),key=jdcCookie(cookie,'pt_key');
  if(!state||!state.modes||!pin||!key||state.pin!==pin)return false;
  let changed=false;
  for(const name of ['daily','scratch','blindbox']) {
    const profile=state.modes[name];
    if(!profile||!profile.headers||jdcCookie(profile.headers.Cookie,'pt_pin')!==pin)continue;
    const latest=Number(profile.loginUpdatedAt||profile.capturedAt||0);
    if(observedAt<latest)continue;
    const pairs=String(profile.headers.Cookie||'').split(';').map(x=>x.trim()).filter(Boolean);
    profile.headers.Cookie=pairs.filter(x=>!/^pt_(?:pin|key)=/.test(x)).concat(['pt_pin='+pin,'pt_key='+key]).join('; ');
    profile.loginUpdatedAt=observedAt;
    profile.loginSource=source;
    changed=true;
  }
  return changed;
}
function jdcLoginObservedAt() {
  const start=typeof $script!=='undefined'&&$script.startTime;
  const value=start?Number(new Date(start)):NaN;
  return Number.isFinite(value)&&value>0&&value<=Date.now()?value:Date.now();
}
(function(){
 try {
  if(typeof $request==='undefined'||typeof $response==='undefined'||$request.method!=='POST'||Number($response.status)!==200)return;
  const url=String($request.url||'');
  if(!/^https:\/\/api\.m\.jd\.com\/client\.action\?/.test(url))return;
  const params=jdcParseForm((url.split('?')[1]||'').split('#')[0]);
  if(!['startup','logConfig','queryPagePopWindow','babelGetGuideTips'].includes(params.functionId))return;
  const data=JSON.parse($response.body||'{}');
  if(!data||data.success===false||!['0','200'].includes(String(data.code)))return;
  const state=jdcRead(JDC_KEY,null);
  if(!jdcSyncLogin(state,jdcHeader($request.headers,'Cookie'),'daily-use:'+params.functionId,jdcLoginObservedAt()))return;
  jdcWrite(JDC_KEY,state);
  console.log('[京东签到] 已从日常请求同步同账号登录凭据，活动模板和设备令牌保持各自记录');
 }catch(_){console.log('[京东签到] 日常登录凭据同步失败，保留原记录');}
 finally{$done({});}
})();
