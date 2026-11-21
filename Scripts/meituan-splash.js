try {
  $notification.post(
    "美团开屏接口命中",
    "startupPicture",
    "美团发起了开屏配置请求，Loon 已拦截。"
  );
} catch (error) {
  console.log("[美团开屏] 命中 startupPicture，通知发送失败。");
}

$done({
  response: {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: "{}"
  }
});
