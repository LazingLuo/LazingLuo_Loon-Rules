(() => {
  const routes = [
    [/^https:\/\/bootpreload\.uve\.weibo\.com\/v[12]\/ad\/preload(?=[/?#]|$)/i, "preload"],
    [/^https:\/\/sdkapp\.uve\.weibo\.com\/interface\/sdk\/sdkad\.php(?=[?#]|$)/i, "sdk"],
    [/^https:\/\/wbapp\.uve\.weibo\.com\/(?:preload\/get_ad|wbapplua\/wbpullad\.lua)(?=[/?#]|$)/i, "cached"]
  ];
  const response = typeof $response === "undefined" ? null : $response;
  const request = typeof $request === "undefined" ? null : $request;
  const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const result = {};

  try {
    const route = typeof request?.url === "string" && routes.find(([pattern]) => pattern.test(request.url));
    const body = response?.body;
    const status = response?.status ?? response?.statusCode;
    if (!route || typeof body !== "string" || body.length === 0 || body.length > 4 * 1024 * 1024 ||
        (status != null && !/^(?:HTTP\/\S+\s+)?200(?:\s|$)/.test(String(status)))) return;
    const kind = route[1];
    const suffix = kind === "sdk" ? (body.match(/OK\s*$/) || [""])[0] : "";
    const payload = JSON.parse(suffix ? body.slice(0, -suffix.length) : body);
    if (!object(payload)) return;

    let changed = false;
    function put(record, key, value) {
      if (record[key] !== value) {
        record[key] = value;
        changed = true;
      }
    }
    function update(record, settings, existingOnly = false) {
      if (!object(record)) return;
      for (const [key, value] of Object.entries(settings)) {
        if (!existingOnly || own(record, key)) put(record, key, value);
      }
    }

    const interval = 31536000;
    const from = 3818332800, to = 3818419199;
    if (kind === "sdk") {
      const controls = {needlocation: false, show_push_splash_ad: false,
        background_delay_display_time: interval, lastAdShow_delay_display_time: interval,
        realtime_ad_video_stall_time: 0, realtime_ad_timeout_duration: 0};
      for (const [key, value] of Object.entries(controls)) {
        if (payload[key]) put(payload, key, value);
      }
      if (Array.isArray(payload.ads)) {
        for (const ad of payload.ads) update(ad, {
          displaytime: 0, displayintervel: interval, allowdaydisplaynum: 0,
          begintime: "2040-01-01 00:00:00", endtime: "2040-01-01 23:59:59"
        });
      }
    } else if (kind === "preload") {
      const timing = {start_time: from, end_time: to, daily_display_cnt: 50, display_duration: 0};
      if (Array.isArray(payload.ads)) {
        for (const ad of payload.ads) {
          update(ad, timing);
          if (Array.isArray(ad?.creatives)) {
            for (const creative of ad.creatives) update(creative, timing, true);
          }
        }
      }
    } else if (Array.isArray(payload.cached_ad?.ads)) {
      for (const ad of payload.cached_ad.ads) update(ad, {show_count: 50, duration: 0, start_date: from, end_date: to});
    }

    if (changed) result.body = JSON.stringify(payload) + suffix;
  } catch (_) {
  } finally {
    $done(result);
  }
})();
