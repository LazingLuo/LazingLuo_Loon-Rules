'use strict';
// Reuse exactly the SDK/browser/environment section of the current audited core.
const fs=require('node:fs'),path=require('node:path');
const candidate=path.resolve(__dirname,'..');
const base=fs.existsSync(path.join(candidate,'Qinglong/function/jd-core.js'))?candidate:path.resolve(__dirname,'..','..');
const own=fs.existsSync(path.join(base,'Qinglong/function/jd-core.js'))?'Qinglong':'nas-qinglong-own';
const source=fs.readFileSync(path.join(base,own,'function/jd-core.js'),'utf8');
const begin=source.indexOf('function jdcDecodeEnvironment('),end=source.indexOf('async function jdcRun(');
if(begin<0||end<begin)throw Error('Audited SDK section changed; review before building');
const sdk=source.slice(begin,end);
if(sdk.split('function jdcInstallBrowser(').length!==2||sdk.split('function jdcMakeSigner(').length!==2||!sdk.includes('h5_file_v5.3.6'))throw Error('Unexpected signer core');
const prefix="'use strict';\n// Generated from the existing audited check-in signer. No network requests.\nconst crypto=require('node:crypto');\nconst caches=new Map();\nfunction jdcRead(key,fallback){return caches.has(key)?caches.get(key):fallback;}\nfunction jdcWrite(key,value){caches.set(key,value);}\n";
const output=prefix+sdk+fs.readFileSync(path.join(__dirname,'plant-signer-wrapper.js'),'utf8');
fs.writeFileSync(path.join(base,own,'function/plant-signer.js'),output);
console.log('Built isolated plant task signer ('+Buffer.byteLength(output)+' bytes)');
