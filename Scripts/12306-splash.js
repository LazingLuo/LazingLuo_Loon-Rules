// 铁路12306 5.9.6 开屏净化，20261121-2。
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
  switch (placement) {
    case "0007":
      body = {
        code: "00",
        materialsList: [{billMaterialsId: "255", filePath: "h", creativeType: 1}],
        advertParam: {skipTime: 1},
      };
      break;
    case "G0054":
      body = {code: "00", materialsList: []};
      break;
    default:
      $done({});
      return;
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
