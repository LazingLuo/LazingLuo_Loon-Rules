// 淘宝开屏命中通知 v0.1.0. Local-only request interception and counters.
// Rule source: FFDNS / Thelongdarkorg/loon-plugins, taobao_splash_ad_block.plugin.
// Source rule date: 2026-09-18; retrieved 2026-10-21. This is a selected adaptation.
// No HTTPDNS, tracking, Idlefish, general video, or general ad-service rules.
(function(){
  const KEY='TB_SPLASH_NOTIFY_STATS_V1';
  const rules=[
  {
    "id": "tao-splash",
    "kind": "api",
    "label": "tao_splash 开屏接口",
    "pattern": "^https:\\/\\/acs\\.m\\.taobao\\.com(?::443)?\\/gw\\/mtop\\.etao\\.noah\\.query\\/.+tao_splash"
  },
  {
    "id": "home-splash",
    "kind": "api",
    "label": "首页 splash 开屏接口",
    "pattern": "^https:\\/\\/guide-acs\\.m\\.taobao\\.com(?::443)?\\/gw\\/mtop\\.taobao\\.wireless\\.home\\.splash\\.awesome\\.get(?:\\/[0-9]+(?:\\.[0-9]+)*\\/?)?(?:\\?|$)"
  },
  {
    "id": "heic-1",
    "kind": "asset",
    "label": "HEIC 开屏素材候选 1",
    "pattern": "^https:\\/\\/heic\\.alicdn\\.com(?::443)?\\/imgextra\\/i\\d\\/[A-Za-z0-9_!]+-\\d+-tps-\\d+-\\d+\\.png_\\d+x\\d*q\\d+\\.jpg_\\.heic$"
  },
  {
    "id": "heic-2",
    "kind": "asset",
    "label": "HEIC 开屏素材候选 2",
    "pattern": "^https:\\/\\/heic\\.alicdn\\.com(?::443)?\\/imgextra\\/i\\d\\/[A-Za-z0-9_!]+-\\d+-tps-\\d+-\\d+\\.jpg_\\d+x\\d*q\\d+\\.jpg_\\.heic$"
  },
  {
    "id": "heic-3",
    "kind": "asset",
    "label": "HEIC 开屏素材候选 3",
    "pattern": "^https:\\/\\/heic\\.alicdn\\.com(?::443)?\\/imgextra\\/i\\d\\/\\d*\\/?[\\w!]+-\\d-(?:octopus|tps)-(?:1080|1125)-\\d{4}\\.(?:jpg|png)_(?:1\\d{3}|9\\d{2})x(?:\\d|1\\d{3}|9\\d{2})q[59]0"
  },
  {
    "id": "webp",
    "kind": "asset",
    "label": "竖屏 WebP 素材候选",
    "pattern": "^(?:https:\\/\\/gw\\.alicdn\\.com(?::443)?|http:\\/\\/gw\\.alicdn\\.com(?::80)?)\\/imgextra\\/i\\d+\\/[^\\/]+_!!\\d+-\\d+-tps-(720-1280|1080-1920|1125-1602|1242-2208)\\.(jpg|png|jpeg)_[^\\/]+\\.webp"
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
    try{$notification.post('淘宝开屏规则命中',subtitle,body);}catch(_){log('系统通知未发送，拦截结果保持生效。');}
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
      lines.push('次数按网络请求计算，同一次启动可能命中多次。');
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
    s.total++;s.today=s.day===day?s.today+1:1;s.day=day;s.lastAt=now;
    s.byRule[rule.id]={count:count+1,lastAt:now};
    s.history.push({id:rule.id,time:now});s.history=s.history.slice(-50);
    let saved=false;
    try{saved=$persistentStore.write(JSON.stringify(s),KEY)===true;}catch(_){}
    const elapsed=previous?'距上次同规则命中 '+interval(now-previous):'本规则首次记录';
    const title=rule.kind==='api'?'开屏接口已拦截':'素材规则已拦截（待核实）';
    const lines=[rule.label,stamp(now)+'（北京时间）',elapsed,
      saved?'今日共 '+s.today+' 次；累计 '+s.total+' 次。':'统计未保存，本次仍已返回空响应。'];
    if(rule.kind==='asset')lines.push('素材特征匹配，尚未确认就是本次开屏图片。');
    log(title+'；'+lines.join('；'));
    if(enabled(settings.notify,true))tell(title,lines.join('\n'));
  }catch(_){log('本次处理异常；已生成的拦截响应保持不变，未输出请求内容。');}
  finally{$done(result);}
})();
