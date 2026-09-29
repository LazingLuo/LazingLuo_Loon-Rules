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
    "00294659847e154d",
    "02584659847afb31",
    "0258465984d4b764",
    "0029465984635b2e",
    "0258465984541464",
    "14ce25646760e292"
  ];
  const learnedIds = readLearnedIds();
  const extras = String(($argument && $argument.extra_keywords) || "")
    .split(",").map(function (x) { return x.trim(); }).filter(Boolean);
  const exactTerms = unique(knownIds.concat(learnedIds, extras));
  const lower = body.toLowerCase();

  const exactHits = exactTerms.filter(function (term) {
    return lower.indexOf(term.toLowerCase()) !== -1;
  });
  const sizeHit = /1125\s*[xX*]\s*(?:2436|1602)/.test(body) ||
    /s1125x(?:2436|1602)_jfs/i.test(body);
  const imageHit = /(?:https?:\\?\/\\?\/)?(?:[a-z0-9-]+\.)?360buyimg\.com\//i.test(body);
  const cluePattern = /(?:splash|showtimes?|show_times?|countdown|duration|skip(?:time)?|swipe|slide|material(?:id|url)?|exposure|launchad|startupad|开屏|倒计时|上滑)/ig;
  const clueHits = unique((body.match(cluePattern) || []).map(function (x) {
    return x.toLowerCase();
  })).slice(0, 12);

  // A lone 360buyimg URL is common on the home page. Require a stronger link.
  if (!exactHits.length && !sizeHit && !(imageHit && clueHits.length)) return $done({});

  const urls = extractImageUrls(body).slice(0, 8);
  const functionId = getFunctionId($request.url, body);
  const reasons = [];
  if (exactHits.length) reasons.push("已知素材=" + exactHits.join(","));
  if (sizeHit) reasons.push("尺寸=1125x2436/1602");
  if (clueHits.length) reasons.push("字段=" + clueHits.join(","));

  const endpoint = functionId ? "functionId=" + functionId : shortUrl($request.url);
  const detail = reasons.join("；") + (urls.length ? "\n" + urls.join("\n") : "");
  console.log("[京东开屏配置探测] 命中 " + endpoint + "\n" + detail);

  if ((!$argument || $argument.notify !== false) && shouldNotify(endpoint + "|" + reasons.join("|"))) {
    try {
      $notification.post("京东疑似开屏配置", endpoint, truncate(detail, 900));
    } catch (error) {
      console.log("[京东开屏配置探测] 通知发送失败：" + error);
    }
  }
  $done({});

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

  function readLearnedIds() {
    if (typeof $persistentStore === "undefined") return [];
    try {
      const saved = JSON.parse($persistentStore.read("jd_splash_learned_ids_v1") || "[]");
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
