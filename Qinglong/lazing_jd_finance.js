/*
京东金融签到＋双签礼包（独立版）
0 1 * * * lazing_jd_finance.js
*/
'use strict';
require('./function/runtime').main('finance').then(code=>{process.exitCode=code;}).catch(()=>{console.log('京东金融签到＋双签：运行失败，请检查安装文件');process.exitCode=1;});
