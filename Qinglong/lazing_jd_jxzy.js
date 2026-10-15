/*
京喜自营签到（独立版）
12 0 * * * lazing_jd_jxzy.js
*/
'use strict';
require('./function/runtime').main('jxzy').then(code=>{process.exitCode=code;}).catch(()=>{console.log('京喜自营签到：运行失败，请检查安装文件');process.exitCode=1;});
