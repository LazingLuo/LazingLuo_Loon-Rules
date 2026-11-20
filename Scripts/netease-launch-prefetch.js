(() => {
  const result = {};
  try {
    const request = typeof $request === "undefined" ? null : $request;
    const response = typeof $response === "undefined" ? null : $response;
    const route = /^https?:\/\/(?:ipv4|interface[123]?)\.music\.163\.com\/e?api\/ad\/prefetch\/select(?:[?#]|$)/i;
    if (!request?.url || !route.test(request.url)) return;

    const status = response?.status ?? response?.statusCode;
    if (status != null && !/^(?:HTTP\/\S+\s+)?200(?:\s|$)/.test(String(status))) return;
    const body = response?.body;
    if (typeof body !== "string" || !body || body.length > 2 * 1024 * 1024) return;

    const payload = JSON.parse(body);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
    const targets = [payload, payload.data];
    let changed = false;
    for (const data of targets) {
      if (data && Array.isArray(data.open_ads) && data.open_ads.length) {
        data.open_ads = [];
        changed = true;
      }
    }
    if (changed) result.body = JSON.stringify(payload);
  } catch (_) {
  } finally {
    $done(result);
  }
})();
