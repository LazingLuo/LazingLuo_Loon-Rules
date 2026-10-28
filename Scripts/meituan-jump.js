// Observe task links already sent by the Meituan App. No business API replay.
'use strict';
const MT_VERSION = '0.1.1';
const MT_KEY = 'LAZING_MT_JUMP_TASKS_V1';
const MT_BASE = 'http://example.com/loon-meituan-jump/v1/';
const MT_TTL = 24 * 60 * 60 * 1000;
const MT_TASKS = [
  {key: 'antManor', name: '蚂蚁庄园', prefix: '浏览蚂蚁庄园', route: /^alipays:\/\/platformapi\/startapp\?/},
  {key: 'antForest', name: '蚂蚁森林', prefix: '浏览蚂蚁森林', route: /^alipays:\/\/platformapi\/startapp\?/},
  {key: 'taobaoFarm', name: '淘宝芭芭农场', prefix: '浏览淘宝芭芭农场', route: /^tbopen:\/\/m\.taobao\.com\/tbopen\/index\.html\?/},
  {key: 'alipayFarm', name: '支付宝芭芭农场', prefix: '浏览支付宝芭芭农场', route: /^alipays:\/\/platformapi\/startapp\?/},
  {key: 'etao', name: '一淘', prefix: '浏览一淘', route: /^https:\/\/market\.m\.taobao\.com\//},
  {key: 'cmcc', name: '中国移动', prefix: '浏览中国移动', route: /^cn\.10086\.app:\/\/url=https(?:%3[aA]%2[fF]%2[fF]|:\/\/)wx\.10086\.cn(?:%2[fF]|\/)/},
  {key: 'weibo', name: '微博', prefix: '浏览微博', route: /^sinaweibo:\/\/changegroup\?/}
];
// A character substitution in lx_dict telemetry; structural JSON is retained.
// Complete ASCII letter/digit mapping recovered from independent field names,
// UUIDs, timestamps, URL escapes and native trace labels in the supplied HARs.
const MT_MAP = {"k":"s","t":"t","x":"m","`":"i",",":"l","1":"e","?":"c","a":"h","9":"a","n":"n","U":"_","v":"o","u":"u","r":"r","l":"k","%":"p","g":"v","b":"b","@":"T","h":"I","f":"f","C":"d","D":"1",">":"7","_":"9","P":"3","$":"0","B":"4","Z":"6","7":"2","W":"8","E":"-","X":",","!":"y","p":"G","H":"S","I":"g","e":"q","d":"w","Y":"5","8":"x","c":"/","0":"A","Q":"F","(":"%","N":"=","=":"&","^":"?","M":"U","z":"P","q":".",".":"D","*":"C","O":"N","-":"z","A":"V","|":"M","G":"L","j":"O","m":"R","y":"E","R":"B","<":"K","J":"Y","K":"W","+":"H","F":"Q","T":"j","V":"Z","3":"X","s":"J"};

function mtDecode(value) {
  return Array.from(value).map(c => Object.prototype.hasOwnProperty.call(MT_MAP, c) ? MT_MAP[c] : c).join('');
}
function mtObject(raw) {
  try {
    const obj = JSON.parse(raw || 'null');
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : null;
  } catch (_) { return null; }
}
function mtValidLink(task, url) {
  return typeof url === 'string' && url.length > 20 && url.length <= 16384 &&
    !/[\x00-\x20\x7f<>"`\\]/.test(url) && task.route.test(url) &&
    !/%(?![a-fA-F0-9]{2})/.test(url);
}
function mtObserve(body, old, now) {
  const result = {record: old, changed: [], parsed: 0, invalid: 0, accountChanged: false};
  if (typeof body !== 'string' || body.length > 3 * 1024 * 1024) return result;
  let envelopes;
  try { envelopes = JSON.parse(body); } catch (_) { return result; }
  if (!Array.isArray(envelopes)) envelopes = [envelopes];
  if (envelopes.length > 100) return result;
  let record = old && old.schema === 'lazing-meituan-task-cache-v1' && old.tasks &&
    typeof old.tasks === 'object' && !Array.isArray(old.tasks) ? JSON.parse(JSON.stringify(old)) : null;
  const changed = new Set();
  envelopes.forEach(envelope => {
    if (!envelope || typeof envelope !== 'object') return;
    const account = String(envelope.uid || '');
    if (!account || account === '0' || account.length > 128) return;
    let events;
    try {
      events = typeof envelope.evs === 'string' ? JSON.parse(
        envelope.lx_dict === true || envelope.lx_dict === 'true' ? mtDecode(envelope.evs) : envelope.evs) : envelope.evs;
    } catch (_) { return; }
    if (!Array.isArray(events)) return;
    result.parsed += 1;
    // Do not allow late old telemetry to replace a newer user's cache.
    const packageTime = Number(envelope.package_tm) || now;
    if (Math.abs(packageTime - now) > 15 * 60 * 1000) return;
    if (!record || record.account !== account) {
      if (record && packageTime < Number(record.lastPackageTime || 0)) return;
      record = {schema: 'lazing-meituan-task-cache-v1', account, tasks: {}, updatedAt: now, lastPackageTime: packageTime};
      result.accountChanged = Boolean(old && old.account !== account);
      changed.clear();
    }
    record.lastPackageTime = Math.max(Number(record.lastPackageTime) || 0, packageTime);
    function walk(value, depth) {
      if (depth > 18 || !value || typeof value !== 'object') return;
      if (Array.isArray(value)) { value.forEach(x => walk(x, depth + 1)); return; }
      const title = typeof value.title === 'string' ? value.title : '';
      const task = MT_TASKS.find(x => title.startsWith(x.prefix));
      const detail = value.task_detail;
      if (task && detail && typeof detail === 'object' && !Array.isArray(detail)) {
        const source = detail.task_url;
        // Object form: only iOS, never substitute Android when iOS is missing.
        const url = typeof source === 'string' ? source : source && source.iosDeeplink;
        const stamp = Number(value.stm) || packageTime;
        if (mtValidLink(task, url) && typeof detail.task_code === 'string' && detail.task_code) {
          const prior = record.tasks[task.key];
          if (!prior || stamp >= Number(prior.sourceTime || 0)) {
            if (!prior || prior.url !== url) changed.add(task.key);
            record.tasks[task.key] = {name: task.name, url, capturedAt: now, sourceTime: stamp};
            record.updatedAt = now;
          }
        } else if (source) result.invalid += 1;
      }
      Object.keys(value).forEach(key => {
        if (key !== 'task_detail') walk(value[key], depth + 1);
      });
    }
    events.forEach(ev => {
      // Carry the actual event time into its task record, without saving events.
      const lab = ev && ev.val_lab;
      if (lab && typeof lab === 'object') {
        const copy = Object.assign({}, lab, {stm: ev.stm});
        walk(copy, 0);
      }
    });
  });
  result.record = record;
  result.changed = Array.from(changed);
  return result;
}
function mtPlan(record, now) {
  const plan = {schema: 'lazing-meituan-jump-plan-v1', count: 0, message: '', summary: ''};
  const missing = [], ready = [];
  MT_TASKS.forEach(task => {
    plan[task.key] = '';
    const item = record && record.tasks && record.tasks[task.key];
    const age = item && now - Number(item.capturedAt);
    if (item && Number.isFinite(age) && age >= -60000 && age <= MT_TTL && mtValidLink(task, item.url)) {
      plan[task.key] = item.url;
      plan.count += 1;
      ready.push(task.name);
    } else missing.push(task.name);
  });
  plan.summary = '本次准备 ' + plan.count + '/7 项：' + ready.join('、') +
    (missing.length ? '。缺少：' + missing.join('、') : '');
  plan.message = plan.count ? plan.summary : '还没记录到任务链接。请打开美团金币任务列表，停留几秒后再运行。';
  return plan;
}
function mtHeader(headers, name) {
  const keys = Object.keys(headers || {}).filter(k => k.toLowerCase() === name.toLowerCase());
  return keys.length === 1 ? String(headers[keys[0]]) : '';
}
function mtBridge(request, argument, record, now) {
  const raw = argument && typeof argument === 'object' ? argument.pairing : argument;
  const settings = String(raw || '').trim().split('|');
  const key = settings[0], proof = settings[1];
  const reply = value => ({response: {status: 200, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, max-age=0',
    'Pragma': 'no-cache', 'X-Content-Type-Options': 'nosniff'
  }, body: JSON.stringify(Object.assign({schema: 'lazing-meituan-jump-plan-v1', version: MT_VERSION,
    connected: '', proof: '', code: '', message: '', count: 0, antManor: '', antForest: '',
    taobaoFarm: '', alipayFarm: '', etao: '', cmcc: '', weibo: ''}, value))}});
  if (!/^[a-f0-9]{64}$/.test(key || '') || !/^[a-f0-9]{64}$/.test(proof || '')) return reply({code: 'NOT_PAIRED', message: '请使用同一套插件和快捷指令'});
  if (!request || request.method !== 'GET' || ![MT_BASE + 'probe', MT_BASE + 'tasks'].includes(request.url)) return reply({code: 'BAD_REQUEST', message: '本机入口不匹配'});
  if (Object.keys(request.headers || {}).some(k => /^(origin|referer)$/i.test(k))) return reply({code: 'BROWSER_DENIED', message: '请通过配套快捷指令读取'});
  if (request.url === MT_BASE + 'probe') return reply({connected: 'yes', proof, code: 'CONNECTED'});
  if (mtHeader(request.headers, 'X-Lazing-Export-Key') !== key) return reply({code: 'PAIRING_FAILED', message: '插件与快捷指令未配对，请导入同一套文件'});
  const plan = mtPlan(record, now);
  return reply(Object.assign(plan, {code: plan.count ? 'READY' : 'NO_TASKS'}));
}
if (typeof module !== 'undefined' && module.exports) module.exports = {MT_MAP, MT_TASKS, MT_KEY, MT_BASE, MT_TTL,
  mtDecode, mtObserve, mtPlan, mtBridge, mtValidLink};
if (typeof $done === 'function') {
  const now = Date.now();
  const read = () => mtObject($persistentStore.read(MT_KEY));
  if (typeof $request === 'undefined') {
    const p = mtPlan(read(), now);
    const content = p.message + '\n每项停留8秒；这里显示链接记录，不判断金币到账。';
    console.log('[美团任务] ' + content);
    $done({title: '美团任务链接记录', content});
  } else if (String($request.url).startsWith(MT_BASE)) {
    let response;
    try { response = mtBridge($request, typeof $argument === 'undefined' ? '' : $argument, read(), now); }
    catch (_) { response = {response: {status: 200, headers: {'Content-Type': 'application/json'}, body: JSON.stringify({count: 0, message: '本机读取失败，请查看插件是否启用'})}}; }
    console.log('[美团任务] ' + mtObject(response.response.body).code);
    $done(response);
  } else if (/^https:\/\/lx\d*\.meituan\.com\/(?:\?.*)?$/.test(String($request.url)) && $request.method === 'POST') {
    try {
      const prior = read();
      const found = mtObserve($request.body, prior, now);
      if (found.record && JSON.stringify(prior) !== JSON.stringify(found.record)) $persistentStore.write(JSON.stringify(found.record), MT_KEY);
      if (found.changed.length || found.accountChanged) {
        const names = found.changed.map(k => MT_TASKS.find(t => t.key === k).name);
        const p = mtPlan(found.record, now);
        console.log('[美团任务] 已记录 ' + p.count + '/7 项：' + names.join('、'));
        $notification.post('美团任务链接', '已记录 ' + p.count + '/7 项', names.join('、') || '账号已切换，请重新打开任务列表');
      }
      if (found.invalid) console.log('[美团任务] ' + found.invalid + ' 条地址未通过检查，已跳过');
    } catch (_) { console.log('[美团任务] 本次记录未完成，原请求继续'); }
    $done({}); // Preserve request body, headers and destination.
  } else $done({});
}
