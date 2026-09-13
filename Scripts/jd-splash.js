// Loon: modify only the verified JD start response.
(function () {
  let result = {};
  try {
    const url = $request.url;
    if (!/^https:\/\/api\.m\.jd\.com\/client\.action\?/.test(url) ||
        !/[?&]functionId=start(?:&|$)/.test(url)) return $done({});
    const obj = JSON.parse($response.body);
    if (!obj || (obj.code !== "0" && obj.code !== 0) ||
        !Array.isArray(obj.images) ||
        !Object.prototype.hasOwnProperty.call(obj, "showTimesDaily")) return $done({});
    obj.images = [];
    obj.showTimesDaily = typeof obj.showTimesDaily === "string" ? "0" : 0;
    result = {body: JSON.stringify(obj)};
    console.log("[京东开屏] 已清空 images，showTimesDaily=0");
  } catch (_) {
    console.log("[京东开屏] 正文不可解析，保留原响应");
  }
  $done(result);
})();
