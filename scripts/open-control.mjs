import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const home=path.resolve(process.env.ARENA_HOME||root),since=Date.now()-2000;
for(let i=0;i<120;i++){
 try{
  const r=JSON.parse(fs.readFileSync(path.join(home,'data/runtime.json'),'utf8'));
  if(r.startedAt>=since){
   const res=await fetch(`http://127.0.0.1:${r.port}/health`,{signal:AbortSignal.timeout(1000)});
   if(res.ok&&(await res.json()).app==='vo-dai-live'){
    const url=`http://localhost:${r.port}/`;
    const child=process.platform==='win32'?spawn('cmd',['/c','start','""',url],{detached:true,stdio:'ignore',windowsHide:true}):spawn(process.platform==='darwin'?'open':'xdg-open',[url],{detached:true,stdio:'ignore'});
    child.on('error',()=>{});child.unref();process.exit(0);
   }
  }
 }catch{}
 await new Promise(r=>setTimeout(r,500));
}
console.error('Chưa mở được trình duyệt. Xem địa chỉ điều khiển trong cửa sổ máy chủ.');
