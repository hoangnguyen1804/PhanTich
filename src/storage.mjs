import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const HOME=path.resolve(process.env.ARENA_HOME||ROOT);
export const DATA=path.join(HOME,'data');
export const MUSIC=path.join(HOME,'nhac');
export const AUDIO=path.join(DATA,'audio');
export const PUBLIC=path.join(ROOT,'public');
for(const dir of [DATA,MUSIC,AUDIO]) fs.mkdirSync(dir,{recursive:true});
export function readJSON(file,fallback={}){try{return JSON.parse(fs.readFileSync(file,'utf8'))??fallback;}catch{return fallback;}}
export function writeJSON(file,value){
 const tmp=`${file}.${process.pid}.tmp`;
 fs.writeFileSync(tmp,JSON.stringify(value,null,2),{mode:0o600});
 try{fs.renameSync(tmp,file);}catch(e){try{fs.unlinkSync(tmp);}catch{}throw e;}
}
export function loadConfig(){
 const file=path.join(DATA,'app-config.json');
 const c=readJSON(file,{});
 const config={port:3100,phoneEnabled:false,...c};
 if(!/^[a-f0-9]{48,}$/.test(config.rpcToken||'')) config.rpcToken=crypto.randomBytes(24).toString('hex');
 writeJSON(file,config);return config;
}
export function saveConfig(config){writeJSON(path.join(DATA,'app-config.json'),config);}
export function createStore(){
 const file=path.join(DATA,'arena.json');let timer=null,pending=null;
 return {load:()=>readJSON(file,{}),save(value){pending=value;clearTimeout(timer);timer=setTimeout(()=>{timer=null;try{writeJSON(file,pending);}catch{}},400);timer.unref();},flush(){clearTimeout(timer);if(pending)writeJSON(file,pending);}};
}

// One process per data directory. A double-click must never overwrite an ongoing LIVE.
export function lockInstance(){
 const file=path.join(DATA,'instance.lock'),nonce=crypto.randomBytes(12).toString('hex');
 for(let attempt=0;attempt<3;attempt++){
  let fd;
  try{fd=fs.openSync(file,'wx',0o600);}catch(error){
   if(error.code!=='EEXIST')throw error;
   const previous=readJSON(file,null);
   if(!previous||!Number.isInteger(previous.pid)||previous.pid<=0)throw new Error('Thư mục dữ liệu đang được mở. Nếu không có phiên nào chạy, kiểm tra data/instance.lock trước khi mở lại.');
   let running=true;
   try{process.kill(previous.pid,0);}catch(e){if(e.code==='ESRCH')running=false;else if(e.code!=='EPERM')throw e;}
   if(running)throw new Error('Võ Đài LIVE đã chạy trong thư mục dữ liệu này. Mở bảng điều khiển hiện có; không chạy hai phiên cùng dữ liệu.');
   fs.rmSync(file,{force:true});continue;
  }
  try{fs.writeFileSync(fd,JSON.stringify({pid:process.pid,nonce,startedAt:Date.now()}));}finally{fs.closeSync(fd);}
  const release=()=>{try{if(readJSON(file,null)?.nonce===nonce)fs.rmSync(file,{force:true});}catch{}};
  process.once('exit',release);return release;
 }
 throw new Error('Chưa lấy được quyền ghi dữ liệu. Đợi giây lát rồi thử lại.');
}
