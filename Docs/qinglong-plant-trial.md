# 种豆任务请求试验版

本次处理 Faker3 `jd_plantBean.js` 中连续签到以外的任务请求。不是已确认的403修复。单独增加 `lazing_jd_plant_trial.js` 入口，不修改、重命名或覆盖 NAS 上的 Faker 文件，也没有更改全局签名库或其他任务。

## 改了什么

保留 Faker 原来的任务列表、任务顺序、等待时长、奖励处理，以及原签到流程。在内存加载时，只接管以下六个接口：

| 接口 | 处理 |
| --- | --- |
| apTaskList、apTaskDetail | 保留原业务参数和未签名的查询方式，使用正确的 HTTPS 地址与手机请求头；查询成功后才允许提交任务 |
| apStartTaskTime | 保留原任务ID、素材ID和 pipeExt，使用官方SDK重新签名；签名appId为 acb1e |
| apDoLimitTimeTask | 保留原浏览完成请求，只有开始任务被接受后才提交；签名appId为 ebecc |
| apsDoTask | 保留原任务参数；签名appId为54ed7 |
| apTaskDrawAward | 保留原奖励领取参数；签名appId为f0f3f |

签名使用自有签到脚本已核查的官方SDK，根据已有手机环境选择 `h5_file_v5.3.5` 或 `h5_file_v5.3.6`，生成新时间戳、指纹和签名；不重放旧h5st，不把版本字符串强改为新版。请求头的UA、页面附加Cookie、设备令牌来自同一份手机活动记录；登录对使用 Faker 当前正在处理的同账号Cookie。只修正账号标识之外的签名应用标识 `ai`，不混用不同账号。

**当前的环境来源是已同步的刮卡或PLUS活动，尚不是种豆浏览任务本身的成功模板。** 这是跨活动复用手机环境的对照试验，服务器是否接受仍需真实运行确认。业务参数、渠道等沿用Faker，不保证符合今天App的任务要求；若仍403，应对比App成功完成一个种豆任务的抓包，不能据此继续猜改参数或换签名反复提交。

原 `weGameHome` / `weGameLottery` 连续签到与其他种豆操作继续由原脚本处理。本入口会运行原脚本的其他既有流程，不是仅执行这六个接口的独立业务重写，也不是对Faker代码的隔离沙箱。与原种豆任务、Loon种豆签到错开执行。

## 怎样试一次

1. Loon「青龙接入」执行「同步活动凭据」。已有 `LAZING_JD_ACTIVITY_V1` 且刮卡或PLUS最近可用时，可以沿用；提示缺少环境时，进入相应活动页重新捕获并同步。无需新增Client Secret或手填令牌。
2. 给你已有的自有仓库订阅白名单加上试验入口，完整版本如下。依赖文件仍是 `Qinglong/function/`，然后执行一次订阅更新：

```text
Qinglong/lazing_jd_(plus|scratch|jxzy|finance|report|plant_trial)\.js$
```

3. 此入口没有默认Cron标记，不会自动增加定时任务。新建一个「种豆任务请求试验」任务；从现有自有刮卡任务复制完整命令，只把 `lazing_jd_scratch.js` 改成 `lazing_jd_plant_trial.js`。先保持定时禁用，手动运行一次。青龙全局随机等待仍可能生效，需要立即试时沿用面板中已有的命令末尾 `now` 用法。
4. 本机原Faker路径默认 `/ql/data/scripts/shufflewzc_faker3_main/jd_plantBean.js`。如果目录不同，在青龙环境变量 `LAZING_FAKER_PLANT_PATH` 填这个原文件的完整路径。使用原Faker已经安装的公共函数和依赖；试验签名、网络处理本身不需要新增npm依赖。
5. 把日志中 `[种豆任务试验]` 开头的结果发来即可。它会显示失败接口、HTTP状态及环境版本，不打印Cookie、令牌、账号或完整h5st。原Faker自己的日志输出仍保持原样，分享时遮住账号。

如果只想下载或检查代码：

- [手动试验入口](../Qinglong/lazing_jd_plant_trial.js)
- [任务请求适配器](../Qinglong/function/plant-trial.js)

## 遇到失败怎样处理

首次HTTP403或业务拒绝后，本账号后续的六个任务接口停止，不自动重试、不切换签名路径。不会将HTTP200一律视为任务成功；必须有明确的 `success: true`。日志中的 `accepted` 仅表示接口接受请求，奖励数量和最终完成状态仍由原脚本及App页面确认。

领取或任务提交前保存待确认记录；超时、网络断开、非JSON或5xx等情况保留记录，下次运行也停止任务提交。记录在 `LAZING_JD_DATA_DIR`（默认 `/ql/data/lazing-jd`）下对应账号摘要的 `plant-trial/state.json`。确认App状态前不要清除此记录。每个账号有独立执行锁；正常退出会释放。强制终止残留锁时，确认没有试验任务运行后再清理 `running.lock`，保留 `state.json`。原Faker入口没有使用本试验锁，所以两者不要同时执行。

本版严格对应2026-10-17核查的Faker文件：Git blob `bf4ca209095e54bdffa22ec8774e943022f4632c`，原文件SHA256 `a978aa759131844225a727844e1e57c5272b9fae15ad3dfbded3ac6f1f8dccca`。适配器版本2026-10-17.2修正了核查副本末尾多一个换行导致正常原版被误拒绝的问题。校验时只兼容开头BOM、LF/CRLF换行和文件末尾空白，规范化SHA256为 `0e0f582b8f1ab05cc666bad46342e6a82cd60e956eabb9a0a1905c4d62b8748d`；不修改磁盘上的Faker文件。若订阅更新改变代码内容，试验入口仍会停止并提示核查及摘要前12位，避免错误注入。没有静默回退到原来的403请求。

## 离线验证和构建

`node Qinglong/plant-trial-test.cjs` 验证两版SDK生成签名、账号和环境一致性、先查询再提交、浏览开始与完成顺序、403停止、业务拒绝、未确认提交跨运行保留、并发锁和网络目标限制。测试全部使用虚构凭据、模拟任务接口，不执行上游Faker代码，不向京东发送账号请求。

可选设置 `FAKER_PLANT_SOURCE` 指向核查的原 `jd_plantBean.js`，再运行测试，额外检查官方Git blob与原文件摘要、BOM/CRLF/末尾空白兼容、代码变化仍被拒绝、唯一注入位置和完整脚本语法；仍不执行原脚本。

构建签名依赖：`node Tools/build-qinglong-plant-signer.cjs`。从当前 `Qinglong/function/jd-core.js` 中提取已有的SDK、浏览器和环境检查代码，加上 `Tools/plant-signer-wrapper.js`；不包含签到业务入口，不下载或执行外部签名服务。
