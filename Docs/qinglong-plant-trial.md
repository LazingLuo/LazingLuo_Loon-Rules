# 种豆任务请求试验版

本次处理 Faker3 `jd_plantBean.js` 中连续签到以外的任务请求。不是已确认的403修复。单独增加 `lazing_jd_plant_trial.js` 入口，不修改、重命名或覆盖 NAS 上的 Faker 文件，也没有更改全局签名库或其他任务。

## 改了什么

保留 Faker 原来的任务列表、任务顺序、等待时长、奖励处理，以及原签到流程。在内存加载时，只接管以下六个接口：

| 接口 | 处理 |
| --- | --- |
| apTaskList、apTaskDetail | 保留原业务参数和未签名的查询方式，使用正确的 HTTPS 地址与手机请求头；查询成功后才允许提交任务 |
| apStartTaskTime | 保留原任务ID、素材ID和 pipeExt；请求路由appid按手机成功请求修正为 activity_platform_se，使用官方SDK重新签名，签名appId仍为 acb1e |
| apDoLimitTimeTask | 保留原浏览完成请求，只有开始任务被接受后才提交；签名appId为 ebecc |
| apsDoTask | 保留原任务参数；签名appId为54ed7 |
| apTaskDrawAward | 保留原奖励领取参数；签名appId为f0f3f |

签名使用自有签到脚本已核查的官方SDK，根据捕获的种豆手机环境选择 `h5_file_v5.3.5` 或 `h5_file_v5.3.6`，生成新时间戳、指纹和签名；不重放旧h5st，不把版本字符串强改为新版。请求头的UA、页面附加Cookie、设备参数和页面令牌来自种豆任务记录；登录对使用 Faker 当前正在处理的同账号Cookie。

**2026-10-18.1起只使用种豆任务专用上下文，缺少时停止。** 必须已有同一设备、同一客户端版本的任务列表、开始浏览、完成浏览三个成功记录。每个接口优先使用自身模板；尚未捕获的旧版详情查询复用种豆列表上下文，旧版做任务及领奖复用种豆完成浏览上下文。这些旧版业务参数仍由Faker提供，其服务端兼容性尚未确认。

原 `weGameHome` / `weGameLottery` 连续签到与其他种豆操作继续由原脚本处理。本入口会运行原脚本的其他既有流程，不是仅执行这六个接口的独立业务重写，也不是对Faker代码的隔离沙箱。与原种豆任务、Loon种豆签到错开执行。

## 2026-10-18.1更新：使用种豆自己的页面上下文

17.3已经修正`apStartTaskTime`的`appid=activity_platform_se`，用户实际运行仍403。手机成功请求还带有种豆自己的`wg-sdk-token`、uuid、设备扩展参数及5.3.6签名环境；旧试验版使用的是刮卡5.3.5环境，尚未完整复用这组上下文。

本次在Loon统一捕获入口增加种豆任务记录，只从指定种豆linkId及成功响应保存上下文。手机本地键为`JD_PLANT_TASK_CONTEXT_V1`，同步后放入已有`LAZING_JD_ACTIVITY_V1`的`activities.plantTasks`；不新增青龙环境变量。通用页面及设备参数可同步，具体任务ID、素材ID、业务正文、旧时间戳和旧h5st不保存到模板。换设备或客户端版本时重新收齐三个模板，不拼接不同设备记录。

私有371包已在本机离线回放，能收齐三个上下文；重新生成的开始及完成签名字段集合与手机记录一致。全部验证不访问京东或NAS，不公开私人HAR或令牌。403是否消失仍需青龙实际运行确认，页面令牌也可能过期。

## 怎样试一次

1. 在Loon更新「青龙接入」插件，开启「获取独立活动凭据」。京东开屏插件的「配置检测」保持关闭，避免占用同一响应。进入种豆页面，手动完整完成一个浏览任务，让列表、开始、完成三条成功请求均被捕获。
2. 「手动操作」选「最近凭据获取结果」，运行「青龙手动操作」；种豆记录版本应为`2026-10-18.1`，`complete:true`，模板包含`apTaskList`、`apStartTaskTime`、`apDoLimitTimeTask`。再选「同步活动凭据」并运行，结果中应出现「种豆任务上下文」。无需新增Client Secret或手填令牌。
3. 更新自有青龙仓库订阅。已有试验任务不用改命令或白名单。首次接入时白名单完整版本如下，依赖文件仍是 `Qinglong/function/`：

