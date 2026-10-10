// Independent plant-bean daily gift capture. Credentials stay in Loon.
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
function zStatus(data){
 if(!zAccepted(data))throw new Error('签到状态查询失败，未继续领取');
 const main=data.data.signMainVo,list=data.data.signListVo;
 if(!main||!Array.isArray(list))throw new Error('签到状态结构变化，未继续领取');
 const today=list.find(x=>x.signDate===jdcDay()&&Number(x.status)===3);
 if(today)return {done:true,main};
 if(Number(main.currentStatus)!==1)throw new Error('今日可领取状态不明确，未继续领取');
 return {done:false,main};
}
(function(){
 try {
  if(typeof $request==='undefined'||typeof $response==='undefined'||$request.method!=='POST'||Number($response.status)!==200)return;
  const endpoint=jdcEndpoint($request.url);
  const params=Object.assign(jdcParseForm(($request.url.split('?')[1]||'').split('#')[0]),jdcParseForm($request.body));
  if(params.appid!=='wegame-hub'||!['weGameHome','weGameLottery'].includes(params.functionId))return;
  const body=JSON.parse(params.body||'{}');
  if(body.linkId!==Z_LINK||Number(body.envType)!==1||Number(body.appType)!==1)return;
  const data=JSON.parse($response.body||'{}');
  if(!zAccepted(data))return;
  const kind=params.functionId==='weGameHome'?'query':'claim';
  if(kind==='query')zStatus(data);
  const sig=String(params.h5st||'').split(';'),appId=kind==='query'?'101aa':'730a6';
  if(sig.length!==10||sig[5]!=='5.3'||sig[2]!==appId)throw new Error('签名配置变化，请反馈执行日志');
  const headers={};
  ['Cookie','User-Agent','Referer','Origin','wg-sdk-token','x-rp-client','x-referer-page','request-from'].forEach(k=>{const v=jdcHeader($request.headers,k);if(v)headers[k]=v;});
  const pin=jdcCookie(headers.Cookie,'pt_pin');
  if(!pin||!jdcCookie(headers.Cookie,'pt_key')||!headers['User-Agent']||!headers.Referer)throw new Error('登录或页面凭据不完整，未保存');
  delete params.h5st;
  const old=jdcRead(Z_KEY,null),profile=old&&old.pin===pin?old:{pin};
  const first=!profile[kind];
  profile[kind]={endpoint,params,capturedAt:Date.now(),appId,encoding:sig[9],environment:sig[7],headers};
  jdcWrite(Z_KEY,profile);
  console.log('[种豆签到] 已保存'+(kind==='query'?'查询凭据':'领取模板')+'，未修改原请求');
  if(first)$notification.post('种豆得豆签到','凭据已保存',kind==='query'?'可关闭获取开关，在Loon中手动测试。':'已保存领取模板；还需进入页面保存查询凭据。');
 }catch(e){console.log('[种豆签到] 获取失败');$notification.post('种豆得豆签到','凭据获取未完成','请检查活动页面、登录状态或脚本版本。');}
 finally{$done({});}
})();
