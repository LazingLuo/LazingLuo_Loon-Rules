# 淘宝开屏拦截与命中通知

从 [FFDNS / Thelongdarkorg 的淘宝规则](https://github.com/Thelongdarkorg/loon-plugins/blob/main/taobao_splash_ad_block.plugin) 中提取开屏部分，改成 Loon 本地请求脚本，在返回空字典的同时通知命中时间、次数和间隔。

2026年10月21日核对：该仓库最近推送为10月19日，淘宝文件自述更新时间为9月18日。本次下载 SHA-256 为 `11bfac77622eb370b1295cdf7bad12af0ec0e5b85d28a82da621685c15c5e70d`，与10月19日下载的版本相同。另核对了 ishowshu/loon 与 aoomee/Loon-Adblock-Plugins 的淘宝文件，两者内容一致；没有将新近转载当作规则更新。本版增加的是通知和本地统计，不声称发现了已验证的新开屏接口。

## 安装

将[插件链接](https://raw.githubusercontent.com/LazingLuo/LazingLuo_Loon-Rules/refs/heads/main/Plugins/taobao-splash-notify.plugin?v=20261021-1)导入 Loon，并开启插件。配套脚本为 `Scripts/taobao-splash-notify.js`。要求已启用 MITM、安装并信任 Loon 证书；插件列出四个需要解密的域名。

观察期间，请关闭其他插件中重复的淘宝开屏拦截条目或“淘宝去广告”开关，让这份插件独立处理这些请求。已有 Rewrite / REJECT 如果提前拦截，本脚本可能无法运行，也不会补发通知。专门用于 HTTPDNS 的现有设置可继续保留，本插件不会增加或修改 DNS、QUIC 或 IP 拦截规则。原闲鱼开屏插件可继续使用。

## 命中通知和统计

默认每条命中的请求都发通知，不设置去重或冷却：

- **开屏接口已拦截**：匹配选中的社区开屏接口规则，并返回空字典。
- **素材规则已拦截（待核实）**：匹配社区图片 URL 特征并返回空字典，尚不能据此确认素材就是本次展示的开屏。部分图形规则可能匹配普通图片；可在插件参数关闭“开屏素材规则”，保留两个接口规则。

通知同时显示北京时间、距上次**同一规则**命中的间隔、今日总次数和累计总次数。数字按请求计算，同一次启动可能触发多条通知，不能当成启动次数或被拦广告的展示次数。

在 Loon 手动脚本入口执行 **“淘宝开屏命中统计”**，查看各规则累计次数和最近命中时间，以及最近10条记录。底层最多保存50条历史，仅保存在本机；并发请求或系统中断时计数可能有遗漏。

“命中通知”开关关闭时仍拦截并记录。统计保存或系统通知失败时，已生成的空响应仍保留。脚本不保存完整 URL、图片文件名、查询参数、Cookie、账号或设备标识，也不发起网络请求。

## 提取范围

- `acs.m.taobao.com`：`mtop.etao.noah.query`，且 URL 带 `tao_splash`。
- `guide-acs.m.taobao.com`：`mtop.taobao.wireless.home.splash.awesome.get`。
- `heic.alicdn.com`：上游3条 HEIC 图片特征。
- `gw.alicdn.com`：上游1条指定竖屏规格 WebP 特征。

增加显式默认端口识别，并为首页开屏接口增加名称／版本边界；其余图片路径选择保留上游规则。未提取通用广告下发、统计、HTTPDNS、其他 App、闲鱼、首页二楼、poplayer 或通用视频接口。

未出现通知可能是没有发出匹配请求、使用已预加载素材、未解密、连接没有可识别域名、系统通知关闭或被其他规则提前处理。插件无法主动清理 App 已缓存的广告，也不会自动学习或扩大规则范围。

## 验证

运行 `node Tests/taobao-splash-notify.test.cjs`（本地工作目录为 `node test.cjs`），离线验证六类匹配、非目标请求放行、通知、计数、跨日、历史上限和隐私边界。没有执行真实淘宝账号请求；实际 iPhone 命中频率和去开屏效果有待观察。

规则来源作者：FFDNS / Thelongdarkorg。通知、统计和 Loon 请求脚本适配为本次独立实现。本脚本内置本次选中的规则，不自动拉取或执行上游代码。
