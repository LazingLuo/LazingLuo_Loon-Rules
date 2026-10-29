'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const core = require('../Scripts/meituan-jump.js');
const {MT_TASKS, MT_BASE, MT_KEY, MT_TTL, mtObserve, mtDecode, mtPlan, mtBridge, mtValidLink} = core;
let checks = 0;
function check(ok, label) { assert.ok(ok, label); checks += 1; }
const now = Date.now(), key = 'a'.repeat(64), proof = 'b'.repeat(64);
const links = {
  antManor: 'alipays://platformapi/startapp?appId=20000067&url=FAKE',
  antForest: 'alipays://platformapi/startapp?appId=20000067&url=FAKE_FOREST',
  taobaoFarm: 'tbopen://m.taobao.com/tbopen/index.html?fake=1',
  alipayFarm: 'alipays://platformapi/startapp?appId=68687299&fake=1',
  etao: 'https://market.m.taobao.com/app/etao/test?fake=1',
  cmcc: 'cn.10086.app://url=https%3A%2F%2Fwx.10086.cn%2Ffake',
  weibo: 'sinaweibo://changegroup?groupid=FAKE',
  xianyu: 'https://h5.m.goofish.com/wow/moyu/moyu-project/coin/pages/coinCallApp?taskCode=FAKE',
  alipayMember: 'alipays://platformapi/startapp?appId=FAKE_MEMBER',
  alipayGold: 'alipays://platformapi/startapp?appId=FAKE_GOLD',
  mtContent: 'imeituan://www.meituan.com/mmp?appId=FAKE&targetPath=FAKE',
  mtPig: 'imeituan://www.meituan.com/mrn?mrn_biz=game&mrn_entry=mtb-home&mrn_component=mtb-home&inner_source=FAKE',
  mtOrchard: 'imeituan://www.meituan.com/mgc?mgc_id=mgckmf3q8yx9d72b&inner_source=FAKE&query=FAKE'
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
check(extended.count === 11 && extended.xianyu && extended.alipayMember && extended.alipayGold && extended.mtContent, 'extended Shortcut receives all eleven entries');
const latest = bridge('tasks', {'X-Lazing-Export-Key': key, 'X-Lazing-Jump-Plan': 'extended-v2'});
check(latest.count === 13 && latest.mtPig && latest.mtOrchard, 'v0.3 receives mini-app additions');
check(!extended.mtPig && !extended.mtOrchard, 'old eleven-entry Shortcut has no inaccessible additions');
const tagged = envelope();
const tagEvents = JSON.parse(tagged[0].evs).filter(x => ['金猪','小美果园'].some(n => x.val_lab.title.includes(n)));
tagged[0].evs = JSON.stringify(tagEvents.map(ev => ({stm: now-1000, tag: {game: {context: ev.val_lab}}})));
const tagRecord = mtObserve(JSON.stringify(tagged), null, now).record;
check(Object.keys(tagRecord.tasks).sort().join(',') === 'mtOrchard,mtPig', 'mini-app task context is read from tag.game');
check(tagRecord.tasks.mtPig.sourceTime === now-1000, 'nested task inherits the real event time');
const staleTags = JSON.parse(JSON.stringify(tagged));
const staleEvents = JSON.parse(staleTags[0].evs);staleEvents.forEach(x => x.stm = now-2000);staleTags[0].evs = JSON.stringify(staleEvents);
check(mtObserve(JSON.stringify(staleTags), tagRecord, now).record.tasks.mtPig.sourceTime === now-1000, 'older nested event cannot overwrite a newer task');
check(!mtValidLink(MT_TASKS.find(x => x.key === 'mtPig'), 'imeituan://www.meituan.com/mrn?mrn_biz=other&mrn_entry=mtb-home&mrn_component=mtb-home'), 'unrelated MRN component rejected');
check(!mtValidLink(MT_TASKS.find(x => x.key === 'mtOrchard'), 'imeituan://www.meituan.com/mgc?mgc_id=OTHER_GAME'), 'unrelated mini-game rejected');
check(!bridge('tasks', {'X-Lazing-Export-Key': key}).xianyu, 'old Shortcut receives no extra task links or inflated count');
check(bridge('tasks', {'X-Lazing-Export-Key': key, 'X-Lazing-Jump-Plan': 'unknown'}).count === 7, 'unknown client preserves legacy plan');
check(mtPlan(full.record, now).summary.includes('/13'), 'observer summary uses current task denominator');
check(!mtValidLink(MT_TASKS.find(t => t.key === 'xianyu'), 'https://h5.m.goofish.com/other?taskCode=FAKE'), 'Xianyu route constrained to observed task landing path');
check(!mtValidLink(MT_TASKS.find(t => t.key === 'mtContent'), 'imeituan://www.meituan.com/other?appId=FAKE'), 'Meituan content route constrained to observed mini-app path');
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
  const expected = path.basename(file).startsWith('450_') ? ['mtPig', 'mtOrchard', 'xianyu', 'alipayMember', 'alipayGold'] : path.basename(file).startsWith('442_') ? ['xianyu', 'alipayMember', 'alipayGold', 'mtContent'] : ['antManor', 'antForest', 'taobaoFarm', 'alipayFarm', 'etao', 'cmcc', 'weibo', 'mtContent', 'mtOrchard'];
  check(plan.count === expected.length, path.basename(file) + ': selected iOS links recovered');
  check(Object.keys(record.tasks).sort().join(',') === expected.slice().sort().join(','), path.basename(file) + ': only expected tasks saved');
  check(expected.every(k => mtValidLink(MT_TASKS.find(t => t.key === k), plan[k])), path.basename(file) + ': every destination validated');
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
