// Runs inside the unified local capture wrapper. No signing or HTTP requests.
const KEY='JD_PLANT_TASK_CONTEXT_V1',LINK='4HcenxuZM4XiHesOb1HG4g';
const apps={apTaskList:null,apTaskDetail:null,apStartTaskTime:'acb1e',apDoLimitTimeTask:'ebecc',apsDoTask:'54ed7',apTaskDrawAward:'f0f3f'};
const fields=['appid','client','clientVersion','platform','loginType','loginWQBiz','x-api-eid-token','uuid','build','screen','networkType','d_brand','d_model','lang','osVersion','partner','wg-sdk-token','ext','cthr','openudid','adid'];
function form(text){const out={};for(const part of String(text||'').split('&')){const i=part.indexOf('=');if(i<0)continue;out[decodeURIComponent(part.slice(0,i).replace(/\+/g,' '))]=decodeURIComponent(part.slice(i+1).replace(/\+/g,' '));}return out;}
function header(name){const key=Object.keys($request.headers||{}).find(k=>k.toLowerCase()===name.toLowerCase());const v=key?$request.headers[key]:'';return Array.isArray(v)?v.join('; '):String(v||'');}
function environment(encoded){
 const map='rqponmlkjihgfedcbaZYXWVUTSRQPONMLKJIHGFEDCBA-_9876543210zyxwvuts';let bits=0,value=0,bytes=[];
 if(typeof encoded!=='string'||encoded.length<16||encoded.length>12000)throw Error('environment');
 for(let i=encoded.length-1;i>=0;i--){const n=map.indexOf(encoded[i]);if(n<0)throw Error('environment');value=value<<6|n;bits+=6;if(bits>=8){bits-=8;bytes.push(value>>>bits&255);}}
 const a=bytes.indexOf(123),b=bytes.lastIndexOf(125);if(a<0||b<=a)throw Error('environment');
 const env=JSON.parse(decodeURIComponent(bytes.slice(a,b+1).map(v=>'%'+v.toString(16).padStart(2,'0')).join('')));
 if(!['h5_file_v5.3.5','h5_file_v5.3.6'].includes(env.v)||!env.pp||!env.extend||typeof env.fp!=='string')throw Error('environment');return env;
}
if(!/^https:\/\/api\.m\.jd\.com\/api(?:\?|$)/.test($request.url))return;
const params=Object.assign(form(($request.url.split('?')[1]||'').split('#')[0]),form($request.body));
const fid=params.functionId;if(!Object.prototype.hasOwnProperty.call(apps,fid))return;
const body=JSON.parse(params.body||'{}'),response=JSON.parse($response.body||'{}');
if(body.linkId!==LINK||response.success!==true||String(response.code)!=='0')return;
if(params.appid!==(fid==='apStartTaskTime'?'activity_platform_se':'activities_platform'))return;
const headers={};for(const name of ['Cookie','User-Agent','Referer','Origin','Accept','Accept-Language','x-rp-client','x-referer-page','request-from','sec-fetch-site','sec-fetch-mode','sec-fetch-dest','priority']){const v=header(name);if(v)headers[name]=v;}
const pins=(headers.Cookie||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith('pt_pin='));
const keys=(headers.Cookie||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith('pt_key='));
if(pins.length!==1||keys.length!==1||!pins[0].slice(7)||!keys[0].slice(7)||!headers['User-Agent']||!/^https:\/\/(?:pro|h5)\.m\.jd\.com\//.test(headers.Referer||''))return;
const pin=pins[0].slice(7),sig=String(params.h5st||'').split(';'),app=apps[fid];
let env;
if(app){if(sig.length!==10||sig[2]!==app||sig[5]!=='5.3')return;env=environment(sig[7]);if(![pin,decodeURIComponent(pin)].includes(env.pp.p1))return;}
for(const field of ['client','clientVersion','x-api-eid-token','uuid','wg-sdk-token'])if(!params[field])return;
const start=$script&&$script.startTime?Number(new Date($script.startTime)):NaN;
const now=Number.isFinite(start)&&start>0&&start<=Date.now()?start:Date.now();
const raw=$persistentStore.read(KEY),old=raw?JSON.parse(raw):null;if(old&&old.pin!==pin)return;
const previous=old&&old.templates&&old.templates[fid];if(previous&&now<Number(previous.capturedAt||0))return;
const changed=old&&(old.uuid!==params.uuid||old.clientVersion!==params.clientVersion||old.headers['User-Agent']!==headers['User-Agent']);
if(changed&&now<Number(old.updatedAt||0))return;
const profile=!old||changed?{version:1,pin,linkId:LINK,uuid:params.uuid,clientVersion:params.clientVersion,templates:{}}:old;
const clean={};for(const key of fields)if(params[key]!==undefined)clean[key]=params[key];
const template={endpoint:'https://api.m.jd.com/api',params:clean,headers,capturedAt:now,unsignedH5st:params.h5st==='null'};
if(app){template.referenceEnvironmentEncoded=sig[7];template.signatureParameterEncoding=sig[9];template.signatureAppId=app;template.environmentVersion=env.v;}
profile.templates[fid]=template;
if(now>=Number(profile.updatedAt||0)){profile.headers=headers;profile.updatedAt=now;profile.capturedAt=now;}
profile.ready=['apTaskList','apStartTaskTime','apDoLimitTimeTask'].every(k=>!!profile.templates[k]);
if(!$persistentStore.write(JSON.stringify(profile),KEY))throw Error('save');
