// JD splash 2026-11-07.2. Expire the start response and notify.
(function () {
  'use strict';
  const MAX_BODY=2*1024*1024;
  const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  function notice(title,text){try{$notification.post('京东开屏',title,text);}catch(_){}}
  function apiFrom(req){
    if(!/^https:\/\/api\.m\.jd\.com\/(?:client\.action|api)(?:\?|$)/i.test(String(req.url||'')))return null;
    const q=String(req.url||'').split('?')[1]||'',values=[];
    for(const p of q.split('&')){const i=p.indexOf('=');if(i>=0&&p.slice(0,i)==='functionId')try{values.push(decodeURIComponent(p.slice(i+1)));}catch(_){}}
    return values.length===1&&values[0]==='start'?'start':null;
  }
  function dateValue(v){
    if(typeof v!=='string')return null;const m=/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(v);if(!m)return null;
    const [y,mo,d,h,mi,se]=m.slice(1).map(Number);if(y<1900||y>9999||mo<1||mo>12||d<1||h>23||mi>59||se>59)return null;
    const t=Date.UTC(y,mo-1,d,h,mi,se),c=new Date(t);return c.getUTCFullYear()===y&&c.getUTCMonth()===mo-1&&c.getUTCDate()===d?t:null;
  }
  function expire(doc){
    if(!obj(doc)||!['0',0].includes(doc.code)||!Array.isArray(doc.images))return 0;
    const pending=[],stack=[{a:doc.images,d:0}];let n=0;
    while(stack.length){const {a,d}=stack.pop();for(const v of a){if(++n>500)return 0;if(Array.isArray(v)){if(d>=3)return 0;stack.push({a:v,d:d+1});continue;}if(!obj(v))continue;const begin=dateValue(v.onlineTime),end=dateValue(v.referralsTime);if(begin===null||end===null||begin>end)continue;if(v.onlineTime!=='2000-01-01 00:00:00'||v.referralsTime!=='2000-01-02 00:00:00')pending.push(v);}}
    for(const v of pending){v.onlineTime='2000-01-01 00:00:00';v.referralsTime='2000-01-02 00:00:00';}return pending.length;
  }
  let result={};
  try{
    if(typeof $request==='undefined'||typeof $response==='undefined'||!apiFrom($request))return;
    let changed=0;
    if(Number($response.status||$response.statusCode)===200){
      const body=$response.body;
      if(typeof body==='string'&&body.length&&body.length<=MAX_BODY){
        let doc;
        try{doc=JSON.parse(body);}catch(_){}
        changed=expire(doc);
        if(changed)result={body:JSON.stringify(doc)};
      }
    }
    if(changed)notice('开屏配置已修改',changed+' 条广告日期已过期');
    else notice('start 已命中','本次未修改开屏配置');
  }catch(_){}
  finally{$done(result);}
})();
