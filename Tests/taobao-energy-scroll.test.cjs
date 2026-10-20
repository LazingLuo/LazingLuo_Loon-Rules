// Offline response-scope tests. No account requests or credentials are used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = __dirname;
const scriptPath = fs.existsSync(path.join(root, 'taobao-energy-scroll.js'))
  ? path.join(root, 'taobao-energy-scroll.js') : path.join(root, '../Scripts/taobao-energy-scroll.js');
const pluginPath = fs.existsSync(path.join(root, 'taobao-energy-scroll.plugin'))
  ? path.join(root, 'taobao-energy-scroll.plugin') : path.join(root, '../Plugins/taobao-energy-scroll.plugin');
const source = fs.readFileSync(scriptPath, 'utf8');
const plugin = fs.readFileSync(pluginPath, 'utf8');
const url = 'https://mo.m.taobao.com/union2/page_1728378489402?ep=offline&et=offline&loon_energy_scroll=1';
const html = '<!doctype html><html><head><title>超级红包-搜索热词任务</title></head><body>Original content</body></html>';
function transform(overrides = {}) {
  let result, calls = 0;
  const notes = [];
  vm.runInNewContext(source, {
    $request: {url: overrides.url || url},
    $response: {status: 200, headers: {'Content-Type': 'text/html;charset=utf-8', 'Content-Length': '100', 'Content-Encoding': 'gzip', ETag: 'old', 'Set-Cookie': 'keep=fixture'}, body: html, ...overrides.response},
    $done: value => {result = value; calls++;},
    $notification: {post: (...args) => notes.push(args)}, console: {log() {}},
  });
  assert.equal(calls, 1);
  return {result, notes};
}
const ok = transform().result;
assert.match(ok.body, /id="loon-energy-scroll-v1"/);
assert.match(ok.body, /Original content/);
assert.equal(ok.headers['Set-Cookie'], 'keep=fixture');
assert.equal(ok.headers['Cache-Control'], 'no-store');
for (const key of ['Content-Length', 'Content-Encoding', 'ETag']) assert.equal(ok.headers[key], undefined);
const payload = ok.body.match(/<script id="loon-energy-scroll-v1">([\s\S]*?)<\/script>/)[1];
new vm.Script(payload);
let checks = 1;
function unchanged(overrides) {assert.equal(Object.keys(transform(overrides).result).length, 0); checks++;}
unchanged({url: url.replace('&loon_energy_scroll=1', '')});
unchanged({url: url.replace('loon_energy_scroll=1', 'otherloon_energy_scroll=1')});
unchanged({url: url.replace('loon_energy_scroll=1', 'loon_energy_scroll=10')});
unchanged({url: url.replace('https:', 'http:')});
unchanged({url: url.replace('mo.m.taobao.com', 'evil.example')});
unchanged({url: url.replace('page_1728378489402', 'page_other')});
unchanged({url: url.replace('ep=offline', 'ep=')});
unchanged({url: url.replace('et=offline', 'unrelated=offline')});
unchanged({response: {status: 404}});
unchanged({response: {body: '{}', headers: {'Content-Type': 'application/json'}}});
unchanged({response: {body: html.replace('超级红包-搜索热词任务', '登录已失效')}});
unchanged({response: {body: html.replace('<head>', '<body>')}});
unchanged({response: {body: ok.body}});
unchanged({response: {body: 'x'.repeat(3 * 1024 * 1024 + 1)}});
unchanged({response: {headers: {'Content-Type': 'text/html', 'cOnTenT-sEcuRity-pOlicy': "script-src 'self'"}}});
unchanged({response: {body: html.replace('<head>', '<head><meta http-equiv="Content-Security-Policy" content="script-src self">')}});
const goods = transform({url: url.replace('page_1728378489402', 'page_1697972915627'), response: {body: html.replace('超级红包-搜索热词任务', '浏览惊喜好物任务')}}).result;
assert.ok(goods.body); checks++;
const pluginPattern = new RegExp(plugin.match(/^http-response (\S+) /m)[1]);
assert.ok(pluginPattern.test(url));
assert.ok(pluginPattern.test(url.replace('?ep=offline&et=offline&loon_energy_scroll=1', '?loon_energy_scroll=1&ep=offline&et=offline')));
assert.ok(!pluginPattern.test(url.replace('loon_energy_scroll=1', 'otherloon_energy_scroll=1')));
assert.ok(!pluginPattern.test(url.replace('loon_energy_scroll=1', 'loon_energy_scroll=10'))); checks++;
assert.ok(!/fetch\(|XMLHttpRequest|dispatchEvent|eval\(/.test(payload)); checks++;
console.log(`${checks} offline response checks passed. Phone task completion remains unverified.`);
if (process.argv.includes('--emit-fixture')) process.stdout.write(JSON.stringify({payload, html: ok.body}));
