// Return an empty HTTP 200 before downloading the video, and report the URL.
(function () {
  const url = String($request.url || "");
  if (!/^https:\/\/storage\.360buyimg\.com\/material-video\/video\/[^/?#]+\.mp4(?:\?[^#]*)?$/i.test(url)) {
    return $done({});
  }
  console.log("[京东素材视频] 已拦截，返回空 HTTP 200\n" + url);
  try {
    $notification.post("京东素材视频已拦截", "material-video/video · MP4", url);
  } catch (error) {
    console.log("[京东素材视频] 通知失败：" + error);
  }
  try {
    if (typeof $persistentStore !== "undefined") {
      $persistentStore.write(JSON.stringify({time: Date.now(), url: url}), "jd_splash_last_video_block_v1");
    }
  } catch (error) {
    console.log("[京东素材视频] 保存记录失败：" + error);
  }
  $done({response: {
    status: 200,
    headers: {"Content-Type": "text/plain", "Cache-Control": "no-store"},
    body: ""
  }});
})();
