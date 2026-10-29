// Medical daily capture integration 20261029-5.
// Same passive capture as the activities plugin, so first-match does not swallow credentials.
function jdSplashCapture(request,response){return new Promise(resolve=>{
 const context={$request:{...request,headers:{...request.headers}},$response:response,$persistentStore,$notification,$script:typeof $script==='undefined'?{}:$script,$done:resolve,console,$argument:{capture:true}};
 (function(context){
 const {$request,$response,$persistentStore,$notification,$script,$done,console,$argument}=context;
 const module=undefined;
// Shared credential capture 20261026-9; Jingxi and farm activities.
// Shared login and Jingxi adapters only. No retired activity clients.
const actClone=x=>JSON.parse(JSON.stringify(x));
const actObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function actForm(text){const out={};for(const p of String(text||'').split('&')){if(!p)continue;const i=p.indexOf('='),dec=x=>decodeURIComponent(x.replace(/\+/g,' ')),k=dec(i<0?p:p.slice(0,i)),v=dec(i<0?'':p.slice(i+1));if(Object.prototype.hasOwnProperty.call(out,k))throw Error('活动请求参数重复');out[k]=v;}return out;}
const actEncode=p=>Object.keys(p).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(String(p[k]))).join('&');
function actHeader(h,k){const a=Object.keys(h||{}).find(x=>x.toLowerCase()===k.toLowerCase());return a?String(h[a]):'';}
function actPair(cookie){const rows=String(cookie||'').split(';').map(x=>x.trim()),p=rows.filter(x=>x.startsWith('pt_pin=')),k=rows.filter(x=>x.startsWith('pt_key='));if(p.length!==1||k.length!==1||!p[0].slice(7)||!k[0].slice(7))return null;return {pin:p[0].slice(7),cookie:k[0]+';'+p[0]+';'};}
function actParams(req){const q=actForm(String(req.url||'').split('?')[1]?.split('#')[0]||''),p=actForm(req.body);for(const k of Object.keys(q))if(p[k]!==undefined&&p[k]!==q[k])throw Error('活动请求参数冲突');return {...q,...p};}
function actEndpoint(url){return String(url||'').split('?')[0];}
// Share login identity; activity templates are optional inputs, never login credentials.
function actSharedMaterial(read,decode){
 const bound=read('JD_SIGNIN_ACCOUNT_V1',null)||read('QL_BRIDGE_ACCOUNT_V1',null),rows=[];
 function add(pin,headers,at,signing,params,label){
  const pair=actPair(actHeader(headers,'Cookie'));if(!pair||pin&&pair.pin!==pin)return;
  const row={pin:pair.pin,headers,at:Number(at)||0,signing,params:params||{},label};rows.push(row);return row;
 }
 const canonical=[];
 for(const key of ['JD_SIGNIN_LOGIN_V1','QL_BRIDGE_CREDENTIAL_V1']){
  const x=read(key,null);if(x?.cookie){const h={...(x.headers||{}),Cookie:x.cookie};canonical.push(add(x.pin,h,x.capturedAt,null,null,'共享Cookie'));}
 }
 const farm=read('JD_FARM_TASKS_ACCOUNT_V1',null);
 for(const g of Object.values(farm?.scopes||{}))for(const t of Object.values(g.templates||{}))add(farm.pin,t.headers,t.at,t.signing||g.signing,t.params,'农场');
 const jx=read('JXZY_CHECKIN_ACCOUNT_V1',null);if(jx)add(jx.pin,jx.headers,jx.loginUpdatedAt||jx.capturedAt,jx.signing,{...jx.query?.params,'x-api-eid-token':jx.signing?.eidToken},'京喜');
 const retail=read('JD_CHECKIN_TEST_ACCOUNT_V1',null);for(const t of Object.values(retail?.modes||{}))add(retail.pin,t.headers,t.loginUpdatedAt||t.capturedAt,{environment:t.referenceEnvironmentEncoded},t.params,'签到');
 const plant=read('JD_PLANT_CHECKIN_ACCOUNT_V1',null);for(const t of [plant?.query,plant?.claim])if(t)add(plant.pin,t.headers,t.loginUpdatedAt||t.capturedAt,{environment:t.referenceEnvironmentEncoded},t.params,'种豆');
 const pin=bound?.pin||canonical.filter(Boolean).sort((a,b)=>b.at-a.at)[0]?.pin||rows.sort((a,b)=>b.at-a.at)[0]?.pin;
 const same=rows.filter(x=>x.pin===pin).sort((a,b)=>b.at-a.at);
 const login=canonical.filter(x=>x?.pin===pin).sort((a,b)=>b.at-a.at)[0]||same[0];
 if(!login)throw Error('缺少京东Cookie，请打开京东获取一次');
 const context=same.find(x=>actHeader(x.headers,'User-Agent'));
 if(!context)throw Error('缺少京东设备信息，请打开京东获取一次');
 const h={Cookie:actPair(actHeader(login.headers,'Cookie')).cookie,'User-Agent':actHeader(context.headers,'User-Agent')};
 const extra=String(actHeader(context.headers,'Cookie')).split(';').map(x=>x.trim()).filter(x=>x&&!/^pt_(?:key|pin)=/.test(x));h.Cookie+=extra.join(';')+';';
 let signing,params={};
 for(const x of same){
  if(!params['x-api-eid-token']&&x.params['x-api-eid-token'])params={'x-api-eid-token':x.params['x-api-eid-token']};
  if(!signing&&x.signing?.environment){try{const env=decode(x.signing.environment);if([pin,decodeURIComponent(pin)].includes(env.pp?.p1)){signing=actClone(x.signing);h['User-Agent']=actHeader(x.headers,'User-Agent')||h['User-Agent'];}}catch(_){}}
 }
 return {pin,headers:h,signing,params,source:login.label,capturedAt:login.at};
}
function actJxProfile(read,decode){
 const s=actSharedMaterial(read,decode),old=read('JXZY_CHECKIN_ACCOUNT_V1',null);
 if(old?.query&&old?.signing?.environment&&old?.signing?.eidToken&&old?.headers){const p=actClone(old);if(p.pin!==s.pin)throw Error('京喜账号不一致');p.headers.Cookie=s.headers.Cookie;return p;}
 if(!s.signing?.environment||!s.params['x-api-eid-token'])throw Error('京喜共享设备资料不完整，请打开京东农场或京喜刷新');
 // Public page constants independently observed in 401 and 402; no user fields.
 return {pin:s.pin,headers:{...s.headers,Referer:'https://pro.m.jd.com/mall/active/2iqSwv1JiDHxAkHAikfU6XAECFmo/index.html'},capturedAt:s.capturedAt,
  query:{endpoint:'https://api.m.jd.com/api',params:{appid:'jx_h5_babel',client:'jxh5',clientVersion:'1.2.5',channel:'jxh5',functionId:'jxzy_active_querySign',body:JSON.stringify({source:'jxzy',craftId:'6824629a7c46584759d39b78',sceneval:2,buid:325,appCode:'ms1888ebbf'})}},
  signing:{...s.signing,source:'jxzy_active_queryActive',eidToken:s.params['x-api-eid-token']}};
}
function actJxTaskCapture(host,req,res,decode){
 if(req?.method!=='POST'||Number(res?.status)!==200||actHeader(req.headers,'X-Lazing-Activity-Run')==='1')return false;
 if(!/^https:\/\/api\.m\.jd\.com\/(?:api|client\.action)$/.test(actEndpoint(req.url)))return false;
 const p=actParams(req);if(p.functionId!=='jxzy_active_task_queryTaskList'||p.appid!=='jx_h5_babel'||p.client!=='jxh5'||p.channel!=='jxh5')return false;
 const b=JSON.parse(p.body||'{}'),j=JSON.parse(res.body||'{}');
 const cfg=b.craftId==='6824629a7c46584759d39b78'?{page:'2iqSwv1JiDHxAkHAikfU6XAECFmo',key:'JXZY_CHECKIN_ACCOUNT_V1'}:b.craftId==='69ae8eb86a31c802e19f9f8f'?{page:'2H8G6a7JecjqHH3t1ZWSoJjPtziP',key:'JD_HOME_CHECKIN_ACCOUNT_V1'}:null;
 if(!cfg||b.source!=='jxzy'||Number(b.sceneval)!==2||Number(b.buid)!==325||!b.appCode||String(j.code)!=='0'||!Array.isArray(j.data?.taskInfoList))return false;
 const headers={};for(const k of ['Cookie','User-Agent','Referer','Origin']){const v=actHeader(req.headers,k);if(v)headers[k]=v;}
 const pair=actPair(headers.Cookie);if(!pair||!headers['User-Agent']||!new RegExp('^https://pro\\.m\\.jd\\.com/mall/active/'+cfg.page+'/index\\.html(?:\\?|$)').test(headers.Referer||''))return false;
 const bound=host.read('JD_SIGNIN_ACCOUNT_V1',null)||host.read('QL_BRIDGE_ACCOUNT_V1',null),key=cfg.key,old=host.read(key,null);
 if(bound?.pin&&bound.pin!==pair.pin||old?.pin&&old.pin!==pair.pin)throw Error('京喜账号不一致');
 const at=host.observedAt||Date.now();if(at<Number(old?.updatedAt||0))return false;
 // Store only a verified query; bootstrap missing generic signing material at run time.
 delete p.h5st;delete p.t;delete b.time;delete b.signStr;p.functionId='jxzy_active_querySign';p.body=JSON.stringify(b);
 host.write(key,{...old,pin:pair.pin,headers,query:{endpoint:'https://api.m.jd.com/api',params:p},capturedAt:at,updatedAt:at});return true;
}

// Passive consolidated capture; original response unchanged.
// Fixed signup scope. Activity/gameplay task execution is deliberately absent.
const JS_VERSION='2026-10-26.2';
const JS_KEYS={login:'JD_SIGNIN_LOGIN_V1',extra:'JD_SIGNIN_EXTRA_ACCOUNT_V1',bound:'JD_SIGNIN_ACCOUNT_V1',last:'JD_SIGNIN_LAST_V1',history:'JD_SIGNIN_HISTORY_V1',lock:'JD_SIGNIN_LOCK_V1',attempts:'JD_SIGNIN_ATTEMPTS_V1'};
const JS_TASKS=[['daily','普通签到'],['scratch','每日刮卡'],['blindbox','PLUS盲盒'],['plant','种豆礼包'],['jxzy','京喜签到'],['finance','金融签到＋双签'],['hs','hs签到'],['ys','ys签到'],['delivery','天天领豆'],['game','互动游戏签到'],['home','家电家居签到']];
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
 const canonical=canonicalKeys.map(k=>read(k,null)).filter(p=>p&&p.pin===pin&&p.cookie).map(p=>({...jsPair(p.cookie),headers:p.headers||{Cookie:p.cookie},time:Number(p.capturedAt)||0})).filter(p=>p.pin===pin);
 const same=candidates.filter(p=>p.pin===pin).sort((a,b)=>b.time-a.time);const login=(hasCanonical?canonical.sort((a,b)=>b.time-a.time)[0]:same[0])||null;
 if(login){const context=same.find(p=>jsHeader(p.headers,'user-agent'));login.headers={...(context?.headers||{}),Cookie:jsMergeCookie(jsHeader(context?.headers,'cookie')||login.cookie,login)};}
 return {pin,login,profiles};
}
function jsLegacyAccount(task,pin,read,login){
 const key=task==='home'?'JD_HOME_CHECKIN_ACCOUNT_V1':task==='jxzy'?'JXZY_CHECKIN_ACCOUNT_V1':task==='plant'?'JD_PLANT_CHECKIN_ACCOUNT_V1':task==='finance'?'JD_JR_CHECKIN_ACCOUNT_V1':'JD_CHECKIN_TEST_ACCOUNT_V1';
 const p=read(key,null);if(!p)return {key,value:null};if(p.pin!==pin)throw Error('签到资料属于其他账号');const value=jsClone(p);
 if(login&&task!=='finance'){
  const apply=t=>{if(t?.headers){const name=Object.keys(t.headers).find(k=>k.toLowerCase()==='cookie');if(name){t.headers[name]=jsMergeCookie(t.headers[name],login);t.loginUpdatedAt=login.time;}}};
  if(task==='plant'){apply(value.query);apply(value.claim);}else if(task==='jxzy'||task==='home')apply(value);else Object.values(value.modes||{}).forEach(apply);
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
 const allowed=JS_ALLOWED[task]||(task==='daily'?['findBeanSceneNew','bff_rightsCenter_interaction']:task==='scratch'?['bff_rightsCenter_jdInteractTask','bff_rightsCenter_interaction']:task==='blindbox'?['bff_marketing_interaction']:['jxzy','home'].includes(task)?['jxzy_active_querySign','jxzy_active_drawSign']:['weGameHome','weGameLottery']);
 if(task==='home'&&(b.craftId!=='69ae8eb86a31c802e19f9f8f'||p.appid!=='jx_h5_babel'))throw Error('家电家居签到活动不符');
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
function runHomeCapture(context){
const {$argument,$persistentStore,$notification,$httpClient,$done,$request,$response,$script,console,setTimeout,clearTimeout}=context;
const module=undefined;
// Capture/refresh this activity only; no requests, independent storage.
const JX_PAGE="2H8G6a7JecjqHH3t1ZWSoJjPtziP";
const JX_CRAFT="69ae8eb86a31c802e19f9f8f";
const JX_SIGN_APP="c50cc";
const JX_ENCODING="qbkgHGHQ8GlOIyVOF6JQ8G1P5WFW3yVSC61T-bEQGGlQI6ZNHuFT-bVR7qUT";
const JX_ACCOUNT='JD_HOME_CHECKIN_ACCOUNT_V1',JX_LAST='JD_HOME_CHECKIN_LAST_RESULT_V1';
const JX_HISTORY='JD_HOME_CHECKIN_HISTORY_V1',JX_LOCK='JD_HOME_CHECKIN_LOCK_V1',JX_ATTEMPT='JD_HOME_CHECKIN_ATTEMPT_V1';
function jxRead(key,fallback){const text=$persistentStore.read(key);if(!text)return fallback;try{return JSON.parse(text);}catch(_){throw new Error('家电家居本地记录无法解析，请重新获取凭据');}}
function jxWrite(key,value){if(!$persistentStore.write(JSON.stringify(value),key))throw new Error('家电家居本地记录保存失败');}
function jxDay(){return new Date(Date.now()+8*3600000).toISOString().slice(0,10);}
function jxCookie(text,name){const m=String(text||'').match(new RegExp('(?:^|;\\s*)'+name+'=([^;]+)'));return m?m[1]:'';}
function jxHeader(headers,name){const key=Object.keys(headers||{}).find(k=>k.toLowerCase()===name.toLowerCase());return key?headers[key]:'';}
function jxForm(params){return Object.keys(params).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(params[k])).join('&');}
function jxParseForm(text){const out={};String(text||'').split('&').forEach(part=>{if(!part)return;const n=part.indexOf('='),decode=s=>decodeURIComponent(s.replace(/\+/g,' '));out[decode(n<0?part:part.slice(0,n))]=decode(n<0?'':part.slice(n+1));});return out;}
function jxEndpoint(url){if(!/^https:\/\/api\.m\.jd\.com\/api(?:\?|$)/.test(String(url)))throw new Error('家电家居签到接口来源不符');return 'https://api.m.jd.com/api';}
function jxReferer(url){return new RegExp('^https://pro\\.m\\.jd\\.com/mall/active/'+JX_PAGE+'/index\\.html(?:\\?|$)').test(String(url||''));}
function jxAccepted(data){return !!data&&String(data.code)==='0'&&!!data.data&&typeof data.data==='object'&&!Array.isArray(data.data);}
function jxMessage(data){return String(data&& (data.msg||data.message||data.errMsg)||'无说明').replace(/https?:\/\/\S+/g,'[链接]').slice(0,120);}
function jxCount(value){const n=Number(value);return value!==null&&value!==undefined&&value!==''&&Number.isInteger(n)&&n>=0&&n<=10000?n:null;}
function jxStatus(data){
 if(!jxAccepted(data))throw new Error('家电家居签到查询失败：'+String(data&&data.code)+' '+jxMessage(data));
 const d=data.data,status=jxCount(d.status),days=jxCount(d.alreadySignDays);
 if(days===null||![1,2].includes(status)||typeof d.itemId!=='string'||! /^[A-Za-z0-9_-]{1,128}$/.test(d.itemId))throw new Error('家电家居签到状态不明确，请查看日志');
 const list=d.signList;
 if(list!==undefined&&!Array.isArray(list))throw new Error('家电家居签到记录结构变化，请查看日志');
 const today=Array.isArray(list)&&list.some(x=>typeof x==='string'&&x.startsWith(jxDay()+'_'));
 if((status===2&&!today)||(status===1&&today))throw new Error('家电家居签到状态与今日记录不一致，请查看日志');
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
 if(/凭据|未登[录陆]|登录|账号/.test(r.message||''))return '签到失败，凭据可能失效或不完整，请重新获取家电家居凭据。';
 return '签到失败，请查看执行日志或最近结果。';
}
function jxCapturedBody(params,kind){
 if(!params||params.appid!=='jx_h5_babel'||params.channel!=='jxh5'||params.client!=='jxh5')throw new Error('家电家居活动请求来源不符');
 const b=JSON.parse(params.body||'{}');
 if(kind==='environment'){
  if(params.functionId!=='jxzy_active_queryActive'||b.pageId!==JX_PAGE)throw new Error('家电家居页面签名环境来源不符');
 }else if(b.source!=='jxzy'||b.craftId!==JX_CRAFT||params.functionId!==(kind==='query'?'jxzy_active_querySign':'jxzy_active_drawSign'))throw new Error('家电家居签到活动模板不符');
 if(Number(b.sceneval)!==2||Number(b.buid)!==325||typeof b.appCode!=='string'||!b.appCode)throw new Error('家电家居页面参数不完整');
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
  if(typeof body.signStr!=='string'||body.signStr!==jxBodySign(body))throw new Error('家电家居页面签名规则变化，保留原凭据');
  if(kind==='query')jxStatus(data);
  if(kind==='claim'&&(!Array.isArray(data.data.signList)||!data.data.signList.some(x=>typeof x==='string'&&x.startsWith(jxDay()+'_'))))return;
  const headers={};['Cookie','User-Agent','Referer','Origin','x-rp-client','x-referer-page','request-from'].forEach(k=>{const value=jxHeader($request.headers,k);if(value)headers[k]=value;});
  const pin=jxCookie(headers.Cookie,'pt_pin');
  if(!pin||!jxCookie(headers.Cookie,'pt_key')||!headers['User-Agent']||!jxReferer(headers.Referer))throw new Error('家电家居登录或页面凭据不完整');
  const previous=jxRead(JX_ACCOUNT,null);
  if(!capture&&(!previous||previous.pin!==pin))return;
  const observedAt=jxObservedAt();
  if(previous&&previous.pin===pin&&observedAt<Number(previous.updatedAt||0))return;
  const profile=previous&&previous.pin===pin?previous:{pin};
  const wasReady=!!(profile.query&&profile.signing);
  if(kind!=='query'){
   const parts=String(params.h5st||'').split(';'),expected=kind==='claim'?JX_SIGN_APP:'832f1';
   if(parts.length!==10||parts[5]!=='5.3'||parts[2]!==expected||kind==='claim'&&parts[9]!==JX_ENCODING)throw new Error('家电家居签名版本或参数集合变化，保留原凭据');
   const env=jxDecodeEnvironment(parts[7]);
   if(!env.pp.p1||![pin,decodeURIComponent(pin)].includes(env.pp.p1))throw new Error('家电家居签名环境账号不匹配');
   profile.signing={environment:parts[7],capturedAt:Date.now(),source:params.functionId,eidToken:params['x-api-eid-token']||''};
  }
  const clean=Object.assign({},params);delete clean.h5st;delete clean.t;
  delete body.time;delete body.signStr;clean.body=JSON.stringify(body);
  if(kind!=='environment')profile[kind]={endpoint,params:clean,capturedAt:Date.now()};
  profile.headers=headers;profile.updatedAt=observedAt;profile.capturedAt=Date.now();
  jxWrite(JX_ACCOUNT,profile);
  console.log('[家电家居自营签到] '+(capture?'已获取':'已刷新')+'本插件的'+({query:'查询模板',claim:'领取模板与签名环境',environment:'页面签名环境'}[kind])+'，完整='+!!(profile.query&&profile.signing));
  if(!wasReady&&profile.query&&profile.signing)$notification.post('家电家居自营签到','凭据已保存','可关闭获取开关，执行一次手动签到。');
 }catch(e){
  const message=/^(家电家居|签名环境|原始签名环境)/.test(String(e.message))?String(e.message).slice(0,140):'凭据获取未完成，请查看页面请求';
  console.log('[家电家居自营签到] '+message);
  if(manualCapture)$notification.post('家电家居自营签到','凭据获取未完成',message);
 }finally{$done({});}
})();

}
// 434 capture: native coupon-centre scene. Independent of the retired Faker clients.
const JC_KEY='JD_COUPON_ACTIVITY_ACCOUNT_V1',JC_JOURNAL='JD_COUPON_ACTIVITY_ATTEMPTS_V1';
const JC_PAGE='2BGmkjr2mbi81R4ozsAR1ragZcyh';
const JC_SCENES={jinquan:JC_PAGE,jinquan3:'2BuMtujoMx1EPnFvUrUpsrYucqUK'};
const JC_APIS=['sh_c_query_task_list','sh_c_query_reward_list','sh_c_do_task'];
const JC_ENCODING='of7rHGHQ8GlOIyVOF6JQ8G1P5WFW3yVSC61T-bEQGGlQI6ZNHuFT-bVR7qUT';
function jcProblem(label,j){const parts=[];for(const [k,v]of [['code',j?.code],['subCode',j?.data?.subCode]])if(/^-?\d{1,10}$/.test(String(v)))parts.push(k+'='+v);return Error(label+(parts.length?'（'+parts.join('，')+'）':''));}
function jcData(j){
 if(!j||String(j.code)!=='0'||j.success!==true||!j.data||typeof j.data!=='object'||Array.isArray(j.data))throw jcProblem('领券中心请求未通过',j);
 return j.data;
}
function jcList(j){const d=jcData(j);if(String(d.subCode)!=='0'||!Array.isArray(d.taskList)||d.taskList.length>100)throw jcProblem('领券中心任务列表变化',j);return d.taskList;}
function jsCouponCapture(host,req,res,decode){
 if(req.method!=='POST'||Number(res.status)!==200||jsHeader(req.headers,'X-Lazing-Activity-Run')==='1'||jsHeader(req.headers,'X-Lazing-Signin-Run')==='1')return false;
 const p=jsParams(req);if(p.functionId!=='sh_c_query_task_list'||p.appid!=='hourly-m'||!['apple','ios'].includes(p.client))return false;
 if(!/^https:\/\/api\.m\.jd\.com\/(?:api|client\.action)(?:\?|$)/.test(String(req.url)))return false;
 const b=JSON.parse(p.body||'{}');if(!Object.prototype.hasOwnProperty.call(JC_SCENES,b.scene)||b.viewStage!=='taskList')return false;
 jcList(JSON.parse(res.body||'{}'));
 const headers={};for(const k of ['Cookie','User-Agent','Referer','Origin','x-rp-client','wg-sdk-token']){const v=jsHeader(req.headers,k);if(v)headers[k]=v;}
 const pair=jsPair(headers.Cookie),sig=String(p.h5st||'').split(';');
 if(!pair||!headers['User-Agent']||!new RegExp('^https://pro\\.m\\.jd\\.com/mall/active/'+JC_SCENES[b.scene]+'/index\\.html(?:\\?|$)').test(headers.Referer||''))return false;
 const bound=host.read(JS_KEYS.bound,null)||host.read('QL_BRIDGE_ACCOUNT_V1',null),old=host.read(JC_KEY,null);
 if(bound?.pin&&bound.pin!==pair.pin||old?.pin&&old.pin!==pair.pin)throw Error('领券中心账号不一致');
 if(sig.length!==10||sig[2]!=='35fa0'||sig[5]!=='5.3'||sig[9]!==JC_ENCODING||!p['x-api-eid-token'])return false;
 const env=decode(sig[7]);if(![pair.pin,decodeURIComponent(pair.pin)].includes(env.pp?.p1))return false;
 const at=host.observedAt||Date.now();if(at<Number(old?.capturedAt||0))return false;
 // No old signature, timer, item, assignment or completed-action body is retained.
 const params={};for(const k of ['appid','client','clientVersion','loginType','uuid','openudid','x_app_key','eid','x-api-eid-token','lat','lng'])if(p[k]!==undefined)params[k]=p[k];
 params.method='POST';
 const common={scene:b.scene};for(const k of ['lat','lng','area','gcLat','gcLng','lbsParamMap'])if(b[k]!==undefined)common[k]=b[k];
 host.write(JC_KEY,{pin:pair.pin,headers,params,common,signing:{environment:sig[7],encoding:sig[9]},capturedAt:at});return true;
}
function jsActivityTaskCapture(host,req,res,decode){
 if(req?.method!=='POST'||Number(res?.status)!==200||jsHeader(req.headers,'X-Lazing-Activity-Run')==='1')return false;
 if(!/^https:\/\/api\.m\.jd\.com\/(?:api|client\.action)$/.test(String(req.url||'').split('?')[0]))return false;
 const p=jsParams(req);if(p.functionId!=='jxzy_active_task_queryTaskList'||p.appid!=='jx_h5_babel'||p.client!=='jxh5'||p.channel!=='jxh5')return false;
 const b=JSON.parse(p.body||'{}'),j=JSON.parse(res.body||'{}');
 const cfg=b.craftId==='6824629a7c46584759d39b78'?{page:'2iqSwv1JiDHxAkHAikfU6XAECFmo',key:'JXZY_CHECKIN_ACCOUNT_V1'}:b.craftId==='69ae8eb86a31c802e19f9f8f'?{page:'2H8G6a7JecjqHH3t1ZWSoJjPtziP',key:'JD_HOME_CHECKIN_ACCOUNT_V1'}:null;
 if(!cfg||b.source!=='jxzy'||Number(b.sceneval)!==2||Number(b.buid)!==325||!b.appCode||String(j.code)!=='0'||!Array.isArray(j.data?.taskInfoList))return false;
 const headers={};for(const k of ['Cookie','User-Agent','Referer','Origin']){const v=jsHeader(req.headers,k);if(v)headers[k]=v;}
 const pair=jsPair(headers.Cookie);if(!pair||!headers['User-Agent']||!new RegExp('^https://pro\\.m\\.jd\\.com/mall/active/'+cfg.page+'/index\\.html(?:\\?|$)').test(headers.Referer||''))return false;
 const bound=host.read('JD_SIGNIN_ACCOUNT_V1',null)||host.read('QL_BRIDGE_ACCOUNT_V1',null),key=cfg.key,old=host.read(key,null);
 if(bound?.pin&&bound.pin!==pair.pin||old?.pin&&old.pin!==pair.pin)throw Error('京喜账号不一致');
 const at=host.observedAt||Date.now();if(at<Number(old?.updatedAt||0))return false;
 // Store only a verified query; bootstrap missing generic signing material at run time.
 delete p.h5st;delete p.t;delete b.time;delete b.signStr;p.functionId='jxzy_active_querySign';p.body=JSON.stringify(b);
 host.write(key,{...old,pin:pair.pin,headers,query:{endpoint:'https://api.m.jd.com/api',params:p},capturedAt:at,updatedAt:at});return true;
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
// JD Health daily activity. Protocol: user HAR456 and public ifloor 00041674.
const MDA_VERSION='20261029-1',MDA_KEY='JD_MEDICAL_ACTIVITY_ACCOUNT_V1';
const MDA_PAGE='https://pro.m.jd.com/mall/active/3RLqT5qKR4uVAXKxezQTYL9ArSR2/index.html';
const MDA_FUNCTIONS=['market_daily_pageIndex','market_daily_doCompleteTask','jdh_bm_balanceBeans'];
const mdaObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const mdaClone=v=>JSON.parse(JSON.stringify(v));
const mdaHeader=(h,k)=>{const key=Object.keys(h||{}).find(x=>x.toLowerCase()===k.toLowerCase());return key?String(h[key]):'';};
function mdaForm(s){const out={};for(const p of String(s||'').split('&')){if(!p)continue;const n=p.indexOf('='),d=v=>decodeURIComponent(v.replace(/\+/g,' ')),k=d(n<0?p:p.slice(0,n));if(Object.prototype.hasOwnProperty.call(out,k))throw Error('医药活动参数重复');out[k]=d(n<0?'':p.slice(n+1));}return out;}
const mdaEncode=p=>Object.keys(p).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(String(p[k]))).join('&');
function mdaParams(r){const q=mdaForm(String(r.url||'').split('?')[1]||''),p=mdaForm(r.body);for(const k of Object.keys(q))if(p[k]!==undefined&&p[k]!==q[k])throw Error('医药活动参数冲突');return {...q,...p};}
function mdaRoute(r){if(!/^https:\/\/api\.m\.jd\.com\/(?:api|client\.action)(?:\?[^#]*)?$/.test(r?.url||''))return false;try{return MDA_FUNCTIONS.includes(mdaParams(r).functionId);}catch(_){return false;}}
function mdaPair(cookie){const p=String(cookie||'').split(';').map(v=>v.trim()),keys=p.filter(x=>x.startsWith('pt_key=')),pins=p.filter(x=>x.startsWith('pt_pin='));if(keys.length!==1||pins.length!==1||!keys[0].slice(7)||!pins[0].slice(7)||/[\r\n\s]/.test(keys[0]+pins[0]))return null;return {pin:pins[0].slice(7),cookie:keys[0]+';'+pins[0]+';'};}
function mdaLogin(read){const bound=read('JD_SIGNIN_ACCOUNT_V1',null)?.pin;return ['JD_SIGNIN_LOGIN_V1','QL_BRIDGE_CREDENTIAL_V1'].map(k=>read(k,null)).filter(Boolean).map(x=>({...x,pair:mdaPair(x.cookie||mdaHeader(x.headers,'Cookie'))})).filter(x=>x.pair&&(!bound||bound===x.pair.pin)).sort((a,b)=>Number(b.capturedAt||0)-Number(a.capturedAt||0))[0]?.pair||null;}
function mdaMergeCookie(pair,...cookies){const extra=new Map();for(const c of cookies)for(const p of String(c||'').split(';')){const s=p.trim(),i=s.indexOf('=');if(i>0&&!/^pt_(?:key|pin)$/.test(s.slice(0,i))&&!/[\r\n]/.test(s))extra.set(s.slice(0,i),s.slice(i+1));}return pair.cookie+[...extra].map(([k,v])=>k+'='+v+';').join('');}
const mdaCode=v=>/^[A-Za-z0-9_-]{1,32}$/.test(String(v??''))?String(v):'unknown';
function mdaBusiness(j,stage='查询任务',balance=false){if(!mdaObject(j)||j.success!==true||String(j.code)!==(balance?'0':'0000'))throw Error('医药活动'+stage+'拒绝（code='+mdaCode(j?.code)+'）');if(balance)return j.data;if(!mdaObject(j.data))throw Error('医药活动返回结构变化');return j.data;}
const mdaTitle=t=>String(t?.assignmentName||'未命名任务').replace(/[\r\n]/g,' ').slice(0,80);
const mdaId=t=>String(t?.encryptAssignmentId||'');
function mdaList(j){const d=mdaBusiness(j),a=d.assignmentList;if(!Array.isArray(a)||a.length>150)throw Error('医药活动任务列表结构变化');const seen=new Set();for(const t of a){const id=mdaId(t);if(!mdaObject(t)||!id||id.length>256||!/^[-_A-Za-z0-9]+$/.test(id)||seen.has(id))throw Error('医药活动任务标识异常');seen.add(id);}return a;}
function mdaDone(t){return t?.completionFlag===true||Number.isInteger(t?.completionCnt)&&Number.isInteger(t?.assignmentTimesLimit)&&t.assignmentTimesLimit>0&&t.completionCnt>=t.assignmentTimesLimit;}
function mdaSeconds(t){const m=/^浏览\s*(\d{1,2})\s*(?:s|秒)(?:得)?$/i.exec(String(t?.assignmentDesc||'').trim());return m&&Number(m[1])>0&&Number(m[1])<=60?Number(m[1]):null;}
function mdaClassify(t){
 if(mdaDone(t))return 'done';
 if(Number(t.timeStatus)!==1)return 'inactive';
 const rewards=t.rewardsList;
 if(!Array.isArray(rewards)||!rewards.some(r=>Number(r?.rewardType)===3))return 'other-reward';
 if(Number(t.assignmentType)===5&&String(t.assignmentDesc||'')==='每日签到')return 'sign';
 // Only the simple timed visit protocol, never order, cart, contact or app-install tasks.
 if(Number(t.assignmentType)!==1||mdaSeconds(t)===null||!/^\d{1,24}$/.test(String(t.itemId||'')))return 'app';
 if(/下单|支付|购买|充值|开通|授权|添加|加营养师|关注|邀请|订阅|分享/.test(mdaTitle(t)))return 'app';
 if(!/^https:\/\/(?:[a-z0-9-]+\.)*jd\.com(?:[/:?#]|$)/i.test(String(t.url||'')))return 'app';
 return 'visit';
}
function mdaRewards(data){const rows=data?.successRewards;if(!Array.isArray(rows))return null;let sum=0;for(const r of rows){if(Number(r?.rewardType)!==3)continue;const n=Number(r.rewardValue);if(!Number.isSafeInteger(n)||n<0||n>10000)return null;sum+=n;}return sum;}
const mdaDeviceKeys=['platform','osVersion','screen','eid','client','clientVersion','model','brand','uuid','networkType'];
function mdaCapture(host,request,response,decode){
 if(request?.method!=='POST'||Number(response?.status)!==200||!mdaRoute(request)||['X-Lazing-Activity-Run','X-Lazing-Signin-Run'].some(k=>mdaHeader(request.headers,k)==='1'))return null;
 const p=mdaParams(request),body=JSON.parse(p.body||'{}');if(p.appid!=='jdh-middle'||body.channel!=='daily'||!['market_daily_pageIndex','market_daily_doCompleteTask'].includes(p.functionId))return null;
 const page=mdaHeader(request.headers,'x-referer-page')||mdaHeader(request.headers,'Referer');if(!new RegExp('^'+MDA_PAGE.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:\\?|$)').test(page))return null;
 const j=JSON.parse(response.body||'{}');if(p.functionId==='market_daily_pageIndex'){if(Number(body.taskVersion)!==1)return null;mdaList(j);}else{mdaBusiness(j,'提交任务');if(![1,5].includes(Number(body.assignmentType))||![0,1].includes(Number(body.actionType)))return null;}
 const login=mdaLogin(host.read),direct=mdaPair(mdaHeader(request.headers,'Cookie')),identity=direct||login,bound=host.read('JD_SIGNIN_ACCOUNT_V1',null)?.pin,old=host.read(MDA_KEY,null);
 if(!identity||bound&&bound!==identity.pin||login&&login.pin!==identity.pin||old?.pin&&old.pin!==identity.pin)return null;
 const sig=String(p.h5st||'').split(';');if(sig.length!==10||sig[2]!=='4b818'||sig[5]!=='5.3'||!p['x-api-eid-token'])return null;
 const env=decode(sig[7]);if(![identity.pin,decodeURIComponent(identity.pin)].includes(env?.pp?.p1))return null;
 const headers={};for(const k of ['User-Agent','Origin','Referer','x-referer-page','x-rp-client','x-babel-ihub']){const v=mdaHeader(request.headers,k);if(v)headers[k]=v;}
 if(!headers['User-Agent'])return null;headers.Cookie=mdaMergeCookie(identity,old?.headers?.Cookie,mdaHeader(request.headers,'Cookie'));
 const at=host.observedAt||Date.now();if(at<Number(old?.capturedAt||0))return null;
 const profile=old?mdaClone(old):{version:1,pin:identity.pin};
 profile.headers=headers;profile.environment=sig[7];profile.eidToken=p['x-api-eid-token'];profile.capturedAt=at;
 const device={};for(const k of mdaDeviceKeys)if(['string','number'].includes(typeof body[k])&&String(body[k]).length<16384)device[k]=body[k];
 if(Object.keys(device).length){profile.device=device;profile.deviceAt=at;}
 host.write(MDA_KEY,profile);return {updated:[MDA_KEY],first:!old};
}
function createMedicalClient(host,crypto,profile){
 const report={version:MDA_VERSION,rows:[],submitted:0,confirmed:0,returnedBeans:0,rewardResponses:0,balanceDelta:null,stopped:false,message:''};
 const key='attempts.'+encodeURIComponent(profile.pin),old=host.read(key,null),journal=old?.day===host.day()?old:{day:host.day(),items:{}};
 const save=(k,v)=>{journal.items[k]=v;host.write(key,journal);};
 async function request(f,body,stage){
  host.guard();if(!MDA_FUNCTIONS.includes(f))throw Error('医药活动请求范围不符');
  const params={functionId:f,appid:'jdh-middle',body:JSON.stringify(body)};
  params.h5st=await crypto.signOnline('4b818',profile,crypto.decodeEnvironment(profile.environment),{appid:params.appid,body:crypto.hash(params.body),functionId:f});
  const sig=String(params.h5st).split(';');if(sig.length!==10||sig[2]!=='4b818'||sig[5]!=='5.3')throw Error('医药活动签名输出异常');
  params['x-api-eid-token']=profile.eidToken;host.log(stage);
  const response=await host.request({url:'https://api.m.jd.com/api?functionId='+f,method:'post',headers:{...profile.headers,'Content-Type':'application/x-www-form-urlencoded'},body:mdaEncode(params)});
  if(Number(response.status)!==200)throw Error('医药活动'+stage+' HTTP '+String(Number(response.status)||0)+'，已停止');
  let data;try{data=JSON.parse(response.body);}catch(_){throw Error('医药活动返回内容无法读取');}
  mdaBusiness(data,stage,f==='jdh_bm_balanceBeans');return data;
 }
 const page=async()=>mdaList(await request('market_daily_pageIndex',{...profile.device,taskVersion:1,channel:'daily'},'查询任务'));
 async function balance(){const j=await request('jdh_bm_balanceBeans',{},'查询京豆余额');return Number.isSafeInteger(j.data)&&j.data>=0?j.data:null;}
 async function run(){
  try{
   let tasks=await page();const initial=tasks.slice(),beforeBalance=await balance();host.log('读取 '+tasks.length+' 项任务');
   for(const entry of initial){
    host.guard();const id=mdaId(entry),task=tasks.find(t=>mdaId(t)===id),row={title:mdaTitle(entry),result:'',confirmed:0};report.rows.push(row);
    if(!task){row.result='任务已从列表移除';continue;}
    const type=mdaClassify(task),labels={done:'已完成',inactive:'当前不可做','other-reward':'奖励不是京豆',app:'需App操作'};
    if(!['visit','sign'].includes(type)){row.result=labels[type]||'需App操作';continue;}
    const count=Number.isInteger(task.completionCnt)?task.completionCnt:0,k=crypto.hash(id)+':'+count;
    // Any unresolved submission for this task prevents resubmission, even after
    // a changed item ID or an unrelated balance increase.
    if(Object.values(journal.items).some(x=>x.id===crypto.hash(id)&&x.state!=='confirmed')){row.result='上次已提交，待App确认';continue;}
    if(journal.items[k]){row.result='本次进度已处理';continue;}
    if(report.submitted>=25){row.result='达到本轮处理上限';break;}
    host.log(row.title);
    const body={assignmentType:Number(task.assignmentType),encryptAssignmentId:id,actionType:type==='sign'?0:1,...(type==='visit'?{itemId:String(task.itemId)}:{}),...profile.device,channel:'daily'};
    save(k,{id:crypto.hash(id),state:'pending',at:host.now()});
    const result=await request('market_daily_doCompleteTask',body,type==='sign'?'签到':'提交浏览');report.submitted++;
    const beans=mdaRewards(result.data);if(beans!==null){report.returnedBeans+=beans;report.rewardResponses++;}
    const seconds=type==='visit'?mdaSeconds(task):0;if(seconds){host.log('等待 '+seconds+' 秒');await host.sleep((seconds+1)*1000);}
    tasks=await page();let after=tasks.find(t=>mdaId(t)===id);
    const changed=()=>!!after&&(mdaDone(after)||Number.isInteger(after.completionCnt)&&after.completionCnt>count);
    if(!changed()){await host.sleep(3000);tasks=await page();after=tasks.find(t=>mdaId(t)===id);}
    if(changed()){
     report.confirmed++;row.confirmed=1;save(k,{id:crypto.hash(id),state:'confirmed',at:host.now()});
     row.result='任务已完成'+(beans!==null?'；接口发放 '+beans+' 京豆':'；接口未返回发奖数量');
     if(Number(after.canReceiveTimes)>0)row.result+='；奖励待App领取';
    }else{save(k,{id:crypto.hash(id),state:'submitted',at:host.now()});row.result='已提交，进度待App确认';}
    if(beans===null&&task.rewardsList?.some(r=>Number(r.rewardType)===3&&Number(r.reachUpperLimit)===1))row.result+='；奖励标记已达上限';
    await host.sleep(2000);
   }
   const afterBalance=await balance();if(beforeBalance!==null&&afterBalance!==null)report.balanceDelta=afterBalance-beforeBalance;
  }catch(e){report.stopped=true;report.message=host.error(e);const row=report.rows[report.rows.length-1];if(row&&!row.result)row.result='执行中断：'+report.message;}
  return report;
 }
 return {run,page,balance};
}

async function jsCapture(host,request,response,parsers,decode){
 if(mdaRoute(request))return mdaCapture(host,request,response,decode);
 if(request?.method!=='POST'||Number(response?.status)!==200||jsHeader(request.headers,'X-Lazing-Signin-Run')==='1'||jsHeader(request.headers,'X-Lazing-Farm-Run')==='1'||jsHeader(request.headers,'X-Lazing-Activity-Run')==='1')return null;
 const url=String(request.url||''),jd=/^https:\/\/api\.m\.jd\.com\/(?:api|client\.action)(?:\?[^#]*)?$/.test(url);
 const finance=/^https:\/\/ms\.jr\.jd\.com\/gw2\/generic\/(?:jrSign\/h5\/m\/(?:queryWeekSignMain|queryCashSignSub|dailyCashSignReceive)|legogw\/h5\/m\/getPageInfoDoubleSignInForH5)(?:\?|$)/.test(url);
 if(!jd&&!finance)return null;
 const p=jd?jsParams(request):{},f=p.functionId,body=jd?JSON.parse(p.body||'{}'):{};
 if(f==='start')return null; // Leave the splash rewrite to its own plugin.
 let pair=jsPair(jsHeader(request.headers,'Cookie'));
 // These native webviews omit login cookies in the captured H5 request. Use
 // an existing same-account canonical login; signed environments still bind pin.
 const nativeTask=f==='jxzy_active_task_queryTaskList'&&['69ae8eb86a31c802e19f9f8f','6824629a7c46584759d39b78'].includes(body.craftId);
 const scopedNative=jd&&(nativeTask||['jxzy_active_querySign','jxzy_active_drawSign','jxzy_active_queryActive'].includes(f)&&(body.craftId==='69ae8eb86a31c802e19f9f8f'||body.pageId==='2H8G6a7JecjqHH3t1ZWSoJjPtziP')||f==='sh_c_query_task_list'&&p.appid==='hourly-m'&&Object.prototype.hasOwnProperty.call(JC_SCENES,body.scene));
 if(!pair&&scopedNative){
  const login=jsLogin(host.read).login;if(!login)return null;
  pair=jsPair(login.cookie);if(!pair)return null;
  const headers={...request.headers},pageCookie=jsHeader(headers,'Cookie');for(const k of Object.keys(headers))if(k.toLowerCase()==='cookie')delete headers[k];
  headers.Cookie=login.cookie+String(pageCookie||'').split(';').map(x=>x.trim()).filter(x=>x&&!/^pt_(?:pin|key)=/.test(x)).join(';')+';';request={...request,headers};
 }
 if(!pair)return null;
 const existing=jsLogin(host.read);if(existing.pin&&existing.pin!==pair.pin)return {ignored:true};
 let data;try{data=JSON.parse(response.body);}catch(_){return null;}
 const retail=['findBeanSceneNew','bff_rightsCenter_jdInteractTask','bff_rightsCenter_interaction','bff_marketing_interaction'].includes(f);
 const home=['jxzy_active_querySign','jxzy_active_drawSign','jxzy_active_queryActive'].includes(f)&&(body.craftId==='69ae8eb86a31c802e19f9f8f'||body.pageId==='2H8G6a7JecjqHH3t1ZWSoJjPtziP');
 const jx=['jxzy_active_querySign','jxzy_active_drawSign','jxzy_active_queryActive'].includes(f);
 const plant=['weGameHome','weGameLottery'].includes(f)&&body.linkId==='4HcenxuZM4XiHesOb1HG4g';
 const game=['weGameHome','weGameLottery'].includes(f)&&body.linkId===JS_GAME;
 const delivery=['bean_deliverySign_home','bean_deliverySign_sign','bean_deliverySign_continue_award'].includes(f)&&['2775','5358'].includes(String(body.activityId));
 const health=Object.keys(JS_HEALTH).find(t=>(f==='jdh_bm_getKitTask'?body.m_patch_appKey:body.appKey)===JS_HEALTH[t].appKey&&JS_ALLOWED[t].includes(f));
 const daily=['startup','logConfig','queryPagePopWindow','babelGetGuideTips'].includes(f);
 const accepted=data?.success!==false&&(data?.code===0||data?.code==='0'||data?.code===200||data?.code==='200'||data?.success===true||retail&&String(data?.code)==='1711000'&&data?.msg==='成功'&&!!data?.rs||delivery&&data?.code===undefined&&String(data?.data?.bizCode)==='0');
 if(!finance&&!accepted)return null;
 const changed=[],allowed=new Set(['JD_CHECKIN_TEST_ACCOUNT_V1','JXZY_CHECKIN_ACCOUNT_V1','JD_JR_CHECKIN_ACCOUNT_V1','JD_PLANT_CHECKIN_ACCOUNT_V1','JD_FARM_TASKS_ACCOUNT_V1','JD_HOME_CHECKIN_ACCOUNT_V1']);
 const headers={};for(const k of ['Cookie','User-Agent','Referer','Origin','x-rp-client','wg-sdk-token','x-referer-page','request-from']){const v=jsHeader(request.headers,k);if(v)headers[k]=v;}
 const normalized={...request,headers:{...request.headers}};
 if(jd&&!jsForm(url.split('?')[1]||'').functionId&&f)normalized.url=url+(url.includes('?')?'&':'?')+'functionId='+encodeURIComponent(f);
 const context={$request:normalized,$response:response,$script:{startTime:new Date(host.observedAt||Date.now()).toISOString()},$argument:{capture:true,refreshLogin:true},
  $persistentStore:{read:host.rawRead,write:(v,k)=>{
   if(!allowed.has(k))throw Error('凭据入口写入范围不符');const value=JSON.parse(v);if(value.pin!==pair.pin)throw Error('账号不一致');
   const old=host.rawRead(k),ok=host.rawWrite(v,k);if(!ok)throw Error('本地记录保存失败');if(old!==v)changed.push(k);return ok;
  }},$notification:{post:()=>{}},$httpClient:{post:()=>{throw Error('凭据入口禁止请求');}},console:{log:()=>{}},$done:()=>{}};
 if(health)jsTarget(health,request);
 if(retail)parsers.retail(context);else if(home)parsers.home(context);else if(jx)parsers.jxzy(context);else if(finance)parsers.finance(context);else if(plant)parsers.plant(context);
 const activityTask=nativeTask&&jsActivityTaskCapture(host,request,response,decode);if(activityTask)changed.push(body.craftId==='69ae8eb86a31c802e19f9f8f'?'JD_HOME_CHECKIN_ACCOUNT_V1':'JXZY_CHECKIN_ACCOUNT_V1');
 const coupon=f==='sh_c_query_task_list'&&jsCouponCapture(host,request,response,decode);if(coupon)changed.push(JC_KEY);
 let farm=null;if(jd&&!activityTask&&!coupon&&!home&&!retail&&!jx&&!plant&&!game&&!delivery&&!health&&!daily)farm=parsers.farm({...host,write:(k,v)=>{if(!allowed.has(k)||v.pin!==pair.pin)throw Error('凭据写入范围不符');host.write(k,v);changed.push(k);},now:()=>Date.now()},normalized,response,decode);
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
   const names={[MDA_KEY]:'医药活动','JD_CHECKIN_TEST_ACCOUNT_V1':'京东签到','JXZY_CHECKIN_ACCOUNT_V1':'京喜','JD_JR_CHECKIN_ACCOUNT_V1':'金融','JD_PLANT_CHECKIN_ACCOUNT_V1':'种豆','JD_FARM_TASKS_ACCOUNT_V1':'农场','JD_HOME_CHECKIN_ACCOUNT_V1':'家电家居',[JC_KEY]:'领券中心',[JS_KEYS.extra]:'新增签到',[JS_KEYS.login]:'Cookie'};
   const at=typeof $script!=='undefined'&&Number(new Date($script.startTime));
   const r=await jsCapture({read,write,rawRead:k=>$persistentStore.read(k),rawWrite:(v,k)=>$persistentStore.write(v,k),observedAt:Number.isFinite(at)&&at>0&&at<=Date.now()?at:Date.now()},$request,$response,{retail:runRetailCapture,jxzy:runJxCapture,home:runHomeCapture,finance:runFinanceCapture,plant:runPlantCapture,farm:farmCapture},farmDecodeEnvironment);
   if(r?.updated?.length){const text=r.updated.map(k=>names[k]||'凭据').join('、');console.log('[签到凭据] 已更新：'+text);if(r.updated.includes(JS_KEYS.login)||r.first)$notification.post('京东签到','凭据已更新',text);}
  }catch(_){console.log('[签到凭据] 获取未完成，保留原记录');}
  finally{$done({});}
 })();
}

if(typeof module!=="undefined")module.exports={mdaCapture,MDA_KEY,jsCapture,farmDecodeEnvironment,runRetailCapture,runJxCapture,runHomeCapture,jsCouponCapture,jsActivityTaskCapture,runFinanceCapture,runPlantCapture,farmCapture};

})(context);
});}

// JD splash 2026-10-26.5. Local diagnostics; no network requests.
(function () {
  'use strict';
  const KEY='LAZING_JD_SPLASH_DIAG_V1', APIS=['start','basicConfig','welcomeHome','searchBoxWord'];
  const MAX_BODY=2*1024*1024,MAX_STORE=192*1024;
  const sensitive=/cookie|token|secret|authorization|password|session|uuid|openudid|deviceid|latitude|longitude|traceid|requestid|userid|^(?:pin|pt_pin|pt_key|phone|mobile|address|sign|h5st)$/i;
  const flagNames=['degradeSplashAD','homePageSplashAd','requestStartMins','showStartMins','showTimesDaily','maxShowTimes'];
  const action=typeof $argument==='undefined'?undefined:$argument;
  let result={},deferred=false;
  const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const header=(h,k)=>{const n=Object.keys(h||{}).find(n=>n.toLowerCase()===k.toLowerCase());return n?String(h[n]):'';};
  const safeName=k=>/^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/.test(k)&&!sensitive.test(k);
  const id=v=>(typeof v==='string'||typeof v==='number')&&/^[A-Za-z0-9_-]{1,64}$/.test(String(v))?String(v):'';
  const ids=v=>(typeof v==='string'?v.split(','):Array.isArray(v)?v:[v]).slice(0,80).map(id).filter(Boolean);
  const empty=()=>({version:1,apis:{},materials:[],assets:{recorded:0,blocked:0,records:[],notices:[]}});
  function notice(title,text){try{$notification.post('京东开屏',title,text);}catch(_){}}
  function asset(u){
    if(typeof u!=='string'||u.length>4096)return null;
    const m=/^https?:\/\/([a-z0-9.-]+)(?::(?:443|80))?(\/[^?#]*)?(?:[?#].*)?$/i.exec(u);
    if(!m)return null;const host=m[1].toLowerCase(),path=m[2]||'/';
    if(!/^(?:[a-z0-9-]+\.)?360buyimg\.com$/.test(host)&&!['storage.jd.com','vod.300hu.com','jvod.300hu.com'].includes(host))return null;
    if(path.length>600||/[\x00-\x20\x7f]/.test(path))return null;
    const file=path.slice(path.lastIndexOf('/')+1),sid=/^([a-f0-9]{12,64})(?=[.!_]|$)/i.exec(file);
    return {url:'https://'+host+path,host,path,sid:sid?sid[1].toLowerCase():''};
  }
  function load(){
    const s=empty();try{
      const raw=$persistentStore.read(KEY);if(typeof raw!=='string'||raw.length>MAX_STORE)return s;
      const x=JSON.parse(raw);if(!obj(x)||x.version!==1||!obj(x.apis))return s;
      for(const f of APIS){const b=x.apis[f];if(!obj(b))continue;s.apis[f]={hits:count(b.hits),requests:count(b.requests),lastRequestAt:count(b.lastRequestAt,1e15),samples:Array.isArray(b.samples)?b.samples.filter(obj).slice(-3).map(x=>x.limited&&String(x.result).includes('没有开屏字段')?{...x,result:'旧版扫描未完成，尚未找到目标字段'}:x):[]};}
      if(Array.isArray(x.materials))for(const m of x.materials.slice(-80)){const a=asset(m?.url);if(!a||!['image','video','auxiliary'].includes(m.kind))continue;s.materials.push({at:count(m.at,1e15),groupId:id(m.groupId),field:safeName(m.field)?m.field:'url',kind:m.kind,...a});}
      if(obj(x.assets)){
        s.assets.recorded=count(x.assets.recorded);s.assets.blocked=count(x.assets.blocked);
        for(const r of (Array.isArray(x.assets.records)?x.assets.records:[]).slice(-30)){
          const a=asset(r?.url);if(!a)continue;s.assets.records.push({at:count(r.at,1e15),action:['blocked','candidate'].includes(r.action)?r.action:'candidate',reason:['known','size','portrait','video'].includes(r.reason)?r.reason:'portrait',size:/^\d{1,5}x\d{1,5}$/.test(r.size||'')?r.size:'',groupId:id(r.groupId),...a});
        }
        const ns=Array.isArray(x.assets.notices)?x.assets.notices:[x.assets.lastNotice];for(const n of ns.slice(-20))if(obj(n)&&typeof n.key==='string'&&n.key.length<=650&&Number.isSafeInteger(n.at))s.assets.notices.push({key:n.key,at:n.at});
      }
    }catch(_){}return s;
  }
  function count(v,max=1000000){return Number.isSafeInteger(v)&&v>0?Math.min(v,max):0;}
  function save(s){try{let raw=JSON.stringify(s);if(raw.length>MAX_STORE){for(const f of APIS){const b=s.apis[f];if(b)b.samples=b.samples.slice(-1);}s.assets.records=s.assets.records.slice(-10);s.materials=s.materials.slice(-30);raw=JSON.stringify(s);}return raw.length<=MAX_STORE&&$persistentStore.write(raw,KEY)!==false;}catch(_){return false;}}
  function bucket(s,f){return s.apis[f]||(s.apis[f]={hits:0,requests:0,lastRequestAt:0,samples:[]});}
  function apiFrom(req){
    if(!/^https:\/\/api\.m\.jd\.com\/(?:client\.action|api)(?:\?|$)/i.test(String(req.url||'')))return null;
    const q=String(req.url||'').split('?')[1]||'',values=[];
    for(const p of q.split('&')){const i=p.indexOf('=');if(i>=0&&p.slice(0,i)==='functionId')try{values.push(decodeURIComponent(p.slice(i+1)));}catch(_){}}
    if(values.length)return values.length===1&&APIS.includes(values[0])?values[0]:null;
    if(typeof req.body!=='string'||req.body.length>MAX_BODY)return null;
    if(/^\s*\{/.test(req.body)){try{const j=JSON.parse(req.body);return obj(j)&&APIS.includes(j.functionId)?j.functionId:null;}catch(_){return null;}}
    const matches=[...req.body.matchAll(/(?:^|&)functionId=([^&]*)/g)];if(matches.length!==1)return null;
    try{const f=decodeURIComponent(matches[0][1]);return APIS.includes(f)?f:null;}catch(_){return null;}
  }
  function flag(v){if(typeof v==='boolean')return v;if(typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e12)return v;if(typeof v==='string'&&/^(?:true|false|-?\d{1,12}(?:\.\d{1,3})?)$/.test(v))return v;}
  function dateValue(v){
    if(typeof v!=='string')return null;const m=/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(v);if(!m)return null;
    const [y,mo,d,h,mi,se]=m.slice(1).map(Number);if(y<1900||y>9999||mo<1||mo>12||d<1||h>23||mi>59||se>59)return null;
    const t=Date.UTC(y,mo-1,d,h,mi,se),c=new Date(t);return c.getUTCFullYear()===y&&c.getUTCMonth()===mo-1&&c.getUTCDate()===d?t:null;
  }
  function inspect(doc){
    const fields=[],structure=[],seenFields=new Set(),seenKeys=new Set(),visited=new WeakSet(),reasons=new Set();
    let targetedNodes=0,generalNodes=0,decodeCount=0,decoded=0,structureLimited=false;
    const target=k=>flagNames.includes(k)||['images','expireAds','extSwitch','appConfig','JDApp-home'].includes(k)||/splash|launch|start.?ad/i.test(k);
    function keep(path,name,value){const key=path+'|'+name;if(seenFields.has(key))return;if(fields.length>=80){reasons.add('字段记录上限');return;}seenFields.add(key);fields.push({path:path.slice(0,220),name,value});}
    function walk(v,path,depth,priority){
      const n=priority?++targetedNodes:++generalNodes;if(n>(priority?20000:8000)||depth>24){reasons.add(depth>24?'层级上限':priority?'目标分组扫描上限':'普通扫描上限');return;}
      if(typeof v==='string'){
        if(!/^\s*[\[{]/.test(v))return;
        if(decodeCount>=64||v.length>=1024*1024||decoded+v.length>1024*1024){reasons.add('配置字符串扫描上限');return;}
        try{const j=JSON.parse(v);decodeCount++;decoded+=v.length;walk(j,path+'{json}',depth+1,priority);}catch(_){}return;
      }
      if(!v||typeof v!=='object'||visited.has(v))return;visited.add(v);
      if(Array.isArray(v)){for(let i=0;i<v.length;i++){walk(v[i],path+'[]',depth+1,priority);if((priority?targetedNodes:generalNodes)>(priority?20000:8000))break;}return;}
      const names=Object.keys(v).filter(safeName).sort((a,b)=>Number(target(b))-Number(target(a)));
      for(const k of names){
        const p=(path?path+'.':'')+k,x=v[k];
        if((priority||target(k))&&!seenKeys.has(p)){if(structure.length<120){structure.push(p.slice(0,220));seenKeys.add(p);}else structureLimited=true;}
        if(['onlineTime','referralsTime'].includes(k)&&dateValue(x)!==null)keep(p,k,x);
        else if(k==='expireAds')keep(p,k,{ids:ids(x),type:typeof x,length:typeof x==='string'?x.length:undefined});
        else if(flagNames.includes(k)){const f=flag(x);keep(p,k,f===undefined?{type:typeof x,length:typeof x==='string'?x.length:undefined}:f);}
        else if(k==='extSwitch')keep(p,k,{type:typeof x,length:typeof x==='string'?x.length:undefined,keys:obj(x)?Object.keys(x).filter(safeName).slice(0,80):undefined});
        else if(k==='images'&&Array.isArray(x))keep(p,k,{groups:x.length});
        walk(x,p,depth+1,priority);if((priority?targetedNodes:generalNodes)>(priority?20000:8000))break;
      }
    }
    // Inspect known modules before the general walk, with an independent budget.
    const roots=[];
    for(const [v,prefix] of [[doc,''],[obj(doc)?doc.data:null,'data']])if(obj(v))for(const k of Object.keys(v).filter(safeName))if(target(k))roots.push([v[k],(prefix?prefix+'.':'')+k]);
    for(const [v,p] of roots){walk({[p.split('.').at(-1)]:v},p.includes('.')?p.slice(0,p.lastIndexOf('.')):'',0,true);if(targetedNodes>20000)break;}
    walk(doc,'',0,false);
    return {fields,structure,limited:reasons.size>0,structureLimited,jsonStringsDecoded:decodeCount,scan:{targetedNodes,generalNodes,targetedRoots:roots.length,limitReasons:[...reasons]}};
  }
  function materials(doc,s){
    if(!obj(doc)||!['0',0].includes(doc.code)||!Array.isArray(doc.images))return {items:[],limited:false};
    const items=[],stack=[{a:doc.images,d:0}];let n=0,limited=false;
    while(stack.length){const {a,d}=stack.pop();for(const v of a){if(++n>500){limited=true;break;}if(Array.isArray(v)){if(d>=3){limited=true;continue;}stack.push({a:v,d:d+1});continue;}if(!obj(v))continue;
      const groupId=id(v.groupId),m={groupId,onlineTime:dateValue(v.onlineTime)!==null?v.onlineTime:undefined,referralsTime:dateValue(v.referralsTime)!==null?v.referralsTime:undefined,resources:[]};
      for(const field of ['url','videoUrl','buttonImg','assemblyImg','linkVideoUrl','bindMpBannerVideoUrl']){const a=asset(v[field]);if(!a)continue;const kind=field==='url'?'image':field==='videoUrl'?'video':'auxiliary';const r={field,kind,...a};m.resources.push(r);const row={at:Date.now(),groupId,...r};s.materials=s.materials.filter(x=>x.url!==row.url||x.kind!==row.kind);s.materials.push(row);}
      if(groupId||m.resources.length||m.onlineTime||m.referralsTime)items.push(m);
    }if(n>500)break;}
    s.materials=s.materials.slice(-80);return {items:items.slice(0,40),limited:limited||items.length>40};
  }
  function expire(doc){
    if(!obj(doc)||!['0',0].includes(doc.code)||!Array.isArray(doc.images))return 0;
    const pending=[],stack=[{a:doc.images,d:0}];let n=0;
    while(stack.length){const {a,d}=stack.pop();for(const v of a){if(++n>500)return 0;if(Array.isArray(v)){if(d>=3)return 0;stack.push({a:v,d:d+1});continue;}if(!obj(v))continue;const begin=dateValue(v.onlineTime),end=dateValue(v.referralsTime);if(begin===null||end===null||begin>end)continue;if(v.onlineTime!=='2000-01-01 00:00:00'||v.referralsTime!=='2000-01-02 00:00:00')pending.push(v);}}
    for(const v of pending){v.onlineTime='2000-01-01 00:00:00';v.referralsTime='2000-01-02 00:00:00';}return pending.length;
  }
  try{
    if(typeof $request==='undefined'){
      if(action==='reset'){notice(save(empty())?'诊断记录已清空':'清空失败','');}
      else{const s=load();console.log('京东开屏诊断记录（分享本次运行日志即可）');console.log(JSON.stringify(s,null,2));notice('诊断记录已导出到日志',APIS.map(f=>f+'：请求 '+(s.apis[f]?.requests||0)+'，响应 '+(s.apis[f]?.hits||0)).join('\n')+'\n素材已处理 '+s.assets.blocked+' 次；分享本次运行日志即可');}return;
    }
    // Old cached image-script entries pass through without reading the response.
    if(action==='assets')return;
    const f=apiFrom($request);
    if(!f){
      if(typeof $response!=='undefined'&&$request.method==='POST'&&Number($response.status||$response.statusCode)===200&&/^https:\/\/api\.m\.jd\.com\/(?:api|client\.action)(?:\?|$)/.test(String($request.url||''))){
        deferred=true;jdSplashCapture($request,$response).then(()=>{$done({});},()=>{console.log('[京东凭据] 获取未完成，保留原记录');$done({});});
      }return;
    }
    const state=load(),b=bucket(state,f);
    if(typeof $response==='undefined'){b.requests=Math.min(b.requests+1,1000000);b.lastRequestAt=Date.now();save(state);return;}
    const raw=$response.body,status=Number($response.status||$response.statusCode),s={at:Date.now(),httpStatus:Number.isInteger(status)?status:0,bodyChars:typeof raw==='string'?raw.length:0,result:'',fields:[],structure:[],changed:0};
    let doc;if(typeof raw!=='string')s.result='响应为二进制或缺少正文';else if(!raw.length)s.result='响应为空';else if(raw.length>MAX_BODY)s.result='响应超过2MB，未扫描正文';else{try{doc=JSON.parse(raw);}catch(_){s.result='响应不是JSON';}}
    if(doc!==undefined){const found=inspect(doc);Object.assign(s,found);const code=obj(doc)?flag(doc.code):undefined;if(code!==undefined)s.businessCode=code;
      if(f==='start'&&status===200){const m=materials(doc,state);s.materials=m.items;if(m.limited){s.limited=true;s.scan.limitReasons.push('素材记录上限');}s.changed=expire(doc);if(s.changed)result={body:JSON.stringify(doc)};}
      s.result=s.fields.length||s.materials?.length?(s.limited?'找到相关字段；扫描未完成':'找到相关字段'):(s.limited?'扫描未完成，尚未找到目标字段':'已完成扫描，未找到目标字段');
    }
    while(JSON.stringify(s).length>20*1024&&(s.structure.length||s.materials?.length||s.fields.length)){s.limited=true;s.result='记录已截断，请查看保留的目标字段';if(s.structure.length)s.structure.pop();else if(s.materials?.length)s.materials.pop();else s.fields.pop();}
    b.hits=Math.min(b.hits+1,1000000);b.samples.push(s);b.samples=b.samples.slice(-3);const ok=save(state);
    console.log('[京东开屏] '+f+'：'+s.result+'；HTTP '+s.httpStatus+(ok?'':'；记录保存失败'));
    if(s.changed)notice('开屏配置已修改',s.changed+' 条广告日期已过期'+(ok?'':'；记录保存失败'));
    else if(f==='start')notice('start 已命中','本次未修改开屏配置'+(ok?'':'；记录保存失败'));
  }catch(_){console.log('[京东开屏] 诊断未完成，原处理结果保留');}
  finally{if(!deferred)$done(result);}
})();

