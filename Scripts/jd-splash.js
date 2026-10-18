// Loon: postpone only known display dates in the verified start response.
(function () {
  let result = {};
  try {
    const url = String($request.url || "");
    if (!/^https:\/\/api\.m\.jd\.com\/client\.action\?/i.test(url) ||
        !/[?&]functionId=start(?:&|$)/i.test(url) ||
        Number($response.status) !== 200 || typeof $response.body !== "string") {
      return $done({});
    }
    const data = JSON.parse($response.body);
    if (!data || (data.code !== "0" && data.code !== 0) ||
        !Array.isArray(data.images) ||
        !Object.prototype.hasOwnProperty.call(data, "showTimesDaily")) {
      return $done({});
    }
    const replacements = {
      onlineTime: "2099-01-01 00:00:00",
      referralsTime: "2099-12-31 23:59:59",
      startTimeStamp: Date.UTC(2098, 11, 31, 16, 0, 0),
      endTimeStamp: Date.UTC(2099, 11, 31, 15, 59, 59)
    };
    let changed = 0;
    function postpone(value) {
      if (Array.isArray(value)) { value.forEach(postpone); return; }
      if (!value || typeof value !== "object") return;
      for (const key of Object.keys(replacements)) {
        if (!Object.prototype.hasOwnProperty.call(value, key) ||
            !["string", "number"].includes(typeof value[key])) continue;
        const next = typeof value[key] === "string" ? String(replacements[key]) : replacements[key];
        if (value[key] !== next) { value[key] = next; changed++; }
      }
    }
    postpone(data.images);
    if (changed) {
      result = {body: JSON.stringify(data)};
      console.log("[京东开屏] start 已处理，" + changed + "个展示时间字段推迟至2099年");
      try {
        $notification.post("京东开屏 start 已处理", "展示时间已推迟至2099年",
          "已修改 " + changed + " 个时间字段，保留原素材和展示次数。");
      } catch (_) {
        console.log("[京东开屏] 通知发送失败，已保留响应修改");
      }
    }
  } catch (_) {
    console.log("[京东开屏] 响应不符合预期，保留原响应");
  }
  $done(result);
})();
