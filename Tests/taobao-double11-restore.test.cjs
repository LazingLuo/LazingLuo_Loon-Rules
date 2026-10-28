// Synthetic task HTML only; no HAR, account data or copied official bundle.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '../Scripts/taobao-double11-restore.js'), 'utf8');
const plugin = fs.readFileSync(path.join(__dirname, '../Plugins/taobao-double11-restore.plugin'), 'utf8');
const base = '//g.alicdn.com/tbsearchwireless-pages/tao-gold-srp-task-pop/';
const from = base + '0.0.5/web/';
const to = base + '0.0.4/web/';
const html = '<!doctype html><html><head><meta name="release-info" content="version=0.0.5,app-id=179600">' +
  '<script>window.__ASSET_PATH__=\'' + from + '\'</script></head><body>' +
  '<div id="root"></div><script>window.__ASSET_PATH__=\'' + from + '\'</script>' +
  '<script src="' + from + 'index.js"></script><p>Unchanged content</p></body></html>';
const url = 'https://market.m.taobao.com/app/tbsearchwireless-pages/tao-gold-srp-task-pop/index?deliveryId=100340&sceneId=8917&q=iphone';
const key = 'LAZING_TB_DOUBLE11_RESTORE_V1';
let count = 0;
function test(name, fn) { fn(); count++; console.log('OK ' + name); }
function run(options = {}) {
  const store = options.store || {};
  const notifications = [], logs = [], outputs = [];
  const context = {
    $persistentStore: { read: k => store[k], write: (v, k) => { store[k] = v; return true; } },
    $notification: { post: (...args) => notifications.push(args) },
    console: { log: x => logs.push(x) },
    $done: x => outputs.push(x)
  };
  if (!options.generic) {
    context.$request = { url: options.url === undefined ? url : options.url, method: options.method || 'GET' };
    context.$response = { status: options.status === undefined ? 200 : options.status,
      headers: options.headers || { 'Content-Type': 'text/html; charset=utf-8' },
      body: options.body === undefined ? html : options.body };
  }
  if (options.noStore) delete context.$persistentStore;
  if (options.noNotify) delete context.$notification;
  vm.runInNewContext(script, context, { timeout: 1000 });
  assert.equal(outputs.length, 1);
  return { output: outputs[0], store, notifications, logs };
}
function unchanged(options) { assert.equal(JSON.stringify(run(options).output), '{}'); }
test('replaces only the three known asset paths and adds marker', () => {
  const r = run();
  const expected = html.split(from).join(to).replace('<html>', '<html data-loon-double11-restore="v1">');
  assert.equal(r.output.body, expected);
  assert.equal(r.notifications.length, 1);
  assert.equal(JSON.parse(r.store[key]).changed, 1);
});
test('retains CSP and unrelated headers while removing stale body validators', () => {
  const r = run({ headers: { 'content-type': 'text/html', 'Content-Length': '100',
    'content-encoding': 'gzip', ETag: 'old', 'Last-Modified': 'old', Expires: 'old',
    'cache-control': 'max-age=600', 'Content-Security-Policy': "script-src https://g.alicdn.com", 'X-Test': 'yes' } });
  assert.equal(r.output.headers['Content-Security-Policy'], "script-src https://g.alicdn.com");
  assert.equal(r.output.headers['X-Test'], 'yes');
  assert.equal(r.output.headers['Cache-Control'], 'no-store');
  for (const k of Object.keys(r.output.headers)) assert(!/^(?:content-length|content-encoding|etag|last-modified|expires)$/i.test(k));
});
for (const status of ['200', 'HTTP/1.1 200 OK', 'HTTP/2 200']) {
  test('supports Loon status ' + status, () => assert(run({ status }).output.body));
}
for (const [name, options] of [
  ['other domain', { url: url.replace('market.m.taobao.com', 'other.example') }],
  ['other page', { url: url.replace('/index?', '/other?') }],
  ['HTTP', { url: url.replace('https:', 'http:') }],
  ['other scene', { url: url.replace('8917', '1946') }],
  ['unknown task', { url: url.replace('100340', '999999') }],
  ['missing scene', { url: url.replace('&sceneId=8917', '') }],
  ['duplicate scene', { url: url + '&sceneId=8917' }],
  ['duplicate task', { url: url + '&deliveryId=100340' }],
  ['POST', { method: 'POST' }],
  ['malformed query', { url: url + '&bad=%ZZ' }],
  ['non-200', { status: 403 }],
  ['JSON content type', { headers: { 'Content-Type': 'application/json' } }],
  ['missing content type', { headers: {} }],
  ['empty body', { body: '' }],
  ['non-text body', { body: null }],
  ['oversized body', { body: html + ' '.repeat(128 * 1024) }],
  ['future version', { body: html.replace(/0\.0\.5/g, '0.0.6') }],
  ['already old version', { body: html.replace(/0\.0\.5/g, '0.0.4') }],
  ['missing root', { body: html.replace('id="root"', 'id="other"') }],
  ['extra resource', { body: html.replace('</body>', '<script src="' + from + 'extra.js"></script></body>') }],
  ['missing asset assignment', { body: html.replace('window.__ASSET_PATH__', 'window.OTHER_PATH') }],
  ['unexpected main bundle', { body: html.replace('web/index.js', 'web/other.js') }],
  ['script integrity', { body: html.replace('<script src=', '<script integrity="sha256-test" src=') }],
  ['already processed', { body: html.replace('<html>', '<html data-loon-double11-restore="v1">') }]
]) test('preserves ' + name, () => unchanged(options));
test('all original 17 task IDs supported', () => {
  for (const id of ['100340','100453','100492','107016','100531','99673','106363','99889','106588','101866','107544','99672','100454','106513','106595','99720','90782']) {
    assert(run({ url: url.replace('100340', id) }).output.body, id);
  }
});
test('notifications throttled but every change recorded', () => {
  const first = run(); const second = run({ store: first.store });
  assert.equal(second.notifications.length, 0);
  assert.equal(JSON.parse(second.store[key]).changed, 2);
});
test('manual record works before first request', () => {
  const r = run({ generic: true }); assert(r.notifications[0][2].includes('尚未收到任务页'));
});
test('manual record reports actual counter', () => {
  const r = run(); const stats = run({ generic: true, store: r.store });
  assert(stats.notifications[0][2].includes('切换旧版 1 次'));
});
test('notification service optional', () => assert(run({ noNotify: true }).output.body));
test('missing persistence does not prevent response', () => assert(run({ noStore: true }).output.body));
test('damaged persistence recovers', () => assert(run({ store: { [key]: 'invalid json' } }).output.body));
test('stored results contain no full URLs or login fields', () => {
  const record = JSON.stringify(run().store);
  assert(!/https?:|Cookie|pt_key|pt_pin|token|deliveryId|100340/.test(record));
});
test('has no independent task requests or synthetic gestures', () => {
  assert(!/\$httpClient|fetch\(|XMLHttpRequest|dispatchEvent|scrollTo\(/.test(script));
  assert(!/pentaprism\.scene\.(?:trigger|queryItem)/.test(script));
});
test('plugin decrypts only task HTML hostname', () => {
  assert(plugin.includes('hostname = market.m.taobao.com'));
  assert(!plugin.includes('hostname = *.'));
  assert(!plugin.includes('hostname = g.alicdn.com'));
});
console.log('PASS ' + count + ' checks');
