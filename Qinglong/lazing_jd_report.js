/*
name: 京东每日22点日报
0 22 * * * lazing_jd_report.js
任务命令请在末尾加 now，跳过青龙的签到随机等待。
*/
'use strict';
require('./function/report').main().then(code=>{process.exitCode=code;}).catch(()=>{console.log('[京东日报] 运行异常，请检查安装文件');process.exitCode=1;});
