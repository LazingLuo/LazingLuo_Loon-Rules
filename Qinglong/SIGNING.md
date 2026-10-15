# 只提供 Cookie 的可行性核查

2026-10-15 静态检查 `shufflewzc/faker3` 的 `function/dylans.js`、`function/dylib.js`、`function/getToken.js` 及 `jd_signbeanact_.js`。只解析公开源代码和字符串表，没有执行混淆模块、没有发送用户 Cookie，也没有尝试领取。

## 已确认

`function/dylans.js` 导出了 `getbody`、`H5ST`、`api`。其中可读出的 H5ST 类包含 `__genFp`、`__genAlgo`、`__genKey`、`__genH5st`：自行生成指纹，向 `https://cactus.jd.com/request_algo?g_ty=ajax` 发出 POST，读取返回的 token/算法相关数据并生成签名。该处请求体的 version 为 `4.7`，platform 为 `web`。

`function/dylib.js` 可读出的 `getfpb` 方法向 `https://blackhole.m.jd.com/getinfo` 发 POST，使用 Cookie，并从响应读取 `whwswswws`；`buildck` 等公共方法还会拼装设备相关 Cookie。它显示“由脚本申请或构造参数”这一途径确实存在。

以上是公共函数的能力，不等于每一个 Faker 任务都会调用这些函数，也不证明这条 `4.7` 签名路径适用于当前三个活动。库内还有其他方法，本次没有完成每个混淆分支及外部模块的完整调用链审计，不能断言所有 Faker 任务均不依赖外部服务。

当前三个自有任务沿用的流程涉及 `h5st` 的 `5.3` 协议，环境版本为已核查的 `h5_file_v5.3.5` / `h5_file_v5.3.6`；京喜还另有活动请求体签名。不能只替换一个版本号，把公共库的旧路径直接用于领取。

## 对现有方案的判断

请求模板可以固化为代码，活动任务编号可以查询后取得；时间戳和部分指纹、签名参数也能在本地生成。当前要求同步手机记录，是自有脚本采取的实现方案，不能据此认定京东服务端一定强制要求手机抓包。

尚待验证的是：三个当前接口能否接受自行生成的完整环境、相关设备令牌能否从官方接口自动获得，以及查询和领取是否需要不同的上下文。没有这些验证，不能宣称只用 Cookie 已实现，或据此取消现有可核查的签名路径。

后续若验证简化路径，应先用最新同账号 Cookie 验证只读查询，再验证单次领取与奖励复查；结果不明确时保留提交记录，不自动换路径重试领取。兼容版和简化版共用同一提交记录，避免切换后重复操作。

公开源文件：

- [Faker H5ST 公共函数](https://github.com/shufflewzc/faker3/blob/main/function/dylans.js)
- [Faker 设备与 Cookie 公共函数](https://github.com/shufflewzc/faker3/blob/main/function/dylib.js)
- [Faker 天天领豆任务](https://github.com/shufflewzc/faker3/blob/main/jd_signbeanact_.js)
