// Read-only response association; retain URL-local evidence, never modify traffic.
(function () {
  const body = typeof $response.body === 'string' ? $response.body : '';
  if (!body || body.length > 2 * 1024 * 1024) return $done({});
  const normalized = body.replace(/\\\//g,'/').replace(/\\u002[fF]/g,'/');
  const pattern = /https?:\/\/[^"'\s<>\\]+/ig;
  const refs=[]; let match;
  while (refs.length < 100 && (match=pattern.exec(normalized))) {
    if (!/(?:alicdn\.com|taobao\.com)\//i.test(match[0])) continue;
    if (!/\.(?:png|jpe?g|heic|avif|webp|gif|mp4)(?:[.!?/_-]|$)/i.test(match[0])) continue;
    refs.push({url:match[0],context:normalized.slice(Math.max(0,match.index-180),match.index+500)});
  }
  let api='';
  const apiMatch=$request.url.match(/\/h5\/([^/]+)\//i) || $request.url.match(/[?&]api=([^&]+)/i);
  if(apiMatch) api=apiMatch[1];
  const record={time:Date.now(),api:api,requestUrl:$request.url,bodyLength:body.length,refs:refs};
  try {
    let candidates=JSON.parse($persistentStore.read('tb_splash_candidate_ids_v1')||'[]');
    if(!Array.isArray(candidates)) candidates=[];
    const ids=candidates.filter(x=>normalized.indexOf(x.id)>=0).map(x=>x.id);
    const dimensions=/tps-1125-(?:2436|1602)/i.test(normalized);
    const strong=/splash|开屏/i.test(body);
    // Keep bounded references for retrospective matching after an image downloads.
    if(refs.length) {
      let recent=JSON.parse($persistentStore.read('tb_splash_recent_refs_v1')||'[]');
      if(!Array.isArray(recent)) recent=[];
      recent.unshift(record);recent=recent.slice(0,30);
      while(JSON.stringify(recent).length>700000 && recent.length>1) recent.pop();
      $persistentStore.write(JSON.stringify(recent),'tb_splash_recent_refs_v1');
    }
    if(ids.length||dimensions||strong) {
      const evidence=Object.assign({},record,{ids:ids,namedDimensions:dimensions,explicitSplash:strong,
        responseBody:body.slice(0,512*1024),bodyTruncated:body.length>512*1024});
      $persistentStore.write(JSON.stringify(evidence),'tb_splash_probe_last_v1');
      let history=JSON.parse($persistentStore.read('tb_splash_probe_history_v1')||'[]');
      if(!Array.isArray(history))history=[];
      history.unshift(Object.assign({},record,{ids:ids,namedDimensions:dimensions,explicitSplash:strong}));
      $persistentStore.write(JSON.stringify(history.slice(0,20)),'tb_splash_probe_history_v1');
      console.log('[淘宝配置候选] '+(api||$request.url)+' IDs='+ids.join(','));
      $notification.post('淘宝/天猫配置线索已保存',api||'接口名称未出现在URL中',ids.length?'素材ID：'+ids.join(','):'尺寸标记或开屏关键词命中');
    }
  } catch(e) { console.log('[淘宝配置探测] 保存失败：'+e); }
  $done({});
})();
