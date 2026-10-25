// JD 16.0.0 static analysis: expire only complete splash material date pairs.
// No DNS rules, network requests, credential reads or persistent writes.
(function () {
  let result = {};
  try {
    const url = String($request.url || "");
    if (!/^https:\/\/api\.m\.jd\.com\/client\.action\?/i.test(url) ||
        !/[?&]functionId=start(?:&|$)/i.test(url) ||
        Number($response.status) !== 200 || typeof $response.body !== "string") {
      return $done({});
    }
    const body = $response.body;
    if (body.length > 2 * 1024 * 1024) return $done({});
    const data = JSON.parse(body);
    if (!data || Array.isArray(data) || (data.code !== "0" && data.code !== 0) ||
        !Array.isArray(data.images)) return $done({});

    const start = "2000-01-01 00:00:00";
    const end = "2000-01-02 00:00:00";
    let matched = 0, changed = 0;
    const stack = [{items: data.images, depth: 0}];
    while (stack.length) {
      const row = stack.pop();
      for (const item of row.items) {
        if (Array.isArray(item)) {
          if (row.depth >= 3) return $done({});
          stack.push({items: item, depth: row.depth + 1});
          continue;
        }
        if (!item || typeof item !== "object") continue;
        // Do not walk arbitrary objects, alter other timestamps, or invent dates.
        if (!Object.prototype.hasOwnProperty.call(item, "onlineTime") ||
            !Object.prototype.hasOwnProperty.call(item, "referralsTime")) continue;
        const from = dateValue(item.onlineTime), to = dateValue(item.referralsTime);
        if (from === null || to === null || from > to) continue;
        matched++;
        if (item.onlineTime === start && item.referralsTime === end) continue;
        item.onlineTime = start;
        item.referralsTime = end;
        changed++;
      }
    }
    if (changed) {
      result = {body: JSON.stringify(data)};
      console.log("[京东开屏] 已处理 " + changed + " 条配置：日期设为过期");
      try {
        $notification.post("京东开屏", "已处理 " + changed + " 条配置", "展示日期已设为过期");
      } catch (_) {}
    } else {
      console.log("[京东开屏] start 已命中：" +
        (matched ? "配置已经过期" : (data.images.length ? "日期格式未识别" : "本次没有广告配置")));
    }
  } catch (_) {
    console.log("[京东开屏] 响应无法解析，保留原响应");
  }
  $done(result);

  function dateValue(value) {
    if (typeof value !== "string") return null;
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);
    if (!m) return null;
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    const h = Number(m[4]), mi = Number(m[5]), s = Number(m[6]);
    if (y < 1900 || y > 9999 || mo < 1 || mo > 12 || d < 1 || h > 23 || mi > 59 || s > 59) return null;
    const t = Date.UTC(y, mo - 1, d, h, mi, s);
    const check = new Date(t);
    return check.getUTCFullYear() === y && check.getUTCMonth() === mo - 1 &&
      check.getUTCDate() === d ? t : null;
  }
})();
