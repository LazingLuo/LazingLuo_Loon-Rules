'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const api = require([path.join(__dirname, 'jd-signin-shortcut.js'), path.join(__dirname, '../Scripts/jd-signin-shortcut.js')].find(fs.existsSync));
const {createJdShortcutBridge, jbExecuteTask, JB_BASE, JB_STORE, JS_KEYS, JS_TASKS} = api;
const key = 'a'.repeat(64), proof = 'b'.repeat(64), argument = key + '|' + proof;
let checks = 0;
function check(value, label) { assert.ok(value, label); checks++; }
function harness(execute, withLogin = true) {
  const map = new Map(), calls = [], logs = []; let clock = Date.now(), serial = 1, currentDay;
  const realDay = () => new Date(clock + 8 * 3600000).toISOString().slice(0, 10);
  const env = {
    rawRead: k => map.get(k) || '', rawWrite: (v, k) => { map.set(k, v); return true; },
    now: () => clock, day: () => currentDay || realDay(),
    random: () => ((serial++ * 7919) % 65521) / 65521, setTimeout, clearTimeout,
    log: s => logs.push(s), request: async (task, options) => { calls.push({task, options}); throw Error('No network in checks'); }
  };
  const put = (k, v) => map.set(k, JSON.stringify(v));
  const read = k => map.get(k) ? JSON.parse(map.get(k)) : null;
  if (withLogin) {
    put(JS_KEYS.bound, {pin: 'offline'});
    put(JS_KEYS.login, {pin: 'offline', cookie: 'pt_key=FAKE_ONLY;pt_pin=offline;', capturedAt: clock,
      headers: {Cookie: 'pt_key=FAKE_ONLY;pt_pin=offline;', 'User-Agent': 'jdapp;iPhone;16.1.50;27.0;network/wifi;'}});
  }
  const invoked = [];
  const run = execute || (async context => { invoked.push(context.task); return {task: context.task, status: 'already_done'}; });
  const bridge = createJdShortcutBridge(env, context => run(context, env));
  async function request(route, method = route === 'probe' || route === 'status' ? 'GET' : 'POST', options = {}) {
    const headers = route === 'probe' ? {} : {'X-Lazing-Signin-Key': key, ...options.headers};
    if (options.session) headers['X-Lazing-Signin-Session'] = options.session;
    const raw = await bridge.handle({url: JB_BASE + route, method, headers}, argument);
    return JSON.parse(raw.response.body);
  }
  return {map, env, put, read, bridge, request, invoked, calls, logs,
    advance: ms => { clock += ms; }, setDay: s => { currentDay = s; }};
}
(async () => {
  let h = harness();
  const before = h.map.size, p = await h.request('probe');
  check(p.proof === proof && p.ok === 'yes', 'probe identifies local bridge');
  check(h.map.size === before && h.invoked.length === 0 && !p.session, 'probe neither creates session nor executes');
  const pluginProbe = JSON.parse((await h.bridge.handle({url: JB_BASE + 'probe', method: 'GET', headers: {}}, {pairing: argument})).response.body);
  check(pluginProbe.proof === proof && pluginProbe.ok === 'yes', 'remote plugin object argument supported');
  const copied = JSON.parse((await h.bridge.handle({url: JB_BASE + 'probe', method: 'GET', headers: {}}, {pairing: argument + '\n'})).response.body);
  check(copied.proof === proof, 'copied pairing line tolerates trailing newline');
  const emptyPlugin = JSON.parse((await h.bridge.handle({url: JB_BASE + 'probe', method: 'GET', headers: {}}, {pairing: ''})).response.body);
  check(emptyPlugin.code === 'NOT_PAIRED' && h.invoked.length === 0, 'empty remote plugin setting performs nothing');
  check(!JSON.stringify(p).includes('FAKE_ONLY'), 'probe exposes no Cookie');
  check((await h.request('start', 'GET')).ok === 'no', 'GET cannot start execution');
  check((await h.request('task/daily', 'GET')).ok === 'no', 'GET cannot execute a task');
  let denied = JSON.parse((await h.bridge.handle({url: JB_BASE + 'start', method: 'POST', headers: {}}, argument)).response.body);
  check(denied.code === 'PAIRING_FAILED' && h.invoked.length === 0, 'unpaired start has no execution');
  check((await h.request('start', 'POST', {headers: {origin: 'https://example.invalid'}})).code === 'BROWSER_DENIED', 'browser-origin request refused');
  check((await h.request('start', 'POST', {headers: {'X-Lazing-Signin-Gap': '3'}})).code === 'BAD_SETTINGS', 'invalid gap explained');
  check((await h.request('task/lottery')).ok === 'no', 'activities absent from route whitelist');
  const noLogin = harness(null, false);
  check((await noLogin.request('start')).code === 'NO_LOGIN', 'missing Cookie stops before execution');
  const busy = harness(); busy.put(JS_KEYS.lock, {id: 'other-runner', expires: busy.env.now() + 300000});
  check((await busy.request('start')).code === 'BUSY', 'existing manual or auto queue respected');
  const start = await h.request('start'); const session = start.session;
  check(start.ok === 'yes' && /^[a-f0-9]{32}$/.test(session), 'paired start creates session');
  check(h.read(JS_KEYS.lock).id === 'shortcut:' + session, 'shared queue lock retained across requests');
  check((await h.request('task/daily', 'POST', {session: 'f'.repeat(32)})).code === 'SESSION_MISMATCH', 'wrong session refused');
  check((await h.request('task/scratch', 'POST', {session})).code === 'ORDER', 'out-of-order task refused');
  check((await h.request('finish', 'POST', {session})).code === 'NOT_FINISHED', 'cannot claim queue complete early');
  const removed = await h.request('task/plant', 'POST', {session});
  check(removed.code === 'REMOVED' && !h.invoked.includes('plant'), 'old shortcut plant step safely skips without execution');
  check(!JS_TASKS.some(([t]) => t === 'plant') && !api.runPlantSignin, 'plant removed from bridge runner');
  for (const [index, [task]] of JS_TASKS.entries()) {
    const r = await h.request('task/' + task, 'POST', {session});
    check(r.ok === 'yes', 'task step received: ' + task);
    check(index === JS_TASKS.length-1 ? r.waitSeconds === 0 : r.waitSeconds >= 5 && r.waitSeconds <= 15, 'bounded gap after ' + task);
    const count = h.invoked.length;
    const cached = await h.request('task/' + task, 'POST', {session});
    check(cached.code === 'CACHED' && h.invoked.length === count, 'same step never resubmitted: ' + task);
  }
  const finish = await h.request('finish', 'POST', {session});
  check(finish.ok === 'yes' && finish.code === 'FINISHED', 'all remaining sign-ins finish');
  check(h.invoked.join(',') === JS_TASKS.map(([t]) => t).join(','), 'exact remaining-task order');
  check(!h.env.rawRead(JS_KEYS.lock), 'shared lock released after finish');
  check(h.read(JS_KEYS.history).length === 1, 'one aggregate history entry');
  await h.request('finish', 'POST', {session});
  check(h.read(JS_KEYS.history).length === 1, 'duplicate finish does not duplicate history');
  check(!JSON.stringify(finish).includes('FAKE_ONLY') && !JSON.stringify(finish).includes('pt_pin'), 'responses expose no credentials');

  const failed = harness(async context => ({task: context.task, status: context.task === 'daily' ? 'missing' : 'already_done', detail: context.task === 'daily' ? '缺少凭据' : undefined}));
  const failedSession = (await failed.request('start')).session;
  await failed.request('task/daily', 'POST', {session: failedSession});
  check((await failed.request('task/scratch', 'POST', {session: failedSession})).ok === 'yes', 'one missing profile does not block later tasks');
  let blocked = harness(); const bSession = (await blocked.request('start')).session;
  blocked.put(JS_KEYS.bound, {pin: 'another'});
  check((await blocked.request('task/daily', 'POST', {session: bSession})).code === 'STOPPED', 'account change stops queue');
  check(!blocked.env.rawRead(JS_KEYS.lock), 'account change releases owned lock');
  blocked = harness(); const daySession = (await blocked.request('start')).session; blocked.setDay('2099-01-01');
  check((await blocked.request('task/daily', 'POST', {session: daySession})).code === 'STOPPED', 'crossing date stops queue');
  const persisted = harness(); const pSession = (await persisted.request('start')).session;
  const origWrite = persisted.env.rawWrite;
  persisted.env.rawWrite = (v, k) => k === JB_STORE ? false : origWrite(v, k);
  check((await persisted.request('task/daily', 'POST', {session: pSession})).ok === 'no' && persisted.invoked.length === 0, 'journal failure prevents action');

  let resolvePending;
  const concurrent = harness(context => new Promise(resolve => { resolvePending = () => resolve({task: context.task, status: 'already_done'}); }));
  const cSession = (await concurrent.request('start')).session;
  const first = concurrent.request('task/daily', 'POST', {session: cSession});
  check((await concurrent.request('task/daily', 'POST', {session: cSession})).code === 'BUSY', 'simultaneous duplicate refused while first is pending');
  resolvePending(); await first;
  const interrupted = harness(); const iSession = (await interrupted.request('start')).session;
  const state = interrupted.read(JB_STORE); state.steps.daily = {state: 'running', operation: 'dead', deadline: interrupted.env.now() - 11000}; interrupted.put(JB_STORE, state);
  check((await interrupted.request('start')).code === 'RESUME', 'interrupted queue resumes');
  const prior = await interrupted.request('task/daily', 'POST', {session: iSession});
  check(prior.code === 'CACHED' && prior.message.includes('结果待App确认') && interrupted.invoked.length === 0, 'interrupted task is not automatically repeated');
  check((await interrupted.request('task/scratch', 'POST', {session: iSession})).ok === 'yes', 'queue continues after uncertain prior task');

  // Exercise real JS core and real persistent journals with synthetic JD replies.
  let signed = false;
  const real = harness(async (context, env) => context.task === 'hs' ? jbExecuteTask(env, context) : {task: context.task, status: 'already_done'});
  real.env.request = async (task, options) => {
    real.calls.push({task, options});
    check(task === 'hs', 'selected core never dispatches a different task');
    const p = api.jsParams(options);
    let data;
    if (p.functionId === 'jdh_bm_getKitTask') data = {code: 0, result: {status: signed ? 4 : 1, id: 'FAKE_TASK', encodeId: 'FAKE_ENCODE'}};
    else if (p.functionId === 'jdh_msoa_doTaskGw') { signed = true; data = {code: 0, result: {result: {prizeInfovo: [{money: 1}]}}}; }
    else throw Error('Unexpected synthetic request');
    return {status: 200, headers: {}, body: JSON.stringify(data)};
  };
  const realSession = (await real.request('start')).session;
  for (const [t] of JS_TASKS.slice(0, 7)) await real.request('task/' + t, 'POST', {session: realSession});
  const result = real.read(JB_STORE).steps.hs.row;
  check(result.status === 'signed_confirmed' && result.beanQuantity === 1, 'real health flow signs and rechecks synthetic response');
  check(real.calls.length === 3, 'one selected core executes exactly query, action and recheck');
  check(real.read(JS_KEYS.lock).id === 'shortcut:' + realSession, 'core virtual lock never replaces shared bridge lease');
  const previous = real.calls.length;
  await real.request('task/hs', 'POST', {session: realSession});
  check(real.calls.length === previous, 'real core result reused without additional request');
  check(Object.keys(real.read(JS_KEYS.attempts)).length === 1, 'existing same-day action journal reused');
  check(real.read(JS_KEYS.last).results.length === 7, 'aggregate results retained rather than replaced by single task');
  let expiryRejected = false;
  try { await jbExecuteTask(real.env, {session: real.read(JB_STORE), task: 'hs', operation: 'x', deadline: real.env.now() - 1}); } catch (_) { expiryRejected = true; }
  check(expiryRejected && real.calls.length === previous, 'expired execution makes no request');
  console.log(checks + ' bridge checks passed; synthetic data only; no JD network calls.');
  fs.writeFileSync(path.join(__dirname, 'functional-validation.json'), JSON.stringify({checks, jd_network_calls: 0, synthetic_core_requests: real.calls.length}, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
