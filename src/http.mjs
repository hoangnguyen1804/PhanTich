import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { PUBLIC,AUDIO,MUSIC } from './storage.mjs';
export const isLocal=req=>/^(127\.|::1$|::ffff:127\.)/.test(req.socket.remoteAddress||'');
export const lanIps=()=>Object.values(os.networkInterfaces()).flat().filter(x=>x&&x.family==='IPv4'&&!x.internal&&!x.address.startsWith('169.254.')).map(x=>x.address);
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.aac':'audio/aac','.m4a':'audio/mp4','.woff2':'font/woff2'};
const HEADERS={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'SAMEORIGIN','Cache-Control':'no-store','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' blob: data:; connect-src 'self' ws: wss:; font-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'"};
const publicPaths=p=>p==='/overlay.html'||p==='/health'||/^\/(?:js|css|assets|audio|music)\//.test(p);
export function createAuth(config,getPort){
 const goodHost=h=>{h=String(h||'').toLowerCase();const p=getPort();return [`localhost:${p}`,`127.0.0.1:${p}`,`[::1]:${p}`].includes(h)||(config.phoneEnabled&&lanIps().some(ip=>h===`${ip}:${p}`));};
 const goodOrigin=o=>{if(!o)return true;try{return goodHost(new URL(o).host);}catch{return false;}};
 function token(req,url){const bearer=String(req.headers.authorization||'').match(/^Bearer\s+(.+)$/i)?.[1];if(bearer)return bearer;const h=req.headers['x-access-token'];if(h)return String(h);if(url?.searchParams.has('token'))return url.searchParams.get('token');for(const part of String(req.headers.cookie||'').split(';')){const [k,...v]=part.trim().split('=');if(k==='arena_session')try{return decodeURIComponent(v.join('='));}catch{return '';}}return '';}
 const authorized=(req,url)=>{if(!isLocal(req))return false;const t=token(req,url),a=Buffer.from(String(t||'')),b=Buffer.from(config.rpcToken);return a.length===b.length&&crypto.timingSafeEqual(a,b);};
 return {goodHost,goodOrigin,authorized,cookie:()=>`arena_session=${encodeURIComponent(config.rpcToken)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000`};
}
export async function body(req,limit){
 let size=0;const chunks=[];
 for await(const c of req){size+=c.length;if(size>limit){const e=new Error('Dữ liệu vượt dung lượng cho phép.');e.status=413;throw e;}chunks.push(c);}return Buffer.concat(chunks);
}
export function json(res,code,value){res.writeHead(code,{...HEADERS,'Content-Type':'application/json; charset=utf-8'}).end(JSON.stringify(value));}
function fileFor(p){
 const parts=p.split('/').filter(Boolean);
 if(!parts.length||parts.some(x=>x.startsWith('.')||x.includes('\\')||x.includes(':')))return null;
 const base=parts[0]==='audio'?AUDIO:parts[0]==='music'?MUSIC:PUBLIC;
 const sub=base===PUBLIC?parts:parts.slice(1);
 if(base!==PUBLIC&&sub.length!==1)return null;
 const f=path.resolve(base,...sub);
 return f.startsWith(base+path.sep)&&MIME[path.extname(f).toLowerCase()]?f:null;
}
function sendFile(req,res,file){
 fs.lstat(file,(err,st)=>{
  if(err||!st.isFile()){json(res,404,{error:'Không tìm thấy tệp.'});return;}
  let start=0,end=st.size-1,code=200;
  const range=req.headers.range;
  if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);if(!m||(!m[1]&&!m[2])){res.writeHead(416,{'Content-Range':`bytes */${st.size}`}).end();return;}
   start=m[1]?+m[1]:Math.max(0,st.size-Number(m[2]));end=m[1]&&m[2]?Math.min(+m[2],st.size-1):st.size-1;
   if(start>end||start>=st.size){res.writeHead(416,{'Content-Range':`bytes */${st.size}`}).end();return;}code=206;
  }
  const headers={...HEADERS,'Content-Type':MIME[path.extname(file).toLowerCase()],'Content-Length':Math.max(0,end-start+1),'Accept-Ranges':'bytes'};
  if(code===206)headers['Content-Range']=`bytes ${start}-${end}/${st.size}`;
  res.writeHead(code,headers);if(req.method==='HEAD'||st.size===0){res.end();return;}
  const stream=fs.createReadStream(file,{start,end});stream.on('error',()=>res.destroy());stream.pipe(res);
 });
}
export function createHttp({auth,getPort,handleRpc,audio,exportState,version}){
 return http.createServer(async(req,res)=>{
  try{
   if(!auth.goodHost(req.headers.host)){json(res,421,{error:'Host không được phép.'});return;}
   const url=new URL(req.url,'http://local');let p;try{p=decodeURIComponent(url.pathname);}catch{json(res,400,{error:'URL không hợp lệ.'});return;}
   if(!isLocal(req)&&!(['GET','HEAD'].includes(req.method)&&publicPaths(p))){json(res,403,{error:'Bảng điều khiển chỉ mở trên máy chạy Võ Đài LIVE.'});return;}
   if(p==='/rpc'){
    if(req.method!=='POST'){res.writeHead(405,{Allow:'POST'}).end();return;}
    if(!auth.goodOrigin(req.headers.origin)){json(res,403,{error:'Origin không được phép.'});return;}
    if(!auth.authorized(req,url)){json(res,401,{error:'Thiếu mã truy cập điều khiển nội bộ.'});return;}
    let msg;try{msg=JSON.parse((await body(req,65536)).toString('utf8'));}catch(e){json(res,e.status||400,{jsonrpc:'2.0',id:null,error:{code:-32700,message:e.status?'Dữ liệu quá lớn':'JSON không hợp lệ'}});return;}
    const out=await handleRpc(msg);if(out===null){res.writeHead(204).end();return;}json(res,200,out);return;
   }
   if(p==='/upload/music'){
    if(req.method!=='POST'){res.writeHead(405,{Allow:'POST'}).end();return;}
    if(!auth.goodOrigin(req.headers.origin)||!auth.authorized(req,url)){json(res,403,{error:'Không có quyền tải nhạc.'});return;}
    const MAX=50*1024*1024;if(Number(req.headers['content-length']||0)>MAX){json(res,413,{error:'Mỗi bài tối đa 50 MiB.'});return;}
    let name;try{name=decodeURIComponent(String(req.headers['x-file-name']||''));}catch{json(res,400,{error:'Tên tệp không hợp lệ.'});return;}
    try{const result=audio().saveMusic(name,await body(req,MAX));json(res,200,result);}catch(e){json(res,e.status||400,{error:e.message});}return;
   }
   if(p==='/download/state'){
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
    if(!auth.authorized(req,url)){json(res,401,{error:'Không có quyền xuất dữ liệu.'});return;}
    const data=JSON.stringify(exportState(),null,2);res.writeHead(200,{...HEADERS,'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="vo-dai-live-state.json"'}).end(req.method==='HEAD'?'':data);return;
   }
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
   if(p==='/health'){json(res,200,{ok:true,app:'vo-dai-live',version:version||'1.1.0',port:getPort()});return;}
   if(p==='/')p='/index.html';
   if(p==='/index.html'){
    if(!isLocal(req)){json(res,403,{error:'Chỉ mở bảng điều khiển trên máy này.'});return;}
    if(url.searchParams.has('token')){if(!auth.authorized(req,url)){json(res,401,{error:'Mã truy cập không hợp lệ.'});return;}res.writeHead(302,{...HEADERS,'Set-Cookie':auth.cookie(),Location:'/'}).end();return;}
    res.setHeader('Set-Cookie',auth.cookie());
   }
   const file=fileFor(p);if(!file){json(res,404,{error:'Không tìm thấy tệp.'});return;}sendFile(req,res,file);
  }catch(e){if(!res.headersSent)json(res,e.status||500,{error:e.status?e.message:'Không xử lý được yêu cầu.'});else res.destroy();}
 });
}
