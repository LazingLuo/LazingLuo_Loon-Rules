'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const core = require('../Scripts/meituan-jump.js');
const {MT_TASKS, MT_BASE, MT_KEY, MT_TTL, mtObserve, mtDecode, mtPlan, mtBridge, mtValidLink} = core;
let checks = 0;
function check(ok, label) { assert.ok(ok, label); checks += 1; }
const now = Date.parse('2026-11-06T13:00:00+08:00'), key = 'a'.repeat(64), proof = 'b'.repeat(64);
const links = {
  antManor: 'alipays://platformapi/startapp?appId=20000067&url=FAKE',
  antForest: 'alipays://platformapi/startapp?appId=20000067&url=FAKE_FOREST',
  taobaoFarm: 'tbopen://m.taobao.com/tbopen/index.html?fake=1',
  alipayFarm: 'alipays://platformapi/startapp?appId=68687299&fake=1',
  etao: 'https://market.m.taobao.com/app/etao/test?fake=1',
  cmcc: 'cn.10086.app://url=https%3A%2F%2Fwx.10086.cn%2Ffake',
  weibo: 'sinaweibo://changegroup?groupid=FAKE',
  xianyu: 'https://h5.m.goofish.com/wow/moyu/moyu-project/coin/pages/coinCallApp?taskCode=FAKE_CODE&channel=meituanCoin&userToken=OFFLINE&playId=1723',
  alipayMember: 'alipays://platformapi/startapp?appId=FAKE_MEMBER',
  alipayGold: 'alipays://platformapi/startapp?appId=FAKE_GOLD',
  baiduLite: 'https://activity.baidu.com/mbox/4a89aa9163/matrixInvoke?token=OFFLINE&taskCode=FAKE_CODE&playId=1480',
  taobaoLite: 'https://huodong.taobao.com/wow/z/sale/static/meituan?token=OFFLINE&taskCode=FAKE_CODE&playId=1568',
  diantao: 'https://market.m.taobao.com/app/tb-zhibo-app/callapp-mid-center/home.html?token=OFFLINE&taskCode=FAKE_CODE&playId=1483' 
};
function envelope(account = 'FAKE_ACCOUNT') {
  return [{uid: account, package_tm: now, lx_dict: false, evs: JSON.stringify(MT_TASKS.map(t => ({stm: now,
    val_lab: {title: t.prefix + '可得100', task_detail: {task_code: 'FAKE_CODE',
      task_url: {iosDeeplink: links[t.key], androidDeeplink: 'intent://NOT_IOS'}}}})))}];
}
const full = mtObserve(JSON.stringify(envelope()), null, now);
check(Object.keys(full.record.tasks).length === 13, 'all thirteen selected tasks captured');
check(full.changed.length === 13, 'first capture reports thirteen changes');
check(mtPlan(full.record, now).count === 13, 'thirteen valid plan fields');
const unchanged = mtObserve(JSON.stringify(envelope()), full.record, now + 1000);
check(unchanged.changed.length === 0, 'duplicate capture does not notify again');
const switched = mtObserve(JSON.stringify(envelope('OTHER_FAKE_ACCOUNT')), full.record, now + 1000);
check(switched.accountChanged && switched.record.account === 'OTHER_FAKE_ACCOUNT', 'new account replaces prior snapshot');
check(mtObserve(JSON.stringify([{...envelope()[0], uid: '0'}]), null, now).record === null, 'anonymous ignored');
check(mtObserve('{invalid', full.record, now).record === full.record, 'invalid JSON preserves cache');
check(mtObserve('x'.repeat(3 * 1024 * 1024 + 1), full.record, now).record === full.record, 'oversized body preserves cache');
check(mtObserve(JSON.stringify([{...envelope()[0], package_tm: now - MT_TTL}]), null, now).record === null, 'late telemetry cannot create fresh links');
const missingIos = envelope();
const ev = JSON.parse(missingIos[0].evs);
ev[0].val_lab.task_detail.task_url = {androidDeeplink: links.antManor};
missingIos[0].evs = JSON.stringify(ev);
check(Object.keys(mtObserve(JSON.stringify(missingIos), null, now).record.tasks).length === 12, 'does not substitute Android link');
const excluded = envelope();
const ex = JSON.parse(excluded[0].evs);
ex.push({stm: now, val_lab: {title: '浏览趣头条可得8888', task_detail: {task_code: 'FAKE', task_url: 'https://h5ssl.1sapp.com/'}}});
excluded[0].evs = JSON.stringify(ex);
check(Object.keys(mtObserve(JSON.stringify(excluded), null, now).record.tasks).length === 13, 'Qutoutiao excluded');
const expired = JSON.parse(JSON.stringify(full.record));
Object.values(expired.tasks).forEach(x => { x.capturedAt = now - MT_TTL - 1; });
check(mtPlan(expired, now).count === 0, 'expired links omitted');
check(!mtValidLink(MT_TASKS[0], 'https://example.invalid/?token=FAKE'), 'unexpected destination rejected');
check(!mtValidLink(MT_TASKS[0], links.antManor + '\n'), 'control characters rejected');
check(!mtValidLink(MT_TASKS[0], links.antManor + '%ZZ'), 'broken URL escape rejected');
function bridge(route, headers = {}, method = 'GET') {
  return JSON.parse(mtBridge({url: MT_BASE + route, headers, method}, key + '|' + proof, full.record, now).response.body);
}
check(bridge('probe').proof === proof, 'probe returns local proof');
const probeRequest = {url: MT_BASE + 'probe', method: 'GET', headers: {}};
check(JSON.parse(mtBridge(probeRequest, {pairing: key + '|' + proof}, null, now).response.body).proof === proof, 'subscription object argument supported');
check(JSON.parse(mtBridge(probeRequest, {pairing: key + '|' + proof + '\n'}, null, now).response.body).proof === proof, 'copied pairing tolerates trailing newline');
check(JSON.parse(mtBridge(probeRequest, {pairing: ''}, null, now).response.body).code === 'NOT_PAIRED', 'empty subscription pairing refused');
check(!JSON.stringify(bridge('probe')).includes('FAKE_ACCOUNT'), 'probe has no account identity');
check(!bridge('probe').antManor, 'probe never returns task URLs');
check(bridge('tasks').code === 'PAIRING_FAILED', 'unpaired read refused');
check(bridge('tasks', {'X-Lazing-Export-Key': key}).count === 7, 'paired read returns plan');
const extended = bridge('tasks', {'X-Lazing-Export-Key': key, 'X-Lazing-Jump-Plan': 'extended-v1'});
check(extended.count===10 && extended.xianyu && !extended.baiduLite && !extended.mtContent,'old eleven-entry client receives ten retained entries');
const latest=bridge('tasks',{'X-Lazing-Export-Key':key,'X-Lazing-Jump-Plan':'extended-v2'});
check(latest.count===10 && !latest.mtPig && !latest.mtOrchard && !latest.taobaoLite,'v0.3 skips removed mini-apps and does not count new branches');
const current=bridge('tasks',{'X-Lazing-Export-Key':key,'X-Lazing-Jump-Plan':'extended-v3'});
check(current.count===13 && current.baiduLite && current.taobaoLite && current.diantao,'v0.4 receives all thirteen active branches');
const tagged=envelope();
const tagEvents=JSON.parse(tagged[0].evs).filter(x=>['点淘','百度极速版'].some(n=>x.val_lab.title.includes(n)));
tagged[0].evs=JSON.stringify(tagEvents.map(ev=>({stm:now-1000,tag:{game:{context:ev.val_lab}}})));
const tagRecord=mtObserve(JSON.stringify(tagged),null,now).record;
check(Object.keys(tagRecord.jumpTasks).sort().join(',')==='baiduLite,diantao','native task context read from tag.game');
check(tagRecord.jumpTasks.diantao.sourceTime===now-1000,'nested task inherits real event time');
const staleTags=JSON.parse(JSON.stringify(tagged)),staleEvents=JSON.parse(staleTags[0].evs);staleEvents.forEach(x=>x.stm=now-2000);staleTags[0].evs=JSON.stringify(staleEvents);
check(mtObserve(JSON.stringify(staleTags),tagRecord,now).record.jumpTasks.diantao.sourceTime===now-1000,'older nested event cannot overwrite newer task');
for(const key of ['mtContent','mtPig','mtOrchard'])check(!MT_TASKS.some(t=>t.key===key),'removed internal branch absent: '+key);
const cached=JSON.parse(JSON.stringify(full.record));for(const key of ['mtContent','mtPig','mtOrchard'])cached.tasks[key]={url:'imeituan://www.meituan.com/old',capturedAt:now,sourceTime:now};
const clean=mtObserve(JSON.stringify(envelope()),cached,now).record;
check(['mtContent','mtPig','mtOrchard'].every(k=>!clean.tasks[k]),'retired task URLs removed from old cache');
check(['mtContent','mtPig','mtOrchard'].every(k=>!current[k]),'retired task URLs never exported');
for(const key of ['baiduLite','taobaoLite','diantao']){
 const task=MT_TASKS.find(t=>t.key===key),url=links[key];
 check(mtValidLink(task,url),'new landing path accepted: '+key);
 check(!mtValidLink(task,url.replace('playId='+task.playId,'playId=WRONG')),'wrong task channel rejected: '+key);
 check(!mtValidLink(task,url.replace('token=OFFLINE','token=')),'empty ticket rejected: '+key);
 check(!mtValidLink(task,url+'&taskCode=OTHER'),'duplicate ticket parameter rejected: '+key);
 const bad=envelope(),events=JSON.parse(bad[0].evs),event=events.find(e=>e.val_lab.title.startsWith(task.prefix));event.val_lab.task_detail.task_code='DIFFERENT';bad[0].evs=JSON.stringify(events);
 check(!mtObserve(JSON.stringify(bad),null,now).record.tasks[key],'task code must match captured iOS link: '+key);
 check(current[key]===url,'task URL preserved byte for byte: '+key);
}
check(!bridge('tasks', {'X-Lazing-Export-Key': key}).xianyu, 'old Shortcut receives no extra task links or inflated count');
check(bridge('tasks', {'X-Lazing-Export-Key': key, 'X-Lazing-Jump-Plan': 'unknown'}).count === 7, 'unknown client preserves legacy plan');
check(mtPlan(full.record, now).summary.includes('/13'), 'observer summary uses current task denominator');
check(!mtValidLink(MT_TASKS.find(t => t.key === 'xianyu'), 'https://h5.m.goofish.com/other?taskCode=FAKE'), 'Xianyu route constrained to observed task landing path');
check(bridge('tasks', {origin: 'https://example.invalid', 'X-Lazing-Export-Key': key}).code === 'BROWSER_DENIED', 'browser read refused');
check(bridge('tasks', {'X-Lazing-Export-Key': key, 'x-lazing-export-key': key}).code === 'PAIRING_FAILED', 'duplicate auth header refused');
check(bridge('tasks', {}, 'POST').code === 'BAD_REQUEST', 'export route is GET only');
check(bridge('other').code === 'BAD_REQUEST', 'unknown route refused');
check(mtDecode('浏览蚂蚁庄园可得D7WWW') === '浏览蚂蚁庄园可得12888', 'decoded reward title');
check(mtDecode('zQ|U0zzGh*0@hjOUH@0m@U|hGGhH') === 'PFM_APPLICATION_START_MILLIS', 'uppercase telemetry label');
check(mtDecode('d9t?aA`C1v*vunt') === 'watchVideoCount', 'mixed case key');
check(mtDecode('KhQh') === 'WIFI', 'network label independently decodes');
check(mtDecode('C1f9u,tKvrCk') === 'defaultWords', 'uppercase W independently decodes');
const source = fs.readFileSync(path.join(__dirname, '../Scripts/meituan-jump.js'), 'utf8');
function run(request, record, arg) {
  let done, written, notification;
  vm.runInNewContext(source, {
    Date: class extends Date { static now() { return now; } },
    $request: request, $argument: arg, $done: x => { done = x; }, console: {log() {}},
    $persistentStore: {read: () => record ? JSON.stringify(record) : null, write: (v, k) => { written = {v, k}; return true; }},
    $notification: {post: (...x) => { notification = x; }}
  });
  return {done, written, notification};
}
const passthrough = run({url: 'https://lx0.meituan.com/', method: 'POST', body: JSON.stringify(envelope()), headers: {original: 'kept'}});
check(JSON.stringify(passthrough.done) === '{}', 'observer leaves request untouched');
check(passthrough.written.k === MT_KEY, 'writes dedicated cache only');
check(passthrough.notification && !JSON.stringify(passthrough.notification).includes('alipays:'), 'notification contains names only');
const foreign = run({url: 'https://other.example/', method: 'POST', body: JSON.stringify(envelope())});
check(JSON.stringify(foreign.done) === '{}' && !foreign.written, 'other destinations not captured');
const fallbackKeys = ['xianyu', 'baiduLite', 'taobaoLite', 'diantao'];
const seedEvents = JSON.parse(envelope()[0].evs);
const fallbackEvents = seedEvents.filter(event => fallbackKeys.some(k => event.val_lab.task_detail.task_url.iosDeeplink === links[k]));
const listEvents = seedEvents.filter(event => !fallbackEvents.includes(event));
const capture = (events, prior = null, time = now, uid = 'FAKE_ACCOUNT') =>
  mtObserve(JSON.stringify([{uid, package_tm: time, evs: events}]), prior, time).record;
