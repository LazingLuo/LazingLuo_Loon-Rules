// Capture/refresh this activity only; no requests, independent storage.
const JX_PAGE="2iqSwv1JiDHxAkHAikfU6XAECFmo";
const JX_CRAFT="6824629a7c46584759d39b78";
const JX_SIGN_APP="c50cc";
const JX_ENCODING="qbkgHGHQ8GlOIyVOF6JQ8G1P5WFW3yVSC61T-bEQGGlQI6ZNHuFT-bVR7qUT";
const JX_ACCOUNT='JXZY_CHECKIN_ACCOUNT_V1',JX_LAST='JXZY_CHECKIN_LAST_RESULT_V1';
const JX_HISTORY='JXZY_CHECKIN_HISTORY_V1',JX_LOCK='JXZY_CHECKIN_LOCK_V1',JX_ATTEMPT='JXZY_CHECKIN_ATTEMPT_V1';
function jxRead(key,fallback){const text=$persistentStore.read(key);if(!text)return fallback;try{return JSON.parse(text);}catch(_){throw new Error('京喜本地记录无法解析，请重新获取凭据');}}
function jxWrite(key,value){if(!$persistentStore.write(JSON.stringify(value),key))throw new Error('京喜本地记录保存失败');}
function jxDay(){return new Date(Date.now()+8*3600000).toISOString().slice(0,10);}
function jxCookie(text,name){const m=String(text||'').match(new RegExp('(?:^|;\\s*)'+name+'=([^;]+)'));return m?m[1]:'';}
function jxHeader(headers,name){const key=Object.keys(headers||{}).find(k=>k.toLowerCase()===name.toLowerCase());return key?headers[key]:'';}
function jxForm(params){return Object.keys(params).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(params[k])).join('&');}
function jxParseForm(text){const out={};String(text||'').split('&').forEach(part=>{if(!part)return;const n=part.indexOf('='),decode=s=>decodeURIComponent(s.replace(/\+/g,' '));out[decode(n<0?part:part.slice(0,n))]=decode(n<0?'':part.slice(n+1));});return out;}
function jxEndpoint(url){if(!/^https:\/\/api\.m\.jd\.com\/api(?:\?|$)/.test(String(url)))throw new Error('京喜签到接口来源不符');return 'https://api.m.jd.com/api';}
function jxReferer(url){return new RegExp('^https://pro\\.m\\.jd\\.com/mall/active/'+JX_PAGE+'/index\\.html(?:\\?|$)').test(String(url||''));}
function jxAccepted(data){return !!data&&String(data.code)==='0'&&!!data.data&&typeof data.data==='object'&&!Array.isArray(data.data);}
function jxMessage(data){return String(data&& (data.msg||data.message||data.errMsg)||'无说明').replace(/https?:\/\/\S+/g,'[链接]').slice(0,120);}
function jxCount(value){const n=Number(value);return value!==null&&value!==undefined&&value!==''&&Number.isInteger(n)&&n>=0&&n<=10000?n:null;}
function jxStatus(data){
 if(!jxAccepted(data))throw new Error('京喜签到查询失败：'+String(data&&data.code)+' '+jxMessage(data));
 const d=data.data,status=jxCount(d.status),days=jxCount(d.alreadySignDays);
 if(days===null||![1,2].includes(status)||typeof d.itemId!=='string'||! /^[A-Za-z0-9_-]{1,128}$/.test(d.itemId))throw new Error('京喜签到状态不明确，请查看日志');
 const list=d.signList;
 if(list!==undefined&&!Array.isArray(list))throw new Error('京喜签到记录结构变化，请查看日志');
 const today=Array.isArray(list)&&list.some(x=>typeof x==='string'&&x.startsWith(jxDay()+'_'));
 if((status===2&&!today)||(status===1&&today))throw new Error('京喜签到状态与今日记录不一致，请查看日志');
 return {done:status===2,days,itemId:d.itemId};
}
function jxStateDetails(data){
 const d=data&&data.data||{},list=d.signList;
 return {status:jxCount(d.status),roundDays:jxCount(d.alreadySignDays),totalDays:jxCount(d.totalSignDays),
  todayRecorded:Array.isArray(list)?list.some(x=>typeof x==='string'&&x.startsWith(jxDay()+'_')):false};
}
function jxRewards(data){
 const rows=data&&data.data&&data.data.prizeInfos;
 let beans=0,couponAmount=0,couponCount=0;
 if(Array.isArray(rows))for(const row of rows){
  if(!row||row.discount===null||row.discount===undefined||row.discount==='')continue;
  const amount=Number(row.discount);if(!Number.isFinite(amount)||amount<=0||amount>100000)continue;
  if(Number(row.prizeType)===2&&Number.isInteger(amount))beans+=amount;
  if(Number(row.prizeType)===1){couponAmount+=amount;couponCount++;}
 }
 return {beanQuantity:beans,couponAmount:Number(couponAmount.toFixed(2)),couponCount};
}
function jxSummary(r){
 if(r.status==='signed_confirmed'||r.status==='already_done'){
  let text=r.status==='already_done'?'今天已签到':r.beanQuantity>0?'获得 '+r.beanQuantity+' 京豆':r.couponCount>0?'获得优惠券，面额合计 '+r.couponAmount+' 元':'已签到，奖励见活动页';
  if(r.roundDays>0)text+='，本轮第 '+r.roundDays+' 天';return '签到成功，'+text+'。';
 }
 if(r.status==='claim_success_verify_unconfirmed')return '领取返回成功，状态复查未确认，请查看活动页。';
 if(/签名环境版本不兼容|签名环境结构不完整/.test(r.message||''))return '签到失败，签名环境不兼容，请查看日志。';
 if(/凭据|未登[录陆]|登录|账号/.test(r.message||''))return '签到失败，凭据可能失效或不完整，请重新获取京喜凭据。';
 return '签到失败，请查看执行日志或最近结果。';
}
function jxCapturedBody(params,kind){
 if(!params||params.appid!=='jx_h5_babel'||params.channel!=='jxh5'||params.client!=='jxh5')throw new Error('京喜活动请求来源不符');
 const b=JSON.parse(params.body||'{}');
 if(kind==='environment'){
  if(params.functionId!=='jxzy_active_queryActive'||b.pageId!==JX_PAGE)throw new Error('京喜页面签名环境来源不符');
 }else if(b.source!=='jxzy'||b.craftId!==JX_CRAFT||params.functionId!==(kind==='query'?'jxzy_active_querySign':'jxzy_active_drawSign'))throw new Error('京喜签到活动模板不符');
 if(Number(b.sceneval)!==2||Number(b.buid)!==325||typeof b.appCode!=='string'||!b.appCode)throw new Error('京喜页面参数不完整');
 return b;
}
function jxObservedAt(){const value=typeof $script!=='undefined'&&$script.startTime?Number(new Date($script.startTime)):NaN;return Number.isFinite(value)&&value>0&&value<=Date.now()?value:Date.now();}
// Public frontend HMAC-MD5 implementation and parameter ordering.
// Source: https://storage11.360buyimg.com/ifloors/00038951/static/js/main.2eeb94e2.js
function jxBodySign(body){
function Ae(e,t){var n=(65535&e)+(65535&t);return(e>>16)+(t>>16)+(n>>16)<<16|65535&n}function He(e,t,n,r,o,i){return Ae((a=Ae(Ae(t,e),Ae(r,i)))<<(c=o)|a>>>32-c,n);var a,c}function Ne(e,t,n,r,o,i,a){return He(t&n|~t&r,e,t,o,i,a)}function Le(e,t,n,r,o,i,a){return He(t&r|n&~r,e,t,o,i,a)}function Je(e,t,n,r,o,i,a){return He(t^n^r,e,t,o,i,a)}function Be(e,t,n,r,o,i,a){return He(n^(t|~r),e,t,o,i,a)}function Me(e,t){var n,r,o,i,a;e[t>>5]|=128<<t%32,e[14+(t+64>>>9<<4)]=t;var c=1732584193,u=-271733879,s=-1732584194,l=271733878;for(n=0;n<e.length;n+=16)r=c,o=u,i=s,a=l,c=Ne(c,u,s,l,e[n],7,-680876936),l=Ne(l,c,u,s,e[n+1],12,-389564586),s=Ne(s,l,c,u,e[n+2],17,606105819),u=Ne(u,s,l,c,e[n+3],22,-1044525330),c=Ne(c,u,s,l,e[n+4],7,-176418897),l=Ne(l,c,u,s,e[n+5],12,1200080426),s=Ne(s,l,c,u,e[n+6],17,-1473231341),u=Ne(u,s,l,c,e[n+7],22,-45705983),c=Ne(c,u,s,l,e[n+8],7,1770035416),l=Ne(l,c,u,s,e[n+9],12,-1958414417),s=Ne(s,l,c,u,e[n+10],17,-42063),u=Ne(u,s,l,c,e[n+11],22,-1990404162),c=Ne(c,u,s,l,e[n+12],7,1804603682),l=Ne(l,c,u,s,e[n+13],12,-40341101),s=Ne(s,l,c,u,e[n+14],17,-1502002290),c=Le(c,u=Ne(u,s,l,c,e[n+15],22,1236535329),s,l,e[n+1],5,-165796510),l=Le(l,c,u,s,e[n+6],9,-1069501632),s=Le(s,l,c,u,e[n+11],14,643717713),u=Le(u,s,l,c,e[n],20,-373897302),c=Le(c,u,s,l,e[n+5],5,-701558691),l=Le(l,c,u,s,e[n+10],9,38016083),s=Le(s,l,c,u,e[n+15],14,-660478335),u=Le(u,s,l,c,e[n+4],20,-405537848),c=Le(c,u,s,l,e[n+9],5,568446438),l=Le(l,c,u,s,e[n+14],9,-1019803690),s=Le(s,l,c,u,e[n+3],14,-187363961),u=Le(u,s,l,c,e[n+8],20,1163531501),c=Le(c,u,s,l,e[n+13],5,-1444681467),l=Le(l,c,u,s,e[n+2],9,-51403784),s=Le(s,l,c,u,e[n+7],14,1735328473),c=Je(c,u=Le(u,s,l,c,e[n+12],20,-1926607734),s,l,e[n+5],4,-378558),l=Je(l,c,u,s,e[n+8],11,-2022574463),s=Je(s,l,c,u,e[n+11],16,1839030562),u=Je(u,s,l,c,e[n+14],23,-35309556),c=Je(c,u,s,l,e[n+1],4,-1530992060),l=Je(l,c,u,s,e[n+4],11,1272893353),s=Je(s,l,c,u,e[n+7],16,-155497632),u=Je(u,s,l,c,e[n+10],23,-1094730640),c=Je(c,u,s,l,e[n+13],4,681279174),l=Je(l,c,u,s,e[n],11,-358537222),s=Je(s,l,c,u,e[n+3],16,-722521979),u=Je(u,s,l,c,e[n+6],23,76029189),c=Je(c,u,s,l,e[n+9],4,-640364487),l=Je(l,c,u,s,e[n+12],11,-421815835),s=Je(s,l,c,u,e[n+15],16,530742520),c=Be(c,u=Je(u,s,l,c,e[n+2],23,-995338651),s,l,e[n],6,-198630844),l=Be(l,c,u,s,e[n+7],10,1126891415),s=Be(s,l,c,u,e[n+14],15,-1416354905),u=Be(u,s,l,c,e[n+5],21,-57434055),c=Be(c,u,s,l,e[n+12],6,1700485571),l=Be(l,c,u,s,e[n+3],10,-1894986606),s=Be(s,l,c,u,e[n+10],15,-1051523),u=Be(u,s,l,c,e[n+1],21,-2054922799),c=Be(c,u,s,l,e[n+8],6,1873313359),l=Be(l,c,u,s,e[n+15],10,-30611744),s=Be(s,l,c,u,e[n+6],15,-1560198380),u=Be(u,s,l,c,e[n+13],21,1309151649),c=Be(c,u,s,l,e[n+4],6,-145523070),l=Be(l,c,u,s,e[n+11],10,-1120210379),s=Be(s,l,c,u,e[n+2],15,718787259),u=Be(u,s,l,c,e[n+9],21,-343485551),c=Ae(c,r),u=Ae(u,o),s=Ae(s,i),l=Ae(l,a);return[c,u,s,l]}function qe(e){var t,n="",r=32*e.length;for(t=0;t<r;t+=8)n+=String.fromCharCode(e[t>>5]>>>t%32&255);return n}function Ue(e){var t,n=[];for(n[(e.length>>2)-1]=void 0,t=0;t<n.length;t+=1)n[t]=0;var r=8*e.length;for(t=0;t<r;t+=8)n[t>>5]|=(255&e.charCodeAt(t/8))<<t%32;return n}function Fe(e){return qe(Me(Ue(e),8*e.length))}function Ge(e){var t,n,r="";for(n=0;n<e.length;n+=1)t=e.charCodeAt(n),r+="0123456789abcdef".charAt(t>>>4&15)+"0123456789abcdef".charAt(15&t);return r}function Ve(e){return unescape(encodeURIComponent(e))}function ze(e){return Fe(Ve(e))}function Ke(e,t){return function(e,t){var n,r,o=Ue(e),i=[],a=[];for(i[15]=a[15]=void 0,o.length>16&&(o=Me(o,8*e.length)),n=0;n<16;n+=1)i[n]=909522486^o[n],a[n]=1549556828^o[n];return r=Me(i.concat(Ue(t)),512+8*t.length),qe(Me(a.concat(r),640))}(Ve(e),Ve(t))}var $e=function(e,t,n,r){return r?Fe(e):t?n?Ke(t,e):Ge(Ke(t,e)):n?ze(e):Ge(ze(e))};function Xe(e){var t=function(e){var t="";for(var n in e){var r=e[n];r instanceof Object&&(r=JSON.stringify(r)),null!=r&&null!=r&&("number"==typeof r||"boolean"==typeof r||""!=r)&&(t+="&"+r)}return t=t.substring(1,t.length)}(function(e){var t=[],n=0;for(var r in e)t[n]=r,n++;var o=t.sort(),i={};for(var a in o)i[o[a]]=e[o[a]];return i}(e=JSON.parse(e)));return function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},n=t.key,r=void 0===n?null:n,o=t.raw,i=void 0!==o&&o;return $e(e,r,i)}(t=t.toString(),{key:"xtl_sqg_mall-^&*-damai_(789)_@#$"})}
const clean=Object.assign({},body);delete clean.signStr;return Xe(JSON.stringify(clean));
}
// Decode this SDK's reversed custom Base64 locally. Never log decoded values.
function jxDecodeEnvironment(encoded) {
  const map='rqponmlkjihgfedcbaZYXWVUTSRQPONMLKJIHGFEDCBA-_9876543210zyxwvuts';
  if(typeof encoded!=='string'||encoded.length<16||encoded.length>12000)throw new Error('原始签名环境长度异常');
  let bits=0,value=0,bytes=[];
  for(let i=encoded.length-1;i>=0;i--) {
    const n=map.indexOf(encoded[i]);
    if(n<0)throw new Error('原始签名环境编码不符');
    value=(value<<6)|n;bits+=6;
    if(bits>=8){bits-=8;bytes.push(value>>>bits&255);}
  }
  // encode() appends padding data. Extract only the complete JSON object.
  const first=bytes.indexOf(123),last=bytes.lastIndexOf(125);
  if(first<0||last<=first)throw new Error('原始签名环境不是 JSON');
  const json=decodeURIComponent(bytes.slice(first,last+1).map(b=>'%'+b.toString(16).padStart(2,'0')).join(''));
  const env=JSON.parse(json);
  if(!env||typeof env!=='object'||Array.isArray(env)||!env.extend||typeof env.extend!=='object'||Array.isArray(env.extend)||!env.pp||typeof env.pp!=='object'||Array.isArray(env.pp)||typeof env.fp!=='string')throw new Error('签名环境结构不完整，请保留当前凭据以便排查');
  if(!['h5_file_v5.3.5','h5_file_v5.3.6'].includes(env.v)){
    // Version identifiers are safe to report; never log decoded device/account data.
    const version=typeof env.v==='string'&&/^h5_file_v[0-9.]{1,24}$/.test(env.v)?env.v:'缺失或无法识别';
    throw new Error('签名环境版本不兼容：'+version+'；当前脚本支持h5_file_v5.3.5、h5_file_v5.3.6');
  }
  return env;
}
(function(){
 let manualCapture=false;
 try{
  if(typeof $request==='undefined'||typeof $response==='undefined'||$request.method!=='POST'||Number($response.status)!==200)return;
  let options=typeof $argument==='object'&&$argument&&!Array.isArray($argument)?$argument:{};
  if(typeof $argument==='string'&&$argument.trim().startsWith('{'))options=JSON.parse($argument);
  const enabled=v=>v===true||v==='true',capture=enabled(options.capture),refresh=options.refreshLogin===undefined?true:enabled(options.refreshLogin);
  manualCapture=capture;
  if(!capture&&!refresh)return;
  const endpoint=jxEndpoint($request.url),params=Object.assign(jxParseForm(($request.url.split('?')[1]||'').split('#')[0]),jxParseForm($request.body));
  const kind={jxzy_active_querySign:'query',jxzy_active_drawSign:'claim',jxzy_active_queryActive:'environment'}[params.functionId];
  if(!kind)return;
  const body=jxCapturedBody(params,kind),data=JSON.parse($response.body||'{}');
  if(!jxAccepted(data))return;
  if(typeof body.signStr!=='string'||body.signStr!==jxBodySign(body))throw new Error('京喜页面签名规则变化，保留原凭据');
  if(kind==='query')jxStatus(data);
  if(kind==='claim'&&(!Array.isArray(data.data.signList)||!data.data.signList.some(x=>typeof x==='string'&&x.startsWith(jxDay()+'_'))))return;
  const headers={};['Cookie','User-Agent','Referer','Origin','x-rp-client','x-referer-page','request-from'].forEach(k=>{const value=jxHeader($request.headers,k);if(value)headers[k]=value;});
  const pin=jxCookie(headers.Cookie,'pt_pin');
  if(!pin||!jxCookie(headers.Cookie,'pt_key')||!headers['User-Agent']||!jxReferer(headers.Referer))throw new Error('京喜登录或页面凭据不完整');
  const previous=jxRead(JX_ACCOUNT,null);
  if(!capture&&(!previous||previous.pin!==pin))return;
  const observedAt=jxObservedAt();
  if(previous&&previous.pin===pin&&observedAt<Number(previous.updatedAt||0))return;
  const profile=previous&&previous.pin===pin?previous:{pin};
  const wasReady=!!(profile.query&&profile.signing);
  if(kind!=='query'){
   const parts=String(params.h5st||'').split(';'),expected=kind==='claim'?JX_SIGN_APP:'832f1';
   if(parts.length!==10||parts[5]!=='5.3'||parts[2]!==expected||kind==='claim'&&parts[9]!==JX_ENCODING)throw new Error('京喜签名版本或参数集合变化，保留原凭据');
   const env=jxDecodeEnvironment(parts[7]);
   if(!env.pp.p1||![pin,decodeURIComponent(pin)].includes(env.pp.p1))throw new Error('京喜签名环境账号不匹配');
   profile.signing={environment:parts[7],capturedAt:Date.now(),source:params.functionId,eidToken:params['x-api-eid-token']||''};
  }
  const clean=Object.assign({},params);delete clean.h5st;delete clean.t;
  delete body.time;delete body.signStr;clean.body=JSON.stringify(body);
  if(kind!=='environment')profile[kind]={endpoint,params:clean,capturedAt:Date.now()};
  profile.headers=headers;profile.updatedAt=observedAt;profile.capturedAt=Date.now();
  jxWrite(JX_ACCOUNT,profile);
  console.log('[京喜自营签到] '+(capture?'已获取':'已刷新')+'本插件的'+({query:'查询模板',claim:'领取模板与签名环境',environment:'页面签名环境'}[kind])+'，完整='+!!(profile.query&&profile.signing));
  if(!wasReady&&profile.query&&profile.signing)$notification.post('京喜自营签到','凭据已保存','可关闭获取开关，执行一次手动签到。');
 }catch(e){
  const message=/^(京喜|签名环境|原始签名环境)/.test(String(e.message))?String(e.message).slice(0,140):'凭据获取未完成，请查看页面请求';
  console.log('[京喜自营签到] '+message);
  if(manualCapture)$notification.post('京喜自营签到','凭据获取未完成',message);
 }finally{$done({});}
})();
