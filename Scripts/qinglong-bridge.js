// Loon -> Qinglong OpenAPI bridge. No JD requests, signing or automatic task runs.
(async function () {
  const VERSION = '2026-10-18.2';
  const PREFIX = 'QL_BRIDGE_';
  const capture = typeof $request !== 'undefined';
  let config, lock, result = {time: Date.now(), version: VERSION};
  function read(key, fallback) {
    const raw = $persistentStore.read(PREFIX + key);
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch (_) { throw new Error('青龙接入本地记录损坏'); }
  }
  function write(key, value) {
    if (!$persistentStore.write(JSON.stringify(value), PREFIX + key)) throw new Error('青龙接入本地保存失败');
  }
  function fail(message) { throw new Error(message); }
  function cookiePair(value) {
    const parts = String(value || '').split(';').map(x => x.trim());
    const keys = parts.filter(x => x.startsWith('pt_key='));
    const pins = parts.filter(x => x.startsWith('pt_pin='));
    if (keys.length !== 1 || pins.length !== 1) return null;
    const key = keys[0].slice(7), pin = pins[0].slice(7);
    if (!key || !pin || /[\r\n\s]/.test(key + pin)) return null;
    return {pin, cookie: 'pt_key=' + key + ';pt_pin=' + pin + ';'};
  }
  function header(headers, name) {
    const field = Object.keys(headers || {}).find(k => k.toLowerCase() === name);
    const value = field ? headers[field] : '';
    return Array.isArray(value) ? value.join('; ') : String(value || '');
  }
  function readExistingJD() {
    try { return JSON.parse($persistentStore.read('JD_CHECKIN_TEST_ACCOUNT_V1') || 'null'); }
    catch (_) { return null; }
  }
  function existingJX() {
    try { return JSON.parse($persistentStore.read('JXZY_CHECKIN_ACCOUNT_V1') || 'null'); }
    catch (_) { return null; }
  }
  function existingFinance() {
    try { return JSON.parse($persistentStore.read('JD_JR_CHECKIN_ACCOUNT_V1') || 'null'); }
    catch (_) { return null; }
  }
  function latestCredential() {
    const existing = readExistingJD(), jx = existingJX(), saved = read('CREDENTIAL_V1', null);
    const bound = read('ACCOUNT_V1', null);
    const candidates = saved ? [saved] : [];
    if (existing && existing.modes) {
      for (const mode of Object.keys(existing.modes)) {
        const profile = existing.modes[mode];
        const pair = cookiePair(header(profile && profile.headers, 'cookie'));
        if (pair && pair.pin === existing.pin) candidates.push(Object.assign(pair, {
          capturedAt: Number(profile.loginUpdatedAt || profile.capturedAt || 0), source: 'existing_activity'
        }));
      }
    }
    if (jx && jx.headers) {
      const pair = cookiePair(header(jx.headers, 'cookie'));
      if (pair && pair.pin === jx.pin) candidates.push(Object.assign(pair, {
        capturedAt: Number(jx.loginUpdatedAt || jx.capturedAt || 0), source: 'existing_jxzy'
      }));
    }
    const pin = bound && bound.pin || existing && existing.pin || saved && saved.pin || jx && jx.pin;
    const valid = candidates.filter(x => x && x.pin === pin && cookiePair(x.cookie));
    valid.sort((a, b) => Number(b.capturedAt || 0) - Number(a.capturedAt || 0));
    if (!valid.length) fail('尚无可同步的京东凭据，请打开凭据获取开关并正常使用京东');
    return valid[0];
  }
  function captureCredential() {
    if (!$response || Number($response.status) !== 200 || $request.method !== 'POST') return;
    const url = String($request.url || '');
    if (!/^https:\/\/api\.m\.jd\.com\/(?:api|client\.action)\?/.test(url)) return;
    const match = url.match(/[?&]functionId=([^&#]+)/);
    if (!match || !['startup', 'logConfig', 'queryPagePopWindow', 'babelGetGuideTips', 'findBeanSceneNew',
      'bff_rightsCenter_jdInteractTask', 'bff_rightsCenter_interaction', 'bff_marketing_interaction'].includes(match[1])) return;
    let data;
    try { data = JSON.parse($response.body || '{}'); } catch (_) { return; }
    if (!data || data.success === false || !['0', '200', '1711000'].includes(String(data.code))) return;
    const pair = cookiePair(header($request.headers, 'cookie'));
    if (!pair) return;
    const bound = read('ACCOUNT_V1', null), existing = readExistingJD(), saved = read('CREDENTIAL_V1', null);
    const pin = bound && bound.pin || existing && existing.pin || saved && saved.pin;
    if (pin && pair.pin !== pin) return;
    const start = typeof $script !== 'undefined' && $script.startTime;
    const observed = start ? Number(new Date(start)) : Date.now();
    const capturedAt = Number.isFinite(observed) && observed > 0 && observed <= Date.now() ? observed : Date.now();
    if (saved && capturedAt < Number(saved.capturedAt || 0)) return;
    write('CREDENTIAL_V1', Object.assign(pair, {capturedAt, source: match[1]}));
    console.log('[青龙接入] 已在手机保存京东登录凭据，等待同步；未触发活动任务');
  }
  function settings(value) {
    if (typeof value === 'string') { try { value = JSON.parse(value); } catch (_) { value = null; } }
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('入口参数缺失，请从青龙接入插件执行');
    return value;
  }
  function baseUrl(value) {
    const base = String(value || '').trim().replace(/\/+$/, '');
    const match = base.match(/^(https?):\/\/([^\s/?#:@]+)(?::(\d{1,5}))?(\/[^\s?#]*)?$/);
    if (!match || (match[3] && (Number(match[3]) < 1 || Number(match[3]) > 65535))) fail('青龙地址格式错误，请填写完整的 http 或 https 地址');
    const host = match[2].toLowerCase();
    const ipv4 = host.split('.').map(Number);
    const privateIP = /^\d+\.\d+\.\d+\.\d+$/.test(host) && ipv4.every(x => Number.isInteger(x) && x >= 0 && x <= 255) &&
      (ipv4[0] === 10 || ipv4[0] === 127 || ipv4[0] === 192 && ipv4[1] === 168 || ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31);
    if (match[1] === 'http' && !privateIP && host !== 'localhost') fail('HTTP 地址仅用于局域网；远程地址请使用 HTTPS');
    return base;
  }
  function request(method, path, body, token) {
    return new Promise((resolve, reject) => {
      const options = {url: config.base + '/open' + path, timeout: 10000,
        'auto-redirect': false, 'auto-cookie': false, insecure: false, headers: {Accept: 'application/json'}};
      if (token) options.headers.Authorization = 'Bearer ' + token;
      if (body !== undefined) { options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(body); }
      $httpClient[method](options, (error, response, text) => {
        if (error) return reject(new Error('无法连接青龙，请确认手机与 NAS 在同一网络及地址端口正确；写操作失败后请先查看面板状态'));
        const status = response && Number(response.status);
        if (status === 401 || status === 403) return reject(new Error('青龙授权失败，请检查 Client ID、Secret 及应用权限'));
        if (status !== 200) return reject(new Error('青龙接口返回 HTTP ' + (status || 0) + '，请查看面板日志；未自动重试'));
        let data;
        try { data = JSON.parse(text); } catch (_) { return reject(new Error('青龙返回格式异常，请确认地址指向青龙面板')); }
        if (!data || Number(data.code) !== 200) return reject(new Error('青龙接口拒绝请求，请核对应用授权及面板日志；未自动重试'));
        resolve(data.data);
      });
    });
  }
  function rows(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.data)) return data.data;
    fail('青龙列表结构无法识别，请查看面板版本');
  }
  function idOf(item) {
    const value = item && (item.id === undefined ? item._id : item.id);
    if (!Number.isSafeInteger(Number(value)) || Number(value) < 1) fail('青龙记录 ID 无法识别');
    return Number(value);
  }
  function takeLock() {
    const previous = read('LOCK_V1', null);
    if (previous && Date.now() - previous.time < 120000) fail('另一次青龙同步或任务触发仍在处理，请稍后查看');
    lock = {time: Date.now(), owner: String(Date.now()) + '-' + String(Math.random())};
    write('LOCK_V1', lock);
  }
  async function sync(token) {
    const credential = latestCredential();
    const envs = rows(await request('get', '/envs?searchValue=JD_COOKIE', undefined, token));
    const matches = envs.filter(x => x.name === 'JD_COOKIE' && cookiePair(x.value) && cookiePair(x.value).pin === credential.pin);
    if (matches.length > 1) fail('青龙中有同账号的多条 JD_COOKIE，请先在面板整理；未修改');
    let message;
    if (matches.length) {
      const target = matches[0];
      if (String(target.value) === credential.cookie) message = '青龙已保存相同的京东登录凭据，无需更新';
      else {
        const body = {id: idOf(target), name: 'JD_COOKIE', value: credential.cookie, remarks: target.remarks || ''};
        if (target.labels !== undefined) body.labels = target.labels;
        await request('put', '/envs', body, token);
        message = '已更新青龙中同账号的京东登录凭据';
      }
      if (Number(target.status) === 1) message += '；该变量处于禁用状态，需你在青龙面板确认后启用';
    } else {
      await request('post', '/envs', [{name: 'JD_COOKIE', value: credential.cookie, remarks: 'Loon 同步'}], token);
      message = '已在青龙新建京东登录凭据 JD_COOKIE';
    }
    write('ACCOUNT_V1', {pin: credential.pin});
    result.credentialCapturedAt = credential.capturedAt;
    return message + '。凭据是否有效仍需由具体任务确认；本次未触发签到。';
  }
  async function tasks(token) { return rows(await request('get', '/crons', undefined, token)); }
  function activityPack() {
    const credential = latestCredential(), existing = readExistingJD(), jx = existingJX(), finance = existingFinance();
    const pack = {version: 1, pin: credential.pin, activities: {}, attempts: {}};
    for (const mode of ['scratch', 'blindbox', 'jxzy', 'finance']) {
      const original = mode === 'finance' ? finance : mode === 'jxzy' ? jx : existing && existing.modes && existing.modes[mode];
      if (!original || !original.query || (mode === 'finance' ? !original.ready || !original.riskDeviceParam : !original.query.params)) continue;
      const pair = cookiePair(header(original.headers, 'cookie'));
      if (!pair || pair.pin !== credential.pin || ['jxzy', 'finance'].includes(mode) && original.pin !== credential.pin) fail('青龙活动凭据的账号不一致，请先核对本机账号；未同步');
      if (mode === 'finance' && original.doubleSign && original.doubleSign.pin !== credential.pin) fail('青龙金融双签凭据的账号不一致，请先核对本机账号；未同步');
      // Export only the selected activities, never the full persistence, diagnostics or other accounts.
      const profile = {};
      const keys = ['pin', 'capturedAt', 'updatedAt', 'loginUpdatedAt', 'loginSource', 'query', 'interaction', 'claim', 'signing'];
      if (mode === 'finance') keys.push('ready', 'scopeKey', 'riskScope', 'riskDeviceParam', 'doubleSign');
      for (const key of keys) {
        if (original[key] !== undefined) profile[key] = JSON.parse(JSON.stringify(original[key]));
      }
      profile.headers = {};
      for (const key of ['Cookie', 'User-Agent', 'Referer', 'Origin', 'Accept', 'Accept-Language', 'Content-Type']) {
        const value = header(original.headers, key.toLowerCase());
        if (value) profile.headers[key] = value;
      }
      for (const key of ['query', 'interaction', 'claim']) {
        if (profile[key] && profile[key].params) delete profile[key].params.h5st;
      }
      pack.activities[mode] = profile;
      const attemptKeys = mode === 'finance' ? {finance:'JD_JR_CHECKIN_ATTEMPT_V1',financeDouble:'JD_JR_DOUBLE_SIGN_ATTEMPT_V1'} :
        {[mode]:mode === 'jxzy' ? 'JXZY_CHECKIN_ATTEMPT_V1' : 'JD_CHECKIN_TEST_ATTEMPT_' + mode};
      for (const name of Object.keys(attemptKeys)) {
        let attempt;
        try { attempt = JSON.parse($persistentStore.read(attemptKeys[name]) || 'null'); } catch (_) { fail('青龙领取记录损坏，请先检查本机记录；未同步'); }
        if (attempt && attempt.pin === credential.pin) pack.attempts[name] = attempt;
      }
    }
    if (!Object.keys(pack.activities).length) fail('尚无可同步的独立活动请求记录，请开启对应获取开关、进入活动页面后再同步');
    return pack;
  }
  async function syncActivities(token, pack) {
    const name = 'LAZING_JD_ACTIVITY_V1';
    const envs = rows(await request('get', '/envs?searchValue=' + name, undefined, token));
    const matches = [];
    for (const item of envs.filter(x => x.name === name)) {
      let value;
      try { value = JSON.parse(item.value); } catch (_) { fail('青龙活动凭据变量损坏，请先在面板整理；未修改'); }
      if (!value || value.version !== 1 || !value.pin) fail('青龙活动凭据变量版本不符，请先在面板整理；未修改');
      if (value.pin === pack.pin) matches.push(item);
    }
    if (matches.length > 1) fail('青龙中有同账号的多条活动凭据，请先在面板整理；未修改');
    const target = matches[0];
    if (target) {
      // Keep older activities when one capture switch was temporarily off. NAS attempt records are separate.
      const old = JSON.parse(target.value);
      pack.activities = Object.assign({}, old.activities || {}, pack.activities);
      pack.attempts = Object.assign({}, old.attempts || {}, pack.attempts);
      const value = JSON.stringify(pack);
      if (value !== target.value) {
        const body = {id: idOf(target), name, value, remarks: target.remarks || 'Loon 独立活动凭据'};
        if (target.labels !== undefined) body.labels = target.labels;
        await request('put', '/envs', body, token);
      }
    } else await request('post', '/envs', [{name, value: JSON.stringify(pack), remarks: 'Loon 独立活动凭据'}], token);
    const labels = {scratch:'每日刮卡', blindbox:'PLUS盲盒', jxzy:'京喜自营', finance:'金融签到＋双签'};
    result.activities = Object.keys(pack.activities).filter(x => labels[x]).map(x => labels[x]);
    return '活动凭据已同步：' + result.activities.join('、') + (target && Number(target.status) === 1 ? '；活动变量仍处于禁用状态' : '') + '。未触发签到。';
  }
  try {
    if (capture) { captureCredential(); return; }
    config = settings(typeof $argument === 'undefined' ? null : $argument);
    const automatic = Object.prototype.hasOwnProperty.call(config, 'autoSync');
    if (automatic && config.autoSync !== true) return;
    const action = automatic ? '同步京东凭据' : config.action;
    result.action = action;
    if (action === '最近接入结果') {
      const last = read('LAST_RESULT_V1', null);
      console.log('[青龙接入] ' + (last ? JSON.stringify(last) : '暂无接入记录'));
      return;
    }
    if (action === '最近凭据获取结果') {
      const last = read('CAPTURE_LAST_V1', null);
      console.log('[青龙凭据获取] ' + (last ? JSON.stringify(last) : '暂无获取记录，请开启获取开关并进入对应活动页面'));
      return;
    }
    if (!['检查连接', '同步京东凭据', '同步活动凭据', '列出任务', '执行指定任务'].includes(action)) fail('请选择青龙接入操作');
    config.base = baseUrl(config.qlUrl);
    const clientId = String(config.clientId || '').trim(), secret = String(config.clientSecret || '').trim();
    if (!clientId || !secret) fail('请在插件参数中填写 Client ID 和 Client Secret');
    if (['同步京东凭据', '同步活动凭据', '执行指定任务'].includes(action)) takeLock();
    const pack = action === '同步活动凭据' || action === '同步京东凭据' && config.syncActivities === true ? activityPack() : null;
    const auth = await request('get', '/auth/token?client_id=' + encodeURIComponent(clientId) + '&client_secret=' + encodeURIComponent(secret));
    if (!auth || typeof auth.token !== 'string' || !auth.token) fail('青龙未返回有效授权令牌');
    const token = auth.token;
    if (action === '检查连接') {
      await request('get', '/envs?searchValue=JD_COOKIE', undefined, token);
      const list = await tasks(token);
      result.taskCount = list.length;
      result.message = '青龙连接及环境变量、定时任务读取权限正常，当前查到 ' + list.length + ' 个任务。未执行任务。';
    } else if (action === '同步京东凭据' || action === '同步活动凭据') {
      result.message = await sync(token);
      if (pack) {
        // Cookie and activity writes cannot be transactional in OpenAPI; report a partial update explicitly.
        try { result.message += '\n' + await syncActivities(token, pack); }
        catch (e) { fail('青龙登录凭据已同步，但活动凭据同步失败：' + (e.message || '请查看面板') + '；未触发任务，请核对后再同步'); }
      }
    }
    else if (action === '列出任务') {
      const list = await tasks(token);
      result.tasks = list.map(x => ({id: idOf(x), name: String(x.name || '').slice(0, 160), disabled: !!x.isDisabled}));
      result.message = list.length ? '任务 ID 和名称已输出到本次日志，可填写到插件的任务 ID 参数。' : '青龙尚无任务，需要先添加选定的活动脚本。';
    } else {
      const text = String(config.taskIds || '').trim();
      if (!/^\d+$/.test(text)) fail('请先填写一个指定任务的数字 ID');
      const ids = [Number(text)];
      if (!Number.isSafeInteger(ids[0]) || ids[0] < 1) fail('任务 ID 须为正整数');
      const list = await tasks(token);
      for (const id of ids) {
        const task = list.find(x => Number(x.id === undefined ? x._id : x.id) === id);
        if (!task) fail('指定任务不存在，未提交执行');
        if (Number(task.isDisabled) === 1 || Number(task.status) === 2) fail('指定任务已禁用，未提交执行；请先在青龙面板确认');
        if ([0, 3].includes(Number(task.status))) fail('指定任务正在运行或排队，未重复触发');
      }
      await request('put', '/crons/run', ids, token);
      result.taskIds = ids;
      result.message = '青龙已接收指定任务的执行请求。手机无需等待；实际签到和奖励结果请查看青龙任务日志或通知。';
    }
    result.status = 'success';
  } catch (error) {
    result.status = 'failed';
    // Only our own fixed diagnostic messages are allowed in logs; never log API payloads/errors.
    result.message = error && typeof error.message === 'string' && /^(青龙|入口|尚无|HTTP|无法连接|另一次|请|指定)/.test(error.message)
      ? error.message : '青龙接入处理失败，请检查参数和面板状态；未自动重试';
  } finally {
    if (lock) {
      try { const current = read('LOCK_V1', null); if (current && current.owner === lock.owner) write('LOCK_V1', null); } catch (_) {}
    }
    if (!capture && result.status) {
      result.finishedAt = Date.now();
      let previous;
      try { previous = read('LAST_RESULT_V1', null); write('LAST_RESULT_V1', result); } catch (_) { result.status = 'failed'; result.message = '青龙接入本地结果保存失败，请查看日志'; }
      console.log('[青龙接入] ' + JSON.stringify(result));
      const automatic = config && Object.prototype.hasOwnProperty.call(config, 'autoSync');
      const changed = !previous || previous.status !== result.status || previous.message !== result.message;
      if ((!automatic || changed) && typeof $notification !== 'undefined') $notification.post('青龙接入', result.status === 'success' ? '操作完成' : '操作失败', result.message);
    } else if (capture && result.status === 'failed') console.log('[青龙接入] 凭据保存失败，请查看本地记录');
    $done({});
  }
})();
