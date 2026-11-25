'use strict';
const MT_MAP = {"k":"s","t":"t","x":"m","`":"i",",":"l","1":"e","?":"c","a":"h","9":"a","n":"n","U":"_","v":"o","u":"u","r":"r","l":"k","%":"p","g":"v","b":"b","@":"T","h":"I","f":"f","C":"d","D":"1",">":"7","_":"9","P":"3","$":"0","B":"4","Z":"6","7":"2","W":"8","E":"-","X":",","!":"y","p":"G","H":"S","I":"g","e":"q","d":"w","Y":"5","8":"x","c":"/","0":"A","Q":"F","(":"%","N":"=","=":"&","^":"?","M":"U","z":"P","q":".",".":"D","*":"C","O":"N","-":"z","A":"V","|":"M","G":"L","j":"O","m":"R","y":"E","R":"B","<":"K","J":"Y","K":"W","+":"H","F":"Q","T":"j","V":"Z","3":"X","s":"J"};
function mtDecode(value) {
  return Array.from(value).map(c => Object.prototype.hasOwnProperty.call(MT_MAP, c) ? MT_MAP[c] : c).join('');
}

const STORE = 'MT_3880_LINK_PROBE_V1';
const BASE = 'http://example.com/loon-meituan-3880/v1/';
const LX = /^https:\/\/lx0\.meituan\.com\/(?:\?[^#]*)?$/;
const BUSINESS = /^https:\/\/contents\.meituan\.com\/commerce\/(?:ad\/incentive\/getMultiTask|launch\/ad\/(?:getAdDependentInfo|batchGetAdDependentInfo))(?:\?[^#]*)?$/;
const LIFETIME = 90_000;
const CARD = /^点击(?:立即|立)得金币\s*3880$/;

const parse = raw => { try { return JSON.parse(raw || 'null'); } catch (_) { return null; } };
const id = value => /^(?!0$|-999$)[A-Za-z0-9_-]{1,128}$/.test(String(value ?? '')) ? String(value) : '';
const name = value => CARD.test(String(value || '').trim());

function validLink(value) {
  return typeof value === 'string' && value.length <= 8192 &&
    !/[\x00-\x20\x7f<>"`\\]/.test(value) && !/%(?![a-f0-9]{2})/i.test(value) &&
    /^(?:https:\/\/(?:(?:apps|itunes)\.apple\.com|(?:[a-z0-9-]+\.)*(?:taobao|tmall)\.com|(?:m\.)?tb\.cn)|itms-apps:\/\/(?:apps|itunes)\.apple\.com|(?:tbopen|taobao|tmall):\/\/[a-z0-9.-]+)(?=[/?#])[\s\S]+$/i.test(value);
}

function taskLink(row) {
  const values = [];
  for (const item of [row, row?.task_detail, row?.taskDetail]) {
    if (!item || typeof item !== 'object') continue;
    for (const field of ['task_url', 'taskUrl', 'iosDeeplink', 'iosUlink', 'iosJumpUrl', 'jumpUrl', 'deepLinkUrl', 'appStoreUrl']) {
      const value = item[field];
      const candidates = typeof value === 'string' ? [value] : [value?.iosDeeplink, value?.iosUlink, value?.ios];
      const url = candidates.find(validLink);
      if (url) values.push(url);
    }
  }
  const urls = [...new Set(values)];
  return urls.length === 1 ? urls[0] : '';
}

function observeTelemetry(raw, state, now) {
  const envelope = raw?.length <= 3_200_000 ? parse(raw) : null;
  const entries = Array.isArray(envelope) ? envelope : envelope ? [envelope] : [];
  state.lxAt = now;
  const events = [];
  for (const packet of entries.slice(0, 100)) {
    const account = id(packet?.uid);
    if (!account) continue;
    const value = packet.evs;
    const rows = typeof value === 'string' ?
      parse(packet.lx_dict === true || packet.lx_dict === 'true' ? mtDecode(value) : value) : value;
    if (!Array.isArray(rows)) continue;
    for (const event of rows.slice(0, 4000)) {
      const at = Math.floor(Number(event?.tm) || Number(event?.stm));
      if (at > now + 5000 || at < now - LIFETIME || !Number.isSafeInteger(at)) continue;
      events.push({event, at, account});
    }
  }
  events.sort((a, b) => a.at - b.at);
  for (const {event, at, account} of events) {
    if (account !== state.account) {
      if (at < (state.accountAt || 0)) continue;
      if (state.account) delete state.pending;
      state.account = account;
      delete state.slot;
      delete state.card;
      delete state.candidate;
      delete state.eventAt;
    }
    state.accountAt = Math.max(at, state.accountAt || 0);
    const lab = event.val_lab;
    if (!lab || typeof lab !== 'object') continue;
    const bid = event.val_bid || event.bid;
    if (!['b_game_c67pwsi1_mv', 'b_game_2i9s8tl2_mv', 'b_game_2i9s8tl2_mc', 'b_game_10sxkou5_mv'].includes(bid) ||
        at < (state.eventAt || 0)) continue;
    if (bid === 'b_game_c67pwsi1_mv') {
      const ad = id(lab.ad_id ?? lab.adId), req = id(lab.requestId);
      if (ad && req && (state.slot?.ad !== ad || state.slot?.req !== req)) {
        state.eventAt = at;
        state.slot = {ad, req, at};
        delete state.card;
        delete state.candidate;
      }
      continue;
    }
    const task = id(lab.task_id ?? lab.taskId);
    if (!task) continue;
    if ((bid === 'b_game_2i9s8tl2_mc' && name(lab.title || lab.custom?.title)) ||
        (bid === 'b_game_10sxkou5_mv' && Number(lab.reward_num) === 3880 && state.card?.task === task)) {
      state.eventAt = at;
      state.card = {task, at, closed: true};
      delete state.candidate;
      continue;
    }
    if (bid !== 'b_game_2i9s8tl2_mv' || !name(lab.title || lab.custom?.title) || state.card?.closed) continue;
    const link = taskLink(lab) || taskLink(lab.custom);
    if (state.card?.task && state.card.task !== task) delete state.candidate;
    state.eventAt = at;
    state.card = {task, at};
    if (link) state.candidate = {task, at, link};
    else useBusinessLink(state, now);
  }
}

function useBusinessLink(state, now) {
  const {slot, card, pending} = state;
  if (!slot || !card || card.closed || !pending || now - pending.at > LIFETIME ||
      now - card.at > LIFETIME || now - slot.at > LIFETIME) return;
  const links = [...new Set(pending.items.filter(item =>
    item.ad === slot.ad && item.req === slot.req && item.task === card.task).map(item => item.link))];
  if (links.length === 1) state.candidate = {task: card.task, at: pending.at, link: links[0]};
}

function observeBusiness(raw, state, now) {
  state.businessAt = now;
  if (!raw || raw.length > 2_000_000) return;
  let visited = 0;
  const items = [];
  function walk(row, depth) {
    if (!row || typeof row !== 'object' || depth > 12 || ++visited > 10000 || items.length >= 30) return;
    if (!Array.isArray(row) && name(row.title ?? row.taskTitle ?? row.task_name ?? row.taskName)) {
      const task = id(row.task_id ?? row.taskId);
      const ad = id(row.ad_id ?? row.adId);
      const req = id(row.requestId ?? row.request_id);
      const link = taskLink(row);
      if (task && ad && req && link) items.push({task, ad, req, link});
    }
    for (const child of Object.values(row)) walk(child, depth + 1);
  }
  walk(parse(raw), 0);
  if (!items.length) return;
  state.pending = {items, at: now};
  useBusinessLink(state, now);
}

function getResult(state, now) {
  const candidate = state.candidate;
  if (candidate && state.card?.task === candidate.task && !state.card.closed &&
      now - candidate.at >= 0 && now - candidate.at <= LIFETIME &&
      now - state.card.at <= LIFETIME && validLink(candidate.link)) return {code: 'READY', url: candidate.link};
  if (state.card?.closed && now - state.card.at <= LIFETIME) {
    return {code: 'NO_LINK', message: '这一轮已经点击或结算。等下一张任务卡出现后再试。'};
  }
  if (state.card && now - state.card.at <= LIFETIME) {
    return {code: 'NO_LINK', message: 'Loon 已看到 3880 任务，这轮暂未收到可确认的跳转地址。'};
  }
  if (state.lxAt && now - state.lxAt <= LIFETIME) {
    return {code: 'NO_LINK', message: 'Loon 已收到美团埋点。请打开 3880 金币任务卡，停留几秒再运行。'};
  }
  return {code: 'NO_LINK', message: '暂未看到美团任务。请确认 Loon 已连接，打开活动页并停留几秒。'};
}

function reply(value) {
  return {response: {status: 200, headers: {'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}, body: JSON.stringify({code: '', message: '', url: '', proof: '', ...value})}};
}

function serve(request, argument, state, now, save) {
  const setting = argument && typeof argument === 'object' ? argument.pairing : argument;
  const [key, proof] = String(setting || '').trim().split('|');
  const headers = request.headers || {};
  if (request.method !== 'GET' || !/^[a-f0-9]{64}$/.test(key || '') ||
      !/^[a-f0-9]{64}$/.test(proof || '') || Object.keys(headers).some(k => /^(origin|referer)$/i.test(k))) {
    return reply({code: 'UNAVAILABLE', message: '请确认使用同一个测试包的 Loon 插件和快捷指令。'});
  }
  if (request.url === BASE + 'probe') return reply({code: 'CONNECTED', proof});
  const keys = Object.keys(headers).filter(k => k.toLowerCase() === 'x-mt-3880-key');
  if (request.url !== BASE + 'link' || keys.length !== 1 || headers[keys[0]] !== key) return reply({code: 'UNAVAILABLE', message: '请确认使用同一个测试包的 Loon 插件和快捷指令。'});
  const result = getResult(state, now);
  if (result.code === 'READY') {
    delete state.candidate;
    delete state.pending;
    state.card.closed = true;
    if (!save(state)) return reply({code: 'NO_LINK', message: 'Loon 本机状态保存失败，请重新打开活动页。'});
  }
  return reply(result);
}

if (typeof module !== 'undefined') module.exports = {BASE, BUSINESS, LX, getResult, observeBusiness, observeTelemetry, serve, validLink};

if (typeof $done === 'function') {
  const now = Date.now();
  const state = parse($persistentStore.read(STORE)) || {};
  const save = value => $persistentStore.write(JSON.stringify(value), STORE);
  if (typeof $request === 'undefined') {
    const result = getResult(state, now);
    const content = (result.code === 'READY' ? '当前链接已就绪' : result.message) +
      '\n业务响应：' + (now - state.businessAt <= LIFETIME ? '已观察到' : '本轮未观察到');
    $done({title: '美团 3880 链接状态', content});
  } else if ($request.url === BASE + 'probe' || $request.url === BASE + 'link') {
    $done(serve($request, typeof $argument === 'undefined' ? '' : $argument, state, now, save));
  } else {
    try {
      const previous = getResult(state, now).code;
      if (LX.test($request.url)) observeTelemetry($request.body, state, now);
      else if (BUSINESS.test($request.url) && Number($response.status) === 200) observeBusiness($response.body, state, now);
      if (save(state) && previous !== 'READY' && getResult(state, now).code === 'READY') {
        $notification.post('美团 3880 直跳测试', '已看到当轮链接', '可运行配套快捷指令');
      }
    } catch (_) { console.log('[美团3880] 本次未能读取观察数据'); }
    $done({});
  }
}
