(() => {
  const result = {};
  try {
    const url = typeof $request === "undefined" ? "" : $request.url;
    const match = /^https:\/\/api\.m\.jd\.com\/(?:api|client\.action)\?(?:[^&#]*&)*functionId=(basicConfig|welcomeHome)(?:&|$)/.exec(url);
    if (!match || typeof $response === "undefined" || Number($response.status ?? $response.statusCode) !== 200) return;
    const ids = url.split("?")[1].split("#")[0].split("&").filter(part => part.startsWith("functionId="));
    if (ids.length !== 1) return;
    const body = $response.body;
    if (typeof body !== "string" || body.length > 2 * 1024 * 1024 || !body.includes("degradeSplashAD")) return;
    const object = x => x !== null && typeof x === "object" && !Array.isArray(x);
    const doc = JSON.parse(body);
    if (!object(doc)) return;
    const source = match[1];
    let nodes = 0, changes = 0;
    const isNamed = (value, name, keys) => keys.some(key => value[key] === name);

    function walk(value, scoped, depth) {
      if (++nodes > 20000 || depth > 32) throw Error("limit");
      if (typeof value === "number" && (!Number.isFinite(value) || Number.isInteger(value) && !Number.isSafeInteger(value))) throw Error("precision");
      if (Array.isArray(value)) {
        value.forEach(child => walk(child, scoped, depth + 1));
        return;
      }
      if (!object(value)) return;
      if (source === "basicConfig") {
        const keys = ["spaceName", "namespace", "groupName"];
        if (keys.some(key => typeof value[key] === "string")) scoped = isNamed(value, "JDApp-home", keys);
      }
      for (const key of Object.keys(value)) {
        const child = value[key];
        if (scoped && key === "extSwitch" && typeof child === "string" && child.includes("degradeSplashAD")) {
          let config;
          try { config = JSON.parse(child); } catch (_) { continue; }
          walk(config, false, depth + 1);
          if (object(config) && typeof config.degradeSplashAD === "string" && config.degradeSplashAD.length) {
            config.degradeSplashAD = "";
            value[key] = JSON.stringify(config);
            changes++;
          }
        } else {
          const next = source === "welcomeHome" ? key === "appConfig" : scoped || key === "JDApp-home";
          walk(child, next, depth + 1);
        }
      }
    }

    walk(doc, false, 0);
    if (changes) {
      result.body = JSON.stringify(doc);
      try { $notification.post("京东开屏", source, "已置空 degradeSplashAD，交由京东检查本机设置。"); } catch (_) {}
    }
  } catch (_) {
  } finally {
    $done(result);
  }
})();
