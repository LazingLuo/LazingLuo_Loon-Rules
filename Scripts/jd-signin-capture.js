// Passive consolidated capture; original response unchanged.
// Fixed signup scope. Activity/gameplay task execution is deliberately absent.
const JS_VERSION='2026-10-24.1';
const JS_KEYS={login:'JD_SIGNIN_LOGIN_V1',extra:'JD_SIGNIN_EXTRA_ACCOUNT_V1',bound:'JD_SIGNIN_ACCOUNT_V1',last:'JD_SIGNIN_LAST_V1',history:'JD_SIGNIN_HISTORY_V1',lock:'JD_SIGNIN_LOCK_V1',attempts:'JD_SIGNIN_ATTEMPTS_V1'};
const JS_TASKS=[['daily','普通签到'],['scratch','每日刮卡'],['blindbox','PLUS盲盒'],['plant','种豆礼包'],['jxzy','京喜签到'],['finance','金融签到＋双签'],['hs','hs签到'],['ys','ys签到'],['delivery','天天领豆'],['game','互动游戏签到']];
const JS_GAME='MWC_-5cWq-JH1wrPPteH4w';
const JS_HEALTH={hs:{activityId:'37252',appKey:'250520900001'},ys:{activityId:'34703',appKey:'250141600001'}};
const jsClone=x=>JSON.parse(JSON.stringify(x));
const jsDay=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
function jsHeader(h,k){const key=Object.keys(h||{}).find(x=>x.toLowerCase()===k.toLowerCase());return key?h[key]:'';}
function jsPair(value){
 const p=String(value||'').split(';').map(x=>x.trim()).filter(Boolean),keys=p.filter(x=>x.startsWith('pt_key=')),pins=p.filter(x=>x.startsWith('pt_pin='));
 if(keys.length!==1||pins.length!==1||!keys[0].slice(7)||!pins[0].slice(7)||/[\s\r\n]/.test(keys[0]+pins[0]))return null;
 return {pin:pins[0].slice(7),cookie:keys[0]+';'+pins[0]+';'};
}
function jsMergeCookie(original,login){const p=jsPair(original);if(!p||p.pin!==login.pin)throw Error('账号不一致，请重新打开活动页面');return login.cookie+String(original).split(';').map(x=>x.trim()).filter(x=>x&&!/^pt_(?:key|pin)=/.test(x)).join(';')+';';}
function jsForm(text){const out={};for(const part of String(text||'').split('&')){if(!part)continue;const i=part.indexOf('='),key=decodeURIComponent((i<0?part:part.slice(0,i)).replace(/\+/g,' '));if(Object.prototype.hasOwnProperty.call(out,key))throw Error('请求参数重复');out[key]=decodeURIComponent((i<0?'':part.slice(i+1)).replace(/\+/g,' '));}return out;}
const jsEncode=p=>Object.keys(p).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(p[k])).join('&');
function jsParams(request){const url=String(request.url||''),query=url.includes('?')?jsForm(url.split('?')[1].split('#')[0]):{},body=jsForm(request.body),p={...query,...body};for(const k of Object.keys(query))if(body[k]!==undefined&&query[k]!==body[k])throw Error('请求参数不一致');return p;}
function jsEndpoint(url){const s=String(url||'').split('?')[0];if(!['https://api.m.jd.com/api','https://api.m.jd.com/client.action'].includes(s))throw Error('接口地址不符');return s;}
function jsSettings(value){let p=value;if(typeof p==='string'){try{p=JSON.parse(p);}catch(_){throw Error('等待参数格式错误');}}if(!p||typeof p!=='object'||Array.isArray(p))throw Error('请从签到插件运行');const gap=Number(p.gapSeconds===undefined?15:p.gapSeconds);if(!Number.isInteger(gap)||gap<0||gap>120||gap>0&&gap<5)throw Error('随机等待须填0或5–120秒');return {gap};}
function jsProfiles(read){const retail=read('JD_CHECKIN_TEST_ACCOUNT_V1',null),jx=read('JXZY_CHECKIN_ACCOUNT_V1',null),plant=read('JD_PLANT_CHECKIN_ACCOUNT_V1',null),finance=read('JD_JR_CHECKIN_ACCOUNT_V1',null);return {retail,jx,plant,finance};}
function jsLogin(read){
 const profiles=jsProfiles(read),bound=read(JS_KEYS.bound,null),candidates=[];
 const add=(p,headers,time)=>{const pair=jsPair(jsHeader(headers,'cookie'));if(pair&&(!p||p===pair.pin))candidates.push({...pair,headers,time:Number(time)||0});};
 for(const k of [JS_KEYS.login,'QL_BRIDGE_CREDENTIAL_V1']){const p=read(k,null);if(p?.pin&&p.cookie)add(p.pin,p.headers||{Cookie:p.cookie},p.capturedAt);}
 for(const p of Object.values(profiles.retail?.modes||{}))add(profiles.retail.pin,p.headers,p.loginUpdatedAt||p.capturedAt);
 if(profiles.jx)add(profiles.jx.pin,profiles.jx.headers,profiles.jx.loginUpdatedAt||profiles.jx.capturedAt);
 if(profiles.plant?.query)add(profiles.plant.pin,profiles.plant.query.headers,profiles.plant.query.loginUpdatedAt||profiles.plant.query.capturedAt);
 const pin=bound?.pin||read('QL_BRIDGE_ACCOUNT_V1',null)?.pin||profiles.retail?.pin||profiles.jx?.pin||profiles.plant?.pin||profiles.finance?.pin||candidates[0]?.pin;
 // Once the consolidated native capture exists, its observed timestamp and the
 // compatible generic login store are authoritative. Legacy captures timestamp
 // response handling, which could otherwise make a delayed old response win.
 const hasCanonical=read(JS_KEYS.login,null)?.pin===pin;
 const canonicalKeys=[JS_KEYS.login,'QL_BRIDGE_CREDENTIAL_V1'];
 const canonical=canonicalKeys.map(k=>read(k,null)).filter(p=>p?.pin===pin&&p.cookie).map(p=>({...jsPair(p.cookie),headers:p.headers||{Cookie:p.cookie},time:Number(p.capturedAt)||0})).filter(p=>p.pin===pin);
 const same=candidates.filter(p=>p.pin===pin).sort((a,b)=>b.time-a.time);const login=(hasCanonical?canonical.sort((a,b)=>b.time-a.time)[0]:same[0])||null;
 if(login){const context=same.find(p=>jsHeader(p.headers,'user-agent'));login.headers={...(context?.headers||{}),Cookie:jsMergeCookie(jsHeader(context?.headers,'cookie')||login.cookie,login)};}
 return {pin,login,profiles};
}
function jsLegacyAccount(task,pin,read,login){
 const key=task==='jxzy'?'JXZY_CHECKIN_ACCOUNT_V1':task==='plant'?'JD_PLANT_CHECKIN_ACCOUNT_V1':task==='finance'?'JD_JR_CHECKIN_ACCOUNT_V1':'JD_CHECKIN_TEST_ACCOUNT_V1';
 const p=read(key,null);if(!p)return {key,value:null};if(p.pin!==pin)throw Error('签到资料属于其他账号');const value=jsClone(p);
 if(login&&task!=='finance'){
  const apply=t=>{if(t?.headers){const name=Object.keys(t.headers).find(k=>k.toLowerCase()==='cookie');if(name){t.headers[name]=jsMergeCookie(t.headers[name],login);t.loginUpdatedAt=login.time;}}};
  if(task==='plant'){apply(value.query);apply(value.claim);}else if(task==='jxzy')apply(value);else Object.values(value.modes||{}).forEach(apply);
 }
 return {key,value};
}
const JS_ALLOWED={hs:['jdh_bm_getKitTask','jdh_msoa_doTaskGw'],ys:['jdh_bm_getKitTask','jdh_msoa_doTaskGw'],delivery:['bean_deliverySign_home','bean_deliverySign_sign','bean_deliverySign_continue_award'],game:['weGameHome','weGameLottery']};
function jsTarget(task,o){
 const url=String(o.url||'');if(url==='https://cactus.jd.com/request_algo'){if(Object.keys(o.headers||{}).some(k=>/cookie|authorization/i.test(k)))throw Error('签名初始化不得带登录凭据');return;}
 if(task==='finance'){
  if(/^https:\/\/aks\.jdpay\.com\/aar2\/getJS\?version=2\.1\.0&name=browser(?:&[^#]*)?$/.test(url)){if(Object.keys(o.headers||{}).some(k=>/cookie|authorization/i.test(k)))throw Error('签名初始化不得带登录凭据');return;}
  if(!['https://ms.jr.jd.com/gw2/generic/jrSign/h5/m/queryWeekSignMain','https://ms.jr.jd.com/gw2/generic/jrSign/h5/m/dailyCashSignReceive','https://ms.jr.jd.com/gw2/generic/legogw/h5/m/getPageInfoDoubleSignInForH5','https://ms.jr.jd.com/gw2/generic/DoubleSign/h5/m/jrSendSignAward'].includes(url))throw Error('金融接口地址不符');return;
 }
 jsEndpoint(url);const p=jsParams(o),f=p.functionId,b=JSON.parse(p.body||'{}');
 const allowed=JS_ALLOWED[task]||(task==='daily'?['findBeanSceneNew','bff_rightsCenter_interaction']:task==='scratch'?['bff_rightsCenter_jdInteractTask','bff_rightsCenter_interaction']:task==='blindbox'?['bff_marketing_interaction']:task==='jxzy'?['jxzy_active_querySign','jxzy_active_drawSign']:['weGameHome','weGameLottery']);
 if(!allowed.includes(f))throw Error('签到接口不符');
 if(task==='game'&&b.linkId!==JS_GAME||task==='plant'&&b.linkId!=='4HcenxuZM4XiHesOb1HG4g'||task==='delivery'&&!['2775','5358'].includes(String(b.activityId)))throw Error('签到活动不符');
 if(JS_HEALTH[task]){
  const query=f==='jdh_bm_getKitTask';
  if((query?b.m_patch_appKey:b.appKey)!==JS_HEALTH[task].appKey||b.channel!=='jdhapp'||query&&(b.groupCode!=='openkits'||p.appid!=='jdh-middle')||!query&&(!b.taskId||!b.encodeId||p.appid!=='JDHAPP'))throw Error('健康签到参数不符');
 }
}
function runRetailCapture(context){
const {$request,$response,$argument,$persistentStore,$notification,$script,$httpClient,console}=context;
const $done=()=>{};
// JD check-in test: local credential capture only.
const JDC_KEY = 'JD_CHECKIN_TEST_ACCOUNT_V1';
function jdcRead(key, fallback) {
  const raw = $persistentStore.read(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch (_) { throw new Error('本地数据损坏，请重新获取凭据'); }
}
function jdcWrite(key, value) {
  if (!$persistentStore.write(JSON.stringify(value), key)) throw new Error('本地保存失败');
}
function jdcParseForm(text) {
  const result = {};
  String(text || '').split('&').forEach(pair => {
    if (!pair) return;
    const i = pair.indexOf('=');
    const decode = s => decodeURIComponent(s.replace(/\+/g, ' '));
    result[decode(i < 0 ? pair : pair.slice(0, i))] = decode(i < 0 ? '' : pair.slice(i + 1));
  });
  return result;
}
function jdcForm(params) {
  return Object.keys(params).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');
}
function jdcHeader(headers, name) {
  const k = Object.keys(headers || {}).find(k => k.toLowerCase() === name.toLowerCase());
  return k ? headers[k] : '';
}
function jdcCookie(cookie, name) {
  const m = String(cookie).match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : '';
}
function jdcDay() { return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10); }
function jdcIsScratchQuery(params) {
  // This endpoint also serves ordinary sign-in. Only capture the observed
  // scratch-page task scope; commonScene=secKillChannel selects the ordinary task.
  try {
    const body=JSON.parse(params.body||'{}');
    const types=typeof body.taskType==='string'?body.taskType.split('_'):[];
    return body.scene==='jdInteractTask'&&types.includes('beanDailySign')&&types.includes('beanDailyPlus')&&
      (body.commonScene===undefined||body.commonScene==='');
  } catch (_) {return false;}
}
function jdcTask(data, mode) {
  const list = mode === 'daily' ? data && data.data && data.data.signComponentInfoResult
    : data && data.rs && data.rs.beanTask && data.rs.beanTask.taskList;
  if (!Array.isArray(list)) throw new Error('任务列表结构不符，未提交领取');
  const tasks = list.filter(t => Number(t.assignmentType) === 5 && t.ext && t.ext.taskType === 'beanDailySign' && t.encryptAssignmentId);
  if (tasks.length !== 1) throw new Error('每日任务无法唯一识别，未提交领取');
  return tasks[0];
}
function jdcLabel(mode) { return mode === 'query_compare' ? '环境对比查询（不领取）' : mode === 'diagnose' ? '本地签名诊断' : mode === 'daily' ? '普通签到' : mode === 'blindbox' ? 'PLUS每日盲盒' : '每日刮卡'; }
function jdcEndpoint(url) {
  const m = String(url).match(/^https:\/\/api\.m\.jd\.com\/(api|client\.action)(?:\?|$)/);
  if (!m) throw new Error('接口地址不符');
  return 'https://api.m.jd.com/' + m[1];
}

// The observed scratch query uses a business success code different from daily sign-in.
function jdcQueryAccepted(data, mode) {
  const code = String(data && data.code);
  if (code === '0') return true;
  return mode === 'scratch' && code === '1711000' && data.msg === '成功' &&
    !!(data.rs && data.rs.beanTask && Array.isArray(data.rs.beanTask.taskList));
}

function jdcBoxAccepted(data) {
  return !!data && String(data.code)==='1711000' && data.msg==='成功' && !!data.rs;
}
function jdcBoxToday(data) {
  if(!jdcBoxAccepted(data)||!Array.isArray(data.rs.sendBenefitList))
    throw new Error('盲盒奖励记录不完整，未继续开盒');
  return data.rs.sendBenefitList.filter(x=>String(x.prizeTime||'').slice(0,10)===jdcDay());
}
// Refresh only the shared login pair; preserve every activity's device/page context.
function jdcSyncLogin(state, cookie, source, observedAt) {
  const pin=jdcCookie(cookie,'pt_pin'),key=jdcCookie(cookie,'pt_key');
  if(!state||!state.modes||!pin||!key||state.pin!==pin)return false;
  let changed=false;
  for(const name of ['daily','scratch','blindbox']) {
    const profile=state.modes[name];
    if(!profile||!profile.headers||jdcCookie(profile.headers.Cookie,'pt_pin')!==pin)continue;
    const latest=Number(profile.loginUpdatedAt||profile.capturedAt||0);
    if(observedAt<latest)continue;
    const pairs=String(profile.headers.Cookie||'').split(';').map(x=>x.trim()).filter(Boolean);
    profile.headers.Cookie=pairs.filter(x=>!/^pt_(?:pin|key)=/.test(x)).concat(['pt_pin='+pin,'pt_key='+key]).join('; ');
    profile.loginUpdatedAt=observedAt;
    profile.loginSource=source;
    changed=true;
  }
  return changed;
}
function jdcLoginObservedAt() {
  const start=typeof $script!=='undefined'&&$script.startTime;
  const value=start?Number(new Date(start)):NaN;
  return Number.isFinite(value)&&value>0&&value<=Date.now()?value:Date.now();
}
(function () {
  try {
    if (typeof $request === 'undefined' || typeof $response === 'undefined') throw new Error('请通过插件响应规则获取凭据');
    if ($request.method !== 'POST' || Number($response.status) !== 200) return;
    const endpoint = jdcEndpoint($request.url);
    const query = jdcParseForm(($request.url.split('?')[1] || '').split('#')[0]);
    const params = Object.assign(query, jdcParseForm($request.body));
    const fid = params.functionId;
    let mode, kind;
    if (fid === 'findBeanSceneNew' && params.appid === 'signed_wh5_ihub') { mode = 'daily'; kind = 'query'; }
    else if (fid === 'bff_rightsCenter_jdInteractTask' && params.appid === 'plus_business') {
      if(!jdcIsScratchQuery(params))return;
      mode = 'scratch'; kind = 'query';
    }
    else if (fid === 'bff_marketing_interaction' && params.appid === 'plus_business') {
      const body=JSON.parse(params.body||'{}');
      if(body.scene==='blindBox' && ['purePlusIndexNew2608','plusIndexHistory'].includes(body.touchPoint)) kind='query';
      else if(body.scene==='commonReceiveBlindBox' && body.touchPoint==='purePlusIndex') kind='interaction';
      else return;
      mode='blindbox';
    }
    else if (fid === 'bff_rightsCenter_interaction') {
      const body = JSON.parse(params.body || '{}');
      if (body.activityCode !== 'beanDailySign' || body.scene !== 'commonDoInteractiveAssignment') return;
      if (params.appid === 'signed_wh5' && body.commonScene === 'secKillChannel') mode = 'daily';
      else if (params.appid === 'plus_business' && body.actionType === '100' && body.itemId === '') mode = 'scratch';
      else return;
      kind = 'interaction';
    } else return;
    const data = JSON.parse($response.body || '{}');
    if (mode==='blindbox' ? !jdcBoxAccepted(data) : (kind === 'query' ? !jdcQueryAccepted(data, mode) : String(data.code) !== '0')) return;
    if (kind === 'query' && mode!=='blindbox') jdcTask(data, mode);
    const sig = String(params.h5st || '').split(';');
    const expected = mode==='blindbox' ? '35fa0' : kind === 'query' && mode === 'daily' ? 'ed9a2' : mode === 'daily' ? '90b26' : 'b63ff';
    if (sig.length !== 10 || sig[5] !== '5.3' || sig[2] !== expected) throw new Error('签名版本或活动标识变化，请保留日志后反馈');
    const cookie = jdcHeader($request.headers, 'cookie');
    const pin = jdcCookie(cookie, 'pt_pin');
    if (!pin || !jdcCookie(cookie, 'pt_key')) throw new Error('未获取完整登录凭据');
    const headers = {};
    ['Cookie', 'User-Agent', 'Referer', 'Origin', 'x-rp-client', 'x-referer-page', 'request-from', 'x-babel-ihub', 'withcredentials', 'headers', 'swimlane', 'mark'].forEach(name => {
      const value = jdcHeader($request.headers, name);
      if (value) headers[name] = value;
    });
    if (!headers['User-Agent'] || !headers.Referer) throw new Error('缺少页面环境信息');
    delete params.h5st;
    const account = jdcRead(JDC_KEY, null);
    const state = account && account.pin === pin ? account : {pin, modes:{}};
    const previous = state.modes[mode] || {};
    const isNew = !previous[kind] || !previous[kind].referenceEnvironmentEncoded;
    previous[kind] = {endpoint, params, capturedAt:Date.now(), signatureAppId:expected, signatureParameterEncoding:sig[9], referenceEnvironmentEncoded:sig[7]};
    previous.headers = headers;
    previous.capturedAt = Date.now();
    state.modes[mode] = previous;
    jdcSyncLogin(state,cookie,'activity:'+mode,jdcLoginObservedAt());
    jdcWrite(JDC_KEY, state);
    console.log('[京东签到] 已保存' + jdcLabel(mode) + (kind === 'query' ? '任务查询凭据' : '领取请求模板') + '（未修改原请求）');
    if (isNew) $notification.post('京东签到测试', jdcLabel(mode) + '凭据已保存', kind === 'query' ? '可以在 Loon 中手动运行对应测试。' : '已保存领取模板；还需进入活动页面获取任务查询凭据。');
  } catch (e) {
    console.log('[京东签到] ' + e.message);
    $notification.post('京东签到测试', '凭据获取未完成', e.message);
  } finally { $done({}); }
})();

}
function runJxCapture(context){
const {$request,$response,$argument,$persistentStore,$notification,$script,$httpClient,console}=context;
const $done=()=>{};
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

}
function runFinanceCapture(context){
const {$request,$response,$argument,$persistentStore,$notification,$script,$httpClient,console}=context;
const $done=()=>{};
const ACCOUNT='JD_JR_CHECKIN_ACCOUNT_V1';
const day=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
const read=key=>{try{return JSON.parse($persistentStore.read(key)||'null');}catch(_){return null;}};
const save=(key,value)=>{if(!$persistentStore.write(JSON.stringify(value),key))throw Error('本地记录保存失败');};
const tell=message=>$notification.post('京东金融签到','',message);
  function form(text) {
    const obj = {};
    String(text || '').split('&').forEach(part => { const at = part.indexOf('='); if (at >= 0) obj[decodeURIComponent(part.slice(0, at).replace(/\+/g, ' '))] = decodeURIComponent(part.slice(at + 1).replace(/\+/g, ' ')); });
    return JSON.parse(obj.reqData || '{}');
  }
  function cashScope(params) {
    if(!params||!['JD_JR_APP','H5'].includes(params.site)||typeof params.channelSource!=='string'||!params.channelSource||!Number.isInteger(Number(params.signVersion))||Number(params.signVersion)<=0)return null;
    if(params.site==='JD_JR_APP'&&(!params.clientType||!params.clientVersion))return null;
    // App upgrades do not select another activity. Refresh clientVersion from
    // the latest query when signing, while keeping business/page scopes separate.
    return JSON.stringify(['site','channelSource','channelLv','signVersion','clientType'].map(k=>String(params[k]===undefined||params[k]===null?'':params[k])));
  }
  function loginPin(headers) {
    const cookie=headers&&headers.Cookie||'',pin=/(?:^|;\s*)pt_pin=([^;]+)/.exec(cookie);
    return pin&&/(?:^|;\s*)pt_key=[^;]+/.test(cookie)?pin[1]:null;
  }
  function safeCode(value){return /^[A-Za-z0-9_-]{1,32}$/.test(String(value))?String(value):null;}
  function body(response,trace) {
    if(trace){trace.apiCode=safeCode(response&&response.resultCode);trace.apiSuccess=!!response&&response.success===true;trace.businessCode=safeCode(response&&response.resultData&&response.resultData.resBusiCode);}
    if (!response || Number(response.resultCode) !== 0 || response.success !== true) throw new Error('接口请求失败：' + String(response && response.resultMsg || '查看日志'));
    const data = response.resultData;
    if (!data || Number(data.resBusiCode) !== 0 || !data.resBusiData) throw new Error('业务请求失败：' + String(data && data.resBusiMsg || '查看日志'));
    return data.resBusiData;
  }
  function doublePage(data){
    if(!data||data.hasError===true||!Array.isArray(data.resultList))throw new Error('双签状态结构异常');
    const rows=data.resultList.map(x=>x&&x.templateData&&x.templateData.data).filter(x=>x&&x.businessData&&Object.prototype.hasOwnProperty.call(x.businessData,'signInJd')&&Object.prototype.hasOwnProperty.call(x.businessData,'signInJr'));
    if(rows.length!==1||rows[0].businessCode!=='000sq')throw new Error('双签状态查询失败');
    const state=rows[0].businessData;
    if(String(state.dateTime||'').slice(0,10)!==day())throw new Error('双签状态日期异常');
    if(!['signInJd','signInJr','get'].every(k=>typeof state[k]==='boolean'))throw new Error('双签状态字段不完整');
    if(state.inconsistent===true)throw new Error('双签账号状态不一致，请到活动页检查');
    return state;
  }
  function capture() {
    const url = $request.url || '', endpoint = url.split('?')[0].split('/').pop();
    if($request.method!=='POST'||Number($response.status)!==200)return;
    if(endpoint==='getPageInfoDoubleSignInForH5'){
      if(!/^https:\/\/ms\.jr\.jd\.com\/gw2\/generic\/legogw\/h5\/m\/getPageInfoDoubleSignInForH5(?:\?|$)/.test(url))return;
      const response=JSON.parse($response.body),params=form($request.body);
      if(!response||response.success!==true||Number(response.resultCode)!==0||params.pageId!==11046)return;
      doublePage(response.resultData);
      const lower={};Object.keys($request.headers||{}).forEach(k=>{lower[k.toLowerCase()]=$request.headers[k];});
      const identity=/(?:^|;\s*)pt_pin=([^;]+)/.exec(lower.cookie||'');
      if(!identity||!/(?:^|;\s*)pt_key=[^;]+/.test(lower.cookie||''))throw new Error('双签登录凭据不完整');
      let profile=read(ACCOUNT)||{};if(profile.pin!==identity[1])profile={pin:identity[1]};
      const headers={Cookie:lower.cookie,'User-Agent':lower['user-agent']||'','Content-Type':'application/x-www-form-urlencoded',Origin:'https://member.jr.jd.com',Referer:'https://member.jr.jd.com/'};
      ['x-mlaas-at','sgm-context','x-rp-client'].forEach(k=>{if(lower[k])headers[k]=lower[k];});
      const first=!profile.doubleSign;
      profile.doubleSign={pin:profile.pin,headers,capturedAt:Date.now()};
      if(profile.headers)profile.headers.Cookie=lower.cookie;
      save(ACCOUNT,profile);console.log('[京东金融签到] 双签页面信息已更新');
      if(first)tell('双签页面信息已保存，金融签到后会检查双签礼包。');
      return;
    }
    if (!['queryWeekSignMain', 'queryCashSignSub', 'dailyCashSignReceive'].includes(endpoint)) return;
    if(!/^https:\/\/ms\.jr\.jd\.com\/gw2\/generic\/jrSign\/h5\/m\/(?:queryWeekSignMain|queryCashSignSub|dailyCashSignReceive)(?:\?|$)/.test(url))return;
    const response = JSON.parse($response.body), data = body(response), params = form($request.body);
    const scope=cashScope(params);
    if(!scope||endpoint==='dailyCashSignReceive'&&params.signType!=='sign')return;
    const h = {}; Object.keys($request.headers || {}).forEach(k => { h[k.toLowerCase()] = $request.headers[k]; });
    if (!h.cookie||!loginPin({Cookie:h.cookie})) throw new Error('没有取得完整登录Cookie');
    let profile = read(ACCOUNT) || {};
    const identity = /(?:^|;\s*)pt_pin=([^;]+)/.exec(h.cookie);
    if (!identity) throw new Error('没有取得账号标识');
    if (profile.pin !== identity[1]) profile = {};
    const priorScope=profile.scopeKey||cashScope(profile.query||profile.claim);
    if(priorScope&&priorScope!==scope)profile={pin:identity[1],doubleSign:profile.doubleSign};
    profile.pin = identity[1];
    profile.scopeKey=scope;
    profile.headers = { Cookie: h.cookie, 'User-Agent': h['user-agent'] || '', 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://member.jr.jd.com', Referer: 'https://member.jr.jd.com/activity/new-sign-in/home/' };
    if (endpoint === 'queryWeekSignMain') {
      if (typeof data.sign !== 'boolean') throw new Error('查询响应没有签到状态');
      profile.query = params;
    }
    if (params.riskDeviceParam) {profile.riskDeviceParam = params.riskDeviceParam;profile.riskScope=scope;}
    if (endpoint === 'dailyCashSignReceive') {
      const template = Object.assign({}, params); delete template.signData; delete template.nonce; delete template.signature;
      profile.claim = template;
      if (!profile.query) profile.query = Object.fromEntries(['channelSource', 'site', 'channelLv', 'signVersion', 'clientVersion', 'clientType'].map(k => [k, params[k]]));
    }
    profile.capturedAt = Date.now();
    const wasReady = !!(read(ACCOUNT) || {}).ready;
    profile.ready = !!(profile.query && profile.riskDeviceParam && cashScope(profile.query)===scope && (!profile.riskScope||profile.riskScope===scope));
    save(ACCOUNT, profile);
    console.log('[京东金融签到] 凭据已更新，完整=' + profile.ready);
    if (profile.ready && !wasReady) tell('签到凭据已保存，可手动执行一次验证。');
  }
capture();
}
function runPlantCapture(context){
const {$argument,$persistentStore,$notification,$httpClient,$done,$request,$response,$script,console,setTimeout,clearTimeout}=context;
const module=undefined;
// Independent plant-bean daily gift capture. Credentials stay in Loon.
const JDC_KEY = 'JD_CHECKIN_TEST_ACCOUNT_V1';
function jdcRead(key, fallback) {
  const raw = $persistentStore.read(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch (_) { throw new Error('本地数据损坏，请重新获取凭据'); }
}
function jdcWrite(key, value) {
  if (!$persistentStore.write(JSON.stringify(value), key)) throw new Error('本地保存失败');
}
function jdcParseForm(text) {
  const result = {};
  String(text || '').split('&').forEach(pair => {
    if (!pair) return;
    const i = pair.indexOf('=');
    const decode = s => decodeURIComponent(s.replace(/\+/g, ' '));
    result[decode(i < 0 ? pair : pair.slice(0, i))] = decode(i < 0 ? '' : pair.slice(i + 1));
  });
  return result;
}
function jdcForm(params) {
  return Object.keys(params).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');
}
function jdcHeader(headers, name) {
  const k = Object.keys(headers || {}).find(k => k.toLowerCase() === name.toLowerCase());
  return k ? headers[k] : '';
}
function jdcCookie(cookie, name) {
  const m = String(cookie).match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : '';
}
function jdcDay() { return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10); }
function jdcIsScratchQuery(params) {
  // This endpoint also serves ordinary sign-in. Only capture the observed
  // scratch-page task scope; commonScene=secKillChannel selects the ordinary task.
  try {
    const body=JSON.parse(params.body||'{}');
    const types=typeof body.taskType==='string'?body.taskType.split('_'):[];
    return body.scene==='jdInteractTask'&&types.includes('beanDailySign')&&types.includes('beanDailyPlus')&&
      (body.commonScene===undefined||body.commonScene==='');
  } catch (_) {return false;}
}
function jdcTask(data, mode) {
  const list = mode === 'daily' ? data && data.data && data.data.signComponentInfoResult
    : data && data.rs && data.rs.beanTask && data.rs.beanTask.taskList;
  if (!Array.isArray(list)) throw new Error('任务列表结构不符，未提交领取');
  const tasks = list.filter(t => Number(t.assignmentType) === 5 && t.ext && t.ext.taskType === 'beanDailySign' && t.encryptAssignmentId);
  if (tasks.length !== 1) throw new Error('每日任务无法唯一识别，未提交领取');
  return tasks[0];
}
function jdcLabel(mode) { return mode === 'query_compare' ? '环境对比查询（不领取）' : mode === 'diagnose' ? '本地签名诊断' : mode === 'daily' ? '普通签到' : mode === 'blindbox' ? 'PLUS每日盲盒' : '每日刮卡'; }
function jdcEndpoint(url) {
  const m = String(url).match(/^https:\/\/api\.m\.jd\.com\/(api|client\.action)(?:\?|$)/);
  if (!m) throw new Error('接口地址不符');
  return 'https://api.m.jd.com/' + m[1];
}

// The observed scratch query uses a business success code different from daily sign-in.
function jdcQueryAccepted(data, mode) {
  const code = String(data && data.code);
  if (code === '0') return true;
  return mode === 'scratch' && code === '1711000' && data.msg === '成功' &&
    !!(data.rs && data.rs.beanTask && Array.isArray(data.rs.beanTask.taskList));
}

function jdcBoxAccepted(data) {
  return !!data && String(data.code)==='1711000' && data.msg==='成功' && !!data.rs;
}
function jdcBoxToday(data) {
  if(!jdcBoxAccepted(data)||!Array.isArray(data.rs.sendBenefitList))
    throw new Error('盲盒奖励记录不完整，未继续开盒');
  return data.rs.sendBenefitList.filter(x=>String(x.prizeTime||'').slice(0,10)===jdcDay());
}
const Z_KEY='JD_PLANT_CHECKIN_ACCOUNT_V1';
const Z_LINK='4HcenxuZM4XiHesOb1HG4g';
function zAccepted(data){return !!data&&data.success===true&&String(data.code)==='0'&&!!data.data;}
function zMessage(data){return String(data.displayMsg||data.msg||data.message||data.errMsg||'无说明').replace(/https?:\/\/\S+/g,'[链接]').slice(0,160);}
function zStatusDetails(data){
 const payload=data&&data.data,main=payload&&payload.signMainVo,list=payload&&payload.signListVo;
 const number=v=>v!==null&&v!==undefined&&v!==''&&Number.isInteger(Number(v))&&Number(v)>=0&&Number(v)<=10000?Number(v):null;
 const task=main&&main.beforeTaskVo;
 return {mainPresent:!!main,listPresent:Array.isArray(list),currentStatus:number(main&&main.currentStatus),signDays:number(main&&main.signDays),
  beforeTask:task?{type:task.taskType==='BROWSE_RTB'?'BROWSE_RTB':'other',finished:typeof task.taskFinished==='boolean'?task.taskFinished:null,seconds:number(task.timeLimitPeriod)}:null,
  signList:Array.isArray(list)?list.slice(0,7).map(x=>({date:typeof x.signDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x.signDate)?x.signDate:null,status:number(x.status),todayFlag:number(x.todayFlag)})):[]};
}
function zSummary(result){
 if(/签名环境版本不兼容|签名环境结构不完整/.test(result.message||''))return '失败，签名环境不兼容，请查看日志中的版本或结构说明。';
 if(result.status==='manual_required')return result.message;
 if(['signed_confirmed','already_done'].includes(result.status)){
  let text=result.status==='already_done'?'今天已领取':result.beanQuantity>0?'获得 '+result.beanQuantity+' 京豆':'已领取，奖励见活动页';
  if(result.continuousDays>0)text+='，连续 '+result.continuousDays+' 天';
  return '成功，'+text+'。';
 }
 const text=[result.message,result.queryMessage,result.claimMessage].join(' ');
 return '失败，'+(/未登[录陆]|登录|凭据|账号.*匹配|原始签名环境/.test(text)?'凭据可能失效或不完整，请重新获取种豆凭据。':'请查看执行日志或最近结果。');
}
function zStatus(data){
 if(!zAccepted(data))throw new Error('签到状态查询失败：'+String(data&&data.code)+' '+(data?zMessage(data):'无说明'));
 const main=data.data.signMainVo,list=data.data.signListVo;
 if(!main||!Array.isArray(list))throw new Error('签到状态结构变化，未继续领取');
 const today=list.find(x=>x.signDate===jdcDay()&&Number(x.status)===3);
 if(today)return {done:true,main};
 const task=main.beforeTaskVo;
 if(Number(main.currentStatus)===0&&task&&task.taskType==='BROWSE_RTB'&&task.taskFinished===false){
  const seconds=Number(task.timeLimitPeriod);
  const duration=Number.isInteger(seconds)&&seconds>0&&seconds<=3600?seconds+'秒':'';
  throw Object.assign(new Error('请先到种豆活动页手动完成浏览页面'+duration+'，再执行签到。'),{status:'manual_required'});
 }
 if(Number(main.currentStatus)!==1)throw new Error('今日可领取状态不明确（状态值'+String(zStatusDetails(data).currentStatus)+'），未继续领取');
 return {done:false,main};
}
// Only this plugin's existing same-account login fields are refreshed.
function zSyncLogin(profile,cookie,source,observedAt){
 const pin=jdcCookie(cookie,'pt_pin'),key=jdcCookie(cookie,'pt_key');
 if(!profile||profile.pin!==pin||!pin||!key)return false;
 let changed=false;
 for(const kind of ['query','claim']){
  const template=profile[kind];
  if(!template||!template.headers||jdcCookie(template.headers.Cookie,'pt_pin')!==pin)continue;
  if(observedAt<Number(template.loginUpdatedAt||template.capturedAt||0))continue;
  template.headers.Cookie=String(template.headers.Cookie).split(';').map(x=>x.trim()).filter(x=>x&&!/^pt_(?:pin|key)=/.test(x)).concat(['pt_pin='+pin,'pt_key='+key]).join('; ');
  template.loginUpdatedAt=observedAt;template.loginSource=source;changed=true;
 }
 return changed;
}
function zLoginObservedAt(){
 const start=typeof $script!=='undefined'&&$script.startTime;
 const value=start?Number(new Date(start)):NaN;
 return Number.isFinite(value)&&value>0&&value<=Date.now()?value:Date.now();
}
(function(){
 let stage='检查请求';
 try {
  if(typeof $request==='undefined'||typeof $response==='undefined'||$request.method!=='POST'||Number($response.status)!==200)return;
  const endpoint=jdcEndpoint($request.url);
  const params=Object.assign(jdcParseForm(($request.url.split('?')[1]||'').split('#')[0]),jdcParseForm($request.body));
  if(params.appid!=='wegame-hub'||!['weGameHome','weGameLottery'].includes(params.functionId))return;
  stage='解析活动参数';
  const body=JSON.parse(params.body||'{}');
  if(body.linkId!==Z_LINK||Number(body.envType)!==1||Number(body.appType)!==1)return;
  stage='解析接口响应';
  const data=JSON.parse($response.body||'{}');
  if(!zAccepted(data)){console.log('[种豆签到] 未保存凭据：接口未返回登录成功状态，返回码 '+String(data.code));return;}
  const kind=params.functionId==='weGameHome'?'query':'claim';
  // Capture an authenticated page even when today's reward cannot be claimed.
  // Eligibility is checked by the runner before any claim is submitted.
  stage='检查签名配置';
  const sig=String(params.h5st||'').split(';'),appId=kind==='query'?'101aa':'730a6';
  if(sig.length!==10||sig[5]!=='5.3'||sig[2]!==appId)throw new Error('签名配置变化，请反馈执行日志');
  stage='检查登录和页面凭据';
  const headers={};
  ['Cookie','User-Agent','Referer','Origin','wg-sdk-token','x-rp-client','x-referer-page','request-from'].forEach(k=>{const v=jdcHeader($request.headers,k);if(v)headers[k]=v;});
  const pin=jdcCookie(headers.Cookie,'pt_pin');
  const missing=[];
  if(!pin)missing.push('pt_pin');
  if(!jdcCookie(headers.Cookie,'pt_key'))missing.push('pt_key');
  if(!headers['User-Agent'])missing.push('User-Agent');
  if(!headers.Referer)missing.push('Referer');
  if(missing.length)throw new Error('缺少 '+missing.join('、')+'，未保存');
  delete params.h5st;
  const old=jdcRead(Z_KEY,null),profile=old&&old.pin===pin?old:{pin};
  const first=!profile[kind];
  profile[kind]={endpoint,params,capturedAt:Date.now(),appId,encoding:sig[9],environment:sig[7],headers};
  if(kind==='query')profile.query.queryState=zStatusDetails(data);
  zSyncLogin(profile,headers.Cookie,'activity:plant',zLoginObservedAt());
  stage='保存本地凭据';
  jdcWrite(Z_KEY,profile);
  console.log('[种豆签到] 已保存'+(kind==='query'?'查询凭据':'领取模板')+'，未修改原请求');
  if(first)$notification.post('种豆得豆签到','凭据已保存',kind==='query'?'可关闭获取开关，在Loon中手动测试。':'已保存领取模板；还需进入页面保存查询凭据。');
 }catch(e){
  // Only expose known validation messages; parser errors can contain credentials.
  const detail=stage==='检查签名配置'?'签名配置变化，请反馈执行日志':stage==='检查登录和页面凭据'&&String(e.message).startsWith('缺少 ')?e.message:stage+'失败';
  console.log('[种豆签到] 获取失败：'+detail);$notification.post('种豆得豆签到','凭据获取未完成',detail);
 }
 finally{$done({});}
})();

}
// Current JD farm/platform contracts observed in 407/408; no account data.
function farmTools() {
  const FARM='fWWo3YmB983abNOJPR7veg',WHEEL='VssYBUKJOen7HZXpC8dRFA';
  const ACCOUNT='JD_FARM_TASKS_ACCOUNT_V1',PREFIX='JD_FARM_TASKS_V1.';
  const APPS={farm_home:'c57f6',apTaskListBatch:'2e349',apStartTaskTime:'acb1e',apDoLimitTimeTask:'ebecc',apsDoTask:'54ed7',apTaskDrawAward:'f0f3f',wheelsHome:'c06b7',wheelsLottery:'bd6c8',weGameHome:'101aa',weGameLottery:'730a6'};
  const ALLOWED=new Set([...Object.keys(APPS),'apTaskList','apTaskDetail']);
  const MUTATE=new Set(['apStartTaskTime','apDoLimitTimeTask','apsDoTask','apTaskDrawAward','wheelsLottery','weGameLottery']);
  const clone=o=>JSON.parse(JSON.stringify(o));
  const cookie=(s,k)=>{const rows=String(s||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(k+'='));return rows.length===1?rows[0].slice(k.length+1):'';};
  const header=(h,k)=>{const a=Object.keys(h||{}).filter(x=>x.toLowerCase()===k.toLowerCase());return a.map(x=>Array.isArray(h[x])?h[x].join('; '):h[x]).join(k.toLowerCase()==='cookie'?'; ':', ');};
  function form(s){const p={};for(const f of String(s||'').split('&')){if(!f)continue;const i=f.indexOf('='),dec=x=>decodeURIComponent(x.replace(/\+/g,' ')),k=dec(i<0?f:f.slice(0,i));if(Object.prototype.hasOwnProperty.call(p,k))throw Error('农场请求参数重复');p[k]=dec(i<0?'':f.slice(i+1));}return p;}
  const encode=p=>Object.keys(p).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(p[k])).join('&');
  const refOK=(r,scope)=>scope==='farm'?/^https:\/\/pro\.m\.jd\.com\/mall\/active\/42HV4J3Q87B2xFQMJk81PCc1mEs3\/index\.html(?:\?|$)/.test(r):/^https:\/\/lotterydraw-new\.jd\.com\/(?:\?|$)/.test(r);
  const scopeOf=(fn,b)=>fn==='farm_home'?'farm':b.linkId===FARM?'farm':b.linkId===WHEEL?'wheel':null;
  const title=t=>String(t.taskShowTitle||t.taskTitle||t.taskType||'未命名任务').replace(/[\r\n]/g,' ').slice(0,90);
  const identity=t=>t.pipeExt&&t.pipeExt.assignmentId?'assignment:'+t.pipeExt.assignmentId:'id:'+t.id+':'+t.taskType;
  const number=(n,f=0)=>n===null||n===undefined||n===''?f:Number.isFinite(Number(n))?Number(n):f;
  function accepted(j){if(!j||String(j.code)!=='0'||j.success===false||j.data?.success===false||j.data?.bizCode!==undefined&&String(j.data.bizCode)!=='0')return false;return true;}
  function list(data){if(!Array.isArray(data))throw Error('农场任务列表结构变化');for(const t of data){if(!t||typeof t.taskType!=='string'||!Number.isFinite(Number(t.id))||!Number.isFinite(Number(t.taskLimitTimes))||!Number.isFinite(Number(t.taskDoTimes)))throw Error('农场任务状态不完整');if(Number(t.id)===-9999&&!t.pipeExt?.assignmentId)throw Error('农场任务缺少独立标识');}return data;}
  function merge(base,extra){const out=base.slice(),seen=new Map(out.map((t,i)=>[identity(t),i]));for(const t of extra){const k=identity(t);if(!seen.has(k)){seen.set(k,out.length);out.push(t);}}if(out.length>200)throw Error('农场任务数量异常');return out;}
  const ready=t=>number(t.canDrawAwardNum)>0;
  const finished=t=>t.taskFinished===true||number(t.taskLimitTimes)>0&&number(t.taskDoTimes)>=number(t.taskLimitTimes);
  const supported=t=>['BROWSE_CHANNEL','BROWSE_PRODUCT','BROWSE_RTB'].includes(t.taskType);
  function reason(t){if(t.taskType==='CUMULATIVE_TIMES')return '手动浇水，保留水滴';if(['ORDER_MARK','ORDER','PAY'].includes(t.taskType))return '需下单';if(/SHARE|INVITE/.test(t.taskType))return '需邀请';if(/WIDGET/.test(t.taskType))return '需添加组件';if(/FOLLOW|SUBSCRIBE/.test(t.taskType))return '需关注或订阅';return '需App操作';}
  const view=t=>({title:title(t),type:t.taskType,current:number(t.taskDoTimes),total:number(t.taskLimitTimes),claimable:number(t.canDrawAwardNum),state:ready(t)?'待领取':finished(t)?'已完成':supported(t)?'待执行':reason(t)});
  return {FARM,WHEEL,ACCOUNT,PREFIX,APPS,ALLOWED,MUTATE,clone,cookie,header,form,encode,refOK,scopeOf,title,identity,number,accepted,list,merge,ready,finished,supported,reason,view};
}
// Decode this SDK's reversed custom Base64 locally. Never log decoded values.
function farmDecodeEnvironment(encoded) {
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
// Capture only: response bytes pass through unchanged; no network or task actions.
function farmCapture(host,request,response,decodeEnvironment) {
  const T=farmTools();
  if(request?.method!=='POST'||Number(response?.status)!==200||T.header(request.headers,'X-Lazing-Farm-Run')==='1')return null;
  const m=String(request.url||'').match(/^(https:\/\/api\.m\.jd\.com\/(?:api|client\.action))(?:\?([^#]*))?$/);if(!m)return null;
  const q=T.form(m[2]),p=T.form(request.body);for(const k of Object.keys(p)){if(k in q&&p[k]!==q[k])throw Error('农场请求参数冲突');q[k]=p[k];}
  const fn=q.functionId;if(!T.ALLOWED.has(fn)||fn==='weGameHome'||fn==='weGameLottery')return null;
  const b=JSON.parse(q.body||'{}'),scope=T.scopeOf(fn,b);if(!scope)return null;
  if(scope==='wheel'&&['farm_home','apTaskListBatch'].includes(fn)||scope==='farm'&&fn.startsWith('wheels'))return null;
  const j=JSON.parse(response.body||'{}');if(!T.accepted(j))return null;
  if(fn==='apTaskList')T.list(j.data);
  if(fn==='farm_home'&&(!j.data?.result||!('treeFullStage' in j.data.result)))return null;
  if(fn==='wheelsHome'&&!Number.isInteger(j.data?.lotteryChances))return null;
  if(q.appid!==(fn==='farm_home'?'signed_wh5':fn==='apStartTaskTime'?'activity_platform_se':'activities_platform'))return null;
  const headers={};for(const k of ['Cookie','User-Agent','Referer','Origin','request-from','x-referer-page']){const v=T.header(request.headers,k);if(v)headers[k]=v;}
  const pin=T.cookie(headers.Cookie,'pt_pin');if(!pin||!T.cookie(headers.Cookie,'pt_key')||!headers['User-Agent']||!T.refOK(headers.Referer,scope))return null;
  const old=host.read(T.ACCOUNT,null),bound=host.read('QL_BRIDGE_ACCOUNT_V1',null)||host.read('QL_BRIDGE_CREDENTIAL_V1',null);
  if(old&&old.pin!==pin||bound?.pin&&bound.pin!==pin)throw Error('农场账号与已有凭据不同，已保留原记录');
  const at=host.observedAt||host.now(),store=old||{pin,scopes:{}};store.scopes=store.scopes||{};
  const group=store.scopes[scope]||{templates:{}};group.templates=group.templates||{};
  const wasReady=!!(group.signing&&group.templates.apTaskList);
  if(at<Number(group.templates[fn]?.at||0))return null;
  let signing=null;
  if(T.APPS[fn]){
    const parts=String(q.h5st||'').split(';');if(parts.length!==10||parts[2]!==T.APPS[fn]||parts[5]!=='5.3'||!q['x-api-eid-token'])return null;
    const env=decodeEnvironment(parts[7]);if(![pin,decodeURIComponent(pin)].includes(env.pp.p1))throw Error('农场签名账号不匹配');
    signing={environment:parts[7],encoding:parts[9],at};
  }
  const clean=T.clone(q);delete clean.h5st;delete clean.t;delete clean.body;
  const body=T.clone(b);
  // Keep only query body templates. Actions always use current server task data.
  const query=['farm_home','apTaskList','apTaskListBatch','wheelsHome'].includes(fn);
  if(fn==='wheelsHome'){for(const k of Object.keys(body))if(k!=='linkId')delete body[k];}
  group.templates[fn]={endpoint:m[1],params:clean,headers,body:query?body:{},signing,at};
  if(signing&&at>=Number(group.signing?.at||0))group.signing=signing;
  store.scopes[scope]=group;store.updatedAt=host.now();host.write(T.ACCOUNT,store);
  const complete=!!(group.signing&&group.templates.apTaskList);
  return {scope,complete,firstReady:!wasReady&&complete};
}
// One dispatcher owns capture; all imported parsers receive a private request copy.
async function jsCapture(host,request,response,parsers,decode){
 if(request?.method!=='POST'||Number(response?.status)!==200||jsHeader(request.headers,'X-Lazing-Signin-Run')==='1'||jsHeader(request.headers,'X-Lazing-Farm-Run')==='1')return null;
 const url=String(request.url||''),jd=/^https:\/\/api\.m\.jd\.com\/(?:api|client\.action)(?:\?[^#]*)?$/.test(url);
 const finance=/^https:\/\/ms\.jr\.jd\.com\/gw2\/generic\/(?:jrSign\/h5\/m\/(?:queryWeekSignMain|queryCashSignSub|dailyCashSignReceive)|legogw\/h5\/m\/getPageInfoDoubleSignInForH5)(?:\?|$)/.test(url);
 if(!jd&&!finance)return null;
 const p=jd?jsParams(request):{},f=p.functionId;
 if(f==='start')return null; // Leave the splash rewrite to its own plugin.
 const pair=jsPair(jsHeader(request.headers,'Cookie'));if(!pair)return null;
 const existing=jsLogin(host.read);if(existing.pin&&existing.pin!==pair.pin)return {ignored:true};
 let data;try{data=JSON.parse(response.body);}catch(_){return null;}
 const body=jd?JSON.parse(p.body||'{}'):{};
 const retail=['findBeanSceneNew','bff_rightsCenter_jdInteractTask','bff_rightsCenter_interaction','bff_marketing_interaction'].includes(f);
 const jx=['jxzy_active_querySign','jxzy_active_drawSign','jxzy_active_queryActive'].includes(f);
 const plant=['weGameHome','weGameLottery'].includes(f)&&body.linkId==='4HcenxuZM4XiHesOb1HG4g';
 const game=['weGameHome','weGameLottery'].includes(f)&&body.linkId===JS_GAME;
 const delivery=['bean_deliverySign_home','bean_deliverySign_sign','bean_deliverySign_continue_award'].includes(f)&&['2775','5358'].includes(String(body.activityId));
 const health=Object.keys(JS_HEALTH).find(t=>(f==='jdh_bm_getKitTask'?body.m_patch_appKey:body.appKey)===JS_HEALTH[t].appKey&&JS_ALLOWED[t].includes(f));
 const daily=['startup','logConfig','queryPagePopWindow','babelGetGuideTips'].includes(f);
 const accepted=data?.success!==false&&(data?.code===0||data?.code==='0'||data?.code===200||data?.code==='200'||data?.success===true||retail&&String(data?.code)==='1711000'&&data?.msg==='成功'&&!!data?.rs);
 if(!finance&&!accepted)return null;
 const changed=[],allowed=new Set(['JD_CHECKIN_TEST_ACCOUNT_V1','JXZY_CHECKIN_ACCOUNT_V1','JD_JR_CHECKIN_ACCOUNT_V1','JD_PLANT_CHECKIN_ACCOUNT_V1','JD_FARM_TASKS_ACCOUNT_V1']);
 const headers={};for(const k of ['Cookie','User-Agent','Referer','Origin','x-rp-client','wg-sdk-token','x-referer-page','request-from']){const v=jsHeader(request.headers,k);if(v)headers[k]=v;}
 const normalized={...request,headers:{...request.headers}};
 if(jd&&!jsForm(url.split('?')[1]||'').functionId&&f)normalized.url=url+(url.includes('?')?'&':'?')+'functionId='+encodeURIComponent(f);
 const context={$request:normalized,$response:response,$script:{startTime:new Date(host.observedAt||Date.now()).toISOString()},$argument:{capture:true,refreshLogin:true},
  $persistentStore:{read:host.rawRead,write:(v,k)=>{
   if(!allowed.has(k))throw Error('凭据入口写入范围不符');const value=JSON.parse(v);if(value.pin!==pair.pin)throw Error('账号不一致');
   const old=host.rawRead(k),ok=host.rawWrite(v,k);if(!ok)throw Error('本地记录保存失败');if(old!==v)changed.push(k);return ok;
  }},$notification:{post:()=>{}},$httpClient:{post:()=>{throw Error('凭据入口禁止请求');}},console:{log:()=>{}},$done:()=>{}};
 if(health)jsTarget(health,request);
 if(retail)parsers.retail(context);else if(jx)parsers.jxzy(context);else if(finance)parsers.finance(context);else if(plant)parsers.plant(context);
 let farm=null;if(jd&&!retail&&!jx&&!plant&&!game&&!delivery&&!health&&!daily)farm=parsers.farm({...host,write:(k,v)=>{if(!allowed.has(k)||v.pin!==pair.pin)throw Error('凭据写入范围不符');host.write(k,v);changed.push(k);},now:()=>Date.now()},normalized,response,decode);
 if(game||delivery){
  const task=game?'game':'delivery';jsTarget(task,request);
  const sig=String(p.h5st||'').split(';'),app=game?(f==='weGameHome'?'101aa':'730a6'):(f==='bean_deliverySign_home'?'c1e85':'987dd');
  if(sig.length===10&&sig[5]==='5.3'&&sig[2]===app&&p['x-api-eid-token']&&headers['User-Agent']){
   const env=decode(sig[7]);if(![pair.pin,decodeURIComponent(pair.pin)].includes(env.pp.p1))throw Error('签名账号不匹配');
   const profile=host.read(JS_KEYS.extra,{pin:pair.pin});if(profile.pin!==pair.pin)throw Error('账号不一致');
   const previous=profile[task],at=host.observedAt||Date.now();
   if(at>=Number(previous?.capturedAt||0)){
    // Query captures are preferred; never retain a markStr, reward or h5st as a template.
    profile[task]={params:{client:p.client,clientVersion:p.clientVersion,'x-api-eid-token':p['x-api-eid-token']},headers,environment:sig[7],capturedAt:at};
    host.write(JS_KEYS.extra,profile);changed.push(JS_KEYS.extra);
   }
  }
 }
 // Finance keeps its independent Cookie. Only validated retail/native activity
 // traffic may update the generic JD login pair.
 const validSource=daily||health||game||delivery||farm||changed.some(k=>k!=='JD_JR_CHECKIN_ACCOUNT_V1');
 if(validSource&&accepted&&headers['User-Agent']){
  const old=host.read(JS_KEYS.login,null),at=host.observedAt||Date.now();
  if(!old||at>=Number(old.capturedAt||0)){
   host.write(JS_KEYS.login,{...pair,headers,capturedAt:at});
   // Maintain compatibility with manual activity scripts which already read QL's
   // generic local login key. This does not contact Qinglong or upload anything.
   host.write('QL_BRIDGE_CREDENTIAL_V1',{...pair,capturedAt:at,source:'combined-signin'});
   if(!old||old.cookie!==pair.cookie)changed.push(JS_KEYS.login);
  }
 }
 if(changed.length&&!host.read(JS_KEYS.bound,null))host.write(JS_KEYS.bound,{pin:pair.pin});
 return changed.length?{updated:[...new Set(changed)],first:!existing.pin}:null;
}
if(typeof $request!=='undefined'&&typeof $persistentStore!=='undefined'){
 (async()=>{
  const read=(k,f)=>{const v=$persistentStore.read(k);if(!v)return f;return JSON.parse(v);};
  const write=(k,v)=>{if(!$persistentStore.write(JSON.stringify(v),k))throw Error('本地记录保存失败');};
  try{
   const names={'JD_CHECKIN_TEST_ACCOUNT_V1':'京东签到','JXZY_CHECKIN_ACCOUNT_V1':'京喜','JD_JR_CHECKIN_ACCOUNT_V1':'金融','JD_PLANT_CHECKIN_ACCOUNT_V1':'种豆','JD_FARM_TASKS_ACCOUNT_V1':'农场／转盘',[JS_KEYS.extra]:'新增签到',[JS_KEYS.login]:'Cookie'};
   const at=typeof $script!=='undefined'&&Number(new Date($script.startTime));
   const r=await jsCapture({read,write,rawRead:k=>$persistentStore.read(k),rawWrite:(v,k)=>$persistentStore.write(v,k),observedAt:Number.isFinite(at)&&at>0&&at<=Date.now()?at:Date.now()},$request,$response,{retail:runRetailCapture,jxzy:runJxCapture,finance:runFinanceCapture,plant:runPlantCapture,farm:farmCapture},farmDecodeEnvironment);
   if(r?.updated?.length){const text=r.updated.map(k=>names[k]||'凭据').join('、');console.log('[签到凭据] 已更新：'+text);if(r.updated.includes(JS_KEYS.login)||r.first)$notification.post('京东签到','凭据已更新',text);}
  }catch(_){console.log('[签到凭据] 获取未完成，保留原记录');}
  finally{$done({});}
 })();
}

if(typeof module!=="undefined")module.exports={jsCapture,farmDecodeEnvironment,runRetailCapture,runJxCapture,runFinanceCapture,runPlantCapture,farmCapture};
