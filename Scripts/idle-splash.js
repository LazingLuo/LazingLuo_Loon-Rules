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
    if (hasAds) {
      obj.data.adMap = {};
      if (Object.prototype.hasOwnProperty.call(obj.data, "dspList")) obj.data.dspList = [];
      result = { body: JSON.stringify(obj) };
    }
    console.log("[闲鱼开屏] " + (hasAds ? "已清除广告" : "本次没有广告，原样放行") + "；" + obj.api);
    try {
      $notification.post(hasAds ? "闲鱼开屏：已清除广告" : "闲鱼开屏：本次没有广告",
        obj.api === "mtop.taobao.idlecommerce.splash.ads" ? "开屏配置接口" : "开屏异步接口",
        hasAds ? "已清空本次广告列表。" : "广告列表为空，已原样放行。");
    } catch (_) {
      console.log("[闲鱼开屏] 通知发送失败，请查看脚本日志。");
    }
  } catch (_) {
    console.log("[闲鱼开屏] 解析失败，原样放行");
  }
  $done(result);
})();
