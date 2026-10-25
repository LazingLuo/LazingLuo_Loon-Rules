# 淘宝开屏时间改写：验证版

版本：2026-10-25.1。基于用户提供的淘宝 iPhone 10.68.0 IPA 做静态分析后编写。

## 当前行为

保留淘宝自身 DNS。插件没有 DNS、HTTPDNS、AMDC、IP 拒绝或图片 CDN 屏蔽规则。

对于已经被 Loon 解密的 MTop 响应，仅查找 `topViewSplashSection.sections` 中的开屏条目。条目必须同时具有正数格式的 `gmtStartMs`、`gmtEndMs`，以及 HTTP(S) 形式的 `imgUrl` 或 `videoUrl`。将开始时间设为 2099-01-01、结束时间设为 2100-01-01，保留字段原来的数字/字符串类型。首页其他字段保持原值。

这里改变的是单条开屏的展示有效期，不是把通用缓存有效期延长到 2099 年，也不是修改账号时间。请求间隔保持原值，避免只停止获取新数据却继续展示旧缓存。

## 使用

1. 导入插件，并确保 Loon MITM 证书已信任。
2. 测试期间关闭旧的“淘宝开屏拦截与命中通知”，以及其他会提前拦截同一接口的规则；否则新插件拿不到原始响应。其他 App 的规则无需调整。
3. 正常使用淘宝，包含打开首页、刷新首页和退出后再进入。这个版本不要求卸载重装，也不要求屏蔽淘宝 DNS。
4. 查看通知，或在 Loon 手动运行“淘宝开屏改写记录”。

通知含义：

- **已改写 N 条**：已经修改 N 个条目的时间字段；效果要看之后启动是否仍显示广告。
- **找到开屏字段**：字段存在，但本次没有符合条件的可改条目；每小时最多提示一次。
- **记录中已检查为 0**：这套插件尚未收到符合范围的已解密响应，优先核对网关域名、SNI、传输方式与规则冲突。
- **已检查大于 0，改写为 0**：确实看到了接口响应，但尚未遇到符合条件的开屏内容。

记录只保存次数、时间和不含参数的 API 名，不保存 Cookie、请求参数、完整 URL 或响应正文。关闭命中通知后仍改写并保存本机计数。

## 已验证与待验证

已验证的代码证据：`TBBootImageItemSelector.checkStartTimeAndEndTime:`（`0x1035bec04`）会检查开始/结束时间，要求二者为正，当前时间位于区间内；`validateBootImageInfoItem:configModel:isColdStart:` 在展示前调用该检查。首页 base、delta 和专用开屏接口均有开屏数据入口。

本地离线检查覆盖字段范围、首页数据保留、IP 形式 URL、JSONP、字符串封装、错误响应、超限响应、数值精度和通知故障。

**尚未有实际手机命中与屏蔽效果验证。** 旧 HAR 没有保存这类开屏条目的真实响应，当前 JSON 用例为按代码结构构造。字段结构不同、响应未解密、或广告早已缓存时，当前版本可能不产生改写。它不会直接访问或清理淘宝沙盒中的旧文件，也不保证一次命中就永久生效。

当前 MITM 域名：`acs.m.taobao.com`、`guide-acs.m.taobao.com`、`h5api.m.taobao.com`、`acs.m.tmall.com`。响应脚本可处理解密后仍为 IP 的 URL；能否解密仍取决于 Loon 对连接的识别，不通过枚举 IP 扩大 MITM 范围。

## 安装文件

- 仓库插件：`Plugins/taobao-splash-config.plugin`
- 通用脚本：`Scripts/taobao-splash-config.js`
- 说明：`Docs/taobao-splash-config.md`
- 离线检查：`Tests/taobao-splash-config.test.cjs`

本地 `taobao-splash-config-local.plugin` 引用同目录脚本。仓库版插件引用本仓库 main 上的脚本链接。
