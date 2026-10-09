// Read-only probe: it never changes the response body or headers.
(function () {
  const PROBE_VERSION = 2;
  recheckCandidates();
  const body = typeof $response.body === "string" ? $response.body : "";
  if (!body) return $done({});

  const maxKb = positiveNumber($argument && $argument.max_body_kb, 2048);
  if (body.length > maxKb * 1024) {
    console.log("[京东开屏配置探测] 跳过过大响应：" + body.length + " bytes " + $request.url);
    return $done({});
  }

  const knownIds = [
    // Previously observed on a visibly displayed JD splash.
    "0258465984541464",
    // Confirmed by the 2026-09-30 start response.
    "0258465984fe4b7a",
    "02584659844678e3",
    "b949b365b5b64ee2c862d6404f7d28e7"
  ];
  const confirmedIds = readStoredIds("jd_splash_confirmed_ids_v1");
  const learnedIds = readStoredIds("jd_splash_learned_ids_v1");
  const extras = String(($argument && $argument.extra_keywords) || "")
    .split(",").map(function (x) { return x.trim(); }).filter(Boolean);
  const confirmedTerms = unique(knownIds.concat(confirmedIds, extras));
  const lower = body.toLowerCase();

  const exactHits = confirmedTerms.filter(function (term) {
    return lower.indexOf(term.toLowerCase()) !== -1;
  });
  const learnedHits = learnedIds.filter(function (term) {
    return lower.indexOf(term.toLowerCase()) !== -1;
  });
  const sizeHit = /1125\s*[xX*]\s*(?:2436|1602)/.test(body) ||
    /s1125x(?:2436|1602)_jfs/i.test(body);

  const cluePattern = /(?:splash|showtimes?|show_times?|countdown|duration|skip(?:time)?|swipe|slide|material(?:id|url)?|exposure|launchad|startupad|开屏|倒计时|上滑)/ig;
  const clueHits = unique((body.match(cluePattern) || []).map(function (x) {
    return x.toLowerCase();
  })).slice(0, 12);

  const functionId = getFunctionId($request.url, body);
  // start is handled and notified by the sanitizer to avoid duplicate alerts.
  if (functionId.toLowerCase() === "start") return $done({});
  // A landing-page source marker does not configure the splash container.
  const clueText = body.replace(/launchSource(?:=|%3d|\\u003d)splash/ig, "landingSource");
  const explicitSplash = /(?:splash|launchad|startupad|开屏)/i.test(clueText) ||
    /(?:\\?"pos_id\\?"\s*:\s*\\?"3976\\?")/i.test(body);
  const landingSource = /launchSource(?:=|%3d)splash/i.test(body);
  const allUrls = extractImageUrls(body);
  const materials = allUrls.map(function (url) {
    const m = url.match(/\/([0-9a-f]{16})\.(?:jpe?g|png|webp|avif|heic|qpng|gif)(?:[.?&#]|$)/i);
    return m ? {id: m[1].toLowerCase(), url: url} : null;
  }).filter(Boolean);
  const namingIds = unique(materials.map(function (m) { return m.id; }));
  const prefixIds = namingIds.filter(function (id) { return /^0258465984[0-9a-f]{6}$/.test(id); });
  // Generic 16-character names are archived silently, never promoted to confirmed IDs.
  if (namingIds.length) saveCandidate({
    time: Date.now(), functionId: functionId,
    endpoint: functionId ? "functionId=" + functionId : shortUrl($request.url),
    requestUrl: $request.url, method: $request.method || "", status: $response.status,
    bodyHash: simpleHash(body), bodyLength: body.length,
    materials: materials.slice(0, 100),
    fieldMatches: findFields(body, namingIds),
    excerpts: findExcerpts(body, prefixIds), landingSource: landingSource
  });
  if (!exactHits.length && !explicitSplash && !learnedHits.length && !sizeHit && !prefixIds.length) return $done({});

  const urls = allUrls.slice(0, 8);
  const reasons = [];
  if (exactHits.length) reasons.push("已知素材=" + exactHits.join(","));
  if (learnedHits.length) reasons.push("尺寸候选素材=" + learnedHits.join(","));
  if (prefixIds.length) reasons.push("文件名前缀候选=" + prefixIds.join(","));
  if (explicitSplash) reasons.push("开屏关键词候选（待核实）");
  if (landingSource) reasons.push("包含开屏跳转来源（不代表配置）");
  if (sizeHit) reasons.push("尺寸=1125x2436/1602");
  if (clueHits.length) reasons.push("字段=" + clueHits.join(","));

  const endpoint = functionId ? "functionId=" + functionId : shortUrl($request.url);
  const detail = reasons.join("；") + (urls.length ? "\n" + urls.join("\n") : "");
  console.log("[京东开屏配置探测] 命中 " + endpoint + "\n" + detail);
  const saved = saveEvidence({
    probeVersion: PROBE_VERSION, time: Date.now(), functionId: functionId, endpoint: endpoint,
    requestUrl: $request.url, method: $request.method || "", status: $response.status,
    reasons: reasons, confirmedIds: exactHits, candidateIds: unique(learnedHits.concat(prefixIds)), namingIds: namingIds.slice(0, 100),
    urls: extractImageUrls(body).slice(0, 40),
    bodyLength: body.length, bodyHash: simpleHash(body),
    fieldMatches: findFields(body, unique(exactHits.concat(learnedHits, prefixIds))),
    excerpts: findExcerpts(body, exactHits.concat(learnedHits))
  });

  if ((!$argument || $argument.notify !== false) && shouldNotify(endpoint + "|" + reasons.join("|"))) {
    try {
      $notification.post("京东配置线索" + (saved ? "（已保存）" : "（保存失败）"), endpoint, truncate(detail, 900));
    } catch (error) {
      console.log("[京东开屏配置探测] 通知发送失败：" + error);
    }
  }
  $done({});

  function saveEvidence(record, responseText) {
    if (responseText === undefined) responseText = body;
    if (typeof $persistentStore === "undefined") return false;
    try {
      let history = [];
      try { history = JSON.parse($persistentStore.read("jd_splash_probe_history_v1") || "[]"); } catch (_) {}
      if (!Array.isArray(history)) history = [];
      // Keep the latest occurrence of each identical endpoint/body, even when notifications are muted.
      history = history.filter(function (item) {
        return item && !(item.endpoint === record.endpoint && item.bodyHash === record.bodyHash);
      });
      history.unshift(record);
      history = history.slice(0, 20);
      const historyOK = $persistentStore.write(JSON.stringify(history), "jd_splash_probe_history_v1");
      const latest = Object.assign({}, record, {
        responseBody: responseText.slice(0, 512 * 1024),
        bodyTruncated: responseText.length > 512 * 1024
      });
      const latestOK = $persistentStore.write(JSON.stringify(latest), "jd_splash_probe_last_v1");
      return historyOK !== false && latestOK !== false;
    } catch (error) {
      console.log("[京东开屏配置探测] 保存证据失败：" + error);
      return false;
    }
  }

  function findFields(text, ids) {
    const results = [];
    let nodes = 0;
    const marker = /launchSource=splash|splash|launchad|startupad|开屏|1125[x*](?:2436|1602)/i;
    function walk(value, path, depth, parent) {
      if (++nodes > 30000 || depth > 18 || results.length >= 30) return;
      if (typeof value === "string") {
        if (marker.test(value) || ids.some(function (id) { return value.toLowerCase().indexOf(id.toLowerCase()) !== -1; })) {
          results.push({path: path, value: truncate(value, 1000), nearby: parent ? truncate(JSON.stringify(parent), 2400) : ""});
        }
        // JD sometimes embeds another JSON document inside a string field.
        if (depth < 18 && /^[\[{]/.test(value.trim())) {
          try { walk(JSON.parse(value), path + "::<JSON>", depth + 1, null); } catch (_) {}
        }
      } else if (value && typeof value === "object") {
        Object.keys(value).forEach(function (key) {
          if (key === "pos_id" && String(value[key]) === "3976" && results.length < 30)
            results.push({path: path + "." + key, value: value[key]});
          walk(value[key], path + (Array.isArray(value) ? "[" + key + "]" : "." + key), depth + 1, value);
        });
      }
    }
    try { walk(JSON.parse(text), "$", 0); } catch (_) {}
    return results;
  }

  function findExcerpts(text, ids) {
    const offsets = [];
    ids.forEach(function (id) {
      const at = text.toLowerCase().indexOf(id.toLowerCase());
      if (at >= 0) offsets.push(at);
    });
    const pattern = /launchSource(?:=|%3d)splash|splash|launchad|startupad|开屏|1125[x*](?:2436|1602)/ig;
    let match;
    while (offsets.length < 12 && (match = pattern.exec(text))) offsets.push(match.index);
    return unique(offsets).slice(0, 12).map(function (at) {
      return {offset: at, text: text.slice(Math.max(0, at - 350), at + 850)};
    });
  }

  function extractImageUrls(text) {
    const normalized = text.replace(/\\\//g, "/").replace(/\\u002[fF]/g, "/")
      .replace(/&quot;|&#34;|&lt;|&gt;/ig, '"').replace(/&amp;/ig, "&");
    return unique(normalized.match(/https?:\/\/(?:[a-z0-9-]+\.)*360buyimg\.com\/[^"'\s<>\\]+/ig) || []);
  }

  function loadCandidates() {
    try {
      const rows = JSON.parse($persistentStore.read("jd_splash_probe_candidates_v2") || "[]");
      return Array.isArray(rows) ? rows.filter(function (r) {
        return r && Array.isArray(r.materials) && Date.now() - r.time < 7 * 86400000;
      }) : [];
    } catch (_) { return []; }
  }

  function saveCandidate(record) {
    if (typeof $persistentStore === "undefined") return;
    let rows = loadCandidates().filter(function (r) {
      return !(r.endpoint === record.endpoint && r.bodyHash === record.bodyHash);
    });
    rows.unshift(record);
    rows = rows.slice(0, 24);
    while (JSON.stringify(rows).length > 256 * 1024 && rows.length) rows.pop();
    $persistentStore.write(JSON.stringify(rows), "jd_splash_probe_candidates_v2");
  }

  // Run on the next API response after an image script learns an ID.
  // The image script itself is unchanged and cannot trigger this probe directly.
  function recheckCandidates() {
    if (typeof $persistentStore === "undefined") return;
    const ids = readStoredIds("jd_splash_learned_ids_v1").concat(readStoredIds("jd_splash_confirmed_ids_v1"));
    const rows = loadCandidates();
    let changed = false;
    rows.forEach(function (r) {
      const hits = unique(r.materials.map(function (m) { return m.id; }).filter(function (id) { return ids.indexOf(id) !== -1; }));
      const fresh = hits.filter(function (id) { return (r.linkedIds || []).indexOf(id) === -1; });
      if (!fresh.length) return;
      r.linkedIds = hits; changed = true;
      const record = Object.assign({}, r, {
        probeVersion: 2, time: Date.now(), originalTime: r.time, retrospective: true,
        confirmedIds: [], candidateIds: hits,
        reasons: ["新学习素材回查=" + fresh.join(","), "仅证明接口曾引用素材，尚未确认容器配置"],
        urls: r.materials.filter(function (m) { return hits.indexOf(m.id) !== -1; }).map(function (m) { return m.url; })
      });
      saveEvidence(record, "");
      console.log("[京东开屏配置探测] 素材回查命中 " + r.endpoint + " " + fresh.join(","));
      if ((!$argument || $argument.notify !== false) && shouldNotify("backlink|" + r.endpoint + "|" + fresh.join(","))) {
        try { $notification.post("京东素材引用回查（已保存）", r.endpoint, fresh.join(",") + "；尚未确认开屏容器配置"); } catch (_) {}
      }
    });
    if (changed) $persistentStore.write(JSON.stringify(rows), "jd_splash_probe_candidates_v2");
  }

  function getFunctionId(url, text) {
    const m1 = url.match(/[?&]functionId=([^&#]+)/i);
    if (m1) return safeDecode(m1[1]);
    const m2 = text.match(/["']functionId["']\s*:\s*["']([^"']+)/i);
    return m2 ? m2[1] : "";
  }

  function shortUrl(url) {
    const m = url.match(/^https?:\/\/[^/]+\/[^?]*/i);
    return m ? m[0] : url.slice(0, 160);
  }

  function shouldNotify(signature) {
    const minutes = positiveNumber($argument && $argument.dedup_minutes, 30);
    if (!minutes || typeof $persistentStore === "undefined") return true;
    const key = "jd_splash_probe_" + simpleHash(signature);
    const now = Date.now();
    const last = Number($persistentStore.read(key) || 0);
    if (last && now - last < minutes * 60000) return false;
    $persistentStore.write(String(now), key);
    return true;
  }

  function readStoredIds(key) {
    if (typeof $persistentStore === "undefined") return [];
    try {
      const saved = JSON.parse($persistentStore.read(key) || "[]");
      return Array.isArray(saved) ? saved.filter(function (item) {
        return typeof item === "string" && /^[0-9a-f]{12,64}$/i.test(item);
      }).slice(0, 50) : [];
    } catch (_) {
      return [];
    }
  }

  function simpleHash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  function unique(items) {
    return items.filter(function (item, index) { return items.indexOf(item) === index; });
  }

  function truncate(text, length) {
    return text.length > length ? text.slice(0, length) + "…" : text;
  }

  function positiveNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
  }

  function safeDecode(value) {
    try { return decodeURIComponent(value); } catch (_) { return value; }
  }
})();
