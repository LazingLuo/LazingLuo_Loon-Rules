// JD splash 2026-11-07.1. Start expiry and local diagnostics.
(function () {
  'use strict';
  const KEY='LAZING_JD_SPLASH_DIAG_V1', APIS=['start','basicConfig','welcomeHome','searchBoxWord'];
  const MAX_BODY=2*1024*1024,MAX_STORE=192*1024;
  const sensitive=/cookie|token|secret|authorization|password|session|uuid|openudid|deviceid|latitude|longitude|traceid|requestid|userid|^(?:pin|pt_pin|pt_key|phone|mobile|address|sign|h5st)$/i;
  const flagNames=['degradeSplashAD','homePageSplashAd','requestStartMins','showStartMins','showTimesDaily','maxShowTimes'];
  const action=typeof $argument==='undefined'?undefined:$argument;
  let result={};
  const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const header=(h,k)=>{const n=Object.keys(h||{}).find(n=>n.toLowerCase()===k.toLowerCase());return n?String(h[n]):'';};
  const safeName=k=>/^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/.test(k)&&!sensitive.test(k);
  const id=v=>(typeof v==='string'||typeof v==='number')&&/^[A-Za-z0-9_-]{1,64}$/.test(String(v))?String(v):'';
  const ids=v=>(typeof v==='string'?v.split(','):Array.isArray(v)?v:[v]).slice(0,80).map(id).filter(Boolean);
  const empty=()=>({version:1,apis:{},materials:[],assets:{recorded:0,blocked:0,records:[],notices:[]}});
  function notice(title,text){try{$notification.post('京东开屏',title,text);}catch(_){}}
  function asset(u){
    if(typeof u!=='string'||u.length>4096)return null;
    const m=/^https?:\/\/([a-z0-9.-]+)(?::(?:443|80))?(\/[^?#]*)?(?:[?#].*)?$/i.exec(u);
    if(!m)return null;const host=m[1].toLowerCase(),path=m[2]||'/';
    if(!/^(?:[a-z0-9-]+\.)?360buyimg\.com$/.test(host)&&!['storage.jd.com','vod.300hu.com','jvod.300hu.com'].includes(host))return null;
    if(path.length>600||/[\x00-\x20\x7f]/.test(path))return null;
    const file=path.slice(path.lastIndexOf('/')+1),sid=/^([a-f0-9]{12,64})(?=[.!_]|$)/i.exec(file);
    return {url:'https://'+host+path,host,path,sid:sid?sid[1].toLowerCase():''};
  }
  function load(){
    const s=empty();try{
      const raw=$persistentStore.read(KEY);if(typeof raw!=='string'||raw.length>MAX_STORE)return s;
      const x=JSON.parse(raw);if(!obj(x)||x.version!==1||!obj(x.apis))return s;
      for(const f of APIS){const b=x.apis[f];if(!obj(b))continue;s.apis[f]={hits:count(b.hits),requests:count(b.requests),lastRequestAt:count(b.lastRequestAt,1e15),samples:Array.isArray(b.samples)?b.samples.filter(obj).slice(-3).map(x=>x.limited&&String(x.result).includes('没有开屏字段')?{...x,result:'旧版扫描未完成，尚未找到目标字段'}:x):[]};}
      if(Array.isArray(x.materials))for(const m of x.materials.slice(-80)){const a=asset(m?.url);if(!a||!['image','video','auxiliary'].includes(m.kind))continue;s.materials.push({at:count(m.at,1e15),groupId:id(m.groupId),field:safeName(m.field)?m.field:'url',kind:m.kind,...a});}
      if(obj(x.assets)){
        s.assets.recorded=count(x.assets.recorded);s.assets.blocked=count(x.assets.blocked);
        for(const r of (Array.isArray(x.assets.records)?x.assets.records:[]).slice(-30)){
          const a=asset(r?.url);if(!a)continue;s.assets.records.push({at:count(r.at,1e15),action:['blocked','candidate'].includes(r.action)?r.action:'candidate',reason:['known','size','portrait','video'].includes(r.reason)?r.reason:'portrait',size:/^\d{1,5}x\d{1,5}$/.test(r.size||'')?r.size:'',groupId:id(r.groupId),...a});
        }
        const ns=Array.isArray(x.assets.notices)?x.assets.notices:[x.assets.lastNotice];for(const n of ns.slice(-20))if(obj(n)&&typeof n.key==='string'&&n.key.length<=650&&Number.isSafeInteger(n.at))s.assets.notices.push({key:n.key,at:n.at});
      }
    }catch(_){}return s;
  }
  function count(v,max=1000000){return Number.isSafeInteger(v)&&v>0?Math.min(v,max):0;}
  function save(s){try{let raw=JSON.stringify(s);if(raw.length>MAX_STORE){for(const f of APIS){const b=s.apis[f];if(b)b.samples=b.samples.slice(-1);}s.assets.records=s.assets.records.slice(-10);s.materials=s.materials.slice(-30);raw=JSON.stringify(s);}return raw.length<=MAX_STORE&&$persistentStore.write(raw,KEY)!==false;}catch(_){return false;}}
  function bucket(s,f){return s.apis[f]||(s.apis[f]={hits:0,requests:0,lastRequestAt:0,samples:[]});}
  function apiFrom(req){
    if(!/^https:\/\/api\.m\.jd\.com\/(?:client\.action|api)(?:\?|$)/i.test(String(req.url||'')))return null;
    const q=String(req.url||'').split('?')[1]||'',values=[];
    for(const p of q.split('&')){const i=p.indexOf('=');if(i>=0&&p.slice(0,i)==='functionId')try{values.push(decodeURIComponent(p.slice(i+1)));}catch(_){}}
    return values.length===1&&values[0]==='start'?'start':null;
  }
  function flag(v){if(typeof v==='boolean')return v;if(typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e12)return v;if(typeof v==='string'&&/^(?:true|false|-?\d{1,12}(?:\.\d{1,3})?)$/.test(v))return v;}
  function dateValue(v){
    if(typeof v!=='string')return null;const m=/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(v);if(!m)return null;
    const [y,mo,d,h,mi,se]=m.slice(1).map(Number);if(y<1900||y>9999||mo<1||mo>12||d<1||h>23||mi>59||se>59)return null;
    const t=Date.UTC(y,mo-1,d,h,mi,se),c=new Date(t);return c.getUTCFullYear()===y&&c.getUTCMonth()===mo-1&&c.getUTCDate()===d?t:null;
  }
  function inspect(doc){
    const fields=[],structure=[],seenFields=new Set(),seenKeys=new Set(),visited=new WeakSet(),reasons=new Set();
    let targetedNodes=0,generalNodes=0,decodeCount=0,decoded=0,structureLimited=false;
    const target=k=>flagNames.includes(k)||['images','expireAds','extSwitch','appConfig','JDApp-home'].includes(k)||/splash|launch|start.?ad/i.test(k);
    function keep(path,name,value){const key=path+'|'+name;if(seenFields.has(key))return;if(fields.length>=80){reasons.add('字段记录上限');return;}seenFields.add(key);fields.push({path:path.slice(0,220),name,value});}
    function walk(v,path,depth,priority){
      const n=priority?++targetedNodes:++generalNodes;if(n>(priority?20000:8000)||depth>24){reasons.add(depth>24?'层级上限':priority?'目标分组扫描上限':'普通扫描上限');return;}
      if(typeof v==='string'){
        if(!/^\s*[\[{]/.test(v))return;
        if(decodeCount>=64||v.length>=1024*1024||decoded+v.length>1024*1024){reasons.add('配置字符串扫描上限');return;}
        try{const j=JSON.parse(v);decodeCount++;decoded+=v.length;walk(j,path+'{json}',depth+1,priority);}catch(_){}return;
      }
      if(!v||typeof v!=='object'||visited.has(v))return;visited.add(v);
      if(Array.isArray(v)){for(let i=0;i<v.length;i++){walk(v[i],path+'[]',depth+1,priority);if((priority?targetedNodes:generalNodes)>(priority?20000:8000))break;}return;}
      const names=Object.keys(v).filter(safeName).sort((a,b)=>Number(target(b))-Number(target(a)));
      for(const k of names){
        const p=(path?path+'.':'')+k,x=v[k];
        if((priority||target(k))&&!seenKeys.has(p)){if(structure.length<120){structure.push(p.slice(0,220));seenKeys.add(p);}else structureLimited=true;}
        if(['onlineTime','referralsTime'].includes(k)&&dateValue(x)!==null)keep(p,k,x);
        else if(k==='expireAds')keep(p,k,{ids:ids(x),type:typeof x,length:typeof x==='string'?x.length:undefined});
        else if(flagNames.includes(k)){const f=flag(x);keep(p,k,f===undefined?{type:typeof x,length:typeof x==='string'?x.length:undefined}:f);}
        else if(k==='extSwitch')keep(p,k,{type:typeof x,length:typeof x==='string'?x.length:undefined,keys:obj(x)?Object.keys(x).filter(safeName).slice(0,80):undefined});
        else if(k==='images'&&Array.isArray(x))keep(p,k,{groups:x.length});
        walk(x,p,depth+1,priority);if((priority?targetedNodes:generalNodes)>(priority?20000:8000))break;
      }
    }
    // Inspect known modules before the general walk, with an independent budget.
    const roots=[];
    for(const [v,prefix] of [[doc,''],[obj(doc)?doc.data:null,'data']])if(obj(v))for(const k of Object.keys(v).filter(safeName))if(target(k))roots.push([v[k],(prefix?prefix+'.':'')+k]);
    for(const [v,p] of roots){walk({[p.split('.').at(-1)]:v},p.includes('.')?p.slice(0,p.lastIndexOf('.')):'',0,true);if(targetedNodes>20000)break;}
    walk(doc,'',0,false);
    return {fields,structure,limited:reasons.size>0,structureLimited,jsonStringsDecoded:decodeCount,scan:{targetedNodes,generalNodes,targetedRoots:roots.length,limitReasons:[...reasons]}};
  }
  function materials(doc,s){
    if(!obj(doc)||!['0',0].includes(doc.code)||!Array.isArray(doc.images))return {items:[],limited:false};
    const items=[],stack=[{a:doc.images,d:0}];let n=0,limited=false;
    while(stack.length){const {a,d}=stack.pop();for(const v of a){if(++n>500){limited=true;break;}if(Array.isArray(v)){if(d>=3){limited=true;continue;}stack.push({a:v,d:d+1});continue;}if(!obj(v))continue;
      const groupId=id(v.groupId),m={groupId,onlineTime:dateValue(v.onlineTime)!==null?v.onlineTime:undefined,referralsTime:dateValue(v.referralsTime)!==null?v.referralsTime:undefined,resources:[]};
      for(const field of ['url','videoUrl','buttonImg','assemblyImg','linkVideoUrl','bindMpBannerVideoUrl']){const a=asset(v[field]);if(!a)continue;const kind=field==='url'?'image':field==='videoUrl'?'video':'auxiliary';const r={field,kind,...a};m.resources.push(r);const row={at:Date.now(),groupId,...r};s.materials=s.materials.filter(x=>x.url!==row.url||x.kind!==row.kind);s.materials.push(row);}
      if(groupId||m.resources.length||m.onlineTime||m.referralsTime)items.push(m);
    }if(n>500)break;}
    s.materials=s.materials.slice(-80);return {items:items.slice(0,40),limited:limited||items.length>40};
  }
  function expire(doc){
    if(!obj(doc)||!['0',0].includes(doc.code)||!Array.isArray(doc.images))return 0;
    const pending=[],stack=[{a:doc.images,d:0}];let n=0;
    while(stack.length){const {a,d}=stack.pop();for(const v of a){if(++n>500)return 0;if(Array.isArray(v)){if(d>=3)return 0;stack.push({a:v,d:d+1});continue;}if(!obj(v))continue;const begin=dateValue(v.onlineTime),end=dateValue(v.referralsTime);if(begin===null||end===null||begin>end)continue;if(v.onlineTime!=='2000-01-01 00:00:00'||v.referralsTime!=='2000-01-02 00:00:00')pending.push(v);}}
    for(const v of pending){v.onlineTime='2000-01-01 00:00:00';v.referralsTime='2000-01-02 00:00:00';}return pending.length;
  }
  try{
    if(typeof $request==='undefined'){
      if(action==='reset'){notice(save(empty())?'诊断记录已清空':'清空失败','');}
      else{const s=load();console.log('京东开屏诊断记录（分享本次运行日志即可）');console.log(JSON.stringify(s,null,2));notice('诊断记录已导出到日志',APIS.map(f=>f+'：请求 '+(s.apis[f]?.requests||0)+'，响应 '+(s.apis[f]?.hits||0)).join('\n')+'\n素材已处理 '+s.assets.blocked+' 次；分享本次运行日志即可');}return;
    }
    // Old cached image-script entries pass through without reading the response.
    if(action==='assets')return;
    const f=apiFrom($request);
    if(!f)return;
    const state=load(),b=bucket(state,f);
    if(typeof $response==='undefined'){b.requests=Math.min(b.requests+1,1000000);b.lastRequestAt=Date.now();save(state);return;}
    const raw=$response.body,status=Number($response.status||$response.statusCode),s={at:Date.now(),httpStatus:Number.isInteger(status)?status:0,bodyChars:typeof raw==='string'?raw.length:0,result:'',fields:[],structure:[],changed:0};
    let doc;if(typeof raw!=='string')s.result='响应为二进制或缺少正文';else if(!raw.length)s.result='响应为空';else if(raw.length>MAX_BODY)s.result='响应超过2MB，未扫描正文';else{try{doc=JSON.parse(raw);}catch(_){s.result='响应不是JSON';}}
    if(doc!==undefined){const found=inspect(doc);Object.assign(s,found);const code=obj(doc)?flag(doc.code):undefined;if(code!==undefined)s.businessCode=code;
      if(f==='start'&&status===200){const m=materials(doc,state);s.materials=m.items;if(m.limited){s.limited=true;s.scan.limitReasons.push('素材记录上限');}s.changed=expire(doc);if(s.changed)result={body:JSON.stringify(doc)};}
      s.result=s.fields.length||s.materials?.length?(s.limited?'找到相关字段；扫描未完成':'找到相关字段'):(s.limited?'扫描未完成，尚未找到目标字段':'已完成扫描，未找到目标字段');
    }
    while(JSON.stringify(s).length>20*1024&&(s.structure.length||s.materials?.length||s.fields.length)){s.limited=true;s.result='记录已截断，请查看保留的目标字段';if(s.structure.length)s.structure.pop();else if(s.materials?.length)s.materials.pop();else s.fields.pop();}
    b.hits=Math.min(b.hits+1,1000000);b.samples.push(s);b.samples=b.samples.slice(-3);const ok=save(state);
    console.log('[京东开屏] '+f+'：'+s.result+'；HTTP '+s.httpStatus+(ok?'':'；记录保存失败'));
    if(s.changed)notice('开屏配置已修改',s.changed+' 条广告日期已过期'+(ok?'':'；记录保存失败'));
    else if(f==='start')notice('start 已命中','本次未修改开屏配置'+(ok?'':'；记录保存失败'));
  }catch(_){console.log('[京东开屏] 诊断未完成，原处理结果保留');}
  finally{$done(result);}
})();

