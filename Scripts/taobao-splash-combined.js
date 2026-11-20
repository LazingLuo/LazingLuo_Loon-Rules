(() => {
  const result = {};
  const key = "LAZING_TAOBAO_SPLASH_ASSET_PATHS_V1";
  const week = 7 * 86400000;
  const now = Date.now();
  const own = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);
  const object = v => v !== null && typeof v === "object" && !Array.isArray(v);
  const cdn = /^https?:\/\/((?:gw|heic|img|video|cloudvideo)\.alicdn\.com)(?::(?:80|443))?(\/[^?#\s\\]+\.(?:png|jpe?g|webp|heic|avif|mp4|m3u8|webm))(?=[?#]|$)/i;
  const gateway = /^https:\/\/(?:acs\.m\.taobao\.com|guide-acs\.m\.taobao\.com|h5api\.m\.taobao\.com|acs\.m\.tmall\.com)(?::443)?\/(?:gw|h5)\/mtop\.taobao\.wireless\.home\.(?:newface\.(?:awesome|stream)\.(?:get|newget)|awesome\.(?:get|update|recommend|homepage\.recommend)|refresh|splash\.awesome\.get)(?:\/\d+(?:\.\d+)*)?\/?(?:\?|$)/i;
  const orange = /^https?:\/\/(?:orange-dc\.m\.taobao\.com(?::(?:80|443))?\/api\/config(?:[/?#]|$)|dorangesource\.alicdn\.com(?::(?:80|443))?\/)/i;

  function pathOf(url) {
    if (typeof url !== "string" || url.length > 4096) return null;
    const m = cdn.exec(url);
    return m && m[1].toLowerCase() + m[2];
  }

  function savedPaths() {
    try {
      const prior = JSON.parse($persistentStore.read(key) || "[]");
      if (!Array.isArray(prior)) return [];
      return prior.slice(-96).filter(r => Array.isArray(r) && pathOf("https://" + r[0]) === r[0] &&
        Number.isSafeInteger(r[1]) && r[1] > now && r[1] <= now + week);
    } catch (_) { return []; }
  }

  function savePaths(paths) {
    if (!paths.size) return;
    try {
      const records = new Map(savedPaths());
      for (const path of paths) {
        records.delete(path);
        records.set(path, now + week);
      }
      $persistentStore.write(JSON.stringify([...records].slice(-96)), key);
    } catch (_) {}
  }

  function readBody(body) {
    try { return { value: JSON.parse(body), prefix: "", suffix: "" }; }
    catch (_) {
      const m = /^(\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*\(\s*)([\s\S]*?)(\s*\)\s*;?\s*)$/.exec(body);
      if (!m) throw Error("not JSON");
      return { value: JSON.parse(m[2]), prefix: m[1], suffix: m[3] };
    }
  }

  function flag(value, enabled) {
    if (value === true || value === false) return enabled;
    if (value === "true" || value === "false") return String(enabled);
    if (value === 0 || value === 1) return Number(enabled);
    if (value === "0" || value === "1") return String(Number(enabled));
    return value;
  }

  function report(category, message) {
    console.log("[淘宝开屏] " + category + "：" + message);
    try { $notification.post("淘宝开屏", category, message); } catch (_) {}
  }

  try {
    if (typeof $request === "undefined" || typeof $argument === "undefined") return;
    const url = String($request.url || "");
    const mode = $argument;
    if (mode === "dedicated") {
      const main = /^https:\/\/(?:acs\.m\.taobao\.com|guide-acs\.m\.taobao\.com|h5api\.m\.taobao\.com|acs\.m\.tmall\.com)(?::443)?\/(?:gw|h5)\/mtop\.taobao\.wireless\.home\.splash\.awesome\.get(?:\/\d+(?:\.\d+)*)?\/?(?:\?|$)/.test(url);
      const legacy = !main && /^https:\/\/(?:acs\.m\.taobao\.com|guide-acs\.m\.taobao\.com)(?::443)?\/(?:gw|h5)\/mtop\.etao\.noah\.query\/\d+(?:\.\d+)*\/?\?[^#]*(?:[=&"%,])tao_splash(?:[&"%,]|$)/.test(url);
      if (main || legacy) {
        result.response = { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, body: "{}" };
        report("专用接口", main ? "已拦截开屏广告请求" : "已拦截旧版 tao_splash 请求");
      }
      return;
    }
    if (mode === "asset") {
      const candidate = pathOf(url);
      if (candidate && savedPaths().some(r => r[0] === candidate)) {
        result.response = { status: 204, headers: { "Cache-Control": "no-store" }, body: "" };
        report("素材", "已拦截开屏响应确认的" + (/\.(?:mp4|m3u8|webm)$/i.test(candidate) ? "视频" : "图片"));
      }
      return;
    }
    if (mode !== "home" && mode !== "orange") return;
    if (!(mode === "home" ? gateway : orange).test(url) || typeof $response === "undefined") return;
    const status = $response.status ?? $response.statusCode;
    if (status != null && !/^(?:HTTP\/\S+\s+)?200(?:\s|$)/.test(String(status))) return;
    const raw = $response.body;
    if (typeof raw !== "string" || raw.length > 4 * 1024 * 1024) return;
    const marker = mode === "home" ? "topViewSplashSection" : "ios_bootimage_client";
    if (!raw.includes(marker)) return;
    const parsed = readBody(raw);
    const paths = new Set();
    let changed = 0, visited = 0, decoded = 0;
    const start = 4070908800000, end = 4102444800000;
    const time = v => (typeof v === "number" || typeof v === "string" && /^\d{1,15}$/.test(v)) &&
      Number.isSafeInteger(Number(v)) && Number(v) > 0;
    const signed = x => Object.keys(x).some(k =>
      /^(?:sign|signature|configSign|contentSign|checksum|md5|sha256|digest|contentMd5|contentHash)$/i.test(k) && x[k] != null && x[k] !== "");
    function inspectUnchanged(v, depth) {
      if (++visited > 20000 || depth > 32) throw Error("limit");
      if (typeof v === "number" && !Number.isFinite(v) || Number.isInteger(v) && !Number.isSafeInteger(v)) throw Error("precision");
      if (v && typeof v === "object") Object.values(v).forEach(x => inspectUnchanged(x, depth + 1));
    }
    function set(target, k, v) {
      if (target[k] !== v) {
        target[k] = v;
        changed++;
      }
    }

    function walk(v, depth, inSplash, group, wire) {
      if (++visited > 20000 || depth > 32) throw Error("limit");
      if (typeof v === "number" && (!Number.isFinite(v) || (Number.isInteger(v) && !Number.isSafeInteger(v)))) throw Error("precision");
      if (typeof v === "string" && wire && /^\s*[\[{]/.test(v)) {
        if ((decoded += v.length) > 4 * 1024 * 1024) throw Error("decode limit");
        let inner;
        try { inner = JSON.parse(v); } catch (_) { return v; }
        const before = changed;
        inner = walk(inner, depth + 1, inSplash, group, false);
        return before === changed ? v : JSON.stringify(inner);
      }
      if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) v[i] = walk(v[i], depth + 1, inSplash, group, false);
        return v;
      }
      if (!object(v)) return v;
      if (mode === "orange" && signed(v)) {
        inspectUnchanged(v, depth);
        return v;
      }
      const groupFields = ["namespace", "nameSpace", "groupName", "namespaceName", "name"];
      if (mode === "orange") {
        for (const name of groupFields) {
          if (typeof v[name] !== "string") continue;
          if (name === "name" && !["content", "config", "configs", "value", "data"].some(k => own(v, k))) continue;
          group = v[name] === marker;
          break;
        }
        if (group) {
          for (const k of ["isColdStartEnabled", "isHotStartEnabled"]) {
            if (own(v, k)) set(v, k, flag(v[k], false));
          }
          const wait = v.backgroundWaitSeconds;
          if ((time(wait) || wait === 0 || wait === "0") && Number(wait) < 315360000) {
            set(v, "backgroundWaitSeconds", typeof wait === "string" ? "315360000" : 315360000);
          }
        }
      }
      if (mode === "home" && inSplash && time(v.gmtStartMs) && time(v.gmtEndMs) &&
          [v.imgUrl, v.videoUrl].some(x => typeof x === "string" && /^https?:\/\//i.test(x))) {
        for (const item of [v.imgUrl, v.videoUrl]) {
          const path = pathOf(item);
          if (path && paths.size < 96) paths.add(path);
        }
        for (const name of ["coldStart", "hotStart"]) {
          if (own(v, name)) set(v, name, flag(v[name], false));
        }
        set(v, "gmtStartMs", typeof v.gmtStartMs === "string" ? String(start) : start);
        set(v, "gmtEndMs", typeof v.gmtEndMs === "string" ? String(end) : end);
      }
      for (const k of Object.keys(v)) {
        const child = v[k];
        if (mode === "home" && k === marker) {
          let section = child;
          const encoded = typeof child === "string";
          if (encoded) {
            if ((decoded += child.length) > 4 * 1024 * 1024) throw Error("decode limit");
            try { section = JSON.parse(child); } catch (_) { continue; }
          }
          if (!object(section) || !Array.isArray(section.sections)) continue;
          const before = changed;
          walk(section.sections, depth + 1, true, false, false);
          if (encoded && changed !== before) v[k] = JSON.stringify(section);
        } else {
          const scoped = mode === "orange" && (k === marker || group && /^(?:content|config|configs|value|data|configData|configValue)$/.test(k));
          v[k] = walk(child, depth + 1, inSplash, scoped, scoped || typeof child === "string" && child.includes(marker));
        }
      }
      return v;
    }
    const encoded = typeof parsed.value === "string";
    const edited = walk(parsed.value, 0, false, false, encoded);
    if (mode === "home") savePaths(paths);
    if (changed) {
      result.body = parsed.prefix + JSON.stringify(edited) + parsed.suffix;
      report(mode === "home" ? "首页配置" : "Orange", mode === "home" ? "已改写首页开屏条目" : "已改写冷热启动配置");
    }
  } catch (_) {
  } finally {
    $done(result);
  }
})();