```text
Qinglong/lazing_jd_(plus|scratch|jxzy|finance|report|plant_trial)\.js$
```

4. 手动运行原试验任务一次。入口应显示适配器`2026-10-18.1`和「使用种豆任务专用页面上下文」。日志增加`contextSource`及`contextCapturedAt`。同项任务与App、原Faker错开执行。
5. 首次建立任务时：此入口没有默认Cron标记，不会自动增加定时任务。新建「种豆任务请求试验」，从自有刮卡任务复制完整命令，只把 `lazing_jd_scratch.js` 改成 `lazing_jd_plant_trial.js`。先保持定时禁用。青龙全局随机等待仍可能生效，需要立即试时沿用已有命令末尾 `now` 用法。
6. 本机原Faker路径默认 `/ql/data/scripts/shufflewzc_faker3_main/jd_plantBean.js`。目录不同时，在青龙环境变量 `LAZING_FAKER_PLANT_PATH` 填原文件完整路径。沿用原Faker公共函数和依赖，不需要新增npm依赖。
7. 把日志中 `[种豆任务试验]` 开头的结果发来即可。它显示失败接口、HTTP状态及环境版本，不打印Cookie、令牌、账号或完整h5st。原Faker日志保持原样，分享时遮住账号。

如果只想下载或检查代码：

- [手动试验入口](../Qinglong/lazing_jd_plant_trial.js)
- [任务请求适配器](../Qinglong/function/plant-trial.js)

## 遇到失败怎样处理

首次HTTP403或业务拒绝后，本账号后续的六个任务接口停止，不自动重试、不切换签名路径。不会将HTTP200一律视为任务成功；必须有明确的 `success: true`。日志中的 `accepted` 仅表示接口接受请求，奖励数量和最终完成状态仍由原脚本及App页面确认。

领取或任务提交前保存待确认记录；超时、网络断开、非JSON或5xx等情况保留记录，下次运行也停止任务提交。记录在 `LAZING_JD_DATA_DIR`（默认 `/ql/data/lazing-jd`）下对应账号摘要的 `plant-trial/state.json`。确认App状态前不要清除此记录。每个账号有独立执行锁；正常退出会释放。强制终止残留锁时，确认没有试验任务运行后再清理 `running.lock`，保留 `state.json`。原Faker入口没有使用本试验锁，所以两者不要同时执行。

本版严格对应2026-10-17核查的Faker文件：Git blob `bf4ca209095e54bdffa22ec8774e943022f4632c`，原文件SHA256 `a978aa759131844225a727844e1e57c5272b9fae15ad3dfbded3ac6f1f8dccca`。适配器版本2026-10-17.2修正了核查副本末尾多一个换行导致正常原版被误拒绝的问题。校验时只兼容开头BOM、LF/CRLF换行和文件末尾空白，规范化SHA256为 `0e0f582b8f1ab05cc666bad46342e6a82cd60e956eabb9a0a1905c4d62b8748d`；不修改磁盘上的Faker文件。若订阅更新改变代码内容，试验入口仍会停止并提示核查及摘要前12位，避免错误注入。没有静默回退到原来的403请求。

## 离线验证和构建

`node Qinglong/plant-trial-test.cjs` 验证两版SDK生成签名、专用上下文完整性、账号及设备一致性、先查询再提交、浏览顺序、403停止、业务拒绝、未确认提交跨运行保留、并发锁和网络目标限制。测试使用虚构凭据、模拟接口，不执行上游Faker代码，不向京东发送账号请求。

`node Tests/qinglong-credential-capture.test.cjs --plant-har /自己的文件.har`可选回放本机种豆HAR并核对SDK签名字段集合。只打印检查结果，不打印凭据，不发送网络请求。

可选设置 `FAKER_PLANT_SOURCE` 指向核查的原 `jd_plantBean.js`，再运行测试，额外检查官方Git blob与原文件摘要、BOM/CRLF/末尾空白兼容、代码变化仍被拒绝、唯一注入位置和完整脚本语法；仍不执行原脚本。

构建签名依赖：`node Tools/build-qinglong-plant-signer.cjs`。从当前 `Qinglong/function/jd-core.js` 中提取已有的SDK、浏览器和环境检查代码，加上 `Tools/plant-signer-wrapper.js`；不包含签到业务入口，不下载或执行外部签名服务。
