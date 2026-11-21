// 铁路12306 5.9.6 开屏净化，20261121-1。
// 0007 的占位响应格式参考公开规则:
// https://github.com/AEtso/Loon/blob/master/Scripts/12306.js
(() => {
  const endpoint = /^https:\/\/ad\.12306\.cn(?::443)?\/ad\/ser\/getAdList\/?(?:\?|$)/;
  if (typeof $request === "undefined" ||
      !endpoint.test($request.url || "") ||
      String($request.method || "").toUpperCase() !== "POST") {
    $done({});
    return;
  }

  let placement;
  try {
    const data = JSON.parse($request.body);
    placement = data && data.placementNo;
  } catch (_) {
    $done({});
    return;
  }

  let body;
  let message;
  switch (placement) {
    case "0007":
      body = {
        code: "00",
        materialsList: [{billMaterialsId: "255", filePath: "h", creativeType: 1}],
        advertParam: {skipTime: 1},
      };
      message = "已返回 1 秒占位";
      break;
    case "G0054":
      body = {code: "00", materialsList: []};
      message = "已返回空素材列表";
      break;
    default:
      $done({});
      return;
  }

  try {
    $notification.post("铁路12306开屏净化", "广告位 " + placement, message);
  } catch (_) {
    // 通知失败时仍返回本地响应。
  }

  $done({
    response: {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify(body),
    },
  });
})();
