// Read-only probe: it never changes the response body or headers.
(function () {
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
  const imageHit = /(?:https?:\\?\/\\?\/)?(?:[a-z0-9-]+\.)?360buyimg\.com\//i.test(body);
  const cluePattern = /(?:splash|showtimes?|show_times?|countdown|duration|skip(?:time)?|swipe|slide|material(?:id|url)?|exposure|launchad|startupad|开屏|倒计时|上滑)/ig;
  const clueHits = unique((body.match(cluePattern) || []).map(function (x) {
    return x.toLowerCase();
  })).slice(0, 12);

  const functionId = getFunctionId($request.url, body);
  // start is handled and notified by the sanitizer to avoid duplicate alerts.
  if (functionId.toLowerCase() === "start") return $done({});
  const explicitSplash = /launchSource(?:=|%3[dD])splash/i.test(body) ||
    /(?:\\?"pos_id\\?"\s*:\s*\\?"3976\\?")/i.test(body) ||
    /(?:splash|launchad|startupad|开屏)/i.test(body);
  // Learned IDs and dimensions are candidate evidence, not proof of a splash task.
  // Generic words such as material/duration alone do not trigger capture.
  if (!exactHits.length && !explicitSplash && !learnedHits.length && !sizeHit) return $done({});

  const urls = extractImageUrls(body).slice(0, 8);
  const reasons = [];
  if (exactHits.length) reasons.push("start确认素材=" + exactHits.join(","));
  if (learnedHits.length) reasons.push("尺寸候选素材=" + learnedHits.join(","));
  if (explicitSplash) reasons.push("明确开屏特征");
  if (sizeHit) reasons.push("尺寸=1125x2436/1602");
  if (clueHits.length) reasons.push("字段=" + clueHits.join(","));

  const endpoint = functionId ? "functionId=" + functionId : shortUrl($request.url);
  const detail = reasons.join("；") + (urls.length ? "\n" + urls.join("\n") : "");
  console.log("[京东开屏配置探测] 命中 " + endpoint + "\n" + detail);
  const saved = saveEvidence({
    time: Date.now(), functionId: functionId, endpoint: endpoint,
    requestUrl: $request.url, method: $request.method || "", status: $response.status,
    reasons: reasons, confirmedIds: exactHits, candidateIds: learnedHits,
    urls: extractImageUrls(body).slice(0, 40),
    bodyLength: body.length, bodyHash: simpleHash(body),
    fieldMatches: findFields(body, exactHits.concat(learnedHits)),
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

  function saveEvidence(record) {
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
        responseBody: body.slice(0, 512 * 1024),
        bodyTruncated: body.length > 512 * 1024
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
    function walk(value, path, depth) {
      if (++nodes > 30000 || depth > 18 || results.length >= 30) return;
      if (typeof value === "string") {
        if (marker.test(value) || ids.some(function (id) { return value.toLowerCase().indexOf(id.toLowerCase()) !== -1; })) {
          results.push({path: path, value: truncate(value, 1000)});
        }
        // JD sometimes embeds another JSON document inside a string field.
        if (depth < 18 && /^[\[{]/.test(value.trim())) {
          try { walk(JSON.parse(value), path + "::<JSON>", depth + 1); } catch (_) {}
        }
      } else if (value && typeof value === "object") {
        Object.keys(value).forEach(function (key) {
          if (key === "pos_id" && String(value[key]) === "3976" && results.length < 30)
            results.push({path: path + "." + key, value: value[key]});
          walk(value[key], path + (Array.isArray(value) ? "[" + key + "]" : "." + key), depth + 1);
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
    const normalized = text.replace(/\\\//g, "/").replace(/\\u002[fF]/g, "/");
    const matches = normalized.match(/https?:\/\/[^"'\s<>]+360buyimg\.com\/[^"'\s<>]+/ig) || [];
    return unique(matches.map(function (url) {
      return url.replace(/[},\]]+$/, "");
    }));
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
