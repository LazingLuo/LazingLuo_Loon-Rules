// Version 20261029-1; IPs are temporary AMDC candidates, not dedicated ad servers.
if (typeof $response !== "undefined") {
// Homepage splash fields observed in Taobao 10.68.0 static analysis.
// Static evidence: TBBootImageItemSelector.checkStartTimeAndEndTime:.
(function () {
  'use strict';
  const RESPONSE_PATTERN = new RegExp("^https:\\/\\/(?:acs\\.m\\.taobao\\.com|guide-acs\\.m\\.taobao\\.com|106\\.11\\.226\\.222|59\\.82\\.9\\.242|203\\.119\\.238\\.85|203\\.119\\.238\\.234)(?::443)?\\/(?:gw|h5)\\/(mtop\\.taobao\\.wireless\\.home\\.[a-z0-9_.]+)(?:\\/[0-9]+(?:\\.[0-9]+)*\\/?)?(?:\\?|$)");
  const KEY = 'TB_SPLASH_NOTIFY_CONFIG_V1';
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
    const match = RESPONSE_PATTERN.exec(url);
    if (!match) return;
    const host = (/^https:\/\/([^/?#]+)/.exec(url)||[])[1] || '';
    if (url.includes('#') || url.length > 20000) return;
    const raw = $response.body;
    if (typeof raw !== 'string' || raw.length > 4 * 1024 * 1024) return;
    const observed = read();
    observed.inspected = (Number(observed.inspected) || 0) + 1;
    observed.lastSeenAt = Date.now();
    observed.lastHost = host;
    observed.lastSeenApi = match[1].toLowerCase();
    observed.lastResult = raw.includes('topViewSplashSection') ? '找到开屏字段，正在检查条目' : '本条响应没有开屏字段';
    save(observed);
    if (!raw.includes('topViewSplashSection')) return;
    let prefix = '', suffix = '', doc;
    try { doc = JSON.parse(raw); }
    catch (_) {
      const wrapper = /^(\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*\(\s*)([\s\S]*?)(\s*\)\s*;?\s*)$/.exec(raw);
      if (!wrapper) { observed.lastResult='响应格式暂不能读取'; save(observed); return; }
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
    if (!sections) { observed.lastResult='找到开屏字段，结构暂不能处理'; save(observed); return; }
    const settings = typeof $argument === 'object' && $argument ? $argument : {};
    const enabled = settings.notify !== false && settings.notify !== 'false';
    const s = read();
    s.candidates = (Number(s.candidates) || 0) + 1;
    s.lastSeenAt = Date.now();
    s.lastApi = match[1].toLowerCase(); // Never store query, cookies, or response.
    s.lastResult = count ? '已改写 ' + count + ' 条开屏时间' : '开屏条目为空或时间已处理';
    if (count) {
      // Commit only after the entire bounded traversal has completed.
      result = { body: prefix + JSON.stringify(doc) + suffix };
      s.changed = (Number(s.changed) || 0) + 1;
      s.lastChangedAt = Date.now();
      console.log('[淘宝开屏配置] 已改写 ' + count + ' 条；开始时间 2099 年；接口 ' + s.lastApi);
      if (enabled) notify('已改写 ' + count + ' 条', '开始时间设为 2099 年\n' + s.lastApi);
    }
    save(s);
  } catch (_) {
    // A failed parse or bounded traversal leaves the original body untouched.
    const s=read(); s.lastResult='响应解析或保护检查失败，保留原文'; save(s);
    console.log('[淘宝开屏配置] '+s.lastResult);
  } finally { $done(result); }
})();

} else {
// 淘宝开屏处理与记录 20261029-1. Local-only; no outgoing requests.
// Rule source: FFDNS / Thelongdarkorg/loon-plugins, taobao_splash_ad_block.plugin.
// Source rule date: 2026-09-18; rechecked 2026-10-29. This is a selected adaptation.
// No HTTPDNS, tracking, Idlefish, general video, or general ad-service rules.
(function(){
  const KEY='TB_SPLASH_NOTIFY_STATS_V1';
  const rules=[
  {
    "id": "tao-splash",
    "kind": "api",
    "label": "tao_splash 开屏接口",
    "pattern": "^https:\\/\\/(?:acs\\.m\\.taobao\\.com|guide-acs\\.m\\.taobao\\.com|106\\.11\\.226\\.222|59\\.82\\.9\\.242|203\\.119\\.238\\.85|203\\.119\\.238\\.234)(?::443)?\\/(?:gw|h5)\\/mtop\\.etao\\.noah\\.query\\/[0-9]+(?:\\.[0-9]+)*\\/?\\?[^#]*tao_splash"
  },
  {
    "id": "home-splash",
    "kind": "api",
    "label": "专用开屏接口",
    "pattern": "^https:\\/\\/(?:acs\\.m\\.taobao\\.com|guide-acs\\.m\\.taobao\\.com|106\\.11\\.226\\.222|59\\.82\\.9\\.242|203\\.119\\.238\\.85|203\\.119\\.238\\.234)(?::443)?\\/(?:gw|h5)\\/mtop\\.taobao\\.wireless\\.home\\.splash\\.awesome\\.get(?:\\/[0-9]+(?:\\.[0-9]+)*\\/?)?(?:\\?|$)"
  },
  {
    "id": "heic-1",
    "kind": "asset",
    "label": "PNG 转 HEIC 素材特征",
    "pattern": "^https:\\/\\/heic\\.alicdn\\.com(?::443)?\\/imgextra\\/i\\d\\/[A-Za-z0-9_!]+-\\d+-tps-(?:720-1280|1080-1920|1125-1602|1125-1950|1242-2208)\\.png_\\d+x\\d*q\\d+\\.jpg_\\.heic(?:\\?[^#]*)?$"
  },
  {
    "id": "heic-2",
    "kind": "asset",
    "label": "JPEG 转 HEIC 素材特征",
    "pattern": "^https:\\/\\/heic\\.alicdn\\.com(?::443)?\\/imgextra\\/i\\d\\/[A-Za-z0-9_!]+-\\d+-tps-(?:720-1280|1080-1920|1125-1602|1125-1950|1242-2208)\\.jpg_\\d+x\\d*q\\d+\\.jpg_\\.heic(?:\\?[^#]*)?$"
  },
  {
    "id": "heic-3",
    "kind": "asset",
    "label": "竖屏 HEIC 素材特征",
    "pattern": "^https:\\/\\/heic\\.alicdn\\.com(?::443)?\\/imgextra\\/i\\d\\/\\d*\\/?[\\w!]+-\\d-(?:octopus|tps)-(?:720-1280|1080-1920|1125-1602|1125-1950|1242-2208)\\.(?:jpg|png)_(?:1\\d{3}|9\\d{2})x(?:\\d|1\\d{3}|9\\d{2})q[59]0(?:\\.[A-Za-z0-9_.-]+)*(?:\\?[^#]*)?$"
  },
  {
    "id": "webp",
    "kind": "asset",
    "label": "竖屏 WebP 素材特征",
    "pattern": "^(?:https:\\/\\/gw\\.alicdn\\.com(?::443)?|http:\\/\\/gw\\.alicdn\\.com(?::80)?)\\/imgextra\\/i\\d+\\/[^\\/?#]+_!!\\d+-\\d+-tps-(?:720-1280|1080-1920|1125-1602|1242-2208)\\.(?:jpg|png|jpeg)_[^\\/?#]+\\.webp(?:\\?[^#]*)?$"
  }
];
  let result={};
  const log=message=>console.log('[淘宝开屏通知] '+message);
  const stamp=time=>new Date(time+8*3600000).toISOString().slice(0,19).replace('T',' ');
  const interval=ms=>{
    if(ms<0)return '系统时间已调整';
    const seconds=Math.floor(ms/1000);
    if(seconds<60)return seconds+'秒';
    if(seconds<3600)return Math.floor(seconds/60)+'分'+seconds%60+'秒';
    if(seconds<86400)return Math.floor(seconds/3600)+'小时'+Math.floor(seconds%3600/60)+'分';
    return Math.floor(seconds/86400)+'天'+Math.floor(seconds%86400/3600)+'小时';
  };
  function empty(){return {version:1,total:0,day:'',today:0,lastAt:0,byRule:{},history:[]};}
  function read(){
    try{
      const s=JSON.parse($persistentStore.read(KEY)||'null');
      if(!s||s.version!==1||!Number.isSafeInteger(s.total)||s.total<0||!Number.isSafeInteger(s.today)||s.today<0||
        typeof s.day!=='string'||!Number.isFinite(s.lastAt)||s.lastAt<0||!s.byRule||typeof s.byRule!=='object'||Array.isArray(s.byRule)||!Array.isArray(s.history))return empty();
      return s;
    }catch(_){return empty();}
  }
  function tell(subtitle,body){
    try{$notification.post('淘宝开屏处理',subtitle,body);}catch(_){log('系统通知未发送，拦截结果保持生效。');}
  }
  try{
    if(typeof $request==='undefined'){
      if(typeof $argument!=='string'||$argument!=='stats')return;
      const s=read(),day=stamp(Date.now()).slice(0,10);
      const lines=['今日 '+(s.day===day?s.today:0)+' 次；累计 '+s.total+' 次。'];
      if(!s.total)lines.push('暂无命中记录。');
      for(const r of rules){const hit=s.byRule[r.id];if(hit&&Number.isSafeInteger(hit.count)&&hit.count>0&&Number.isFinite(hit.lastAt))lines.push(r.label+'：'+hit.count+'次；最近 '+stamp(hit.lastAt));}
      if(s.history.length){lines.push('最近命中（北京时间）：');for(const item of s.history.slice(-10).reverse()){
        const r=rules.find(r=>r.id===item.id);if(r&&Number.isFinite(item.time)&&item.time>0)lines.push(stamp(item.time)+' '+r.label);
      }}
      try {
        const c=JSON.parse($persistentStore.read('TB_SPLASH_NOTIFY_CONFIG_V1')||'null');
        if(c&&c.version===1){
          lines.push('首页配置响应 '+(Number(c.inspected)||0)+' 次；时间改写 '+(Number(c.changed)||0)+' 次。');
          if(c.lastResult)lines.push('最近配置检查：'+c.lastResult);
          if(c.lastHost)lines.push('配置连接：'+c.lastHost);
          if(c.lastSeenAt)lines.push('检查时间：'+stamp(c.lastSeenAt));
          if(c.lastChangedAt)lines.push('最近改写：'+stamp(c.lastChangedAt));
        }else lines.push('首页配置响应 0 次；时间改写 0 次。');
      }catch(_){lines.push('配置记录读取失败');}
      if(s.lastHost)lines.push('最近拦截连接：'+s.lastHost);
      lines.push('次数按请求计算；素材匹配单独计数。');
      const text=lines.join('\n');log(text);
      try{$notification.post('淘宝开屏命中统计','本机记录',text);}catch(_){log('统计通知未发送，请查看日志。');}
      return;
    }
    // Prevent a misconfigured Response rule from altering an unrelated response.
    if(typeof $response!=='undefined')return;
    let settings=typeof $argument==='object'&&$argument&&!Array.isArray($argument)?$argument:{};
    if(typeof $argument==='string'&&$argument.trim().startsWith('{'))settings=JSON.parse($argument);
    const enabled=(v,fallback)=>v===undefined?fallback:v===true||v==='true';
    const url=String($request.url||''),method=String($request.method||'GET').toUpperCase();
    if(url.length>20000||url.includes('#'))return;
    const rule=rules.find(r=>(r.kind==='api'?['GET','POST']:['GET','HEAD']).includes(method)&&new RegExp(r.pattern).test(url));
    if(!rule||rule.kind==='asset'&&!enabled(settings.assets,true))return;
    // Same local empty-dictionary behavior as the selected upstream reject-dict rules.
    result={response:{status:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:'{}'}};
    const now=Date.now(),s=read(),day=stamp(now).slice(0,10),old=s.byRule[rule.id];
    const previous=old&&Number.isFinite(old.lastAt)&&old.lastAt>0?old.lastAt:0;
    const count=old&&Number.isSafeInteger(old.count)&&old.count>=0?old.count:0;
    s.total++;s.today=s.day===day?s.today+1:1;s.day=day;s.lastAt=now;s.lastHost=(/^https?:\/\/([^/?#]+)/.exec(url)||[])[1]||'';
    s.byRule[rule.id]={count:count+1,lastAt:now};
    s.history.push({id:rule.id,time:now});s.history=s.history.slice(-50);
    let saved=false;
    try{saved=$persistentStore.write(JSON.stringify(s),KEY)===true;}catch(_){}
    const elapsed=previous?'距上次同规则命中 '+interval(now-previous):'本规则首次记录';
    const title=rule.kind==='api'?'开屏接口已拦截':'素材特征已拦截';
    const lines=[rule.label,stamp(now)+'（北京时间）',elapsed,
      saved?'今日共 '+s.today+' 次；累计 '+s.total+' 次。':'统计未保存，本次仍已返回空响应。'];
    if(rule.kind==='asset')lines.push('按URL特征匹配。');
    log(title+'；'+lines.join('；'));
    if(enabled(settings.notify,true))tell(title,lines.join('\n'));
  }catch(_){log('本次处理异常；已生成的拦截响应保持不变，未输出请求内容。');}
  finally{$done(result);}
})();


}
