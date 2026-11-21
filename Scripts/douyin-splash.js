// 抖音 41.2.0 开屏净化，20261121-1。
// 仅对专用开屏请求返回空 JSON。
(() => {
  const routes = [
    [/^https:\/\/(?:aweme\.snssdk\.com|api[0-9]*-normal-[a-z0-9-]+\.amemv\.com)(?::443)?\/api\/ad\/splash\/aweme\/v1[45]\/?(?:\?|$)/, "常规开屏"],
    [/^https:\/\/(?:aweme\.snssdk\.com|api[0-9]*-normal-[a-z0-9-]+\.amemv\.com)(?::443)?\/api\/ad\/splash\/realtime\/aweme\/v15\/?(?:\?|$)/, "实时开屏"],
    [/^https:\/\/(?:aweme\.snssdk\.com|api[0-9]*-normal-[a-z0-9-]+\.amemv\.com)(?::443)?\/api\/ad\/(?:splash\/stock\/realtime\/v1[45]|v1\/splash\/stock)\/?(?:\?|$)/, "开屏库存"],
    [/^https:\/\/(?:aweme\.snssdk\.com|api[0-9]*-normal-[a-z0-9-]+\.amemv\.com)(?::443)?\/api\/ad\/v16\/splash\/preload\/?(?:\?|$)/, "开屏预加载"],
  ];

  const url = typeof $request === "undefined" ? "" : ($request.url || "");
  const method = typeof $request === "undefined" ? "" : ($request.method || "GET").toUpperCase();
  const route = routes.find(([pattern]) => pattern.test(url));
  if (!route || !["GET", "POST", "HEAD"].includes(method)) {
    $done({});
    return;
  }

  try {
    const raw = typeof $argument === "undefined" ? {} : $argument;
    const settings = typeof raw === "string" ? JSON.parse(raw) : raw;
    const notify = settings && settings.notify;
    if (notify !== false && notify !== "false") {
      $notification.post("抖音开屏净化", route[1], "已返回空响应");
    }
  } catch (_) {
    // 通知失败时仍处理请求。
  }

  $done({
    response: {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
      body: method === "HEAD" ? "" : "{}",
    },
  });
})();
