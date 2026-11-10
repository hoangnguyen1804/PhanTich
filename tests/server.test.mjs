import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {WebSocket} from 'ws';
import http from 'node:http';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const delay=ms=>new Promise(r=>setTimeout(r,ms));

test('full server: auth, RPC, arena, isolated demo, LAN, music, WebSocket, persistence',async t=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'vodai-server-'));
 const preferred=36000+Math.floor(Math.random()*5000);
 let child,output='';
 function launch(){child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,ARENA_HOME:home,ARENA_OFFLINE:'1',PORT:String(preferred),HOST:'127.0.0.1',ARENA_LAN_HOST:'0.0.0.0'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>{output+=b;});child.stderr.on('data',b=>{output+=b;});}
 async function ready(){for(let i=0;i<100;i++){if(child.exitCode!==null)throw new Error(output);try{const rt=JSON.parse(fs.readFileSync(path.join(home,'data/runtime.json'),'utf8'));const r=await fetch(`http://127.0.0.1:${rt.port}/health`);if(r.ok)return `http://127.0.0.1:${rt.port}`;}catch{}await delay(50);}throw new Error('Server không sẵn sàng: '+output);}
 async function stop(){if(child.exitCode!==null)return;const exited=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await Promise.race([exited,delay(3000)]);if(child.exitCode===null){child.kill('SIGKILL');await exited;}}
 t.after(async()=>{await stop();fs.rmSync(home,{recursive:true,force:true});});
 launch();let base=await ready();
 const config=JSON.parse(fs.readFileSync(path.join(home,'data/app-config.json'),'utf8'));
 const headers={'Content-Type':'application/json',Authorization:'Bearer '+config.rpcToken};
 let seq=0;
 async function rpc(method,params={}){const response=await fetch(base+'/rpc',{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:++seq,method,params})});assert.equal(response.status,200);return response.json();}
 async function call(method,params={}){const response=await rpc(method,params);assert.ok(!response.error,JSON.stringify(response));return response.result;}
 await t.test('health, UI cookie, no license required',async()=>{
  const r=await fetch(base+'/');assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);assert.match(await r.text(),/VÕ ĐÀI|Võ Đài/);
  const state=await call('state.get');assert.equal(state.app.noLicense,true);assert.equal(state.mode,'live');assert.equal(state.match.phase,'waiting');
 });
 await t.test('reject unsigned RPC, hostile Host and Origin',async()=>{
  assert.equal((await fetch(base+'/rpc',{method:'POST',body:'{}'})).status,401);
  assert.equal(await new Promise((resolve,reject)=>{const r=http.get(base+'/health',{headers:{Host:'evil.invalid'}},res=>{res.resume();resolve(res.statusCode);});r.on('error',reject);}),421);
  assert.equal((await fetch(base+'/rpc',{method:'POST',headers:{...headers,Origin:'https://evil.invalid'},body:'{}'})).status,403);
  assert.equal((await fetch(base+'/data/app-config.json')).status,404);
  assert.equal((await rpc('license.activate',{key:'not-used'})).error.code,-32601);
 });
 await t.test('a duplicate instance cannot overwrite the same data directory',async()=>{
  const second=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,ARENA_HOME:home,ARENA_OFFLINE:'1',PORT:String(preferred+30)},stdio:['ignore','pipe','pipe']});let message='';second.stderr.on('data',b=>{message+=b;});
  const code=await new Promise(resolve=>second.once('exit',resolve));assert.notEqual(code,0);assert.match(message,/đã chạy/);assert.equal((await fetch(base+'/health')).status,200);
 });
 await t.test('JSON-RPC validation, unknown method, request size',async()=>{
  assert.equal((await rpc('no.such.method')).error.code,-32601);
  const bad=await fetch(base+'/rpc',{method:'POST',headers,body:'{'});assert.equal(bad.status,400);
  const big=await fetch(base+'/rpc',{method:'POST',headers,body:JSON.stringify({data:'x'.repeat(66000)})});assert.equal(big.status,413);
 });
 await t.test('catalog and mapped kick action',async()=>{
  const cat=await call('gift.catalog');assert.equal(cat.gifts.length,695);assert.ok(cat.actions.find(a=>a.id==='kick'));
  await call('gift.map',{map:{'5655':'kick'}});assert.equal((await call('state.get')).settings.giftMap['5655'],'kick');
 });
 await t.test('live admissions and anti-replay',async()=>{
  await call('event.gift',{uid:'one',name:'Võ sĩ Một',coins:1,eventId:'gift-one'});
  await call('event.gift',{uid:'two',name:'Võ sĩ Hai',coins:1,eventId:'gift-two'});
  const before=await call('state.get');assert.equal(before.stats.coins,2);
  await call('event.gift',{uid:'two',name:'Võ sĩ Hai',coins:1,eventId:'gift-two'});
  assert.equal((await call('state.get')).stats.coins,2);
  assert.ok((await rpc('sim.chat',{name:'Wrong',text:'đấm'})).error);
 });
 await t.test('demo kept separate, simulation works, live snapshot survives',async()=>{
  await call('mode.set',{mode:'demo'});
  await call('settings.set',{settings:{countdownSeconds:0,mcEnabled:false}});
  let state=await call('state.get');if(state.match.phase==='countdown')await delay(4500);
  await call('sim.gift',{uid:state.match.fighters.red.uid,name:state.match.fighters.red.name,coins:10,eventId:'demo-gift'});
  state=await call('state.get');assert.equal(state.mode,'demo');assert.ok(state.stats.coins>=10);
  await call('mode.set',{mode:'live'});state=await call('state.get');assert.equal(state.stats.coins,2);assert.equal(state.leaderboard.some(p=>p.uid.startsWith('demo_')),false);
 });
 await t.test('websocket overlay read-only and control auth',async()=>{
  const denied=new WebSocket(base.replace('http','ws')+'/ws?role=control');
  await new Promise((resolve,reject)=>{denied.on('open',()=>{denied.close();reject(new Error('Unauthorized WS accepted'));});denied.on('unexpected-response',(_req,res)=>{assert.equal(res.statusCode,401);res.resume();resolve();});denied.on('error',()=>{});});
  const ws=new WebSocket(base.replace('http','ws')+'/ws');
  const state=await new Promise((resolve,reject)=>{ws.on('error',reject);ws.on('message',b=>{const e=JSON.parse(b);if(e.type==='state')resolve(e.state);});});
  assert.equal(state.mode,'live');ws.send(JSON.stringify({jsonrpc:'2.0',id:88,method:'session.reset'}));await delay(100);assert.equal((await call('state.get')).stats.coins,2);ws.close();
 });
 await t.test('malformed websocket cannot terminate the server',async()=>{
  const ws=new WebSocket(base.replace('http','ws')+'/ws?role=control',{headers:{Authorization:headers.Authorization}});
  ws.on('error',()=>{});await new Promise((resolve,reject)=>{ws.once('open',()=>ws.send('x'.repeat(70000)));ws.once('close',code=>{assert.equal(code,1009);resolve();});setTimeout(()=>{ws.terminate();reject(new Error('WebSocket did not reject oversized frame'));},2000).unref();});
  assert.equal((await fetch(base+'/health')).status,200);
 });
 await t.test('music upload, ranges, invalid file and delete',async()=>{
  const wav=Buffer.alloc(2048);wav.write('RIFF');wav.writeUInt32LE(2040,4);wav.write('WAVE',8);
  const r=await fetch(base+'/upload/music',{method:'POST',headers:{Authorization:headers.Authorization,'X-File-Name':'test.wav'},body:wav});assert.equal(r.status,200);const saved=await r.json();assert.equal(saved.name,'test.wav');
  const range=await fetch(base+'/music/test.wav',{headers:{Range:'bytes=0-63'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,64);
  assert.equal((await fetch(base+'/music/test.wav',{headers:{Range:'bytes=9999-'}})).status,416);
  assert.equal((await fetch(base+'/upload/music',{method:'POST',headers:{Authorization:headers.Authorization,'X-File-Name':'bad.wav'},body:'not music'})).status,400);
  await call('music.delete',{name:'test.wav'});assert.equal((await fetch(base+'/music/test.wav')).status,404);
 });
 await t.test('LAN toggles preserve local auth and server health',async()=>{
  let r=await call('phone.set',{on:true});assert.equal(r.phoneEnabled,true);assert.equal((await fetch(base+'/health')).status,200);
  const ip=Object.values(os.networkInterfaces()).flat().find(x=>x&&x.family==='IPv4'&&!x.internal)?.address;
  if(ip){const remote=base.replace('127.0.0.1',ip);assert.equal((await fetch(remote+'/overlay.html')).status,200);assert.equal((await fetch(remote+'/',{headers:{Authorization:headers.Authorization}})).status,403);assert.equal((await fetch(remote+'/rpc',{method:'POST',headers,body:'{}'})).status,403);}
  r=await call('phone.set',{on:false});assert.equal(r.phoneEnabled,false);assert.equal((await call('state.get')).settings.phoneEnabled,false);
 });
 await t.test('safe state export and persisted live state after restart',async()=>{
  const out=await fetch(base+'/download/state',{headers:{Authorization:headers.Authorization}});assert.equal(out.status,200);const data=await out.text();assert.ok(!data.includes(config.rpcToken));
  await stop();output='';launch();base=await ready();assert.equal((await call('state.get')).stats.coins,2);
 });
 await t.test('1.1 exact coin routing ignores donor identity and selected corner; delayed impacts',async()=>{
  await call('mode.set',{mode:'live'});await call('session.reset');
  await call('settings.set',{settings:{autoSparring:false,countdownSeconds:0,mcEnabled:false,autoNext:false}});
  await call('queue.add',{uid:'fighter-red',name:'Võ sĩ Đỏ'});await call('queue.add',{uid:'fighter-blue',name:'Võ sĩ Xanh'});await call('match.start');
  const s=await call('state.get');assert.equal(s.match.phase,'fighting');assert.equal(s.giftMenu.length,8);assert.ok(s.giftMenu.every(x=>x.side==='red'||x.side==='blue'));
  await call('event.chat',{uid:'spectator',name:'Khán giả',text:'xanh'});
  const ws=new WebSocket(base.replace('http','ws')+'/ws');const events=[];ws.on('message',b=>{events.push(JSON.parse(b));});await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
  const r=await call('event.gift',{uid:'spectator',name:'Khán giả',coins:5,eventId:'route-red'});assert.equal(r.side,'red');assert.equal(r.move,'flurry');
  assert.equal((await call('state.get')).match.fighters.blue.hp,s.match.fighters.blue.hp);
  await delay(1900);const after=await call('state.get');assert.ok(after.match.fighters.blue.hp<s.match.fighters.blue.hp);assert.equal(after.queue.length,0);
  const start=events.findIndex(e=>e.type==='attack.start'&&e.side==='red'),hit=events.findIndex(e=>e.type==='hit'&&e.side==='red');assert.ok(start>=0&&hit>start);assert.equal(events[hit].sequenceId,events[start].sequenceId);
  const b=await call('event.gift',{uid:'fighter-red',name:'Võ sĩ Đỏ',coins:6,eventId:'route-blue'});assert.equal(b.side,'blue');await delay(1900);assert.ok((await call('state.get')).match.fighters.red.hp<s.match.fighters.red.hp);ws.close();
 });
 await t.test('1.1 duplicate corner prices rejected atomically; draw rejected; boosts and heals bounded',async()=>{
  const initial=(await call('state.get')).settings.cornerGifts;
  const bad=await rpc('settings.set',{settings:{cornerGifts:[{coins:5,side:'red',action:'flurry'},{coins:5,side:'blue',action:'heal'}]}});assert.ok(bad.error);assert.deepEqual((await call('state.get')).settings.cornerGifts,initial);
  assert.ok((await rpc('match.finish',{winner:null})).error);
  await call('event.gift',{uid:'spectator',name:'Khán giả',coins:99,eventId:'power-red'});let s=await call('state.get');assert.ok(s.match.fighters.red.powerMultiplier>1);
  const hp=s.match.fighters.blue.hp;await call('event.gift',{uid:'spectator',name:'Khán giả',coins:20,eventId:'heal-blue'});s=await call('state.get');assert.ok(s.match.fighters.blue.hp>=hp&&s.match.fighters.blue.hp<=s.match.fighters.blue.maxHp);
 });
 await t.test('1.1 late streak correction is accounting-only and cannot target opposite corner',async()=>{
  const before=await call('state.get');const r=await call('event.gift',{uid:'spectator',name:'Khán giả',coins:6,streakCoins:11,isStreakCorrection:true,eventId:'late-streak'});const after=await call('state.get');
  assert.equal(after.stats.coins,before.stats.coins+6);assert.equal(after.match.fighters.red.hp,before.match.fighters.red.hp);assert.equal(after.match.fighters.blue.hp,before.match.fighters.blue.hp);
  await delay(1900);assert.equal((await call('state.get')).match.fighters.red.hp,before.match.fighters.red.hp);
 });

});
