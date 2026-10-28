# Loon 自用规则与脚本

按用途维护分流规则、开屏处理、签到和手动活动。部分去广告规则来自公开社区，实际效果随 App 版本和接口变化。

## 签到与活动

| 用途 | 插件 | 说明 |
| --- | --- | --- |
| 京东合并签到 | [jd-signin.plugin](Plugins/jd-signin.plugin) | [使用说明](Docs/jd-signin.md)；全部签到一个手动入口，保留可设时间的自动项 |
| 京东活动 | [jd-activities.plugin](Plugins/jd-activities.plugin) | [使用说明](Docs/jd-activities.md)；京喜、农场、领券中心各一个手动入口，无定时，农场不自动浇水 |
| 联通签到 | [unicom-checkin.plugin](Plugins/unicom-checkin.plugin) | [使用说明](Docs/unicom-checkin.md) |
| 美团跳转任务 | [meituan-jump.plugin](Plugins/meituan-jump.plugin) | [使用说明](Docs/meituan-jump.md)；配合快捷指令访问任务页 |

签到和活动使用 Loon 中同账号的共享登录与设备资料。京东开屏插件也保留共享凭据获取，以兼容脚本优先匹配的情况。已有本地存储无需清空。

## 开屏与去广告

| 用途 | 插件 | 说明 |
| --- | --- | --- |
| 京东开屏处理与诊断 | [jd_open.plugin](Plugins/jd_open.plugin) | [使用说明](Docs/jd-splash.md) |
| 闲鱼开屏 | [xianyu_open.plugin](Plugins/xianyu_open.plugin) | [使用说明](Docs/idle-splash.md) |
| 淘宝社区素材规则与命中通知 | [taobao-splash-notify.plugin](Plugins/taobao-splash-notify.plugin) | [使用说明](Docs/taobao-splash-notify.md)；保留观察实际效果 |

其他插件：[高德](Plugins/amap_open.plugin)、[中国联通](Plugins/ChinaUnicom_open.plugin)、[东方财富](Plugins/eastmoney_open.plugin)、[网易云音乐](Plugins/netease_music_open.plugin)、[拼多多](Plugins/pdd.plugin)、[微博](Plugins/weibo_open.plugin)、[小红书](Plugins/xhs_open.plugin)、[通用广告](Plugins/general_ads.plugin)。

## 保留的兼容入口与工具

- [jd-checkin-test.plugin](Plugins/jd-checkin-test.plugin) 是合并签到的旧订阅地址，和 `jd-signin.plugin` 二选一。
- [jd-signin-shortcut.plugin](Plugins/jd-signin-shortcut.plugin) 是快捷指令调用签到的配套入口，按需使用：[说明](Docs/jd-signin-shortcut.md)。

## 分流规则

[Apple](Rules/apple.rule)、[微软](Rules/microsoft.rule)、[群晖](Rules/synology.rule)、[其他直连](Rules/otherDirect.rule)、[代理](Rules/Proxy.rule)、[TikTok](Rules/tiktok.rule)。

## 维护

脚本在 [Scripts](Scripts/)，离线检查在 [Tests](Tests/)。检查使用合成资料和模拟响应，不向真实账号发送测试请求。

已清理青龙接入、旧独立京东签到和活动入口，以及停用的淘宝实验。手机上仍安装这些旧插件时，请自行停用或删除对应订阅。历史版本保留在 Git 提交记录中。
