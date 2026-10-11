// Read-only probe v3: bounded inventory, decoded references, optional diagnostic snippets.
(function () {
  const VERSION = 3;
  const arg = typeof $argument === 'object' && $argument ? $argument : {};
  const notify = arg.notify !== false && arg.notify !== 'false';
  const diagnostic = arg.diagnostic === true || arg.diagnostic === 'true';
  const url = $request.url || '';
  const endpoint = url.split('?')[0]; // Do not persist request query tokens.
  const apiMatch = url.match(/\/(?:h5|gw)\/([^/?]+)\//i) || url.match(/[?&]api=([^&]+)/i);
  const headers = $response.headers || $response.header || {};
  const ctKey = Object.keys(headers).find(k => k.toLowerCase() === 'content-type');
  const body = $response.body;
  const record = {probeVersion:VERSION,time:Date.now(),api:apiMatch ? apiMatch[1] : '',
    requestUrl:endpoint,status:$response.status,contentType:ctKey ? String(headers[ctKey]) : '',
    bodyType:typeof body,bodyLength:typeof body === 'string' ? body.length : 0};
  try {
    if (Number(record.status) !== 200) return inventory('http_status');
    if (/^(?:image|audio|video)\//i.test(record.contentType)) return inventory('media_body');
    if (typeof body !== 'string') return inventory('non_text_body');
    if (!body.length) return inventory('empty_body');
    if (body.length > 2 * 1024 * 1024) return inventory('body_over_2m');
    const normalized = normalize(body);
    const refs = [];
    const seen = new Set();
    // Accept absolute and protocol-relative Ali CDN references, even without a file extension.
    const pattern = /(?:https?:)?\/\/(?:[a-z0-9-]+\.)*(?:alicdn|taobao|tmall)\.com(?::\d+)?\/[^"'\s<>\\]*/ig;
    let match;
    while (refs.length < 100 && (match = pattern.exec(normalized))) {
      const link = match[0].replace(/&amp;/g,'&');
      if (seen.has(link)) continue;
      seen.add(link);
      refs.push({url:link.slice(0,2048),context:normalized.slice(Math.max(0,match.index-120),match.index+400)});
    }
    // IDs also allow relative/split URL fields to be associated after the asset downloads.
    const materialIds = Array.from(new Set(normalized.match(/O1CN[0-9A-Za-z]+_!![0-9]+-[0-9]+/g) || [])).slice(0,300);
    const candidates = readArray('tb_splash_candidate_ids_v1');
    const ids = candidates.filter(x => typeof x.id === 'string' && normalized.indexOf(x.id) >= 0).map(x => x.id);
    const dimensions = /tps-1125-(?:2436|1602)/i.test(normalized);
    const strong = /splash|开屏/i.test(normalized.replace(/launchSource=splash/ig,''));
    record.refCount = refs.length;
    record.materialCount = materialIds.length;
    record.matchedIds = ids;
    record.ids = ids; // Preserve the existing history field for exported records.
    record.namedDimensions = dimensions;
    record.explicitSplash = strong;
    inventory(ids.length || dimensions || strong ? 'clue_found' : refs.length || materialIds.length ? 'references_only' : 'no_reference');
    const reference = Object.assign({},record,{refs:refs,materialIds:materialIds});
    if (refs.length || materialIds.length) {
      writeRows('tb_splash_recent_refs_v1',reference,40,800000);
    }
    if (diagnostic) {
      // Limited response snippets only. No request bodies, Cookies or Authorization headers.
      writeRows('tb_splash_diagnostic_history_v1',Object.assign({},reference,{
        responseHead:body.slice(0,8192),responseTail:body.length > 8192 ? body.slice(-4096) : '',
        bodyTruncated:body.length > 12288
      }),20,500000);
    }
    if (ids.length || dimensions || strong) {
      const evidence = Object.assign({},reference,{responseBody:body.slice(0,128*1024),bodyTruncated:body.length>128*1024});
      write('tb_splash_probe_last_v1',evidence);
      writeRows('tb_splash_probe_history_v1',reference,20,500000);
      console.log('[淘宝配置候选] '+(record.api || endpoint)+' IDs='+ids.join(','));
      if (notify) $notification.post('淘宝/天猫配置线索已保存',record.api || endpoint,
        ids.length ? '素材引用：'+ids.join(',') : '尺寸或开屏关键词候选，尚未确认开屏配置');
    }
  } catch (_) {
    console.log('[淘宝配置探测] 解析或本地保存失败，请查看覆盖记录');
  } finally { $done({}); }

  function inventory(reason) {
    record.reason = reason;
    writeRows('tb_splash_probe_inventory_v1',Object.assign({},record),150,150000);
  }
  function readArray(key) {
    try { const rows=JSON.parse($persistentStore.read(key)||'[]'); return Array.isArray(rows)?rows:[]; }
    catch (_) { return []; }
  }
  function write(key,value) {
    if (!$persistentStore.write(JSON.stringify(value),key)) console.log('[淘宝配置探测] 本地写入失败：'+key);
  }
  function writeRows(key,row,count,budget) {
    const rows=readArray(key); rows.unshift(row); rows.splice(count);
    while (JSON.stringify(rows).length>budget && rows.length>1) rows.pop();
    write(key,rows);
  }
  function normalize(text) {
    for(let i=0;i<3;i++) {
      const previous=text;
      text=text.replace(/\\u([0-9a-f]{4})/ig,(_,hex)=>String.fromCharCode(parseInt(hex,16)))
        .replace(/\\\//g,'/').replace(/\\\\/g,'\\').replace(/&(?:quot|#34);/g,'"').replace(/&amp;/g,'&');
      // Decode URL escapes without discarding a whole response on malformed percent sequences.
      text=text.replace(/(?:%[0-9a-f]{2})+/ig,s=>{try{return decodeURIComponent(s);}catch(_){return s;}});
      if (text===previous) break;
    }
    return text;
  }
})();
