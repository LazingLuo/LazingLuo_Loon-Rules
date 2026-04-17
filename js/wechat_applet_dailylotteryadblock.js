// wechat_miniapp_daily_lottery_adblock.js
// 目标：仅拦截 appId = wx4692f08fa6ad3bc2 的广告素材请求
// 范围：只处理 wximg.wxs.qq.com，不碰 mmtls

const APP_ID = "wx4692f08fa6ad3bc2";
const TARGET_HOST = "wximg.wxs.qq.com";

const req = $request || {};
const url = req.url || "";
const headers = req.headers || {};

// 兼容大小写
function getHeader(name) {
  const lower = name.toLowerCase();
  for (const k in headers) {
    if (k.toLowerCase() === lower) return headers[k];
  }
  return "";
}

const host = getHeader("Host") || (() => {
  try { return new URL(url).host; } catch { return ""; }
})();

const referer = getHeader("Referer");
const isTargetMiniApp = referer.includes(`servicewechat.com/${APP_ID}/`);

const isAdMaterial =
  /\/ads_svp_video__/i.test(url) ||
  /\/snscosdownload\/SZ\/reserved\//i.test(url) ||
  /[?&]posid=\d+(?:&|$)/i.test(url);

// 只对目标小程序的广告素材返回空响应
if (host === TARGET_HOST && isTargetMiniApp && isAdMaterial) {
  $done({
    response: {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store"
      },
      body: ""
    }
  });
} else {
  $done({});
}
