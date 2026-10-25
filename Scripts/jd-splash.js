// JD splash expiry + bounded, local-only diagnostic snapshots. 2026-10-25.2
(function () {
  'use strict';
  const KEY = 'LAZING_JD_SPLASH_DIAG_V1';
  const APIS = ['start', 'basicConfig', 'welcomeHome', 'searchBoxWord'];
  const MAX_BODY = 2 * 1024 * 1024, MAX_STORE = 192 * 1024;
  const sensitive = /cookie|token|secret|authorization|password|session|uuid|openudid|deviceid|pin|phone|mobile|address|latitude|longitude|traceid|requestid|userid|^sign$|^h5st$/i;
  let result = {};
  function object(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function safeName(k) { return /^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/.test(k) && !sensitive.test(k); }
  function notice(subtitle, text) { try { $notification.post('京东开屏', subtitle, text); } catch (_) {} }
  function empty() { return {version: 1, apis: {}}; }
  function load() {
    try {
      const raw = $persistentStore.read(KEY);
      if (typeof raw !== 'string' || raw.length > MAX_STORE) return empty();
      const s = JSON.parse(raw);
      if (!object(s) || s.version !== 1 || !object(s.apis)) return empty();
      const clean = empty();
      APIS.forEach(f => {
        const a = s.apis[f];
        if (!object(a)) return;
        clean.apis[f] = {hits: Number.isSafeInteger(a.hits) && a.hits > 0 ? Math.min(a.hits, 1000000) : 0,
          requests: Number.isSafeInteger(a.requests) && a.requests > 0 ? Math.min(a.requests, 1000000) : 0,
          lastRequestAt: Number.isSafeInteger(a.lastRequestAt) ? a.lastRequestAt : 0,
          samples: Array.isArray(a.samples) ? a.samples.slice(-3) : []};
      });
      return clean;
    } catch (_) { return empty(); }
  }
  function save(s) {
    try {
      const raw = JSON.stringify(s);
      return raw.length <= MAX_STORE && $persistentStore.write(raw, KEY) !== false;
    } catch (_) { return false; }
  }
  function apiFrom(req) {
    const u = String(req.url || '');
    if (!/^https:\/\/api\.m\.jd\.com\/(?:client\.action|api)(?:\?|$)/i.test(u)) return null;
    // A URL functionId is authoritative. Never infer it from a nested URL/body parameter.
    const query = u.split('?')[1] || '';
    const values = [];
    query.split('&').forEach(p => {
      const eq = p.indexOf('=');
      if (eq < 0 || p.slice(0, eq) !== 'functionId') return;
      try { values.push(decodeURIComponent(p.slice(eq + 1))); } catch (_) {}
    });
    if (values.length) return values.length === 1 && APIS.indexOf(values[0]) >= 0 ? values[0] : null;
    const body = req.body;
    if (typeof body !== 'string' || body.length > MAX_BODY) return null;
    if (/^\s*\{/.test(body)) {
      try { const b = JSON.parse(body); return object(b) && APIS.indexOf(b.functionId) >= 0 ? b.functionId : null; } catch (_) { return null; }
    }
    const m = /(?:^|&)functionId=([^&]*)/.exec(body);
    if (!m) return null;
    try { const f = decodeURIComponent(m[1]); return APIS.indexOf(f) >= 0 ? f : null; } catch (_) { return null; }
  }
  function bucket(s, api) {
    if (!s.apis[api]) s.apis[api] = {hits: 0, requests: 0, lastRequestAt: 0, samples: []};
    return s.apis[api];
  }
  function flag(v) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e12) return v;
    if (typeof v === 'string' && /^(?:true|false|-?\d{1,12}(?:\.\d{1,3})?)$/.test(v)) return v;
    return undefined;
  }
  function ids(v) {
    const a = typeof v === 'string' ? v.split(',') : Array.isArray(v) ? v : [v];
    return a.slice(0, 80).map(x => String(x).trim()).filter(x => /^[A-Za-z0-9_-]{1,64}$/.test(x));
  }
  function inspect(doc) {
    const fields = [], keys = [], seen = Object.create(null);
    let nodes = 0, decoded = 0, decodeCount = 0, limited = false;
    function keep(path, name, value) { if (fields.length < 60) fields.push({path: (path || '$').slice(0, 180), name, value}); else limited = true; }
    function walk(v, path, depth) {
      if (++nodes > 8000 || depth > 20) { limited = true; return; }
      if (typeof v === 'string') {
        if (decodeCount < 32 && v.length < 512 * 1024 && decoded + v.length <= 512 * 1024 && /^\s*[\[{]/.test(v)) {
          let inner;
          try { inner = JSON.parse(v); } catch (_) { return; }
          decoded += v.length; decodeCount++; walk(inner, path + '{json}', depth + 1);
        }
        return;
      }
      if (Array.isArray(v)) { for (let i = 0; i < v.length && nodes <= 8000; i++) walk(v[i], path + '[]', depth + 1); return; }
      if (!object(v)) return;
      const names = Object.keys(v);
      for (const k of names) {
        if (nodes > 8000) { limited = true; break; }
        if (!safeName(k)) continue;
        const p = (path ? path + '.' : '') + k, x = v[k];
        if (!seen[p] && keys.length < 120) { keys.push(p.slice(0, 180)); seen[p] = true; }
        if (['onlineTime', 'referralsTime'].indexOf(k) >= 0 && dateValue(x) !== null) keep(p, k, x);
        else if (k === 'expireAds') keep(p, k, {ids: ids(x), type: typeof x, length: typeof x === 'string' ? x.length : undefined});
        else if (k === 'groupId' && (Object.prototype.hasOwnProperty.call(v, 'onlineTime') || Object.prototype.hasOwnProperty.call(v, 'referralsTime'))) keep(p, k, ids(x));
        else if (['degradeSplashAD', 'homePageSplashAd', 'requestStartMins', 'showStartMins', 'showTimesDaily', 'maxShowTimes'].indexOf(k) >= 0) {
          const f = flag(x); keep(p, k, f === undefined ? {type: typeof x, length: typeof x === 'string' ? x.length : undefined} : f);
        } else if (k === 'extSwitch') keep(p, k, {type: typeof x, length: typeof x === 'string' ? x.length : undefined,
          keys: object(x) ? Object.keys(x).filter(safeName).slice(0, 80) : undefined});
        else if (k === 'images' && Array.isArray(x)) keep(p, k, {groups: x.length});
        // Arbitrary values, URLs, opaque ciphertext and account data are never copied.
        walk(x, p, depth + 1);
      }
    }
    walk(doc, '', 0);
    return {fields, structure: keys, limited, jsonStringsDecoded: decodeCount};
  }
  function expire(doc) {
    if (!object(doc) || (doc.code !== '0' && doc.code !== 0) || !Array.isArray(doc.images)) return 0;
    const pending = [], stack = [{items: doc.images, depth: 0}];
    while (stack.length) {
      const row = stack.pop();
      for (const item of row.items) {
        if (Array.isArray(item)) {
          if (row.depth >= 3) return 0;
          stack.push({items: item, depth: row.depth + 1}); continue;
        }
        if (!object(item)) continue;
        const a = dateValue(item.onlineTime), b = dateValue(item.referralsTime);
        if (a === null || b === null || a > b) continue;
        if (item.onlineTime !== '2000-01-01 00:00:00' || item.referralsTime !== '2000-01-02 00:00:00') pending.push(item);
      }
    }
    pending.forEach(item => { item.onlineTime = '2000-01-01 00:00:00'; item.referralsTime = '2000-01-02 00:00:00'; });
    return pending.length;
  }
  function dateValue(value) {
    if (typeof value !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3], h = +m[4], mi = +m[5], s = +m[6];
    if (y < 1900 || y > 9999 || mo < 1 || mo > 12 || d < 1 || h > 23 || mi > 59 || s > 59) return null;
    const t = Date.UTC(y, mo - 1, d, h, mi, s), c = new Date(t);
    return c.getUTCFullYear() === y && c.getUTCMonth() === mo - 1 && c.getUTCDate() === d ? t : null;
  }
  try {
    if (typeof $request === 'undefined') {
      if (typeof $argument === 'string' && $argument === 'reset') {
        notice(save(empty()) ? '诊断记录已清空' : '清空失败', '');
      } else {
        const s = load();
        console.log('京东开屏诊断记录（分享本次运行日志即可）');
        console.log(JSON.stringify(s, null, 2));
        const lines = APIS.map(f => { const b = s.apis[f]; return f + '：请求 ' + (b ? b.requests : 0) + ' 次，响应 ' + (b ? b.hits : 0) + ' 次'; });
        notice('诊断记录已导出到日志', lines.join('\n') + '\n请分享本次运行日志');
      }
    } else {
      const api = apiFrom($request);
      if (!api) return;
      const state = load(), b = bucket(state, api);
      if (typeof $response === 'undefined') {
        b.requests = Math.min(b.requests + 1, 1000000); b.lastRequestAt = Date.now();
        const ok = save(state);
        // Normal hits notify once the response arrives. Report storage errors immediately.
        if (!ok) notice('发现 ' + api + ' 请求', '本机记录保存失败');
        return;
      }
      const raw = $response.body, code = Number($response.status || $response.statusCode);
      const sample = {at: Date.now(), httpStatus: Number.isInteger(code) ? code : 0,
        bodyChars: typeof raw === 'string' ? raw.length : 0, result: '', fields: [], structure: [], changed: 0};
      let doc;
      if (typeof raw !== 'string') sample.result = '响应为二进制或缺少正文';
      else if (!raw.length) sample.result = '响应为空';
      else if (raw.length > MAX_BODY) sample.result = '响应超过2MB，仅记录大小';
      else {
        try { doc = JSON.parse(raw); } catch (_) { sample.result = '响应不是JSON'; }
        if (doc !== undefined) {
          const found = inspect(doc);
          Object.assign(sample, found);
          const business = object(doc) ? flag(doc.code) : undefined;
          if (business !== undefined) sample.businessCode = business;
          sample.result = found.fields.length ? '找到开屏字段' : '收到JSON，本条没有开屏字段';
          if (api === 'start' && code === 200) {
            sample.changed = expire(doc);
            if (sample.changed) result = {body: JSON.stringify(doc)};
          }
        }
      }
      // Keep every interface's latest three responses without allowing one large config to exhaust storage.
      while (JSON.stringify(sample).length > 12 * 1024 && (sample.structure.length || sample.fields.length)) {
        sample.limited = true;
        if (sample.structure.length) sample.structure.pop(); else sample.fields.pop();
      }
      b.hits = Math.min(b.hits + 1, 1000000); b.samples.push(sample); b.samples = b.samples.slice(-3);
      const stored = save(state);
      const text = (stored ? '已保存；' : '保存失败；') + sample.result + '；HTTP ' + sample.httpStatus +
        (sample.changed ? '\n已将 ' + sample.changed + ' 条广告日期设为过期' : '') + '\n可运行「导出京东开屏诊断记录」';
      console.log('[京东开屏] ' + api + '：' + text);
      notice('命中 ' + api, text);
    }
  } catch (_) { console.log('[京东开屏] 诊断失败，原处理结果保留'); }
  finally { $done(result); }
})();
