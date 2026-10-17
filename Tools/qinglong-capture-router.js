// One response rule per request. Reuse local stores consumed by the NAS bridge.
(async function () {
  const VERSION='2026-10-18.1';
  const LAST='QL_BRIDGE_CAPTURE_LAST_V1', HISTORY='QL_BRIDGE_CAPTURE_HISTORY_V1';
  const JD='JD_CHECKIN_TEST_ACCOUNT_V1', JX='JXZY_CHECKIN_ACCOUNT_V1', JR='JD_JR_CHECKIN_ACCOUNT_V1', LOGIN='QL_BRIDGE_CREDENTIAL_V1';
  const PLANT='JD_PLANT_TASK_CONTEXT_V1';
  const allowed=new Set([JD,JX,JR,LOGIN,PLANT]);
  let record;
  function read(key){const raw=$persistentStore.read(key);return raw?JSON.parse(raw):null;}
  function enabled(value, fallback=true){return value===undefined?fallback:value===true||value==='true';}
  function functionId(text){
    const values=[];
    if(typeof text!=='string')return {id:null};
    for(const field of text.split('&')){
      const at=field.indexOf('=');if(at<0)continue;
      let key;try{key=decodeURIComponent(field.slice(0,at).replace(/\+/g,' '));}catch(_){continue;}
      if(key!=='functionId')continue;
      try{values.push(decodeURIComponent(field.slice(at+1).replace(/\+/g,' ')));}catch(_){return {invalid:true};}
    }
    return values.length>1?{invalid:true}:{id:values.length?values[0]:null};
  }
  try {
    if(typeof $request==='undefined'||typeof $response==='undefined'||$request.method!=='POST'||Number($response.status)!==200)return;
    let config=typeof $argument==='undefined'?{}:$argument;
    if(typeof config==='string')config=JSON.parse(config);
    if(!config||typeof config!=='object'||Array.isArray(config))return;
    const login=enabled(config.capture),activities=enabled(config.captureActivities);
    if(!login&&!activities)return;
    const url=String($request.url||''),jd=/^https:\/\/api\.m\.jd\.com\/(?:api|client\.action)(?:\?[^#]*)?$/.test(url);
    let fid=null,location;
    if(jd){
      const query=functionId(url.includes('?')?url.slice(url.indexOf('?')+1):''),body=functionId($request.body);
      if(query.invalid||body.invalid||query.id!==null&&body.id!==null&&query.id!==body.id){
        record={time:Date.now(),version:VERSION,source:'京东请求',endpoint:'functionId',status:'ignored',message:'接口标识重复、冲突或编码异常，保留原凭据'};return;
      }
      fid=body.id===null?query.id:body.id;
      location=query.id!==null?(body.id!==null?'url_and_body':'url'):'body';
    }
    const daily=['startup','logConfig','queryPagePopWindow','babelGetGuideTips'];
    const retail=['findBeanSceneNew','bff_rightsCenter_jdInteractTask','bff_rightsCenter_interaction','bff_marketing_interaction'];
    const jx=['jxzy_active_querySign','jxzy_active_drawSign','jxzy_active_queryActive'];
    const plant=['apTaskList','apTaskDetail','apStartTaskTime','apDoLimitTimeTask','apsDoTask','apTaskDrawAward'].includes(fid);
    const cash=/^https:\/\/ms\.jr\.jd\.com\/gw2\/generic\/jrSign\/h5\/m\/(?:queryWeekSignMain|queryCashSignSub|dailyCashSignReceive)(?:\?|$)/.test(url);
    const double=/^https:\/\/ms\.jr\.jd\.com\/gw2\/generic\/legogw\/h5\/m\/getPageInfoDoubleSignInForH5(?:\?|$)/.test(url);
    const activity=activities&&(retail.includes(fid)||jx.includes(fid)||cash||double||plant);
    const shared=login&&(daily.includes(fid)||retail.includes(fid));
    if(!activity&&!shared)return;
    const label=cash?'金融现金签到':double?'金融双签':plant?'种豆任务':jx.includes(fid)?'京喜自营':retail.includes(fid)?'京东签到活动':'京东登录';
    record={time:Date.now(),version:VERSION,source:label,endpoint:fid||url.split('?')[0].split('/').pop(),...(fid?{functionIdSource:location}:{}),status:'ignored',message:'请求未通过活动校验或凭据不完整，保留原记录'};
    const headers={};Object.keys($request.headers||{}).forEach(k=>{headers[k.toLowerCase()]=Array.isArray($request.headers[k])?$request.headers[k].join('; '):$request.headers[k];});
    const cookie=String(headers.cookie||''), pins=cookie.split(';').map(x=>x.trim()).filter(x=>x.startsWith('pt_pin='));
    const keys=cookie.split(';').map(x=>x.trim()).filter(x=>x.startsWith('pt_key='));
    if(pins.length!==1||keys.length!==1||!pins[0].slice(7)||!keys[0].slice(7))throw Error('凭据不完整');
    const pin=pins[0].slice(7);
    const bound=read('QL_BRIDGE_ACCOUNT_V1')||read(JD)||read(LOGIN)||read(JX)||read(JR)||read(PLANT);
    if(bound&&bound.pin&&bound.pin!==pin){record.status='account_mismatch';record.message='账号与已绑定凭据不一致，未覆盖或上传';return;}
    const before=Object.fromEntries([...allowed].map(k=>[k,$persistentStore.read(k)||'']));
    const blocked=()=>{throw Error('凭据获取不得发送网络请求');};
    // Legacy parsers expect the functionId in the URL. Normalize only their
    // private request copy for body-only calls; never rewrite the live request.
    const request=Object.assign({},$request,{headers});
    if(fid&&location==='body')request.url=url+(url.includes('?')?(url.endsWith('?')?'':'&'):'?')+'functionId='+encodeURIComponent(fid);
    const context={
      $request:request,$response,
      $argument:{capture:true,refreshLogin:true},
      $script:typeof $script==='undefined'?{}:$script,
      $persistentStore:{read:k=>$persistentStore.read(k),write:(v,k)=>{if(!allowed.has(k))throw Error('获取入口不得修改签到结果或提交记录');return $persistentStore.write(v,k);}},
      $notification:{post:()=>{}},console:{log:()=>{}},
      $httpClient:Object.fromEntries(['get','post','put','delete','patch','head'].map(k=>[k,blocked]))
    };
    if(activity){
      if(plant)runPlantTaskCapture(context);
      else if(retail.includes(fid))runRetailCapture(context);
      else if(jx.includes(fid))runJxCapture(context);
      else runFinanceCapture(context);
    }
    if(shared)await runLoginCapture(context);
    if(login&&plant&&($persistentStore.read(PLANT)||'')!==before[PLANT]){
      const p=read(PLANT),saved=read(LOGIN),time=Number(p.capturedAt||0);
      if(!saved||time>=Number(saved.capturedAt||0))$persistentStore.write(JSON.stringify({pin,cookie:keys[0]+';'+pins[0]+';',capturedAt:time,source:'plant-task:'+fid}),LOGIN);
    }
    const changed=[...allowed].filter(k=>($persistentStore.read(k)||'')!==before[k]);
    record.updated=changed.map(k=>({[JD]:'京东签到活动',[JX]:'京喜自营',[JR]:'金融签到／双签',[LOGIN]:'京东登录',[PLANT]:'种豆任务'})[k]);
    const activityKey=plant?PLANT:retail.includes(fid)?JD:jx.includes(fid)?JX:JR;
    if(activity)record.activityStatus=changed.includes(activityKey)?'updated':'not_saved';
    if(changed.length){
      record.status=activity&&!changed.includes(activityKey)?'partial':'updated';
      if(changed.includes(JD))record.jdModes=Object.keys((read(JD)||{}).modes||{});
      if(changed.includes(JX)){const p=read(JX);record.complete=!!(p.query&&p.signing);}
      if(changed.includes(JR)){const p=read(JR);record.complete=!!p.ready;record.doublePagePresent=!!p.doubleSign;}
      if(changed.includes(PLANT)){const p=read(PLANT);record.complete=!!p.ready;record.templates=Object.keys(p.templates||{});}
      record.message='已更新'+record.updated.join('、')+'；仅保存在手机，未上传或执行签到';
      if(record.status==='partial')record.message+='；活动请求未通过保存条件，请查看页面和签名环境';
    }
  }catch(_){
    if(record){record.status='failed';record.message='凭据获取失败，请检查登录、页面信息及本地保存；未上传或执行签到';}
  }finally{
    if(record){
      try{
        const raw=$persistentStore.read(HISTORY);let rows=[];
        try{rows=JSON.parse(raw||'[]');}catch(_){}
        if(!Array.isArray(rows))rows=[];
        if(!$persistentStore.write(JSON.stringify(record),LAST)||!$persistentStore.write(JSON.stringify(rows.concat(record).slice(-30)),HISTORY))throw Error();
      }catch(_){record.status='failed';record.message='获取结果保存失败，请查看本机存储';}
      console.log('[青龙凭据获取] '+JSON.stringify(record));
    }
    $done({});
  }
})();
