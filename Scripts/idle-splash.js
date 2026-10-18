// Loon response script. Only remove ads from the two verified splash APIs.
(function () {
  let result = {};
  try {
    const routes = {
      "mtop.taobao.idlecommerce.splash.ads": "2.0",
      "mtop.taobao.idlecommerce.splash.async.ads": "1.0"
    };
    const match = /^https:\/\/acs\.m\.goofish\.com\/gw\/(mtop\.taobao\.idlecommerce\.splash\.(?:async\.)?ads)\/([\d.]+)\/?(?:\?|$)/.exec($request.url);
    if (!match || routes[match[1]] !== match[2]) return $done({});
    const obj = JSON.parse($response.body);
    if (!obj || obj.api !== match[1] || !Array.isArray(obj.ret) ||
        !obj.ret.some(x => typeof x === "string" && x.indexOf("SUCCESS::") === 0) ||
        !obj.data || typeof obj.data !== "object" || Array.isArray(obj.data)) return $done({});
    const hasAds = obj.data.adMap && typeof obj.data.adMap === "object" &&
      Object.keys(obj.data.adMap).length > 0 ||
      Array.isArray(obj.data.dspList) && obj.data.dspList.length > 0;
    obj.data.adMap = {};
    if (Object.prototype.hasOwnProperty.call(obj.data, "dspList")) obj.data.dspList = [];
    result = { body: JSON.stringify(obj) };
    console.log("[闲鱼开屏] 已处理 " + obj.api);
    try {
      $notification.post(hasAds ? "闲鱼开屏已处理" : "闲鱼开屏规则已命中",
        obj.api === "mtop.taobao.idlecommerce.splash.ads" ? "开屏配置接口" : "开屏异步接口",
        hasAds ? "已清空本次响应中的广告列表。" : "本次响应未发现非空广告列表。");
    } catch (_) {
      console.log("[闲鱼开屏] 通知发送失败，已保留响应修改");
    }
  } catch (_) {
    console.log("[闲鱼开屏] 响应无法处理，保留原样");
  }
  $done(result);
})();
