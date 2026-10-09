// JD check-in test: local credential capture only.
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
function jdcLabel(mode) { return mode === 'query_compare' ? '环境对比查询（不领取）' : mode === 'diagnose' ? '本地签名诊断' : mode === 'daily' ? '普通签到' : '每日刮卡'; }
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
(function () {
  try {
    if (typeof $request === 'undefined' || typeof $response === 'undefined') throw new Error('请通过插件响应规则获取凭据');
    if ($request.method !== 'POST' || Number($response.status) !== 200) return;
    const endpoint = jdcEndpoint($request.url);
    const query = jdcParseForm(($request.url.split('?')[1] || '').split('#')[0]);
    const params = Object.assign(query, jdcParseForm($request.body));
    const fid = params.functionId;
    let mode, kind;
    if (fid === 'findBeanSceneNew' && params.appid === 'signed_wh5_ihub') { mode = 'daily'; kind = 'query'; }
    else if (fid === 'bff_rightsCenter_jdInteractTask' && params.appid === 'plus_business') { mode = 'scratch'; kind = 'query'; }
    else if (fid === 'bff_rightsCenter_interaction') {
      const body = JSON.parse(params.body || '{}');
      if (body.activityCode !== 'beanDailySign' || body.scene !== 'commonDoInteractiveAssignment') return;
      if (params.appid === 'signed_wh5' && body.commonScene === 'secKillChannel') mode = 'daily';
      else if (params.appid === 'plus_business' && body.actionType === '100' && body.itemId === '') mode = 'scratch';
      else return;
      kind = 'interaction';
    } else return;
    const data = JSON.parse($response.body || '{}');
    if (kind === 'query' ? !jdcQueryAccepted(data, mode) : String(data.code) !== '0') return;
    if (kind === 'query') jdcTask(data, mode);
    const sig = String(params.h5st || '').split(';');
    const expected = kind === 'query' && mode === 'daily' ? 'ed9a2' : mode === 'daily' ? '90b26' : 'b63ff';
    if (sig.length !== 10 || sig[5] !== '5.3' || sig[2] !== expected) throw new Error('签名版本或活动标识变化，请保留日志后反馈');
    const cookie = jdcHeader($request.headers, 'cookie');
    const pin = jdcCookie(cookie, 'pt_pin');
    if (!pin || !jdcCookie(cookie, 'pt_key')) throw new Error('未获取完整登录凭据');
    const headers = {};
    ['Cookie', 'User-Agent', 'Referer', 'Origin', 'x-rp-client', 'x-referer-page', 'request-from', 'x-babel-ihub', 'withcredentials', 'headers', 'swimlane', 'mark'].forEach(name => {
      const value = jdcHeader($request.headers, name);
      if (value) headers[name] = value;
    });
    if (!headers['User-Agent'] || !headers.Referer) throw new Error('缺少页面环境信息');
    delete params.h5st;
    const account = jdcRead(JDC_KEY, null);
    const state = account && account.pin === pin ? account : {pin, modes:{}};
    const previous = state.modes[mode] || {};
    const isNew = !previous[kind] || !previous[kind].referenceEnvironmentEncoded;
    previous[kind] = {endpoint, params, capturedAt:Date.now(), signatureAppId:expected, signatureParameterEncoding:sig[9], referenceEnvironmentEncoded:sig[7]};
    previous.headers = headers;
    previous.capturedAt = Date.now();
    state.modes[mode] = previous;
    jdcWrite(JDC_KEY, state);
    console.log('[京东签到] 已保存' + jdcLabel(mode) + (kind === 'query' ? '任务查询凭据' : '领取请求模板') + '（未修改原请求）');
    if (isNew) $notification.post('京东签到测试', jdcLabel(mode) + '凭据已保存', kind === 'query' ? '可以在 Loon 中手动运行对应测试。' : '已保存领取模板；还需进入活动页面获取任务查询凭据。');
  } catch (e) {
    console.log('[京东签到] ' + e.message);
    $notification.post('京东签到测试', '凭据获取未完成', e.message);
  } finally { $done({}); }
})();
