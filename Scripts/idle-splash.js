// 闲鱼 7.28.70 开屏验证版。只处理两个已核对的开屏接口。
// 2026-10-25.1。关闭插件停止后续改写；已写入 App 的配置由后续原始响应更新。
(function () {
  var result = {}, messages = [];
  var hasOwn = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  var isObject = function (v) { return v !== null && typeof v === "object" && !Array.isArray(v); };
  try {
    if (typeof $request === "undefined" || typeof $response === "undefined") return $done({});
    var route = /^https:\/\/acs\.m\.goofish\.com\/gw\/(mtop\.taobao\.idlecommerce\.splash\.(?:async\.)?ads)\/(2\.0|1\.0)\/?(?:\?|$)/i.exec($request.url || "");
    if (!route) return $done({});
    var api = route[1].toLowerCase(), main = api === "mtop.taobao.idlecommerce.splash.ads";
    if (route[2] !== (main ? "2.0" : "1.0")) return $done({});
    var status = $response.status === undefined ? $response.statusCode : $response.status;
    if (status !== undefined && !/^(?:HTTP\/\S+\s+)?200(?:\s|$)/.test(String(status))) return $done({});
    var body = $response.body;
    if (typeof body !== "string" || body.length > 2 * 1024 * 1024) return $done({});
    var obj = JSON.parse(body);
    if (!isObject(obj) || obj.api !== api || !Array.isArray(obj.ret) ||
        !obj.ret.some(function (v) { return typeof v === "string" && v.indexOf("SUCCESS::") === 0; }) ||
        !isObject(obj.data) || (obj.v !== undefined && obj.v !== route[2])) return $done({});
    var data = obj.data;
    // 陌生结构不猜字段；已知容器类型错误时整条放行。
    if ((hasOwn(data, "adMap") && !isObject(data.adMap)) ||
        (hasOwn(data, "dspList") && !Array.isArray(data.dspList)) ||
        (hasOwn(data, "realTimeAd") && data.realTimeAd !== null && !isObject(data.realTimeAd))) return $done({});
    if (!hasOwn(data, "adMap") && !hasOwn(data, "dspList") &&
        !hasOwn(data, "realTimeAd") && !hasOwn(data, "hotStartInterval")) return $done({});

    if (isObject(data.adMap) && Object.keys(data.adMap).length) {
      data.adMap = {};
      messages.push("已清空广告列表");
    }
    if (isObject(data.realTimeAd)) {
      // IPA 的 FishSplashAdResponseData 将此字段声明为 Optional<RealTimeAd>。
      data.realTimeAd = null;
      messages.push("已移除实时广告");
    }
    if (Array.isArray(data.dspList) && data.dspList.length) {
      data.dspList = [];
      messages.push("已清空广告来源");
    }
    if (main) {
      // 主响应的列表用于替换客户端配置。缺省列表会保留默认值/旧值，因此补成空列表。
      if (!hasOwn(data, "adMap")) { data.adMap = {}; messages.push("已补空广告列表"); }
      if (!hasOwn(data, "dspList")) { data.dspList = []; messages.push("已补空广告来源"); }
      // 单位为秒，约十年；小于 32 位有符号整数上限。保持已有数字/字符串类型。
      // 后台停留时间达不到该间隔时，普通热启动入口不会触发 loadAd。
      var interval = data.hotStartInterval;
      if (interval === undefined || typeof interval === "string" || typeof interval === "number") {
        var value = typeof interval === "number" ? 315360000 : "315360000";
        if (interval !== value) { data.hotStartInterval = value; messages.push("已延长热启动间隔"); }
      }
    }
    if (messages.length) result.body = JSON.stringify(obj);
    console.log("[闲鱼开屏] " + (messages.length ? messages.join("；") : "本次保持原样") + "；" + api);
    try {
      $notification.post("闲鱼开屏", main ? "开屏配置接口" : "开屏异步接口",
        messages.length ? messages.join("；") : "本次没有需要修改的内容");
    } catch (_) { console.log("[闲鱼开屏] 通知发送失败"); }
  } catch (_) { console.log("[闲鱼开屏] 解析失败，原样放行"); }
  $done(result);
})();
