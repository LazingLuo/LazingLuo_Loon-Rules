function environment(profile,pin){
 const template=profile.interaction&&profile.interaction.referenceEnvironmentEncoded?profile.interaction:profile.query;
 if(!template||!template.referenceEnvironmentEncoded)throw Error('缺少手机签名环境，请同步刮卡或PLUS活动凭据');
 const env=jdcDecodeEnvironment(template.referenceEnvironmentEncoded);
 let decoded;try{decoded=decodeURIComponent(pin);}catch(_){throw Error('账号编码错误');}
 if(!env.pp.p1||![pin,decoded].includes(env.pp.p1))throw Error('签名环境账号不匹配');
 return env;
}
function sign(params,appId,profile,pin){
 const reference=environment(profile,pin);
 // ai identifies the signing application, rather than the phone. The source
 // device context is cross-activity and remains experimental for plant tasks.
 if(Object.prototype.hasOwnProperty.call(reference,'ai'))reference.ai=appId;
 const browser=jdcInstallBrowser({pin,headers:profile.headers});
 const input={};
 for(const field of ['appid','body','client','clientVersion','functionId','t']){
  if(typeof params[field]!=='string'||!params[field])throw Error('任务签名参数不完整');
  input[field]=field==='body'?crypto.createHash('sha256').update(params[field]).digest('hex'):params[field];
 }
 const out=jdcMakeSigner(appId,browser,undefined,reference).signSync(input);
 const parts=String(out.h5st||'').split(';');
 if(parts.length!==10||parts[2]!==appId||parts[5]!=='5.3')throw Error('任务签名生成失败');
 const check=jdcDecodeEnvironment(parts[7]);
 if(check.v!==reference.v||check.fp!==parts[1]||JSON.stringify(check.pp)!==JSON.stringify(reference.pp)||check.canvas!==reference.canvas||check.webglFp!==reference.webglFp)throw Error('任务签名环境一致性检查失败');
 return {h5st:out.h5st,version:reference.v};
}
module.exports={sign,environment};