const nine = capture(listEvents);
check(mtPlan(nine, now).count === 9, 'list only has nine links');
const clicks = fallbackEvents.map(event => ({...event, nm: 'MC'}));
const thirteen = capture(clicks, nine);
const fallbackPlan = mtPlan(thirteen, now);
check(fallbackPlan.count === 13 && fallbackKeys.every(k => fallbackPlan[k] === links[k]), 'nine list links OR four local jump records');
check(fallbackPlan.fallbackSummary.includes('闲鱼') && !fallbackPlan.fallbackSummary.includes('OFFLINE'), 'fallback names without URL data');
const preferred = structuredClone(fallbackEvents[0]);
const preferredKey = fallbackKeys.find(k => preferred.val_lab.task_detail.task_url.iosDeeplink === links[k]);
preferred.val_lab.task_detail.task_url.iosDeeplink += '&from=LATEST_LIST';
const afterRefresh = capture([preferred], thirteen);
check(mtPlan(afterRefresh, now)[preferredKey].endsWith('&from=LATEST_LIST'), 'current valid list URL wins over jump cache');
const sameCodeNoUrl = structuredClone(preferred);
delete sameCodeNoUrl.val_lab.task_detail.task_url;
check(mtPlan(capture([sameCodeNoUrl], thirteen), now)[preferredKey] === links[preferredKey], 'missing list URL falls back to matching click');
sameCodeNoUrl.val_lab.task_detail.task_code = 'NEW_CODE';
check(!mtPlan(capture([sameCodeNoUrl], thirteen), now)[preferredKey], 'new list code prevents old ticket reuse');
const midnight = Date.parse('2026-11-07T00:00:00+08:00');
check(mtPlan(thirteen, midnight).count === 9, 'only the four fallback paths enforce same-day event date');
check(!mtPlan(capture([], thirteen, now + 1, 'OTHER_ACCOUNT'), now + 1)[preferredKey], 'account change removes fallback');
const legacy = structuredClone(thirteen);
legacy.tasks[preferredKey] = legacy.jumpTasks[preferredKey];
delete legacy.tasks[preferredKey].source;
delete legacy.jumpTasks[preferredKey];
check(mtPlan(legacy, now)[preferredKey] === links[preferredKey], 'valid same-day pre-update cache remains usable');
check(!mtPlan(capture(clicks.map(e => ({...e, stm: now - 3600000})), nine), now)[preferredKey], 'old telemetry cannot refresh a click ticket');
check(!mtValidLink(MT_TASKS.find(t => t.key === 'xianyu'), links.xianyu.replace('userToken=OFFLINE','userToken=')), 'Xianyu ticket must contain a token');
for (const taskKey of fallbackKeys) {
  const task = MT_TASKS.find(candidate => candidate.key === taskKey);
  const event = structuredClone(seedEvents.find(event => event.val_lab.title.startsWith(task.prefix)));
  event.nm = 'MV';
  event.val_lab.task_detail.task_url = {
    iosDeeplink: 'unsupported://' + taskKey + '?url=embedded',
    iosUlink: links[taskKey],
    androidUlink: 'https://android.invalid/' + taskKey,
  };
  let recorded = capture([event]);
  check(mtPlan(recorded, now)[taskKey] === links[taskKey], 'list uses iOS universal link: ' + taskKey);
  check(recorded.tasks[taskKey].source === 'list' && !recorded.jumpTasks, 'list needs no click: ' + taskKey);
  delete event.val_lab.task_detail.task_url.iosUlink;
  check(!mtPlan(capture([event]), now)[taskKey], 'Android universal link is never used: ' + taskKey);
  event.val_lab.task_detail.task_url.iosUlink = links[taskKey].replace('taskCode=FAKE_CODE', 'taskCode=DIFFERENT');
  check(!mtPlan(capture([event]), now)[taskKey], 'universal link must match current task code: ' + taskKey);
}
const preference = structuredClone(seedEvents.find(event => event.val_lab.title.startsWith('浏览点淘')));
preference.val_lab.task_detail.task_url.iosUlink = links.diantao + '&source=OTHER';
check(mtPlan(capture([preference]), now).diantao === links.diantao, 'valid iOS scheme keeps existing priority');
function nativeTaskLink(key, code = 'FAKE_CODE', token = 'OFFLINE') {
  const task = MT_TASKS.find(t => t.key === key);
  const ticket = {taskCode: code, token, playId: task.playId};
  if(key === 'baiduLite') return 'baiduboxlite://v1/easybrowse/open?url=' +
    encodeURIComponent('https://activity.baidu.com/incentive/incentiveHome?taskInfo=' +
      encodeURIComponent(JSON.stringify({sdkParams: ticket})));
  const page = key === 'taobaoLite' ? 'https://pages.tmall.com/wow/z/sale/nsrSolution/chicken-farm-newHome' :
    'https://market.m.taobao.com/app/tb-zhibo-app/callapp-mid-center/home.html';
  const target = page + '?' + new URLSearchParams(ticket);
  return key === 'taobaoLite' ? 'taobaolite://m.ltao.com/open/index.html?h5Url=' + encodeURIComponent(target) :
    'taobaoliveshare://xevddy.com/gateway/index.htm?source=meituanhuanlianghezuo&targetUrl=' + encodeURIComponent(target);
}
for(const key of ['diantao','baiduLite','taobaoLite']) {
  const task = MT_TASKS.find(t => t.key === key);
  const native = nativeTaskLink(key);
  const event = structuredClone(seedEvents.find(ev => ev.val_lab.title.startsWith(task.prefix)));
  event.val_lab.task_detail.task_url = {iosDeeplink: native, iosUlink: links[key]};
  const stored = capture([event]);
  check(mtValidLink(task, native), 'native scheme and nested task ticket accepted: ' + key);
  check(mtPlan(stored, now)[key] === native, 'native link wins byte-for-byte over HTTPS: ' + key);
  check(mtBridge({url: MT_BASE + 'tasks', method: 'GET', headers: {
    'X-Lazing-Export-Key': 'a'.repeat(64), 'X-Lazing-Jump-Plan': 'extended-v3'
  }}, 'a'.repeat(64) + '|' + proof, stored, now).response.body.includes(native),
    'current shortcut receives native task link: ' + key);
  event.val_lab.task_detail.task_url.iosDeeplink = nativeTaskLink(key, 'WRONG_CODE');
  check(mtPlan(capture([event]), now)[key] === links[key], 'conflicting native ticket falls back to valid web link: ' + key);
  check(!mtValidLink(task, nativeTaskLink(key, 'FAKE_CODE', '')), 'empty nested token rejected: ' + key);
  const wrongHost = native.replace(/(https%3A%2F%2F)[^%]+/i, '$1external.invalid');
  check(!mtValidLink(task, wrongHost), 'wrong nested destination rejected: ' + key);
  const onlyNative = structuredClone(event);
  onlyNative.val_lab.task_detail.task_url = {iosDeeplink: native};
  check(mtPlan(capture([onlyNative]), now)[key] === native, 'native works with no universal link: ' + key);
}
function invalidFree(entries) {
  let saved = null;
  for (const e of entries) {
    if (!/^https:\/\/lx\d*\.meituan\.com\//.test(e.request.url)) continue;
    const post = e.request.postData || {};
    const body = post.encoding === 'base64' ? Buffer.from(post.text || '', 'base64').toString() : post.text;
    const result = mtObserve(body, saved, Date.parse(e.startedDateTime));
    if(result.invalid) return false;
    saved = result.record;
  }
  return true;
}
let harChecks = 0;
for (const file of process.argv.slice(2)) {
  const entries = JSON.parse(fs.readFileSync(file, 'utf8')).log.entries.slice().sort((a, b) => Date.parse(a.startedDateTime) - Date.parse(b.startedDateTime));
  let record = null, parsed = 0;
  for (const entry of entries) {
    if (!/^https:\/\/lx\d*\.meituan\.com\//.test(entry.request.url)) continue;
    const post = entry.request.postData || {};
    const body = post.encoding === 'base64' ? Buffer.from(post.text || '', 'base64').toString('utf8') : post.text || '';
    const result = mtObserve(body, record, Date.parse(entry.startedDateTime));
    record = result.record;
    parsed += result.parsed;
  }
  const current = Math.max(...entries.map(x => Date.parse(x.startedDateTime)));
  const plan = mtPlan(record, current);
  const original = path.basename(file).startsWith('450_') ? ['mtPig', 'mtOrchard', 'xianyu', 'alipayMember', 'alipayGold'] : path.basename(file).startsWith('442_') ? ['xianyu', 'alipayMember', 'alipayGold', 'mtContent'] : ['antManor', 'antForest', 'taobaoFarm', 'alipayFarm', 'etao', 'cmcc', 'weibo', 'mtContent', 'mtOrchard'];
  const expected = path.basename(file).startsWith('505_') ? MT_TASKS.map(task => task.key) : path.basename(file).startsWith('504_') ? ['baiduLite','taobaoLite','diantao','xianyu'] :
    /^(491|496)_/.test(path.basename(file)) ? ['baiduLite','taobaoLite','diantao'] : original.filter(k=>!['mtContent','mtPig','mtOrchard'].includes(k));
  check(plan.count === expected.length, path.basename(file) + ': selected iOS links recovered');
  check(Object.keys({...record.tasks, ...record.jumpTasks}).sort().join(',') === expected.slice().sort().join(','), path.basename(file) + ': only expected tasks saved');
  check(expected.every(k => mtValidLink(MT_TASKS.find(t => t.key === k), plan[k])), path.basename(file) + ': every destination validated');
  if(path.basename(file).startsWith('505_')) {
    check(plan.count === 13 && !plan.fallbackSummary, '505 supplies all thirteen from list events');
    check(expected.every(k => record.tasks[k]?.source === 'list'), '505 needs no manual click');
    check(invalidFree(entries), '505 list passes destination and ticket validation');
    check(plan.diantao.startsWith('taobaoliveshare://') && plan.baiduLite.startsWith('baiduboxlite://') &&
      plan.taobaoLite.startsWith('taobaolite://'), '505 exports three captured App schemes');
  }
  check(!JSON.stringify(record).includes('iosDeeplink'), path.basename(file) + ': no full telemetry saved');
  console.log(path.basename(file) + ': parsed ' + parsed + ' envelopes; ' + plan.count + ' task links recovered (URLs withheld).');
  harChecks += 1;
}
console.log(checks + ' functional checks passed; ' + harChecks + ' HAR files checked; no task opened or API called.');

const publicPlugin = fs.readFileSync(path.join(__dirname, '../Plugins/meituan-jump.plugin'), 'utf8');
check(publicPlugin.includes('pairing = input,""'), 'public pairing default empty');
check(!/[a-f0-9]{64}/.test(publicPlugin), 'no private pairing values published');
check((publicPlugin.match(/https:\/\/raw\.githubusercontent\.com\/[^"\s]+/g) || []).length === 3, 'all three entries use remote script');
check(publicPlugin.includes('{${pairing}}'), 'paired route receives plugin argument');
check(publicPlugin.includes('DOMAIN,example.com,DIRECT'), 'local bridge rule included');
check(publicPlugin.includes('hostname = lx0.meituan.com'), 'telemetry MITM included');
check(!publicPlugin.includes('cron '), 'no scheduled execution');
console.log('Subscription checks passed; total ' + checks + ' checks.');
