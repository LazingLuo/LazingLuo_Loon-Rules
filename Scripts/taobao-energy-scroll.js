// Loon response helper, v0.1.0. Only opt-in official energy task HTML is changed.
// It scrolls the real page; the official timer and task submission stay intact.
(function () {
  try {
    var url = typeof $request.url === 'string' ? $request.url : '';
    if (!/^https:\/\/mo\.m\.taobao\.com\/union2\/(?:page_1728378489402|page_1697972915627)\?(?:[^#]*)$/.test(url) ||
        !/[?&]loon_energy_scroll=1(?:&|$)/.test(url) ||
        !/[?&]ep=[^&#]+/.test(url) || !/[?&]et=[^&#]+/.test(url)) return $done({});
    var body = $response.body;
    var headers = Object.assign({}, $response.headers || {});
    var type = '';
    var csp = false;
    Object.keys(headers).forEach(function (key) {
      if (key.toLowerCase() === 'content-type') type = String(headers[key]);
      if (key.toLowerCase() === 'content-security-policy' && String(headers[key]).trim()) csp = true;
    });
    if (Number($response.status) !== 200 || typeof body !== 'string' || body.length > 3 * 1024 * 1024 ||
        !/text\/html/i.test(type) || !/<head\b[^>]*>/i.test(body) ||
        !/<title[^>]*>\s*(?:超级红包-搜索热词任务|浏览惊喜好物任务)\s*<\/title>/i.test(body) ||
        body.indexOf('id="loon-energy-scroll-v1"') !== -1) return $done({});
    if (csp || /<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy\b/i.test(body)) {
      console.log('[攒能量自动滚动] 页面含安全策略，保持原响应。');
      try { $notification.post('攒能量未启用自动滚动', '页面安全策略限制', '本页请手动滑动一次；原页面保持不变。'); } catch (_) {}
      return $done({});
    }
    var injected = '<script id="loon-energy-scroll-v1">(' + pageHelper.toString() + ')();</script>';
    body = body.replace(/<head\b[^>]*>/i, function (head) { return head + injected; });
    Object.keys(headers).forEach(function (key) {
      if (/^(?:content-length|content-encoding|transfer-encoding|etag|last-modified|content-md5|digest|content-digest)$/i.test(key)) delete headers[key];
    });
    headers['Cache-Control'] = 'no-store';
    console.log('[攒能量自动滚动] 已注入页面辅助；是否计时、完成仍由官方页面判断。');
    $done({headers: headers, body: body});
  } catch (_) {
    console.log('[攒能量自动滚动] 无法处理，保持原响应。');
    $done({});
  }

  function pageHelper() {
    'use strict';
    if (window.__loonEnergyScrollV1 || location.hostname !== 'mo.m.taobao.com' ||
        !/^\/union2\/(?:page_1728378489402|page_1697972915627)$/.test(location.pathname) ||
        !/[?&]loon_energy_scroll=1(?:&|$)/.test(location.search)) return;
    window.__loonEnergyScrollV1 = true;
    var deadline = Date.now() + 20000;
    var stopped = false;
    var timer = null;
    var badge = null;
    var moves = 0;
    var lastMove = 0;

    function show(message) {
      if (!document.body) return;
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'loon-energy-scroll-status';
        badge.setAttribute('role', 'status');
        badge.style.cssText = 'position:fixed;left:8px;bottom:88px;max-width:80vw;padding:7px 10px;' +
          'border-radius:9px;background:rgba(25,25,25,.82);color:white;font:12px/1.5 sans-serif;' +
          'z-index:2147483647;pointer-events:none;';
        document.body.appendChild(badge);
      }
      badge.textContent = message;
    }
    function stop(message) {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('touchstart', manual);
      window.removeEventListener('pagehide', leave);
      show(message);
    }
    function manual() { stop('已转为手动浏览，请看官方倒计时'); }
    function leave() {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('touchstart', manual);
      window.removeEventListener('pagehide', leave);
    }
    function tick() {
      if (stopped) return;
      try {
        if (Date.now() >= deadline) return stop('未能确认计时，请手动滑动一次');
        if (document.hidden) { timer = setTimeout(tick, 400); return; }
        var icon = document.querySelector('.mm_wf_pagebrowse_icon');
        var text = icon ? icon.textContent : '';
        if (/任务已完成|已完成/.test(text)) return stop('官方页面显示已完成，请回活动核对');
        if (/已浏览\s*\d+\s*秒/.test(text)) return stop('官方计时已启动，请保持当前页面');
        show(moves ? '已尝试滚动，等待官方计时' : '自动滚动准备中，等待任务提示');
        // Wait for the official task indicator before moving. Never synthesize events.
        if (icon && /[滑滚]动|[上下]滑|浏览\s*\d+\s*秒/.test(text) &&
            moves < 6 && Date.now() - lastMove >= 1000) {
          var root = document.scrollingElement || document.documentElement || document.body;
          var current = root.scrollTop;
          var max = Math.max(0, root.scrollHeight - root.clientHeight);
          var next = moves % 2 === 0 ? Math.min(max, current + 80) : Math.max(0, current - 80);
          if (Math.abs(next - current) <= 10) next = current > 10 ? Math.max(0, current - 80) : Math.min(max, current + 80);
          if (Math.abs(next - current) > 10) {
            window.scrollTo({top: next, left: 0, behavior: 'instant'});
            moves++;
            lastMove = Date.now();
          }
        }
        timer = setTimeout(tick, 350);
      } catch (_) { stop('自动滚动未成功，请手动滑动一次'); }
    }
    document.addEventListener('touchstart', manual, {passive: true});
    window.addEventListener('pagehide', leave);
    tick();
  }
})();
