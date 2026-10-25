# 京东开屏日期过期版

用于替换现有 `Scripts/jd-splash.js` 和 `Plugins/jd_open.plugin`。更新京东开屏插件后使用，不要与旧版同时启用。

只处理 `api.m.jd.com/client.action?functionId=start` 的成功 JSON 响应，在 `images` 数组中的素材条目上，把完整有效的 `onlineTime`、`referralsTime` 日期对改为 2000-01-01 至 2000-01-02。其他字段，包括素材地址、展示次数、`startTimeStamp` 和 `endTimeStamp` 保留。缺少顶层 `showTimesDaily` 也可处理，因为客户端日期解析不以该字段存在为条件。

修改后通知：“京东开屏 / 已处理 N 条配置 / 展示日期已设为过期”。空配置、已处理的配置只记简短日志。

依据用户提供的京东16.0.0安装包：

- `LaunchAnimationManagerHelper.launchRequestModel` 与 `LaunchAnimationRPCUtil.requestWithfinish:fail:` 都使用 `start`。
- `OpertationPicModel.initDataWithDic:` 按 `Asia/Shanghai`、`yyyy-MM-dd HH:mm:ss` 解析这两个日期。
- `LaunchAnimationManager.checkAdModelValid:startViewModel:` 在当前时间早于上线、晚于结束时拒绝展示。
- `LaunchAnimationManagerHelper.downloadImageType:path:modelPath:operationModel:` 先用结束日期调用 `isDateOk:`；已过期则跳过这里的图片下载。所以改为已过期比把开始、结束都推迟到2099年多覆盖了这一处下载检查。
- 每日次数限制小于1时，`showCountLessThanMaxDailyCount` 返回允许继续；因此保留次数，不将0作为关闭广告开关。

仍需手机实测：用户现用16.1.50；本结论来自16.0.0的上述代码路径。不能保证其他资源下载分支都跳过，不能直接擦除App已保存的缓存，也不能在无法解密请求时生效。已有缓存可能先展示，待后续 `start` 配置刷新后再观察。无需屏蔽应用DNS或卸载重装。

没有新增广泛API探测规则，与现有排除 `start` 的京东凭据获取规则保持相同分工。不修改请求，不读取或保存Cookie，不联网请求，不上传用户文件。

验证：运行 `node test.cjs`。该检查在本地使用合成响应，覆盖日期类型、非法日期、非目标接口、未知字段保留、重复处理、数组结构及异常回退；通过不等于手机广告已被验证拦截。
