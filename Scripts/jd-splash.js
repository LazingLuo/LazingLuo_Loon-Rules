// Loon: change only verified splash fields in JD's start response.
(function () {
  let result = {};
  try {
    const url = $request.url;
    if (!/^https:\/\/api\.m\.jd\.com\/client\.action\?/.test(url) ||
        !/[?&]functionId=start(?:&|$)/.test(url)) return $done({});
    if ($response.status !== 200 || typeof $response.body !== "string") return $done({});
    const obj = JSON.parse($response.body);
    if (!obj || (obj.code !== "0" && obj.code !== 0) ||
        !Array.isArray(obj.images) ||
        !Object.prototype.hasOwnProperty.call(obj, "showTimesDaily")) return $done({});
    const originalImageCount = obj.images.reduce((count, group) =>
      count + (Array.isArray(group) ? group.length : 1), 0);
    const originalDaily = obj.showTimesDaily;
    const changed = obj.images.length > 0 || Number(originalDaily) !== 0;
    if (changed) {
      obj.images = [];
      obj.showTimesDaily = typeof originalDaily === "string" ? "0" : 0;
      result = {body: JSON.stringify(obj)};
    }
    const detail = `原始素材 ${originalImageCount} 张，每日次数 ${originalDaily}；` +
      (changed ? "已清空" : "原本已为空，无需修改");
    console.log("[京东开屏] start 已触发：" + detail);
    try {
      $notification.post("京东 start 规则已触发", "开屏配置检查完成", detail);
    } catch (error) {
      console.log("[京东开屏] 通知发送失败：" + error);
    }
  } catch (_) {
    console.log("[京东开屏] 正文不可解析，保留原响应");
  }
  $done(result);
})();
