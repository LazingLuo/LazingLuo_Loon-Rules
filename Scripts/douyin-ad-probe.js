// Douyin endpoint comparison 20261103-1. Local interception only; no outbound requests.
// Screen path reference (2018; current effectiveness unverified):
// https://gist.github.com/snail007/9bb81f201855334187f6211616df700e
// Ad-path reference: Minis / douyin-lite-plus (2026-10-06), MIT.
// https://github.com/k6nfmm7dbr-commits/douyin-lite/blob/main/surge/douyin-lite-plus.sgmodule
// Loon request API: $done() rejects; $done({}) passes; response mocks return locally.
(function () {
  const KEY='DOUYIN_AD_PROBE_V1';
  const labels={screen:'A 开屏接口',ad:'B 广告接口'};
  let result={};
  const log=s=>console.log('[抖音广告测试] '+s);
  const stamp=n=>new Date(n+8*3600000).toISOString().slice(0,19).replace('T',' ');
  const count=n=>Number.isSafeInteger(n)&&n>=0&&n<1000000000?n:0;
  function empty(){return {version:1,day:'',screen:{total:0,today:0,lastAt:0},ad:{total:0,today:0,lastAt:0}};}
  function read(){
    const out=empty();
    try{
      const raw=$persistentStore.read(KEY);
      if(typeof raw!=='string'||raw.length>4096)return out;
      const s=JSON.parse(raw);if(!s||s.version!==1)return out;
      out.day=typeof s.day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s.day)?s.day:'';
      for(const k of ['screen','ad']){
        const r=s[k]||{};out[k]={total:count(r.total),today:count(r.today),lastAt:Number.isSafeInteger(r.lastAt)&&r.lastAt>0&&r.lastAt<=8640000000000000-28800000?r.lastAt:0};
      }
    }catch(_){}
    return out;
  }
  function tell(subtitle,body){try{$notification.post('抖音广告规则命中',subtitle,body);}catch(_){}}
  function settings(){
    let a=typeof $argument==='undefined'?{}:$argument;
    if(typeof a==='string'){try{a=JSON.parse(a);}catch(_){a={};}}
    return a&&typeof a==='object'&&!Array.isArray(a)?a:{};
  }
  const enabled=v=>v===undefined||v===null||v===true||v==='true';
  try{
    if(typeof $request==='undefined'){
      if(typeof $argument==='undefined'||$argument!=='stats')return;
      const s=read(),today=stamp(Date.now()).slice(0,10);
      const lines=['次数按请求统计（北京时间）'];
      for(const k of ['screen','ad'])lines.push(labels[k]+'：今日 '+(s.day===today?s[k].today:0)+' 次，累计 '+s[k].total+' 次；最近 '+(s[k].lastAt?stamp(s[k].lastAt):'暂无'));
      const text=lines.join('\n');log(text);tell('命中统计',text);return;
    }
    if(typeof $response!=='undefined')return;
    const url=String($request.url||''),method=String($request.method||'GET').toUpperCase();
    if(url.length>20000||url.includes('#')||!['GET','POST','HEAD'].includes(method))return;
    // Anchored hosts and paths. Never match normal feed, media CDN or arbitrary IPs.
    let kind='',host='';
    if(/^https?:\/\/aweme\.snssdk\.com(?::(?:80|443))?\/aweme\/v1\/screen\/ad\//.test(url)){kind='screen';host='aweme.snssdk.com';}
    else {
      const m=/^https:\/\/(aweme\.snssdk\.com|api[0-9]*-normal-[a-z0-9-]+\.amemv\.com)(?::443)?\/api\/ad\//.exec(url);
      if(m){kind='ad';host=m[1];}
      else if(/^https:\/\/zlink\.ugsdk\.cn(?::443)?\/ad\//.test(url)){kind='ad';host='zlink.ugsdk.cn';}
    }
    if(!kind)return;
    const a=settings();if(!enabled(a[kind]))return;
    // Set the terminal result before optional storage and notifications.
    result=kind==='screen'?undefined:{response:{status:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:'{}'}};
    const now=Date.now(),day=stamp(now).slice(0,10),s=read();
    if(s.day!==day){s.day=day;s.screen.today=0;s.ad.today=0;}
    s[kind].total=count(s[kind].total+1);s[kind].today=count(s[kind].today+1);s[kind].lastAt=now;
    let saved=false;try{saved=$persistentStore.write(JSON.stringify(s),KEY)===true;}catch(_){}
    const action=kind==='screen'?'已拒绝请求':'已返回空 JSON';
    const text=stamp(now)+'\n'+host+'\n'+(saved?'今日 '+s[kind].today+' 次，累计 '+s[kind].total+' 次':'本次统计未保存');
    log(labels[kind]+'：'+action+'；'+text.replace(/\n/g,'；'));
    if(enabled(a.notify))tell(labels[kind]+'：'+action,text);
  }catch(_){log('记录未完成');}
  finally{if(result===undefined)$done();else $done(result);}
})();
