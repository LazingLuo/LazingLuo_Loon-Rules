'use strict';
// Dedicated digest channels. No global sendNotify variables or raw API errors.
const http=require('node:http'),https=require('node:https'),tls=require('node:tls');
function configError(message){const e=new Error(message);e.safe=true;throw e;}
function proxyUrl(value){
  if(!value)return '';
  let u;try{u=new URL(value);}catch(_){configError('Telegram 代理地址格式错误');}
  if(u.protocol!=='http:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)configError('Telegram 代理请填写无账号密码的 HTTP 代理地址，例如 http://mihomo:7890');
  return u.href;
}
function bounded(text,limit,bytes=false){
  const size=s=>bytes?Buffer.byteLength(s):s.length;
  if(size(text)<=limit)return text;
  const tail='\n摘要较长，完整内容请查看青龙日报日志。';let result='';
  for(const char of text){if(size(result)+size(char)+size(tail)>limit)break;result+=char;}
  return result+tail;
}
function channels(env,title,content){
  const list=[],token=String(env.LAZING_JD_REPORT_TG_BOT_TOKEN||'').trim(),chat=String(env.LAZING_JD_REPORT_TG_CHAT_ID||'').trim();
  if(token||chat){
    if(!/^\d{5,16}:[A-Za-z0-9_-]{20,128}$/.test(token)||! /^-?\d{1,20}$/.test(chat))configError('请完整填写 LAZING_JD_REPORT_TG_BOT_TOKEN 和数字形式的 LAZING_JD_REPORT_TG_CHAT_ID');
    list.push({id:'telegram',name:'Telegram',url:'https://api.telegram.org/bot'+token+'/sendMessage',body:{chat_id:chat,text:bounded(title+'\n'+content,4000),link_preview_options:{is_disabled:true}},options:{proxyUrl:proxyUrl(String(env.LAZING_JD_REPORT_TG_PROXY_URL||'').trim()),jsonErrors:true},accepted:r=>r&&r.ok===true&&r.result&&r.result.message_id!==undefined,rejected:r=>r&&r.ok===false&&Number(r.error_code)>=400&&Number(r.error_code)<500});
  }
  const bark=String(env.LAZING_JD_REPORT_BARK_URL||'').trim();
  if(bark){
    let u;try{u=new URL(bark);}catch(_){configError('Bark 地址格式错误');}
    const parts=u.pathname.replace(/\/$/,'').split('/'),key=parts.pop();
    if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||! /^[A-Za-z0-9_-]{6,256}$/.test(key||''))configError('Bark 请填写 HTTPS 服务器地址和设备 Key，例如 https://api.day.app/你的Key，不含测试文字');
    list.push({id:'bark',name:'Bark',url:u.origin+parts.join('/')+'/push',body:{device_key:key,title,body:bounded(content,2800,true),group:'京东日报',isArchive:"1"},options:{jsonErrors:true},accepted:r=>r&&Number(r.code)===200,rejected:r=>r&&Number(r.code)>=400&&Number(r.code)<500});
  }
  return list;
}
function tunnelAgent(proxy,target){
  const agent=new https.Agent({keepAlive:false});
  agent.createConnection=(options,callback)=>{
    let done=false,socket,secure;
    const connect=http.request(proxy,{method:'CONNECT',path:target.hostname+':'+(target.port||443),headers:{Host:target.hostname+':'+(target.port||443)},agent:false});
    const timer=setTimeout(()=>finish(new Error('proxy timeout')),10000);
    function finish(e,value){if(done)return;done=true;clearTimeout(timer);if(e){connect.destroy();if(secure)secure.destroy();if(socket)socket.destroy();}callback(e,value);}
    connect.on('connect',(res,s,head)=>{
      socket=s;if(res.statusCode!==200)return finish(new Error('proxy rejected'));
      if(head.length)s.unshift(head);
      secure=tls.connect({socket:s,servername:target.hostname,rejectUnauthorized:true},()=>finish(null,secure));
      secure.on('error',()=>finish(new Error('TLS failed')));
    });
    connect.on('error',()=>finish(new Error('proxy failed')));connect.end();
  };
  return agent;
}
function request(url,method,body,headers={},options={}){
  return new Promise((resolve,reject)=>{
    const data=body===undefined?null:JSON.stringify(body),parsed=new URL(url),client=parsed.protocol==='https:'?https:http;
    // Only the dedicated Telegram call receives a proxy; Qinglong stays local.
    const agent=options.proxyUrl?tunnelAgent(proxyUrl(options.proxyUrl),parsed):undefined;
    let settled=false,req;
    const timer=setTimeout(()=>{if(req)req.destroy();finish(new Error('timeout'));},15000);
    const finish=(e,v)=>{if(settled)return;settled=true;clearTimeout(timer);if(agent)agent.destroy();e?reject(e):resolve(v);};
    req=client.request(parsed,{method,agent,headers:{Accept:'application/json',...headers,...(data?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}:{})},rejectUnauthorized:true},res=>{
      let length=0;const parts=[];
      res.on('data',chunk=>{length+=chunk.length;if(length>2*1024*1024){finish(new Error('response limit'));req.destroy();}else parts.push(chunk);});
      res.on('end',()=>{if(res.statusCode!==200&&!(options.jsonErrors&&res.statusCode>=400&&res.statusCode<500))return finish(new Error('http status'));try{finish(null,JSON.parse(Buffer.concat(parts).toString('utf8')));}catch(_){finish(new Error('json'));}});
      res.on('error',()=>finish(new Error('network')));
    });
    req.on('error',()=>finish(new Error('network')));if(data)req.write(data);req.end();
  });
}
module.exports={channels,request,bounded,proxyUrl};
