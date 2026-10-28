// v0.1.0 — restore the previous official UI for the original scene 8917 links.
// No task API calls, fabricated completion, credentials, or scrolling.
(function () {
  'use strict';
  var KEY = 'LAZING_TB_DOUBLE11_RESTORE_V1';
  var TITLE = '淘宝双11计时验证';
  var BASE = '//g.alicdn.com/tbsearchwireless-pages/tao-gold-srp-task-pop/';
  var FROM = BASE + '0.0.5/web/';
  var TO = BASE + '0.0.4/web/';
  var IDS = ['100340', '100453', '100492', '107016', '100531', '99673',
    '106363', '99889', '106588', '101866', '107544', '99672', '100454',
    '106513', '106595', '99720', '90782'];
  function read() {
    try { return JSON.parse($persistentStore.read(KEY) || '{}') || {}; }
    catch (_) { return {}; }
  }
  function save(value) {
    try { $persistentStore.write(JSON.stringify(value), KEY); } catch (_) {}
  }
  function notice(subtitle, body) {
    try { $notification.post(TITLE, subtitle, body); } catch (_) {}
  }
  function status(value) {
    if (typeof value === 'number') return value;
    var match = /^(?:HTTP\/\S+\s+)?(\d{3})(?:\s|$)/i.exec(String(value || ''));
    return match ? Number(match[1]) : 0;
  }
  function finish(reason) {
    console.log('[' + TITLE + '] ' + reason);
    var record = read();
    record.lastAt = new Date().toISOString();
    record.lastResult = reason;
    save(record);
    return $done({});
  }
  try {
    if (typeof $request === 'undefined' || typeof $response === 'undefined') {
      var stored = read();
      var message = '已检查 ' + (Number(stored.checked) || 0) + ' 次，切换旧版 ' +
        (Number(stored.changed) || 0) + ' 次\n上次结果：' + (stored.lastResult || '尚未收到任务页') +
        (stored.lastAt ? '\n时间：' + stored.lastAt : '');
      console.log('[' + TITLE + '] ' + message);
      notice('改写记录', message);
      return $done({});
    }
    var url = String($request.url || '');
    var matched = /^https:\/\/market\.m\.taobao\.com\/app\/tbsearchwireless-pages\/tao-gold-srp-task-pop\/index\?([^#]+)(?:#.*)?$/.exec(url);
    if (!matched || String($request.method || 'GET').toUpperCase() !== 'GET') return $done({});
    var params = {};
    matched[1].split('&').forEach(function (pair) {
      var at = pair.indexOf('=');
      var key = decodeURIComponent(at < 0 ? pair : pair.slice(0, at));
      var value = decodeURIComponent(at < 0 ? '' : pair.slice(at + 1));
      if (!params[key]) params[key] = [];
      params[key].push(value);
    });
    if (!params.sceneId || params.sceneId.length !== 1 || params.sceneId[0] !== '8917' ||
        !params.deliveryId || params.deliveryId.length !== 1 || IDS.indexOf(params.deliveryId[0]) < 0) return $done({});
    var record = read();
    record.checked = (Number(record.checked) || 0) + 1;
    save(record);
    var body = $response.body;
    var headers = $response.headers || {};
    var type = '';
    Object.keys(headers).forEach(function (key) {
      if (key.toLowerCase() === 'content-type') type = String(headers[key]);
    });
    if (status($response.status) !== 200 || typeof body !== 'string' || body.length > 128 * 1024 ||
        !/^text\/html\b/i.test(type)) return finish('响应不符合任务页格式，保持原样');
    if (body.indexOf('data-loon-double11-restore="v1"') >= 0) return finish('已切换旧版');
    if (!/<meta\b[^>]*name=["']release-info["'][^>]*content=["']version=0\.0\.5,app-id=179600["'][^>]*>/i.test(body) ||
        !/<div\b[^>]*id=["']root["']/i.test(body)) return finish('页面版本或结构变化，保持原样');
    var fromCount = body.split(FROM).length - 1;
    var pathCount = (body.match(/window\.__ASSET_PATH__\s*=\s*['"]\/\/g\.alicdn\.com\/tbsearchwireless-pages\/tao-gold-srp-task-pop\/0\.0\.5\/web\/['"]/g) || []).length;
    var entryCount = (body.match(/<script\b[^>]*\bsrc=['"](?:https:)?\/\/g\.alicdn\.com\/tbsearchwireless-pages\/tao-gold-srp-task-pop\/0\.0\.5\/web\/index\.js['"][^>]*>/gi) || []).length;
    if (fromCount !== 3 || pathCount !== 2 || entryCount !== 1 ||
        /<script\b[^>]*\bintegrity\s*=/i.test(body)) return finish('资源引用结构变化，保持原样');
    body = body.split(FROM).join(TO);
    body = body.replace(/<html\b/i, '<html data-loon-double11-restore="v1"');
    var outputHeaders = {};
    Object.keys(headers).forEach(function (key) {
      if (!/^(?:content-length|content-encoding|transfer-encoding|etag|last-modified|content-md5|digest|content-digest|cache-control|expires)$/i.test(key)) outputHeaders[key] = headers[key];
    });
    outputHeaders['Cache-Control'] = 'no-store';
    record = read();
    record.changed = (Number(record.changed) || 0) + 1;
    record.lastAt = new Date().toISOString();
    record.lastResult = '已切换 0.0.4，等待淘宝受理任务';
    if (!record.notifiedAt || Date.now() - Number(record.notifiedAt) >= 60000) {
      notice('已切换旧版任务页', '请看是否恢复底部倒计时，结束后核对赛车任务进度。');
      record.notifiedAt = Date.now();
    }
    save(record);
    console.log('[' + TITLE + '] ' + record.lastResult);
    return $done({headers: outputHeaders, body: body});
  } catch (_) {
    console.log('[' + TITLE + '] 处理失败，保持原响应');
    return $done({});
  }
})();
