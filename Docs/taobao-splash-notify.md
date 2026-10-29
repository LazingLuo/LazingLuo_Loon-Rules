# 淘宝开屏

自用，版本 20261029-1。更新原插件后保存、断开重连 Loon；已安装旧的“淘宝开屏时间改写”试验插件时关闭旧版，避免抢先处理。同类规则冲突时把本插件排前面。

- 专用 splash 接口和带 tao_splash 的旧接口返回空字典。
- 首页 home 系列响应仅检查 topViewSplashSection.sections 中同时带素材地址及 gmtStartMs/gmtEndMs 的条目，开始/结束时间设为 2099/2100 年；保留其他首页内容。专用接口在请求阶段已拦截，不再等待它的响应。
- 图片只按 heic.alicdn.com、gw.alicdn.com 的指定路径及 URL 尺寸特征处理，不读取实际图片尺寸；仍是候选特征，可关闭“开屏素材规则”。HEIC选用720×1280、1080×1920、1125×1602、1125×1950、1242×2208；WebP不含1125×1950。
- 通知分别显示接口拦截、实际时间改写、素材特征拦截。普通首页响应只记数。手动运行“淘宝开屏命中统计”可看各项次数、时间及最近连接主机。

保留 App 自带 DNS，不添加全局 UDP、证书验证或 IP 拒绝规则。4 个 MitM 候选为 106.11.226.222、59.82.9.242、203.119.238.85、203.119.238.234，来自一次 AMDC 结果，TTL 300 秒。它们承载多种业务，可能变化；加入不保证能解密特殊传输，也不能清除 App 已有缓存。

参考 [FFDNS](https://github.com/Thelongdarkorg/loon-plugins/blob/main/taobao_splash_ad_block.plugin)、[ishowshu](https://github.com/ishowshu/loon/blob/main/plugin/taobao.lpx) 的接口和图片规则；结合本地 10.68.0 静态分析收窄。没有照搬 HTTPDNS、埋点或整个首页的屏蔽规则。只存规则编号、时间、计数及连接主机，不保存 Cookie、请求参数、素材地址或响应正文。
