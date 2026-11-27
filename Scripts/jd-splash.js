// JD splash 2026-11-28.1.
(function () {
  'use strict';
  const MAX_BODY=2*1024*1024;
  const SHOW_MINS=1440;
  const MATERIAL_KEY='LAZING_JD_SPLASH_MATERIALS_V1';
  const MATERIAL_FIELDS=['url','videoUrl','linkVideoUrl','buttonImg','assemblyImg','guideEffect'];
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
  function collectAds(images,entries,depth=0){
    for(const value of images){
      if(++entries.visited>500)return false;
      if(Array.isArray(value)){
        if(depth>=3||!collectAds(value,entries,depth+1))return false;
      }else if(obj(value))entries.ads.push(value);
    }
    return true;
  }
  function materialPath(value){
    if(typeof value!=='string'||value.length>4096)return '';
    const match=/^(https?:)?\/\/([a-z0-9.-]+(?::\d+)?)(\/[^?#\s<>"]+)(?:[?#].*)?$/i.exec(value);
    return match?(match[1]||'https:')+'//'+match[2]+match[3]:'';
  }
  function saveMaterials(materials){
    if(!materials.length)return '';
    try{
      if($persistentStore.write(JSON.stringify({savedAt:new Date().toISOString(),materials}),MATERIAL_KEY)){
        return '已保存 '+materials.length+' 条素材路径';
      }
    }catch(_){}
    return '素材路径保存失败';
  }
  function showMaterials(){
    try{
      const record=JSON.parse($persistentStore.read(MATERIAL_KEY)||'null');
      if(record&&Array.isArray(record.materials)&&record.materials.length){
        console.log('最近一次保存 '+record.savedAt+'，共 '+record.materials.length+' 条');
        for(const item of record.materials)console.log(item.field+'  '+item.path);
        return;
      }
      console.log('尚未保存开屏素材路径');
    }catch(_){console.log('读取开屏素材路径失败');}
  }
  function rewrite(doc){
    if(!obj(doc)||!['0',0].includes(doc.code)||!Array.isArray(doc.images))return null;
    const entries={ads:[],visited:0};
    if(!collectAds(doc.images,entries)||!entries.ads.length)return null;
    const materials=new Map();
    let dates=0,durations=0;
    for(const ad of entries.ads){
      for(const field of MATERIAL_FIELDS){
        const path=materialPath(ad[field]);
        if(path)materials.set(field+' '+path,{field,path});
      }
      const begin=dateValue(ad.onlineTime),end=dateValue(ad.referralsTime);
      if(begin!==null&&end!==null&&begin<=end&&
         (ad.onlineTime!=='2000-01-01 00:00:00'||ad.referralsTime!=='2000-01-02 00:00:00')){
        ad.onlineTime='2000-01-01 00:00:00';
        ad.referralsTime='2000-01-02 00:00:00';
        dates++;
      }
      if(Number.isInteger(ad.time)&&ad.time>=0&&ad.time!==1){
        ad.time=1;
        durations++;
      }
    }
    // The app reads this value as an NSString on the response envelope.
    const usableGroup=doc.images.some(group=>Array.isArray(group)&&group.some(obj));
    const oldMins=typeof doc.showStartMins==='string'&&/^\d+$/.test(doc.showStartMins)?Number(doc.showStartMins):0;
    const showChanged=usableGroup&&(!Number.isFinite(oldMins)||oldMins<SHOW_MINS);
    if(showChanged)doc.showStartMins=String(SHOW_MINS);
    const notes=[];
    if(dates)notes.push(dates+' 条广告日期已过期');
    if(durations)notes.push(durations+' 条广告时长改为 1 秒');
    if(showChanged)notes.push('热开屏间隔改为 '+SHOW_MINS+' 分钟');
    return {notes,materials:Array.from(materials.values())};
  }
  let result={};
  try{
    if(typeof $request==='undefined'&&typeof $response==='undefined'){
      showMaterials();
      return;
    }
    if(typeof $request==='undefined'||typeof $response==='undefined'||!apiFrom($request))return;
    let doc,update;
    if(Number($response.status||$response.statusCode)===200){
      const body=$response.body;
      if(typeof body==='string'&&body.length&&body.length<=MAX_BODY){
        try{doc=JSON.parse(body);}catch(_){}
        update=rewrite(doc);
      }
    }
    const changes=update&&update.notes;
    if(changes&&changes.length)result={body:JSON.stringify(doc)};
    const saved=update&&saveMaterials(update.materials);
    const notes=changes&&changes.length?changes:['本次未修改开屏配置'];
    if(saved)notes.push(saved);
    notice(changes&&result.body?'开屏配置已修改':'start 已命中',notes.join('，'));
  }catch(_){}
  finally{$done(result);}
})();
