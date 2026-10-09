// Loon: change only verified splash fields in JD's start response.
(function () {
  let result = {};
  try {
    const url = String($request.url || "");
    console.log("[京东开屏] start 脚本进入 v20261009.2；状态类型=" +
      typeof $response.status + "；状态=" + String($response.status) +
      "；正文类型=" + typeof $response.body);
    if (!/^https:\/\/api\.m\.jd\.com\/client\.action\?/i.test(url) ||
        !/[?&]functionId=start(?:&|$)/i.test(url)) {
      console.log("[京东开屏] 跳过：URL不符合start接口");
      return $done({});
    }
    if (Number($response.status) !== 200 || typeof $response.body !== "string") {
      console.log("[京东开屏] 跳过：状态非200或正文不是文本");
      return $done({});
    }
    // Save the received body before parsing or modifying any configuration.
    const originalSaved = saveOriginalStart($response.body);
    const obj = JSON.parse($response.body);
    if (!obj || (obj.code !== "0" && obj.code !== 0) ||
        !Array.isArray(obj.images) ||
        !Object.prototype.hasOwnProperty.call(obj, "showTimesDaily")) {
      console.log("[京东开屏] 已保存原响应；跳过修改：配置结构或业务状态不符合预期");
      return $done({});
    }
    const materials = collectMaterials(obj.images);
    const originalImageCount = materials.items;
    const originalDaily = obj.showTimesDaily;
    saveConfirmedMaterials(materials);
    const changed = obj.images.length > 0 || Number(originalDaily) !== 0;
    if (changed) {
      obj.images = [];
      obj.showTimesDaily = typeof originalDaily === "string" ? "0" : 0;
      result = {body: JSON.stringify(obj)};
    }
    const detail = `原始任务 ${originalImageCount} 个，图片 ${materials.images.length}，视频 ${materials.videos.length}，每日次数 ${originalDaily}；` +
      (changed ? "已清空" : "原本已为空，无需修改") +
      (originalSaved ? "；修改前原响应已保存" : "；原响应保存失败") +
      (materials.dates.length ? `；日期 ${materials.dates.join("、")}` : "") +
      (materials.ids.length ? `\n素材标识：${materials.ids.join(",")}` : "");
    console.log("[京东开屏] start 已触发：" + detail);
    try {
      $notification.post("京东 start 规则已触发", "开屏配置检查完成", detail);
    } catch (error) {
      console.log("[京东开屏] 通知发送失败：" + error);
    }
  } catch (error) {
    console.log("[京东开屏] 处理失败，保留原响应；错误类型=" + (error && error.name || "unknown"));
  }
  $done(result);

  function saveOriginalStart(body) {
    if (typeof $persistentStore === "undefined") return false;
    try {
      const limit = 512 * 1024;
      const record = {
        version: 1, time: Date.now(), endpoint: "functionId=start",
        status: $response.status, bodyLength: body.length,
        responseBody: body.length <= limit ? body : body.slice(0, limit),
        bodyTruncated: body.length > limit,
        source: "received_before_this_script_modification"
      };
      const latestOK = $persistentStore.write(JSON.stringify(record), "jd_splash_start_original_last_v1");
      let rows = [];
      try { rows = JSON.parse($persistentStore.read("jd_splash_start_original_history_v1") || "[]"); } catch (_) {}
      if (!Array.isArray(rows)) rows = [];
      rows.unshift(record);
      rows = rows.slice(0, 5);
      while (JSON.stringify(rows).length > 1024 * 1024 && rows.length > 1) rows.pop();
      const historyOK = $persistentStore.write(JSON.stringify(rows), "jd_splash_start_original_history_v1");
      console.log("[京东开屏] 修改前 start 已保存：" + body.length + " 字符" +
        (record.bodyTruncated ? "（超限截断）" : ""));
      return latestOK !== false && historyOK !== false;
    } catch (error) {
      console.log("[京东开屏] 原始 start 保存失败：" + error);
      return false;
    }
  }

  function collectMaterials(groups) {
    const data = {items: 0, images: [], videos: [], urls: [], ids: [], dates: []};
    groups.forEach(group => {
      const items = Array.isArray(group) ? group : [group];
      items.forEach(item => {
        if (!item || typeof item !== "object") return;
        data.items++;
        addUrl(item.url, data.images, data);
        addUrl(item.videoUrl, data.videos, data);
        if (item.onlineTime) data.dates.push(String(item.onlineTime).slice(0, 10));
      });
    });
    data.urls = unique(data.urls);
    data.images = unique(data.images);
    data.videos = unique(data.videos);
    data.ids = unique(data.ids);
    data.dates = unique(data.dates);
    return data;
  }

  function addUrl(url, bucket, data) {
    if (typeof url !== "string" || !url) return;
    bucket.push(url);
    data.urls.push(url);
    const clean = url.split("?")[0].split("#")[0];
    const fileName = clean.slice(clean.lastIndexOf("/") + 1);
    const id = fileName.split(".")[0];
    if (/^[0-9a-f]{12,64}$/i.test(id)) data.ids.push(id);
  }

  function saveConfirmedMaterials(materials) {
    if (typeof $persistentStore === "undefined") return;
    mergeStore("jd_splash_confirmed_ids_v1", materials.ids, 100);
    mergeStore("jd_splash_confirmed_urls_v1", materials.urls, 100);
    try {
      $persistentStore.write(JSON.stringify({
        time: Date.now(), ids: materials.ids, urls: materials.urls, dates: materials.dates
      }), "jd_splash_last_start_v1");
    } catch (error) {
      console.log("[京东开屏] 保存 start 摘要失败：" + error);
    }
  }

  function mergeStore(key, incoming, limit) {
    let saved = [];
    try {
      saved = JSON.parse($persistentStore.read(key) || "[]");
      if (!Array.isArray(saved)) saved = [];
    } catch (_) { saved = []; }
    const merged = unique(incoming.concat(saved)).slice(0, limit);
    try { $persistentStore.write(JSON.stringify(merged), key); } catch (_) {}
  }

  function unique(items) {
    return items.filter((item, index) => items.indexOf(item) === index);
  }
})();
