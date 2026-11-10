# Võ Đài LIVE — shared implementation contract

Product: original boxing live arena inspired by supplied ThapSang layered architecture. No product license, activation key, vn-tool dependency or original private data. Node ES modules, vanilla browser modules, `ws`, TikTok connector, msedge TTS. Vietnamese interface. Repo /workspace/PhanTich.

## Transport (root owns)
`public/js/client.js` exports `connect({role='overlay',onState,onEvent,onStatus})` => `{call(method,params),close()}`. Fetch POST `/rpc` JSON-RPC2, same-origin cookie control authentication, overlay read-only. WebSocket `/ws?role=...` server notifications `{type:'state',state:STATE}`, other events `{type:'hit',...}`, `{type:'announcement',text,...}`, `{type:'tts',url,text,...}`, `{type:'music',files:[{name,url,size}],enabled,volume}`, `{type:'connection',...}`. onState receives full STATE; onEvent receives nonstate event; onStatus(bool). Client reconnect1.5sec. No external fonts/assets required. Escape all user text.

## Arena engine (engine agent owns src/arena.mjs and tests/arena.test.mjs)
Export `createArena({initial={},onEvent=()=>{},onSave=()=>{},now=Date.now,random=Math.random}={})` returns `.snapshot()`, `.export()` (serializable durable state), `.ingest(kind,payload,{source='live'}={})`, `.command(method,params={})`, `.tick()`. Do not create intervals internally (server owns tick250ms). Engine calls onEvent(event) and onSave(export). Engine settings returned in snapshot, updated with command('settings.set',{settings:...}). May throw Error with meaningful VN message.

Engine command names: `match.start`, `match.pause`, `match.resume`, `match.finish` ({winner:'red'|'blue'|null}), `match.next`, `match.reset`, `session.reset`, `queue.add` ({uid,name,avatar?}), `queue.remove`({uid}), `queue.clear`, `fighter.heal`({side,amount}), `fighter.attack`({side,move}), `mode.set`({mode:'demo'|'live'}). `mode.set` must clear ALL transient demo state and maintain separated live/demo persistence and ranking; demo can seed two named fighters, enough cinematic action. Live starts waiting, no synthetic fighter. Admission: gift cumulative entryCoins qualifies, free queue command `len dai` only when entryCoins=0, admin queue.add allowed. Live inputs source mismatching mode must be ignored. Repeated gifts deduped by eventId bounded TTL. Reset clears active timers/state; persistence resets interrupted match safely at load, restores queue/stats. Winner stays, challengers rotate automatically when autoNext.

Input payload shape `uid,name,avatar,text,count,coins,giftId,giftName,eventId` (coins = TOTAL of this gift event, no multiply again). kinds chat/like/gift/join. Chat Vietnamese aliases jab `dam/thang/jab`, hook `moc/dam moc/hook`, uppercut `dam boc/uppercut`, kick `da/kick`, block `do/chan/block`, dodge `ne/dodge`, ultimate `lien hoan/combo`, target support `do`/`xanh` (standalone exact command to pick corner); queued people issue commands only when active, audience gifts support selected corner or uid fighter; unassigned paid entrants queue. cooldown/stamina/energy/server-authoritative hp; no self-hit, bounded effects and gift damage.

State shape (stable):
```
{
 mode:'demo'|'live', now:number,
 match:{id:string,number:number,phase:'waiting'|'countdown'|'fighting'|'paused'|'finished',remainingMs:number,countdownMs:number,
  fighters:{red:FIGHTER|null,blue:FIGHTER|null},result:null|{winner:'red'|'blue'|null,reason:string,name:string}},
 queue:[{uid,name,avatar,coins,joinedAt}],
 leaderboard:[{uid,name,avatar,wins,kos,coins,streak}],supporters:[{uid,name,coins}],
 stats:{matches:number,punches:number,coins:number,viewers:number},
 settings:{title:'VÕ ĐÀI LIVE',roundSeconds:120,countdownSeconds:4,maxHp:1000,entryCoins:1,commentCooldownMs:1000,giftDamageCap:300,
  autoNext:true,holdWinnerSeconds:8,mcEnabled:true,mcVolume:80,mcRate:15,mcIdleSeconds:35,musicEnabled:false,musicVolume:25,sfxVolume:70,
  theme:'electric',showCommands:true,phoneEnabled:false,giftMap:{'5655':'flurry',...}},
 recent:[{id,type,text,at}]
}
FIGHTER={uid,name,avatar,hp,maxHp,stamina,maxStamina:100,energy:0..100,damage,combo,wins,streak}
```
Server augments state with `app:{name,version}`, `connection:{status:'idle'|'connecting'|'connected'|'error'|'reconnecting',uniqueId,error,hasSignKey}`, `demo:{running:bool}`, `audio:{...}`, `music:{...}`. Unknown optional fields tolerate.

