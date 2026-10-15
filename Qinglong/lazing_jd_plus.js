/*
京东PLUS盲盒（独立版）
2 0 * * * lazing_jd_plus.js
*/
'use strict';
require('./function/runtime').main('blindbox').then(code=>{process.exitCode=code;}).catch(()=>{console.log('京东PLUS盲盒：运行失败，请检查安装文件');process.exitCode=1;});
