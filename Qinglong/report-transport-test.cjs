// Local-only HTTP CONNECT + TLS integration. Requires openssl for an ephemeral test CA.
'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),https=require('node:https'),net=require('node:net'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn,spawnSync}=require('node:child_process');
const {request}=require('./function/report-notify');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lazing-report-tls-')),sockets=new Set();
let api,proxy;
const listen=s=>new Promise(r=>s.listen(0,'127.0.0.1',r));
const close=s=>s?new Promise(r=>s.close(r)):Promise.resolve();
const track=s=>{sockets.add(s);s.on('error',()=>{});s.on('close',()=>sockets.delete(s));};
(async()=>{try{
  const key=path.join(tmp,'key.pem'),cert=path.join(tmp,'cert.pem'),conf=path.join(tmp,'openssl.cnf');
  fs.writeFileSync(conf,'[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=api.telegram.org\n[ext]\nsubjectAltName=DNS:api.telegram.org\nbasicConstraints=critical,CA:TRUE\n');
  const gen=spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-config',conf],{stdio:'ignore'});assert.equal(gen.status,0,'local test needs openssl');
  let received=0,connects=0;
  api=https.createServer({key:fs.readFileSync(key),cert:fs.readFileSync(cert)},(req,res)=>{
    assert.equal(req.url,'/botTEST/sendMessage');assert.equal(req.method,'POST');assert.equal(req.headers.host,'api.telegram.org');let data='';req.on('data',x=>data+=x);req.on('end',()=>{assert.deepEqual(JSON.parse(data),{text:'本地 TLS 测试'});received++;res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,result:{message_id:1}}));});
  });api.on('connection',track);await listen(api);
  proxy=http.createServer((req,res)=>{res.writeHead(400);res.end();});proxy.on('connection',track);
  proxy.on('connect',(req,client,head)=>{
    assert.equal(req.url,'api.telegram.org:443');assert(!req.url.includes('botTEST'));connects++;
    const upstream=net.connect(api.address().port,'127.0.0.1',()=>{client.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)upstream.write(head);client.pipe(upstream);upstream.pipe(client);});track(upstream);client.on('close',()=>upstream.destroy());upstream.on('error',()=>client.destroy());
  });await listen(proxy);
  const proxyUrl='http://127.0.0.1:'+proxy.address().port;
  // An untrusted proxy-side certificate must fail, rather than disabling validation.
  await assert.rejects(request('https://api.telegram.org/botTEST/sendMessage','POST',{text:'本地 TLS 测试'},{},{proxyUrl,jsonErrors:true}));assert.equal(received,0);
  // Child trusts only our ephemeral CA via Node's standard CA mechanism.
  const code=`require(${JSON.stringify(path.resolve(__dirname,'function/report-notify'))}).request('https://api.telegram.org/botTEST/sendMessage','POST',{text:'本地 TLS 测试'},{},{proxyUrl:${JSON.stringify(proxyUrl)},jsonErrors:true}).then(r=>{if(!r.ok)process.exitCode=1;}).catch(()=>{process.exitCode=1;});`;
  const child=spawn(process.execPath,['-e',code],{env:{...process.env,NODE_EXTRA_CA_CERTS:cert},stdio:'ignore'});
  assert.equal(await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);}),0);assert.equal(received,1);assert.equal(connects,2);
  // Definitive 4xx JSON is available for classification; 5xx stays ambiguous.
  const plain=http.createServer((req,res)=>{res.writeHead(req.url==='/bad'?400:500,{'Content-Type':'application/json'});res.end('{"ok":false,"error_code":400}');});plain.on('connection',track);await listen(plain);
  try{const base='http://127.0.0.1:'+plain.address().port;assert.equal((await request(base+'/bad','POST',{}, {},{jsonErrors:true})).error_code,400);await assert.rejects(request(base+'/uncertain','POST',{}, {},{jsonErrors:true}));}finally{await close(plain);}
  console.log('PASS: local HTTP CONNECT routing, verified TLS, untrusted certificate rejection, JSON 4xx and ambiguous 5xx; no public network requests.');
}finally{for(const socket of sockets)socket.destroy();await close(proxy);await close(api);fs.rmSync(tmp,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