Event `hit`: {type,side:'red'|'blue' (ATTACKER),target:'red'|'blue',move:'jab'|'hook'|'uppercut'|'kick'|'flurry'|'ultimate',damage,hits,critical,blocked,dodged,combo,gift:boolean,attacker:name,defender:name}. `defend`{side,move}, `match`{phase}, `ko`{winner,loser,name,reason}, `gift`{uid,name,coins,move,side}, `queue`{name,action}, `announcement`{text,priority}.

## RPC root API
Engine commands above plus `state.get`,`settings.set`,`tiktok.connect`({uniqueId,signApiKey?}),`tiktok.disconnect`,`sign.set`({key}),`demo.set`({on}),`sim.chat/gift/like/join` (payload uid/name defaults synthesized),`gift.catalog`=>{gifts:[{id,name,en,coins,img}],actions:[{id,label,emoji}],map},`gift.refresh`,`gift.map`({map}),`music.list`,`music.delete`({name}),`mc.say`({text}),`mc.test`,`obs.links`=>{local,phone:[],port,phoneEnabled},`phone.set`({on}),`obs.open`,`state.export`. `event.chat/gift/like/join` for integrations, require local token. `/upload/music` accepts raw body (50MiB limit) X-File-Name; `/download/state` exports sanitized data JSON with auth. No arbitrary software updater server (original private service unavailable): app info and manual portable update docs.

## Overlay agent owns
public/overlay.html, public/css/overlay.css, public/js/overlay.js, public/js/fighters.js, public/js/sound.js; assets original SVG if wanted. Full bespoke polished cinematic boxing scene, portrait1080x1920 fit responsive, transparent bg optional ?bg=transparent, mute preview ?mute=1; read-only WS; rich animation punch/hook/uppercut/kick/flurry/KO, particles/shake, camera, synthesized SFX, TTS HTML Audio with browser speech fallback/clear opt-in, music (state.music/event.music). `postMessage` for preview mute optional. Show timers/hp/stamina/energy, spectator commands, queue, rankings, connection offline and DEMO badges. Idle waiting state intentional polished, no misleading fake LIVE. Animate via event; stop animation on reset; max FX bounded, reduced motion respected. No React/build dependencies.

## Control agent owns
public/index.html, public/css/control.css, public/js/control.js. Complete premium Vietnamese dashboard with tabs Tổng quan, Điều khiển, Quà & luật, MC & âm thanh, Kết nối, Nhật ký; embedded overlay preview muted (right), dark sports editorial orange/lime palette consistent overlay; all CRUD settings/actions wired via above contract; sim tools only demo, prompts reset, accessible. Onboarding TikTok/OBS instructions; no license UI; optional Euler key in advanced connection (no app licensing). Gift catalog selector search images optional safe external; avoid image dependency for basic UI. Phone viewing copy links; MC controls/music uploader; show available actions/commands, explanatory game rules. Ensure all 6 tabs useful not placeholders. `connect` root client.

## Integration/audio agent owns
src/tiktok.mjs export createTikTok({onEvent,onStatus,getSignKey=()=>'',offline=false,logger=()=>{}}) => async connect(uniqueId), async disconnect(), status(); emit normalized onEvent(kind,payload) only. Dedup combos end/timeouts, cancel pending on disconnect; serialize connections/generation guard. No license. data catalog root handles. src/audio.mjs export createAudio({dataDir,musicDir,onEvent,getSettings,offline=false,logger}) => .announce(event,state), .say(text), .music(), .deleteMusic(name), .saveMusic(name,buf), .close(). Audio receives ALL arena events and selectively comments hit/KO/gifts/queue with throttle priority and occasional relevant donation invitation, TTS cache bounded; offline text announcement/browser speech fallback, no network on idle startup. createAudio.music returns {files:[{name,url,size}],enabled,volume}, uses settings mcEnabled/mcVolume/mcRate/musicEnabled/musicVolume. TTS URL '/audio/<safe filename>'. Child Python optional from original supported; msedge fallback with timeout no concurrent runaway. 50MiB upload validations root + audio.
```
