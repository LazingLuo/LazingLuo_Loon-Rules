// Observe task links already sent by the Meituan App. No business API replay.
'use strict';
const MT_VERSION = '0.4.2';
const MT_KEY = 'LAZING_MT_JUMP_TASKS_V1';
const MT_BASE = 'http://example.com/loon-meituan-jump/v1/';
const MT_TTL = 24 * 60 * 60 * 1000;
const MT_CLICK_FALLBACK = new Set(['xianyu', 'baiduLite', 'taobaoLite', 'diantao']);
const mtDay = time => Math.floor((time + 8 * 60 * 60 * 1000) / MT_TTL);
const MT_TASKS = [
  {key: 'antManor', name: '蚂蚁庄园', prefix: '浏览蚂蚁庄园', route: /^alipays:\/\/platformapi\/startapp\?/},
  {key: 'antForest', name: '蚂蚁森林', prefix: '浏览蚂蚁森林', route: /^alipays:\/\/platformapi\/startapp\?/},
  {key: 'taobaoFarm', name: '淘宝芭芭农场', prefix: '浏览淘宝芭芭农场', route: /^tbopen:\/\/m\.taobao\.com\/tbopen\/index\.html\?/},
  {key: 'alipayFarm', name: '支付宝芭芭农场', prefix: '浏览支付宝芭芭农场', route: /^alipays:\/\/platformapi\/startapp\?/},
  {key: 'etao', name: '一淘', prefix: '浏览一淘', route: /^https:\/\/market\.m\.taobao\.com\//},
  {key: 'cmcc', name: '中国移动', prefix: '浏览中国移动', route: /^cn\.10086\.app:\/\/url=https(?:%3[aA]%2[fF]%2[fF]|:\/\/)wx\.10086\.cn(?:%2[fF]|\/)/},
  {key: 'weibo', name: '微博', prefix: '浏览微博', route: /^sinaweibo:\/\/changegroup\?/},
  {key: 'xianyu', name: '闲鱼', prefix: '浏览闲鱼', route: /^https:\/\/h5\.m\.goofish\.com\/wow\/moyu\/moyu-project\/coin\/pages\/coinCallApp\?/},
  {key: 'alipayMember', name: '支付宝会员', prefix: '浏览支付宝会员', route: /^alipays:\/\/platformapi\/startapp\?/},
  {key: 'alipayGold', name: '支付宝金豆夺宝', prefix: '逛一逛支付宝金豆夺宝', route: /^alipays:\/\/platformapi\/startapp\?/},
  {key:'baiduLite',name:'百度极速版',prefix:'浏览百度极速版',route:/^https:\/\/activity\.baidu\.com\/mbox\/4a89aa9163\/matrixInvoke\?/,playId:'1480'},
  {key:'taobaoLite',name:'淘宝特价版',prefix:'浏览淘宝特价版',route:/^https:\/\/huodong\.taobao\.com\/wow\/z\/sale\/static\/meituan\?/,playId:'1568'},
  {key:'diantao',name:'点淘',prefix:'浏览点淘',route:/^https:\/\/market\.m\.taobao\.com\/app\/tb-zhibo-app\/callapp-mid-center\/home\.html\?/,playId:'1483'}
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
// Read only the captured query; never construct or request a task ticket.
function mtLinkParams(url){
 try{const result={};for(const part of url.split('?')[1].split('#')[0].split('&')){if(!part)continue;const i=part.indexOf('='),k=decodeURIComponent((i<0?part:part.slice(0,i)).replace(/\+/g,' '));if(Object.prototype.hasOwnProperty.call(result,k))return null;result[k]=decodeURIComponent((i<0?'':part.slice(i+1)).replace(/\+/g,' '));}return result;}catch(_){return null;}
}
function mtNewLink(task,url){const p=mtLinkParams(url);return !!p&&p.playId===task.playId&&typeof p.taskCode==='string'&&p.taskCode.length>0&&typeof p.token==='string'&&p.token.length>0;}

function mtXianyuLink(url) {
  const params = mtLinkParams(url);
  return !!params?.taskCode && !!params.userToken && /^\d+$/.test(params.playId || '') && params.channel === 'meituanCoin';
}
function mtValidLink(task, url) {
  return typeof url === 'string' && url.length > 20 && url.length <= 16384 &&
    !/[\x00-\x20\x7f<>"`\\]/.test(url) && task.route.test(url) &&
    !/%(?![a-fA-F0-9]{2})/.test(url) && (!task.playId || mtNewLink(task,url)) && (task.key !== 'xianyu' || mtXianyuLink(url));
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
  if(record)for(const key of ['mtContent','mtPig','mtOrchard'])delete record.tasks[key];
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
    function walk(value, depth, eventTime, sourceType) {
      if (depth > 18 || !value || typeof value !== 'object') return;
      if (Array.isArray(value)) { value.forEach(x => walk(x, depth + 1, eventTime, sourceType)); return; }
      const title = typeof value.title === 'string' ? value.title : '';
      const task = MT_TASKS.find(x => title.startsWith(x.prefix));
      const detail = value.task_detail;
      if (task && detail && typeof detail === 'object' && !Array.isArray(detail)) {
        const source = detail.task_url;
        // Object form: only iOS, never substitute Android when iOS is missing.
        const url = typeof source === 'string' ? source : source && source.iosDeeplink;
        const stamp = Number(value.stm) || eventTime || packageTime;
        const tracked = MT_CLICK_FALLBACK.has(task.key);
        const code = detail.task_code;
        const params = tracked && typeof url === 'string' ? mtLinkParams(url) : null;
        const validCode = typeof code === 'string' && code.length > 0 && code.length <= 512;
        const freshEvent = Math.abs(now - stamp) <= 15 * 60 * 1000;
        if (tracked && sourceType === 'list' && validCode && freshEvent) {
          const hints = record.listHints ||= {};
          if (!hints[task.key] || stamp >= hints[task.key].sourceTime) {
            hints[task.key] = {code, sourceTime: stamp};
          }
        }
        if (validCode && mtValidLink(task, url) && (!tracked || (freshEvent && params?.taskCode === code))) {
          const items = tracked && sourceType !== 'list' ? (record.jumpTasks ||= {}) : record.tasks;
          const prior = items[task.key];
          if (!prior || stamp >= Number(prior.sourceTime || 0)) {
            const kind = prior?.url === url && prior.source === 'click' && sourceType === 'jump' ? 'click' : sourceType;
            if (!prior || prior.url !== url || (kind === 'click' && prior.source !== 'click')) changed.add(task.key);
            items[task.key] = {name: task.name, url, capturedAt: now, sourceTime: stamp, source: kind};
            record.updatedAt = now;
          }
        } else if (source) result.invalid += 1;
      }
      Object.keys(value).forEach(key => {
        if (key !== 'task_detail') walk(value[key], depth + 1, eventTime, sourceType);
      });
    }
    events.forEach(ev => {
      // Carry the actual event time into its task record, without saving events.
      const lab = ev && ev.val_lab;
      if (lab && typeof lab === 'object') {
        const copy = Object.assign({}, lab, {stm: ev.stm});
        walk(copy, 0, Number(ev.stm) || packageTime, ev.nm === 'MC' ? 'click' : 'list');
      }
      // Native mini-app transitions put the same task object under tag.game.
      // Only inspect this observed task context, not arbitrary page URLs.
      if (ev && ev.tag && ev.tag.game && typeof ev.tag.game === 'object') {
        walk(ev.tag.game, 0, Number(ev.stm) || packageTime, 'jump');
      }
    });
  });
  result.record = record;
  result.changed = Array.from(changed);
  return result;
}
function mtPlan(record, now, tasks = MT_TASKS) {
  const plan = {schema: 'lazing-meituan-jump-plan-v1', count: 0, message: '', summary: ''};
  const missing = [], ready = [], fallback = [];
  tasks.forEach(task => {
    plan[task.key] = '';
    const tracked = MT_CLICK_FALLBACK.has(task.key);
    const hint = record?.listHints?.[task.key];
    const currentCode = tracked && mtDay(hint?.sourceTime) === mtDay(now) ? hint.code : '';
    function usable(item) {
      if (!item) return false;
      const age = now - Number(item.capturedAt);
      if (!Number.isFinite(age) || age < -60000 || age > MT_TTL || !mtValidLink(task, item.url)) return false;
      if (!tracked) return true;
      const stamp = Number(item.sourceTime || item.capturedAt);
      const code = mtLinkParams(item.url)?.taskCode;
      return stamp <= now + 60000 && mtDay(stamp) === mtDay(now) && !!code && (!currentCode || currentCode === code);
    }
    const saved = record?.tasks?.[task.key];
    const jump = record?.jumpTasks?.[task.key];
    const list = usable(saved) && (!tracked || saved.source === 'list') ? saved : null;
    const item = list || (usable(jump) ? jump : (usable(saved) ? saved : null));
    if (item) {
      plan[task.key] = item.url;
      plan.count += 1;
      ready.push(task.name);
      if (tracked && !list) fallback.push(task.name);
    } else missing.push(task.name);
  });
  plan.fallbackSummary = fallback.length ? '跳转记录补齐：' + fallback.join('、') : '';
  plan.summary = '本次准备 ' + plan.count + '/' + tasks.length + ' 项：' + ready.join('、') +
    (plan.fallbackSummary ? '。' + plan.fallbackSummary : '') +
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
    taobaoFarm: '', alipayFarm: '', etao: '', cmcc: '', weibo: '', xianyu: '',
    alipayMember: '', alipayGold: '', baiduLite: '', taobaoLite: '', diantao: '', mtContent: '', mtPig: '', mtOrchard: ''}, value))}});
  if (!/^[a-f0-9]{64}$/.test(key || '') || !/^[a-f0-9]{64}$/.test(proof || '')) return reply({code: 'NOT_PAIRED', message: '请使用同一套插件和快捷指令'});
  if (!request || request.method !== 'GET' || ![MT_BASE + 'probe', MT_BASE + 'tasks'].includes(request.url)) return reply({code: 'BAD_REQUEST', message: '本机入口不匹配'});
  if (Object.keys(request.headers || {}).some(k => /^(origin|referer)$/i.test(k))) return reply({code: 'BROWSER_DENIED', message: '请通过配套快捷指令读取'});
  if (request.url === MT_BASE + 'probe') return reply({connected: 'yes', proof, code: 'CONNECTED'});
  if (mtHeader(request.headers, 'X-Lazing-Export-Key') !== key) return reply({code: 'PAIRING_FAILED', message: '插件与快捷指令未配对，请导入同一套文件'});
  // Older Shortcuts only contain seven branches. Keep their counts accurate.
  const client = mtHeader(request.headers, 'X-Lazing-Jump-Plan');
  const tasks = client === 'extended-v3' ? MT_TASKS : ['extended-v1','extended-v2'].includes(client) ? MT_TASKS.filter(t=>!t.playId) : MT_TASKS.slice(0,7);
  const plan = mtPlan(record, now, tasks);
  return reply(Object.assign(plan, {code: plan.count ? 'READY' : 'NO_TASKS'}));
}
if (typeof module !== 'undefined' && module.exports) module.exports = {MT_MAP, MT_TASKS, MT_KEY, MT_BASE, MT_TTL,
  mtDecode, mtObserve, mtPlan, mtBridge, mtValidLink, mtLinkParams};
if (typeof $done === 'function') {
  const now = Date.now();
  const read = () => mtObject($persistentStore.read(MT_KEY));
  if (typeof $request === 'undefined') {
    const p = mtPlan(read(), now);
    const content = p.message + '\n配套快捷指令一淘、中国移动停留10秒，其余5秒；这里只显示链接记录，不判断金币到账。';
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
        console.log('[美团任务] 已记录 ' + p.count + '/' + MT_TASKS.length + ' 项：' + names.join('、'));
        $notification.post('美团任务链接', '已记录 ' + p.count + '/' + MT_TASKS.length + ' 项', [names.join('、'), p.fallbackSummary].filter(Boolean).join('。') || '账号已切换，请重新打开任务列表');
      }
      if (found.invalid) console.log('[美团任务] ' + found.invalid + ' 条地址未通过检查，已跳过');
    } catch (_) { console.log('[美团任务] 本次记录未完成，原请求继续'); }
    $done({}); // Preserve request body, headers and destination.
  } else $done({});
}
