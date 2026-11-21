// 肯德基 6.39.0 开屏配置。保留原响应的其他字段。
(() => {
  const endpoint = /^https?:\/\/res\.kfc\.com\.cn\/CRM\/kfcad\/(?:apphome6\/apphome_[A-Za-z0-9_-]+|bootStrap\/rn\/bootStrap_[A-Za-z0-9_-]+)\.json(?:\?|$)/;
  const slots = [
    "bootStrapAd",
    "registBootStrapAd",
    "activeBootStrapAd",
    "app6_bootStrapAd",
    "app6_activeBootStrapAd",
    "newhomepage_AIbootStrapAd",
    "newhomepage_AIregistBootStrapAd",
    "newhomepage_AIactiveBootStrapAd",
  ];

  const result = {};
  try {
    if (!endpoint.test($request.url) || Number($response.status) !== 200 ||
        typeof $response.body !== "string") return;

    const document = JSON.parse($response.body);
    let removed = false;
    for (const section of [document, document?.data]) {
      if (!section || typeof section !== "object" || Array.isArray(section)) continue;
      for (const slot of slots) {
        if (!Object.prototype.hasOwnProperty.call(section, slot)) continue;
        if (Array.isArray(section[slot])) {
          if (!section[slot].length) continue;
          section[slot] = [];
        } else {
          delete section[slot];
        }
        removed = true;
      }
    }

    if (removed) result.body = JSON.stringify(document);
  } catch (_) {
    // 无法解析的配置由客户端按原样处理。
  } finally {
    $done(result);
  }
})();
