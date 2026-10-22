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
if(typeof $request!=='undefined'&&typeof $persistentStore!=='undefined'){
  (function(){
    try{
      let options=typeof $argument==='object'?$argument:{};if(typeof $argument==='string'&&$argument.startsWith('{'))options=JSON.parse($argument);
      if(options.capture===false||options.capture==='false')return;
      const read=(k,f)=>{const s=$persistentStore.read(k);return s?JSON.parse(s):f;};
      const write=(k,v)=>{if(!$persistentStore.write(JSON.stringify(v),k))throw Error('农场凭据保存失败');};
      const observed=typeof $script!=='undefined'&&$script.startTime?Number(new Date($script.startTime)):Date.now();
      const row=farmCapture({read,write,now:()=>Date.now(),observedAt:observed},$request,$response,farmDecodeEnvironment);
      if(row){console.log('[东东农场] '+(row.scope==='farm'?'农场':'转盘')+'凭据已更新');if(row.firstReady)$notification.post('东东农场','凭据已保存',(row.scope==='farm'?'农场':'转盘')+'可以手动查询和执行任务。');}
    }catch(_){console.log('[东东农场] 凭据未更新，请重新打开活动页面');}
    finally{$done({});}
  })();
}

if(typeof module!=="undefined")module.exports={farmCapture,farmDecodeEnvironment,farmTools};
