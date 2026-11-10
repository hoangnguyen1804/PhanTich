import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {WebSocketServer} from 'ws';
import {createArena,GIFT_ACTIONS as ENGINE_GIFT_ACTIONS} from './src/arena.mjs';
import {createAudio} from './src/audio.mjs';
import {createTikTok} from './src/tiktok.mjs';
import {DATA,MUSIC,loadConfig,saveConfig,createStore,writeJSON,lockInstance} from './src/storage.mjs';
import {createAuth,createHttp,isLocal,lanIps} from './src/http.mjs';
import {catalog,findGift,refreshCatalog} from './src/catalog.mjs';

const releaseInstance=lockInstance();
const VERSION='1.1.0',config=loadConfig(),store=createStore();
if(process.env.ARENA_PHONE==='1')config.phoneEnabled=true;
const offline=process.env.ARENA_OFFLINE==='1';
let port=Number(process.env.PORT)||Number(config.port)||3100,arena,audio,tiktok,wss,demoTimer=null,stopping=false,rebinding=false;
const logs=[];
const send=(event,only)=>{if(!wss)return;const msg=JSON.stringify(event);for(const ws of wss.clients)if(ws.readyState===1&&(!only||ws.role===only)){if(ws.bufferedAmount>2*1024*1024){ws.close(1013,'Kết nối chậm');continue;}ws.send(msg);}};
function logger(text){
 const line={at:Date.now(),text:String(text).replace(/Bearer\s+\S+/gi,'Bearer [ẩn]').slice(0,500)};
 logs.push(line);if(logs.length>200)logs.shift();send({type:'log',...line},'control');
}
arena=createArena({initial:store.load(),onSave:value=>store.save(value),onEvent:event=>{send(event);try{audio?.announce(event,arena?.snapshot());}catch{}if(event.text)logger(event.text);}});
arena.command('settings.set',{settings:{phoneEnabled:config.phoneEnabled}});
audio=createAudio({dataDir:DATA,musicDir:MUSIC,onEvent:e=>send(e),getSettings:()=>arena.snapshot().settings,offline,logger});
tiktok=createTikTok({onEvent:(kind,payload)=>{try{arena.ingest(kind,payload,{source:'live'});}catch(e){logger(e.message);}},onStatus:s=>{send({type:'connection',...s});logger(s.status==='connected'?`Đã nhận LIVE @${s.uniqueId}`:s.error||`TikTok: ${s.status}`);},getSignKey:()=>config.signApiKey||'',findGift,offline,logger});
const auth=createAuth(config,()=>port);
const giftMenu=state=>(state.settings.cornerGifts||[]).map((rule,index)=>{
 const action=ENGINE_GIFT_ACTIONS.find(x=>x.id===rule.action);
 return action?{id:`coins-${rule.side}-${rule.coins}`,side:rule.side,coins:rule.coins,action:rule.action,label:action.label,emoji:action.emoji,name:`${rule.coins} xu`}:null;
}).filter(Boolean);
const snapshot=()=>{const state=arena.snapshot();return {...state,giftMenu:giftMenu(state),app:{name:'VÕ ĐÀI LIVE',version:VERSION,noLicense:true},connection:{...tiktok.status(),hasSignKey:!!config.signApiKey},demo:{running:!!demoTimer},music:audio.music(),audio:{...audio.status?.(),offline},logs:logs.slice(-80)};};
function publish(){send({type:'state',state:snapshot()});}
const safeText=(value,max=60)=>String(value??'').normalize('NFKC').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e]/g,'').trim().slice(0,max);
function stopDemo(){if(demoTimer){clearInterval(demoTimer);demoTimer=null;logger('Đã dừng demo tự động.');}}
async function startDemo(){
 if(arena.snapshot().mode!=='demo'){await tiktok.disconnect();arena.command('mode.set',{mode:'demo'});}
 stopDemo();logger('Bắt đầu demo: dữ liệu được tách khỏi LIVE thật.');
 let count=0;
 demoTimer=setInterval(()=>{
  try{
   let s=arena.snapshot();const m=s.match;
   if(m.phase==='waiting'){if(s.queue.length<2){for(const [uid,name]of[['demo_ember','Hỏa Quyền'],['demo_storm','Bão Xanh'],['demo_shadow','Bóng Đêm']])arena.command('queue.add',{uid,name});}arena.command('match.start');return;}
   if(m.phase!=='fighting')return;
   const side=count++%2?'red':'blue',fighter=m.fighters[side];if(!fighter)return;
   const moves=['đấm','móc','đấm','đỡ','đấm bốc','né','đá'];
   if(count%6===0){const rules=s.settings.cornerGifts||[],rule=rules[(Math.floor(count/6)-1)%Math.max(1,rules.length)];arena.ingest('gift',{uid:'demo_audience',name:'Khán giả cổ vũ',coins:rule?.coins||5,giftName:'Quà cổ vũ',eventId:`demo-${Date.now()}-${count}`},{source:'demo'});}
   else arena.ingest('chat',{uid:fighter.uid,name:fighter.name,text:moves[count%moves.length]},{source:'demo'});
  }catch(e){logger(`Demo: ${e.message}`);}
 },850);demoTimer.unref();
}
async function changePhone(on){
 if(rebinding)throw new Error('Đang đổi kết nối Wi-Fi, thử lại sau giây lát.');
 on=!!on;if(on===config.phoneEnabled)return {phoneEnabled:on,...obsLinks()};
 rebinding=true;const previous=config.phoneEnabled;
 const host=on?(process.env.ARENA_LAN_HOST||'0.0.0.0'):(process.env.HOST||'127.0.0.1');
 await new Promise((resolve,reject)=>{
  server.close();
  const failed=e=>{
   server.off('listening',ready);
   server.listen(port,previous?(process.env.ARENA_LAN_HOST||'0.0.0.0'):(process.env.HOST||'127.0.0.1'),()=>{rebinding=false;reject(new Error(`Không đổi được chế độ mạng (${e.code||e.message}).`));});
  };
  const ready=()=>{server.off('error',failed);resolve();};server.once('error',failed);server.once('listening',ready);server.listen(port,host);
 });
 config.phoneEnabled=on;saveConfig(config);arena.command('settings.set',{settings:{phoneEnabled:on}});rebinding=false;logger(on?'Đã bật xem overlay qua Wi-Fi. Bảng điều khiển vẫn chỉ trên máy này.':'Đã tắt xem qua Wi-Fi.');return obsLinks();
}
function obsLinks(){return {local:`http://localhost:${port}/overlay.html`,phone:config.phoneEnabled?lanIps().map(ip=>`http://${ip}:${port}/overlay.html`):[],port,phoneEnabled:config.phoneEnabled};}
function openObs(){
 if(process.platform!=='win32')throw new Error('Cửa sổ Edge tự động dành cho Windows. Mở link overlay bằng trình duyệt trên máy này.');
 const dirs=[process.env['ProgramFiles(x86)'],process.env.ProgramFiles,process.env.LOCALAPPDATA].filter(Boolean);
 const edge=dirs.map(d=>path.join(d,'Microsoft/Edge/Application/msedge.exe')).find(f=>fs.existsSync(f));
 if(!edge)throw new Error('Không tìm thấy Edge. Bạn có thể mở link overlay bằng trình duyệt.');
 const p=spawn(edge,[`--app=http://127.0.0.1:${port}/overlay.html`,'--window-size=560,1030',`--user-data-dir=${path.join(DATA,'overlay-browser')}`,'--autoplay-policy=no-user-gesture-required','--no-first-run'],{detached:true,stdio:'ignore'});p.on('error',e=>logger(`Không mở được cửa sổ: ${e.message}`));p.unref();return {ok:true};
}
const ENGINE_COMMANDS=new Set(['match.start','match.pause','match.resume','match.finish','match.next','match.reset','session.reset','queue.add','queue.remove','queue.clear','fighter.heal','fighter.attack']);
async function dispatch(method,p={}){
 if(!p||typeof p!=='object'||Array.isArray(p))throw new Error('Tham số phải là object.');
 if(ENGINE_COMMANDS.has(method))return arena.command(method,p)??{ok:true};
 switch(method){
  case 'state.get':return snapshot();
  case 'settings.set':{
   if(!p.settings||typeof p.settings!=='object'||Array.isArray(p.settings))throw new Error('Thiếu cài đặt.');
   const settings={...p.settings};delete settings.phoneEnabled;
   const result=arena.command(method,{settings});send({type:'music',...audio.music()});return result??arena.snapshot().settings;
  }
  case 'mode.set':{
   if(!['demo','live'].includes(p.mode))throw new Error('Chế độ không hợp lệ.');
   stopDemo();if(p.mode==='demo')await tiktok.disconnect();return arena.command(method,p)??{ok:true};
  }
  case 'demo.set':if(p.on)await startDemo();else stopDemo();return {running:!!demoTimer};
  case 'tiktok.connect':{
   if(arena.snapshot().mode!=='live')throw new Error('Chuyển sang LIVE trước khi kết nối TikTok. Dữ liệu demo được giữ riêng.');
   if(!String(p.uniqueId||'').trim())throw new Error('Nhập tên kênh đang LIVE.');
   if(p.signApiKey!==undefined)await dispatch('sign.set',{key:p.signApiKey});
   tiktok.connect(p.uniqueId).catch(e=>logger(`TikTok: ${e.message}`));return {ok:true};
  }
  case 'tiktok.disconnect':await tiktok.disconnect();return {ok:true};
  case 'sign.set':{
   const key=String(p.key??'').trim();if(key&&!/^[A-Za-z0-9._\-=+/]{8,300}$/.test(key))throw new Error('Key dịch vụ có định dạng không hợp lệ.');
   config.signApiKey=key;saveConfig(config);return {hasKey:!!key};
  }
  case 'gift.catalog':return {...catalog(),actions:ENGINE_GIFT_ACTIONS,map:arena.snapshot().settings.giftMap,cornerGifts:arena.snapshot().settings.cornerGifts};
  case 'gift.refresh':return refreshCatalog();
  case 'gift.map':{
   if(!p.map||typeof p.map!=='object'||Array.isArray(p.map))throw new Error('Bảng gán quà không hợp lệ.');
   const map={};for(const [id,action]of Object.entries(p.map))if(/^\d{1,20}$/.test(id)&&ENGINE_GIFT_ACTIONS.some(a=>a.id===action))map[id]=action;
   arena.command('settings.set',{settings:{giftMap:map}});return {map:arena.snapshot().settings.giftMap};
  }
  case 'music.list':return audio.music();
  case 'music.delete':return audio.deleteMusic(p.name);
  case 'mc.say':{const result=audio.say(safeText(p.text,300));if(result?.queued===false)throw new Error('Chưa có nội dung đọc hoặc hàng đợi giọng đang đầy.');return result;}
  case 'mc.test':return audio.say('Sẵn sàng chưa cả nhà! Góc đỏ áp sát, góc xanh dựng găng! Một cú móc cực mạnh! Ai sẽ trở thành nhà vô địch của Võ Đài LIVE hôm nay?');
  case 'mc.status':return audio.status();
  case 'obs.links':return obsLinks();
  case 'phone.set':return changePhone(p.on);
  case 'obs.open':return openObs();
  case 'state.export':return arena.export();
  default:{
   const [source,kind]=method.split('.');
   if(!['sim','event'].includes(source)||!['chat','gift','like','join'].includes(kind)||method!==`${source}.${kind}`)throw Object.assign(new Error('Phương thức không tồn tại.'),{rpcCode:-32601});
   if(source==='sim'&&arena.snapshot().mode!=='demo')throw new Error('Mô phỏng chỉ chạy trong chế độ DEMO.');
   if(source==='event'&&arena.snapshot().mode!=='live')throw new Error('Sự kiện ngoài chỉ nhận khi ở LIVE.');
   const payload={...p};payload.name=safeText(p.name||p.nickname||p.uniqueId||'Khách thử',40)||'Khách';
   payload.uid=safeText(p.uid||p.userId||p.uniqueId||`${source}_${payload.name}`,100);payload.text=safeText(p.text||p.comment||'',200);
   const gift=findGift(p.giftId,p.giftName||p.gift);if(kind==='gift'){payload.giftName=gift?.name||safeText(p.giftName||p.gift||'Quà',60);payload.giftId=String(p.giftId||gift?.id||'');const coins=Number(p.coins??p.diamondCount??gift?.coins??1);if(!Number.isFinite(coins)||coins<=0||coins>100000)throw new Error('Số xu phải từ 1 đến 100.000.');payload.coins=coins;}
   const result=arena.ingest(kind,payload,{source:source==='sim'?'demo':'live'});
   if(result?.ok===false&&!result.message){const messages={cooldown:'Đòn đang hồi. Chờ một nhịp rồi thử lại.',stamina:'Chưa đủ thể lực. Nghỉ một nhịp để hồi sức.',energy:'Cần đủ 100 năng lượng cho tuyệt kỹ.',unknown_command:'Chưa nhận ra lệnh. Dùng đấm, móc, đỡ, né, đá hoặc combo.',not_fighting:'Đòn chỉ được tung khi trận đang thi đấu.',duplicate:'Sự kiện quà đã được ghi nhận, không tính lại.',spectator:'Bạn chưa ở trên đài.',wrong_mode:'Nguồn sự kiện không khớp chế độ hiện tại.'};result.message=messages[result.reason]||'Chưa thực hiện được tương tác này.';}
   return result??{ok:true};
  }
 }
}
async function one(req){
 if(!req||typeof req!=='object'||Array.isArray(req)||req.jsonrpc!=='2.0'||typeof req.method!=='string'||('id'in req&&!['string','number'].includes(typeof req.id)&&req.id!==null))return {jsonrpc:'2.0',id:null,error:{code:-32600,message:'Yêu cầu JSON-RPC không hợp lệ.'}};
 const id=req.id,reply=body=>id===undefined?null:{jsonrpc:'2.0',id,...body};
 try{const result=await dispatch(req.method,req.params??{});publish();return reply({result:result??{ok:true}});}catch(e){return reply({error:{code:e.rpcCode||-32602,message:String(e.message||e).slice(0,300)}});}
}
async function handleRpc(msg){if(Array.isArray(msg)){if(!msg.length||msg.length>20)return {jsonrpc:'2.0',id:null,error:{code:-32600,message:'Batch nhận từ 1 đến 20 lệnh.'}};const result=[];for(const req of msg){const r=await one(req);if(r)result.push(r);}return result.length?result:null;}return one(msg);}
const server=createHttp({auth,getPort:()=>port,handleRpc,audio:()=>audio,exportState:()=>arena.export(),version:VERSION});
wss=new WebSocketServer({server,path:'/ws',maxPayload:65536,verifyClient:({req,origin})=>{if(!auth.goodHost(req.headers.host)||!auth.goodOrigin(origin))return false;const url=new URL(req.url,'http://local');return url.searchParams.get('role')!=='control'||auth.authorized(req,url);}});
wss.on('connection',(ws,req)=>{
 ws.on('error',()=>{logger('Đã đóng một kết nối WebSocket có dữ liệu không hợp lệ.');});
 ws.role=new URL(req.url,'http://local').searchParams.get('role')==='control'?'control':'overlay';ws.alive=true;ws.on('pong',()=>{ws.alive=true;});ws.send(JSON.stringify({type:'state',state:snapshot()}));ws.send(JSON.stringify({type:'music',...audio.music()}));
 ws.on('message',async bytes=>{if(ws.role!=='control')return;let m;try{m=JSON.parse(bytes);}catch{ws.send(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32700,message:'JSON không hợp lệ.'}}));return;}const out=await handleRpc(m);if(out&&ws.readyState===1)ws.send(JSON.stringify(out));});
});
const loops=[];loops.push(setInterval(()=>{try{audio.announce({type:'tick'},arena.snapshot());}catch{}},1000));loops.push(setInterval(()=>{try{arena.tick();publish();}catch(e){logger(`Luật trận: ${e.message}`);}},250));
loops.push(setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},30000));
loops.push(setInterval(()=>send({type:'music',...audio.music()}),15000));
async function freePort(preferred,host){for(let p=preferred;p<preferred+20;p++){const ok=await new Promise(resolve=>{const s=net.createServer();s.once('error',()=>resolve(false));s.listen(p,host,()=>s.close(()=>resolve(true)));});if(ok)return p;}throw new Error(`Không còn cổng trống ${preferred}–${preferred+19}.`);}
const host=config.phoneEnabled?(process.env.ARENA_LAN_HOST||'0.0.0.0'):(process.env.HOST||'127.0.0.1');
port=await freePort(port,host);
server.on('error',e=>{if(!rebinding){logger(`Lỗi server: ${e.message}`);console.error(e.code||e.message);}});
server.listen(port,host,()=>{
 writeJSON(path.join(DATA,'runtime.json'),{pid:process.pid,port,startedAt:Date.now()});
 logger('Võ Đài LIVE sẵn sàng. Không yêu cầu key bản quyền.');console.log(`VÕ ĐÀI LIVE ${VERSION}\nĐiều khiển: http://localhost:${port}/\nOverlay OBS: http://localhost:${port}/overlay.html\nDữ liệu: ${DATA}`);
 if(offline)console.log('Đang kiểm thử ngoại tuyến: không gọi TikTok hoặc tổng hợp giọng đám mây.');
 process.send?.({type:'ready',port});
});
async function shutdown(){if(stopping)return;stopping=true;stopDemo();for(const t of loops)clearInterval(t);try{store.flush();}catch{}try{audio.close();}catch{}await Promise.race([Promise.resolve(tiktok.disconnect()),new Promise(r=>setTimeout(r,1000))]);for(const ws of wss.clients)ws.terminate();wss.close();server.close();releaseInstance();process.exit(0);}
for(const sig of ['SIGINT','SIGTERM','SIGHUP'])process.on(sig,shutdown);
process.on('unhandledRejection',e=>logger(`Tác vụ thất bại: ${e?.message||e}`));
