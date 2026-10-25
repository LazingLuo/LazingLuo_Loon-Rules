// Synthetic offline checks; these do not establish live Taobao compatibility.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const sourcePath = fs.existsSync(path.join(__dirname, 'taobao-orange-probe.js')) ?
  path.join(__dirname, 'taobao-orange-probe.js') : path.join(__dirname, '../Scripts/taobao-orange-probe.js');
const pluginPath = fs.existsSync(path.join(__dirname, 'taobao-orange-probe.plugin')) ?
  path.join(__dirname, 'taobao-orange-probe.plugin') : path.join(__dirname, '../Plugins/taobao-orange-probe.plugin');
const source = fs.readFileSync(sourcePath, 'utf8');
const fixture = () => ({ configs: [{ name: 'ios_bootimage_client',
  content: { isColdStartEnabled: 'true', isHotStartEnabled: false, backgroundWaitSeconds: '30',
    token: 'SECRET_BODY', unrelated: 'SECRET_OTHER' } }] });
const storeKey = 'LAZING_TB_ORANGE_PROBE_V1';
function run(body, options = {}, state = {}) {
  let done = 0, result, logs = [], notices = [], written = {};
  const request = { url: options.url || 'https://orange-dc.m.taobao.com/api/config?token=SECRET_QUERY',
    method: 'GET', headers: options.headers || { Cookie: 'SECRET_COOKIE' }, body: 'SECRET_REQUEST' };
  const response = { status: options.status === undefined ? 200 : options.status,
    headers: { 'Set-Cookie': 'SECRET_RESPONSE_COOKIE' }, body: options.raw ? body : JSON.stringify(body) };
  const before = JSON.stringify({ request, response });
  const context = { $request: request, $response: response, $argument: { notify: options.notify !== false },
    $persistentStore: { read: k => { if (options.storeFail) throw Error('secret storage error'); return state[k]; },
      write: (v, k) => { if (options.storeFail) throw Error('secret storage error'); state[k] = v; written[k] = v; return true; } },
    $notification: { post: (...args) => { if (options.noticeFail) throw Error('secret notice error'); notices.push(args); } },
    console: { log: text => logs.push(text) }, $done: r => { done++; result = r; } };
  if (options.requestOnly) delete context.$response;
  if (options.manual) { delete context.$request; delete context.$response; context.$argument = options.manual; }
  vm.runInNewContext(source, context, { timeout: 1500 });
  assert.equal(done, 1, 'must complete once');
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {}, 'must pass original content');
  assert.equal(JSON.stringify({ request, response }), before, 'must not mutate request/response');
  assert(!JSON.stringify({ logs, notices, written }).includes('SECRET'), 'secrets must not reach output/new storage');
  return { logs, notices, state, record: state[storeKey] ? JSON.parse(state[storeKey]) : null };
}
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
test('known flags found in named config container without rewriting', () => {
  const r = run(fixture()); assert.equal(r.record.settings, 1);
  assert.deepEqual(r.record.known.ios_bootimage_client, { isColdStartEnabled: true, isHotStartEnabled: false, backgroundWaitSeconds: 30 });
  assert.equal(r.notices[0][1], '找到开屏设置');
});
test('direct group dictionary', () => {
  const r = run({ ios_bootimage_client: { isHotStartEnabled: '0' } });
  assert.equal(r.record.known.ios_bootimage_client.isHotStartEnabled, false);
});
test('string-encoded config content', () => {
  const r = run({ name: 'ios_bootimage_client', content: JSON.stringify({ periodSeconds: 3600 }) });
  assert.equal(r.record.known.ios_bootimage_client.periodSeconds, 3600);
});
test('JSONP response', () => { assert.equal(run('cb(' + JSON.stringify(fixture()) + ');', { raw: true }).record.settings, 1); });
test('outer string-encoded JSON', () => { assert.equal(run(JSON.stringify(JSON.stringify(fixture())), { raw: true }).record.settings, 1); });
test('ordinary config has no target group', () => {
  const r = run({ configs: [{ name: 'other', content: { isHotStartEnabled: true } }] });
  assert.equal(r.record.settings, 0); assert.equal(r.record.hints, 0);
});
test('unscoped flag is not a splash setting', () => {
  const r = run({ note: 'ios_bootimage_client', isHotStartEnabled: true });
  assert.equal(r.record.hints, 1); assert.equal(r.record.settings, 0);
});
test('index with group name is only a hint', () => {
  const r = run({ name: 'ios_bootimage_client', version: '1000', resourceId: 'SECRET_RESOURCE' });
  assert.equal(r.record.hints, 1); assert.equal(r.record.settings, 0);
});
test('named other group does not inherit splash scope', () => {
  const r = run({ ios_bootimage_client: { children: [{ name: 'other', content: { isHotStartEnabled: true } }] } });
  assert.equal(r.record.settings, 0);
});
test('emergency IDs summarized as count only', () => {
  const r = run({ name: 'bootimage_emergency', content: { disableItemId: 'SECRET_ITEM_1,SECRET_ITEM_2' } });
  assert.deepEqual(r.record.known.bootimage_emergency, { disabledItemCount: 2 });
});
test('unknown values are not stored as booleans', () => {
  const r = run({ ios_bootimage_client: { isHotStartEnabled: 'SECRET_FLAG' } }); assert.equal(r.record.settings, 0);
});
test('invalid numerical setting rejected', () => {
  const r = run({ ios_bootimage_client: { periodSeconds: 'SECRET_NUMBER' } }); assert.equal(r.record.settings, 0);
});
test('fractional or unsafe numerical setting rejected', () => {
  const r = run({ ios_bootimage_client: { periodSeconds: 1.5, backgroundWaitSeconds: 9007199254740992 } });
  assert.equal(r.record.settings, 0);
});
test('request counted without request body/header logging', () => {
  const r = run(fixture(), { requestOnly: true }); assert.equal(r.record.requests, 1); assert.equal(r.record.responses, 0);
  assert.equal(r.notices.length, 0);
});
test('counter accumulates across phases and invocations', () => {
  const state = {}; run(null, { requestOnly: true }, state); run(fixture(), {}, state);
  const r = run(fixture(), {}, state); assert.equal(r.record.requests, 1); assert.equal(r.record.responses, 2);
  assert.equal(r.notices.length, 0, 'repeat finding should be throttled');
});
test('first real finding is not suppressed by ordinary response notice', () => {
  const state = {}; run({ configs: [] }, {}, state);
  assert.equal(run(fixture(), {}, state).notices[0][1], '找到开屏设置');
});
test('CDN host accepted', () => { assert.equal(run(fixture(), { url: 'https://dorangesource.alicdn.com/abc' }).record.settings, 1); });
test('decrypted IPv4 with exact logical Host accepted', () => {
  assert.equal(run(fixture(), { url: 'https://59.82.1.2/api/config?a=SECRET_QUERY', headers: { HOST: 'orange-dc.m.taobao.com:443' } }).record.settings, 1);
});
test('decrypted IPv6 with exact logical Host accepted', () => {
  assert.equal(run(fixture(), { url: 'https://[2400:3200::1]/api/config', headers: { Host: 'orange-dc.m.taobao.com' } }).record.settings, 1);
});
test('HTTP response accepted without requiring MITM', () => { assert.equal(run(fixture(), { url: 'http://orange-dc.m.taobao.com/api/config' }).record.settings, 1); });
test('bare IP without logical Host ignored', () => { assert.equal(run(fixture(), { url: 'https://59.82.1.2/api/config' }).record, null); });
test('hostname suffix impostor ignored', () => { assert.equal(run(fixture(), { url: 'https://orange-dc.m.taobao.com.evil.test/a' }).record, null); });
test('foreign hostname with forged Host ignored', () => {
  assert.equal(run(fixture(), { url: 'https://example.com/a', headers: { Host: 'orange-dc.m.taobao.com' } }).record, null);
});
test('ordinary timestamp API ignored', () => {
  assert.equal(run(fixture(), { url: 'https://acs.m.taobao.com/gw/mtop.common.getTimestamp/*' }).record, null);
});
test('HTTP error counted without reading error body', () => {
  const r = run(fixture(), { status: 403 }); assert.equal(r.record.lastStatus, 403); assert.equal(r.record.settings, 0);
});
test('304 identified as cached response', () => { assert.equal(run('', { raw: true, status: 304 }).record.lastResult, '本条响应使用缓存'); });
test('invalid JSON and HTML pass through', () => { assert.equal(run('<html>SECRET_HTML</html>', { raw: true }).record.parsed, 0); });
test('empty response passes through', () => { assert.equal(run('', { raw: true }).record.lastResult, '本条响应为空'); });
test('binary body passes through', () => { assert.equal(run(new Uint8Array([1, 2]), { raw: true }).record.lastResult, '本条是二进制响应'); });
test('oversized body passes through', () => {
  assert.equal(run(' '.repeat(512 * 1024 + 1), { raw: true }).record.lastResult, '本条响应超过检查上限');
});
test('deep structure aborts without committing partial settings', () => {
  const d = { ios_bootimage_client: { isHotStartEnabled: true } }; let p = d;
  for (let i = 0; i < 30; i++) p = p.deep = {};
  const r = run(d); assert.equal(r.record.settings, 0); assert.deepEqual(r.record.known, {});
});
test('node count limit', () => { const r = run({ data: Array(12500).fill(0) }); assert.equal(r.record.settings, 0); assert(r.record.lastResult.includes('超过')); });
test('notice failure preserves content and records', () => { assert.equal(run(fixture(), { noticeFail: true }).record.settings, 1); });
test('storage failure preserves content', () => { assert.equal(run(fixture(), { storeFail: true }).record, null); });
test('notification switch', () => { assert.equal(run(fixture(), { notify: false }).notices.length, 0); });
test('manual status returns only counters and allowed flags', () => {
  const state = {}; run(fixture(), {}, state); const r = run(null, { manual: 'stats' }, state);
  assert.equal(r.notices[0][1], '检查结果'); assert(r.logs[0].includes('isHotStartEnabled = false'));
});
test('manual reset', () => {
  const state = {}; run(fixture(), {}, state); const r = run(null, { manual: 'reset' }, state);
  assert.equal(r.record.responses, 0); assert.deepEqual(r.record.known, {});
});
test('corrupt persisted state does not leak arbitrary content', () => {
  const state = { [storeKey]: JSON.stringify({ version: 1, lastResult: 'SECRET_OLD', known: { ios_bootimage_client: { isHotStartEnabled: 'SECRET_BAD' } } }) };
  const r = run(null, { manual: 'stats' }, state); assert(!JSON.stringify(r.notices).includes('SECRET'));
  delete state[storeKey]; // The original malformed storage is not printed or changed by a read-only query.
});
test('plugin limits MITM to two Orange hosts and makes no blocking changes', () => {
  const p = fs.readFileSync(pluginPath, 'utf8');
  assert(p.includes('hostname = orange-dc.m.taobao.com, dorangesource.alicdn.com'));
  assert(!/^\[(?:General|Rule|Host|IP Rewrite|Rewrite)\]/m.test(p));
  assert(!/REJECT|disable-udp-ports|dns-server|httpdns/i.test(p));
  assert.equal((p.match(/^request if /gm) || []).length, 1); assert.equal((p.match(/^response if /gm) || []).length, 1);
  assert(p.includes('requires_body=false')); assert(p.includes('requires_body=true'));
});
test('script has no network client and ends with passthrough', () => {
  assert(!/\$httpClient|\$task|fetch\(|XMLHttpRequest/.test(source)); assert(source.includes('finally { $done({}); }'));
});
console.log(passed + ' offline checks passed');
