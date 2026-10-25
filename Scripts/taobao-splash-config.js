// Taobao 10.68.0 splash schedule experiment. No DNS or resource-host blocking.
// Static evidence: TBBootImageItemSelector.checkStartTimeAndEndTime:.
(function () {
  'use strict';
  const KEY = 'LAZING_TB_SPLASH_SCHEDULE_V1';
  const START = 4070908800000; // 2099-01-01T00:00:00Z
  const END = 4102444800000;   // 2100-01-01T00:00:00Z
  let result = {};
  const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const stamp = ms => new Date(ms + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
  function notify(title, text) {
    try { $notification.post('淘宝开屏配置', title, text); } catch (_) {}
  }
  function read() {
    try {
      const s = JSON.parse($persistentStore.read(KEY) || 'null');
      return plain(s) && s.version === 1 ? s : { version: 1, changed: 0, candidates: 0 };
    } catch (_) { return { version: 1, changed: 0, candidates: 0 }; }
  }
  function save(s) {
    try { $persistentStore.write(JSON.stringify(s), KEY); } catch (_) {}
  }
  try {
    if (typeof $request === 'undefined') {
      if (typeof $argument !== 'string' || $argument !== 'stats') return;
      const s = read();
      const text = '已检查 ' + (Number(s.inspected) || 0) + ' 条接口响应；改写 ' + (Number(s.changed) || 0) + ' 次\n最近改写 ' +
        (s.lastChangedAt ? stamp(s.lastChangedAt) + '（北京时间）' : '尚无') +
        '\n上次结果：' + (s.lastResult || '尚无记录');
      console.log('[淘宝开屏配置] ' + text);
      notify('本机记录', text);
      return;
    }
    if (typeof $response === 'undefined' || Number($response.status || $response.statusCode) !== 200) return;
    const url = String($request.url || '');
    // DNS/SNI selection belongs to Loon. Accept a literal IP URL after decryption,
    // while requiring a known MTop gateway path and exact splash fields below.
    const match = /^https:\/\/([^/?#]+)\/(?:gw|h5)\/(mtop\.[a-z0-9_.]+)\//i.exec(url);
    if (!match) return;
    const host = match[1].replace(/:443$/, '').toLowerCase();
    if (!/(?:^|\.)(?:taobao|tmall)\.com$/.test(host) &&
        !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host) && !/^\[[0-9a-f:]+\]$/i.test(host)) return;
    const raw = $response.body;
    if (typeof raw !== 'string' || raw.length > 4 * 1024 * 1024) return;
    const observed = read();
    observed.inspected = (Number(observed.inspected) || 0) + 1;
    observed.lastSeenApi = match[2].toLowerCase();
    observed.lastResult = raw.includes('topViewSplashSection') ? '找到开屏字段，正在检查条目' : '本条响应没有开屏字段';
    save(observed);
    if (!raw.includes('topViewSplashSection')) return;
    let prefix = '', suffix = '', doc;
    try { doc = JSON.parse(raw); }
    catch (_) {
      const wrapper = /^(\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*\(\s*)([\s\S]*?)(\s*\)\s*;?\s*)$/.exec(raw);
      if (!wrapper) return;
      prefix = wrapper[1]; suffix = wrapper[3]; doc = JSON.parse(wrapper[2]);
    }
    if (!plain(doc)) return;
    let count = 0, sections = 0, visited = 0;
    function numeric(v) {
      return (typeof v === 'number' || typeof v === 'string' && /^\d+(?:\.\d+)?$/.test(v)) &&
        Number.isFinite(Number(v)) && Number(v) > 0;
    }
    function inside(value, depth) {
      if (++visited > 20000 || depth > 24) throw new Error('limit');
      if (typeof value === 'number' && (!Number.isFinite(value) || Number.isInteger(value) && !Number.isSafeInteger(value))) throw new Error('number');
      if (Array.isArray(value)) { for (const v of value) inside(v, depth + 1); return; }
      if (!plain(value)) return;
      // Wire names match TBJSONModel property names. Do not guess snake_case or
      // treat a generic "endTime"/"expire" field as a splash control.
      if (own(value, 'gmtStartMs') && own(value, 'gmtEndMs') &&
          numeric(value.gmtStartMs) && numeric(value.gmtEndMs) &&
          (typeof value.imgUrl === 'string' && /^https?:\/\//i.test(value.imgUrl) ||
           typeof value.videoUrl === 'string' && /^https?:\/\//i.test(value.videoUrl))) {
        if (Number(value.gmtStartMs) !== START || Number(value.gmtEndMs) !== END) {
          value.gmtStartMs = typeof value.gmtStartMs === 'string' ? String(START) : START;
          value.gmtEndMs = typeof value.gmtEndMs === 'string' ? String(END) : END;
          count++;
        }
      }
      for (const key of Object.keys(value)) inside(value[key], depth + 1);
    }
    function outside(value, depth) {
      if (++visited > 20000 || depth > 24) throw new Error('limit');
      if (typeof value === 'number' && (!Number.isFinite(value) || Number.isInteger(value) && !Number.isSafeInteger(value))) throw new Error('number');
      if (Array.isArray(value)) { for (const v of value) outside(v, depth + 1); return; }
      if (!plain(value)) return;
      for (const key of Object.keys(value)) {
        if (key !== 'topViewSplashSection') { outside(value[key], depth + 1); continue; }
        let part = value[key], encoded = false;
        if (typeof part === 'string' && part.length < 1024 * 1024) {
          try { part = JSON.parse(part); encoded = true; } catch (_) { continue; }
        }
        if (!plain(part) || !Array.isArray(part.sections)) continue;
        sections++;
        const before = count;
        inside(part.sections, depth + 1);
        if (encoded && count > before) value[key] = JSON.stringify(part);
      }
    }
    outside(doc, 0);
    if (!sections) return;
    const settings = typeof $argument === 'object' && $argument ? $argument : {};
    const enabled = settings.notify !== false && settings.notify !== 'false';
    const s = read();
    s.candidates = (Number(s.candidates) || 0) + 1;
    s.lastSeenAt = Date.now();
    s.lastApi = match[2].toLowerCase(); // Never store query, cookies, or response.
    s.lastResult = count ? '已改写 ' + count + ' 条开屏时间' : '找到开屏字段，本次没有可改条目';
    if (count) {
      // Commit only after the entire bounded traversal has completed.
      result = { body: prefix + JSON.stringify(doc) + suffix };
      s.changed = (Number(s.changed) || 0) + 1;
      s.lastChangedAt = Date.now();
      console.log('[淘宝开屏配置] 已改写 ' + count + ' 条；开始时间 2099 年；接口 ' + s.lastApi);
      if (enabled) notify('已改写 ' + count + ' 条', '开始时间设为 2099 年\n' + s.lastApi);
    } else if (enabled && (!s.lastCandidateNoticeAt || Date.now() - s.lastCandidateNoticeAt >= 3600000)) {
      s.lastCandidateNoticeAt = Date.now();
      notify('找到开屏字段', '本次没有可改条目\n' + s.lastApi);
    }
    save(s);
  } catch (_) {
    // A failed parse or bounded traversal leaves the original body untouched.
    console.log('[淘宝开屏配置] 本次未改写');
  } finally { $done(result); }
})();
