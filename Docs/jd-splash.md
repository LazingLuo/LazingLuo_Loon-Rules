# 京东开屏

- URL 带 `functionId=start` 时处理开屏配置，将广告日期设为过期。开屏通知仅在 `start` 响应命中时发出。
- 按 `m.360buyimg.com/mobilecms/` 下的两种尺寸路径静默拒绝图片，按 `storage.360buyimg.com/material-video/video/` 目录静默拒绝 MP4。
- 签到和活动凭据由各自插件处理。开屏插件可以放在它们前面。仅在 POST 正文里出现的 `start` 不会触发开屏规则。

脚本不输出命中日志，也不写入诊断记录。
