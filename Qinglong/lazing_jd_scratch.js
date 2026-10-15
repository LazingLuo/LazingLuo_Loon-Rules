/*
京东每日刮卡（独立版）
7 0 * * * lazing_jd_scratch.js
*/
'use strict';
require('./function/runtime').main('scratch').then(code=>{process.exitCode=code;}).catch(()=>{console.log('京东每日刮卡：运行失败，请检查安装文件');process.exitCode=1;});
